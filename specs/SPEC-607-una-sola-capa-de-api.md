# SPEC-607 — Una sola capa de API: el contrato en `shared`, los guards como dato del procedimiento

> **Fase 2, paso A2** ([`SPEC-611`](SPEC-611-la-migracion-fase-2.md)); el estado, en
> [`specs/README.md`](README.md). Nivel 🟡: auth, guards y la forma de todas las rutas. La decisión
> que pedía —reemplazar la invariante 3 de
> [`SPEC-212`](archive/SPEC-212-contrato-en-la-firma-de-la-ruta.md)— es **D-102**. Escrita en la serie
> `6xx` ([`PROPUESTA-2026-09-30-refactor-post-m3.md`](PROPUESTA-2026-09-30-refactor-post-m3.md)).

## En la Fase 2

Esta spec se escribió para hacerse sola, vertical por vertical. En la Fase 2 se reparte así:

| Parte | Paso |
|---|---|
| **El Paso 0** (el orden guard → validación fijado con un test) y **la infraestructura**: el router oRPC raíz montado en `/api/v1` **antes** de las rutas de Express, que siguen atendiendo lo que el router no conoce (`next()`); el middleware que lee la `meta`; `route-guards.test.ts` leyendo de las dos fuentes | **A2** |
| **La cadena de middlewares de la auditoría §2.2**: `authenticate` → rol → `loadProject`, que deja la entidad y su proyecto en el contexto para que el handler no la vuelva a leer (reusa las funciones de `SPEC-610`) | **A2** |
| **El contexto como inyección de dependencias**: `{ db, anchor, storage, clock, config }`, para que un test llame `call(proc, input, { context })` sin supertest ni `vi.mock` | **A2** |
| **Mover cada vertical**: su contrato a `packages/shared/src/contract/`, su guard a la `meta`, y borrar sus rutas de Express. El piloto ya no es `notary` solo, es `dossier` (notary + investor + público) | **A3** ([`SPEC-615`](SPEC-615-el-piloto-dossier.md)) y **A4** ([`SPEC-616`](SPEC-616-el-resto-modulo-por-modulo.md)) |
| Borrar `MONTAJE`, `GUARD`, `authorize` de Express, `delegarAOrpc` y `route-inventory` | **A5** ([`SPEC-617`](SPEC-617-una-sola-forma.md)) |

**A2 termina con el router raíz montado y vacío de rutas propias, salvo un procedimiento de prueba
del Paso 0 que no se publica**: ninguna ruta cambia de dueño en A2, y el OpenAPI no se mueve.

## Por qué reabrirla

**La invariante 3 era una regla de migración, no de diseño.** `SPEC-212` movió 45 rutas a oRPC y
decidió, con razón, no cambiar la semántica de seguridad a mitad de un refactor. `authorize` quedó
delante, en Express, y oRPC nunca ve una request que `authorize` habría rechazado. La migración
terminó (`SPEC-216`), y lo que quedó es una forma que nadie eligió como destino:

| Hoy (medido el 2026-09-30) | Costo |
|---|---|
| **Dos declaraciones por ruta.** `router.metodo(path, authenticate, authorize(...), delegarAOrpc(handler, PREFIJO))` en Express, y `.route({ method, path })` en oRPC. **El path se escribe dos veces** | 90 `router.*` + 90 `delegarAOrpc` + un `new OpenAPIHandler` por procedimiento |
| **Los routers que comparten prefijo tienen que declarar los mismos guards de router** (`route-guards.test.ts`, "los routers que comparten prefijo") | Es el costo que hace caro partir archivos ([`SPEC-015`](archive/SPEC-015-saneamiento-de-la-instrumentacion.md) §6) |
| **El schema vive en la API**, no en `shared`: el cliente no lo puede derivar | Es la mitad de D-066 que no se cumplió. D-066 dice que del contrato *"se derivan **los handlers y el cliente**"* ([`SPEC-609`](SPEC-609-el-cliente-sale-del-contrato.md)) |

