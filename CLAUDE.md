# CLAUDE.md

Lo transversal. Lo de cada frente vive en `apps/web/CLAUDE.md`, `apps/api/CLAUDE.md`,
`packages/cardano/CLAUDE.md` y `contracts/CLAUDE.md`, y se carga solo cuando tocás ese subárbol.

**Acá solo hay información vigente.** El porqué de cada decisión está en `DECISIONS.md`; el
argumento largo, en `specs/archive/`.

# Estado

**El estado vive en una sola tabla: [`specs/README.md`](specs/README.md).** Ahí están los 16
criterios del SOM, lo que sigue (la Fase 1 de
[`AUDITORIA-2026-10-01`](specs/AUDITORIA-2026-10-01-arquitectura-api-y-web.md) §9), lo que queda
fuera de alcance de M3 y lo que hay que decidir antes de mainnet. **Ningún otro documento repite
estado:** si uno dice "pendiente" o "cerrado" de algo, enlaza al README en vez de afirmarlo.

**La evidencia para enviar vive en [`specs/evidencia-m3/`](specs/evidencia-m3/README.md), en
inglés y solo lo exportable**, una subcarpeta por ítem de *"Evidence of milestone completion"*. Los
documentos de trabajo en castellano de los que salen (prueba de volumen, TXIDs, security review,
runbook, monitoreo, reporte de tests) siguen en `specs/` y son los que se mantienen: **si cambia uno,
se actualiza su versión en inglés en el mismo commit**, y su PDF con `bash scripts/evidencia-pdf/generar.sh`
(cada `.md` de la carpeta tiene un `.pdf` hermano generado desde él).

---

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

# Cómo se trabaja una pantalla

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
10. **Uploads:** solo `application/pdf`, `image/jpeg`, `image/png` —el tipo **real**, por los primeros
    bytes, no el `Content-Type` que declara el cliente—; máximo `EVIDENCE_MAX_FILE_MB` por archivo y
    `EVIDENCE_MAX_FILES` por pedido, **los dos en `packages/shared/src/evidence-rules.ts`** (los importan
    la API y el front: no hay variable de entorno ni número a mano que tenga que coincidir). Un pedido es
    un lote (un bundle, un anclaje). Un archivo que falla la validación se rechaza **solo él** y vuelve en
    `rejected`; ninguno deja archivo huérfano, ni en disco ni en R2 (`SPEC-218`).
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
| La evidencia de la entrega de M3, en inglés y por ítem de Catalyst | `specs/evidencia-m3/` |

# Stack

| Frente | Con qué | Decisión |
|---|---|---|
| **web** | TanStack Router + Vite (SPA, sin SSR) · React 19 · Tailwind v4 · shadcn/ui · Lucide · PWA (`SPEC-222`) | D-065, D-024 |
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

# Cómo se trabaja con el dueño

**Lo único que vale es lo escrito en los `.md` del repo.** El agente no usa memoria propia: lo que
aprende se escribe en el `.md` que corresponde, en el mismo commit que lo causa.

- **Verificá contra el código, no contra los documentos.** `DECISIONS.md`, `specs/` y estos
  `CLAUDE.md` se desactualizan solos: medí o reproducí antes de afirmar. Si un documento y el código
  difieren, contá cuántas piezas sostienen cada lado —un test con nombre explícito es intención— y
  corregí el que perdió en el mismo commit.
- **El SOM de Catalyst manda sobre `DECISIONS.md`, este archivo y `specs/`, y los entregables de M2
  y M3 mandan sobre el SOM** (dueño, 2026-09-09). Antes de construir algo "porque lo pide el SOM",
  buscá si una captura o una fila de M2-D5 lo muestra; si el diseño lo contradice, gana el diseño y
  lo que se ajusta es cómo se reporta el criterio.
- **Un solo agente, sin subagentes ni skills que el dueño no haya pedido.** Durante una rebanada, el
  e2e corre filtrado (`pnpm e2e -g "<TEST-ID>"`) con `LOGIN_RATE_LIMIT_MAX` alto; la suite completa,
  antes de una demo o al cerrar un bloque.
