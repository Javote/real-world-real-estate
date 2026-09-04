# CLAUDE.md

Lo transversal. Lo de cada frente vive en `apps/web/CLAUDE.md`, `apps/api/CLAUDE.md`,
`packages/cardano/CLAUDE.md` y `contracts/CLAUDE.md`, y se carga solo cuando tocás ese subárbol.

**Acá solo hay información vigente.** El porqué de cada decisión está en `DECISIONS.md`; el
argumento largo, en `specs/archive/`.

## Contexto

**PropNexus** (Catalyst 1400106) — plataforma de ventas inmobiliarias en pozo: estructura el ciclo
de obra en **stages**, organiza **evidencia** (planos, permisos, actas, certificados) y ancla
**huellas criptográficas** (SHA-256/Merkle) en **Cardano** con timestamps. Off-chain: documentos,
PII y lógica de negocio. On-chain: solo commitments y TXIDs — **nunca valor**. Cuatro roles con
superficie propia: investor (INV), developer (DEV), notary (NOT), certifier (CER).

**El problema real.** Hoy es imposible verificar el estado de los procesos de aprobación de una obra
en pozo: la evidencia está dispersa en canales informales y nada garantiza que lo que se muestra hoy
sea lo que existía ayer. Esa opacidad ya causó daño económico real a compradores.

**Lo que NO hace.** No certifica, no valida y no decide nada. Solo puede sostener cuatro
afirmaciones: *este archivo tiene este hash* · *se registró en este momento* · *declara provenir de
esta autoridad externa* · *esta persona atestiguó haberlo revisado*. Si escribís copy, modelo o
validador que afirme algo más, está mal (D-026).

---

# Estado, y lo próximo

**La instancia desplegada ancló de verdad por primera vez el 2026-09-03**, contra Cardano Preprod:
`OnChainEvent` tiene su primera fila, `Confirmed`, con TXID real
(`52a2aa42…f2f7aaf406`). Arrancar en real era configuración; esto ya es prueba. Lo que se hizo para
llegar está en `DECISIONS.md` (D-075 → D-087) y en `specs/PLAN-2026-08-31-anclaje-real.md`; los
números medidos, en `specs/README.md`. Acá solo lo que falta.

| # | Qué | Por qué ahí | Nivel |
|---|---|---|---|
| 0 | **Mainnet** — runbook, habilitar la red, custodia de la clave | D-013 la hace **imposible por configuración**: es código, no solo procedimiento | 🔴 |
| 1 | **Sidebar de desktop** — `PanelLayout` esconde `BottomNav` con `md:hidden` a partir de 768px y no hay ningún reemplazo: en desktop no hay navegación | M2-D3 Principio 4 pide el swap a sidebar + columnas en desktop, y `M2-D2` captura 61 (`61-DESKTOP-HOME.png`) lo muestra. No es un componente ya creado sin conectar — no existe ningún `Sidebar`/`SideNav` bajo ningún nombre en `components/domain/`; toca las 4 superficies de rol porque `PanelLayout` es compartido | 🟢 |
| 2 | **Pantalla de creación de stage** — `POST /projects/:id/stages` existe y funciona (es el mismo endpoint que mintió el hilo real de D-083 el 2026-09-03) pero ninguna fila de `M2-D5` la pide y no hay ruta ni componente que la llame | `docs/` es inmutable (D-022): agregar la superficie es una decisión del dueño antes que una tarea de implementación — no se inventa por conveniencia | — |

**Encontrados el 2026-09-04, probando el flujo real end-to-end contra producción** (login con las
credenciales del re-seed, crear un proyecto, subir y anclar evidencia — vía Claude en Chrome, no un
test). Detalle del #1 en `apps/web/CLAUDE.md` §Trampas verificadas.

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

**El diseño ya está decidido. El trabajo es transcribirlo, no inventarlo.**

`docs/` tiene 70 capturas y un backlog de 53 superficies donde cada una ya trae su path, sus
componentes, sus endpoints y sus test IDs. No hay nada que diseñar y no hay reunión que tener.

## El loop, por pantalla

```
1. abrir la captura           docs/milestone-2-diseno/M2-D2-Screenshots-catalog/<N>-*.png
2. abrir su fila              docs/milestone-3-implementacion/UI-implementation-plan.md  (M2-D5)
3. transcribir                los componentes que la fila nombra, ninguno más
4. endpoints                  los de la fila; si no existen, se crean con la forma que la fila pide
5. test IDs                   los de la fila, literales
6. pnpm verify
7. commit                     con el ID de M2-D5 entre corchetes
```

