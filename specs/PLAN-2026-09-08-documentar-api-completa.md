# PLAN 2026-09-08 — cerrar "API endpoints documented" de verdad: path params + las 85 respuestas

Acordado con el dueño el 2026-09-08, en la conversación que siguió al generador de OpenAPI
(`specs/openapi/propnexus.openapi.json`, 85 operaciones, 26 con su schema Zod real de body/query).
El dueño señaló que documentar completo las 85 request/response **es un requerimiento literal del
milestone**, no una mejora nice-to-have, y pidió sumar la validación de path params.

Vive acá y no en una memoria porque son ~85 endpoints a auditar en tandas, con un punto de control
con el dueño en el medio — quien lo retome tiene que poder seguirlo sin el chat.

## Qué pide el milestone, literal (docs/, manda)

`docs/milestone-3-implementacion/Milestone-3-info.md`, **Acceptance criteria**:

> API endpoints documented; proof objects validated; rejects unsigned evidence.

Es un trío, y los otros dos ya están cerrados (`specs/README.md` filas 6 y 7): el proof object
devuelve `hash + timestamp + signer` (`GET /evidence/:bundleId/proof/:fileHash`, regla 17), y
`STAGE_EVIDENCE_UNATTRIBUTED` rechaza evidencia autoritativa sin `issuingAuthority`. **Solo el
primero — "documented" — sigue abierto de verdad.**

La sección "Evidence of milestone completion" da como ejemplo *"API docs + test reports (e.g.,
Postman collection)"* — el Postman ya existe y ya cumple la letra mínima. Lo que el dueño pide acá
es ir más allá de la letra mínima: **si "documented" no dice qué formas de entrada y salida tiene
cada endpoint, un reviewer de Catalyst no puede saber qué esperar sin leer el código** — que es
exactamente lo que un documento de API existe para evitar.

## Estado actual, verificado — no asumido

- **85 operaciones** en el OpenAPI, generadas desde el router montado (`route-inventory.ts`).
- **26/26** — el 100% de los `req.body`/`req.query` que el código realmente valida ya resuelven a
  un schema de `packages/shared` (verificado con `grep -rn "safeParse(req\." apps/api/src/routes`,
  cero resultados sin nombre). No hay margen para "subir" este número sin inventar validación que
  no existe.
- ~~**0/70 paths** tienen su path param validado con Zod~~ — **cerrado el 2026-09-08, Pieza A
  completa.** Ver el detalle debajo de esa sección.
- **0/85 respuestas tienen schema en el documento OpenAPI** — pero **eso no significa que no
  exista ninguno**. Auditado (`grep` de `z.strictObject` en `packages/shared/src` + `satisfies` en
  `apps/api/src/routes`): **ya hay 39 schemas de respuesta reales** (`loginResponseSchema`,
  `dossierSchema`, `developerKpisSchema`, `certifierAssignmentSchema`, `capitalSummarySchema`...) y
  4 rutas ya tipan su respuesta contra uno de ellos con `satisfies` (sin validar en runtime, solo en
  compile-time: `certifier.routes.ts`, `notifications.routes.ts`, `investor.routes.ts`). Una
  estimación de punto de partida, a confirmar en el paso 1 de la Pieza B: **~24 de las 85 ya tienen
  un schema candidato listo para conectar**, sin escribir nada nuevo.

## Dos piezas de trabajo, independientes entre sí

### Pieza A — validar path params con Zod — ✅ cerrada el 2026-09-08

**Por qué era más que documentación:** un `:stageNum` no numérico o un `:fileHash` mal formado no
los rechazaba Zod — los rechazaba lo que sea que la query de Kysely hiciera con un valor inesperado
(un 404 por accidente, no un 400 explicado). Era la regla 6 sin cumplir en 51 rutas con params.

**Auditado antes de escribir schemas, no asumido:** los 9 nombres de param del árbol de rutas
(`id`, `projectId`, `stageId`, `contractId`, `unitId`, `bundleId`, `fileHash`, `shareToken`,
`stageNum`) resultaron ser solo **tres formas**. Los seis primeros son `createId()` de
`@paralleldrive/cuid2` — confirmado generando muestras reales, no de la documentación de la
librería: 24 caracteres, minúsculas y dígitos, siempre arrancando con una letra
(`^[a-z][a-z0-9]{23}$`). `fileHash` y `shareToken` comparten forma hex64 **sin compartir origen**:
`fileHash` es `Evidence.sha256Hash` real; `shareToken` es `randomBytes(32).toString("hex")`
(`investor.routes.ts`) — mismo shape, dos cosas distintas, un schema para las dos. `stageNum` es el
único numérico.

