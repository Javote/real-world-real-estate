# CLAUDE.md — PropNexus

> **Este es el único archivo de contexto del repo.** No hay `CLAUDE.md` por frente, ni skills, ni
> subagentes. Si algo no está acá, está en `DECISIONS.md` (el porqué, archivo histórico) o en
> `docs/` (las obligaciones, inmutable). Nada más se carga solo.

## Contexto

**PropNexus** (Catalyst 1400106) — ventas inmobiliarias en pozo: estructura el ciclo de obra en
**stages**, organiza **evidencia** (planos, permisos, actas, certificados) y ancla **huellas
criptográficas** (SHA-256/Merkle) en **Cardano** con timestamps. Off-chain: documentos, PII, lógica
de negocio. On-chain: solo commitments y TXIDs — **nunca valor** (D-021). Cuatro roles con
superficie propia: investor (INV), developer (DEV), notary (NOT), certifier (CER).

**El problema real.** Hoy es imposible verificar el estado de aprobación y avance de una obra en
pozo: la evidencia está dispersa y nada garantiza que lo que se muestra hoy existía ayer. Esa
opacidad ya causó daño económico real a compradores.

**Lo que la plataforma NO hace** (D-026): no certifica, no valida, no decide. Acompaña procesos que
ya existen afuera y los refleja. El rol "certifier" verifica **integridad y completitud** contra los
hashes anclados — no validez legal. Solo se pueden sostener cuatro afirmaciones: *este archivo tiene
este hash* · *se registró en este momento* · *declara provenir de esta autoridad externa* · *esta
persona atestiguó haberlo revisado*. Copy, modelo o validador que afirme más, está mal.

**Vocabulario.** **Milestone** = hito Catalyst (M1, M2, M3). **Stage** (`ConstructionStage`) = etapa
de obra, la entidad del dominio. Nunca "milestone" para una etapa de obra (D-023). Si ves
`Milestone` en código, es deuda de rename.

## Precedencia

- **Obligaciones (el qué): manda `docs/`.** Entregables aprobados. **Inmutable** — ni para corregir
  un error evidente. Bloqueado por hook.
- **Implementación (el cómo): `DECISIONS.md` > `CLAUDE.md` > `specs/`.**

Un desvío solo es legítimo si (a) el entregable se contradice internamente, (b) es error de
redacción, o (c) contradice una verdad del producto declarada por el dueño. Nunca por conveniencia.
Los desvíos vigentes están en el encabezado de `DECISIONS.md`. Ante contradicción entre documentos,
gana el de mayor precedencia y el otro se corrige en el mismo commit.

**Antes de declarar que un entregable está mal, verificá que estás mirando el entregable** y no una
transcripción derivada. Ya nos costó una decisión falsa (ver Trampas).

## El método: transcribir, no interpretar

Todo lo visual **ya está diseñado**. Hay **70 capturas** en
`docs/milestone-2-diseno/M2-D2-Screenshots-catalog/`, y son la especificación de mayor fidelidad que
existe en el repo — más precisa que cualquier prosa.

**Regla dura: no se implementa una pantalla sin abrir su captura.** El `.md` de M2-D3 describe
componentes en prosa; la captura muestra la pantalla. Cuando difieren, **gana la captura**.

El flujo es:

1. **Abrir la captura.** Buscala por nombre en el catálogo (`1-LOGIN.png`, `33-DEVELOPER-HOME-A.png`…).
2. **Transcribirla a `specs/SPEC-NNN`**: árbol de componentes, tokens exactos, strings exactos en
   los dos idiomas, estados, y qué endpoint alimenta cada dato. Un spec es una transcripción, no una
   interpretación.
3. **Implementar la transcripción.** Si el spec está bien hecho, implementar es traducir.
4. **Verificar**: `scripts/gate.sh` (3 controles) y, cuando cambia superficie visual, `pnpm e2e`.

**Por qué así** (2026-08-21): la rebanada 1 se construyó leyendo solo la prosa de M2-D1/M2-D3 sin
abrir `1-LOGIN.png`. Resultado: gradiente como banda en vez de página completa, sin tarjeta blanca,
tabs como grilla en vez de segmented control, sin título por rol, credenciales precargadas en vez de
placeholders, botón genérico en vez de "Sign in as Investor". Una auditoría ex-post de 157k tokens
la dio por **conforme**, porque también leyó solo la prosa. **Un control que mira el lugar
equivocado da garantía falsa, que es peor que no tener control.** La precisión va adelante, en el
spec — no atrás, en la auditoría.

