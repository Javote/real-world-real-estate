# Stack — inventario completo

> **Los entregables oficiales son agnósticos de stack.** El único requisito técnico comprometido
> con Catalyst es que los contratos sean en **Aiken**. Todo lo demás es nuestro, y cambiarlo
> requiere una decisión nueva en `DECISIONS.md` — no una edición de estas tablas (D-022).
>
> **Este documento se escribe contra la realidad, no contra las intenciones** (principio 5). Una
> fila marcada ○ significa que la decisión existe y el código **no**: leerla como si estuviera
> hecha es cómo tres documentos llegaron a describir una infraestructura que no existe.

**Estado:** ● corre hoy · ◐ parcial · ○ decidido, sin ejecutar · ? abierto

---

## 1 · Workspace y lenguaje

| Pieza | Versión | Estado | Decisión |
|---|---|---|---|
| pnpm workspaces — `apps/*` (desplegable) + `packages/*` (librería); `contracts/` en el repo pero **fuera** del workspace | `pnpm@9.15.0` | ● | D-001, D-055 |
| Node | `engines: >=22.12` · `.nvmrc` · CI y Render usan **22** | ● | D-001, D-054 — `>=20` era falso: Nitro pide `^20.19 \|\| >=22.12` y el `require(esm)` de la API necesita 22.12 |
| TypeScript, estricto, unificado en los tres packages | `6.0.3` | ● | `archive/SPEC-008` |
| Resolución de módulos | `node16` en api y shared · `bundler` en web | ● | `archive/SPEC-008` |

No hay `tsconfig.base.json`: se borró por no gobernar nada. Los tres packages tienen su propio
`tsconfig.json` autocontenido, y esa autonomía es deliberada — la resolución de módulos difiere
entre web y los packages de Node.

## 2 · Frontend — `apps/web`

> **Cambia con D-065**: se suelta TanStack **Start** (SSR) y queda TanStack **Router** sobre Vite,
> como SPA servida estática, con PWA. La evidencia fue medida: `grep` de
> `createServerFn|createServerRoute|loader:|beforeLoad:` daba **cero** — pagábamos un runtime de
> servidor que no usábamos.

| Pieza | Versión | Estado | Nota |
|---|---|---|---|
| TanStack Router + Query | `1.170` / `5.90` | ● | rutas por archivo, `routeTree.gen.ts` generado |
| ~~TanStack Start (SSR)~~ | `1.168.28` | ✂ | se saca (D-065) |
| ~~Nitro~~ | `3.0.260610-beta` | ✂ | se va con Start. D-037 y D-050 fueron su costo de mantenimiento |
| React | `19.2.7` | ● | |
| Vite | `8.1.4` | ● | pasa a ser el build completo |
| Tailwind CSS | `4.3.2` | ● | vía `@tailwindcss/vite`; los tokens van en `@theme` |
| Lucide (iconos) | `0.545` | ● | M2-D3 reserva pares icono-significado |
| **shadcn/ui** | — | ○ | D-024. Primitivos accesibles para los componentes de M2-D3 |
| **Tokens de diseño de M2-D3** | — | ○ | D-024. Se **transcriben**, no se eligen |
| **Cliente del contrato** (`@orpc/client`) | — | ○ | D-066. Reemplaza el espejo escrito a mano de `api/types.ts` |
| **PWA** (manifest + service worker) | — | ○ | D-065. Desde el arranque, no al final |
| **i18n es-AR/en-US** | `245 líneas` | ◐ | D-025. La maquinaria existe; conviven 36 strings hardcodeados |
| Vitest + jsdom + Testing Library | `4.1.10` | ● | |
| Playwright (E2E) | `1.62` | ● | solo Chromium · **no corre en CI**, a mano |

El front se reconstruye desde los entregables: ver [`SPEC-014`](SPEC-014-reconstruccion-del-front.md)
por qué se conserva y qué se borra.

## 3 · Backend — `apps/api`