**Cómo quedó, y por qué así:** tres schemas por FORMA en `packages/shared/src/params.ts`
(`cuidParamSchema`, `hex64ParamSchema`, `positiveIntParamSchema`) — no uno por ruta ni por nombre de
param. Se conectan con `router.param(nombre, paramValidator(schema))`
(`apps/api/src/middlewares/validate-params.ts`), **no** con un middleware repetido en cada una de
las 51 rutas: Express corre el callback de `router.param` para cualquier ruta de ese router cuyo
path tenga ese nombre, así que un `router.param("id", ...)` por archivo cubre todas sus rutas con
`:id`. 14 archivos de rutas lo declaran (uno o dos `router.param` cada uno, según cuántos nombres de
param usan). **Invisible a propósito para `route-inventory.ts`**: `router.param()` no vive en
`capa.route.stack`, así que ni la matriz de `route-guards.test.ts` ni el handler terminal que lee
`generate-openapi.ts` lo ven — no hay nada que actualizar ahí. `generate-openapi.ts` conoce la forma
real de cada param por su **nombre**, en una tabla aparte (`PARAM_SCHEMAS`), consistente con
`router.param` pero sin depender de introspección.

**Un hallazgo real en el camino:** el `Number.parseInt(v, 10)` a mano que validaba `stageNum`
truncaba `"1.5"` a `1` en silencio — `positiveIntParamSchema` (`z.coerce.number().int().positive()`)
lo rechaza (400), que es lo que la regla 6 exige y el `parseInt` a mano no daba. Se sacó el `if`
redundante del handler; la conversión a número se queda porque el código de negocio la sigue
necesitando.

**Un test tuvo que actualizarse, no romperse:** `dossier.test.ts` → *"un token que no existe es 404
sin más detalle"* usaba `"nope"` como `shareToken` — con la validación nueva eso es 400 (mal
formado), no 404 (no existe), que es justo la distinción que la Pieza A vino a hacer. Se separó en
dos tests: uno con un hex64 bien formado que nunca se generó (404 real) y uno con `"nope"` (400).
Test nuevo dedicado a las tres formas: `apps/api/test/validate-params.test.ts` — cuid2 inválido,
cuid2 válido pero inexistente (sigue dando 404, no se perdió nada), hex64 inválido, entero inválido
(no numérico, negativo, cero) y entero válido.

`pnpm verify:all` completo en verde (37 test files, incluido Aiken) en cada paso.

### Pieza B — schema de respuesta para las 85

**El trabajo real no es "escribir 85 schemas nuevos"** — es auditar cuáles de los 39 que ya existen
sirven tal cual, cuáles necesitan un ajuste chico, y cuáles hay que escribir de cero.

1. **Inventario ruta por ruta** (las 85, agrupadas por los ~18 archivos de `apps/api/src/routes`):
   qué devuelve hoy cada handler — ¿un `type` ya inferido de un schema de `shared` (convertir a
   `satisfies` real o a validación en runtime si no la tiene)? ¿un objeto armado a mano en el
   handler (schematizar desde cero, en `shared`, ANTES del endpoint — regla 6)? ¿el resultado crudo
   de una fila de Kysely con spread (`{ ...stage, evidences, project }` — el caso más común y el
   más peligroso: un campo nuevo de la tabla se filtra solo si no hay un schema estricto que lo
   corte, como ya pasó una vez con `passwordHash`)?