## Qué leer antes de tocar cada frente

No abras los entregables por costumbre: son ~25k tokens.

| Vas a tocar | Leé |
|---|---|
| Una pantalla | **Su captura en M2-D2** + `M2-D1` (árbol de pantallas, permisos) + `M2-D3` (tokens y componentes) |
| Algo con hash, TXID o Merkle | `M2-D4` — los 10 patrones son **normativos** |
| Un endpoint | `M2-D5` §4-6 (path, test IDs, work stream) + `M2-D6` §9 |
| Un validador | `M1-D1` §Workflow + D-020 (FSM) + D-021 (nunca valor) |
| El modelo de datos | `M1-D2b` + `M2-D1` §4 (matriz de permisos) + D-029 |

**Mapeo de entregables** (los códigos se reinician por milestone y colisionan — citá siempre la
forma completa, `M2-D1 §4`):

| Código | Archivo en `docs/` |
|---|---|
| M1-D1 | `milestone-1-.../M1-D1-Whitepaper*` |
| M1-D2 / M1-D2b | `milestone-1-.../M1-D2-Architecture-and-Data-Models/` (paquete canónico, hasheado en la PoA) |
| M1-D3 | `milestone-1-.../M1-D3-PilotPlan.pdf` — trae las cartas de los pilotos |
| M2-D1 | `milestone-2-diseno/M2-D1-Information-architecture-and-navigation-map.md` |
| M2-D2 | `milestone-2-diseno/M2-D2-Screenshots-catalog/` — **70 PNG, la spec visual** |
| M2-D3 | `milestone-2-diseno/M2-D3-Design-principles-and-component-library.md` |
| M2-D4 | `milestone-2-diseno/M2-D4-UX-docs-and-proof-rendering-patterns.md` |
| M2-D5 / M2-D6 | `milestone-3-implementacion/` — son entregables *de M2* que planifican M3 |
| SOM de M3 | `milestone-3-implementacion/Milestone-3-info.md` |

## Stack

Los entregables son **agnósticos de stack**; el único requisito comprometido es que los contratos
sean **Aiken**. Cambiar cualquier otra cosa requiere una `D-0XX` nueva.

**Las versiones viven en los `package.json` y en `aiken.toml`, y solo ahí.** Una tabla de versiones
en un `.md` se desactualiza el día que alguien corre `pnpm up`.

| Frente | Con qué | Decisión |
|---|---|---|
| **web** | TanStack Start (SSR) + Router + Query · React 19 · Tailwind v4 · **shadcn/ui** · Lucide | D-002, D-024 |
| **api** | Express 4 + Zod + JWT + bcrypt(10) + Multer, base `/api/v1` | D-016 |
| **shared** | Zod — contrato único API↔web. El schema va acá **antes** que el endpoint | D-012 |
| **db** | **Kysely** sobre `@libsql/client` · SQLite en dev, **Turso** en prod | D-038, D-049 |
| **cardano** | `AnchorPort` con adaptadores `blockfrost` y `simulated` — *package vacío* | D-005, D-014 |
| **contracts** | Aiken v1.1.21 · **Plutus V3** · stdlib v3.0.0 · blueprint commiteado | D-017, D-019 |
| red | **Preprod siempre**; mainnet fuera de alcance | D-013 |
| deploy | **Render** free tier, runtime nativo (sin Docker) · evidencia en **R2** | D-039, D-040, D-041 |

**Estructura.** `apps/web` y `packages/api` son los únicos servicios; `packages/shared` y
`packages/cardano` son librerías; `contracts/` es el proyecto Aiken (aislado del workspace pnpm, su
versión es un entero — D-015). En la raíz: `README.md` (arranque humano), `CLAUDE.md` (este),
`DECISIONS.md` (el porqué). `docs/` contiene **solo** entregables (D-033).

## Reglas duras

1. **Dinero jamás en float.** Unidades enteras mínimas: lovelace como `bigint`, fiat en centavos
   `integer`. Timestamps UTC. IDs UUID.