| Pieza | Versión | Estado | Nota |
|---|---|---|---|
| Express | `5.2.1` | ● | D-054 — v4 no reenviaba los rechazos de handlers `async` al errorHandler: colgaba la request y mataba el proceso |
| **Kysely** (sobre `@libsql/client`) | `0.29.5` | ● | Migración **terminada**: Prisma → Drizzle (D-048) → Kysely (D-049), las dos el 2026-08-21. Desde D-052 no queda rastro de ninguno de los dos en el árbol ni en el lockfile |
| Zod | `4.4.3` | ● | D-035. Rutas heredadas aún con formas de la 3, que v4 acepta |
| JWT (`jsonwebtoken`) | `9.0.3` | ● | 7 días, con revalidación de `isActive` por request |
| **bcrypt** (módulo nativo) | `5.1.1` | ◐ | cost 10. Es el origen del warning de `url.parse()` vía `node-pre-gyp`. El costo de "toolchain en la imagen" **murió con D-041**: no hay imagen |
| Multer | `2.2.0` | ● | D-036 |
| helmet | `8.3.0` | ● | D-054. Cero dependencias transitivas. Con `x-powered-by` desactivado y 404 en JSON |
| `express-rate-limit` | `8.6.2` | ● | D-045. Solo sobre `POST /auth/login`. Store en memoria: alcanza con **una** instancia, que es lo que da el free tier (D-040) |
| dotenv | `16.6.1` | ● | `import "dotenv/config"` como primer import, nunca `dotenv.config()` intercalado |
| Vitest + supertest | `4.1.10` / `7.2.2` | ● | 95 tests, base SQLite propia migrada con el runner real |

Base `/api/v1`. De los ~80 endpoints del backlog de M2-D5, **conforman 2**. Los 12 con alcance de proyecto aplican la segunda capa como middleware (SPEC-012).

## 4 · Contrato compartido — `packages/shared`

| Pieza | Versión | Estado | Nota |
|---|---|---|---|
| Zod como contrato único API↔web | `4.4.3` | ◐ | `archive/SPEC-008`: auth migrado; el resto migra con el contrato oRPC (D-066) |

Es lo único que vuelve el drift API↔web *imposible* en vez de prohibido. La mecánica de
resolución (por qué `types` apunta al `.d.ts` y no al fuente) está en `packages/shared/CLAUDE.md`.

## 5 · Contratos inteligentes — `contracts/`

| Pieza | Versión | Estado | Nota |
|---|---|---|---|
| Aiken | `v1.1.21` (CLI local y CI pineados) | ● | |
| **Plutus** | **V3** | ● | D-019 — desvío del SOM, que dice V2. V3 es lo que Aiken 1.1.x emite |
| `aiken-lang/stdlib` | `v3.0.0` | ● | |
| Blueprint `plutus.json` | commiteado, CI verifica que esté al día | ● | D-017 |
| Validador | `validators/stage.ak` | ● | Datum alineado con `M1-D2` y firma del operador; reescrito por D-057 |
| `lib/` puro y testeable | `lib/propnexus/fsm.ak` | ● | D-008: tipos, tabla de transiciones y reglas del datum, sin contexto de tx |
| Quien llama al validador | `packages/cardano` — `AnchorPort`: `simulated` y **`real` con Lucid Evolution 0.6.2** | ● | SPEC-013 §A y §B cerradas: transacciones verificadas contra el `Emulator` y contra un devnet local (yaci-devkit `0.10.6`, Conway + PlutusV3). Falta §C (reconciliar + `verify` público) |
| Infra local | `compose.dev.yml`: MinIO + yaci-devkit | ● | No se despliega (D-041). Los dos tests de integración corren a mano, no en CI |
| **Tests** | **72** (39 núcleo + 33 validador) | ● | Criterio 2 del SOM: la tabla punto de rechazo → test está en `contracts/CLAUDE.md` |
| Thread token + handler `mint` | NFT por stage, asset name = `stage_ref`, sin burn | ● | D-058 cierra lo que D-008 prometía: un solo hilo por stage, y nacimiento validado |
| Firmante | el operador (`admin`), único | ● | D-058: decisión del dueño, y es lo que el whitepaper §System Overview describe |
| Naming del proyecto | `propnexus/stage-fsm`, `version = "1"` | ● | D-015 cumplido (entero incremental) desde D-054 |

Ningún validador custodia ni transfiere valor, en ninguna fase (D-021).

## 6 · Datos y almacenamiento

| Pieza | Hoy | Destino | Estado | Decisión |
|---|---|---|---|---|
| Base de datos | **SQLite** (`.data/dev.db`, Kysely sobre `@libsql/client`) | **SQLite** vía **Turso** en prod (free: 5 GB · 500M lecturas · 10M escrituras) | ● — creada y migrada el 2026-08-27 (`propnexus`, org `javote`); verificada contra la instancia desplegada | D-038 · D-040 — Turso **obligatorio**, no preferencia: en free no hay disco. ORM: D-048 → D-049 |
| Migraciones | SQL plano en `apps/api/migrations/`, **una sola** (`0000_init.sql`, D-063), tracking propio (`_migrations`), **un solo runner** (D-052) | idempotentes en el `startCommand` | ● — verificado sobre el **compilado**, contra base nueva y re-aplicando | D-012 · D-049 |
| Archivos de evidencia | `STORAGE_DRIVER=disk` por default; **`s3` implementado y probado contra MinIO** | **Cloudflare R2** en prod (free: 10 GB, egress $0) — mismo código, otras variables | ◐ — el port existe (`apps/api/src/lib/storage.ts`) y con `s3` el SHA-256 cubre los bytes guardados; las variables están declaradas en `render.yaml`. Falta crear el bucket de R2 y cargar las claves (RUNBOOK §1.4) | D-011 · D-040 · D-051 |
| URLs de archivos | descarga por endpoint autenticado | prefirmadas, TTL ≤15 min | ○ | D-011 |
| Base de tests | SQLite propia (`apps/api/test.db`), migrada y sembrada por corrida | — | ● | `archive/SPEC-008` |