- **Comentarios mínimos**: ninguno que narre historia. La historia va al commit.
- **Los entregables van en inglés**: el `README.md` raíz, `specs/evidencia-m3/` y lo que generan
  `docs:api`/`docs:openapi`. Los datos reales (etapas en es-AR, logs) no se traducen. El resto del
  repo, en castellano.
- **Specs acotadas e independientes**, pero una larga antes que varias partidas a la fuerza: el costo
  que importa es el de implementar. Cada spec nueva se registra en `specs/README.md` en el mismo
  commit.
- **Nada de infraestructura para problemas futuros.** Antes de un cron, un worker, un servicio o un
  secreto nuevo: ¿el problema existe hoy?, ¿qué secreto permanente pide?, ¿despierta el free tier?
  Si es futuro, alcanza con documentar el comando a mano.
- **Lo que se enciende, se apaga** cuando termina lo que lo necesitaba. Si algo queda prendido, se
  avisa arriba y solo, no al final de otro párrafo.
- **La librería no decide el diseño.** Si Lucid impone una forma, se toca código. Y antes de
  arreglar, preguntá si el problema debía existir.
- **Material de wallet, siempre fresco y fuera del repo**, y se le avisa al dueño para que lo guarde.
- **Antes de pushear un cambio de `render.yaml` sobre un servicio desplegado, reproducí su
  `buildCommand` y su `startCommand` literales**: `pnpm verify` no los corre.
- **Producción se toca con backup verificado antes** (`specs/stack.md` §8b) y nada se borra en la
  misma sesión en que se reemplaza.

# Commits y ramas

`<tipo>(<scope>): <descripción en imperativo, minúscula, sin punto final> [<REF>]`

- **Tipos:** `feat` · `fix` · `refactor` · `test` · `docs` · `chore` · `perf` · `db`
- **Scopes:** `web` · `api` · `db` · `shared` · `cardano` · `contracts` · `ci` · `repo`
- **REF:** el ID de M2-D5 cuando aplique (`[M3-FE-18]`, `[INV-BUY-LIST-001]`) o la decisión (`[D-065]`)

Un commit = un cambio lógico · el cuerpo explica el *por qué* · `BREAKING CHANGE:` si rompe contrato
de API o esquema on-chain. **`main` es la rama de integración y no hay PRs** (D-030).

**Testear, commitear y pushear son una sola unidad de trabajo.** `pnpm verify:all` en verde →
`git commit` → `git push`, siempre juntos, en ese orden y en un solo comando con `&&` (con `;`, un
rojo se commitea igual). No se junta trabajo local "para pushear al
final", y no se commitea sin el verde.

