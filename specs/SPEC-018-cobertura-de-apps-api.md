# SPEC-018 — Cobertura de `apps/api`: branches ≥95%, el resto ≥98%

> Nace el 2026-09-22 de partir [`SPEC-017`](SPEC-017-cobertura-95-en-toda-la-app.md), que quedó
> demasiado grande para leerla antes de cada tanda. SPEC-017 cerró con la API en **96,26% de
> líneas** (el criterio 2 del SOM, cumplido); esta spec persigue la vara más estricta que el dueño
> pidió después: **branches ≥95%, y statements, functions y lines ≥98%**. El historial de cómo se
> llegó hasta acá (tandas 1-3, los scripts de arranque, las rutas ya agotadas) vive en SPEC-017 y no
> se repite.
>
> Nivel 🟢 (tests). El paso 0 tocó código de producción de las 17 rutas (🟡). Su gemela para el
> front es [`SPEC-019`](SPEC-019-cobertura-de-apps-web.md).

## Dónde está hoy

Medido el 2026-09-22, con el paso 0 ya aplicado (`vitest run --coverage`, 630 tests):

| Métrica | Antes del paso 0 | Hoy | Vara | Falta |
|---|---|---|---|---|
| Statements | 91,65% (2.176/2.374) | **96,43%** (2.003/2.077) | ≥98% | 33 |
| Branches | 81,81% (918/1.122) | **91,33%** (791/866) | ≥95% | 32 |
| Functions | 96,89% (499/515) | **96,94%** (413/426) | ≥98% | 5 |
| Lines | 97,45% (2.030/2.083) | **97,68%** (1.855/1.899) | ≥98% | 6 |

**Las 75 ramas que quedan sin cubrir son todas trabajo de los lotes**: ya no hay ningún `matched` ni
ninguna rama documentada como inalcanzable sin su marca. Para el 95% de branches alcanza con cerrar
32 de las 75.

## El hallazgo que motivó el paso 0

Antes del paso 0, las **204 branches sin cubrir** se separaban en tres grupos:

| Grupo | Branches | Qué eran |
|---|---|---|
| `if (!matched) next()` | 89 | El mismo wrapper de 3 líneas copiado en cada ruta montada sobre oRPC (17 archivos). `matched` es siempre `true`: Express ya matcheó el mismo path antes de delegar. Cada copia dejaba también 1 statement sin cubrir |
| Documentadas inalcanzables | 40 | 404 que `authorize()` ya resolvió en el middleware (`evaluarProyecto`/`evaluarDueño`), `??` sobre `COUNT(*)` o columnas `NOT NULL`, FK que impiden la fila huérfana, y los dos guardias `require.main === module` |
| Candidatas | 75 | Trabajo real |

Con el código así, el techo de branches era **~88%**: el 95% no existía sin cambiar el denominador.

## Paso 0 — cerrado 2026-09-22 (opciones 1 y 2, decisión del dueño)

**Opción 1 — `delegarAOrpc` (`lib/orpc.ts`).** Las 89 copias pasaron a una línea:
`delegarAOrpc(handler, PREFIJO_ABSOLUTO)` (31 rutas) o `delegarAOrpc(handler, PREFIJO_ABSOLUTO,
conUsuario)` (58). La rama `if (!matched) next()` existe una vez y la prueba `test/lib-orpc.test.ts`
con un handler falso.

- **El chequeo de tipos que hacía cada call site se conservó, y se verificó en negativo.** La
  primera versión usaba dos overloads y **no lo conservaba**: `OpenAPIHandler<{ user }>` es asignable
  a `OpenAPIHandler<{}>`, así que sacarle `conUsuario` a una ruta que lo necesita compilaba igual.
  La versión final usa la técnica de `MaybeOptionalOptions` de oRPC (el tercer argumento es
  obligatorio si y solo si el contexto del handler tiene claves requeridas). Sacarle `conUsuario` a
  `stages.routes.ts` da `TS2554: Expected 3 arguments, but got 2`.
- **Sin cambio de comportamiento:** oRPC resuelve un `context` ausente como `{}`
  (`options.context ?? {}`, leído en `@orpc/server`), que es lo que el helper pasa explícito.

**Opción 2 — las 40 documentadas, marcadas en la línea exacta**, cada una con su motivo:
`/* v8 ignore if -- @preserve: <motivo> (SPEC-018) */` antes de un `if`, y `/* v8 ignore start …
*/ … /* v8 ignore stop */` alrededor de una expresión con `??` o `? :` (`ignore next` antes del
operando no funciona con el v8 de Vitest 4: se probó). El `-- @preserve` es obligatorio: sin él,
esbuild borra el comentario antes de que v8 lo vea. Grep `v8 ignore` en `apps/api/src` las lista.

