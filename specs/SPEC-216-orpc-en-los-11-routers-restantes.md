# SPEC-216 — Extender oRPC a los routers cross-cutting/admin: 38 rutas mecánicas

> **Origen:** [`SPEC-212`](SPEC-212-contrato-en-la-firma-de-la-ruta.md) §Las cuatro sub-partes,
> explícitamente fuera de esa spec: *"Fuera de alcance de las cuatro: los routers que D-066 no
> nombra — `auth`, `users`, `projects`, `projects-obra`, `stages`, `evidence`, `contracts`,
> `notifications`, `profile`, `audit-logs`, `public` (11 archivos, cross-cutting o admin, no
> scopeados por rol). Esos se quedan con `REQUEST_SCHEMAS`/`RESPONSE_SCHEMAS` tal como están hoy —
> extender D-066 a ellos es una decisión nueva, no algo que esta spec pueda asumir."*
>
> **Esta entrada reemplaza el registro de 2026-09-20 que dejaba la spec "sin desarrollar todavía".**
> El dueño confirmó en conversación el mismo día que sí vale la pena extender el patrón — con la
> preferencia explícita de *"tender a tener todo adentro de oRPC y no tener que hacer nada a mano
> porque es mucho más frágil"* — y pidió una auditoría ruta por ruta antes de comprometerse al
> alcance. Esa auditoría es lo que sigue. Nivel 🟡, igual que las cuatro sub-partes de `SPEC-212`, por
> tocar el framework de la API.
>
> **Split en dos specs, no una:** de las 39 rutas de los 11 routers, 38 repiten —sin nada nuevo—
> alguno de los patrones que `SPEC-212` §A-§D ya probó en código de producción. La única excepción es
> `GET /evidence/:id/download`, que hace streaming real (`storage.read(...).pipe(res)`) y no tiene
> resuelto si oRPC puede servir un stream sin bufferearlo entero en memoria — el mismo tipo de
> pregunta que bloqueó el parseo del multipart en `SPEC-212` §D. Esa ruta, sola, es
> [`SPEC-217`](SPEC-217-el-streaming-de-download-necesita-su-propia-investigacion.md). Es el mismo
> corte que ya usó `SPEC-212` §D: la vertical migra completa salvo la ruta con la excepción real, que
> se separa en vez de forzarla adentro.
>
> **§E1 (`profile.routes.ts` + `notifications.routes.ts`, 5 rutas) y §E2 (`public.routes.ts` +
> `auth.routes.ts`, 3 rutas) cerradas 2026-09-20** — las dos juntas, en un solo commit, el piloto de
> menor riesgo del lote más las dos "primera vez sin sesión" resueltas de una. `pnpm verify` completo
> en verde (465 tests de `apps/api`, incluidos los 4 archivos `test/orpc-client-{profile,
> notifications,auth,public}.test.ts` nuevos — mismo patrón que `test/orpc-client-{notary,certifier,
> investor,developer}.test.ts` de `SPEC-212`, cliente oRPC tipado contra el servidor real, no
> mockeado). `REQUEST_SCHEMAS`/`RESPONSE_SCHEMAS` (`scripts/generate-openapi.ts`) ya no tienen las 8
> entradas; `specs/openapi/propnexus.openapi.json` regenerado.
>
> **La pregunta de §Primera vez sin sesión, resuelta:** `AuthContext = { user?: {...} }`, un solo
> `os.$context<AuthContext>()` para `loginProcedure` (nunca toca `context.user`) y `meProcedure`
> (`context.user!`, la misma garantía que `req.user!` en el resto de la API — la da `authenticate`
> corrido antes, no el tipo). No hizo falta partir el router en dos generaciones separadas.
> `public.routes.ts` no necesitó `$context` en absoluto: ningún procedimiento ahí toca `user`.
>
> **Lo único que no repitió un patrón ya probado, y no era nuevo — ya estaba anticipado por
> `SPEC-212`:** dos tests de `test/auth.test.ts` (`POST /auth/login` con body vacío / email
> malformado) fijaban `res.body.fieldErrors`, la forma de `error.flatten()`. Con la migración el
> sobre de error es `ORPCError.toJSON()` (`{code: "BAD_REQUEST", status: 400, data: {issues}}`) —
> el MISMO cambio de forma que `SPEC-212` ya documentó como aceptado para las 45 rutas de §A-D. Los
> dos tests se actualizaron para el nuevo shape, sin tocar el código del endpoint.
>
> **§E3 (`audit.routes.ts` + `contracts.routes.ts`, 3 rutas) y §E5 (`stages.routes.ts`, 3 rutas)
> cerradas 2026-09-20**, en un solo commit — las dos evitan superficie 🔴, así que combinarlas no
> rompe el aislamiento que la spec pide para §E4 (bcrypt). `stages.routes.ts` es el que más
> `.errors()` con nombre concentra de todo el lote: `STAGE_IDENTITY_IMMUTABLE` (`PATCH /:id`) y
> `STAGE_TRANSITION_FORBIDDEN`/`STAGE_TRANSITION_INVALID`/`STAGE_EVIDENCE_REQUIRED`/
> `STAGE_EVIDENCE_UNATTRIBUTED` (`PATCH /:id/state`, las cuatro en el mismo procedimiento porque
> comparten ruta) — los cinco ya resueltos en producción por SPEC-212 §A-D, sin decisión nueva acá.
> `contracts.routes.ts` es la primera vez que se migra una ruta con la regla disyuntiva
> `{ alguna: [...] }` delante — confirmado sin sorpresas: `authorize` la resuelve en la capa Express,
> antes de que oRPC vea la request, así que el procedimiento no sabe ni le importa que la regla sea
> disyuntiva. `pnpm verify` completo en verde (476 tests de `apps/api`, 3 archivos
> `test/orpc-client-{audit,contracts,stages}.test.ts` nuevos, mismo patrón que los de §E1/§E2).
>
> **Quedan §E4 (`users.routes.ts`, 5 rutas, 🔴 bcrypt — aislado a propósito para su propia revisión),
> §E6 (`projects.routes.ts` + `projects-obra.routes.ts`, 12 rutas) y §E7 (`evidence.routes.ts`, 7 de
> las 8) — ver la tabla de sub-partes, abajo.**