2. **Cero PII on-chain o en logs.** Ni nombres, ni emails, ni nombres de archivo en metadata, datums
   o logs. Solo hashes y refs opacas. Strings de metadata ≤64 bytes.
3. **El hash es el ticket de entrada a la cadena de prueba** (D-027). Solo se hashea lo que se va a
   anclar; si algo tiene `sha256Hash`, termina anclado o se muestra "Pendiente" — **nunca**
   "Verificado". El hash lo calcula el servidor y no se recalcula ni se edita. Los **assets**
   informativos (renders, folletos, galerías) no se hashean, no se anclan y no muestran señal de
   prueba. No hay estado intermedio.
4. **Passwords solo con bcrypt cost 10** (D-046: en 0.1 CPU un KDF memory-hard es la forma
   equivocada). Jamás loguear ni devolver `passwordHash`. La política (mín. 8 caracteres, máx. 72
   **bytes** rechazando en vez de truncar, sin reglas de composición) vive en `passwordSchema` de
   `packages/shared` y se aplica donde la password se **escribe**, nunca en el login.
5. **Autorización en dos capas, siempre:** rol global (`requireRole`) + membresía por proyecto
   (`canAccessProject`, con `allowedMemberships` **obligatorio** — D-042). `admin` bypasea
   membresías. La matriz está en M2-D1 §4. La puerta verifica que ningún endpoint con alcance de
   proyecto se olvide la segunda capa (D-044).
6. **Todo body se valida con Zod** (`safeParse` + 400 con `error.flatten()`). El schema va a
   `packages/shared` **antes** que el endpoint, y el front importa el mismo tipo. Es lo único que
   vuelve el drift API↔web *imposible* en vez de prohibido.
7. **Toda mutación relevante escribe `AuditLog`** (append-only) vía `writeAuditLog`.
8. **Idempotencia en todo lo que toca plata o chain:** re-ejecutar un anclaje, release o migración no
   duplica efectos.
9. **FSM del stage:** `Pending → InProgress → {Observed ⇄ InProgress, Completed}`, `Completed`
   terminal (D-020). `Observed` es remediación, no estado final. Una sola tabla de transiciones,
   espejada entre backend y `contracts/`. La etiqueta visible sale del diccionario i18n.
10. **Uploads:** solo `application/pdf`, `image/jpeg`, `image/png`; máximo `MAX_FILE_SIZE_MB`
    (default 10). Si falla la validación después de que Multer escribió, **borrar el huérfano**.
11. **`contracts/plutus.json` se commitea** tras cada `aiken build`; direcciones derivadas del
    blueprint, jamás hardcodeadas.
12. **Secrets solo por env.** Si ves una seed/key commiteada: frená y avisá.
13. **Ningún validador custodia ni transfiere valor** (D-021). "Release" significa anclar el evento
    de liberación, no ejecutar el pago. Si una spec pide un validador que retenga fondos, está mal.
14. **Cero strings hardcodeados en la UI** (D-025) — incluidos `aria-label` y `alt`. Todo texto sale
    del diccionario i18n; moneda, fecha, relativo y decimal con `Intl.*` y el locale activo. Default
    `es-AR` con **voseo** ("Mirá tu unidad", no "Mira" ni "Mire"). La clave de `localStorage` es
    `propnexus.lang`, literal.
15. **El backend devuelve claves de traducción, nunca copy** (M2-D4 §8.2). Vale para acciones de
    audit log, categorías, etiquetas de rol y nombres de stage.
16. **Los hashes viajan completos al cliente** (M2-D4 §8.2). La truncación 6+4 es exclusivamente de
    presentación y la hace `HashChip`. Los TXID son case-sensitive y viajan verbatim.
17. **Nunca mostrar una señal de prueba que no puedas sustanciar** (M2-D4 §6.2). Sin TXID real, el
    estado es "Pending", no "Verified".

## Prohibiciones

- No migrar lógica de negocio on-chain: el backend es la fuente de verdad del **registro** del
  lifecycle (D-007); on-chain se anclan pruebas.
- No importar Lucid/Blockfrost fuera del adaptador real de `packages/cardano` (D-014). Las rutas de
  la API jamás llaman a la chain directo.
