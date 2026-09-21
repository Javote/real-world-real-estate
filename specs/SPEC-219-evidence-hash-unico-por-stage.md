# SPEC-219 — `UNIQUE (stageId, sha256Hash)` en `Evidence`: la restricción detrás de la regla

> **Origen:** [`SPEC-218`](SPEC-218-subida-de-evidencia-por-lote.md) §El archivo repetido, que hace cumplir
> *"un stage no tiene dos evidencias con el mismo SHA-256"* **en la aplicación** y deja anotado el hueco
> que esto cierra. Nivel 🟡: migración con Turso vivo (D-063). Desarrollada 2026-09-20.
> Estado: **postergada** — no por mainnet: por una **medición que hay que hacer primero** y que no se
> puede hacer desde acá (ver §Paso 0). Depende de `SPEC-218` (va después).

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
2. **`errorHandler.ts` (`CONSTRAINT_ERRORS`):** entrada para este índice → `409`, código
   `EVIDENCE_ALREADY_IN_STAGE`, el mismo que `SPEC-218` ya devuelve por archivo.
3. **El handler de `SPEC-218` no cambia su lógica:** el chequeo previo se queda, porque es el que da
   rechazos **por archivo** y sin abortar el lote. El índice es la red de seguridad: si aun así el
   `INSERT` lo viola (la carrera), la transacción se revierte y el pedido falla entero con `409`, con la
   limpieza de lo ya guardado que ese handler ya hace ante una falla de infraestructura.

## Lo que hay que tener presente

- **`stageId` NULL queda fuera.** En SQLite un `UNIQUE` trata los NULL como distintos: los documentos a
  nivel proyecto (`POST /developer/documents`, sin stage) no quedan cubiertos. Es consistente con la
  regla ("un **stage** no tiene…"), pero se escribe para que nadie crea que el índice cubre todo.
- **`SPEC-210` (borrar evidencia anclada)** libera el hash: hay que verificar qué pasa si se vuelve a subir
  un archivo borrado (¿se permite? ¿debería?) antes de dar la regla por cerrada. No se revisó.
- **Los tests que repiten contenido en un mismo stage** ya cambian por `SPEC-218`; este índice no suma
  reescrituras, suma **un test**: uno que fuerza la carrera saltándose el chequeo previo (inserta directo
  dos filas con el mismo par) para probar que la restricción muerde.
- **`test.template.db`** se regenera desde las migraciones: confirmar que `global-setup` lo recrea y no
  queda una plantilla vieja sin el índice.

## Casos borde (definen los tests)

- Dos `INSERT` directos con el mismo `(stageId, sha256Hash)` → el segundo falla con
  `SQLITE_CONSTRAINT_UNIQUE` y `CONSTRAINT_ERRORS` lo traduce a `409 EVIDENCE_ALREADY_IN_STAGE`.
- Mismo hash en **dos stages** distintos → se acepta.
- Dos filas con `stageId` NULL y el mismo hash → se aceptan (documenta el límite de arriba).
- La carrera real: dos pedidos concurrentes con el mismo archivo → uno `201`, el otro `409`, **una** sola
  fila y **cero** objetos huérfanos en el storage.
- La migración es idempotente: correrla dos veces no falla.

## Alcance

**Cubre:** la migración, el mapeo del error y los tests de arriba.
**No cubre:** limpiar duplicados existentes (si los hay, es la decisión del Paso 0); cubrir `stageId`
NULL; ningún cambio en el contrato ni en el front.

## Orden

1. Paso 0 (la consulta), con el dueño.
2. `SPEC-218` cerrada y en `main`.
3. Un commit propio, separado del de `SPEC-218`: este es el que no se deshace con un `git revert` una vez
   aplicado en Turso. Antes de pushear, `pnpm verify:all` y probar `node apps/api/dist/src/db/migrate.js`
   contra una copia de la base.
