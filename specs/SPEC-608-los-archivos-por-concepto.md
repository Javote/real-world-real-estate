# SPEC-608 — Los archivos de la API por concepto, no por prefijo

> Serie `6xx`, refactor post-M3 ([`PROPUESTA-2026-09-30-refactor-post-m3.md`](PROPUESTA-2026-09-30-refactor-post-m3.md)).
> **No es mandato hasta entregar M3.** Nivel 🟢: mueve código sin cambiar comportamiento.
> **Depende de [`SPEC-607`](SPEC-607-una-sola-capa-de-api.md).** Sin ella, partir sigue costando lo
> que midió `SPEC-015` §6. **Reabre la aplicación de esa regla, no la regla**, a pedido del dueño
> (2026-09-30).

## La regla de `SPEC-015` §6 se queda. Lo que cambia es su costo

`SPEC-015` §6 cerró así: *"un router se parte cuando mezcla concerns, y el nombre del archivo nuevo
tiene que poder decir cuál"*. Descartó partir por **largo**, y eso sigue en pie. Lo que no llegó a
decir es que **los routers grandes ya mezclan concerns hoy**, y que la regla no se aplicó por un
costo que viene de Express:

- **`app.ts` lo dice en su propio comentario:** *"El precio es agrupar por PREFIJO y no por concepto
  de dominio: la superficie del investor está junta aunque toque unidades, dossier, contratos e
  invitaciones."*
- **El precio** era que cada router nuevo sobre un prefijo compartido es un invariante más: todos
  tienen que declarar los mismos guards de router. `/api/v1/developer` ya tiene cuatro.

Con `SPEC-607`, **el guard es de cada procedimiento y no hay routers de Express por prefijo**. Ese
invariante desaparece, y partir por concepto pasa a costar solo mover código.

## Lo que hay hoy, medido el 2026-09-30

| Archivo | Líneas | Conceptos que mezcla |
|---|---:|---|
| `investor.routes.ts` | 850 | favoritos · unidades y novedades · dossier (ver, exportar, compartir) · notificaciones · invitaciones · contratos |
| `projects.routes.ts` | 779 | proyectos (ABM) · miembros · invitaciones de certifier · documentos · esquema del edificio · perfil del developer |
| `developer.routes.ts` | 659 | proyectos del developer · progreso · documentos y anclaje · audit log · KPIs · geocoding |
| `developer-comercial.routes.ts` | 634 | unidades · invitaciones · contratos y releases |
| `evidence.routes.ts` | 586 | evidencia (ver, bajar, borrar, anclar) · reconciliación · pruebas Merkle |

Y al revés, **un mismo concepto hoy está repartido por rol**: las invitaciones viven en
`investor` (aceptar), en `developer-comercial` (emitir) y en `certifier` más `projects` (las de
certifier). El dossier vive en `investor` (el de la unidad) y en `notary` (la revisión).

## Alcance

1. **La API se organiza por concepto de dominio**:
   `apps/api/src/features/<concepto>/procedures.ts` (los handlers) y, cuando exista,
   `queries.ts` ([`SPEC-604`](SPEC-604-la-capa-de-datos-sale-de-los-routers.md)). Los conceptos salen de
   la tabla de arriba: `auth`, `users`, `projects`, `stages`, `evidence`, `units`, `invitations`,
   `contracts`, `dossiers`, `favorites`, `notifications`, `profile`, `audit`, `capital`, `panels`
   (los KPIs), `public`.
2. **El contrato se organiza igual**, en `packages/shared/src/contract/<concepto>.ts`.
3. **Los paths no se mueven.** Los define M2-D5, y siguen organizados por rol (`/investor/*`,
   `/developer/*`, …). Un único `router.ts` arma el árbol por rol a partir de los procedimientos de
   cada concepto: ahí se ve, en un solo archivo, qué superficie tiene cada rol.
4. **Se mueve de a un concepto por commit.** Cada commit deja `verify:all` en verde y la `MATRIZ`
   intacta.

## Invariantes

1. **Cero cambios de comportamiento**: las respuestas, el OpenAPI publicado y la `MATRIZ` de
   `route-guards.test.ts` quedan iguales.
2. **El nombre del archivo dice el concepto** (la regla de `SPEC-015` §6). Si un archivo necesita
   "y" en el nombre, está mezclando.
3. **Un concepto no importa los procedimientos de otro**; lo compartido va a `domain/` o `queries/`.

## Sobre los comentarios (sugerencia, decide el dueño)

En `routes/` hay **1606 líneas de comentario contra 4667 de código** (~26%). Buena parte justifica
decisiones, y eso vale. Otra parte narra historia ("antes…", "el 2026-09-22…"), que ya está en
`git log` y en `DECISIONS.md`. Mover código es la oportunidad de dejar el porqué vigente en el
código y mandar la crónica al cuerpo del commit. **No es parte del alcance** salvo que el dueño lo
pida: cambia una costumbre del repo.

## Tamaño

Mediano y mecánico, un concepto por commit. Se puede hacer de a poco, en paralelo con otro trabajo.
