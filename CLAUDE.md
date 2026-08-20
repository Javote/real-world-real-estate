# CLAUDE.md

> Lo transversal. Lo de cada frente vive en `apps/web/CLAUDE.md`, `packages/api/CLAUDE.md` y
> `contracts/CLAUDE.md`, y se carga solo cuando tocás ese subárbol.

## Contexto (3 líneas)

**PropNexus** (Catalyst 1400106) — plataforma de ventas inmobiliarias en pozo: estructura el ciclo de obra en **stages**, organiza **evidencia** (planos, permisos, actas, certificados) y ancla **huellas criptográficas** (SHA-256/Merkle) en **Cardano** con timestamps. Off-chain: documentos, PII y lógica de negocio. On-chain: solo commitments compactos y TXIDs — **nunca valor** (D-021). Cuatro roles con superficie propia: investor (INV), developer (DEV), notary (NOT), certifier (CER).

**El problema real que resuelve.** Hoy es imposible verificar el estado real de los procesos de aprobación y avance de una obra en pozo: la evidencia está dispersa en canales informales y nada garantiza que lo que se muestra hoy sea lo que existía ayer. Esa opacidad ya causó daño económico real a compradores.

**Lo que la plataforma NO hace** (D-026): no certifica, no valida y no decide nada. Acompaña procesos que ya existen afuera y los refleja. El rol "certifier" verifica **integridad y completitud** contra los hashes anclados — no validez legal. La plataforma solo puede sostener cuatro afirmaciones: *este archivo tiene este hash* · *se registró en este momento* · *declara provenir de esta autoridad externa* · *esta persona atestiguó haberlo revisado*. Si escribís copy, modelo o validador que afirme algo más, está mal.

## Si llegás nuevo: punto de partida

**El código es una semilla, no la app.** La conformidad con el diseño aprobado es muy baja y
**eso es lo esperado, no un bug que arreglar de paso** (el número medido vive en `specs/README.md`
y solo ahí: un número de estado copiado se desactualiza en todas las copias menos una). Lo valioso de lo que existe son decisiones
de arquitectura (auth en dos capas, SHA-256 en el servidor, `AuditLog` append-only, el patrón
`ApiPort`, la topología de la FSM en Aiken), no superficie terminada.

Orden de lectura:

1. Este archivo entero (es lo único que se carga solo, junto al del frente que toques).
2. `specs/README.md` — el mapa: criterios de aceptación de M3, conformidad medida, rebanadas, riesgos.
3. `DECISIONS.md` — el porqué. Si algo del código te parece raro, la respuesta está acá antes que en el código.
4. Lo puntual del frente (ver §Documentación oficial más abajo).

**Para trabajar: invocá el skill `slice`.** Es el protocolo de sesión completo — ubicarse,
spec, plan, implementar, verificar, documentar, commitear, pushear.
Para ver la app corriendo: skill `run-app`. **No improvises un driver de browser**, ya está armado.

## Vocabulario: "milestone" tiene dos significados — usá el correcto

| Término | Significa | Dónde |
|---|---|---|
| **Milestone** | Hito **Catalyst**: M1, M2, M3… Etapas contractuales del proyecto. | `docs/milestone-N-*/`, reportes de entrega |
| **Stage** (`ConstructionStage`) | Etapa de **obra** de un desarrollo. Es la entidad del dominio. | Código, API, specs, contratos |

Nunca uses "milestone" para una etapa de obra (D-023). Si ves `Milestone` en código, es deuda de rename pendiente.

## Jerarquía de precedencia

Dos capas, porque son dos autoridades distintas:

- **Obligaciones (el *qué*, la vara de aceptación): manda `docs/`.** Entregables aprobados por
  reviewers. Ninguna decisión puede reducir lo que debemos. **`docs/` es INMUTABLE** — ni para
  corregir un error evidente. Está bloqueado por hook, no por convención.