**Dos correcciones a lo que decía esta spec antes de aplicarlo**, leyendo el código línea por línea:
`evidence.routes.ts` tenía **5** 404 documentados (los cinco que SPEC-017 nombraba), no 3; y el
"`?? 0` de `_shared.ts`" documentado era en realidad `investor.routes.ts:214`. Las tres ramas de
`_shared.ts` sí se pueden alcanzar (un proyecto sin stages, una lista vacía, un error de FK) y
quedan para A5.

**Resultado:** branches 81,81% → 91,33%, statements 91,65% → 96,43%. Umbrales de
`vitest.config.mts` subidos a 96/91/96/97 (statements/branches/functions/lines).

## Los lotes — archivo por archivo

Solo los archivos que no están al 100% en las cuatro métricas. **Sin cubrir** = branches sin
cubrir, todas candidatas.

| Archivo | Statements | Branches | Functions | Lines | Sin cubrir | Lote |
|---|---|---|---|---|---|---|
| `routes/developer-comercial.routes.ts` | 92,2% (106/115) | 77,1% (37/48) | 95,5% (21/22) | 94,1% (96/102) | 11 | A1 |
| `routes/developer-evidencia.routes.ts` | 94,2% (113/120) | 87,0% (47/54) | 94,7% (18/19) | 97,1% (102/105) | 7 | A2 |
| `routes/evidence.routes.ts` | 98,0% (98/100) | 100,0% (28/28) | 91,7% (11/12) | 97,9% (95/97) | 0 | A2 |
| `routes/capital.routes.ts` | 89,7% (78/87) | 81,3% (13/16) | 84,6% (22/26) | 92,0% (69/75) | 3 | A3 |
| `middlewares/auth.ts` | 95,8% (114/119) | 92,6% (88/95) | 100,0% (25/25) | 98,1% (102/104) | 7 | A4 |
| `middlewares/errorHandler.ts` | 83,3% (20/24) | 90,0% (18/20) | 100,0% (3/3) | 81,0% (17/21) | 2 | A4 |
| `middlewares/rateLimit.ts` | 100,0% (11/11) | 96,0% (24/25) | 100,0% (5/5) | 100,0% (11/11) | 1 | A4 |
| `routes/auth.routes.ts` | 95,5% (21/22) | 87,5% (7/8) | 100,0% (2/2) | 95,5% (21/22) | 1 | A4 |
| `routes/users.routes.ts` | 98,0% (50/51) | 100,0% (10/10) | 87,5% (7/8) | 97,8% (45/46) | 0 | A4 |
| `domain/reconcile.ts` | 87,3% (48/55) | 82,9% (29/35) | 100,0% (6/6) | 93,0% (40/43) | 6 | A5 |
| `domain/stage-transition.ts` | 96,3% (78/81) | 90,6% (58/64) | 100,0% (14/14) | 100,0% (74/74) | 6 | A5 |
| `domain/notify.ts` | 76,9% (10/13) | 75,0% (9/12) | 100,0% (4/4) | 81,8% (9/11) | 3 | A5 |
| `routes/_shared.ts` | 90,0% (18/20) | 70,0% (7/10) | 100,0% (6/6) | 94,1% (16/17) | 3 | A5 |
| `routes/stages.routes.ts` | 93,0% (40/43) | 86,4% (19/22) | 100,0% (3/3) | 97,6% (40/41) | 3 | A5 |
| `domain/dossier.ts` | 93,9% (31/33) | 90,9% (20/22) | 100,0% (11/11) | 96,7% (29/30) | 2 | A5 |
| `domain/project-aggregates.ts` | 95,5% (21/22) | 87,5% (14/16) | 100,0% (9/9) | 100,0% (14/14) | 2 | A5 |
| `routes/audit.routes.ts` | 100,0% (32/32) | 91,7% (11/12) | 100,0% (4/4) | 100,0% (29/29) | 1 | A5 |
| `routes/notary.routes.ts` | 98,8% (79/80) | 95,2% (20/21) | 92,3% (12/13) | 98,7% (74/75) | 1 | A5 |
| `domain/anchoring.ts` | 94,1% (16/17) | 100,0% (10/10) | 100,0% (2/2) | 94,1% (16/17) | 0 | A5 |
| `routes/projects.routes.ts` | 99,4% (157/158) | 100,0% (47/47) | 97,2% (35/36) | 99,3% (145/146) | 0 | A5 |
| `db/migrate.ts` | 97,5% (39/40) | 73,3% (11/15) | 100,0% (11/11) | 97,3% (36/37) | 4 | A6 |
| `lib/anchor.ts` | 96,8% (30/31) | 85,0% (17/20) | 100,0% (12/12) | 96,8% (30/31) | 3 | A6 |
| `lib/storage.ts` | 98,1% (53/54) | 87,0% (20/23) | 100,0% (18/18) | 100,0% (48/48) | 3 | A6 |
| `lib/route-inventory.ts` | 100,0% (55/55) | 95,0% (38/40) | 100,0% (12/12) | 100,0% (48/48) | 2 | A6 |
| `instrumentation.ts` | 96,0% (24/25) | 87,5% (7/8) | 80,0% (4/5) | 100,0% (24/24) | 1 | A6 |
| `db/fixtures.ts` | 97,1% (34/35) | 94,4% (17/18) | 100,0% (14/14) | 100,0% (34/34) | 1 | A6 |
| `db/local-db.ts` | 87,5% (7/8) | 75,0% (3/4) | 100,0% (1/1) | 100,0% (6/6) | 1 | A6 |
| `utils/audit.ts` | 100,0% (1/1) | 75,0% (3/4) | 100,0% (1/1) | 100,0% (1/1) | 1 | A6 |
| `app.ts` | 81,3% (26/32) | 100,0% (8/8) | 60,0% (3/5) | 80,6% (25/31) | 0 | A6 |

