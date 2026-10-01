# SPEC-209 — Dos cosas que hoy hace el proceso y puede hacer la base

> **Origen:** [`AUDITORIA-2026-09-11-calidad-del-backend.md`](AUDITORIA-2026-09-11-calidad-del-backend.md)
> §B-13 y §B-14. Nivel 🟢. **Independiente.** No toca ningún criterio del SOM.

## B-13 · El aviso a los investors es un N+1 adentro de una subida de archivo

`developer-evidencia.routes.ts:186` consulta las unidades del proyecto con
`.where("investorId", "is not", null)` y selecciona **solo `id`**. Después, línea 193:

```ts
for (const unidad of unidades) {
  await notifyUnitInvestor({ unitId: unidad.id, … });   // vuelve a SELECT Unit.investorId
}
```

`notifyUnitInvestor` **re-consulta `Unit.investorId`** —el dato que la query de arriba ya tenía y
descartó— y después inserta. Dos queries por unidad, **secuenciales**, adentro de la request que el
frontend está esperando para abrir el `AnchoringSuccessModal`, que M2-D5 §2.2 obliga a resolver en la
misma respuesta. **Un proyecto de 50 unidades vendidas son 100 round-trips.**

**El arreglo:** seleccionar `investorId` en la primera query y hacer un
`insertInto("Notification").values([...])` múltiple. **Una query en total.**

## B-14 · Un filtro en memoria que es un `where`

Solo los audit logs y dos listados con cursor aceptan `limit`. `GET /projects`,
`GET /developer/documents`, `GET /investor/units`, `GET /developer/progress` y `GET /users` devuelven
todo lo que haya.

**Con 3 proyectos y 30 stages eso es irrelevante, y el repo tiene razón en no construir
infraestructura para problemas que todavía no duelen** — es la misma decisión del cron revertido, y
está bien tomada. **Esta spec no agrega paginación.**

Lo que sí se arregla hoy, sin decidir nada sobre paginación: `GET /developer/documents`
(`developer.routes.ts:317`) trae **toda** la evidencia de **todos** los proyectos del developer y
después filtra por estado de anclaje **en memoria**:

```ts
const filtrados = parsed.data.status === "anchored"
  ? documentos.filter((d) => d.txid !== null)
  : parsed.data.status === "pending" ? documentos.filter((d) => d.txid === null) : documentos;
```

Ese filtro es un `where` sobre `OnChainEvent.txid`. **La lista ya viene de un `leftJoin`.**

## Invariantes

1. **Un aviso a N investors cuesta un número constante de queries**, no 2N.
2. **Ningún filtro que la base puede expresar se aplica en memoria.**
3. **Ninguna respuesta cambia de forma ni de orden.** Las dos son optimizaciones puras: mismos
   cuerpos, mismos tests.
4. La decisión sobre paginación **queda donde está** (no se toma acá), y se anota que sigue abierta.

## Casos borde (definen los tests)

| Caso | Esperado |
|---|---|
| Proyecto sin unidades vendidas | cero notificaciones, cero queries de más |
| Dos unidades del mismo investor | el comportamiento de hoy se conserva (una notificación por unidad, o una por investor — **el test lo fija antes de tocar**) |
| `status=anchored` con evidencia sin evento | queda afuera, igual que hoy |
| `status=pending` con evidencia con evento `Failed` | **igual que hoy**: el filtro es sobre `txid IS NULL`, no sobre el estado del evento — si eso está mal es otro hallazgo, no este refactor |
| Sin `status` | devuelve todo, igual que hoy |
| Evidencia con más de un `OnChainEvent` | el `leftJoin` puede duplicar filas: el `where` **no** puede cambiar cuántas vuelven |

> El último es el que hay que mirar de verdad: mover un filtro de memoria a SQL sobre un `leftJoin`
> es exactamente donde aparece una fila de más. El test va antes del cambio.