**Las capturas se leen.** Son PNG y se abren con la herramienta de lectura: no hay que adivinar
espaciados ni colores mirando prosa.

## Las cinco reglas del loop

1. **Cuando la prosa y la captura difieren, gana la captura.** M2-D3 describe; M2-D2 muestra.
   **Excepción (D-074):** el `GradientHeader` autenticado es siempre logo + campana + perfil +
   idioma. Si la captura omite el logo o las utilidades, no se transcribe esa omisión.
2. **Ningún componente que M2-D3 no defina.** Si hace falta uno nuevo, es una decisión nueva, no un
   archivo nuevo.
3. **Ningún estado que M2-D3 no liste.** *"Never invent new statuses; choose the closest semantic
   mapping."*
4. **Ninguna superficie sin sus test IDs.** Una pantalla sin `data-testid` no está terminada — es
   evidencia que pide el SOM, no un lujo.
5. **Los tokens no se eligen, se transcriben.** El hex de M2-D3 es normativo.

## Antes de empezar una superficie

| Vas a tocar | Leé primero |
|---|---|
| Cualquier pantalla | su captura + su fila de M2-D5 + `M2-D1` (permisos del rol) |
| Algo que muestre hash, TXID o Merkle root | `M2-D4` — los 10 patrones son **normativos** |
| Un componente | su ficha en `M2-D3 §Component Library` |
| Un endpoint | `M2-D5` §4-6 (path, test IDs, work stream) + `M2-D6` §9 |
| Un validador | `M1-D1` §Workflow + D-020 (FSM) + D-021 (nunca valor) |
| El modelo de datos | `M1-D2` + `M2-D1` §4 (matriz de permisos) + D-029 |

No leas los cuatro entregables por costumbre: son ~25k tokens. Abrí lo que la fila pide.

---

## Jerarquía de precedencia

- **Obligaciones (el *qué*): manda `docs/`.** Ninguna decisión puede reducir lo que debemos.
  **`docs/` es inmutable** — ni para corregir un error evidente (D-022).
- **Implementación (el *cómo*): `DECISIONS.md` > `CLAUDE.md` > `specs/`.**

Un desvío solo es legítimo si (a) el entregable se contradice internamente, (b) es un error de
redacción, o (c) seguirlo al pie contradiría una verdad del producto declarada por el dueño.
**Nunca por conveniencia ni por preferencia técnica.** Los desvíos vigentes están listados en
`DECISIONS.md`.

Ante contradicción entre documentos: gana el de mayor precedencia y el otro se corrige **en el mismo
commit**. Si la contradicción es con código, avisá antes de "arreglar" nada.

**Y antes de declarar que un entregable está mal: verificá que estás mirando el entregable.** Ya nos
pasó decidir contra una transcripción errónea (ver Trampas).

---

# Reglas duras (innegociables)

1. **Datos primero:** dinero jamás en float — montos en unidades enteras mínimas (lovelace como
   `bigint`; fiat en centavos). Timestamps en UTC. IDs opacos.
2. **Cero PII on-chain o en logs:** ni nombres, ni emails, ni URLs internas, ni nombres de archivo en
   metadata, datums o logs. Solo hashes y refs opacas. Strings de metadata ≤ 64 bytes.
3. **El hash es el ticket de entrada a la cadena de prueba** (D-027). Si un archivo tiene
   `sha256Hash`, termina anclado — o se muestra "Pendiente", **nunca** "Verificado".
4. **Passwords solo con bcrypt** (cost 10, D-046). Jamás loguear ni devolver `passwordHash`.
5. **Autorización en dos capas, siempre:** rol global (`requireRole`) + membresía por proyecto
   (`requireProjectAccess`). La matriz completa está en M2-D1 §4.
6. **Todo body se valida con Zod**, y el schema vive en `packages/shared` **antes** que el endpoint.
7. **Toda mutación relevante escribe `AuditLog`** (append-only) con actor, entidad, acción, timestamp.
8. **Idempotencia en todo lo que toca chain:** re-ejecutar un anclaje o una migración no duplica
   efectos.