Por lote:

| Lote | Archivos | Branches | Statements | Functions | Notas |
|---|---|---|---|---|---|
| **A1** | `developer-comercial.routes.ts` | 11 | 9 | 1 | Dos ramas de bajo valor ya documentadas en SPEC-017 (el desempate de `contractsOfProjectProcedure` y un `catch` defensivo). **Ojo:** dos `if (!x) throw NOT_FOUND` (líneas ~167 y ~472) tienen la forma de los que `authorize` ya resuelve: leer su `authorize` antes de escribir un test |
| **A2** | `developer-evidencia.routes.ts`, `evidence.routes.ts` | 7 | 9 | 2 | `evidence.routes.ts` ya está en 100% de branches; le falta una función |
| **A3** | `capital.routes.ts` | 3 | 9 | **4** | Los callbacks (`.reduce`/`.sort`) que nunca corrieron porque ningún test armó un proyecto con contratos **y** liberaciones reales |
| **A4** | `middlewares/auth.ts`, `errorHandler.ts`, `rateLimit.ts`, `auth.routes.ts`, `users.routes.ts` | 11 | 11 | 1 | `auth.ts` es 🟡 (permisos): los tests no cambian nada, pero conviene leer `evaluarProyecto`/`evaluarDueño` enteros antes |
| **A5** | `domain/*`, `stages.routes.ts`, `audit.routes.ts`, `_shared.ts`, `notary.routes.ts`, `projects.routes.ts` | 27 | 24 | 2 | El lote más mecánico. `stages.routes.ts` tiene dos `if (!stage) throw NOT_FOUND`: misma advertencia que A1. `notary.routes.ts:289` (`anterior ?? undefined`) no estaba documentada |
| **A6** | `lib/*`, `db/*`, `instrumentation.ts`, `utils/audit.ts`, `app.ts` | 16 | 12 | 3 | `app.ts`: `GET /health` (con su `try/catch` contra la base) y el 404 del final — dos tests y el archivo queda en 100% |

**Los archivos que no aparecen ya están al 100%** en las cuatro, o en su techo con todo lo
inalcanzable marcado: `investor`, `developer`, `certifier`, `contracts`, `public`, `profile`,
`notifications`, `projects-obra` y `db/seed.ts`.

**`projects.routes.ts` y `projects-obra.routes.ts` se cerraron en el commit que abrió esta spec**:
se terminaron los tests que la sesión anterior dejó a medio hacer y se sumó uno para
`projects-obra.routes.ts:161`, que sí se podía alcanzar. `authorize` valida el proyecto de la URL,
no que el stage le pertenezca, así que un stage real pedido bajo otro proyecto sí llega al handler
(`stage-transitions.test.ts`, *"404 si el stage existe pero es de otro proyecto — sin mint"*).

## Análisis rama por rama — 2026-09-22, antes de escribir un solo test

Las 75 branches y las 13 funciones sin cubrir, leídas una por una contra el código, el esquema y
`authorize`. **Cada lote arranca de acá: la receta ya está, y lo que no se alcanza ya está
justificado.** Dos cosas se verificaron corriendo código, no leyéndolo: los dos bugs de abajo, con
un test descartable contra la API real.