## La auditoría, ruta por ruta (2026-09-20)

Los 11 archivos de `apps/api/src/routes/` que quedaron fuera de D-066, con su prefijo de montaje
(`MONTAJE`, `app.ts`), su cantidad de rutas y el guard que declaran hoy:

| Archivo | Prefijo | Rutas | Guard(s) | Complicación nueva |
|---|---|---|---|---|
| `auth.routes.ts` | `/api/v1/auth` | 2 | `/login` sin `authenticate` (es el punto de entrada); `/me` con `scopeEnQuery` | ninguna — ver §Primera vez sin sesión, más abajo |
| `users.routes.ts` | `/api/v1/users` | 5 | `router.use(authenticate)` + `roles: ["admin"]` en las 5 | ninguna — toca bcrypt (🔴 declarado en `apps/api/CLAUDE.md` §Superficie 🔴), pero solo el transporte cambia |
| `projects.routes.ts` | `/api/v1/projects` | 9 | mixto: `soloRol` (admin) en CRUD, `scopeEnQuery`/`proyecto`+membresía en lecturas | ninguna — comparte prefijo con `projects-obra.routes.ts`, ver §Prefijo compartido |
| `projects-obra.routes.ts` | `/api/v1/projects` | 3 | `proyecto`+`ANY_MEMBERSHIP` | ninguna — comparte prefijo, ver §Prefijo compartido |
| `stages.routes.ts` | `/api/v1/stages` | 3 | `proyecto`+membresía (`ANY_MEMBERSHIP` en `GET`, `["developer"]` en los dos `PATCH`) | ninguna — la FSM vive en `domain/stage-transition.ts`, la ruta es fina |
| `evidence.routes.ts` | `/api/v1/evidence` | 8 (7 acá + 1 en `SPEC-217`) | mixto, ver tabla propia más abajo | `POST /:id/anchor` repite el 200/201 idempotente que §A ya resolvió; `GET /:id/download` **no está acá** |
| `contracts.routes.ts` | `/api/v1/contracts` | 1 | la única regla `{ alguna: [...] }` (disyuntiva) de toda la API | ninguna — `authorize` ya la evalúa, el montaje de oRPC no sabe ni le importa qué forma tiene la regla |
| `notifications.routes.ts` | `/api/v1/notifications` | 2 | `scopeEnQuery: "Notification.userId = usuario"` | ninguna — **la misma cadena literal ya está en producción** en `investor.routes.ts:567` (§C, ya migrada) |
| `profile.routes.ts` | `/api/v1/profile` | 3 | `scopeEnQuery: "User.id = usuario"` | ninguna — mismo mecanismo que arriba, solo cambia el nombre de la entidad en el string, que `authorize` no interpreta: es una etiqueta para humanos (ver `apps/api/CLAUDE.md` §El guard único) |
| `audit.routes.ts` (`audit-logs`) | `/api/v1/audit-logs` | 2 | `roles: ["admin"]` | ninguna |
| `public.routes.ts` | `/api/v1/public` | 1 | **sin `authenticate`**, con `dossierRateLimiter()` en su lugar | ninguna — segundo caso sin sesión, ver §Primera vez sin sesión |