- **Implementación (el *cómo*): `DECISIONS.md` > `CLAUDE.md` > `specs/`.**

Un desvío solo es legítimo si (a) el entregable se contradice internamente, (b) es un error de
redacción, o (c) seguirlo al pie contradiría una verdad del producto declarada por el dueño.
**Nunca por conveniencia ni por preferencia técnica.**

**El desarrollo completo de la regla —qué se registra, cómo, y los desvíos vigentes— está en el
encabezado de `DECISIONS.md` y en D-022. Acá no se repite.** Ante contradicción entre documentos:
gana el de mayor precedencia y el otro se corrige en el mismo commit. Si la contradicción es con
código, avisá antes de "arreglar" nada.

**Y antes de declarar que un entregable está mal: verificá que estás mirando el entregable.** Ya
nos pasó decidir contra una transcripción errónea (ver Trampas).

## Principios de trabajo (los diez que sostienen todo lo demás)

1. **Una sola fuente de verdad por cosa.** Cada dato vive en un lugar; el resto linkea, nunca copia. La duplicación diverge en silencio; el link roto es un fallo ruidoso — preferí siempre el fallo ruidoso.
2. **Jerarquía de precedencia explícita.** El documento en conflicto se corrige en el mismo commit en que se detecta la contradicción.
3. **Decidir rápido con defaults, refutar con spikes cortos** (≤2-3 días). Toda decisión abierta arranca con una opción por defecto; el spike existe para refutarla, no para explorar infinito. Reabrir una decisión aceptada requiere evidencia, no preferencia.
4. **El repo es la memoria; los chats son descartables.** Toda decisión, trampa o convención que emerja en una sesión se persiste en el mismo commit.
5. **Documentar contra realidad, no intenciones.** Las specs se escriben cuando hay código real que documentar, un paso antes de necesitarlas. La documentación especulativa produce archivos que nadie corrige.
6. **Vertical primero (walking skeleton).** Antes de pulir capas, un hilo mínimo que atraviesa todo el sistema de punta a punta. Después se engorda ese hilo.
7. **Dependencias externas detrás de interfaces propias** con modo real/simulado conmutable por configuración. Los simuladores son producto, no stubs. Acá esa dependencia es Cardano (D-014).
8. **Redefinir "listo" según lo que controlás.** Si el hito depende de terceros, "listo" es *listo para activar*: todo lo bloqueado detrás de configuración, activable en días.
9. **LLMs para volumen, humanos para juicio**, con niveles de autonomía explícitos según riesgo. Nada de lógica crítica que el revisor no pueda explicar sin mirar el chat.
10. **CI desde el primer commit** y **documentación antes que código**, para que toda sesión tenga contexto desde el minuto uno.

## Estructura del repo

`apps/web` (TanStack Start) y `packages/api` (Express + Prisma) son los únicos servicios.
`shared` (contrato único API↔web) y `cardano` (a poblar) son librerías; el esquema Prisma vive en
`packages/api/prisma` (D-016). `contracts/` es el proyecto Aiken: no se hostea, su versión es un entero
(D-015).

Tres `.md` en la raíz, a propósito: **`README.md`** (entrada humana, arranque, variables de
entorno), **`CLAUDE.md`** (este archivo) y **`DECISIONS.md`** (el porqué). El mapa de desarrollo
está en `specs/README.md`; los entregables oficiales en `docs/`, mapeados en `specs/entregables.md`
(`docs/` contiene solo entregables: nada nuestro vive ahí adentro — D-033).

El harness de agentes vive en `.claude/` (subagentes, skills, hooks y permisos, todo commiteado) y
`scripts/` (la puerta y los árboles de trabajo). Ver §Cómo se trabaja acá.

## Stack

Los entregables oficiales **son agnósticos de stack**: el único requisito técnico comprometido es que los contratos sean en **Aiken**. Todo lo de abajo es implementación nuestra y cambiarlo requiere una `D-0XX` nueva, no una edición de esta tabla.