**La única excepción: un commit que no toca código, y la decide `git`, no vos.** "No toca código"
quiere decir que todo archivo staged es documentación o un archivo que ningún paso del pipeline lee
(`.md`, `.pdf`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.ico`, `.csv`, `.log`, `.txt`, `.mp4`,
`.mov`, `.webm`, `.srt`, `.vtt`), en
cualquier carpeta, **y** que nada cae dentro de `docs/`.

```bash
[ -n "$(git diff --cached --name-only -- ':(exclude)*.md' ':(exclude,icase)*.pdf' ':(exclude,icase)*.png' ':(exclude,icase)*.jpg' ':(exclude,icase)*.jpeg' ':(exclude,icase)*.gif' ':(exclude,icase)*.webp' ':(exclude,icase)*.ico' ':(exclude,icase)*.csv' ':(exclude)*.log' ':(exclude)*.txt' ':(exclude,icase)*.mp4' ':(exclude,icase)*.mov' ':(exclude,icase)*.webm' ':(exclude,icase)*.srt' ':(exclude,icase)*.vtt')$(git diff --cached --name-only -- docs/)" ] && pnpm verify:all
```

Si aparece un solo archivo con otra extensión (`.ts`, `.tsx`, `.json`, `.yaml`, `.sql`, `.ak`,
`.css`, `.sh`, …) o cualquier cosa bajo `docs/`, corre todo. Si no, no corre nada. **La lista es de
lo que se saltea, no de lo que corre:** una extensión nueva que nadie pensó cae del lado seguro.
**Por qué esas extensiones:** ni Biome, ni `typecheck`, ni los tests, ni `build`, ni Aiken leen un
archivo del repo con esas extensiones (los tests que nombran `.pdf`/`.png` arman el archivo en
memoria), y las imágenes de `apps/web/public/` el build solo las copia. Los videos y subtítulos
solo los leen los scripts de `scripts/video-walkthrough/`, que se corren a mano. **Por qué `docs/` corre
siempre:** `pnpm testids` lee un `.md` de ahí. El `.json` no se saltea nunca: hay tests que
comparan el OpenAPI y la colección Postman de `specs/evidencia-m3/` con el código.
**La regla es mecánica a propósito, y es `git` y no `grep` por una razón medida** — bajo el `grep`
que shimea Claude Code, la versión con `grep` contestaba al revés justo en el caso peligroso. El
argumento completo y las mediciones, en
[`specs/archive/CLAUDE-argumentos-de-las-reglas-2026-09-20.md`](specs/archive/CLAUDE-argumentos-de-las-reglas-2026-09-20.md).

**CI espeja esta misma regla** en `.github/workflows/ci.yml` (`paths` con negaciones en `push` y
`pull_request`, y `docs/**` re-incluido al final), así que un commit sin código tampoco dispara la
corrida en GitHub Actions.

**La documentación viaja con el código que la causa, en el mismo commit.** Un cambio que altera cómo
se opera, se configura o se despliega algo llega con su documentación adentro — no en un `docs(...)`
posterior. Un `docs(...)` suelto es legítimo solo cuando el cambio **es** documentación: sanear algo
desactualizado, cerrar una decisión, escribir una trampa recién aprendida.

El porqué —el commit de R2 que dejó a `DECISIONS.md` mintiendo durante tres commits— está en
[`specs/archive/CLAUDE-argumentos-de-las-reglas-2026-09-20.md`](specs/archive/CLAUDE-argumentos-de-las-reglas-2026-09-20.md).

# Comandos

```bash
pnpm install                      # bootstrap del workspace
pnpm dev                          # web + api en paralelo
pnpm verify                       # app TS: lint + typecheck + testids + tests con umbral de coverage + build (lo mismo que CI)
pnpm contracts:verify             # Aiken: fmt + check + build
pnpm verify:all                   # las dos, encadenadas
pnpm lint:fix                     # Biome arregla lo mecánico

pnpm --filter web test:a11y                   # axe después de cada test de apps/web (SPEC-112)
pnpm --filter @plataforma/api test:s3         # storage contra MinIO real
pnpm --filter @plataforma/cardano test:yaci   # anclaje contra un nodo Cardano real
node contracts/scripts/rechazos-mutantes.mjs  # cada chequeo del validador tiene un test que lo defiende (SPEC-017)
node contracts/scripts/rechazos-trazas.mjs    # cada `expect` del validador, contra el test que aborta en él
docker compose -f compose.dev.yml up -d       # solo si querés la infra levantada aparte
```

**TypeScript y Aiken no se mezclan:** distinto toolchain, distintos artefactos, distintos modos de
falla. El CI los corre como dos jobs en paralelo. `test:s3`, `test:yaci` y los dos scripts de
`contracts/scripts/` **no corren en CI**: los dos primeros levantan infraestructura, y los scripts
corren `aiken check` una vez por mutante (varios minutos). Se corren a mano. `test:a11y` tampoco,
pero por otra razón: `SPEC-112` decidió que ninguna capa de accesibilidad bloquee todavía.

Los comandos por frente (`db:migrate`, `db:seed`, `e2e`) están en el `CLAUDE.md` de cada uno.

---

# Worktrees

Usar `git worktree` para aislar trabajo en paralelo está bien — pero cada uno es un checkout
completo con su propio `pnpm install`: **~750MB por worktree**, y el disco ya llegó al 99% por
worktrees mergeados sin borrar.

- **Todo va a `main`.** Si la herramienta obliga a un worktree, el ciclo se cierra en el mismo turno:
  commit, `git push origin HEAD:main`, `git pull --ff-only` en el checkout principal y borrar
  worktree y rama. Ramas: en local solo `main`; en `origin`, `main` y `spec-222-pwa`.
- **Después de todo push a `main`, revisar worktrees y ramas locales mergeadas — sin que lo pidan.**
  `git worktree list` contra `git branch --merged main`: todo lo que aparece en las dos se borra,
  `git worktree remove --force <path>` y después `git branch -d <rama>` (falla sola si no era
  fast-forward, así que es segura por default). No tocar `.claude/worktrees/` con rama sin mergear
  ni ramas que no reconocés armar (ver abajo) — pueden ser trabajo en curso de otra sesión.
- **Borrar el worktree apenas su rama está mergeada y pusheada.**
  `git worktree remove --force .claude/worktrees/<nombre>`. No hay razón para dejarlo "por las
  dudas": el commit ya vive en `main`, el worktree no agrega nada.
- **Antes de crear uno nuevo, `git worktree list`** y borrar los que ya se mergearon. Un worktree
  con una rama que sigue sin mergear puede ser trabajo en curso de otra sesión — no lo toques ni
  asumas que es tuyo para borrar.
- **No tocar un worktree que no reconocés** (ramas `agent-*` u otro nombre que no arrancaste vos):
  puede ser una sesión concurrente con trabajo sin commitear.
- **El disco se llena en silencio.** No hay alerta hasta que algo falla con `ENOSPC`. Si vas a
  instalar dependencias, levantar `compose.dev.yml` o crear un worktree, chequeá `df -h /` antes si
  hace un tiempo que no se limpia nada.
- **Cachés reconstruibles no cuestan nada limpiar:** `~/.npm`, `~/Library/pnpm/store`,
  `~/.cache/uv`, `~/.cache/puppeteer`, `~/.cache/huggingface` se vuelven a poblar solos en el
  próximo `pnpm install` o uso. Limpialos sin preguntar si el disco aprieta.
- **Las imágenes de Docker con nombre no son cachés: son infraestructura del repo.** `yaci-cli`,
  `yaci-devkit`, `minio` y `postgres` son las que usan `compose.dev.yml` y `pnpm --filter
  @plataforma/api test:s3` / `test:yaci` (§Comandos) — bajarlas de nuevo son minutos y varios GB.
  `docker container prune` y `docker image prune` (sin `-a`, que solo se llevan contenedores
  parados e imágenes dangling) son seguros; borrar esas cuatro imágenes con nombre no.

---

# Trampas transversales

Una línea cada una; la de un frente va en su `CLAUDE.md`. La narración de cada una está en el commit
que la arregló (las anteriores al 2026-10-01, en
[`specs/archive/CLAUDE-subarboles-hasta-2026-10-01.md`](specs/archive/CLAUDE-subarboles-hasta-2026-10-01.md)).

- **Las capturas de M2-D2 tienen datos mock**: lo normativo es la estructura, no los valores (la 55
  casi nos hace modelar stages por unidad, contra D-029).
- **Antes de declarar mal un entregable, verificá que es el entregable**: el paquete canónico de M1
  es `M1-D2-Architecture-and-Data-Models/`, no los `.puml` regenerados desde los PDF.
- **Grepear solo `*.md` esconde entregables**: hay obligaciones en `.csv`.
- **Los códigos de entregable colisionan entre milestones**: citá siempre `M2-D1 §4`, no `D1`.
  `M2-D5`/`M2-D6` son de Milestone 2 aunque vivan en la carpeta de M3.
- **Los PDF no se leen con la herramienta de lectura** (falta `pdftoppm`):
  `qlmanage -t -s 1800 -o <dir> archivo.pdf`.
- **Un verificador dentro del corpus que verifica se encuentra a sí mismo**: antes de agregar uno,
  preguntá si no conviene cambiar la forma de lo verificado (D-053).
- **Editar un `package.json` sin `pnpm install` da un verde falso.**
- **`pnpm.overrides` solo se aplica porque `packageManager` pinea pnpm 9.15.0**: el día que suba a
  10+, los overrides van a `pnpm-workspace.yaml` en el mismo commit, o se ignoran en silencio.
- **Una lectura nueva de `env.*` se declara en `render.yaml`**, o `apps/api/test/render-config.test.ts`
  se pone rojo (D-076).
- **Si CI agrega un paso, `pnpm verify` lo espeja**: un verde local que CI no confirma es falso.
- **Las capturas del developer no coinciden en el header**: gana D-074, no la captura.
