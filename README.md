# PropNexus — Anclaje de Evidencia Inmobiliaria sobre Cardano

> Catalyst Fund Project **1400106** — *Real-World Real Estate Pre-Sale with Proof & Release*.
> Monorepo: **pnpm + TanStack Router/Vite** (web, SPA) + **Express 5 + Kysely** (api) + **Aiken / Plutus V3** (contratos).

Ventas inmobiliarias en pozo: estructura el ciclo de obra en **stages**, organiza la **evidencia**
(planos, fotos, permisos, certificados) y ancla **huellas criptográficas** (SHA-256 / Merkle) en
Cardano con timestamps verificables. Cuatro roles con superficie propia: **investor**, **developer**,
**notary**, **certifier**.

**Lo que la plataforma no hace:** no custodia ni transfiere dinero, en ninguna fase (D-021). No
sustituye registros públicos, procesos notariales ni autorizaciones estatales (M1-D1 §Non-Substitution).

## Jerarquía de precedencia (regla número uno)

Dos autoridades distintas: **`docs/` manda sobre las obligaciones** (el *qué* y la vara de
aceptación — entregables aprobados por reviewers, **inmutables**), y **`DECISIONS.md` > `CLAUDE.md`
> `specs/` mandan sobre la implementación** (el *cómo*).

**La regla completa —cuándo un desvío es legítimo, cómo se registra y cuáles están vigentes— vive
en el encabezado de `DECISIONS.md` y en D-022.** Acá no se repite: llegó a estar escrita en cuatro
archivos, que es exactamente lo que el principio 1 prohíbe.

El repo es la memoria; los chats son descartables.

## Requisitos previos

- **Node.js ≥ 22.12** y **pnpm ≥ 9** — la versión la fija `engines` del `package.json` raíz,
  y es la misma que corre el CI — `corepack enable && corepack prepare pnpm@latest --activate`
- **Docker**, opcional: levanta MinIO y el devnet de Cardano para las dos suites que necesitan
  infraestructura real (ver §Infraestructura local). Nada del arranque rápido lo necesita
- **Aiken v1.1.21** para los contratos:
  ```bash
  curl --proto '=https' --tlsv1.2 -LsSf https://install.aiken-lang.org | sh
  aikup install v1.1.21
  ```