| Frente | Stack | Versión real | Decisión |
|---|---|---|---|
| Workspace | pnpm workspaces, Node ≥20, TypeScript **6.0** estricto | `pnpm@9.15.0` | D-001 |
| **web** | TanStack Start + Router + Query, React 19, Tailwind v4, Lucide, Vite, Vitest+jsdom | Start `^1.168` · TW `^4.1` | D-002, D-024 |
| **web** (falta) | shadcn/ui — primitivos accesibles para los 36 componentes de M2-D3 | pendiente | D-024 |
| **api** | Express 4 + Zod + JWT + bcrypt(10) + Multer 1.x, base `/api/v1` | Express `^4.21` | D-016 |
| **db** | Prisma; SQLite en dev → **PostgreSQL al desplegar** | `^6.6` (resuelve 6.19.x) | D-016 |
| storage | disco local en dev → **S3 genérico** (MinIO dev / R2 prod) | — | D-011 |
| **shared** | Zod, contrato único API↔web | auth migrado (SPEC-008) | D-012 |
| **cardano** | `AnchorPort` con adaptadores `blockfrost` (Lucid Evolution) y `simulated` | placeholder vacío | D-005, D-014 |
| **contracts** | Aiken v1.1.21 · **Plutus V3** · stdlib v3.0.0 · blueprint commiteado | `plutus.json` → `v3` | D-017, D-019 |
| red | **Preprod** en todos los entornos; mainnet fuera de alcance | — | D-013 |
| deploy | Docker · Railway con "Wait for CI" · GHA **solo valida** | — | D-010 |
| versionado | CalVer `vYYYY.MM.N` para servicios; entero para contratos; nada para packages internos | — | D-015 |

**Deuda técnica transversal** (la de cada frente está en su `CLAUDE.md`):

- **`contracts/` tiene 0 tests** contra un criterio de aceptación de ≥95% de coverage.
- Nitro pineado a un **nightly** (`3.0.1-20260714-…`) que trajo el scaffold, con un proxy de dev
  que rompe `POST`+`401` (ver `apps/web/CLAUDE.md`). Pasar a estable subió de prioridad.

**Decisiones de stack abiertas:** D-005 (Lucid vs Mesh — lo cierra el walking skeleton) · D-009 (co-firma CIP-30 vs wallet por rol) · D-016 (Express→Hono solo con evidencia medida) · D-017 (`milestone.ak` vs `milestone2.ak`).

## Documentación oficial: qué leer antes de tocar cada frente

No leas los cuatro entregables por costumbre: son ~25k tokens. Abrí lo que la fila pide.

| Vas a tocar | Leé primero |
|---|---|
| Cualquier pantalla | `M2-D1` (árbol de pantallas y permisos del rol) + `M2-D3` (componentes) |
| Algo que muestre un hash, TXID o Merkle root | `M2-D4` (los 10 patrones son **normativos**) |
| Un endpoint | `M2-D5` §4-6 (trae el path, los test IDs y el work stream) + `M2-D6` §9 |
| Un validador | `M1-D1` §Workflow + D-020 (FSM) + D-021 (nunca valor) |
| El modelo de datos | `M1-D2b` + `M2-D1` §4 (matriz de permisos) + D-029 |

## Reglas duras (innegociables)