- En el front, no hacer `fetch` fuera de `ApiPort` (`apps/web/src/api/`).
- No tocar mainnet: `CARDANO_NETWORK=Preprod` siempre (D-013).
- **No subir `@types/express` a v5** mientras `express` sea v4 (rompe 21 tipos de `req.params`).
- **No editar migraciones ya aplicadas**; siempre una nueva.
- No tocar `contracts/build/` (generado) ni editar `aiken.lock` a mano.
- No inventar endpoints, campos, estados ni patrones de prueba fuera de spec/docs — proponer, no
  improvisar. M2-D3 dice *"never invent new statuses"*; patrón nuevo = decisión nueva en `DECISIONS.md`.
- No commitear `.env`, `dev.db`, `uploads/` ni artefactos de build.
- No "arreglar" tests cambiando contratos de API o esquema de DB para que pasen.
- No crear variantes ad-hoc de los componentes de dominio: viven en `apps/web/src/components/domain/`.
- **No editar nada dentro de `docs/`** (D-022).
- No abrir un modal de verificación automáticamente (M2-D4 §6.3); toda superficie de prueba la
  inicia el usuario. Única excepción: `AnchoringSuccessModal`.

## Verificación — tres controles, y nada más

```bash
scripts/gate.sh      # 1) prohibiciones  2) typecheck  3) tests   (~20 s)
pnpm e2e             # walkthrough visual completo, a mano, cuando cambia superficie
```

**La puerta corre lo mismo en local y en CI** — si se separan, divergen. Tres secciones:

1. **Prohibiciones** (greps, ~1 s): `docs/` intacto · sin secretos versionados · sin redes que no
   sean Preprod · migraciones aplicadas intactas · segunda capa de autorización en todo endpoint con
   alcance de proyecto · sin artefactos de build versionados.
2. **Typecheck** del workspace.
3. **Tests** de los packages tocados (~16 s: web 3 · api 11 · shared 2).

Los builds corren **solo en CI**, no en el push. Las advertencias decorativas se eliminaron: la
puerta o bloquea, o calla.

**Lo que no se puede dejar al azar es un hook, no un párrafo** (D-032): editar `docs/`, editar una
migración aplicada o un archivo generado, escribir una clave privada, pushear con la puerta cerrada.
Su regresión: `scripts/hooks/test-guards.sh`.

**`pnpm e2e`** levanta web+api (reusa los que corran), recorre la app y deja capturas, video y trace
en `apps/web/e2e/.artifacts/` (gitignoreado). Produce tres cosas que el SOM pide como evidencia: los
test IDs de M2-D5 ejecutándose, las capturas y el video (criterio 13). No corre en CI.

**Revisión humana línea por línea** para lo que toca seeds/keys/firmas, `SERVICE_WALLET_SEED`,
`canAccessProject`, hashing y construcción de commitments. El revisor tiene que poder explicar cada
línea sin mirar el chat. El inventario de esa superficie está más abajo.

## Comandos

```bash
pnpm install                      # bootstrap
pnpm dev                          # web (3000) + api (8787)
pnpm typecheck                    # todos los packages
pnpm test                         # unitarios de los tres packages
pnpm e2e                          # walkthrough Playwright (mobile + desktop) — NO en CI
pnpm contracts:check              # aiken check (compila y corre tests de validadores)
pnpm contracts:build              # regenera plutus.json (commitearlo)

pnpm --filter @plataforma/api db:migrate   # aplica migraciones pendientes
pnpm --filter @plataforma/api db:seed      # datos demo
pnpm --filter web generate-routes          # regenera routeTree.gen.ts

scripts/gate.sh                   # LA PUERTA
scripts/hooks/test-guards.sh      # regresión de los guardias
```

Usuarios del seed: `admin@example.com/admin123`, `developer@example.com/developer123`,
`buyer@example.com/buyer123`, `verifier@example.com/verifier123`, `notary@example.com/notary123`,
proyecto `torre-a`. Los valores del rol (`buyer`/`verifier`) todavía no coinciden con la etiqueta de
UI (Investor/Certifier) — deuda de la familia D-023. Fuera de una base local, el seed exige
`SEED_ADMIN_PASSWORD`/`SEED_DEMO_PASSWORD` o revienta (D-047).

## Commits

`<tipo>(<scope>): <descripción en imperativo, minúscula, sin punto final> [<REF>]`