## 7 · Blockchain

> Auditado el **2026-08-23**, después de SPEC-013 §A y §B. Antes esta sección decía "el package
> está vacío" en cuatro filas: era cierto hasta D-060.

| Pieza | Estado | Decisión |
|---|---|---|
| Red: **Preprod en todos los entornos**. Mainnet fuera del alcance de M3 | ● (por configuración) | D-013 |
| `packages/cardano` con `AnchorPort` (`openThread`/`advanceThread`/`anchorEvidence`/`verify`/`awaitConfirmation`) | ● | D-014 · D-060 |
| Adaptador `simulated` (determinístico, con ledger propio; es producto, no stub) | ● | D-014 · D-060 |
| Adaptador real: **Lucid Evolution `0.6.2`** | ● — probado contra el `Emulator` y contra un devnet local | D-005 |
| Códec del datum ⇄ `Data` de Plutus, con valor dorado fijado también en Aiken | ● | SPEC-013 |
| Dirección y policy derivadas del blueprint (nada hardcodeado, regla 11) | ● | SPEC-013 |
| Anclaje de evidencia: metadata de tx, label `1904`, strings ≤64 bytes | ● — lo dispara el admin | D-006 · D-061 |
| Merkle root del bundle en el datum, verificado por el validador | ● | D-061 |
| Devnet local (yaci-devkit `0.10.6`, Conway + PlutusV3) | ● — `compose.dev.yml` | SPEC-013 |
| Provider contra Preprod: **Blockfrost** | ○ — en local se usa Kupmios; ver `packages/cardano/CLAUDE.md` | D-005 |
| Cuenta Blockfrost (proyecto Preprod) | ○ — **no creada** | — |
| Wallet de servicio (seed nueva y exclusiva de Preprod, fondeada por faucet) | ○ — **no creada** | 🔴 |
| Reconciliación y `verify()` público sin cuenta | ○ — rebanada C | SPEC-013 |
| Co-firma CIP-30 para notario/certificador | — **sin alcance en el validador** | D-009 · D-058 |

## 8 · Infraestructura y despliegue

> **Del 0% al deploy configurado (2026-08-23).** Existe `render.yaml` en la raíz y
> `specs/RUNBOOK-deploy.md`. Lo que falta ya no es código ni configuración: son **tres altas de
> cuenta** (Render, Turso) y pegar cuatro variables. El procedimiento exacto está en el runbook y
> **no se repite acá**.
>
> **No hay Dockerfiles y no los va a haber** (D-041): runtime nativo de Node. Si ves una fila
> pidiendo una imagen, es deuda de D-010, que era una decisión de Railway.