1. **Datos primero:** dinero jamás en float — montos en unidades enteras mínimas (lovelace como `bigint`; moneda fiat en centavos `integer`). Timestamps en UTC. IDs = UUID.
2. **Cero PII on-chain o en logs:** ni nombres, ni emails, ni URLs internas, ni nombres de archivo en metadata, datums o logs. Solo hashes y refs opacas. Strings de metadata ≤ 64 bytes.
3. **El hash es el ticket de entrada a la cadena de prueba** (D-027). Solo se hashea lo que se va a anclar. Si un archivo tiene `sha256Hash`, termina anclado — o se muestra como "Pendiente" mientras confirma, **nunca** como "Verificado". El hash lo calcula el servidor y no se recalcula ni se edita después de creado. Los **assets** informativos (renders, folletos, galerías, fotos de unidad de muestra) no se hashean, no se anclan y no muestran ninguna señal de prueba. No hay estado intermedio.
4. **Passwords solo con bcrypt** (cost 10). Jamás loguear ni devolver `passwordHash` en ninguna respuesta.
5. **Autorización en dos capas, siempre:** rol global (`requireRole`) + membresía por proyecto (`canAccessProject`). `admin` bypasea membresías; el resto solo ve proyectos donde es miembro. La matriz completa está en M2-D1 §4.
6. **Todo body se valida con Zod** (`safeParse` + 400 con `error.flatten()`). Nada llega a Prisma sin pasar por un schema. Para endpoints nuevos: el schema va a `packages/shared` ANTES que el endpoint, y el frontend importa el mismo tipo.
7. **Toda mutación relevante escribe `AuditLog`** (append-only) vía `writeAuditLog`, con actor, entidad, acción, timestamp.
8. **Idempotencia en todo lo que toca plata o chain:** re-ejecutar un anclaje, release o migración no duplica efectos.
9. **Máquina de estados del stage:** `Pending → InProgress → {Observed ⇄ InProgress, Completed}`, `Completed` terminal (D-020). `Observed` es remediación, no estado final. Una sola tabla de transiciones, espejada entre backend y `contracts/`. La etiqueta que ve el usuario sale del diccionario i18n, no del nombre del estado.
10. Uploads: solo `application/pdf`, `image/jpeg`, `image/png`; máximo `MAX_FILE_SIZE_MB` (default 10). Si un upload falla la validación después de que Multer escribió el archivo, **borrar el archivo huérfano** antes de responder.
11. **`contracts/plutus.json` se commitea** tras cada `aiken build`; direcciones de script derivadas del blueprint, jamás hardcodeadas.
12. **Secrets solo por env.** Si ves una seed/key commiteada: frená y avisá.
13. **Ningún validador custodia ni transfiere valor** (D-021). On-chain solo commitments y TXIDs. Si una spec o un prompt te pide un validador que retenga fondos, está mal: frená y avisá. "Release" significa anclar el evento de liberación, no ejecutar el pago.
14. **Cero strings hardcodeados en la UI** (D-025). Todo texto visible sale del diccionario i18n; toda moneda, fecha, relativo y decimal se formatea con `Intl.*` y el locale activo. Default `es-AR` con voseo ("Mirá tu unidad", no "Mira" ni "Mire").
15. **El backend devuelve claves de traducción, nunca copy** (M2-D4 §8.2). Vale para acciones de audit log, categorías, etiquetas de rol y nombres de stage. El cliente renderiza.
16. **Los hashes viajan completos al cliente** (M2-D4 §8.2). La truncación a 6+4 es exclusivamente de presentación, la hace `HashChip`. Nunca truncar en la capa de datos. Los TXID son case-sensitive y se transportan verbatim.
17. **Nunca mostrar una señal de prueba que no puedas sustanciar** (M2-D4 §6.2). Un pill "Verified", una marca de agua VERIFIED o un `HashChip` requieren un anclaje real. Si no hay TXID, el estado es "Pending", no "Verified".

## Prohibiciones (qué NO hacer aunque parezca buena idea)

