# SPEC-219 — `UNIQUE (stageId, sha256Hash)` en `Evidence`: la restricción detrás de la regla

> **Origen:** [`SPEC-218`](SPEC-218-subida-de-evidencia-por-lote.md) §El archivo repetido, que hace cumplir
> *"un stage no tiene dos evidencias con el mismo SHA-256"* **en la aplicación** y deja anotado el hueco
> que esto cierra. Nivel 🟡: migración con Turso vivo (D-063). Desarrollada 2026-09-20.
> Estado: **cerrada 2026-09-21.** Paso 0 en cero (2026-09-20); `SPEC-218` cerró y mergeó el mismo día;
> el catch de la carrera, la migración y los tres niveles de test (índice, HTTP, idempotencia contra
> una copia real de la base) están escritos, corridos y en verde. Ver §Paso 0, §Lo que se hace y §Orden.

## El hueco que cierra

`SPEC-218` chequea repetidos dentro de la aplicación: lee los hashes ya guardados del stage y rechaza el
archivo que coincide. Es un chequeo de "leer y después escribir": **dos requests simultáneos con el mismo
archivo pueden pasar los dos** antes de que cualquiera inserte. Solo una restricción de la base lo
impide por construcción, que es el mismo criterio de `0006` (dossier por unidad) y `0007` (bundle por
stage): la invariante en el esquema, no en la buena fe del código.

Hoy la carrera es de un solo developer subiendo a mano, así que **no urge** — por eso esto es una spec
aparte y no parte de `SPEC-218`, cuyo primer commit es reversible con un `git revert` y esta migración no.

## Paso 0 — medir, antes de escribir una línea

Si en producción ya hay dos `Evidence` con el mismo `(stageId, sha256Hash)`, el `CREATE UNIQUE INDEX`
falla. Y en Render la migración corre en el `startCommand`, encadenada con `&&` **antes** de levantar el
servidor (`render.yaml`): una migración que falla **impide que el deploy arranque**.

Consulta de solo lectura contra la base de producción (`turso db shell`, con el login del dueño — no se
puede correr desde una sesión de código):

```sql
SELECT stageId, sha256Hash, COUNT(*) AS n, GROUP_CONCAT(id) AS ids
FROM Evidence
WHERE stageId IS NOT NULL
GROUP BY stageId, sha256Hash
HAVING COUNT(*) > 1;
```

- **Cero filas →** se sigue con el resto de la spec.
- **Hay filas →** no se escribe la migración todavía. **Borrar el duplicado no es trivial:**
  `EvidenceBundleItem.evidenceId` referencia `Evidence` con `ON DELETE no action`, así que una evidencia
  que ya entró a un bundle anclado no se puede borrar sin romper la prueba. Las salidas son un volcado a
  `specs/evidence/` y un `DELETE` por id autorizado por el dueño (el precedente de `0007`, que exigió las
  dos cosas) o un **índice parcial** (`WHERE uploadedAt > <corte>`) que solo proteja lo nuevo. Es una
  decisión del dueño con los datos delante.

**Medido localmente (2026-09-20):** `apps/api/.data/dev.db` tiene 0 filas en `Evidence`: no dice nada de
producción.

**Medido en producción (2026-09-20), `turso db shell propnexus`, con el login del dueño ya activo en la
máquina — no hizo falta un login nuevo:**

```
$ turso db shell propnexus "SELECT COUNT(*) AS total_evidence FROM Evidence;"
TOTAL EVIDENCE
35

$ turso db shell propnexus "SELECT stageId, sha256Hash, COUNT(*) AS n, GROUP_CONCAT(id) AS ids
  FROM Evidence WHERE stageId IS NOT NULL GROUP BY stageId, sha256Hash HAVING COUNT(*) > 1;"
STAGEID     SHA256HASH     N     IDS
```