## Qué se probó antes de escribir esto (2026-09-30, oRPC 1.15.2, con código descartable)

1. **Un guard declarado como `meta` del contrato** (`oc.$meta<{ guard }>().meta({ guard })`) y
   aplicado por **un solo middleware oRPC** que lo lee de `procedure['~orpc'].meta`: el rol permitido
   recibe 200 y el otro 403. ✅
2. **La matriz se puede leer desde el router ya armado.** `router.x.y['~orpc']` expone `route.method`,
   `route.path` y `meta`. `route-guards.test.ts` puede reconstruir la misma matriz sin Express. ✅
3. **El mismo router sirve REST** (`OpenAPIHandler`, paths de M2-D5, se puede consultar con `curl`
   como pide D-066). ✅

## Alcance

1. **El contrato se muda a `packages/shared/src/contract/`**: `route`, `input`, `output`, `errors`
   y `meta.guard` de cada procedimiento. Es la cabecera que hoy vive en `apps/api/src/routes/*`. La API
   la implementa con `implement(contract)`. Los handlers no cambian de cuerpo.
2. **`meta.guard` es obligatorio.** Tiene la misma forma que `authorize({ roles, acceso })` (D-088),
   con `sinSesion: true` explícito para las dos rutas públicas (`SIN_SESION`). El `$meta` se tipa
   para que **un procedimiento sin guard no compile**: la versión de D-042, pero en el contrato.
3. **Un middleware global** (`apps/api/src/middlewares/guard-orpc.ts`) hace lo que hoy hacen
   `authenticate` + `authorize`, **reusando sus evaluadores** (`evaluarProyecto`, `projectScope`,
   `proyectoDeLaEntidad`). La regla no se escribe dos veces: se adapta la entrada (de `req.params` /
   `req.body` al `input` del procedimiento). La distinción `en: "path" | "body"` desaparece, porque
   para oRPC los dos son `input`.
4. **Un solo `OpenAPIHandler` para todo `/api/v1`**, montado una vez en Express. Se borran
   `MONTAJE` con sus 18 entradas, los 90 `router.*`, los 90 `delegarAOrpc` y `delegarAOrpc` mismo.
5. **Express se queda, como carcasa de transporte** (D-054 y D-066 no se tocan): helmet, CORS,
   `/health`, los dos rate limiters (montados en sus paths, delante del handler), Sentry, el 404 JSON
   y `errorHandler`. **Reemplazar Express no entra**: lo que haría otro framework, esto ya lo logra.
6. **La única ruta que sigue siendo Express es la subida multipart**
   (`POST /developer/projects/:id/stages/:stageId/evidence`). [`SPEC-218`](archive/SPEC-218-subida-de-evidencia-por-lote.md)
   la dejó con Multer a disco para no pasar el archivo por RAM. Declara su guard con `authorize`, y
   `route-guards.test.ts` la lee de Express. Es **una excepción con nombre**, no una segunda forma.

## Invariantes

1. **La tabla `MATRIZ` de `route-guards.test.ts` no cambia ni un carácter.** El test cambia de
   dónde lee (del árbol oRPC más la excepción Express), no qué espera. Es la prueba de que la
   migración no movió ningún permiso.
2. **La autorización corre antes de validar el input.** Una request sin sesión recibe **401 aunque
   el body sea inválido**, y un rol sin permiso recibe **403 antes que un 400**: hoy es así, y un 400
   de Zod le describiría el schema a quien no tiene acceso. oRPC tiene un orden configurable entre
   middlewares y validación de input: el **Paso 0** es medirlo y fijarlo con un test, antes de mover
   ninguna ruta.
3. **Los mismos códigos y mensajes de hoy**: el 404 `"Stage not found"` del guard, el 400
   `Missing or invalid "evidenceId"`, el 500 de ruta mal declarada. `error-handling.test.ts` y los
   tests de rutas no cambian de expectativa.