Leyenda: **HTTP** = test por supertest · **unit** = llamar la función o el middleware directo, con
`req`/`res` falsos o el entorno pisado · **mock** = hace falta `vi.mock`/`vi.spyOn` para forzar la
condición · **❌** = no se alcanza: marcar con `/* v8 ignore … -- @preserve: <motivo> */` ·
**🐞** = bug: se arregla y el test lo fija.

### 🐞 Dos bugs: un id inexistente da 500 en vez de 404

`PATCH /users/:id` y `PATCH /projects/:id` con un id que no existe responden **500**, y el
interceptor de `lib/orpc.ts` lo reporta a Sentry como error no clasificado. Las dos rutas son
`authorize({ acceso: "soloRol" })`: nada carga la fila antes del handler. El handler hace
`updateTable(...).executeTakeFirstOrThrow()`, Kysely tira `NoResultError`, y el `.catch` →
`relanzarRestriccionComoOrpc` lo relanza tal cual porque no es una restricción. `GET /users/:id`
sí contesta 404 (tiene su `if`), así que es un olvido, no una decisión.

Se probaron las 13 rutas `soloRol` con un id en el path, con un id inexistente. Estas dos son las
únicas con 500. Tres respuestas más que **no son bugs pero conviene decidir**: `DELETE /users/:id` y
`DELETE /projects/:id` dan 204 aunque no exista nada (idempotente, defendible), y
`POST /projects/:id/members` sobre un proyecto inexistente da 400 `RELATED_RESOURCE_NOT_FOUND` (la FK
contesta antes que un 404).

**Arreglo:** `executeTakeFirst()` + `if (!fila) throw new ORPCError("NOT_FOUND", …)`, como hace
`GET /users/:id`. Cierra `users.routes.ts:179` (función) y el equivalente de `projects.routes.ts`.
Van en A4 y A5.

### 🐞 Otro, chico, del front (va en SPEC-019)

El `TONO` de `investor.units.tsx` no tiene `delivered`, así que una unidad entregada se muestra en
tono neutro. En las pantallas del developer, esa misma unidad sale `verified`.

### A1 — `developer-comercial.routes.ts` (11 branches, 1 función)

| Línea | Rama | Veredicto | Receta o motivo |
|---|---|---|---|
| 167 | `if (!unidad) throw NOT_FOUND` | ❌ | `authorize({ proyecto: { via: "Unit" } })` en `PATCH /units/:id` ya cargó la unidad |
| 382 | `unitIds.length ? … : []` | HTTP | `GET /projects/:id/contracts` de un proyecto sin contratos |
| 403 | `if (mejor === null)`, lado falso | HTTP | **Se alcanza por el flujo real**, no solo con inserts a mano como decía SPEC-017: vender la unidad, `PATCH /units/:id` a `available`, re-invitar al mismo investor y aceptar. Quedan dos invitaciones aceptadas, y dos candidatos por contrato |
| 404 | `if (firmado === null)`, lado verdadero | ❌ | el accept escribe `Contract.signedAt` con el mismo `ahora` que el resto: nunca es `null` |
| 404 | `if (firmado === null)`, lado falso | HTTP | el mismo flujo de la 403 |
| 405 | función `distancia` | HTTP | el mismo flujo |
| 407 | `respondido === null ? ∞ : …`, lado `∞` | ❌ | una invitación `accepted` siempre tiene `respondedAt` (el accept lo escribe) |
| 407 | lado `Math.abs(…)` | HTTP | el mismo flujo |
| 409 | `distancia(a) < distancia(mejor)`, los dos lados | HTTP | el mismo flujo, con los `respondedAt` a distinta distancia del `signedAt`. En el flujo real son el mismo instante, así que uno de los dos lados puede necesitar un `UPDATE` de `respondedAt` en el test |
| 472 | `if (!contrato) throw NOT_FOUND` | ❌ | `authorize({ proyecto: { via: "Contract" } })` en `POST /contracts/:id/releases/:stageNum` ya lo cargó |
| 547 | `catch`: error que no es `ReleaseExceedsContractError` | mock | `vi.spyOn(db, "transaction")` que rechace con un `Error` cualquiera → 500. Prueba que el `catch` no se traga errores ajenos |

**A1: 7 alcanzables (más la función), 4 ❌.**

### A2 — `developer-evidencia.routes.ts`, `evidence.routes.ts` (7 branches, 2 funciones)