- **Tipos:** `feat` · `fix` · `refactor` · `test` · `docs` · `chore` · `perf` · `db`
- **Scopes:** `web` · `api` · `db` · `shared` · `cardano` · `contracts` · `ci` · `repo`
- **REF:** el ID de M2-D5 entre corchetes cuando aplique (`[M3-BE-13]`, `[M3-FE-18]`)

Un commit = un cambio lógico. El cuerpo explica el *por qué*. `BREAKING CHANGE:` en el footer si
rompe contrato de API o esquema on-chain. **El mensaje de commit es la única revisión que va a
existir**: si un cambio no se puede explicar en un mensaje, la rebanada es demasiado grande.

**`main` es la rama de integración y no hay PRs** (D-030). Cuando se sume una segunda persona, esto
vuelve a PRs — el trigger está en D-030.

## Superficie 🔴 — la revisa el humano

Todo el código 🔴 del proyecto vive en `packages/api`. Auditado leyendo los 27 endpoints, no
estimado.

| Archivo | Qué lo hace 🔴 | Estado |
|---|---|---|
| `lib/jwt.ts` | clave de firma | ✔ sin fallback; lanza al importar si falta `JWT_SECRET` (D-042) |
| `routes/auth.routes.ts` | bcrypt en login | ✔ hash dummy: los tres rechazos cuestan lo mismo (0.7 ms de diferencia, medido) |
| `routes/users.routes.ts` | bcrypt al crear y cambiar password | ✔ cost 10, política de D-046 |
| `middlewares/auth.ts` · `canAccessProject` | membresía por proyecto | ✔ fail-closed · **falta que sea middleware** |
| `utils/hashing.ts` | SHA-256 de evidencia | ✔ correcto · R2 lo va a mover |
| `SERVICE_WALLET_SEED`, commitments | — | **no existen todavía** |

**Lo que queda abierto (P1 de forma, dueño humano):** `canAccessProject` es una función que hay que
acordarse de llamar, no un middleware que no se puede olvidar. `scripts/check-project-access.py`
corre en la puerta y vuelve **ruidoso** el olvido, no imposible (D-044). Hoy son 27 endpoints; el
backlog de M2-D5 son ~80, así que el momento barato de cambiar la forma es **antes** de la tanda
grande. Default propuesto: `requireProjectAccess(...)` de Express que lea `req.params.projectId`.

**El SHA-256 se mueve cuando llegue R2:** hoy hashea un archivo ya escrito en disco; tiene que cubrir
exactamente los bytes que terminan en el object storage. Es 🔴 y es donde estas cosas se rompen.

**bcrypt se queda nativo.** La salida si el módulo rompe un build **no es `bcryptjs`, es `scrypt` de
`node:crypto`** (stdlib, sin dependencias). Bajar el cost no es opción: la regla 4 fija 10.

## Trampas verificadas

Sección viva: agregá acá el mismo día que te muerda una, fechada.

- **2026-08-21 · No implementar una pantalla sin abrir su captura.** Ver §El método. La prosa de
  M2-D3 describe componentes; la captura muestra la pantalla, y son cosas distintas. Además: los
  **paneles de rol no son shells vacíos** — son grillas de KPIs más una lista de trabajo pendiente
  con acción. Un spec que recorta "los datos" recorta justo lo que hace a la pantalla una pantalla.
- **2026-08-21 · TypeScript hoistea TODOS los `import` al principio del archivo compilado**, así que
  un `dotenv.config()` intercalado entre imports corre **después** de que ya se resolvieron.
  `app.ts` tenía `import dotenv from "dotenv"; dotenv.config(); import authRoutes from ...`, y
  `auth.routes` carga `lib/jwt.ts`, que lee `JWT_SECRET` al importarse: la API tiraba "JWT_SECRET
  falta" con un `.env` perfectamente válido. **Fix:** `import "dotenv/config"` como primer import.
  Antes de debuggear un `dotenv.config()` que "no carga nada", mirá si hay imports después.
- **2026-08-21 · Una clase de Tailwind cuyo nombre coincide con una regla del CSS legado no gana.**
  `styles.css` definía `.hidden { display: none !important }` y pisaba la utilidad `.hidden` de
  Tailwind: `hidden md:flex` quedaba invisible en todos los viewports. Costó ~12 llamadas de debug
  con `matchMedia` confirmando que la media query sí matcheaba. **Desaparece al borrar el CSS legado
  y usar shadcn/ui** (D-024). Si volvés a ver un estilo que "no aplica sin razón", buscá el nombre de
  la clase en cualquier CSS global antes de dudar de Tailwind.