| Pieza | Estado | Decisión |
|---|---|---|
| **`render.yaml`** (Blueprint: 2 servicios, `plan: free`, `rootDir`, `buildFilter`) | ● — **escrito** | D-041 |
| Runtime: **nativo de Node**, sin imagen propia · `NODE_VERSION=22` (la del CI) | ● — declarado | D-041 |
| `startCommand` de la API: migraciones **y después** el servidor | ● — verificado sobre el compilado | D-012 · D-040 |
| Script `start` de `apps/web` (`node .output/server/index.mjs`) | ● — respeta `PORT`, verificado | D-041 |
| Script `start` de `apps/api` (`node dist/src/server.js`) | ● | — |
| `healthCheckPath`: `/health` en la API, `/` en el web | ● — declarado | D-010 |
| **Proxy `/api/**` del web hacia la API** (route rules de Nitro, horneadas en el build) | ● — **sin CORS y sin URL de API en el navegador**; el `502` en `POST`+`401` cerrado | D-050 |
| `API_ORIGIN` es **build time**, no runtime — cambiarla exige redeploy del web | ● — documentado en el YAML y el runbook | D-031 (`ports.ts`) |
| `JWT_SECRET` con `generateValue: true` | ● — declarado | D-042 |
| `TRUST_PROXY_HOPS=1` (con 0 detrás del proxy la app queda inusable) | ● — declarado | D-045 |
| Plataforma: **Render**, build por servicio, GHA no despliega | ◐ — **cuenta no creada** | D-039 · D-010 |
| Base **Turso** (`DATABASE_URL` + `DATABASE_AUTH_TOKEN`, `sync: false`) | ◐ — **base no creada** | D-038 |
| **Todo el deploy en free tier — $0/mes** | ● — restricción respetada por el YAML | D-040 |
| Presupuesto: **750 instance-hours/mes** compartidas · **keep-warm prohibido** | ● — documentado en el YAML y el runbook §5 | D-040 |
| Cold start ~1 min tras 15 min de inactividad | ● — se calienta a mano antes de demo/grabación | D-040 |
| Evidencia: `UPLOAD_DIR=/tmp/uploads`, **efímero y marcado** | ● — aceptado a conciencia | **D-051** |
| Seed de las cuentas demo: desde tu máquina contra Turso (free no da shell) | ● — procedimiento en el runbook §1.3 | D-047 |
| **Runbook** (deploy / rollback / incidente) | ● — `specs/RUNBOOK-deploy.md` | criterio 14 |
| Worker de confirmaciones: **cron de GHA**, no background worker | ○ — nada que disparar todavía (`packages/cardano` vacío) | D-040 · D-003 |
| Entorno de **pre-producción con URL pública** | ◐ — a un `render login` de distancia | criterio 12 |
| Telemetría / métrica *reserva → escrow < 12 min* | ○ | criterio 9 · D-021 |
| Monitoreo y capturas de monitoreo | ○ — hoy solo los logs de Render | criterio 14 |
| Versionado de servicios: CalVer `vYYYY.MM.N` en tags | ○ — sin releases | D-015 |
| Backups de la base | ○ — Turso free trae 1 día de point-in-time restore (runbook §3) | D-038 · D-040 |

## 9 · Verificación

| Pieza | Versión / detalle | Estado |
|---|---|---|
| GitHub Actions: dos jobs **en paralelo** (`App TS` + `Contratos Aiken`) | `checkout@v7`, `setup-node@v7` (Node 22), `pnpm/action-setup@v6`, `setup-aiken@v1` | ● |
| `pnpm verify` — **app TS**: lint + typecheck + tests + build | — | ● |
| `pnpm contracts:verify` — **Aiken**: fmt + check + build. Separado a propósito (D-054) | — | ● |
| `pnpm verify:all` — las dos cadenas encadenadas | — | ● |
| **Biome 2.5.10** — formateador + linter, uno solo para todo el workspace | `2.5.10` | ● — D-054. Antes no había ninguno, y `pnpm lint` corría sin hacer nada |
| `pnpm install --frozen-lockfile` — falla si el lockfile no refleja los `package.json` | — | ● |
| Tests: **127** (web 16 · api 95 · shared 16) · contratos **0** | 15 archivos | ◐ |
| Coverage medido | — | ○ — el criterio 2 pide ≥95% en contratos |
| Análisis estático / scan de dependencias | — | ○ — criterio 11 |
| E2E Playwright | `1.62`, solo Chromium | ● pero **fuera de CI**, por decisión |
| **Harness de agentes** (puerta, hooks, subagentes, skills, worktrees) | — | **borrado el 2026-08-23 (D-053)** |

El harness existió tres días y son 1099 líneas que ya no están. El porqué —cinco commits de arreglo
a sí mismo, cero bugs reales detectados, y que el CI declarativo existía desde el día 1 y hacía casi
lo mismo— está en **D-053**.

**La única deuda que la poda dejó abierta se cerró el mismo día:** la segunda capa de autorización
(regla 5) pasó a ser el middleware `requireProjectAccess` (SPEC-012), así que se lee en la firma de
la ruta en vez de depender de un escáner. Ninguna ruta llama ya a `canAccessProject`.

## 10 · Lo que NO está decidido