| Línea | Rama | Veredicto | Receta o motivo |
|---|---|---|---|
| dev-evid 180 | `if (req.readableEnded) return responder()` | unit | llamar `rechazarStageAntesDeRecibir` con una `req` falsa `{ readableEnded: true }` y un stage `Completed` |
| dev-evid 185 | `if (leidos > TOPE_DE_DRENAJE) req.destroy()` | HTTP | subir a un stage `Completed` un cuerpo más grande que `TOPE_DE_DRENAJE` |
| dev-evid 230 | `req.files ?? []` | HTTP | mandar el `POST` como JSON y no como multipart: Multer no toca `req.files` |
| dev-evid 254 | `catch` de `call(validarCamposDeTexto)` que no es `ORPCError` | ❌ | un procedure de solo validación solo tira `ORPCError` (`BAD_REQUEST`) |
| dev-evid 260 | el stage se cerró mientras subían los bytes | mock | el segundo `stageQueAceptaSubida` tiene que rechazar: completar el stage desde un `storage.put` espiado (o desde el `fileFilter`) antes de que el handler vuelva a mirar. Es la carrera que el comentario de la línea 258 describe |
| dev-evid 368 | `parsed.authoritative ?? false` | ❌ | `stageEvidenceUploadSchema` ya lo defaultea a `false` (`documents.test.ts` lo fija) |
| dev-evid 399 | error del insert que no es el `UNIQUE` de `(stageId, sha256Hash)` | mock | `insertInto("Evidence")` que tire otro error → se relanza y limpia los archivos |
| dev-evid 518 | función: `storage.remove(ref).catch(...)` | mock | driver S3 (mismo mock de `storage-mocked.test.ts`) con `remove` que rechaza, en un pedido que no llega a confirmar |
| evidence 490 | función `sha256Pair` | HTTP | `GET /evidence/:bundleId/proof/:fileHash` sobre un bundle con **dos o más** archivos (con uno solo, el camino Merkle es vacío) |

**A2: 5 alcanzables (más las 2 funciones), 2 ❌.**

### A3 — `capital.routes.ts` (3 branches, 4 funciones)

| Línea | Rama | Veredicto | Receta |
|---|---|---|---|
| 81 | `contratos.length === 0 ? []` | HTTP | developer con un proyecto **sin** contratos → `GET /developer/capital/summary` |
| 112 | función: `releases.reduce` | HTTP | proyecto con contrato **y** una liberación real (`POST /contracts/:id/releases/:stageNum` sobre un stage certificado) |
| 163 | función: el `sort` por mes | HTTP | movimientos en **dos meses distintos**: un contrato con `signedAt` de otro mes, por `UPDATE` |
| 179 | `if (ids.length === 0) return []` | HTTP | developer sin proyectos → `GET /developer/capital/by-project` |
| 200-201 | funciones `filter`/`reduce` de releases por proyecto | HTTP | el mismo proyecto con liberación, pedido por `by-project` |
| 266 | `if (!actual.projects.includes(...))`, lado falso | HTTP | un investor con **dos unidades del mismo proyecto** → `GET /developer/investors` |

**A3: todo alcanzable.** Un solo `beforeAll` (proyecto + dos contratos del mismo investor + una
liberación + un segundo mes) cubre las 7.

### A4 — middlewares, `auth.routes.ts`, `users.routes.ts` (11 branches, 1 función)

| Línea | Rama | Veredicto | Receta o motivo |
|---|---|---|---|
| auth 46 | `leerGuard` con algo que no es función | unit | `leerGuard("x")` → `null` |
| auth 298 | `leerParam`: el param no está en `req.params` | unit | `authorize({ acceso: { proyecto: { param: "id" } } })` con `req.params = {}` → 500 (ruta mal declarada) |
| auth 440 | `CertifierInvitation` inexistente | HTTP | `POST /certifier/invitations/<cuid nuevo>/accept` → 404 |
| auth 457 | `evaluarDueño` con el param faltante | unit | lo mismo que la 298, con `{ dueño: … }` |
| auth 578 | `alguna` donde una rama da 500 | unit | `alguna` con una rama cuyo param no existe → 500 gana sobre el OK de la otra |
| auth 585 | `?? PROHIBIDO` | ❌ | el tipo de `alguna` exige dos ramas como mínimo: `veredictos[0]` siempre existe |
| auth 599 | `authorize` sin `req.user` | unit | llamar el middleware sin pasar por `authenticate` → 401 |
| errorHandler 98 | `res.headersSent` | unit | `res` falso con `headersSent: true` → llama `next(err)` |
| errorHandler 120 | error de restricción SQLite | unit | un error con `code: "SQLITE_CONSTRAINT_UNIQUE"` → 409. Desde oRPC ninguna ruta llega acá (lo resuelve `relanzarRestriccionComoOrpc`), pero `errorHandler` sigue siendo la red de las rutas Express llanas |
| rateLimit 68 | `DOSSIER_RATE_LIMIT_MAX` válido | unit | `dossierRateLimitMax({ DOSSIER_RATE_LIMIT_MAX: "5" })` → 5 |
| auth.routes 130 | `/auth/me` con el usuario borrado entre `authenticate` y el handler | ❌ | solo por una carrera: `authenticate` acaba de consultar la misma fila |
| users 179 | función: el `.catch` del `PATCH` | 🐞 | es el bug de arriba. Arreglado, la rama se va con él |