4. **`GUARD` sigue siendo lo que se lee, no lo que se infiere**: la matriz sale de la `meta`
   declarada, no de adivinar qué middleware corre.
5. **El OpenAPI publicado no cambia** (`openapi-freshness`, más allá del orden de claves). Se genera
   desde el contrato, sin la introspección de Express que hoy necesita `generate-openapi.ts`.

## Paso 0 (antes de migrar nada)

- Medir y fijar con un test el invariante 2 (orden guard → validación) con un procedimiento de prueba.
- Migrar **una vertical piloto** (`notary`, 6 rutas: la misma que sugería `SPEC-111`) de punta a
  punta: contrato en `shared`, guard en `meta`, handler único, test de matriz leyendo del árbol oRPC
  para esas 6 y de Express para el resto. Si el piloto obliga a cambiar la `MATRIZ`, se frena y se
  revisa el diseño.

## A2, hecho el 2026-10-07

En la rama `worktree-fase2-a0-a2`, sin mergear. Ninguna ruta cambió de dueño y el OpenAPI no se movió.

| Pieza | Dónde |
|---|---|
| El router raíz, vacío, montado en `/api/v1` antes que Express con un solo `OpenAPIHandler` | `apps/api/src/platform/router.ts` (`routerRaiz`, `montarRouter`) |
| `procedimiento(guard)`: el único punto de entrada para un procedimiento nuevo; sin guard no compila | `apps/api/src/platform/procedimiento.ts` |
| `guardOrpc`: lee `meta.guard` y corre antes de validar el input; deja `usuario` y `proyectoId` en el contexto | `apps/api/src/middlewares/guard-orpc.ts` |
| El contexto inyectable `{ db, anchor, storage, clock, config }` | `apps/api/src/platform/contexto.ts` |
| La regla, escrita una vez: los evaluadores leen los params por `LectorDeParam` (de `req` en Express, del `input` en oRPC) y `autorizar()` resuelve token → usuario para los dos | `apps/api/src/middlewares/auth.ts` |
| La matriz lee de las dos fuentes (`rutasConGuards`), y una ruta con dos dueños es un error | `apps/api/src/lib/route-inventory.ts` |

**Paso 0** (`test/guard-orpc.test.ts`, un router de prueba que no se publica): sin sesión es 401 aunque el
body sea inválido, un rol o una membresía sin permiso es 403 antes que el 400, y recién con permiso
aparece el 400 del schema. Probado en rojo: con `initialInputValidationIndex` antes del guard, los 6
casos de orden fallan. Los mensajes son los de Express (`Missing or invalid token`, `Forbidden`,
`Stage not found`, `Missing or invalid "stageId"`); el cuerpo es el de oRPC, que suma `code` y `status`.
Por eso `ERROR_CODES` suma `FORBIDDEN` e `INTERNAL_SERVER_ERROR` (35 códigos).

**Lo que se movió, medido** con el arnés de SPEC-612 contra `main`: las 653 respuestas son idénticas y
Sentry ve lo mismo; OpenTelemetry suma **un span de middleware por request** (`routerOrpc`, +651 en
`express`, `router` y `@sentry/node`), el del router raíz que atiende antes que Express. `MATRIZ` sin un
carácter de diferencia, la API en 100/100/100/100 (901 tests) y el e2e 100/100.

**Lo que queda para A3:** el contrato en `packages/shared/src/contract/` (necesita `@orpc/contract` en
un paquete CommonJS, el mismo problema que A0.1 resolvió en la API) y la entidad completa en el
contexto, no solo su proyecto.

## Tamaño

Grande, pero mecánico después del piloto. Va por vertical, igual que `SPEC-212`, y cada vertical
deja `verify:all` en verde. Puede convivir con la forma vieja mientras dura: el test de la matriz
lee las dos.
