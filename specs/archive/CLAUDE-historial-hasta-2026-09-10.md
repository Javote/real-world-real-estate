# Historial de `CLAUDE.md` raíz — cerrado hasta el 2026-09-10

> Este archivo existe porque la propia regla de `CLAUDE.md` lo pide: *"Acá solo hay información
> vigente. El porqué de cada decisión está en `DECISIONS.md`; el argumento largo, en
> `specs/archive/`."* Este bloque era la narración día a día de todo lo que se fue cerrando entre el
> 2026-09-01 y el 2026-09-08 — vivió en `CLAUDE.md` bajo `§Estado, y lo próximo` hasta el 2026-09-10,
> cuando se movió acá para que la raíz vuelva a cargar solo lo que falta, no todo lo que ya se hizo.
>
> **Sigue siendo válido tal cual** — nada de esto quedó obsoleto, solo dejó de ser "lo próximo".
> Las decisiones que sostiene siguen vigentes en `DECISIONS.md`; los detalles de implementación y
> las trampas que dejó, en el `CLAUDE.md` de cada frente (`apps/api/CLAUDE.md`,
> `apps/web/CLAUDE.md`, `packages/cardano/CLAUDE.md`). Este archivo es la crónica completa, para
> cuando haga falta reconstruir el *por qué* de una decisión ya tomada.
>
> El estado vigente de la entrega vive en `CLAUDE.md` raíz (`§El plan de entrega del Milestone 3`) y
> en `specs/ESTADO-2026-09-10-catalyst-milestone-3.md` (el contraste contra los 5 Outputs oficiales
> de Catalyst).

---

**La instancia desplegada ancló de verdad por primera vez el 2026-09-03**, contra Cardano Preprod:
`OnChainEvent` tiene su primera fila, `Confirmed`, con TXID real
(`52a2aa42…f2f7aaf406`). Arrancar en real era configuración; esto ya es prueba. Lo que se hizo para
llegar está en `DECISIONS.md` (D-075 → D-087) y en `specs/PLAN-2026-08-31-anclaje-real.md`; los
números medidos, en `specs/README.md`. Acá solo lo que falta.

| # | Qué | Por qué ahí | Nivel |
|---|---|---|---|
| 0 | **Prueba end-to-end de volumen, en preprod, antes de mainnet** (pedido del dueño, 2026-09-09): desde el front, crear varios proyectos nuevos, completar los 10 stages del template con evidencia real cada uno, y llevar cada stage por **todas** las transiciones posibles de la FSM (`Pending → InProgress → Observed → InProgress → Completed`) — no solo un camino feliz por stage, como hasta ahora. El presupuesto ya está medido (**~35 ADA por proyecto**, ≈15 de fee + 20 bloqueadas, ~1% del balance de la wallet de servicio — ver §El plan de entrega, "Al final"); lo que falta es correrla. | Es la validación final de volumen que falta antes de habilitar mainnet: hasta ahora cada arista de la FSM se probó una vez, sobre un stage aislado — nunca las cuatro juntas, en los 10 stages de un proyecto real, repetido en más de un proyecto. Además alimenta los criterios 8, 9 y 15 del SOM | 🟡 |
| 1 | **Mainnet** — runbook, habilitar la red, custodia de la clave. **Fuera de alcance de este milestone** (decisión del dueño, 2026-09-09 — ver §El plan de entrega) | D-013 la hace **imposible por configuración**: es código, no solo procedimiento | 🔴 |