- No migrar lógica de negocio on-chain: el backend es la fuente de verdad del **registro** del lifecycle (D-007); on-chain se anclan pruebas.
- No importar Lucid/Blockfrost fuera del futuro adaptador real de `packages/cardano` (D-014). Las rutas de la API jamás llaman a la chain directo.
- En el front, no hacer `fetch` fuera de `ApiPort` (`apps/web/src/api/`).
- No tocar mainnet: `CARDANO_NETWORK=Preprod` siempre (D-013). CI no toca ninguna red.
- **No subir `@types/express` a v5** mientras `express` sea v4.
- **No editar migraciones ya aplicadas**; siempre migración nueva.
- No tocar `contracts/build/` (generado) ni editar `aiken.lock` a mano.
- No inventar endpoints, campos o dependencias fuera de spec/docs — proponer, no improvisar.
- No commitear `.env`, `dev.db`, `uploads/` ni artefactos de build.
- No "arreglar" tests cambiando contratos de API o esquema de DB para que pasen.
- No crear variantes ad-hoc de los componentes de dominio (HashChip/StatusPill/etc.): viven en `apps/web/src/components/domain/`.
- **No editar nada dentro de `docs/`** (D-022). Ni para corregir un error evidente.
- **No inventar estados ni patrones de prueba nuevos.** M2-D3 dice *"never invent new statuses"* y M2-D4 pide documentar un patrón antes de usarlo. Como el documento es inmutable, en la práctica: patrón nuevo = decisión nueva en `DECISIONS.md`.
- No abrir un modal de verificación automáticamente (M2-D4 §6.3). Toda superficie de prueba es iniciada por el usuario; la única excepción es `AnchoringSuccessModal`.

## Cómo se trabaja acá

**El protocolo de sesión es el skill `slice`.** Invocalo al empezar; no lo repito acá.

**La puerta.** `scripts/gate.sh` es el único comando que decide si un cambio puede pushearse:
prohibiciones absolutas, typecheck, tests **del frente que tocaste**, y contratos si aplica. **El
CI corre el mismo script** — si se separan, divergen.

Lo que no se puede dejar librado al azar **es un hook, no un párrafo** (D-032). Están bloqueados
por el harness, no por convención: editar `docs/`, editar una migración aplicada o un archivo
generado, escribir una clave privada, pushear con la puerta cerrada, pushear forzado. Los hooks
tienen su propia suite: `scripts/hooks/test-guards.sh`.

**Árboles paralelos.** `scripts/worktree.sh create <track>` deja un árbol usable —rama, deps, base
sembrada y puertos propios— para `web`, `api` o `contracts` (D-031). El track de contratos siempre
puede correr en paralelo: está aislado del workspace pnpm.

**Subagentes** (`.claude/agents/`), divididos por el contexto que necesitan, no por rol nominal:

| Agente | Cuándo | Por qué existe |
|---|---|---|
| `spec` | antes de implementar una rebanada sin spec | leer los entregables cuesta ~25k tokens que el implementador no necesita |
| `conformance` | antes de commitear, obligatorio si hay superficie de prueba | el que escribió el código es el peor juez de si cumple la spec |
| `contracts` | cualquier trabajo en `contracts/` | contexto Aiken/Plutus disjunto del TypeScript |

**Dónde vive cada cosa** (si no está en su lugar, no lo copies: movelo):

| Qué | Dónde |
|---|---|
| Obligaciones, la vara de aceptación | `docs/` — inmutable, y **solo entregables** (D-033) |
| Qué archivo de `docs/` es qué entregable | `specs/entregables.md` |
| Por qué se decidió algo | `DECISIONS.md` |
| Reglas transversales de sesión | este archivo |
| Reglas, trampas y deuda de un frente | `<frente>/CLAUDE.md` |
| Estado, rebanadas, riesgos | `specs/README.md` |
| Invariantes y casos borde de una rebanada | `specs/SPEC-NNN` |
| Procedimientos | `.claude/skills/` |
| Lo que se ejecuta y no se confía | `scripts/` y `.claude/settings.json` |

### Niveles de autonomía (por riesgo del código)