- **2026-08-21 · Las corridas repetidas de `pnpm e2e` chocan con el rate limiter de login** (D-045,
  20 intentos / 15 min): los tests fallan por 429 y parece un bug de la app. El entorno de e2e tiene
  que setear `LOGIN_RATE_LIMIT_MAX` alto. No bajes el limiter en prod para que pasen los tests.
- **2026-08-21 · El proxy de nitro en dev convierte `POST` + `401` en `502`.** Reproducible al 100% y
  solo esa combinación (`GET 401`, `POST 400`, `POST 200` pasan bien). Vive en el dev-worker de
  Vite; en producción la API es otro origen y no hay proxy. **Consecuencia: credenciales inválidas
  muestran "No se pudo conectar con la API" en desarrollo.** No es regresión de una versión de h3:
  abarca al menos rc.22 y rc.25 (D-037). El **429 no cae en la trampa** — medido. Antes de debuggear
  un error de auth, comparate contra la API directo.
- **2026-08-21 · Las credenciales del seed son públicas, así que el límite es la BASE, no la
  password.** Están en el README y en los e2e. Lo que se controla es dónde se puede sembrar: con
  `DATABASE_URL` que no empiece con `file:`, el seed exige las variables o revienta (D-047).
- **2026-08-21 · `update: {}` / `doNothing()` no es "idempotente", es "no reconcilia".** El seed
  imprimía credenciales que no garantizaba: en una base ya existente conservaba la password vieja
  mientras el log anunciaba la nueva. Un seed de demo tiene que ser autoritativo sobre lo que publica.
- **2026-08-21 · `kysely`, `@libsql/*` y `@paralleldrive/cuid2` son ESM puro; con `moduleResolution:
  node16` un `import` normal typechequea rojo** (TS1479/TS1471) aunque corra bien. El patrón está
  centralizado en `src/lib/kysely.ts` y `src/lib/libsql-client.ts`: `require()` en runtime tipado con
  `typeof import("pkg", { with: { "resolution-mode": "require" } })`. Antes de cambiar
  `moduleResolution`, mirá si es este patrón el que falta.
- **2026-08-21 · Kysely no coacciona tipos de SQLite ni genera IDs/timestamps.** No hay `mode:
  "boolean"` ni `$defaultFn`. La coerción vive en `src/db/sqlite-type-plugin.ts` (por nombre de
  columna) y los IDs en `src/db/id.ts`. **Si agregás una columna booleana o de fecha, hay que sumarla
  al plugin — no hay chequeo del compilador que lo fuerce**; y todo `update` tiene que setear
  `updatedAt` a mano.
- **2026-08-20 · `storagePath` se filtraba en las cuatro respuestas de `/evidence`.** D-011 dice que
  la clave de almacenamiento jamás se expone; las rutas devolvían el registro completo, con la ruta
  absoluta en disco. Se detectó leyendo, no por un test. Cualquier endpoint nuevo que toque
  `Evidence` tiene que repetir la lista explícita de columnas (`EVIDENCE_SAFE_COLUMNS`).
- **2026-08-20 · Un comando de shell contiene datos, no solo código.** El guardia de Bash matcheaba
  la *mención* de `docs/` y `git push`, así que se bloqueó a sí mismo al escribirse. Matchear
  **invocaciones**, no menciones (`scripts/hooks/analyze-cmd.py` saca los heredoc antes de analizar).
  Misma familia: un escáner que vive dentro del corpus que escanea se encuentra a sí mismo.
- **2026-08-20 · Toda suite de tests tiene que ser hermética.** Correr la puerta con
  `GATE_ALLOW_DOCS=1` hacía que la suite de guardias heredara la variable y "pasara" sin verificar
  nada. Si el resultado depende del entorno de quien la llama, no es una suite.
- **2026-08-20 · Editar un `package.json` sin `pnpm install` produce un verde falso.** La API
  declaraba TS 6.0 con 5.9 instalado: el typecheck pasó, verificando con la versión vieja. La puerta
  compara el lockfile contra los `package.json` (`scripts/check-lockfile.py`) — textualmente, porque
  `--lockfile-only` **reescribe** lo que verifica.