9. **La FSM del stage es una sola** (D-020), en `packages/shared` y espejada en Aiken. Si cambia una,
   cambian las dos en el mismo commit.
10. **Uploads:** solo `application/pdf`, `image/jpeg`, `image/png`; máximo `MAX_FILE_SIZE_MB`. Si un
    upload falla la validación después de escribirse, **borrar el archivo huérfano**.
11. **`contracts/plutus.json` se commitea** tras cada `aiken build`; direcciones derivadas del
    blueprint, jamás hardcodeadas.
12. **Secrets solo por env.** Si ves una seed o una key commiteada: frená y avisá.
13. **Ningún validador custodia ni transfiere valor** (D-021).
14. **Cero strings hardcodeados en la UI** (D-025). Todo texto sale del diccionario; moneda, fecha y
    decimales con `Intl.*`. Default `es-AR` con voseo.
15. **El backend devuelve claves de traducción, nunca copy** (M2-D4 §8.2).
16. **Los hashes viajan completos al cliente.** La truncación 6+4 es de presentación y la hace
    `HashChip`. Los TXID son case-sensitive y viajan verbatim.
17. **Nunca mostrar una señal de prueba que no puedas sustanciar** (M2-D4 §6.2). Sin TXID, el estado
    es "Pendiente".

# Prohibiciones

- No inventar componentes, estados, endpoints ni superficies fuera de `docs/` — proponer, no improvisar.
- **Nunca "milestone" para una etapa de obra: es `stage`** (D-067). El riesgo sigue vivo porque los
  entregables usan la palabra y el código ya no. **Excepción:** los test IDs de M2-D5 se transcriben
  literales, incluso `INV-STAGE-MILESTONE-001`.
- No abrir un modal de verificación automáticamente (M2-D4 §6.3). Toda superficie de prueba es
  iniciada por el usuario; la única excepción es `AnchoringSuccessModal`.
- En el front, no hacer `fetch` fuera de `ApiPort`.
- No importar Lucid/Blockfrost fuera de `packages/cardano` (D-014).
- No migrar lógica de negocio on-chain: el backend es fuente de verdad del **registro** (D-007).
- No tocar mainnet: `CARDANO_NETWORK=Preprod` siempre (D-013).
- **No editar migraciones aplicadas** — con la condición de D-063: mientras la única base sea local,
  el esquema se corrige editando el archivo y borrando la base. Con Turso vivo, se termina.
- No tocar `contracts/build/` ni editar `aiken.lock` a mano.
- No commitear `.env`, `apps/api/.data/` (las bases locales), `uploads/` ni artefactos de build.
- No "arreglar" tests cambiando contratos de API o esquema de DB para que pasen.
- **No editar nada dentro de `docs/`** (D-022).

---

# Estructura

```
apps/api          Express 5 + Kysely      → servicio en Render
apps/web          TanStack Router + Vite  → static site en Render (SPA + PWA)
packages/shared   contrato Zod (oRPC)     → lo importan los dos
packages/cardano  AnchorPort              → lo importa la API
contracts/        Aiken · Plutus V3       → no se hostea, toolchain aparte
```

`packages/shared` es lo único que vuelve el drift **imposible** en vez de prohibido. `contracts/` no
está en el workspace pnpm a propósito: otro toolchain, otro lockfile, otra caché.

Tres `.md` en la raíz: **`README.md`** (entrada humana), **`CLAUDE.md`** (este) y **`DECISIONS.md`**
(las restricciones). El mapa de desarrollo en `specs/README.md`; los entregables en `docs/`, mapeados
en `specs/entregables.md`.

| Qué | Dónde |
|---|---|
| Obligaciones, la vara de aceptación | `docs/` (inmutable) |
| Qué archivo de `docs/` es qué entregable | `specs/entregables.md` |
| Qué obliga una decisión | `DECISIONS.md` |
| Por qué se decidió (argumento largo) | `specs/archive/` |
| Reglas y trampas de un frente | `<frente>/CLAUDE.md` |
| Invariantes de una rebanada | `specs/SPEC-NNN` |
| Stack, versiones e infraestructura | `specs/stack.md` |
| Deploy, rollback e incidentes | `specs/RUNBOOK-deploy.md` |

# Stack