| Nivel | Qué cubre | Cómo se trabaja |
|---|---|---|
| 🟢 Verde | Componentes UI según M2-D3, endpoints CRUD según M2-D5, tests, docs, seeds | El LLM implementa directo |
| 🟡 Amarillo | Migraciones de DB, auth/permisos/guards, pipeline de anclaje (`packages/cardano`), manejo de archivos/S3, config de CI/deploy, **validadores Aiken** | El LLM propone; revisión humana línea por línea antes de integrar |
| 🔴 Rojo | Manejo de seeds/keys/firmas, todo lo que toque `SERVICE_WALLET_SEED`, la lógica de `canAccessProject`, hashing y construcción de commitments | El humano lidera y escribe; el LLM asiste. El revisor debe poder explicar cada línea sin mirar el chat |

Si dudás del nivel, es el más alto de los dos.

### Commits y ramas

Formato: `<tipo>(<scope>): <descripción en imperativo, minúscula, sin punto final> [<REF>]`

- **Tipos:** `feat` · `fix` · `refactor` · `test` · `docs` · `chore` · `perf` · `db`
- **Scopes (cerrados):** `web` · `api` · `db` · `shared` · `cardano` · `contracts` · `ci` · `repo`
- **REF:** el ID de M2-D5 entre corchetes cuando aplique (`[M3-BE-13]`, `[M3-FE-18]`, `[M3-SC-05]`)

Un commit = un cambio lógico (no mezclar refactor con feature) · el cuerpo explica el *por qué* ·
`BREAKING CHANGE:` en el footer si rompe contrato de API o esquema on-chain.

**`main` es la rama de integración y no hay PRs** (D-030). Las ramas `track/<nombre>` existen solo
para que los árboles paralelos no se pisen (D-031): viven horas o días, se integran con
`merge --ff-only` y se borran. Cuando se sume una segunda persona, esto vuelve a PRs — el trigger
está en D-030.

## Comandos

```bash
pnpm install                      # bootstrap del workspace
pnpm dev                          # web + api en paralelo (puertos según el árbol)
pnpm typecheck                    # typecheck de todos los packages
pnpm test                         # tests (hoy: solo web — ver §Deuda)
pnpm contracts:check              # aiken check (compila y corre tests de validadores)
pnpm contracts:build              # regenera plutus.json (commitearlo)
pnpm e2e                          # walkthrough Playwright (mobile + desktop) — NO corre en CI

scripts/gate.sh                   # LA PUERTA — lo mismo que corre el CI y el hook de push
scripts/gate.sh --ci              # sin acotar por diff: verifica todo
scripts/worktree.sh list          # árboles, ramas y puertos
scripts/worktree.sh create web    # árbol nuevo, listo para usar
scripts/hooks/test-guards.sh      # regresión de los guardias del harness
```

Los comandos por frente (db:migrate, db:seed, e2e:ui…) están en el `CLAUDE.md` de cada frente.

**Sobre `pnpm e2e`:** levanta web+api (reusa los que estén corriendo), recorre la app y deja
capturas, video y trace en `apps/web/e2e/.artifacts/` (gitignoreado). Se corre a mano, cada tanto.
Produce tres cosas que el SOM de M3 pide como evidencia: los test IDs de M2-D5 ejecutándose,
capturas, y el video del walkthrough (criterio 13).

## Trampas transversales (sección viva — agregá acá el mismo día que te muerda una)

Las de cada frente van en su `CLAUDE.md`. Acá solo lo que cruza frentes o toca el método.

- **2026-08-20 · Un comando de shell contiene datos, no solo código.** La primera versión del
  guardia de Bash matcheaba la *mención* de `docs/` y de `git push`, así que se bloqueó a sí misma
  al escribirse y disparó la puerta al escribir un skill que documenta el push. Matchear
  **invocaciones**, no menciones: `scripts/hooks/analyze-cmd.py` saca los cuerpos de heredoc antes
  de analizar, y `test-guards.sh` fija el comportamiento. **Corolario de la misma familia:** un
  escáner que vive dentro del corpus que escanea se encuentra a sí mismo — el chequeo de mainnet de
  la puerta matcheaba el literal de su propio mensaje de error, y solo se vio al crear un árbol
  nuevo, porque en el principal el archivo todavía estaba sin trackear y `git grep` no lo veía.
