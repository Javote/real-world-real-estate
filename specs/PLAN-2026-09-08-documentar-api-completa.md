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
- **0/70 paths** tienen su path param (`:id`, `:stageNum`, `:fileHash`...) validado con Zod. Hoy se
  documentan como `string` genérico (`z.object({ [p]: z.string() })`, armado automático en
  `generate-openapi.ts`) porque el runtime tampoco los valida — con una excepción a medias:
  `POST /developer/contracts/:id/releases/:stageNum` parsea `stageNum` a mano
  (`Number.parseInt` + un `if`), sin pasar por Zod.
- **0/85 respuestas tienen schema en el documento OpenAPI** — pero **eso no significa que no
  exista ninguno**. Auditado (`grep` de `z.strictObject` en `packages/shared/src` + `satisfies` en
  `apps/api/src/routes`): **ya hay 39 schemas de respuesta reales** (`loginResponseSchema`,
  `dossierSchema`, `developerKpisSchema`, `certifierAssignmentSchema`, `capitalSummarySchema`...) y
  4 rutas ya tipan su respuesta contra uno de ellos con `satisfies` (sin validar en runtime, solo en
  compile-time: `certifier.routes.ts`, `notifications.routes.ts`, `investor.routes.ts`). Una
  estimación de punto de partida, a confirmar en el paso 1 de la Pieza B: **~24 de las 85 ya tienen
  un schema candidato listo para conectar**, sin escribir nada nuevo.

## Dos piezas de trabajo, independientes entre sí

### Pieza A — validar path params con Zod

**Por qué es más que documentación:** hoy un `:stageNum` no numérico o un `:fileHash` mal formado
no los rechaza Zod — los rechaza lo que sea que la query de Kysely haga con un valor inesperado
(un 404 por accidente, no un 400 explicado). Es la regla 6 sin cumplir en 70 paths, no un capricho
del generador.

1. Auditar los path params reales por forma: la mayoría es un id `cuid2` (`Project`, `Stage`,
   `Evidence`, `User`...); `stageNum` es numérico; `fileHash` es hex de 64; `shareToken` es un
   token opaco (¿qué forma tiene hoy? — chequear `dossierShareSchema`/cómo se genera antes de
   fijarle un `regex`, no inventar uno).
2. Un schema por FORMA en `packages/shared` (no uno por ruta) — mismo criterio que
   `passwordSchema`/`userRoleSchema`: `cuidParamSchema`, `numericPathParamSchema`,
   `hexHash64ParamSchema`. Verificar primero cómo se generan los ids (`createId()`,
   `@paralleldrive/cuid2`) para que el schema refleje la forma real, no una inventada.
3. Cada ruta arma su `z.object({ id: cuidParamSchema, ... })` y lo valida con `safeParse(req.params)`
   → 400 si no matchea — mismo patrón que ya existe para body/query.
4. `generate-openapi.ts`: reemplazar el `z.object({[p]: z.string()})` genérico por el schema real
   de cada param, vía una tabla `PARAM_SCHEMAS` paralela a `REQUEST_SCHEMAS` (o fusionada con ella).
5. Test por forma inválida: un `stageNum` no numérico da 400 (hoy probablemente da 400 igual por el
   `if` a mano — verificar que no rompa nada existente); un id que no es `cuid2` sigue sin ser
   explotable (`apps/api/CLAUDE.md` ya lo señala) pero ahora es 400 explicado en vez de un 404 que
   no distingue "mal formado" de "no existe".

**Nivel:** 🟢 en su mayoría — es forma de datos, no la capa de autorización. Si alguna ruta 🟡
(auth/permisos) recibe el cambio, el diff de esa ruta puntual pasa por la revisión que ya le toca
por ser 🟡, no por esto.

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
2. **Tanda 1 — conectar lo que ya existe.** Los ~24 candidatos de la auditoría de arriba: sumar su
   nombre a un `RESPONSE_SCHEMAS` en `generate-openapi.ts` (mismo patrón que `REQUEST_SCHEMAS`) y,
   donde el handler solo tipa con `satisfies` (compile-time), pasar a `.parse()`/`safeParse()` antes
   de responder — cierra la brecha entre "el compilador me lo aseguró" y "lo verifiqué en runtime",
   que es justo la que dejó pasar el agujero de `passwordHash` en su momento. **Un commit, `pnpm
   verify:all` en verde, sin escribir un schema nuevo.**
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

1. Pieza A completa primero — es autocontenida, cierra una validación real (no solo documentación),
   y es más chica.
2. Pieza B, Tanda 1 (conectar los ~24 candidatos) — bajo costo, alto impacto en el número que
   importa para el milestone.
3. Checkpoint con el dueño.
4. Pieza B, Tanda 2, por archivo de rutas, en el orden que sea más simple → más complejo: `profile`,
   `users`, `stages`, `evidence`, `projects`, `certifier`, `notary`, `developer*`, `investor`.

## Qué NO hace este plan, a propósito

- **No agrega `example`/`description` decorativos** a los schemas — eso ya lo cubre parcialmente
  Postman (`EJEMPLOS_CAMINO_FELIZ`) y el criterio de M3 pide "documented", no "con ejemplos".
- **No angosta ni ensancha ningún contrato existente.** Todo schema de respuesta describe lo que el
  handler ya devuelve; una inconsistencia que aparezca al escribirlo es un hallazgo, no algo para
  "arreglar" de paso.
- **No toca `docs/`** (inmutable, D-022) ni inventa un endpoint, campo o estado que `docs/` no pida.
- **No es una migración de `apps/web`** — el front sigue importando solo tipos de `packages/shared`
  (regla de `packages/shared/CLAUDE.md`); nada de esto cambia esa frontera.