**A4: 9 alcanzables, 2 ❌, 1 bug.**

### A5 — `domain/*`, `stages`, `audit`, `_shared`, `notary`, `projects` (27 branches, 2 funciones)

| Línea | Rama | Veredicto | Receta o motivo |
|---|---|---|---|
| dossier 54 | `compileDossier` de una unidad inexistente | unit | `compileDossier(createId())` → `null` |
| dossier 198 | recompilar un dossier no firmado cuyo hash cambió | HTTP | compilar el dossier, completar un stage más y volver a pedirlo |
| notify 34 | `unitId ?? null` | unit | la función de notificar sin `unitId` |
| notify 63 | unidad sin investor | unit | notificar sobre una unidad `available` → no inserta nada |
| notify 104 | `params` ausente | unit | la notificación por proyecto sin `params` |
| project-aggregates 33 | `ids` vacío | unit | `agregadosDeProyectos([])` |
| project-aggregates 57 | una sola moneda → precio "desde" | HTTP | proyecto con dos unidades con precio en la **misma** moneda → `GET /developer/projects` o `/projects` |
| reconcile 126 | `if (!evento.txid) continue` | ❌ | la query ya filtra `txid is not null` |
| reconcile 265 | puerto `disabled` | mock | `anchorPort().mode` → `"disabled"` → `repararHilosSospechosos()` devuelve `[]` |
| reconcile 271 | sospechoso sin `stageId`/`toState` | ❌ | la query filtra `stageId is not null`, y toda `STAGE_TRANSITION` se escribe con `toState` (`transitionStage`, línea ~509) |
| reconcile 287 | `outputRef` sin txid | ❌ | el adaptador arma `outputRef` como `` `${txHash}#${índice}` ``: nunca empieza con `#` |
| reconcile 294 | `network ?? "Preprod"` | ❌ | `disabled` ya salió en la 265, y `simulated`/`real` siempre traen `network` |
| reconcile 302 | la actualización no escribió nada (otro proceso ganó) | mock | `findLiveThread` espiado que, antes de devolver, escriba el `txid` del evento: simula la carrera que el `where txid is null` existe para ganar |
| stage-transition 288 | `if (event.txid) return event` | ❌ | los tres llamadores de `anchorEvent` le pasan un evento recién insertado, sin `txid` |
| stage-transition 306 | `previous.state === "Completed" ? root : ""`, lado `root` | ❌ | `Completed` es terminal (D-020): nunca hay transición desde ahí |
| stage-transition 361 | `verify()` devuelve `null` | mock | `vi.spyOn(anchorPort(), "verify").mockResolvedValue(null)` → el evento queda `Pending` |
| stage-transition 423 | `transitionStage` de un stage inexistente | unit | llamada directa con un id nuevo → `STAGE_NOT_FOUND` |
| stage-transition 572 | `retryStageMint` de un stage inexistente | unit | lo mismo |
| stage-transition 582 | puerto `disabled` en el retry | mock | `mode: "disabled"` → no le pregunta a la cadena |
| stages 67, 128, 211 | tres 404 de stage | ❌ | `authorize({ proyecto: { via: "Stage" } })` ya cargó el stage (`GET`, `PATCH`, `PATCH …/state`) |
| _shared 48 | error que no es de restricción | unit | `relanzarRestriccionComoOrpc(new Error("x"), …)` → lo relanza tal cual |
| _shared 68 | `avancePorProyecto([])` | unit | directo |
| _shared 79 | proyecto sin stages → 0 | HTTP/unit | un proyecto recién insertado sin stages |
| audit 46 | mediana con cantidad **par** de muestras | HTTP | `GET /audit-logs/telemetry/reservation-to-escrow` con 2 o 4 muestras |
| notary 294 | re-firmar un dossier firmado sin su evento de firma | mock | `anchorCommitmentEvent` que falle después del `update` a `signed`, y repetir la firma: devuelve 200 sin `anchor` |
| notary 149 | función: el `map` de pendientes en `kpis` | HTTP | `GET /notary/kpis` con un dossier `compiled` |
| projects 501 | función: FK en la invitación de certifier | ❌ | el handler ya confirmó que el proyecto y el certifier existen antes del insert |

**A5: 18 alcanzables, 10 ❌** (9 branches + 1 función), **más el bug de `PATCH /projects/:id`**.