**El "Stage template" (ex-#1) se cerró el 2026-09-08** — las dos decisiones del dueño que lo
bloqueaban (nombrar las 10 etapas, el mecanismo de anclaje) están resueltas y construidas. Detalle
completo más abajo, en el cierre del mismo día.

**Encontrados el 2026-09-04, probando el flujo real end-to-end contra producción** (login con las
credenciales del re-seed, crear un proyecto, subir y anclar evidencia — vía Claude en Chrome, no un
test). Detalle en `apps/web/CLAUDE.md` §Trampas verificadas.

**Cerrados el 2026-09-01:** el reference script (D-083) y su cobertura contra un nodo real; `network`
e `issuingAuthority`, aplicadas en producción **sin dejar de tener un solo archivo de migración**
(D-085); y D-028, acotada por D-084 y D-086.

**Cerrados el 2026-09-03:** el re-seed de producción — 5 cuentas demo sembradas contra Turso
(`admin@`, `developer@`, `buyer@`, `verifier@`, `notary@example.com`), verificado con
`select email from User`; la **publicación operativa** del reference script en Preprod
(`pnpm --filter @plataforma/cardano ref:publish`, txid `3c75280a…0ba2c7f1`, confirmado on-chain,
API reiniciada a las 15:26 UTC); el **primer anclaje real por metadata**: `developer@example.com`
subió evidencia al stage "Estructura" de `torre-a`
(`POST /developer/projects/:id/stages/:stageId/evidence`), root del bundle anclado, `POST
/evidence/reconcile` lo confirmó — TXID `52a2aa4214…f7aaf406`; y el **primer anclaje real de
state-thread**, el otro camino que D-083 existe para abaratar: se creó un stage nuevo
("Terminaciones", `POST /projects/:id/stages`, mint del thread token) y se transicionó
Pending→InProgress (`PATCH /stages/:id/state`, gasta y recrea el hilo). **Las dos transacciones
referenciaron el UTxO publicado en vez de adjuntar el validador** — verificado leyendo los inputs de
cada una en Blockfrost (`reference: true` sobre el UTxO `3c75280a…0ba2c7f1#0`), no solo por
tamaño/fee. D-083 queda confirmado en producción en sus dos caminos.

```
mint     (STAGE_CREATED)     650 bytes · 0.229280 ADA · 21bae8cb…c294970
advance  (STAGE_TRANSITION)  645 bytes · 0.238122 ADA · b28eb6cf…36a0dbe
```

**El security review del criterio 11, corrido.** Auditoría completa de `apps/api`, `packages/cardano`,
`packages/shared` y los validadores Aiken contra las reglas duras de este archivo. Un hallazgo real:
`GET /evidence/:bundleId/proof/:fileHash` y `GET /evidence/:bundleId/files` no tenían la segunda capa
de autorización (regla 5) — cualquier usuario autenticado, sin importar su membresía, podía leer el
Merkle root, los hashes y los nombres de archivo de un bundle de evidencia ajeno conociendo su
`bundleId`. Cerrado en el mismo commit: `ProjectSource` suma `via: "EvidenceBundle"` y ambas rutas
piden `requireProjectAccess`. Detalle y la lección en `apps/api/CLAUDE.md`.

**Trampa encontrada al hacerlo, y dos arreglos que salieron de ahí.** Un stage sembrado directo en
la base (como `Cimentación`/`Estructura` de `torre-a`) **no tiene hilo on-chain** — el mint solo
ocurre en `POST /projects/:id/stages`. Un `PATCH .../state` sobre uno de esos stages no falla la
request (la declaración se escribe igual, D-059) pero el anclaje queda `Failed` en silencio, porque
`advanceThread` no encuentra ningún UTxO que gastar. Por eso el primer anclaje de state-thread se
hizo sobre un stage **nuevo**, no sobre los dos que ya existían. Se agregó
`POST .../stages/:stageId/retry-anchor` para el caso legítimo —un mint que falló de verdad sobre un
stage que sigue en `Pending`— y `hasOnChainThread` (calculado) en las lecturas de stage, para que la
pregunta se conteste mirando la respuesta y no auditando el código. De paso salió un bug de verdad,
ya cerrado: `tieneHiloAnclado` bloqueaba la identidad de un stage con cualquier anclaje, incluida
evidencia por metadata que nunca toca el validador. Los tres, con tests, en `apps/api/CLAUDE.md`.

**Defensa 3, cerrada el 2026-09-03 (D-087).** El simulador devolvía `Confirmed` directo desde
`openThread`/`advanceThread`/`anchorCommitment`; el adaptador real siempre devolvió `Pending`. Ahora
los dos declaran `Pending` siempre, y `Confirmed` sale únicamente de un chequeo aparte
(`verify()`/`confirmedAt()`) que el código de la API ya hacía para el hilo y ahora también hace para
metadata. Ningún test cambió: el chequeo sigue encontrando el anclaje simulado al toque, solo que ya
no es el recibo el que lo afirma. Detalle en `DECISIONS.md` (D-087) y `packages/cardano/CLAUDE.md`.

**Las "7 superficies" no existían — `specs/README.md` estaba desactualizado.** Auditado contra el
código el 2026-09-03: las 53 superficies del backlog (`docs/milestone-3-implementacion/
UI-implementation-plan.md` §4-6) tienen su ruta o modal, sus 68 endpoints únicos existen en
`apps/api/src/routes`, y los 10 patrones M2-D4 están en uso. Test IDs: 74/74 —
`DEV-RELEASE-EXECUTE-002` queda excluido del conteo (D-070: decisión permanente, no backlog). No
verificado fila por fila: que cada patrón esté *bien* aplicado donde corresponde, solo que está
presente y en uso en algún lugar. `specs/README.md` corregido en el mismo commit.

**Cerrado el 2026-09-04 · la matriz de permisos dejó de auditarse a ojo.** El security review del
criterio 11 y el `notary` que no se podía dar de alta son el mismo modo de falla: una ruta que no
declara su guard compila, pasa los tests y sirve el happy path. Con 87 handlers en 18 archivos, la
auditoría a mano no escala ni se repite. `apps/api/test/route-guards.test.ts` recorre los routers
**ya montados** y reconstruye la matriz de las 87 rutas —método, path absoluto y cadena de guards
declarados— contra un literal en el propio test: una ruta nueva o un guard que cambia lo ponen rojo
hasta que alguien actualice el literal, y actualizarlo **es** la revisión. Lo sostienen `GUARD` (un
símbolo global que `requireRole` y `requireProjectAccess` le cuelgan a la closure que devuelven) y
`MONTAJE` (el montaje de `app.ts` como tabla, porque Express 5 compila el path de montaje a un
matcher y tira el string — comprobado leyendo el `Layer`, no supuesto). Más tres invariantes
hermanas: sesión obligatoria salvo las dos rutas públicas declaradas, ninguna lista de roles o
membresías vacía, y **los routers que comparten prefijo declaran los mismos guards de router** —
el bug del 2026-08-24 convertido en invariante, que hasta hoy se sostenía solo por disciplina.
**No es el escáner que borró D-053:** aquel grepeaba el fuente y adivinaba; este interroga el router
que Express armó, con los middlewares que van a correr. Y se verificó rompiéndolo —tres mutaciones,
las tres en rojo, las tres revertidas—, no viéndolo verde. El detalle está en `apps/api/CLAUDE.md`
§La matriz de permisos.

**Lo que eso destapó, y se cerró el mismo día: la tercera capa existe.** La matriz asienta los guards
**declarados**, no que la autorización sea correcta, y dejó a la vista un tercer patrón que vivía sin
forma: autorizar **adentro** del handler. Ninguna de esas rutas estaba abierta —se auditaron una por
una— pero su regla no se leía en la firma, no la protegía el compilador y no la veía el test nuevo.
Ahora hay un `requireOwnership` hermano de los otros dos guards, con tres formas de `OwnerSource`
(`Unit`, `Invitation` —que compara contra el **email**, porque la invitación existe antes que la
cuenta— y `ContractOfUnit`, que resuelve la fila por `unitId` y no por su clave primaria). **Nueve
rutas del investor** pasaron el `if` copiado a la firma, con el bypass de `admin` y la regla de que
un dueño `null` es 403 en un solo lugar cada uno. Verificado neutralizando el guard: 7 de 13 tests
en rojo, todos los de rechazo.

**Y corrige algo que este archivo afirmó de más ayer.** Decía "~20 rutas de `investor` y `notary`":
`notary` **no era candidato**. Sus rutas de dossier no tienen regla de pertenencia y no es un olvido
—el dossier pendiente es una cola de trabajo compartida, cualquier notary firma cualquiera— y lo que
sus listados hacen con `signedById` es acotar la vista, que es scope y no autorización. **Antes de
subir un filtro a la firma, preguntá si es una regla de acceso o un criterio de listado.** Queda una
sola ruta autorizando adentro a propósito: `GET /contracts/:contractId/releases`, cuya regla es
*dueño **o** miembro del proyecto* — una disyunción, y una cadena de middlewares es una conjunción.
El combinador se escribe el día que aparezca la segunda, no antes. Todo en `apps/api/CLAUDE.md`
§La tercera capa.

**Abierto, y es decisión del dueño, no una tarea pendiente.** El JWT dura 7 días y no se puede
revocar de a uno. La revocación que existe es gruesa: `authenticate()` reconsulta la base en cada
request, así que dar de baja una cuenta corta sus sesiones al instante; lo que no hay es invalidar
**un** token sin dar de baja al usuario. Cerrarlo pide refresh tokens con store de revocación —tabla,
endpoint y front—, o sea infraestructura para un problema que todavía no duele. Se dejó afuera a
propósito. Lo que sí se hizo el 2026-09-04: `signToken`/`verifyToken` fijan **HS256 explícito** de
los dos lados. No había agujero —con un secreto de tipo string, jsonwebtoken v9 ya acota la
verificación a la familia HS*—; lo que se cierra es la dependencia de ese default para el día que la
clave deje de ser un string.

**Y cerrado el mismo día: una sola forma de declarar autorización (D-088).** Las tres capas dejaron
de ser tres middlewares encadenados y pasaron a ser `authorize({ roles, acceso })`, con los dos
campos obligatorios; **las 87 rutas montadas lo declaran**, y las únicas dos sin él son las dos sin
sesión que M2-D5 §2.2 declara. El motivo es uno y no conviene inflarlo: no es que las tres hicieran
lo mismo ni que se lea mejor, es que **nada obligaba a declarar la pertenencia** — y esa jugada,
hacer que omitir no compile, es la misma de D-042, que con middlewares sueltos no se podía repetir
porque *la ausencia de una llamada no es un tipo*. De yapa, `{ alguna: [...] }` expresó la
disyunción que una cadena de middlewares no puede, y `GET /contracts/:contractId/releases` dejó de
autorizar adentro del handler: **ya no queda ninguna ruta que lo haga**. `requireRole`,
`requireProjectAccess` y `requireOwnership` se borraron. Ninguna ruta ganó ni perdió acceso, y eso
se probó, no se afirmó: 275 tests en verde y la matriz equivalente ruta por ruta en cada uno de los
seis pasos. Se pudo hacer recién ahora porque `SPEC-012` prohíbe cambiar semántica de seguridad
adentro de un refactor y hasta que existió la matriz no había forma de *probar* que un refactor no
la cambiaba — matriz → `requireOwnership` → unificación, cada paso habilita el siguiente.

**Y la partición que faltaba, hecha el mismo día.** `"soloRol"` quedaba en 45 de 87 rutas y **26
mentían**: los listados se acotan con `where userId = ...` o `projectScope(...)` adentro del query,
así que decir "no hay regla de fila" se leía como una revisión hecha. Esas 26 declaran ahora
`{ scopeEnQuery: "<el filtro>" }`, con un test que exige que el texto no esté vacío — si la etiqueta
pudiera quedar en blanco, sería `"soloRol"` con otro nombre. Reparto final: `"soloRol"` 19 ·
`{ scopeEnQuery }` 26 · `{ proyecto }` 30 · `{ dueño }` 9 · `{ alguna }` 1 · sin sesión 2.

**Etiquetar obliga a leer el handler, y así apareció un agujero real, ya cerrado.**
`GET /developer/audit-log` devolvía el `AuditLog` **entero**, sin acotar por proyecto, con
`actorName` y `actorRole` de cada usuario del sistema: un developer con membresía en un proyecto veía
los eventos de todos los demás. Es la regla 5 sin su segunda capa, misma familia que el agujero de
`GET /evidence/:bundleId/files`, y ninguna herramienta lo iba a marcar. **No era una decisión de
producto abierta —el entregable ya la tenía tomada**: M2-D1 §4 dice *"developer sees project-scoped
events"* y M2-D4 §P6 *"all events scoped to that developer's projects"*. Se cerró con `auditScope`,
una condición de Kysely hermana de `projectScope` que resuelve `entityType`/`entityId` → proyecto y
**es fail-closed**: un `entityType` que nadie mapeó no se muestra, en vez de mostrarse a todos.
`User` queda afuera por diseño. La forma que corresponde de verdad es una columna `projectId` en
`AuditLog` —sin joins y sin mapeo que se pueda olvidar—, y está anotada para el día que se toque el
esquema: hoy pediría la primera migración sobre una base desplegada (D-063) y un backfill que para
varias filas viejas no tiene respuesta.

**Cerrado el 2026-09-08 · observabilidad real en producción (Sentry + OTel → Grafana Cloud).** Las
env vars de `render.yaml` (`SENTRY_DSN`, `OTEL_EXPORTER_OTLP_ENDPOINT`/`_HEADERS`,
`VITE_SENTRY_DSN`, `VITE_POSTHOG_KEY`/`_HOST`) se cargaron a mano en el dashboard y se verificó
traces reales de `propnexus-api` en Tempo, no solo que el proceso arrancara diciendo "activo". En el
camino, dos incidentes de producción real: `@opentelemetry/api` sin declarar como dependencia
directa tumbó el deploy con `MODULE_NOT_FOUND` (un `require()` sin tipar no lo agarra `tsc` ni una
instalación local con `node_modules` viejo), y Sentry (v10) registrando sus propios globals de OTel
antes que el `NodeSDK` propio dejaba los traces cayendo en silencio pese a que el deploy quedaba
`live` — el bug no se hubiera visto sin agregar `diag.setLogger` primero. Los tres fixes, el smoke
test de CI que ahora corre el `startCommand` real contra el build compilado, y el detalle completo
de por qué el asistente de Grafana genera el header OTLP incompleto, están en `apps/api/CLAUDE.md`
§Trampas verificadas y `specs/RUNBOOK-deploy.md` §4. De yapa: un warning de Vite por un chunk de
619kB en el build del web (React + TanStack + Sentry/PostHog + Radix todo junto) se resolvió
separando vendor chunks — sin relación con lo anterior, encontrado en el mismo log que se estaba
revisando.

**Cerrado el 2026-09-08 · sidebar de desktop (pendiente #1 de la tabla).** `components/domain/Sidebar.tsx`
reemplaza a `BottomNav` en desktop (`md:flex` vs `md:hidden`, nunca los dos juntos), reusando
`NAV_TABS` sin duplicar la navegación por rol — mismo `tabNeedsExactMatch` que ya tenía `BottomNav`.
El activo se pinta como píldora sólida `bg-primary`, no solo texto: la captura 61 es la única
referencia de desktop en todo el catálogo y ahí el tratamiento es visualmente más fuerte que el
`BottomNav`, así que gana la captura (regla 1). Verificado con Chrome en 1440px (sidebar visible,
activo cambia de tab al navegar) y en 390px (sidebar ausente, `BottomNav` sin regresión) — las dos
capturas contra la instancia local, no solo `pnpm test`. 144 tests verdes.

**Y de paso, auditado el resto de las 53 superficies contra M2-D5** — no solo el sidebar. Ninguna
falta ni es un stub (la auditoría del 2026-09-03 tenía razón en eso), pero 9 reemplazan un componente
que la fila nombra por otro distinto sin dejar una decisión escrita, mismo patrón silencioso que el
sidebar. De esas 9, una auditoría más profunda separó 6 falsos positivos (ya documentados en el
código) y 1 de forma de **2 reales**, cerrados el mismo día — ver el párrafo siguiente. También se
cruzaron las 70 capturas contra las 51 filas de M2-D5: solo 3 sin fila (59, 60 — gap de contrato ya
documentado, no nuevo — y 61, el sidebar de arriba).

**Cerrado el 2026-09-08 · los dos hallazgos reales de esa auditoría, sin componentes nuevos.**
`/notary/dossier/:dossierId` cambió el ícono de color-solo por `VerificationBadge` (texto + color)
por artefacto — cierra la violación de M2-D3 §Accessibility. `/investor/unit/:unitId/dossier` sumó
un `ProgressTimeline` real (mismos datos que ya usa `getInvestorUnit` en `/investor/unit/:unitId`,
sin query nueva del backend) y `VerificationBadge` por artefacto. **Lo que no se cerró, a propósito:**
`DocumentCard` completo (nombre, fecha, formato) sigue sin poder armarse — `dossierArtifactSchema`
no tiene esos campos y no se inventan (regla 17). Es deuda de contrato declarada, no una tarea
pendiente de UI. Verificado con Chrome logueado como notary e investor contra la instancia local,
144 tests verdes.

**Probado el 2026-09-08 · flujo real de punta a punta contra producción, vía Claude en Chrome —
crear proyecto, subir evidencia, hashear, anclar, verificar.** Crear un proyecto nuevo confirmó en
vivo lo que dice el pendiente #1: sin stages no hay dónde subir evidencia (`/upload` muestra el
selector de etapa vacío). Se usó `torre-a`, etapa "Terminaciones" (la del hilo on-chain real de
D-083), con un PDF de texto real generado con `pandoc`. El anclaje devolvió Merkle root
`8afbf1…4e5e` y **TXID real `ae521653fd9ba003160a9f48a2dfc9a799ee5b3936cbe5fcb8ba6654a793bb8d`**.
Verificado por dos vías independientes: el hash SHA-256 que muestra `/developer/documentation`
(`a10b33…eb5b`) coincide **exacto** con el que se calculó en local antes de subir el archivo — no
se confió en que "dice verificado", se comparó el hash real. La verificación pública en
`preprod.cardanoscan.io` quedó bloqueada por un challenge de Cloudflare que no se resolvió (no
está permitido resolver CAPTCHAs) — el TXID queda anotado arriba para que el dueño lo confirme a
mano cuando quiera. Ver también `specs/README.md` criterio 15.

**Probado el 2026-09-08 · segunda transición real de state-thread — `InProgress → Completed`, vía
la única superficie de UI que existe para eso, con verificación independiente en el explorador.**
Continuación del anclaje del 2026-09-03 (D-083): ese cerró `Pending → InProgress` llamando a la API
directo; esta sesión cerró el siguiente tramo de la FSM (`packages/shared/src/stage.ts`) **desde el
navegador**, con las dos cuentas demo que el flujo real exige.

**Primer hallazgo: no hay pantalla de developer para transicionar un stage.**
`api/port.ts` expone `setMilestoneState` (`PATCH /stages/:id/state`) pero **ningún componente lo
llama** — se verificó con `grep -rln "setMilestoneState" apps/web/src`, un solo resultado, el propio
port. La única superficie real que mueve la FSM hacia adelante es la del **certifier**
(`certifier.stage.$stageId.tsx`, M2-D5 filas 56c/57): "Certificar" (`POST
/certifier/stages/:id/certify` → `Completed`) y "Observar" (`POST /certifier/stages/:id/observe` →
`Observed`), las dos delegando en `transitionStage` del lado del servidor. No es una pantalla
faltante — es la forma en que el dominio modela quién tiene autoridad para cerrar una etapa, y
coincide con lo que documenta `apps/api/CLAUDE.md` sobre esa ruta.

**El flujo, de punta a punta:**

1. **Developer** (`developer@example.com`) sube evidencia real a "Terminaciones" de `torre-a`
   (`POST /developer/projects/:id/stages/:stageId/evidence`, vía `/developer/project/:id/upload`),
   un PDF generado con `pandoc`. Merkle root `c66436…bfe4`, **TXID real
   `9cca08777b9ab8c44792c3afaacdc06d899d7f15ded743306c94483d3c0fa4d6`**, confirmado en
   `preprod.cardanoscan.io` sin bloqueo de Cloudflare esta vez (a diferencia del intento del
   2026-09-08 anterior). Hash local (`shasum -a 256`) coincidió exacto con el que mostró la app antes
   de anclar.
2. **Certifier** (`verifier@example.com`, con membresía `verifier` en `torre-a` desde el seed) entra
   a `/certifier`. El panel mostró **"No tenés etapas asignadas"** en el primer render — no es un
   bug: `GET /certifier/assignments` filtra `Stage.state in (InProgress, Observed)` dentro de los
   proyectos donde el usuario es miembro (`apps/api/CLAUDE.md` §`certifier.routes.ts`: "asignado" es,
   por ahora, cualquier stage en curso de un proyecto propio — no hay tabla de asignación explícita
   todavía), y el `useQuery` de React Query simplemente no había resuelto en la primera screenshot. Un
   refresh la mostró.
3. **"Certificar" estaba deshabilitado** hasta que hubo evidencia (`sinEvidencia` en el componente) —
   la pantalla lo explica en vez de esconder el botón, tal como documenta su comentario de cabecera.
   Con la evidencia del paso 1 puesta, el botón se habilitó y el click disparó `certify`.
4. **TXID real de la transición:
   `e842c8acb07dfd1b551a1a8d2318e12d9915d40aa69ebcf86d3842759571fe22`**, confirmado en
   `preprod.cardanoscan.io` (16 confirmaciones al momento de verificar). La pestaña "Entradas de
   Referencia" de la transacción muestra `3c75280a9205b3d8…735396f0ba2c7f1 #0` — el mismo UTxO del
   reference script publicado en D-083 — confirmando que esta transacción **referencia** el
   validador en vez de adjuntarlo, igual que las dos transacciones del 2026-09-03.

**Verificado también que el stage quedó `Completed` sin abrir la base:** el panel del certifier pasó
de "2 Asignadas" a "1 Asignada" y de "1 Certificada" a "2 Certificadas" apenas terminó el `certify`,
y `/certifier/issued` lista las cuatro evidencias del bundle (incluida la nueva) con el mismo TXID de
certificación repetido — consistente con que el commitment ancla el bundle completo, no archivo por
archivo.

**Trampa nueva, para cuando haga falta el TXID completo desde la UI:** `HashChip` trunca en el
**dato**, no solo en CSS — ni `read_page` ni `get_page_text` ni los atributos `title`/`aria-label`
tienen el hash completo en el DOM, porque el componente nunca lo escribe entero; solo el handler de
"Copiar" lo tiene en un closure y lo manda al portapapeles. `navigator.clipboard.readText()` vía
`javascript_tool` **cuelga indefinidamente** (timeout a los 45s) en este entorno de automatización —
aparentemente el prompt de permiso de lectura del portapapeles de la extensión nunca se resuelve
solo. **Lo que funcionó:** click en "Copiar" y después pegar (`cmd+v`) en el buscador de
`preprod.cardanoscan.io`, que sí acepta foco y pegado normales — de ahí salieron los dos hashes
completos de esta entrada.

**Estado de la FSM, probado en vivo hasta ahora:** `Pending → InProgress` (2026-09-03, por API) e
`InProgress → Completed` (hoy, por la UI real del certifier). Quedan sin probar en vivo
`InProgress → Observed` (mismo botón "Observar" de esta misma pantalla) y el retorno
`Observed → InProgress`; la lógica está cubierta por tests, solo falta ejercitarla contra Preprod.

**Cerrado el mismo día — agujero real, encontrado al chequear si el reparto de roles de esta prueba
era el correcto.** La pregunta fue *"¿el certifier certifica, o certifica el developer?"*; la
matriz de permisos de `M2-D1` es tajante (`Stage certification`/`Stage observation`:
**"Certifier-exclusive action"**) y el código no la cumplía: un developer podía `PATCH
/stages/:id/state` con `{state:"Completed"}` sobre su propio stage y auto-certificarse, sin pasar
por el certifier. Cerrado con un chequeo de rol antes de tocar la FSM (403
`STAGE_TRANSITION_FORBIDDEN` si no es `admin` y el estado pedido no es `InProgress`); admin sin
límite, developer conserva `→ InProgress` (arrancar y reanudar tras una observación). 305 tests
verdes, `pnpm verify:all` completo (incluido Aiken) también verde. Detalle, por qué no es un guard
de `authorize()`, y qué tests se movieron a `admin`: `apps/api/CLAUDE.md` §El endpoint de estado de
stages.

**Y eso destapó una pregunta más profunda, del dueño: "¿no todas las transiciones de la FSM se
pueden hacer desde el frontend?"** Cierto — verificado grepeando `apps/web/src` entero: el literal
`"InProgress"` no aparecía ni una vez, en ningún componente. De las 4 aristas, solo 2 tenían botón
(`InProgress → Completed`/`Observed`, certifier); las dos que **entran** a `InProgress`
(`Pending → InProgress`, `Observed → InProgress`) no tenían ninguna pantalla, para nadie — ni
siquiera existe una superficie en M2-D5 que las mencione. No es un bug de implementación: es que
nadie había definido el mecanismo.

**Cerrado el mismo día, con dos mecanismos distintos** — porque el diagrama canónico
(`M1-D2-Architecture-and-Data-Models/3-milestone-lifecycle.puml`, el único con las flechas
correctas) etiqueta las dos aristas distinto, y esa etiqueta importa:

- **`Pending → InProgress` : "work initiated" → automático.** La primera evidencia que un developer
  sube a un stage `Pending` (`POST /developer/projects/:id/stages/:stageId/evidence`) dispara
  `transitionStage(→ InProgress)` server-side, sin botón: subir el archivo **es** la señal de que
  el trabajo arrancó. No hace falta inventar una pantalla para decir lo que la acción que ya existe
  ya dice.
- **`Observed → InProgress` : "remediation completed" → manual, a propósito.** Acá NO alcanza con
  "subieron algo": el developer tiene que decidir explícitamente que la corrección está lista, no
  que cualquier archivo nuevo reabra el stage solo. Nueva sección "Etapas observadas" en
  `/developer/progress` (`DEV-PROGRESS-RESUME`, fuera del esquema `ROL-ÁREA-NNN` de M2-D5 a
  propósito — `scripts/check-testids.mjs` rechaza cualquier ID con esa forma que el entregable no
  declare, y está bien que lo haga: esto no es una fila de M2-D5, es una decisión nueva y tiene que
  distinguirse) con botón "Reanudar etapa", que llama al mismo `PATCH /stages/:id/state` ya
  restringido del punto anterior — el developer solo puede pedir `→ InProgress`, que es exactamente
  lo único que esta pantalla necesita.

**Por qué ninguna de las dos vive en `/developer/project/:id/upload`, que hubiera sido el lugar
obvio:** esa pantalla es "la estructura sale de la captura" (38-DEVELOPER-SPECIFIC-PROJECT-UPLOAD-
EVIDENCE) — meterle un botón de estado sería la regla 1 al revés (la captura no lo muestra, y acá
no hay excepción D-074 que lo permita). `/developer/progress` no está atada a ninguna captura
pixel-perfect, así que es terreno legítimo para una decisión nueva sin pisar una ya tomada.

Tests nuevos: `evidence-upload.test.ts` prueba las 4 combinaciones (Pending→InProgress dispara,
InProgress no hace nada raro con más evidencia, Observed NO se reabre solo, y un documento sin
`stageId` no toca ningún stage). `pnpm verify` completo en verde, incluido `scripts/
check-testids.mjs` (74/74, el piso no se movió — el ID nuevo no cuenta ahí a propósito).

**La matriz de "quién puede pedir cada transición", confirmada por el dueño el mismo día** — y una
corrección de vocabulario que valía la pena hacer explícita: **la FSM es del *stage*, no del
proyecto.** Un proyecto tiene muchas etapas y cada una su propio estado independiente (ahora mismo,
en `torre-a`: `Cimentación` y `Terminaciones` en `Completed`, `Estructura` en `InProgress` —tres
estados a la vez, mismo proyecto—); `Project.status` (`planning`/`in_progress`/`delayed`/
`completed`) es un campo aparte, no esta FSM.

| Transición | Quién | Mecanismo |
|---|---|---|
| `Pending → InProgress` | developer, automático | primera evidencia subida |
| `Observed → InProgress` | developer, manual | "Reanudar etapa" |
| `InProgress → Completed` | certifier, exclusivo | "Certificar" |
| `InProgress → Observed` | certifier, exclusivo | "Observar" |
| cualquiera | admin | sin restricción |

**Verificado en vivo contra Preprod, con TXID real, las cuatro.** `InProgress → Completed`
(2026-09-08, `e842c8ac…571fe22`), `InProgress → Observed` y `Observed → InProgress` (mismo día,
sobre `torre-a` / `Estructura`, ida y vuelta) se probaron antes de que existiera el Stage template;
`Pending → InProgress` quedó pendiente ese día porque **ningún proyecto tenía una etapa en
`Pending`** — confirmado creando dos proyectos y viendo el selector "Elegí la etapa" vacío en los
dos (era el pendiente #1, con una cara nueva). Resuelto el mismo día que se cerró el Stage template:
creado "Torre Pending Test" (developer, vía `/developer/project/new`, las 10 etapas mintean en
`Pending`), subida evidencia real a "Adquisición del terreno" (`/developer/project/:id/upload`,
PDF generado con `pandoc`). Merkle root `25dc32…3dc4c` — coincide exacto con el hash calculado en
local antes de subir — y **TXID real
`578e40f5072353d609a5df9e978e396d55cf149bada16b361829cee2eb7a5486`**, confirmado en
`preprod.cardanoscan.io` (3 confirmaciones, un solo metadato, sin movimiento de valor más que la
fee). Verificado que el auto-avance ocurrió de verdad **contra la API de producción**, no solo
mirando la UI: `GET /projects/:id/stages` devuelve la etapa 1 en `"state": "InProgress"` con
`"hasOnChainThread": true`, las otras 9 siguen en `Pending`. Las cuatro aristas de la FSM del stage
quedan probadas en vivo, cada una con su TXID.

**Cerrado el mismo día · el pendiente #1 completo: las 10 etapas del template, con nombre y
mecanismo de anclaje decididos por el dueño.**

**Decisión 1 — los 10 nombres.** La captura `34C-DEVELOPER-NEW-PROJECT-B.png` es el único lugar
donde existen (mezclados en inglés y español); el dueño los confirmó traducidos y normalizados como
`DEFAULT_STAGE_CATALOG` (`packages/shared`), **sin `progressPercentage`** — no es obligatorio
(`Stage.progressPercentage` es `number | null`, sin uso en el validador) y el dueño prefirió no
inventar un reparto que nadie pidió.

**Decisión 2 — el costo de crear 10 hilos on-chain de un submit.** Se consideró diferir el mint
hasta que cada etapa arranca de verdad (mismo momento que ya dispara `Pending → InProgress`), pero
eso resultó tener el mismo costo total (mint + advance, siempre, por etapa que arranca) con una
complicación real: el validador exige que un mint nazca con datum `Pending`
(`valid_initial_datum`, `mint_rejects_starting_outside_pending` — confirmado leyendo
`contracts/lib/propnexus/fsm.ak` y `contracts/validators/stage.ak`, no supuesto), así que "mintear
tarde" hubiera sido mint-más-advance encadenados, dos eventos por arranque en vez de uno. Agrupar
los 10 mints en una sola transacción tampoco se puede — `mint_rejects_two_threads_in_one_tx` lo
prohíbe explícito. **Se resolvió simple:** `POST /developer/projects` inserta el proyecto, la
membresía y las 10 filas de `Stage` en una sola transacción de base (atómico a nivel de fila — antes
no existía ningún `db.transaction()` en el código, es el primero) y después mintea cada una en loop,
tolerando que alguna quede `Failed` sin bloquear a las demás (D-059, `retry-anchor` ya existente para
el caso legítimo).

**La pantalla** (`developer.project.new.tsx`) recuperó la card "Stage template" que documentaba como
deuda — `SelectDropdown` con una sola opción (no hay nada que elegir hoy) y la lista de 10, ambos
como claves de i18n porque el front no puede importar `DEFAULT_STAGE_CATALOG` en runtime (traería
Zod al bundle). Duplicar la lista en dos lugares es el costo de esa restricción arquitectónica, no
un descuido — el comentario del archivo dice dónde está la otra copia.

**Y una trampa real, encontrada probando el flujo con Claude en Chrome:** el primer intento de
verificar el auto-avance (`Pending → InProgress` al subir la primera evidencia) fallaba en
silencio — la evidencia se anclaba bien, el stage se quedaba en `Pending`. La lógica se había
escrito en `POST /projects/:id/evidence` (`projects-obra.routes.ts`), pero **la pantalla real llama
a otra ruta**: `POST /developer/projects/:id/stages/:stageId/evidence`
(`developer-evidencia.routes.ts`), la que M2-D5 fila 38 exige porque devuelve Merkle root y TXID en
la misma respuesta para el `AnchoringSuccessModal`. La primera SÍ existe y SÍ funciona — es el CRUD
genérico que `apps/api/CLAUDE.md` ya documenta (*"el CRUD genérico... que la superficie del
entregable no consume pero los tests y el seed sí"*) — pero confirmado con `grep -rn
"api.uploadEvidence" apps/web/src`: cero resultados, ningún componente la llama. No es una
duplicación accidental que haya que resolver; es la distinción de siempre entre CRUD genérico y
superficie del entregable, y el error fue mío por no chequear cuál de las dos usa la pantalla antes
de editar.

**Corrección el mismo día: sí había que resolverla, y más a fondo de lo que pensé al principio.** El
dueño preguntó si hacía falta auditar los 87 endpoints por este mismo motivo — no una auditoría
completa (quedó pendiente, a propósito), pero sí se clasificaron los ~24 que ni M2-D5 ni M2-D6
declaran. La mayoría es CRUD genérico admin-only legítimo (`/users`, `/projects`, `/audit-logs`,
`retry-anchor`) o infraestructura de dominio compartida ya documentada (`/stages/:id`,
`/evidence/:id`). Pero dos resultaron **distintas** del resto: `developer`-accesibles (no
admin-only) y sin ningún caller real en el front.

`GET`/`POST /projects/:id/evidence` era la sombra exacta que ya se había encontrado — confirmado con
`grep -rn "api.uploadEvidence" apps/web/src`, cero resultados. Se borró, con sus tests migrados a la
ruta real (`evidence-upload.test.ts` reescrito completo; `browse-and-documents.test.ts` y
`project-access.test.ts` con un caso cada uno).

**`POST /projects/:id/stages` (crear una etapa suelta) parecía distinta** —sin ninguna gemela,
candidata a "la base para una futura UI de agregar etapa"— hasta que `git log` mostró que es
**anterior** al Stage template de 10 (existía antes de `DEFAULT_STAGE_CATALOG`) y que nadie
repreguntó si seguía haciendo falta una vez que el template llegó. Ni M1, ni M2 ni M3 mencionan
agregar etapas después de crear el proyecto — la racionalización de "es la base de una feature
futura" era mía, no del entregable. Se borró también. Los 12 usos en `stage-transitions.test.ts`
(más algunos en `constraint-errors.test.ts`, `browse-and-documents.test.ts`, `units-contracts.test.ts`
y `evidence-upload.test.ts`) que necesitaban un stage con hilo real para probar transiciones migraron
a `test/helpers/stages.ts` (`crearStageMinteado`): la misma inserción + mint que hacía la ruta, sin
pasar por HTTP. Dos tests se borraron sin reemplazo por probar comportamiento puramente de la ruta
que ya no existe (rechazo de `progressPercentage` fuera de rango, y el duplicado de `sequenceOrder`
en `constraint-errors.test.ts` — el mapeo de restricciones que probaba es genérico y ya lo cubren
tres casos más en el mismo archivo). Detalle completo en `apps/api/CLAUDE.md` §CRUD genérico.

Verificado de punta a punta con Claude en Chrome contra `pnpm dev` local (`ANCHOR_MODE=simulated`):
crear un proyecto nuevo deja las 10 etapas minteadas y seleccionables en "Subir evidencia"; subir un
archivo a una de ellas la mueve a `InProgress`, visible en `/developer/progress`. Tests nuevos en
`project-stage-template.test.ts` (transaccionalidad, 10 hilos independientes, membresía del creador)
y `browse-and-documents.test.ts` (el auto-avance contra la ruta real). `pnpm verify` completo en
verde, colección Postman (`specs/postman/`) regenerada.
