# SPEC-613 — A1: los cimientos que usan todos los módulos

> Fase 2, paso A1 ([`SPEC-611`](SPEC-611-la-migracion-fase-2.md)); el estado, en
> [`specs/README.md`](README.md). Nivel 🟡: toca el audit, las notificaciones y el anclaje. **Sin
> cambio de comportamiento hacia afuera**: A1 construye las piezas; las usan los módulos de A3/A4.

## Lo que hay hoy, medido el 2026-10-02

| Qué | Hoy |
|---|---|
| **Errores** | 58 `new ORPCError(...)` sueltos contra 20 `.errors(...)` declarados. Tres formas llegan al cliente: `{message}` (Express), `{code,status,message,defined}` (oRPC) y `TransitionFailure` (`domain/stage-transition.ts`). En `shared` no hay `ErrorCode` |
| **IDs** | Todos `string`: `unitId` y `stageId` se pueden cruzar sin que `tsc` se queje |
| **Resultado de una regla** | Cada dominio arma el suyo (`TransitionResult`, `RetryMintResult`) |
| **Audit** | `writeAuditLog` (31 llamadas) escribe en un viaje aparte, después de la mutación; `insertAuditLog` (3) va adentro de un `enLote` (`SPEC-610`). Las dos usan el `db` global |
| **Notificaciones** | `notify` usa el `db` global y **se traga el error**: una notificación que falla no frena la mutación |
| **Anclaje con reclamo** | Dos formas escritas a mano: `anclarEvidenciaUnaVez` (`domain/anchoring.ts`, INSERT condicional) y el `UPDATE … WHERE status = 'compiled'` de la firma del dossier (`notary.routes.ts`) |
| **Enums en la base** | Ningún enum tiene `CHECK`, y nada compara el SQL con `db/types.ts`, que está escrito a mano |

## Alcance

1. **`packages/shared/src/errors.ts`: `ErrorCode`**, la unión de los códigos que hoy existen (los de
   los 20 `.errors()`, los `code` de `TransitionFailure` y los de `ORPCError` con nombre), cada uno con
   su status HTTP y su clave de traducción. **Ningún código nuevo**: es el inventario.
2. **IDs con marca en `shared`**: `ProjectId`, `StageId`, `UnitId`, `DossierId`, `EvidenceId`,
   `UserId`, … como `z.string().brand<…>()`. La marca es solo de tipo: el JSON Schema y el OpenAPI no
   cambian. Se adoptan en los schemas de `shared` que ya existen; los routers viejos los reciben como
   `string` sin cambio.
3. **`Result<T, E extends ErrorCode>`** en `shared`, con `ok()` y `err()`. Es lo que devuelven los
   casos de uso (auditoría §2.3).
4. **`apps/api/src/platform/`**, al lado de `config.ts` (A0):
   - `audit(ejecutor, entrada)`: la entrada de audit contra un ejecutor (`db`, una transacción o un
     lote). Reemplaza a `writeAuditLog`/`insertAuditLog` **en los módulos nuevos**; las 34 llamadas
     viejas se van con su módulo en A4.
   - `notify(ejecutor, entrada)`: lo mismo para `Notification`. **Decisión que pide** (abajo).
   - `anclarConReclamo(...)`: la forma única de *"reclamo en la transacción, anclo después del
     commit, sin esperar el bloque"*, con el test de concurrencia de la Fase 1 (ítem 1) corriendo
     contra ella. `anclarEvidenciaUnaVez` y la firma del dossier pasan a usarla en A3/A4, no acá.
5. **El esquema contra los tipos**: un test que compara `PRAGMA table_info` de cada tabla (sobre la
   base que arma `test/global-setup.ts` con las migraciones reales) contra `db/types.ts`. Primero el
   test; **los `CHECK` en los enums, solo si hacen falta después**. SQLite no agrega un `CHECK` a una
   tabla existente sin reconstruirla, y con Turso vivo eso no es una migración aditiva (D-063). La
   alternativa aditiva es un trigger `BEFORE INSERT/UPDATE` por columna; antes se mide producción
   (cero filas fuera de dominio), como se hizo en `SPEC-402`.

## Decisión que pide

**¿Una notificación que falla tiene que frenar la mutación?** Hoy no: `notify` se traga el error.
Si `notify(trx)` entra en la misma transacción, una notificación que falla deshace la mutación. Las
dos opciones son defendibles: atómico (no hay mutación sin su aviso) o *best effort* (la mutación es
lo que importa, el aviso se pierde y queda en el log). **Hasta que el dueño decida, `notify(trx)`
conserva el comportamiento de hoy**: corre después del commit y no tira.

## Invariantes

1. **Ni una respuesta cambia**, ni el OpenAPI (`openapi-freshness`): la marca de los IDs es solo
   de tipo y A1 no declara errores nuevos en ningún procedimiento.
2. **`ErrorCode` es inventario, no diseño**: cada código existe hoy en el código o en un test.
3. **El test de concurrencia de reclamar antes de anclar** (`test/reclamar-antes-de-anclar.test.ts`)
   sigue pasando sin cambios.

## La evidencia de M3

A1 no cambia el OpenAPI, pero **A3 sí**: declarar los errores en el contrato los hace aparecer en el
documento. `openapi-freshness` obliga a regenerar `specs/evidencia-m3/2-api/` (y su versión en
inglés y el PDF) en el mismo commit, y entonces el repo deja de tener el documento que se entregó.
**Antes de A3 el dueño decide** si la evidencia se congela (una copia fechada en
`specs/evidencia-m3/` y el test pasa a comparar contra un archivo vivo aparte) o se sigue
regenerando.

## Verificación

`pnpm verify:all`, `pnpm e2e` completo y el test nuevo del esquema contra los tipos, que se prueba en
rojo con una mutación (una columna de más en `types.ts`).