### A6 — `lib/*`, `db/*`, `instrumentation`, `utils/audit`, `app` (16 branches, 3 funciones)

| Línea | Rama | Veredicto | Receta o motivo |
|---|---|---|---|
| anchor 127 | `DATABASE_URL` ausente | unit | `vi.stubEnv("DATABASE_URL", undefined)` → `motivoParaNoAnclar()` |
| anchor 185 | el factory tira algo que no es `Error` | mock | factory que tira un string → el puerto queda inhabilitado con ese texto |
| anchor 197 | `anchorPort()` antes de `initAnchorPort()` | unit | `vi.resetModules()` + import fresco → tira |
| storage 114 | S3 sin `endpoint` | unit | `new S3Storage({ …sin endpoint })` (AWS puro) |
| storage 177 | `bucketReady` ya en `true` | unit | dos `put` seguidos: el segundo no vuelve a llamar `HeadBucket` |
| storage 212 | `S3_CREATE_BUCKET` ausente | unit | `createStorage()` con esa variable sin setear |
| route-inventory 99 | middleware de router sin guard | unit | un `Router` sintético con `router.use(fn)` sin marcar (en la app real, hasta `authenticate` está marcado) |
| route-inventory 106 | path vacío → `"/"` | unit | router sintético con una ruta `"/"` y prefijo `""` |
| migrate 30 | no hay directorio de migraciones | mock | `vi.mock("node:fs")` con `existsSync` → `false` |
| migrate 139 | `if (reloj)`, lado falso | ❌ | el executor de la `Promise` corre sincrónico: `reloj` siempre está asignado al llegar al `finally` |
| migrate 156 | `DATABASE_URL` ausente → default | mock | **no correrla de verdad** (migraría `.data/dev.db`): `vi.mock` de `lib/libsql-client` que capture la URL y verifique que es `DEFAULT_DATABASE_URL` |
| migrate 172 | con `DATABASE_AUTH_TOKEN` | mock | el mismo mock, verificando que viaja el `authToken` |
| fixtures 169 | `sembrarMembresias(db, id, [])` | unit | directo |
| local-db 26 | URL que no es `file:` | unit | `asegurarDirectorioLocal("libsql://x")` → no crea nada |
| instrumentation 34 | `SENTRY_DSN` sin `NODE_ENV` | unit | `initSentry()` con el env pisado → `environment: "development"` |
| instrumentation 162 | función: el `catch` del `shutdown` en `SIGTERM` | unit | capturar el listener con `vi.spyOn(process, "on")` y llamarlo con un `sdk.shutdown` que rechaza |
| utils/audit 23 | `actorUserId` ausente | unit | `writeAuditLog` sin actor (evento de sistema) → `null` |
| app 106, 205 | funciones: `/health` y el 404 final | HTTP | `GET /health` → 200; `GET /api/v1/no-existe` → `{ message: "Not found" }`. Sumar el `catch` de `/health` con `sql` espiado para que falle → 503 |

**A6: 15 alcanzables (más las 3 funciones), 1 ❌.**

### El resultado, si se hace todo

| | Hoy | Tras marcar las 18 ❌ | Tras los tests de las 57 |
|---|---|---|---|
| Branches | 791/866 (91,33%) | 791/848 (93,28%) | **848/848 (100%)** |

**Para el 95% alcanza con 15 de las 57.** Marcar las 18 lo hace cada lote en sus propios archivos
(§Paralelismo). Las 13 funciones: 11 alcanzables, 1 ❌ (`projects.routes.ts:501`) y 1 bug (`users.routes.ts:179`).

## Resultados por lote

### A1 — cerrado 2026-09-22

`developer-comercial.routes.ts` al **100% en las cuatro métricas**: de las 11 branches, **9 con
test y 2 marcadas** (las 167 y 472: `proyectoDeLaEntidad` hace la misma consulta —con el mismo
join a `Unit` para `Contract`— y contesta 404 antes del handler). Branches totales de la API:
91,33% → 92,59%.

**La receta de la tabla A1 para 403-409 era falsa.** No se puede "vender, reabrir y re-vender":
`Contract_unitId_key` admite un contrato por unidad y el accept es atómico (SPEC-201), así que por
la API una unidad tiene como mucho una invitación aceptada. Pero el esquema no impide varias ni
`respondedAt`/`signedAt` nulos, y antes de SPEC-201 un accept que chocaba dejaba la invitación
`accepted` igual: el desempate existe para esas filas heredadas. Por eso **no se marcaron** — se
cubren con filas insertadas a mano (`developer-comercial-routes-coverage.test.ts`), incluidas las
404 y 407 que la tabla daba por ❌. El comentario del handler que describía el flujo imposible se
corrigió.