**Total: 39 rutas en 11 archivos. 38 son candidatas limpias (esta spec). 1 no (`SPEC-217`).**

### `evidence.routes.ts`, ruta por ruta

Es el archivo más grande (8 rutas) y el único con una excepción real, así que se detalla aparte:

| Ruta | Guard | Repite el patrón de |
|---|---|---|
| `GET /:id` | `proyecto` vía `Evidence` + `ANY_MEMBERSHIP` | lectura simple con `.extend()` local, igual que `stageDetailSchema` en `stages.routes.ts` (ya migrado en sentido inverso: acá el compuesto es nuevo, pero el mecanismo — componer con `.extend()` sobre un schema importado — es el mismo que usan los procedimientos ya migrados) |
| `GET /:id/download` | `proyecto` vía `Evidence` + `ANY_MEMBERSHIP` | **nada — es [`SPEC-217`](SPEC-217-el-streaming-de-download-necesita-su-propia-investigacion.md), no esta spec** |
| `PATCH /:id` | `proyecto` vía `Evidence` + `["developer"]` | `safeParse` → `.input()`, mutación simple |
| `POST /reconcile` | `soloRol` (admin) | sin body, sin params — el procedimiento más simple del lote |
| `POST /:id/anchor` | `roles: ["admin"]`, `proyecto` vía `Evidence` + `ANY_MEMBERSHIP` | el 200 (idempotente)/201 (nuevo) que §A ya resolvió con la unión discriminada de `outputStructure: "detailed"` (ver `SPEC-212` §El diseño, trampa 2) |
| `DELETE /:id` | `soloRol` (admin) | `successStatus: 204`, ya probado en §C (`investor` favorites) — y el 409 `EVIDENCE_ANCHORED` necesita `.errors({...})`, ver §Los `.errors()` que hacen falta |
| `GET /:bundleId/proof/:fileHash` | `proyecto` vía `EvidenceBundle` + `ANY_MEMBERSHIP` | lectura con dos params atados a `router.param` (`bundleId`, `fileHash`), mismo patrón que cualquier ruta con más de un param de las ya migradas |
| `GET /:bundleId/files` | `proyecto` vía `EvidenceBundle` + `ANY_MEMBERSHIP` | lectura simple |

## Por qué 38 no tienen nada nuevo — cada patrón, con su precedente en código ya migrado

Esto es lo que separa "mecánico" de "hay que decidir algo": para cada complicación que las cuatro
sub-partes de `SPEC-212` tuvieron que resolver, hay al menos una ruta de estas 38 que la vuelve a
necesitar — y ninguna necesita algo que no esté ya resuelto y commiteado.

1. **`PREFIJO_ABSOLUTO` tiene que ser el path absoluto de montaje, no el relativo dentro del
   router** (`SPEC-212` §El diseño, trampa de §A). Aplica a las 11 — cada archivo saca su
   `PREFIJO_ABSOLUTO` directo de la tabla `MONTAJE` de arriba.