- **2026-08-20 · Un escape de entorno desactivaba en silencio su propia verificación.** Correr la
  puerta con `GATE_ALLOW_DOCS=1` hacía que la suite de guardias —que la puerta ejecuta— heredara la
  variable y "pasara" sin verificar nada de lo que dice verificar. **Toda suite de tests tiene que
  ser hermética**: si su resultado depende del entorno de quien la llama, no es una suite. Los
  escapes se prueban explícitos, escritos en el comando de cada caso.
- **2026-08-20 · Editar un `package.json` sin correr `pnpm install` produce un verde falso.** La
  API declaraba TypeScript 6.0 y tenía 5.9 instalado: el typecheck local pasó, pero verificando
  con la versión vieja — la unificación nunca se había probado. Lo atrapó el CI con
  `ERR_PNPM_OUTDATED_LOCKFILE`, que es tarde. **La puerta ahora verifica que el lockfile refleje
  los `package.json`** (`scripts/check-lockfile.py`). Dos corolarios: cambiar una versión declarada
  no la instala, y un verde sobre el entorno equivocado es peor que un rojo. El primer intento del
  chequeo usaba `pnpm install --lockfile-only`, que **reescribe el lockfile** — un verificador que
  muta lo que verifica no es un verificador, así que quedó como comparación textual.
- **2026-07-29 · Un artefacto derivado contradijo al entregable y nos hizo decidir mal.** Cuatro
  `.puml` regenerados desde los PDF de M1 tenían las flechas de la FSM invertidas. Durante toda una
  sesión creímos que el entregable estaba mal y registramos un "desvío" (D-020) que **no existía**.
  **Antes de concluir que un entregable está mal, verificá que estás mirando el entregable y no una
  transcripción.** El paquete canónico de M1 es `M1-D2-Architecture-and-Data-Models/`, hasheado en
  la Proof of Achievement.
- **2026-07-29 · Las capturas de M2-D2 tienen datos mock, no datos de diseño.** M2-D1 §Primary
  platform characteristics lo dice: *"the maquette uses mock blockchain interactions"*. El panel
  del certifier (captura 55) muestra tres unidades del mismo proyecto en tres stages distintos, y
  **casi me hace modelar los stages por unidad** — cuando el dominio dice que un desarrollo tiene un
  solo trámite (D-029). Lo normativo de una captura es la **estructura**: layout, componentes,
  jerarquía, estados. Los valores, no.
- **2026-07-29 · Grepear solo `*.md` esconde entregables.** Busqué "council of experts" en `docs/`
  con `--include="*.md"` y concluí que no aparecía. Estaba en un `.csv`, y en una carpeta que
  todavía no se había copiado. Grepeá sin filtro de extensión, y verificá que el árbol esté
  completo antes de afirmar una ausencia.
- **2026-07-29 · Los PDF de este repo no se leen con la herramienta de lectura** (falta
  `pdftoppm`), y extraerles el texto no alcanza para un diagrama: las flechas son trazos
  vectoriales, no texto. Renderizalos primero: `qlmanage -t -s 1800 -o <dir> archivo.pdf`.
- **2026-07-29 · Los códigos de entregable (`D1`, `D2a`…) se reinician en cada milestone y
  colisionan**: `M1-D1` es el whitepaper, `M2-D1` es el mapa de arquitectura de información. Dentro
  de los documentos de M2, un "D1 §5" suelto significa siempre M2-D1. Al citar en specs, commits o
  código, **usá siempre la forma completa** (`M2-D1 §4`).
- **2026-07-29 · `M2-D5` y `M2-D6` son entregables de Milestone 2, aunque vivan en
  `docs/milestone-3-implementacion/`**: son los planes *de* M3 escritos *en* M2. Se archivan junto
  al SOM de M3 porque en la práctica se leen juntos.