**🐞 Tercer bug, encontrado al probar esa receta:** vender → `PATCH /developer/units/:id` a
`available` → re-invitar → aceptar daba **500 no clasificado** (`SQLITE_CONSTRAINT_UNIQUE` sobre
`Contract.unitId`, reportado a Sentry). Arreglo en `investor.routes.ts`: dentro de la misma
transacción, si la unidad ya tiene contrato, `UNIT_NOT_AVAILABLE` (409) — el error con nombre que
ya existía para la unidad `sold`. Queda **una decisión del dueño, fuera de esta spec**: el `PATCH`
sigue dejando poner en `available` una unidad con contrato, que después no se puede volver a vender.

## Paralelismo — qué se puede hacer a la vez, medido contra el código

**Con el paso 0 cerrado, los seis lotes pueden correr los seis a la vez.** Se verificó, no se
supuso:

- **Aislamiento en runtime.** Cada archivo de test corre contra su propia copia de la base
  (`setup-db.ts` copia la plantilla antes de cada archivo, SPEC-015 §1) con `fileParallelism: true`.
  Dos lotes que escriben archivos de test distintos no se ven entre sí.
- **Aislamiento en git.** Cada lote escribe sus propios archivos de test, y los archivos de `src/`
  de la tabla de arriba son de un solo lote cada uno. No hay archivo que dos agentes toquen.

**Pero hay cuatro archivos que todas las tandas de SPEC-017 editaron, y que en paralelo chocan
seguro.** La regla para los lotes es no tocarlos:

| Archivo | Por qué chocaría | Regla |
|---|---|---|
| `apps/api/vitest.config.mts` | Cada tanda subía los umbrales **y** sumaba un párrafo al comentario | Ningún lote lo toca. El umbral se sube una vez, en §Consolidación |
| `specs/SPEC-018-…` (esta) | Cada tanda escribía su sección | Ningún lote la edita: cada agente devuelve su resultado (qué cerró, qué pasó a documentado y por qué) y lo transcribe quien consolida |
| `test/global-setup.ts` (`FIXTURES`) | Es la plantilla de todos los archivos | Los datos que un lote necesita se crean en el `beforeAll` de su propio archivo, como hace `developer-profile.test.ts` |
| Archivos de test existentes compartidos (`stage-transitions.test.ts`, `route-guards.test.ts`, `orpc-client-*.test.ts`) | Dos lotes pueden querer sumar un `it` al mismo | Cada lote crea `test/<modulo>-coverage.test.ts` nuevo (el patrón que ya usan `certifier-routes-coverage.test.ts` y compañía) |

**Si un lote encuentra una rama que no se alcanza, la marca él mismo, en un archivo de su lote**,
con el mismo formato del paso 0 (`/* v8 ignore if -- @preserve: <motivo> (SPEC-018) */`) y un motivo
que se pueda verificar: qué middleware o qué constraint la cierra. Antes de marcar, **se prueba que
es inalcanzable** leyendo `evaluarProyecto`/`evaluarDueño` o el esquema, no se supone por la forma
del `if`. Una marca sin esa cadena es subir el número sin probar nada (SPEC-017 §Qué no se hace).

**Cada lote reporta ramas cerradas y ramas marcadas (conteo, con el motivo de cada marca)**, no
porcentajes: el número de un lote medido a mitad de camino depende de qué otros lotes ya entraron.

**En la práctica:** seis agentes en worktrees separados son ~4,5 GB (`CLAUDE.md` §Worktrees: ~750 MB
cada uno). El 2026-09-22 hay 33 GB libres — alcanza, pero se borran apenas se mergean.

## Consolidación (serial, al final)

1. Con los seis lotes en `main`: una corrida de `pnpm --filter @plataforma/api test:coverage` y la
   tabla de arriba regenerada.
2. Revisar juntas las marcas nuevas que pusieron los lotes (`grep -rn "v8 ignore" apps/api/src`):
   cada una con un motivo verificable.
3. Umbrales de `vitest.config.mts` al valor medido (trinquete: suben, no bajan), y el comentario
   largo de ese archivo recortado: desde el paso 0, la razón de cada rama vive en la marca de la
   línea, y el comentario repite lo que SPEC-017 ya cuenta.
4. Si algún número quedó bajo la vara: la lista de lo que falta, con su razón, acá.

## Criterio de cierre

- Branches ≥95% y statements, functions y lines ≥98% en `apps/api`, con cada rama marcada como
  inalcanzable justificada en su propia línea.
- Umbrales de `vitest.config.mts` en el valor final. La API ya corre `test:coverage` en CI con esos
  umbrales, así que no hay paso de CI propio.
