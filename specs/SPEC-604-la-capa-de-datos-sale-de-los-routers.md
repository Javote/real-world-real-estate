# SPEC-604 — Las lecturas repetidas salen de los routers

> Serie `6xx`, refactor post-M3 ([`PROPUESTA-2026-09-30-refactor-post-m3.md`](PROPUESTA-2026-09-30-refactor-post-m3.md)).
> **No es mandato hasta entregar M3.** Nivel 🟢: refactor sin cambio de comportamiento, con las
> respuestas de la API fijadas por los tests existentes. **Cuándo:** no como tanda propia, sino
> la primera vez que una feature nueva (por ejemplo [`SPEC-501`](SPEC-501-panel-de-metricas-del-piloto.md),
> que agrega agregados) necesite una de estas lecturas.

## Qué NO es esta spec

**No es partir routers por largo.** [`SPEC-015`](SPEC-015-saneamiento-de-la-instrumentacion.md)
§El ítem 6 lo midió y lo descartó: la auditoría del backend leyó los 51 archivos y ninguno de sus
15 hallazgos venía del largo de un router, y cada archivo nuevo sobre un prefijo compartido es un
invariante más de guards. **Esa regla sigue en pie.** Tampoco es una reestructura en carpetas por
feature. Esta spec mueve **lecturas**, no rutas. **Si se hace [`SPEC-608`](SPEC-608-los-archivos-por-concepto.md)**
(archivos por concepto, después de `SPEC-607`), esta spec se disuelve ahí: cada `queries.ts` vive
en la carpeta de su concepto, con las mismas reglas de abajo.

## Lo que hay hoy, medido el 2026-09-30

| | Cuánto |
|---|---|
| `selectFrom`/`insertInto`/`updateTable`/`deleteFrom` en `routes/` | **125** |
| Lo mismo en `domain/` | 26 (hay capa de dominio, pero solo para lo transaccional: FSM, anclaje, dossier) |
| `selectFrom("Stage")` | **20 queries en 10 routers** |
| `selectFrom("Evidence")` | 16 en 7 routers |
| `selectFrom("Unit")` | 13 en 6 routers |
| `selectFrom("OnChainEvent")` | 9 en 6 routers |

Las mismas lecturas, escritas varias veces a mano:

- **"Las etapas de un proyecto, en orden"** (`where projectId = ? orderBy sequenceOrder asc`):
  `projects.routes.ts` (2), `projects-obra.routes.ts`, `developer.routes.ts`.
- **"El estado de las etapas de N proyectos"**, la base de cualquier avance agregado
  (`select state where projectId in (...)`): `developer.routes.ts`, `certifier.routes.ts`.
- **"Esta etapa pertenece a este proyecto"** (`where id = ? and projectId = ?`):
  `projects-obra.routes.ts` (2) y otras.

**Esto ya produjo un bug de esta clase.** [`SPEC-109`](SPEC-109-tipos-de-respuesta-desde-shared.md)
encontró que `/developer/project/:id` mostraba siempre **avance 0%**: el listado calculaba el
agregado y el detalle no, y el `?? 0` del front lo tapaba. Dos lugares que calculan "lo mismo" por
separado terminan calculando cosas distintas.

## Alcance

1. **`apps/api/src/queries/<entidad>.ts`**: funciones Kysely con nombre, que reciben `db` (o una
   `Transaction`) como primer argumento para poder usarse adentro de `db.transaction()`. Ejemplos:
   `etapasDelProyecto(db, projectId)`, `estadosDeEtapas(db, projectIds)`,
   `etapaDelProyecto(db, projectId, stageId)`.
2. **Se extrae una lectura cuando aparece por segunda vez**, no antes. La primera copia se queda
   donde está.
3. **Los agregados que hoy viven en `domain/project-aggregates.ts` se quedan en `domain/`**: son
   lógica, no lecturas. Las funciones de `queries/` no calculan nada, solo leen.
4. **La autorización no se mueve.** El scope de visibilidad sigue saliendo de `projectScope` /
   `authorize` (D-043, D-088). Una función de `queries/` **nunca decide qué puede ver quién**: recibe
   ids ya autorizados. Si una lectura necesita el scope, lo recibe como parámetro, no lo reimplementa.
5. **Primer lote:** la familia `Stage` de la tabla de arriba. Es la que tiene el bug de antecedente.

## Invariantes

1. **Cero cambios de respuesta.** Los tests de rutas de `apps/api` (100/100/100/100, SPEC-018)
   pasan sin tocar ninguna expectativa.
2. **`route-guards.test.ts` sin cambios**: ninguna ruta ni guard se mueve.
3. **Una función de `queries/` no importa nada de `middlewares/`.** Lo fija un test de imports (o
   la regla de Biome equivalente), para que la autorización no se cuele en la capa de lectura.

## Verificación

`pnpm verify:all` en verde, y `grep -c 'selectFrom("Stage")' apps/api/src/routes/*.ts` baja en la
cantidad de copias extraídas. El número queda anotado en la fila de `specs/README.md`.

## Tamaño

Chico por lote. Se hace de a una familia de lecturas, cuando la necesita la feature que se está
construyendo.