| Frente | Con qué | Decisión |
|---|---|---|
| **web** | TanStack Router + Vite (SPA, sin SSR) · React 19 · Tailwind v4 · shadcn/ui · Lucide · PWA | D-065, D-024 |
| **api** | Express 5 + oRPC + Zod + JWT + bcrypt(10) + Multer + helmet, base `/api/v1` | D-066, D-054 |
| **shared** | Zod — el contrato único. El schema va acá **antes** que el endpoint | D-012, D-066 |
| **db** | Kysely · SQLite en dev · Turso en prod · una sola migración | D-038, D-063 |
| **cardano** | `AnchorPort` con adaptadores `simulated` y real (Lucid Evolution) | D-014, D-060 |
| **contracts** | Aiken v1.1.21 · Plutus V3 · stdlib v3.0.0 · blueprint commiteado | D-019, D-058 |
| red | **Preprod siempre**; mainnet fuera de alcance | D-013 |

El inventario completo —versiones reales, qué corre y qué está solo decidido— vive en
`specs/stack.md` y solo ahí (D-034).

---

# Niveles de autonomía

| Nivel | Qué cubre | Cómo se trabaja |
|---|---|---|
| 🟢 Verde | Componentes según M2-D3, superficies según M2-D5, tests, docs, seeds | El LLM implementa directo |
| 🟡 Amarillo | Migraciones, auth/permisos/guards, `packages/cardano`, archivos/S3, CI/deploy, **validadores Aiken** | El LLM propone; revisión humana línea por línea |
| 🔴 Rojo | Claves y firmas, `SERVICE_WALLET_PRIVATE_KEY`, hashing y construcción de commitments | El humano lidera; el revisor debe poder explicar cada línea sin mirar el chat |

Si dudás del nivel, es el más alto de los dos.

# Commits y ramas

`<tipo>(<scope>): <descripción en imperativo, minúscula, sin punto final> [<REF>]`

- **Tipos:** `feat` · `fix` · `refactor` · `test` · `docs` · `chore` · `perf` · `db`
- **Scopes:** `web` · `api` · `db` · `shared` · `cardano` · `contracts` · `ci` · `repo`
- **REF:** el ID de M2-D5 cuando aplique (`[M3-FE-18]`, `[INV-BUY-LIST-001]`) o la decisión (`[D-065]`)

Un commit = un cambio lógico · el cuerpo explica el *por qué* · `BREAKING CHANGE:` si rompe contrato
de API o esquema on-chain. **`main` es la rama de integración y no hay PRs** (D-030).

**Testear, commitear y pushear son una sola unidad de trabajo.** `pnpm verify:all` en verde →
`git commit` → `git push`, siempre juntos y en ese orden. No se junta trabajo local "para pushear al
final", y no se commitea sin el verde.

**Por qué es regla y no gusto:** un commit local no existe para nadie más, y el remoto queda
afirmando un estado que no es el real — el mismo modo de falla que el push contra un servicio
suspendido y que el TXID simulado en producción. **No falla: miente.** Si pushear tiene una
consecuencia que el dueño debería saber —acá el deploy automático de Render, que el `buildFilter`
no filtra—, se pushea igual y se avisa; no se retiene el push por eso.

**La documentación viaja con el código que la causa, en el mismo commit.** Un cambio que altera cómo
se opera, se configura o se despliega algo llega con su documentación adentro — no en un `docs(...)`
posterior. Un `docs(...)` suelto es legítimo solo cuando el cambio **es** documentación: sanear algo
desactualizado, cerrar una decisión, escribir una trampa recién aprendida.

**Por qué es regla y no gusto:** el 2026-08-27 el commit de R2 salió sin cerrar D-051, y durante tres
commits `DECISIONS.md` afirmó que la evidencia era efímera mientras la evidencia ya vivía en R2. La
ventana entre el código y su documentación es una ventana en la que el repo miente, y quien lea en
el medio no tiene forma de saberlo.

# Comandos

```bash
pnpm install                      # bootstrap del workspace
pnpm dev                          # web + api en paralelo
pnpm verify                       # app TS: lint + typecheck + tests + build
pnpm contracts:verify             # Aiken: fmt + check + build
pnpm verify:all                   # las dos, encadenadas
pnpm lint:fix                     # Biome arregla lo mecánico

pnpm --filter @plataforma/api test:s3         # storage contra MinIO real
pnpm --filter @plataforma/cardano test:yaci   # anclaje contra un nodo Cardano real
docker compose -f compose.dev.yml up -d       # solo si querés la infra levantada aparte
```