2. **Cada procedimiento declara su propio `path` relativo a ese prefijo, nunca `"/"` para más de
   uno en la misma vertical** (la trampa de colisión en el documento de OpenAPI que cerró §A). Aplica
   igual: p. ej. `stages.routes.ts` tiene tres rutas (`/{id}`, `/{id}` con otro método, `/{id}/state`)
   que necesitan sus tres entradas distintas en el router combinado que arma
   `scripts/generate-openapi.ts`.
3. **`successStatus: N` para lo que no es 200 por default.** Ya probado en §C
   (`successStatus: 204` en los favoritos del investor, `successStatus: 204` en declinar invitación).
   Rutas de este lote que lo necesitan: `DELETE /users/:id`, `DELETE /projects/:id`,
   `DELETE /evidence/:id`, `PATCH /notifications/:id/read` (las cuatro, 204) y `POST /users`,
   `POST /projects`, `POST /projects/:id/members` (las tres, 201).
4. **`outputStructure: "detailed"` con una unión discriminada por `status` cuando el código de éxito
   varía** (§A, la trampa 2 de `SPEC-212`: `z.union([z.strictObject({status: z.literal(200), ...}),
   z.strictObject({status: z.literal(201), ...})])`, nunca un `status: z.union([...])` adentro de un
   solo objeto). La única ruta de este lote que lo necesita es `POST /evidence/:id/anchor`
   (200 si ya estaba anclada, 201 si ancla ahora) — mismo shape exacto que `firmar` en `notary`.
5. **`.errors({NOMBRE: {status, message}})` donde un test ya fija `res.body.code` exacto**, para no
   convertir eso en un cambio de contrato de error (§A, trampa 3). Ver la lista completa en
   §Los `.errors()` que hacen falta, abajo — son seis códigos, cuatro de ellos ya con test que se
   pondría rojo sin el `.errors()` correcto.
6. **`scopeEnQuery` como forma de `acceso`, con `authorize` sin cambios.** Ya migrado en producción:
   `investor.routes.ts:567` tiene `scopeEnQuery: "Notification.userId = usuario"` — la MISMA cadena
   que `notifications.routes.ts` usa hoy, palabra por palabra, porque las dos rutas filtran la misma
   tabla. `profile.routes.ts` usa `"User.id = usuario"`, mecanismo idéntico, solo cambia el nombre de
   la entidad (que `authorize` no interpreta — es una etiqueta para el humano que lee la matriz, no
   parte de la lógica).