- **2026-07-29 · Un artefacto derivado contradijo al entregable y nos hizo decidir mal.** Cuatro
  `.puml` regenerados desde los PDF de M1 tenían las flechas de la FSM invertidas; registramos un
  desvío (D-020) que **no existía**. El paquete canónico de M1 es `M1-D2-Architecture-and-Data-Models/`.
- **2026-07-29 · Las capturas de M2-D2 tienen datos mock, no datos de diseño.** M2-D1 lo dice: *"the
  maquette uses mock blockchain interactions"*. Lo normativo de una captura es la **estructura**
  (layout, componentes, jerarquía, estados); los **valores**, no. El panel del certifier muestra tres
  unidades del mismo proyecto en tres stages distintos y casi nos hace modelar stages por unidad,
  cuando el dominio dice que un desarrollo tiene un solo trámite (D-029).
- **2026-07-29 · Grepear solo `*.md` esconde entregables.** Buscamos "council of experts" en `docs/`
  con `--include="*.md"` y concluimos que no aparecía: estaba en un `.csv`. Grepeá sin filtro de
  extensión y verificá que el árbol esté completo antes de afirmar una ausencia.
- **2026-07-29 · Los PDF de este repo no se leen con la herramienta de lectura** (falta `pdftoppm`), y
  extraer el texto no alcanza para un diagrama: las flechas son trazos vectoriales. Renderizalos:
  `qlmanage -t -s 1800 -o <dir> archivo.pdf`.
- **Los tests E2E esperan la hidratación, no el DOM.** La app llega por SSR con formularios
  controlados: un click antes de que React monte hace submit nativo y recarga sin llamar a la API.
  Falla intermitente que parece de backend. Ver `waitForHydration` en `e2e/walkthrough.spec.ts`.
- **`test.fail()` a nivel `describe` aplica a todos los tests que siguen.** Para marcar uno suelto va
  **dentro** del cuerpo. Puesto afuera hizo fallar los 16.
- **Usá selectores accesibles** (`getByLabel`, `getByRole`): fallan cuando la accesibilidad está mal,
  que es justo lo que querés.
- **Un `*.test.tsx` dentro de `src/routes/`** lo escanea el router y avisa "does not export a Route":
  prefijalo con `-`. Y `vitest` excluye `e2e/` explícitamente porque su `include` matchea `spec`.
- **El badge de TanStack Devtools sale en las capturas.** El helper `shot()` lo esconde; para
  capturas nuevas usá ese helper, no `page.screenshot` pelado.

## Detalles por frente

**`apps/web`.** Mobile-first: todo flujo funciona en una columna de ~380px (M2-D3 §Principio 4); en
desktop el `BottomNav` se reemplaza por sidebar con los mismos items en el mismo orden. Los strings
en español son 20-30% más largos que en inglés: dimensioná al contenido, nada de anchos fijos salvo
FAB e íconos. Los puertos salen de `ports.ts` (default 3000/8787).

**`packages/api`.** Checklist de endpoint nuevo: (1) schema Zod en `packages/shared` **antes** que el
endpoint; (2) ruta con `requireRole` + `canAccessProject` diciendo **qué membresías** acepta
(`ANY_MEMBERSHIP` si alcanza con ser miembro — omitirlo no compila, D-042); (3) `safeParse` → 400 con
`error.flatten()`; (4) `writeAuditLog` si es mutación relevante; (5) test del camino feliz y de cada
rechazo; (6) path y test ID **idénticos** a los de M2-D5. Los tests corren contra una base SQLite
propia (`test.db`) sembrada por corrida, aplicando las **migraciones reales** — nunca contra `dev.db`.

**`packages/shared`.** El `typecheck` reconstruye este package antes de verificar: verificar contra
un `dist` viejo es un verde falso. Todo schema de respuesta va `z.strictObject` — sin eso Zod
descarta claves desconocidas en silencio y un `passwordHash` filtrado pasaría sin que nadie se
entere. Las fechas viajan como string ISO en UTC.

**`contracts/`.** Aislado del workspace pnpm, corre en paralelo sin bloquear a nadie. Tiene **0
tests** contra un criterio del SOM que pide **≥95% de coverage** — es el único criterio duro sin plan
B, y el más atrasado del proyecto.