| Pregunta | Default vigente | Qué la cierra |
|---|---|---|
| ~~D-017 · `milestone.ak` vs `milestone2.ak`~~ | — | **Cerrada: D-054** (2026-08-23). No hizo falta spike: mismo hash de script |
| Vocabulario "certificate" en la UI | calificar levemente | postura del dueño (sub-ítem de D-026) |
| `/verify`: cómo se verifica **sin cuenta y sin confiar en la API** | la pantalla ya existe, pero exige sesión y verifica contra la API | M1-D1 promete verificación independiente; llega con `AnchorPort` (D-014) |
| Retención de datos | sin default | nunca se discutió (backups los cubre D-038) |
| ~~D-038 · cuándo migrar Prisma → Drizzle~~ | — | **Cerrada: D-048** (2026-08-21). Arranca antes de las rebanadas de M3, no diferida. |
| ~~D-048 · Drizzle como destino de ORM~~ | — | **Reabierta y cerrada: D-049** (2026-08-21). Drizzle → Kysely, sin evidencia técnica, postura del dueño del producto. |
| ~~D-038 · Turso vs disco Render + Litestream~~ | — | **Cerrada de hecho (2026-08-23): en free tier no hay disco, así que Litestream no tiene sobre qué correr.** `render.yaml` declara Turso |
| Gestor de secretos en pre-prod | variables de entorno de Render (`sync: false` + `generateValue`) | ya en uso; se reabre si aparece un secreto que rote |

## 11 · Deuda del stack

| Deuda | Costo de arrastrarla |
|---|---|
| **Nitro sigue en beta** | Sigue sin haber Nitro 3 estable. Pero **el `502` en `POST`+`401` ya no es deuda**: se cerró con `credentials: "omit"` al descubrir que era el spec de fetch y no h3 (D-050) |
| **Evidencia efímera en la instancia desplegada** | Un archivo subido no sobrevive al primer spin-down. Aceptado a conciencia y marcado (D-051); **vuelve a ser bloqueante el día del primer anclaje** |
| **`bcrypt` es nativo** | Más barata desde D-041: sin imagen propia, el toolchain lo absorbe el entorno de build de Render. Queda el warning de `url.parse()` vía `node-pre-gyp` y el riesgo genérico de módulo nativo. **La alternativa `bcryptjs` (JS puro, ~30% más lento) hoy conviene menos**: Render free da 0.1 CPU, donde los ~81 ms medidos en una máquina rápida se van a varios cientos. Detalle en `apps/api/CLAUDE.md` §Superficie 🔴. Es código 🔴: lo decide el humano |
| ~~**`contracts/` con 0 tests**~~ | **Cerrada** (D-057, D-058): 73 tests, con la tabla punto de rechazo → test en `contracts/CLAUDE.md`. Era la deuda más grande que quedaba |
| **`pnpm audit`: 1 crítica + 13 altas** | Casi todas cuelgan de `bcrypt` → `@mapbox/node-pre-gyp` → `tar`, y son cadena de **instalación** (corre en cada build de Render), no de request. D-046 ya dejó anotada la salida: `scrypt` de `node:crypto`, stdlib y cero dependencias. Es 🔴 y lo decide el humano |
| **`milestone` en el dominio** | D-023 pendiente; encarece con cada pantalla nueva |

---

## 12 · Inventario exhaustivo de dependencias

> Auditado el **2026-08-23** leyendo `package.json`, `pnpm-lock.yaml` y lo instalado en
> `node_modules` — no copiado de las tablas de arriba. Dos columnas a propósito: **declarado** es
> lo que pedimos, **resuelto** es lo que corre. Cuando difieren, lo que se rompe en producción es
> siempre lo resuelto.
>
> Las **transitivas** no se listan una por una: la fuente de verdad de esas 566 es `pnpm-lock.yaml`,
> y una copia en Markdown se desactualiza en el próximo `pnpm install` (principio 1). Se listan solo
> las que hay que conocer por algún motivo concreto (§12.6) y los duplicados que importan (§12.7).

### 12.1 · Toolchain y ejecución

| Pieza | Versión | Dónde se fija |
|---|---|---|
| **pnpm** | `9.15.0` | `packageManager` de `package.json` raíz — el CI lo toma de ahí |
| **Node (declarado)** | `>=20` | `engines` de `package.json` raíz |
| **Node (CI)** | `22` | `.github/workflows/ci.yml` |
| **Node (deploy)** | `22` | `NODE_VERSION` en `render.yaml` |
| **Node (máquina de esta auditoría)** | `24.14.1` — `undici` embebido `7.24.4` | local |
| **TypeScript** | `6.0.3` (declarado `^6.0.2`) — unificado en los tres packages | cada `tsconfig.json` |
| **Aiken** | `v1.1.21+42babe5` — pineado igual en local y en CI | `aiken.toml` · `setup-aiken@v1` |
| **Python** (scripts de la puerta) | `3.14.2` local; el del runner en CI | `scripts/*.py` |

`lockfileVersion: '9.0'`. `.npmrc`: `strict-peer-dependencies=false`, **`auto-install-peers=false`**
(lo segundo es deliberado y está medido — §12.7).

**Los tres `tsconfig` son autocontenidos y difieren a propósito** (no hay `tsconfig.base.json`):