## Arranque rápido

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # completar JWT_SECRET: openssl rand -hex 32
pnpm db:migrate                                  # crea la SQLite de dev
pnpm db:seed                                     # usuarios y proyecto demo
pnpm dev                                         # web en :3000, api en :8787
```

**En `/login` no hace falta tipear nada:** tocar la solapa del rol prefilla usuario y contraseña
del seed, que además los imprime al terminar.

| Solapa | Usuario | Aterriza en |
|---|---|---|
| Developer | `developer@example.com` / `developer123` | `/developer` |
| Certifier | `verifier@example.com` / `verifier123` | `/certifier` |
| Notary | `notary@example.com` / `notary123` | `/notary` |
| Investor | `buyer@example.com` / `buyer123` | `/investor/buy` |

`admin@example.com` / `admin123` existe pero **no tiene panel todavía**: el login es válido y el
ruteo lo devuelve a `/login`, que no es un error (SPEC-011 §Casos borde).

Son credenciales **de desarrollo y publicadas**, y por eso el seed solo las usa contra un SQLite
local: contra cualquier otra base se niega a correr sin `SEED_ADMIN_PASSWORD` (D-047).
Contratos: `pnpm contracts:check`.

## Verificación

Un comando, y es el mismo que corre el CI:

```bash
pnpm verify        # lint + typecheck + trazabilidad de test IDs + tests + build
```

`pnpm testids` es parte de `verify` y del CI: compara los test IDs del backlog de M2-D5 contra los
que el repo reclama, y falla si alguien inventa uno que el entregable no declara o si la cobertura
baja del piso. `pnpm test:coverage` corre la suite de la API con umbrales.

El linter y el formateador son **Biome** (`pnpm lint:fix` arregla lo mecánico). El CI corre lo
mismo, más un job de E2E (Playwright, **no bloqueante** por ahora) y el job de Aiken (`fmt --check`, `check`, `build` y que `plutus.json` esté al día) y
`pnpm install --frozen-lockfile`, que falla si el lockfile no refleja los `package.json`.

**No hay harness.** Hubo uno entre el 2026-08-20 y el 2026-08-23 —puerta ejecutable, hooks
bloqueantes, subagentes, skills, árboles por track— y se borró entero: 1099 líneas que en tres días
necesitaron cinco commits de arreglo a sí mismas y no atajaron ninguno de los bugs reales del
período. El razonamiento completo, con los números, está en **D-053**.

Lo que queda como regla escrita y no como bloqueo: no editar `docs/` (es una copia de los
entregables aprobados), no editar una migración ya aplicada, no commitear secretos.

## Variables de entorno

**Un archivo por servicio, y son la referencia:** [`apps/api/.env.example`](apps/api/.env.example)
y [`apps/web/.env.example`](apps/web/.env.example). Acá no se copian — una lista duplicada se
desactualiza en la copia, no en el original.

Lo único que no se deduce leyéndolos:

- **`JWT_SECRET` es obligatoria y no tiene default.** Si falta o queda vacía, la API **no arranca**.
  Es a propósito (D-042): el free tier no da shell para ir a mirar qué variables quedaron cargadas,
  así que el fallo tiene que ser el arranque y no una request de producción.
- **Las de `apps/web` son de build time.** Cambiarlas exige rebuild, no restart.
- **`TRUST_PROXY_HOPS` vale 0 en local y 1 detrás de Render.** Con 0 detrás del proxy, todos los
  clientes comparten balde de rate limit y la app queda inusable (D-045).

**Secretos solo por env.** Si ves una seed o una key commiteada: frenar y avisar.

## Deploy

Todo corre en **free tier, $0/mes** — y eso es una restricción de arquitectura, no una nota de
presupuesto (D-040). El artefacto es **`render.yaml`** en la raíz: dos servicios Node sobre Render
(sin Docker, D-041) contra una base **Turso**.

**El procedimiento completo —alta, deploy diario, rollback, incidentes y limitaciones— está en
[`specs/RUNBOOK-deploy.md`](specs/RUNBOOK-deploy.md).** Acá solo lo que hay que saber antes de abrirlo:

- Falta **crear las cuentas** (Render, Turso) y pegar cuatro variables. No falta código.
- **El web ya no proxea.** Desde D-065 es una SPA estática y vive en otro origen, así que el
  navegador sí ve la URL de la API y sí hay CORS: la API acepta al web por **lista blanca**
  (`WEB_ORIGIN`), nunca con `*`.
- `VITE_API_ORIGIN` es de **build time**: cambiarla exige redeploy del web, no un restart.
  `WEB_ORIGIN`, del lado de la API, es de runtime y toma con un restart.
- **Keep-warm está prohibido.** Dos servicios despiertos 24/7 son ~1460 h contra las 750 del plan
  y quedan suspendidos cerca del día 15. Se calienta la URL a mano antes de una demo.
- **La evidencia persiste en Cloudflare R2**, no en el filesystem — que sigue siendo efímero y
  sigue estando bien que lo sea: `UPLOAD_DIR` es solo el staging de Multer. Lo que hay que vigilar
  es el techo de 10 GB del free tier.

## Pasos de infraestructura pendientes

Todavía no ejecutados; hacen falta para el **anclaje real**, no para el deploy:

1. **Blockfrost** — crear cuenta, proyecto **Preprod**, setear `BLOCKFROST_API_KEY`.
2. **Wallet de servicio** — generar una seed *nueva y exclusiva de Preprod* para que el backend firme
   las transacciones de anclaje, y fondearla desde el [faucet de testnet](https://docs.cardano.org/cardano-testnets/tools/faucet).
3. **`packages/cardano`** — el `AnchorPort`, el adaptador simulado y el **real** existen
   (`SPEC-013` §A y §B), el real está probado contra el `Emulator` y contra un devnet local, y desde
   el 2026-08-27 el factory lo **cablea**: `ANCHOR_MODE=real` construye Lucid sobre Blockfrost con la
   wallet de servicio, y la API no arranca si falta configuración (D-042). Ahora sí es cierto que lo
   que falta no es código, sino la cuenta y la wallet de los puntos 1 y 2.

   ⚠ **La seed no se puede rotar.** La dirección del script se deriva del admin, que sale de esta
   wallet: cambiarla obliga a migrar todos los hilos ya anclados. Generala para quedarse.

El inventario honesto de qué existe y qué no está en [`specs/stack.md`](specs/stack.md) §8 y §12.

## Índice documental

### Documentación oficial (inmutable)

> `docs/` contiene **únicamente entregables** (D-033). El mapa de qué archivo es qué entregable
> está en `specs/entregables.md`, que sí se puede mantener.

| Ruta | Contenido |
|---|---|
| `docs/milestone-1-fundamentos/` | Whitepaper + arquitectura de sistema, modelo de dominio, ciclo de vida y flujo de anclaje (UML). |
| `docs/milestone-2-diseno/` | Arquitectura de información, catálogo de pantallas, biblioteca de 36 componentes, 10 patrones de renderizado de prueba. |
| `docs/milestone-3-implementacion/` | SOM de M3 + backlog de 53 entradas (pantalla → endpoint → test ID) + baseline de backend y contratos. |

### Documentación de trabajo (viva)

Deliberadamente **tres archivos en la raíz y nada más**. Todo lo demás vive indexado dentro de una carpeta.

| Archivo | Contenido |
|---|---|
| `CLAUDE.md` | **Cómo se trabaja acá** —el loop de captura + fila de M2-D5— más vocabulario, reglas duras, prohibiciones, autonomía 🟢🟡🔴, commits, comandos y trampas. Solo información vigente. |
| `<frente>/CLAUDE.md` | Lo propio de cada subárbol: qué leer, trampas verificadas, deuda y comandos. Se cargan solos al tocarlo. |
| `DECISIONS.md` | **Las restricciones vigentes**, una o dos líneas cada una: qué obliga hoy. El argumento largo vive en `specs/archive/` (D-068). |
| `specs/archive/` | La memoria: las 63 decisiones originales enteras y las specs de trabajo ya cerrado. Se consulta, no se mantiene. |
| `specs/README.md` | **El mapa de desarrollo:** criterios de aceptación de M3, estado medido, rebanadas en orden de dependencia, tracks paralelos, riesgos. |
| `specs/SPEC-NNN-*.md` | Una por rebanada: invariantes, casos borde (que son los tests) y definición de terminado. |
| `specs/stack.md` | **Inventario completo del stack:** front, back, contratos, datos, blockchain, infraestructura y verificación, con qué corre hoy y qué está solo decidido. |
| `specs/entregables.md` | **Mapa de los entregables oficiales:** qué archivo es cuál y qué contiene. Es un mapa, no una transcripción: ante una duda de contenido, abrí el entregable. |

## Estructura del monorepo

**Un repo git, dos sistemas de build.** La app TypeScript es un monorepo pnpm (un lockfile, un
`pnpm install`, dependencias entre paquetes por `workspace:^`). `contracts/` está en el mismo repo
pero **fuera** de ese workspace: lo construye `aiken` con su propio lockfile.

La convención es una sola y no tiene excepciones (D-055): **`apps/` se despliega, `packages/` se
importa.**

```
plataforma/
├── apps/
│   ├── api/                    # Express 5 + Kysely + SQLite dev — servicio en Render
│   │   ├── migrations/         #   SQL escrito a mano, un solo runner (D-052)
│   │   ├── src/
│   │   └── test/
│   └── web/                    # TanStack Router + Vite (SPA) + Tailwind v4 — static site en Render
├── packages/
│   ├── shared/                 # contrato Zod API↔web: lo importan los dos
│   └── cardano/                # AnchorPort: la cadena detrás de una interfaz (simulado y real)
├── contracts/                  # Aiken · Plutus V3 — no se hostea, toolchain aparte
│   ├── validators/stage.ak     #   el validador de la FSM + sus tests
│   ├── lib/propnexus/fsm.ak    #   núcleo puro: tipos, transiciones, datum
│   └── plutus.json             #   blueprint, se commitea tras cada build
├── docs/                       # entregables aprobados de M1/M2/M3
├── specs/                      # specs, plan, runbook de deploy, stack
├── scripts/check-testids.mjs   # trazabilidad backlog M2-D5 → test IDs (corre en verify y CI)
├── .github/workflows/ci.yml    # App TS · E2E (no bloqueante) · Contratos Aiken
├── biome.json                  # linter + formateador (no mira contracts/)
├── compose.dev.yml             # infra LOCAL: MinIO + devnet de Cardano (no se despliega, D-062)
└── render.yaml                 # Blueprint de deploy (2 servicios, free tier)
```

## Estado

M1 y M2 entregados. **M3 en construcción** — su alcance es el backlog completo de `M2-D5`,
corriendo íntegramente en **Preprod** (D-013). Mainnet y producción quedan fuera de alcance.

Medido al 2026-08-24: **API 64/64 endpoints** del backlog, **modelo de datos 7/7 entidades**,
**front 27/53 superficies (51%)** con Notary y Certifier completos, y **530 tests**. Los contratos
compilan y están probados, pero `ANCHOR_MODE=real` todavía lanza excepción: **nunca se ancló nada
en Preprod**, y eso es lo que bloquea la URL pública, los TXIDs de prueba y el video.

**El estado medido —conformidad, qué bloquea el arranque, rebanadas, tracks paralelos y riesgos—
vive en `specs/README.md` y solo ahí.** Un número de estado copiado en dos archivos se desactualiza
en uno de los dos.

## Carpetas públicas y privadas

Este repositorio es **público**. No contiene, en ninguna carpeta, secretos, credenciales, seeds de
wallet ni datos personales: los secretos viajan **solo por variables de entorno** y nunca se
versionan (regla 12 de `CLAUDE.md`).

| Ruta | Visibilidad | Qué contiene |
|---|---|---|
| `apps/`, `packages/`, `contracts/`, `.claude/`, `.github/` | **Pública** | Código, contratos y CI |
| `docs/`, `specs/`, `README.md`, `CLAUDE.md`, `DECISIONS.md` | **Pública** | Entregables oficiales y documentación de trabajo |
| `apps/api/.env`, `apps/web/.env` | **Privada** — nunca versionada | Secretos locales. El ejemplo público es `.env.example` |
| `apps/api/.data/` | **Privada** — nunca versionada | Bases SQLite locales: `dev.db` y las de la suite |
| `apps/api/uploads/` | **Privada** — nunca versionada | Evidencia subida en runtime |
| `apps/web/e2e/.artifacts/` | **Privada** — nunca versionada | Capturas, videos y traces de la suite E2E |

La wallet de servicio de Preprod y la API key de Blockfrost se configuran por entorno en el
proveedor de deploy y **no existen en el repositorio**.

## Reglas duras del equipo

Viven en un solo lugar: **`CLAUDE.md`** (reglas duras + prohibiciones) con las decisiones que las
respaldan en **`DECISIONS.md`**. Este README no las duplica — cualquier copia divergiría en
silencio, y preferimos el link.

## Infraestructura local (Docker)

`compose.dev.yml` levanta lo que en producción es un tercero. **No se despliega**: el deploy usa
runtime nativo de Node, sin Docker (D-041).

```bash
docker compose -f compose.dev.yml up -d          # MinIO en :9000 (consola :9001) + devnet de Cardano
pnpm --filter @plataforma/api test:s3            # storage contra MinIO de verdad
pnpm --filter @plataforma/cardano test:yaci      # anclaje contra un nodo Cardano de verdad
```

El devnet (yaci-devkit) da **Conway con Plutus V3** y bloques de 1 segundo:

| Servicio | Puerto | Para qué |
|---|---|---|
| yaci-store | `8080` | API compatible Blockfrost (`/api/v1`) |
| Ogmios · Kupo | `1337` · `1442` | el provider que usa Lucid en local |
| admin del devkit | `10000` | fondear una address (`/local-cluster/api/addresses/topup`) — el faucet local |

Ninguno de los dos tests corre en CI: el CI no levanta infraestructura. Se corren a mano.

Para que la API guarde la evidencia en MinIO en vez del disco:

```bash
STORAGE_DRIVER=s3 S3_ENDPOINT=http://localhost:9000 S3_BUCKET=propnexus-dev \
S3_ACCESS_KEY_ID=propnexus S3_SECRET_ACCESS_KEY=propnexus-dev-only S3_CREATE_BUCKET=true \
pnpm dev
```

Es **el mismo código** que va a hablar con Cloudflare R2 (D-011): cambian las variables, no el
driver. Por eso probar contra MinIO prueba lo que va a correr desplegado.