2. **Tanda 1 — conectar lo que ya existe — ✅ cerrada el 2026-09-08.** 24 endpoints (contra la
   estimación de ~24), verificados uno por uno leyendo el `SELECT`/objeto real del handler contra
   el schema candidato antes de conectarlo — no por nombre. Los que solo tipaban con `satisfies` o
   con una anotación de tipo (`const x: Foo = {...}`) pasaron a `schema.parse({...})`: cierra la
   brecha entre "el compilador me lo aseguró" (una anotación de tipo no impide un campo de más si el
   objeto se arma con spread) y "lo verifiqué en runtime", que es justo la que dejó pasar el
   agujero de `passwordHash` en su momento. Se sumó `paginatedResponseSchema(item)` a
   `packages/shared/src/pagination.ts` para la forma `{ items, nextCursor }` que comparten
   certificados, firmas y (a futuro) audit-log — una función, no un schema fijo, porque cada
   superficie pagina un item distinto.

   **Tres hallazgos, ninguno corregido — se preguntan antes de tocar nada:**
   - `projectSummarySchema` (`panels.ts`) **no lo usa ningún endpoint** — cero resultados
     grepeando `ProjectSummary`/`projectSummarySchema` en `apps/api` y `apps/web`. Parece escrito
     para la superficie "Buy" del investor (fila 02) y el endpoint real que la sirve, si existe,
     usa otros nombres de campo. ¿Se borra, o falta conectarlo a un endpoint que todavía no se
     escribió?
   - `notaryKpisSchema` marca sus 4 campos `.nullable()` con un comentario que dice *"los cuatro
     son null hoy"* — pero el commit del 2026-09-08 documentado en `CLAUDE.md` raíz dice
     explícitamente *"Ya no son `null`"* y el handler siempre manda números. El schema no está mal
     (nullable admite number igual), pero el comentario está desactualizado.
   - `PATCH /profile/notifications` devuelve el merge parcial tal cual se guarda (`combinadas`),
     que **no siempre tiene las 5 claves** — un primer PATCH con `{stage:false}` devuelve
     `{stage:false}`, no las 5. Conectar `notificationPrefsSchema` ahí completaría las 4 faltantes
     con su default `true` en la RESPUESTA sin cambiar lo que se guarda, que es un cambio de
     comportamiento real (aunque para mejor) — no se tocó en Tanda 1 por eso, queda para decidir en
     Tanda 2.

   `pnpm verify:all` completo en verde (37 test files, incluido Aiken) — ningún `.parse()` tiró en
   ninguno de los 24, que es la prueba de que el objeto real y el schema candidato de verdad
   coincidían y no solo por nombre.
3. **Punto de control con el dueño**, acá — antes de escalar a las ~60 rutas restantes: elegir 1-2
   endpoints chicos de la Tanda 2 (ej. `profile.routes.ts`, 3 endpoints) como ejemplo del nivel de
   detalle esperado, y confirmar que es el que el dueño espera antes de replicarlo.
4. **Tanda 2 — escribir lo que falta.** Por archivo de rutas (mismo criterio que "el loop, por
   pantalla" del `CLAUDE.md` raíz, aplicado a rutas): schema en `packages/shared` primero, el
   handler valida su propia respuesta antes de responder, `generate-openapi.ts` lo conecta. Un
   commit por archivo (o por grupo de archivos chicos), cada uno con su `pnpm verify:all`.
5. **Regla dura de todo el proceso: describir lo que el handler devuelve HOY, nunca lo que
   "debería" devolver.** Si al escribir un schema aparece un campo de más, uno de menos, o una
   inconsistencia real entre dos endpoints que devuelven "lo mismo" con forma distinta, **eso es un
   hallazgo aparte** — se documenta y se pregunta antes de tocar el contrato (jerarquía de
   precedencia, `CLAUDE.md` raíz: nunca "corregir" por conveniencia en medio de un refactor que
   promete no cambiar comportamiento).

**Nivel:** 🟢 en su mayoría (escribir un schema que describe una forma existente); 🟡 si tocar una
respuesta obliga a auditar de nuevo qué campos son seguros de exponer en una superficie sensible
(evidencia, dossier) — no porque cambie la autorización, sino porque escribir `z.strictObject` a
mano es el momento en que más fácil es notar un campo que no debería viajar (regla 2, regla 16).

## Orden sugerido

1. ~~Pieza A completa primero~~ — ✅ cerrada el 2026-09-08.
2. ~~Pieza B, Tanda 1 (conectar los ~24 candidatos)~~ — ✅ cerrada el 2026-09-08.
3. **Checkpoint con el dueño — pendiente.** Antes de escalar a las ~61 rutas de la Tanda 2: resolver
   los tres hallazgos de arriba, y confirmar el nivel de detalle esperado sobre 1-2 endpoints chicos.
4. Pieza B, Tanda 2, por archivo de rutas, en el orden que sea más simple → más complejo: `profile`
   (falta solo `/notifications`), `users`, `stages`, `evidence`, `projects`, `certifier` (falta
   `certify`/`observe`), `notary` (falta `sign`/`reject`), `developer*`, `investor`.

## Qué NO hace este plan, a propósito

- **No agrega `example`/`description` decorativos** a los schemas — eso ya lo cubre parcialmente
  Postman (`EJEMPLOS_CAMINO_FELIZ`) y el criterio de M3 pide "documented", no "con ejemplos".
- **No angosta ni ensancha ningún contrato existente.** Todo schema de respuesta describe lo que el
  handler ya devuelve; una inconsistencia que aparezca al escribirlo es un hallazgo, no algo para
  "arreglar" de paso.
- **No toca `docs/`** (inmutable, D-022) ni inventa un endpoint, campo o estado que `docs/` no pida.
- **No es una migración de `apps/web`** — el front sigue importando solo tipos de `packages/shared`
  (regla de `packages/shared/CLAUDE.md`); nada de esto cambia esa frontera.