| Package | target | module / resolución | notas |
|---|---|---|---|
| `apps/web` | `ES2022` | `ESNext` / `bundler` | `jsx: react-jsx` · `verbatimModuleSyntax` · `noEmit` |
| `apps/api` | `ES2022` | `node16` / `node16` | CJS · `outDir: dist`, `rootDir: .` |
| `packages/shared` | `ES2022` | `node16` / `node16` | CJS · `outDir: dist`, `rootDir: src` |

### 12.2 · `apps/web` — dependencias de runtime

| Paquete | Declarado | Resuelto |
|---|---|---|
| `@plataforma/shared` | `workspace:^` | link local |
| `@tailwindcss/vite` | `^4.1.18` | **`4.3.2`** |
| `@tanstack/react-devtools` | `^0.10.8` | `0.10.8` |
| `@tanstack/react-query` | `^5.90.5` | **`5.101.2`** |
| `@tanstack/react-router` | `^1.170.18` | `1.170.18` |
| `@tanstack/react-router-devtools` | `^1.167.0` | `1.167.0` |
| `@tanstack/react-router-ssr-query` | `^1.167.1` | `1.167.1` |
| `@tanstack/react-start` | `^1.168.28` | `1.168.28` |
| `@tanstack/router-plugin` | `^1.132.0` | **`1.168.20`** |
| `lucide-react` | `^0.545.0` | `0.545.0` |
| `nitro` | `3.0.260610-beta` (exacto) | `3.0.260610-beta` |
| `react` | `^19.2.0` | **`19.2.7`** |
| `react-dom` | `^19.2.0` | **`19.2.7`** |
| `tailwindcss` | `^4.1.18` | **`4.3.2`** |

### 12.3 · `apps/web` — dependencias de desarrollo

| Paquete | Declarado | Resuelto |
|---|---|---|
| `@playwright/test` | `^1.62.0` | `1.62.0` |
| `@tailwindcss/typography` | `^0.5.16` | **`0.5.20`** |
| `@tanstack/devtools-vite` | `^0.8.1` | `0.8.1` |
| `@tanstack/router-cli` | `^1.132.0` | **`1.167.19`** |
| `@testing-library/dom` | `^10.4.1` | `10.4.1` |
| `@testing-library/react` | `^16.3.0` | **`16.3.2`** |
| `@types/node` | `^22.10.2` | **`22.20.1`** |
| `@types/react` | `^19.2.0` | **`19.2.17`** |
| `@types/react-dom` | `^19.2.0` | **`19.2.3`** |
| `@vitejs/plugin-react` | `^6.0.1` | **`6.0.3`** |
| `jsdom` | `^28.1.0` | `28.1.0` |
| `typescript` | `^6.0.2` | **`6.0.3`** |
| `vite` | `^8.0.0` | **`8.1.4`** |
| `vitest` | `^4.1.5` | **`4.1.10`** |

Playwright corre **solo Chromium**, en dos proyectos: `iPhone 13` (mobile) y `Desktop Chrome`
a 1440×900. No corre en CI, por decisión.

### 12.4 · `apps/api`

> Regenerada el **2026-08-23** leyendo lo instalado. La versión anterior de esta tabla decía
> `express ^4.21.2` y `@types/express` pineado a v4 — quedó vieja con D-054, que subió los dos a v5.
> Es el riesgo de una tabla de versiones escrita a mano: se desactualiza en silencio.

| Paquete | Declarado | Resuelto | Nota |
|---|---|---|---|
| `@aws-sdk/client-s3` | `^3.1116.0` | `3.1116.0` | storage S3: MinIO en dev, R2 en prod (D-011) |
| `@libsql/client` | `^0.17.4` | `0.17.4` | ESM puro — patrón `require()` de `lib/libsql-client.ts` |
| `@libsql/kysely-libsql` | `^0.4.1` | `0.4.1` | declara `@libsql/client: ^0.8.0` → §12.7 |
| `@paralleldrive/cuid2` | `^3.3.0` | `3.3.0` | IDs; ESM puro. **Es el `stage_ref` on-chain** (D-058) |
| `@plataforma/cardano` | `workspace:^` | link local | el `AnchorPort` (D-060) |
| `@plataforma/shared` | `workspace:^` | link local | |
| `bcrypt` | `^5.1.1` | `5.1.1` | **módulo nativo**, cost 10 (regla 4) |
| `dotenv` | `^16.4.5` | **`16.6.1`** | |
| `express` | `^5.2.1` | `5.2.1` | v5 desde D-054 |
| `express-rate-limit` | `^8.6.2` | `8.6.2` | solo `POST /auth/login`, store en memoria |
| `helmet` | `^8.3.0` | `8.3.0` | D-054 |
| `jsonwebtoken` | `^9.0.2` | **`9.0.3`** | HS256, 7 días |
| `kysely` | `^0.29.5` | `0.29.5` | ESM puro |
| `multer` | `^2.2.0` | `2.2.0` | D-036 |
| `zod` | `^4.4.3` | `4.4.3` | |
| *dev* `@types/bcrypt` | `^5.0.2` | `5.0.2` | |
| *dev* `@types/express` | `^5.0.6` | `5.0.6` | v5, alineado con `express` |
| *dev* `@types/jsonwebtoken` | `^9.0.9` | **`9.0.10`** | |
| *dev* `@types/multer` | `^2.2.0` | `2.2.0` | |
| *dev* `@types/node` | `^22.13.14` | **`22.20.1`** | |
| *dev* `@types/supertest` | `^6.0.2` | **`6.0.3`** | |
| *dev* `supertest` | `^7.0.0` | **`7.2.2`** | |
| *dev* `tsx` | `^4.19.3` | **`4.23.1`** | |
| *dev* `typescript` | `^6.0.2` | **`6.0.3`** | |
| *dev* `vitest` | `^4.1.5` | **`4.1.10`** | |