**Cero filas, sobre 35 evidencias reales.** El `CREATE UNIQUE INDEX` no rompe el `startCommand` de
Render hoy: no hace falta volcado ni `DELETE` previo, a diferencia de lo que pidieron `0006` y `0007`.
**El Paso 0 queda cerrado.**

**Verificado dos veces más, ya con `SPEC-218` en `main` (2026-09-21), antes de aplicar contra Turso de
verdad:** `node apps/api/dist/src/db/migrate.js` (el binario compilado, el mismo que corre en Render)
contra `apps/api/.data/dev.db`, y **contra un export real de producción**
(`turso db export propnexus`, 35 filas de `Evidence`) — las dos veces aplicó sin error, dejó
`Evidence_stageId_sha256Hash_key` creado y `Evidence_stageId_idx` borrado, y una segunda corrida fue
`sin migraciones pendientes`. Las dos copias se borraron después, no quedaron en el repo ni en el
scratchpad.

## Lo que se hace

1. **`migrations/0009_evidence_hash_unico.sql`** — migración **nueva**, no una edición de `0000` (con
   Turso vivo toda corrección es migración nueva, D-063):
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS `Evidence_stageId_sha256Hash_key`
     ON `Evidence` (`stageId`, `sha256Hash`);
   --> statement-breakpoint
   DROP INDEX IF EXISTS `Evidence_stageId_idx`;
   ```
   `IF NOT EXISTS` por idempotencia (D-012). El `DROP` es porque `stageId` es el prefijo del compuesto y
   un `WHERE stageId = ?` sigue usando índice — el mismo argumento de `0006` y `0007`.
2. **No es una entrada de `CONSTRAINT_ERRORS` — investigado 2026-09-20, corrige lo que decía este ítem
   antes.** `CONSTRAINT_ERRORS` (`errorHandler.ts`) mapea por **código SQLite**
   (`SQLITE_CONSTRAINT_UNIQUE` → `409 RESOURCE_ALREADY_EXISTS`), no por índice: hoy **ningún** índice
   único de los ~10 que tiene la base se distingue del resto ahí, y agregar uno rompería esa
   uniformidad para los demás sin necesidad. Además `EVIDENCE_ALREADY_IN_STAGE` en `SPEC-218` no es un
   error HTTP con `code` — es un ítem de `rejected` **dentro** de una respuesta 200/207 (ver
   `packages/shared/src/evidence-files.ts`, `EvidenceRejection`). Lo que hace falta es un catch en el
   handler mismo (`developer-evidencia.routes.ts`) — **escrito el 2026-09-21**, apenas `SPEC-218`
   mergeó: envuelve el `INSERT` en transacción, mira `codigoDeRestriccion(err) ===
   "SQLITE_CONSTRAINT_UNIQUE"` y el `message` de SQLite para esta restricción —
   `UNIQUE constraint failed: Evidence.stageId, Evidence.sha256Hash` (confirmado con un insert directo
   contra una base de prueba, no adivinado, lo bastante específico como para no confundirse con otro
   índice de la misma tabla) — y responde `409 EVIDENCE_ALREADY_IN_STAGE` para el pedido entero, con la
   limpieza que describe el punto 3.
3. **El handler de `SPEC-218` no cambió su lógica de chequeo previo:** se queda, porque es el que da
   rechazos **por archivo** y sin abortar el lote. El índice es la red de seguridad: si aun así el
   `INSERT` lo viola (la carrera), la transacción se revierte y el pedido falla entero con `409`, con la
   limpieza de lo ya guardado que ese handler ya hace ante una falla de infraestructura. **El código de
   ese 409 es `EVIDENCE_ALREADY_IN_STAGE`** — no había obligación de que coincidiera con la forma de
   `CONSTRAINT_ERRORS`, es un código de negocio elegido a mano en el catch del punto 2, igual que
   `STAGE_ALREADY_COMPLETED` ya lo es en el mismo archivo.

## Lo que hay que tener presente

- **`stageId` NULL queda fuera.** En SQLite un `UNIQUE` trata los NULL como distintos: los documentos a
  nivel proyecto (`POST /developer/documents`, sin stage) no quedan cubiertos. Es consistente con la
  regla ("un **stage** no tiene…"), pero se escribe para que nadie crea que el índice cubre todo.
- **`SPEC-210` (borrar evidencia anclada) libera el hash — revisado 2026-09-20, y es benigno.**
  `SPEC-210` (cerrada) hace que `DELETE /evidence/:id` solo borre de verdad —204, fila y archivo
  fuera— cuando la evidencia **no** tiene `OnChainEvent` ni participa de un `EvidenceBundle`; si tiene
  cualquiera de las dos, da 409 antes de tocar nada. Consecuencia: una evidencia que se llegó a borrar
  de verdad nunca estuvo anclada, así que liberar su `(stageId, sha256Hash)` para un re-upload no
  reintroduce el riesgo que el índice existe para prevenir (dos evidencias **vivas** con el mismo hash
  sobre el mismo stage). No hace falta ningún caso borde extra para esto.
- **Los tests que repiten contenido en un mismo stage** ya cambiaron por `SPEC-218`; este índice no sumó
  reescrituras, sumó **dos tests**: `apps/api/test/spec-219-evidence-hash-unico.test.ts` (4 casos,
  insertando directo contra `Evidence`, sin pasar por la ruta HTTP) y, en `evidence-upload.test.ts`, uno
  que dispara la carrera real por HTTP (`Promise.all` con dos `POST` concurrentes) — verificado 5
  corridas seguidas, no es flaky.
- **`test.template.db`** se regenera desde las migraciones — confirmado leyendo `global-setup.ts`:
  `setup()` borra `TEST_DB_DIR` entero (`rmSync` recursivo) y vuelve a aplicar todas las migraciones
  con `applyPendingMigrations` antes de sembrar. No hace falta ningún paso manual: en cuanto exista el
  archivo `0009`, la próxima corrida de test ya lo tiene.

## Casos borde (definen los tests)

- Dos `INSERT` directos con el mismo `(stageId, sha256Hash)` → el segundo falla con
  `SQLITE_CONSTRAINT_UNIQUE`. **Probado** en `test/spec-219-evidence-hash-unico.test.ts`.
- Mismo hash en **dos stages** distintos → se acepta. Probado.
- Dos filas con `stageId` NULL y el mismo hash → se aceptan (documenta el límite de arriba). Probado.
- La carrera real: dos pedidos concurrentes con el mismo archivo → uno `201`, el otro `409
  EVIDENCE_ALREADY_IN_STAGE`, **una** sola fila y **cero** objetos huérfanos en el storage. **Probado**
  en `evidence-upload.test.ts` (`Promise.all` de dos `POST` reales, mismo patrón que
  `accept-invitation-atomic.test.ts`).
- La migración es idempotente: correrla dos veces no falla. `IF NOT EXISTS`/`IF EXISTS` en las dos
  sentencias lo garantizan por construcción, y se verificó igual —dos veces, contra la base real de
  producción exportada y contra una copia de `dev.db`— en vez de asumirlo.

## Alcance

**Cubre:** la migración, el mapeo del error y los tests de arriba.
**No cubre:** limpiar duplicados existentes (no hizo falta, el Paso 0 dio cero); cubrir `stageId` NULL;
ningún cambio en el contrato ni en el front.

## Orden

1. ~~Paso 0 (la consulta), con el dueño.~~ Cerrado 2026-09-20, cero filas.
2. ~~`SPEC-218` cerrada y en `main`.~~ Cerrado 2026-09-20 (`a4d9689`).
3. ~~Un commit propio, separado del de `SPEC-218`.~~ `pnpm verify:all` en verde (72 archivos, 528 tests
   de la API) y el migrador compilado probado dos veces contra copias reales de la base —`dev.db` y un
   export de producción (`turso db export propnexus`)— antes de este commit.