7. **La regla `{ alguna: [...] }` (disyuntiva).** Hoy solo la usa `contracts.routes.ts` — es la única
   ruta de las 87 que la necesita (`apps/api/CLAUDE.md` §El guard único la señala como "la lista de
   candidatas, resuelta el mismo día"). No está probada con oRPC todavía porque ninguna de las cuatro
   sub-partes de `SPEC-212` la usaba — pero `authorize` ya evalúa la regla ANTES de que oRPC vea la
   request (es middleware Express delante, sin cambiar de capa, la invariante 3 de `SPEC-212`), así
   que oRPC no tiene que saber que la regla es disyuntiva: para oRPC es una request que ya pasó
   `authorize` o una que nunca llega. Cero riesgo nuevo, cero código nuevo del lado de oRPC — se
   señala acá solo para que quien lo migre sepa que es la primera vez que se ejercita esa combinación,
   no para que la trate distinto.
8. **El interceptor de Sentry ya viene gratis.** `lib/orpc.ts` envuelve el export de `OpenAPIHandler`
   desde el cierre de la investigación de `SPEC-212` (ver esa spec, "Implementado 2026-09-20 — el
   interceptor de Sentry"): cualquier `new OpenAPIHandler({...})` que estos 11 archivos escriban
   reporta a Sentry sin que nadie tenga que acordarse de nada. No es trabajo de esta spec, es una
   consecuencia de que el punto de inyección sea el módulo compartido y no cada call site.

### Prefijo compartido: `projects.routes.ts` + `projects-obra.routes.ts`

Los dos montan en `/api/v1/projects` (`MONTAJE`, `app.ts`) — mismo caso que los cuatro archivos de
`/api/v1/developer` en `SPEC-212` §D. Ahí se verificó que migrar rutas de a un archivo, con un
`OpenAPIHandler` por procedimiento (nunca un handler compartido montado una sola vez en el prefijo),
no toca el `router.use(authenticate)` de ningún archivo del grupo — los dos ya lo declaran, y
coinciden (`test/route-guards.test.ts` lo exige: "los routers que comparten prefijo declaran los
mismos guards de router"). Se puede migrar `projects.routes.ts` sin migrar `projects-obra.routes.ts`
en el mismo commit, o al revés, sin que el otro se entere — igual que pasó con `capital.routes.ts`
migrando mientras `developer-evidencia.routes.ts` seguía con Multer.

### Primera vez sin sesión: `POST /auth/login` y `GET /public/dossier/:shareToken`

Ninguna de las 45 rutas que migraron en `SPEC-212` corre sin `authenticate` antes — las cuatro
verticales son todas de usuario logueado. Estas dos son las primeras candidatas sin sesión:

- **No es un patrón nuevo de montaje.** Las dos siguen siendo `router.metodo(path, ...middlewares
  express..., handlerDeOrpc)` — simplemente la lista de middlewares Express antes del handler de oRPC
  es más corta (el rate limiter propio de cada una, `loginRateLimiter()`/`dossierRateLimiter()`, y
  nada más). `OpenAPIHandler.handle()` no sabe ni le importa si `authorize` corrió antes: solo ve la
  request que le llega.
- **Lo que sí es nuevo, y hay que confirmarlo al implementar, no asumirlo:** el tipo de contexto.
  Los seis archivos ya migrados usan `os.$context<XContext>()` con un contexto que siempre exige
  `user` (`NotaryContext`, `CertifierContext`, etc.), porque `authenticate` corrió para las seis. Acá
  `POST /login` no tiene `req.user` — nunca lo va a tener, es el endpoint que lo crea — así que su
  procedimiento no puede pedir el mismo contexto que `GET /me`, que sí lo necesita. El comentario que
  ya escribió `SPEC-212` §A en `notary.routes.ts` anticipa exactamente este caso (*"un router con
  procedimientos de distinto contexto inicial (algunos piden `user`, otros ninguno) solo tipa si se
  construye desde ESTE contexto, el más ancho de los dos"*, para el router combinado que arma
  `scripts/generate-openapi.ts`) — pero es un comentario, no un caso ejercitado todavía: ninguna de
  las cuatro sub-partes migradas tuvo de hecho una mezcla de procedimientos con y sin `user`. `auth`
  es el primer archivo real donde eso pasa, así que **verificar que el router combinado de
  `auth.routes.ts` tipa** (`AuthContext = { user?: {...} }` o dos routers de generación separados)
  es lo primero que hay que probar al abrir esta sub-parte — no un bloqueo, un primer caso real de
  algo hasta ahora solo previsto en un comentario.
- **La comparación de tiempo constante de `/login` no se toca por la migración.** `bcrypt.compare`
  sigue corriendo siempre, exista el usuario o no (`HASH_DUMMY`) — eso es lógica de dominio adentro
  del `.handler()`, y oRPC no le agrega ni le saca latencia estructural distinta de la que ya mide
  `test/auth-timing.test.ts`. Ese test sigue siendo la garantía, no algo que esta spec reemplace.

### Los `.errors()` que hacen falta

Seis códigos de negocio en este lote, cuatro con un test que ya fija `res.body.code` exacto —
exactamente el tipo de trampa que la invariante 3 de `SPEC-212` (trampa §A #3) ya identificó y
resolvió una vez:

| Código | Ruta | Status | ¿Test que lo fija hoy? |
|---|---|---|---|
| `RESOURCE_ALREADY_EXISTS` | `POST /users` (email duplicado) | 409 | **Sí** — `test/constraint-errors.test.ts` → *"un email de usuario repetido"* |
| `RESOURCE_ALREADY_EXISTS` | `POST /projects` (slug duplicado) | 409 | No hay test sobre ESTA ruta (sí sobre `POST /developer/projects`, ya migrada) — mismo `Project.slug` único, mismo riesgo latente si no se envuelve |
| `RESOURCE_ALREADY_EXISTS` | `POST /projects/:id/members` (mismo `userId`+`projectId`+`membershipRole` repetido) | 409 | No — `ProjectMember_userId_projectId_membershipRole_key` es único, nadie lo prueba hoy |
| `RELATED_RESOURCE_NOT_FOUND` | `POST /projects/:id/members` (`userId` inventado) | 400 | **Sí** — `test/constraint-errors.test.ts` → *"agregar como miembro un userId inventado"* |
| `STAGE_IDENTITY_IMMUTABLE` | `PATCH /stages/:id` (tocar `sequenceOrder`/`validationCritical` con hilo anclado) | 409 | **Sí** — `test/stage-transitions.test.ts:696` |
| `STAGE_TRANSITION_FORBIDDEN` | `PATCH /stages/:id/state` (developer pide `Completed`/`Observed`) | 403 | **Sí** — `test/stage-transitions.test.ts:186,201,211` |
| `EVIDENCE_ANCHORED` | `DELETE /evidence/:id` (evidencia anclada o en un bundle) | 409 | **Sí** — `test/spec-210-borrar-evidencia-anclada.test.ts:188,211` |

**Los tres primeros (`RESOURCE_ALREADY_EXISTS` × 2, sin test hoy en esta ruta puntual) son el mismo
modo de falla que encontró §D con `POST /developer/projects` y `POST /developer/projects/:id/units`:
`OpenAPIHandler` nunca llama a `next(err)`, así que un `SQLITE_CONSTRAINT_UNIQUE` sin envolver en
`relanzarRestriccionComoOrpc` se convierte en el 500 genérico de oRPC en vez del 409 que
`errorHandler.ts` daría hoy — con o sin test que lo note.** Todas las inserciones de este lote contra
un índice único (`User.email`, `Project.slug`, `ProjectMember` compuesto) tienen que envolverse en
`relanzarRestriccionComoOrpc` (`_shared.ts`) igual que las dos de §D, no solo las que ya tienen test:
que un test no exista hoy es la razón por la que el riesgo es silencioso, no una razón para no
cerrarlo.

**`STAGE_TRANSITION_INVALID`, `STAGE_EVIDENCE_REQUIRED` y `STAGE_EVIDENCE_UNATTRIBUTED`** (los otros
tres códigos que `test/stage-transitions.test.ts` fija sobre `PATCH /stages/:id/state`) no nacen en
la ruta: los devuelve `transitionStage()` (`domain/stage-transition.ts`) como parte de su resultado
tipado (`resultado.code`), y la ruta hoy solo traduce ese resultado a HTTP con un `if`/`switch`. La
migración a oRPC sigue leyendo `resultado.code` de la misma función de dominio — no cambia esa
lógica, solo el `if` que hoy arma `res.status(409).json({code: resultado.code, ...})` pasa a ser
`throw errors[resultado.code]({...})`. Van en la misma tabla de `.errors({...})` que
`STAGE_TRANSITION_FORBIDDEN` porque comparten el procedimiento (`PATCH /stages/:id/state`), no porque
sean un caso nuevo.

## Alcance

- **Cubre:** migrar las 38 rutas de la tabla de arriba (10 archivos completos + 7 de las 8 de
  `evidence.routes.ts`) al mismo patrón que `SPEC-212` §A-§D: un procedimiento oRPC por ruta,
  reusando el schema Zod que YA existe en `packages/shared` (regla 6 — ninguno de los 11 archivos
  tiene un schema que no esté ya extraído, ver §La auditoría), `authorize` corriendo sin cambios
  delante, `OpenAPIHandler` importado de `lib/orpc.ts` (nunca directo de `@orpc/openapi/node`, para
  heredar el interceptor de Sentry).
- **Cubre:** sacar las 38 entradas correspondientes de `REQUEST_SCHEMAS`/`RESPONSE_SCHEMAS`
  (`scripts/generate-openapi.ts`) — se encogen ruta por ruta, mismo criterio que §A-§D.
- **Cubre:** envolver en `relanzarRestriccionComoOrpc` toda inserción de este lote contra un índice
  único, tenga test hoy o no (ver §Los `.errors()` que hacen falta) — cerrar el riesgo latente es
  parte del trabajo, no un extra.
- **Cubre:** generar el cliente oRPC tipado para cada archivo migrado (`@orpc/client`), como prueba
  de que el contrato es real — mismo patrón que `test/orpc-client-{notary,certifier,investor,
  developer}.test.ts`. `apps/web` no se toca (es `SPEC-111`, ya registrada, fuera de esta spec).
- **NO cubre:** `GET /evidence/:id/download` — es `SPEC-217`.
- **NO cubre:** ningún cambio de contrato de API. Las 38 rutas aceptan y devuelven exactamente lo
  mismo que hoy — incluido el shape del error de validación (`ORPCError.toJSON()`, no
  `error.flatten()`, mismo cambio de forma que ya aceptaron las 45 rutas de `SPEC-212`, documentado
  ahí como "el shape SÍ cambia, y ya había cambiado para las 45 sin que nadie lo hubiera escrito").
- **NO cubre:** `authorize`, `route-guards.test.ts`, ni ningún guard — se leen, no se tocan, mismas
  invariantes que `SPEC-212`.
- **NO cubre:** el resto de la superficie de `apps/api` (las cuatro verticales de `SPEC-212`, ya
  cerradas). Las cuentas cierran contra `test/route-guards.test.ts`, que a la fecha de esta spec
  audita **85** rutas montadas: **46** de las cuatro verticales de D-066 (45 migradas a
  `OpenAPIHandler` por `SPEC-212` + 1, el multipart de `developer-evidencia.routes.ts`, cerrado con
  `call()` + Multer, ver esa spec) + **38** de esta spec + **1** de `SPEC-217` = 85. Se reconcilia
  contra el router montado real al abrir cada sub-parte, no contra este número — si alguien agregó o
  borró una ruta entre esta auditoría y el día en que se implementa, `route-guards.test.ts` lo va a
  mostrar primero.

## Invariantes (las mismas cinco de `SPEC-212`, valen igual acá)

1. El schema de una ruta se lee en su firma — input/output de un procedimiento oRPC. Después de
   migrar un archivo, `generate-openapi.ts` no tiene tabla indexada por string de ruta para esas
   rutas.
2. El schema que documenta es el que valida y el que tipa el cliente — una sola declaración, ya en
   `packages/shared`.
3. `authorize` sigue corriendo primero, sin cambios en su firma, ruta por ruta. Un `OpenAPIHandler`
   por procedimiento, nunca uno compartido montado en el prefijo del router.
4. `route-guards.test.ts` sigue viendo la matriz exacta (método, path, guards) para toda ruta
   migrada.
5. El JSON de OpenAPI generado es equivalente al de hoy, ruta por ruta, salvo las diferencias que
   migrar hace aparecer a propósito (el shape unificado del 400) — esas se revisan una por una.

## Sub-partes sugeridas — un archivo o grupo afín por vez, nunca las 38 en un commit

Mismo criterio de `SPEC-212`: "los endpoints se re-scopean vertical por vertical, nunca en
big-bang" (D-066). Agrupación sugerida, por tamaño y por riesgo compartido:

| Sub-parte | Archivo(s) | Rutas | Por qué juntos |
|---|---|---|---|
| **§E1** | `profile.routes.ts` + `notifications.routes.ts` | 5 | los dos más chicos, `scopeEnQuery` ya probado en producción (`investor.routes.ts`) — el piloto más bajo riesgo de todo el lote |
| **§E2** | `public.routes.ts` + `auth.routes.ts` | 3 | los dos "primera vez sin sesión" — conviene resolver juntos la pregunta del contexto mixto de `auth.routes.ts` (`$context` opcional) antes de que aparezca en otro lado |
| **§E3** | `audit.routes.ts` + `contracts.routes.ts` | 3 | chicos, sin `.errors()` que fijar (`audit`) o con uno ya soportado por `authorize` sin cambios (`contracts`, la regla `alguna`) |
| **§E4** | `users.routes.ts` | 5 | admin-only, toca bcrypt (🔴) — aislado para que su revisión línea por línea no se mezcle con las demás |
| **§E5** | `stages.routes.ts` | 3 | concentra cuatro de los seis `.errors()` de la tabla — conviene migrarlo con el CLAUDE.md de este subárbol abierto al lado |
| **§E6** | `projects.routes.ts` + `projects-obra.routes.ts` | 12 | comparten prefijo (ver §Prefijo compartido) — no hace falta migrarlos en el mismo commit, pero sí verificar `route-guards.test.ts` después de cada uno |
| **§E7** | `evidence.routes.ts` (7 de 8) | 7 | el más grande, con el único caso de `outputStructure: "detailed"` de todo el lote (`POST /:id/anchor`) — último a propósito, para migrarlo con las seis trampas ya conocidas resueltas en los seis anteriores |

**Orden sugerido: §E1 → §E2 → §E3 → §E4 → §E5 → §E6 → §E7.** De menor a mayor riesgo/tamaño, con las
dos preguntas genuinamente nuevas (contexto mixto en `auth`, el grupo de prefijo compartido)
resueltas temprano, antes de migrar el archivo más grande.

## Casos borde (definen los tests, por sub-parte — mismos que `SPEC-212`)

| Caso | Esperado |
|---|---|
| Ruta del archivo sin migrar todavía (mientras la sub-parte está en curso) | sigue en `REQUEST_SCHEMAS`/`RESPONSE_SCHEMAS`, documentada igual que hoy |
| Body inválido en una ruta migrada | 400 con el shape `ORPCError.toJSON()` |
| Una request que `authorize` ya habría rechazado | 401/403 de `authorize`, oRPC nunca corre |
| `POST /users` con email repetido | 409 `RESOURCE_ALREADY_EXISTS`, sin nombre de tabla/columna en el body — `test/constraint-errors.test.ts` en verde sin cambios |
| `POST /projects` con slug repetido | 409 `RESOURCE_ALREADY_EXISTS` — sin test hoy, se agrega uno nuevo al migrar (ver §Los `.errors()`) |
| `POST /projects/:id/members` con `userId` inventado | 400 `RELATED_RESOURCE_NOT_FOUND` — `test/constraint-errors.test.ts` en verde sin cambios |
| `PATCH /stages/:id/state` pedido por un developer a `Completed`/`Observed` | 403 `STAGE_TRANSITION_FORBIDDEN` — `test/stage-transitions.test.ts` en verde sin cambios |
| `DELETE /evidence/:id` sobre una evidencia anclada | 409 `EVIDENCE_ANCHORED` — `test/spec-210-borrar-evidencia-anclada.test.ts` en verde sin cambios |
| `POST /evidence/:id/anchor` sobre una evidencia ya anclada | 200 con el evento existente, sin gastar una transacción nueva |
| `POST /evidence/:id/anchor` sobre una sin anclar | 201 con el evento nuevo |
| `POST /auth/login` con email inexistente vs. password incorrecta | mismo tiempo de respuesta (orden de magnitud), `test/auth-timing.test.ts` en verde sin cambios |
| `GET /public/dossier/:shareToken` con token inexistente | 404, sin `authenticate` corriendo — sigue siendo el único router sin sesión junto con `/login` |
| `projects.routes.ts` migrado y `projects-obra.routes.ts` sin migrar (o al revés) | `router.use(authenticate)` de los dos archivos sigue idéntico — `route-guards.test.ts` sigue verde |
| `pnpm docs:openapi` tras cada sub-parte | JSON commiteado equivalente; `openapi-freshness` verde |

## Lo que hay que instalar

Nada nuevo — `@orpc/server`, `@orpc/openapi`, `@orpc/zod`, `@orpc/client`, `@orpc/openapi-client` ya
son dependencias de `apps/api` desde `SPEC-212`. Cada sub-parte se revisa línea por línea (🟡), y
§E4 (`users.routes.ts`) además toca superficie 🔴 declarada (bcrypt) — mismo criterio de revisión que
ya aplicó `apps/api/CLAUDE.md` §Superficie 🔴 antes de esta spec.

## Orden

Después de que `SPEC-212` esté completamente cerrada (lo está: las cuatro sub-partes y las dos
investigaciones). No depende de `SPEC-217` ni al revés — son independientes, y `SPEC-217` puede
resolverse antes, después o en paralelo con cualquiera de las sub-partes §E1-§E7 de acá.