### 12.4b · `packages/cardano`

| Paquete | Declarado | Resuelto | Nota |
|---|---|---|---|
| `@lucid-evolution/lucid` | `^0.6.2` | `0.6.2` | D-005. ESM con build CJS |
| `@harmoniclabs/bytestring` | `^1.0.0` | `1.0.0` | **peer de Lucid, declarado a mano** |
| `@harmoniclabs/cbor` | `^1.6.6` | `1.6.6` | idem — **la 2.x rompe en runtime**, ver abajo |
| `@harmoniclabs/pair` | `^1.0.0` | `1.0.0` | idem |
| `@plataforma/shared` | `workspace:^` | link local | tipos del datum y la FSM |
| *dev* `@lucid-evolution/provider` | `^0.2.1` | `0.2.1` | solo por el `Emulator` de los tests |
| *dev* `@types/node` · `typescript` · `vitest` | | | igual que el resto |

**Los tres `@harmoniclabs/*` están declarados a mano y no es cosmético.** Son peers de Lucid, y
`auto-install-peers=false` (§12.7, D-052) significa que nadie los instala solo. Peor: **nadie
verifica la versión**, porque `strict-peer-dependencies=false`. `pnpm add @harmoniclabs/cbor` trae
la 2.x, `uplc@1.4.1` pide `^1.3.0`, y el síntoma es `TypeError: Right-hand side of 'instanceof' is
not an object` en el encoder, sin ninguna señal en el typecheck. Antes de tocar estas tres,
mirá el rango que declara quien las necesita.

### 12.5 · `packages/shared` y `contracts/`

| Paquete | Declarado | Resuelto |
|---|---|---|
| `zod` | `^4.4.3` | `4.4.3` |
| *dev* `typescript` | `^6.0.2` | `6.0.3` |
| *dev* `vitest` | `^4.1.5` | `4.1.10` |

`contracts/` no toca el workspace pnpm. Sus dependencias son dos y están en `aiken.toml` /
`aiken.lock`: compilador **`v1.1.21`**, `aiken-lang/stdlib` **`v3.0.0`** (github), Plutus **V3**.
El proyecto se llama `j/milestone-fsm` con `version = "0.0.0"` — scaffold, incumple D-015.

### 12.6 · Transitivas que hay que conocer

No están declaradas por nosotros, pero cada una explica un comportamiento del sistema:

| Paquete | Versión | Por qué importa |
|---|---|---|
| **`undici`** | `7.24.4` **embebido en Node** (el paquete `7.28.0` del árbol no es el que corre) | Es el `fetch` que usa el proxy. Su paso `401` del spec es la causa de D-050 — y la variable es la **versión de Node**, no la del paquete |
| `h3` | `2.0.1-rc.22` (es la que queda en el bundle; `rc.20` también está en el árbol) | El proxy y el `HTTPError` 502 salen de acá |
| `srvx` | `0.11.22` | servidor HTTP de h3 |
| `rou3` | `0.8.1` | router de h3 |
| `esbuild` | `0.28.1` | vía Vite |
| `lightningcss` | `1.32.0` · `@tailwindcss/oxide` `4.3.2` | binarios nativos de Tailwind v4 |
| `@mapbox/node-pre-gyp` | `1.0.11` | vía `bcrypt`. **Origen real del warning de `url.parse()`** — atribuido a Multer durante meses (D-036) |
| `body-parser` `1.20.6` · `qs` `6.15.3` | | vía Express 4 |
| `busboy` | `1.6.0` | vía Multer |
| `libsql` (binario nativo) | `0.5.29` | motor de `@libsql/client` |
| `playwright-core` | `1.62.0` | |
| `db0` | `0.3.4` | capa de base de Nitro. **Nada la usa** y arrastra §12.7 |