**TypeScript y Aiken no se mezclan:** distinto toolchain, distintos artefactos, distintos modos de
falla. El CI los corre como dos jobs en paralelo. Los dos últimos comandos **no corren en CI** (no
levanta infraestructura): se corren a mano.

Los comandos por frente (`db:migrate`, `db:seed`, `e2e`) están en el `CLAUDE.md` de cada uno.

---

# Trampas transversales

Sección viva: agregá acá el mismo día que te muerda una. Las de cada frente van en su `CLAUDE.md`.

- **Las capturas de M2-D2 tienen datos mock, no datos de diseño.** M2-D1 lo dice: *"the maquette uses
  mock blockchain interactions"*. Lo normativo de una captura es la **estructura** —layout,
  componentes, jerarquía, estados—; los valores no. La captura 55 muestra tres unidades del mismo
  proyecto en tres stages distintos y casi nos hace modelar stages por unidad, cuando el dominio dice
  que un desarrollo tiene un solo trámite (D-029).
- **Antes de concluir que un entregable está mal, verificá que estás mirando el entregable.** Cuatro
  `.puml` regenerados desde los PDF de M1 tenían las flechas de la FSM invertidas, y durante una
  sesión entera creímos que el entregable estaba mal. El paquete canónico es
  `M1-D2-Architecture-and-Data-Models/`, hasheado en la Proof of Achievement.
- **Grepear solo `*.md` esconde entregables.** Una búsqueda con `--include="*.md"` concluyó que algo
  no aparecía en `docs/`; estaba en un `.csv`. Grepeá sin filtro de extensión.
- **Los códigos de entregable se reinician en cada milestone y colisionan**: `M1-D1` es el whitepaper,
  `M2-D1` es el mapa de arquitectura de información. Al citar, usá siempre la forma completa
  (`M2-D1 §4`). Y `M2-D5`/`M2-D6` son entregables de **Milestone 2** aunque vivan en la carpeta de M3.
- **Los PDF de este repo no se leen con la herramienta de lectura** (falta `pdftoppm`). Las capturas
  PNG sí. Para un PDF: `qlmanage -t -s 1800 -o <dir> archivo.pdf`.
- **Un verificador que vive dentro del corpus que verifica se encuentra a sí mismo.** Un guardia que
  matcheaba la mención de `docs/` se bloqueó al escribirse. **Antes de agregar un verificador,
  preguntá si el problema no se arregla mejor cambiando la forma de lo verificado** (D-053).
- **Editar un `package.json` sin correr `pnpm install` produce un verde falso.** Lo atrapa
  `pnpm install --frozen-lockfile` en CI, y alcanza. Un verde sobre el entorno equivocado es peor que
  un rojo.
- **`pnpm.overrides` vive en `package.json` y pnpm 10+ dejó de leerlo.** El pin
  `"packageManager": "pnpm@9.15.0"` es lo único que hoy lo sostiene: un pnpm más nuevo instalado en
  la máquina delega a 9.15.0 y el override se aplica igual —lo prueba la línea 8 de `pnpm-lock.yaml`
  y que `@types/express` resuelva a 5.0.6—, pero avisa `The "pnpm" field in package.json is no longer
  read by pnpm`. **Ese warning no es ruido: es la cuenta regresiva.** El día que se suba el pin a
  pnpm 10+, los overrides se ignoran **en silencio** y sin romper el build; hay que moverlos a
  `pnpm-workspace.yaml` en el mismo commit que sube la versión.
- **`pnpm verify` corre contra el entorno de test, no contra el que declara `render.yaml`.** Entre
  los dos no había nada, y una regresión de configuración solo se veía en los logs del deploy.
  Lo cierra `apps/api/test/render-config.test.ts` (D-076). **Si agregás una lectura de `env.*`
  nueva, declarala en `render.yaml` o el test se pone rojo** — que es el punto.
- **Las capturas del developer no coinciden en el header.** Documentación (46) va sin logo, Audit
  log (49) va con logo, ninguna trae campana ni idioma, y M2-D3 dice *never omit the logo*. No se
  transcribe captura por captura: D-074 unifica. Si una pantalla nueva "sigue la captura" y saca el
  logo, está mal.