### 12.7 · Duplicados y peso muerto

**1 · `auto-install-peers=true` instalaba 225 MB de ORMs que nadie importa — cerrado (D-052).**
El `.npmrc` tenía `auto-install-peers=true`; `db0` (que viene con Nitro, y que nada de este repo
usa) declara `drizzle-orm` como peer **opcional**, y pnpm lo instalaba igual. `drizzle-orm` a su vez
arrastraba Prisma entero:

```
nitro → db0@0.3.4 → drizzle-orm@0.45.2 → prisma + @prisma/client → @prisma/engines
```

O sea que **Prisma se seguía instalando después de D-048 y D-049, que lo sacaron del proyecto**, y
Drizzle también, después de que D-049 lo reemplazara por Kysely. Se pagaba en cada build de Render,
donde el free tier es lento y el `pnpm install --frozen-lockfile` es la parte larga.

Medido con instalación **limpia** en los dos lados (borrando `node_modules` antes, para no comparar
contra residuo acumulado):

| | `auto-install-peers=true` | `auto-install-peers=false` |
|---|---|---|
| `node_modules` en disco | 559 MB | **334 MB** (−225 MB, −40 %) |
| Paquetes distintos en el lockfile | 566 | **541** |
| Entradas `nombre@versión` | 671 | **631** |

Sin peers faltantes, sin warnings nuevos, y las 108 pruebas y los dos builds verdes. `prisma`,
`@prisma/*` y `drizzle-orm` **ya no aparecen en el lockfile**.

**2 · `@libsql/client` está dos veces: `0.17.4` y `0.8.1`.** No es residuo, es real:
`@libsql/kysely-libsql@0.4.1` declara `^0.8.0`, y en versiones `0.x` el caret solo admite parches,
así que no dedupea. Consecuencia ya conocida y resuelta: `LibsqlDialect` recibe `{ url, authToken }`
en vez de un `Client` ya construido, porque los dos tipos `Client` no son asignables entre sí
(`apps/api/CLAUDE.md` §Trampas). Arrastra dos copias del binario nativo `libsql`.

**3 · Duplicados menores, todos benignos:** `rolldown` en dos versiones (con sus 15 binarios por
plataforma), `@oxc-project/types` en tres, `chokidar` 4/5, `debug` 2/4, `semver` 6/7. Ruido normal
de un árbol con Vite 8 y Nitro 3 beta conviviendo.

**4 · `node_modules/.pnpm` no es un inventario.** Guarda directorios de instalaciones anteriores
hasta que se podan: listarlo mostraba `zod@3.25.76`, `esbuild@0.18.20` y `h3@2.0.1-rc.25`, ninguno
de los cuales estaba en el lockfile. **Para "qué versión corre", la fuente es `pnpm-lock.yaml`**;
`.pnpm` responde otra pregunta. Es también por qué la medición de arriba se hizo con
`rm -rf node_modules` antes de cada lado.

### 12.8 · CI y acciones

| Acción | Versión | Job |
|---|---|---|
| `actions/checkout` | `v7` | los dos |
| `pnpm/action-setup` | `v6` | app — toma pnpm de `packageManager` |
| `actions/setup-node` | `v7` | app — Node `22`, `cache: pnpm` |
| `aiken-lang/setup-aiken` | `v1` | contratos — Aiken `v1.1.21` |

Dos jobs **independientes y en paralelo**, porque son dos toolchains distintos (D-054):
**`App TS`** (`--frozen-lockfile` → `lint` → `typecheck` → `test` → `build`) y **`Contratos Aiken`**
(`fmt --check` + `check` + `build` + que `plutus.json` esté al día). Ninguno espera al otro y
**ninguno despliega** (D-010).

### 12.9 · Recuento

| | Cuántos |
|---|---|
| Dependencias directas declaradas (los 3 packages, dep + dev) | **51** |
| Paquetes distintos en el lockfile | **541** |
| Entradas `nombre@versión` en el lockfile | **631** |
| Paquetes con más de una versión resuelta | **53** |
| Árbol transitivo de `apps/web` / `apps/api` / `packages/shared` | 400 / 377 / 154 |
| `node_modules` en disco (instalación limpia) | **334 MB** |
| Dependencias de `contracts/` | **1** (`aiken-lang/stdlib`) |
