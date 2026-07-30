# CLAUDE.md

## Contexto (3 líneas)

**PropNexus** (Catalyst 1400106) — plataforma de ventas inmobiliarias en pozo: estructura el ciclo de obra en **stages**, organiza **evidencia** (planos, permisos, actas, certificados) y ancla **huellas criptográficas** (SHA-256/Merkle) en **Cardano** con timestamps. Off-chain: documentos, PII y lógica de negocio. On-chain: solo commitments compactos y TXIDs — **nunca valor** (D-021). Cuatro roles con superficie propia: investor (INV), developer (DEV), notary (NOT), certifier (CER).

**El problema real que resuelve.** Hoy es imposible verificar el estado real de los procesos de aprobación y avance de una obra en pozo: la evidencia está dispersa en canales informales y nada garantiza que lo que se muestra hoy sea lo que existía ayer. Esa opacidad ya causó daño económico real a compradores.

**Lo que la plataforma NO hace** (D-026): no certifica, no valida y no decide nada. Acompaña procesos que ya existen afuera y los refleja. El rol "certifier" verifica **integridad y completitud** contra los hashes anclados — no validez legal. La plataforma solo puede sostener cuatro afirmaciones: *este archivo tiene este hash* · *se registró en este momento* · *declara provenir de esta autoridad externa* · *esta persona atestiguó haberlo revisado*. Si escribís copy, modelo o validador que afirme algo más, está mal.

## Si llegás nuevo: punto de partida

**El código es una semilla, no la app.** `apps/web` está a ~2% de conformidad con el diseño aprobado:
sin `GradientHeader`, sin `BottomNav`, paleta equivocada, textos hardcodeados, "Milestones" donde va
"Stages". **Eso es lo esperado, no un bug que arreglar de paso.** Lo valioso de lo que existe son
decisiones de arquitectura (auth en dos capas, SHA-256 en el servidor, `AuditLog` append-only, el
patrón `ApiPort`, la topología de la FSM en Aiken), no superficie terminada. `packages/api` está
bastante mejor parado que `apps/web`: la API se evoluciona, el front se reemplaza.

Orden de lectura para agarrar contexto rápido:

1. Este archivo entero (son ~200 líneas y es lo único que se carga solo).
2. `specs/README.md` — el mapa: criterios de aceptación de M3, conformidad actual medida, orden de trabajo, decisiones abiertas, riesgos.
3. `DECISIONS.md` — el porqué. Si algo del código te parece raro, la respuesta está acá antes que en el código.
4. `docs/README.md` — índice de los entregables oficiales y los desvíos registrados.
5. Lo puntual del frente que vas a tocar (ver la tabla de §Documentación oficial más abajo).

Para ver la app corriendo: `pnpm e2e` o el skill `run-app`. **No improvises un driver de browser**, ya está armado.

## Vocabulario: "milestone" tiene dos significados — usá el correcto

| Término | Significa | Dónde |
|---|---|---|
| **Milestone** | Hito **Catalyst**: M1, M2, M3… Etapas contractuales del proyecto. | `docs/milestone-N-*/`, reportes de entrega |
| **Stage** (`ConstructionStage`) | Etapa de **obra** de un desarrollo. Es la entidad del dominio. | Código, API, specs, contratos |

Nunca uses "milestone" para una etapa de obra (D-023). Si ves `Milestone` en código, es deuda de rename pendiente.

## Jerarquía de precedencia — dos capas

- **Obligaciones (el *qué*, la vara de aceptación): manda `docs/`.** Entregables aprobados por reviewers. Ninguna decisión puede reducir lo que debemos.
- **Implementación (el *cómo*): `DECISIONS.md` > `CLAUDE.md` > `specs/`.**

Si encontrás una contradicción entre documentos: manda la de mayor precedencia y corregí el documento en conflicto **en el mismo PR**. Si la contradicción es con código, avisá antes de "arreglar" nada.

**`docs/` es INMUTABLE — no lo edites nunca**, ni para corregir un error evidente. Registrá una decisión en `DECISIONS.md` citando documento y párrafo. **Un desvío solo es legítimo si** (a) el entregable se contradice internamente, (b) es un error de redacción, o (c) seguirlo al pie contradiría una verdad del producto declarada por el dueño. **Nunca por conveniencia ni por preferencia técnica.** Los desvíos vigentes están en `docs/README.md`.

**Y antes de declarar que un entregable está mal: verificá que estás mirando el entregable.** Ya nos pasó decidir contra una transcripción errónea (ver Gotchas).

## Principios de trabajo (los diez que sostienen todo lo demás)

1. **Una sola fuente de verdad por cosa.** Cada dato vive en un lugar; el resto linkea, nunca copia. La duplicación diverge en silencio; el link roto es un fallo ruidoso — preferí siempre el fallo ruidoso.
2. **Jerarquía de precedencia explícita.** El documento en conflicto se corrige en el mismo PR en que se detecta la contradicción.
3. **Decidir rápido con defaults, refutar con spikes cortos** (≤2-3 días). Toda decisión abierta arranca con una opción por defecto; el spike existe para refutarla, no para explorar infinito. Reabrir una decisión aceptada requiere evidencia, no preferencia.
4. **El repo es la memoria; los chats son descartables.** Toda decisión, gotcha o convención que emerja en una sesión se persiste en el mismo PR.
5. **Documentar contra realidad, no intenciones.** Las specs se escriben cuando hay código real que documentar, un paso antes de necesitarlas. La documentación especulativa produce archivos que nadie corrige.
6. **Vertical primero (walking skeleton).** Antes de pulir capas, un hilo mínimo que atraviesa todo el sistema de punta a punta. Después se engorda ese hilo.
7. **Dependencias externas detrás de interfaces propias** con modo real/simulado conmutable por configuración. Los simuladores son producto, no stubs. Acá esa dependencia es Cardano (D-014).
8. **Redefinir "listo" según lo que controlás.** Si el hito depende de terceros, "listo" es *listo para activar*: todo lo bloqueado detrás de configuración, activable en días.
9. **LLMs para volumen, humanos para juicio**, con niveles de autonomía explícitos según riesgo. Nada de lógica crítica que el revisor no pueda explicar sin mirar el chat.
10. **CI desde el primer PR** y **documentación antes que código**, para que toda sesión tenga contexto desde el minuto uno.

## Estructura del repo

`apps/web` (TanStack Start) y `packages/api` (Express + Prisma) son los únicos servicios. `shared`/`db`/`cardano` son librerías (hoy placeholders con .gitkeep; el esquema Prisma vive en `packages/api/prisma`). `contracts/` es el proyecto Aiken: no se hostea, su versión es un entero (D-015).

Solo tres `.md` en la raíz, a propósito: **`README.md`** (entrada humana, arranque, variables de entorno), **`CLAUDE.md`** (este archivo: todo lo que un agente necesita en cada sesión) y **`DECISIONS.md`** (el porqué). El mapa de desarrollo está en `specs/README.md`; los entregables oficiales en `docs/` (índice en `docs/README.md`).

## Stack

Los entregables oficiales **son agnósticos de stack**: el único requisito técnico comprometido es que los contratos sean en **Aiken**. Todo lo de abajo es implementación nuestra y cambiarlo requiere una `D-0XX` nueva, no una edición de esta tabla.

| Frente | Stack | Versión real | Decisión |
|---|---|---|---|
| Workspace | pnpm workspaces, Node ≥20, TypeScript estricto | `pnpm@9.15.0` | D-001 |
| **web** | TanStack Start + Router + Query, React 19, Tailwind v4, Lucide, Vite, Vitest+jsdom | Start `^1.168` · TW `^4.1` | D-002, D-024 |
| **web** (falta) | shadcn/ui — primitivos accesibles para los 36 componentes de M2-D3 | pendiente | D-024 |
| **api** | Express 4 + Zod + JWT + bcrypt(10) + Multer 1.x, base `/api/v1` | Express `^4.21` | D-016 |
| **db** | Prisma; SQLite en dev → **PostgreSQL al desplegar** | `^6.6` (resuelve 6.19.x) | D-016 |
| storage | disco local en dev → **S3 genérico** (MinIO dev / R2 prod) | — | D-011 |
| **shared** | Zod, contrato único API↔web | placeholder vacío | D-012 |
| **cardano** | `AnchorPort` con adaptadores `blockfrost` (Lucid Evolution) y `simulated` | placeholder vacío | D-005, D-014 |
| **contracts** | Aiken v1.1.21 · **Plutus V3** · stdlib v3.0.0 · blueprint commiteado | `plutus.json` → `v3` | D-017, D-019 |
| red | **Preprod** en todos los entornos; mainnet fuera de alcance | — | D-013 |
| deploy | Docker · Railway con "Wait for CI" · GHA **solo valida** | — | D-010 |
| versionado | CalVer `vYYYY.MM.N` para servicios; entero para contratos; nada para packages internos | — | D-015 |

**Deuda técnica conocida** (registrada, sin decisión formal salvo donde se indica):

- Skew de TypeScript: `5.8` en la API contra `6.0` en la web. **Unificar antes de poblar `packages/shared`**, que los tipa a ambos.
- Nitro pineado a un **nightly** (`3.0.1-20260714-…`) que trajo el scaffold. **Ya está molestando, no solo en pre-prod:** su proxy de desarrollo rompe `POST`+`401` (ver Gotchas), lo que hace indebuggeables los caminos de error de auth en local. Pasar a estable subió de prioridad.
- `contracts/aiken.toml` con naming de scaffold (`j/milestone-fsm`, `version = "0.0.0"`, que incumple D-015).
- Multer 1.x emite warning de `url.parse()` deprecado; migrar a 2.x requiere decisión nueva.
- `apps/web/src/styles.css`: ~1000 líneas de CSS de la maqueta anterior, a reemplazar por los tokens de M2-D3 (D-024).

**Decisiones de stack abiertas:** D-005 (Lucid vs Mesh — lo cierra el walking skeleton) · D-009 (co-firma CIP-30 vs wallet por rol) · D-016 (Express→Hono solo con evidencia medida) · D-017 (`milestone.ak` vs `milestone2.ak`).

## Documentación oficial: qué leer antes de tocar cada frente

| Vas a tocar | Leé primero |
|---|---|
| Cualquier pantalla | `M2-D1` (árbol de pantallas y permisos del rol) + `M2-D3` (componentes) |
| Algo que muestre un hash, TXID o Merkle root | `M2-D4` (los 10 patrones son **normativos**) |
| Un endpoint | `M2-D5` §4-6 (trae el path, los test IDs y el work stream) + `M2-D6` §9 |
| Un validador | `M1-D1` §Workflow + D-020 (FSM) + D-021 (nunca valor) |
| El modelo de datos | `M1-D2b` + `M2-D1` §4 (matriz de permisos) |

## Reglas duras (innegociables)

1. **Datos primero:** dinero jamás en float — montos en unidades enteras mínimas (lovelace como `bigint`; moneda fiat en centavos `integer`). Timestamps en UTC. IDs = UUID.
2. **Cero PII on-chain o en logs:** ni nombres, ni emails, ni URLs internas, ni nombres de archivo en metadata, datums o logs. Solo hashes y refs opacas. Strings de metadata ≤ 64 bytes.
3. **El hash es el ticket de entrada a la cadena de prueba** (D-027). Solo se hashea lo que se va a anclar. Si un archivo tiene `sha256Hash`, termina anclado — o se muestra como "Pendiente" mientras confirma, **nunca** como "Verificado". El hash lo calcula el servidor y no se recalcula ni se edita después de creado. Los **assets** informativos (renders, folletos, galerías, fotos de unidad de muestra) no se hashean, no se anclan y no muestran ninguna señal de prueba. No hay estado intermedio: un archivo está en la cadena de prueba o no está.
4. **Passwords solo con bcrypt** (cost 10). Jamás loguear ni devolver `passwordHash` en ninguna respuesta.
5. **Autorización en dos capas, siempre:** rol global (`requireRole`) + membresía por proyecto (`canAccessProject`). `admin` bypasea membresías; el resto solo ve proyectos donde es miembro. La matriz completa está en M2-D1 §4.
6. **Todo body se valida con Zod** (`safeParse` + 400 con `error.flatten()`). Nada llega a Prisma sin pasar por un schema. Para endpoints nuevos: el schema va a `packages/shared` ANTES que el endpoint, y el frontend importa el mismo tipo.
7. **Toda mutación relevante escribe `AuditLog`** (append-only) vía `writeAuditLog`, con actor, entidad, acción, timestamp.
8. **Idempotencia en todo lo que toca plata o chain:** re-ejecutar un anclaje, release o migración no duplica efectos.
9. **Máquina de estados del stage:** `Pending → InProgress → {Observed ⇄ InProgress, Completed}`, `Completed` terminal (D-020). `Observed` es remediación, no estado final. Una sola tabla de transiciones, espejada entre backend y `contracts/`. La etiqueta que ve el usuario ("Certificado"/"Certified") sale del diccionario i18n, no del nombre del estado.
10. Uploads: solo `application/pdf`, `image/jpeg`, `image/png`; máximo `MAX_FILE_SIZE_MB` (default 10). Si un upload falla la validación después de que Multer escribió el archivo, **borrar el archivo huérfano** antes de responder.
11. **`contracts/plutus.json` se commitea** tras cada `aiken build`; direcciones de script derivadas del blueprint, jamás hardcodeadas.
12. **Secrets solo por env.** Si ves una seed/key commiteada: frená y avisá.
13. **Ningún validador custodia ni transfiere valor** (D-021). On-chain solo commitments y TXIDs. Si una spec o un prompt te pide un validador que retenga fondos, está mal: frená y avisá. "Release" significa anclar el evento de liberación, no ejecutar el pago.
14. **Cero strings hardcodeados en la UI** (D-025). Todo texto visible sale del diccionario i18n; toda moneda, fecha, relativo y decimal se formatea con `Intl.*` y el locale activo. Default `es-AR` con voseo ("Mirá tu unidad", no "Mira" ni "Mire").
15. **El backend devuelve claves de traducción, nunca copy** (M2-D4 §8.2). Vale para acciones de audit log, categorías, etiquetas de rol y nombres de stage. El cliente renderiza.
16. **Los hashes viajan completos al cliente** (M2-D4 §8.2). La truncación a 6+4 es exclusivamente de presentación, la hace `HashChip`. Nunca truncar en la capa de datos. Los TXID son case-sensitive y se transportan verbatim.
17. **Nunca mostrar una señal de prueba que no puedas sustanciar** (M2-D4 §6.2). Un pill "Verified", una marca de agua VERIFIED o un `HashChip` requieren un anclaje real. Si no hay TXID, el estado es "Pending", no "Verified".

## Prohibiciones (qué NO hacer aunque parezca buena idea)

- No migrar lógica de negocio on-chain: el backend es la fuente de verdad del lifecycle (D-007); on-chain se anclan pruebas.
- No importar Lucid/Blockfrost fuera del futuro adaptador real de `packages/cardano` (D-014). Las rutas de la API jamás llaman a la chain directo.
- En el front, no hacer `fetch` fuera de `ApiPort` (`apps/web/src/api/`): los adaptadores (`real` | `mock`) implementan la misma interfaz tipada.
- No tocar mainnet: `CARDANO_NETWORK=Preprod` siempre (D-013). CI no toca ninguna red.
- **No subir `@types/express` a v5** mientras `express` sea v4: los tipos v5 rompen todas las rutas (ver gotchas).
- **No editar migraciones ya aplicadas** en `packages/api/prisma/migrations/`; siempre migración nueva.
- No tocar `contracts/build/` (generado) ni editar `aiken.lock` a mano.
- No inventar endpoints, campos o dependencias fuera de spec/docs — proponer en el PR, no improvisar.
- No commitear `.env`, `dev.db`, `uploads/` ni artefactos de build.
- No "arreglar" tests cambiando contratos de API o esquema de DB para que pasen.
- No crear variantes ad-hoc de los componentes de dominio (HashChip/StatusPill/etc.): viven en `apps/web/src/components/domain/`.
- **No editar nada dentro de `docs/`** (D-022). Ni para corregir un error evidente.
- **No inventar estados ni patrones de prueba nuevos.** M2-D3 dice *"never invent new statuses"* y M2-D4 dice que un patrón nuevo se documenta antes de usarse. Como el documento es inmutable, en la práctica: patrón nuevo = decisión nueva en `DECISIONS.md`.
- No abrir un modal de verificación automáticamente (M2-D4 §6.3). Toda superficie de prueba es iniciada por el usuario; la única excepción es `AnchoringSuccessModal`, que confirma una acción que el usuario acaba de disparar.

## Método de trabajo LLM

- **Spec-driven:** antes de codear, leé la spec correspondiente (`specs/`, mapa en `specs/README.md`); si no existe y la tarea la amerita, la spec se escribe primero (≤2 págs, con el template).
- **PRs chicos con tests:** una tarea = una rama = un PR. Correr `pnpm typecheck && pnpm test` (y `aiken check` si aplica) ANTES de proponer el diff.
- **Persistencia de conocimiento:** toda decisión, gotcha o convención que surja en tu sesión va al repo en el mismo PR (DECISIONS.md, la spec, o la sección Gotchas de abajo).
- **Confinamiento:** trabajá solo en el frente asignado (web / api / contracts); las decisiones cruzadas las arbitra el humano. Los merges los secuencia el humano.
- **Pase de coherencia** al final de cada tanda grande de decisiones: grep de términos superados en todos los docs.

### Niveles de autonomía (por riesgo del código)

| Nivel | Qué cubre | Cómo se trabaja |
|---|---|---|
| 🟢 Verde | Componentes UI según M2-D3, endpoints CRUD según M2-D5, tests, docs, seeds | El LLM implementa directo; revisión de PR normal |
| 🟡 Amarillo | Migraciones de DB, auth/permisos/guards, pipeline de anclaje (`packages/cardano`), manejo de archivos/S3, config de CI/deploy, **validadores Aiken** | El LLM propone; revisión humana línea por línea antes de merge |
| 🔴 Rojo | Manejo de seeds/keys/firmas, todo lo que toque `SERVICE_WALLET_SEED`, la lógica de `canAccessProject`, hashing y construcción de commitments | El humano lidera y escribe; el LLM asiste. El revisor debe poder explicar cada línea sin mirar el chat |

Si dudás del nivel, es el más alto de los dos. *(Los validadores bajaron de 🔴 a 🟡 por D-021: no custodian valor. Lo que queda en rojo es lo que puede filtrar secretos o romper el aislamiento entre roles.)*

### Commits, ramas y PRs

Formato: `<tipo>(<scope>): <descripción en imperativo, minúscula, sin punto final> [<REF>]`

- **Tipos:** `feat` · `fix` · `refactor` · `test` · `docs` · `chore` · `perf` · `db`
- **Scopes (cerrados):** `web` · `api` · `db` · `shared` · `cardano` · `contracts` · `ci` · `repo`
- **REF:** el ID de M2-D5 entre corchetes cuando aplique (`[M3-BE-13]`, `[M3-FE-18]`, `[M3-SC-05]`)

```
feat(api): endpoint de subida de evidencia con merkle y anclaje [M3-BE-13]
feat(web): modal AnchoringSuccess con merkle root y txid [M3-FE-18]
db(db): tabla audit_log append-only con índice por categoría [M3-BE-16]
test(web): e2e DEV-EVIDENCE-UPLOAD-001
```

Reglas: un commit = un cambio lógico (no mezclar refactor con feature) · el cuerpo explica el *por qué*, no el *qué* · `BREAKING CHANGE:` en el footer si rompe contrato de API o esquema on-chain · nunca commitear `.env`, seeds de wallet, keys ni evidencia real.

### Ramas: una sola, `main` (D-030)

**Trunk-based mientras el equipo sea una persona.** No hay ramas de feature, no hay PRs, no hay
protección de rama. El ciclo es siempre el mismo:

> **planificar → implementar → testear → commitear → pushear**

Pushear es parte del ciclo, no un paso aparte: un commit que no se pusheó no existe para nadie más
y no pasó por CI.

**Puerta antes de pushear** (era el checklist del PR; sigue valiendo, sin la ceremonia):

- [ ] `pnpm typecheck` y `pnpm test` pasan
- [ ] Schema Zod en `packages/shared` actualizado (si toca la API)
- [ ] Evento de `AuditLog` agregado (si es mutación relevante)
- [ ] `aiken check` pasa (si toca contratos)
- [ ] Sin datos sensibles on-chain ni en logs

**Lo que no cambia:** el tamaño del commit. Un cambio lógico por commit sigue siendo la regla —
ahora importa más, porque el mensaje de commit es la única revisión que va a existir. Si un cambio
no se puede explicar en un mensaje, es demasiado grande.

Cuando se sumen más personas, esto se revierte a ramas + PR. El trigger está en D-030.

## Comandos

```bash
pnpm install                      # bootstrap del workspace
pnpm dev                          # web (:3000) + api (:8787) en paralelo
pnpm typecheck                    # typecheck de todos los packages
pnpm --filter @plataforma/api dev            # solo la API
pnpm --filter @plataforma/api db:generate    # regenerar cliente Prisma tras tocar schema
pnpm --filter @plataforma/api db:migrate     # nueva migración en desarrollo
pnpm --filter @plataforma/api db:seed        # datos demo (admin/dev/buyer/verifier, proyecto torre-a)
pnpm contracts:check              # aiken check (compila y corre tests de validadores)
pnpm contracts:build              # regenera plutus.json (commitearlo)
pnpm e2e                          # walkthrough Playwright (mobile + desktop) — NO corre en CI
pnpm --filter web e2e:ui          # el mismo, en modo interactivo
pnpm --filter web e2e:report      # abre el último reporte HTML
```

**Sobre `pnpm e2e`:** levanta web+api solo (reusa los que ya estén corriendo), recorre la app y deja
capturas, video y trace en `apps/web/e2e/.artifacts/` (gitignoreado). Se corre a mano, cada tanto —
no en cada commit. Produce tres cosas que el SOM de M3 pide como evidencia: los test IDs de M2-D5
ejecutándose, capturas, y el video del walkthrough (criterio 13).

Smoke test manual: `pnpm dev`, login en `http://localhost:3000` con `admin@example.com` / `admin123` (seed) y navegar a proyectos.

## Gotchas (sección viva — agregá acá el mismo día que te muerda una)

- **2026-07-29 · Un artefacto derivado contradijo al entregable y nos hizo decidir mal.** Cuatro `.puml` regenerados desde los PDF de M1 tenían las flechas de la FSM invertidas. Durante toda una sesión creímos que el entregable estaba mal dibujado y registramos un "desvío" (D-020) que **no existía**: el original decía exactamente lo que habíamos decidido. **Antes de concluir que un entregable está mal, verificá que estás mirando el entregable y no una transcripción.** El paquete canónico de M1 es `M1-D2-Architecture-and-Data-Models/`, y está hasheado en la Proof of Achievement.
- **2026-07-29 · El proxy de nitro en dev convierte `POST` + `401` en `502 Bad Gateway`.** Reproducible al 100%, y **solo** esa combinación: `GET 401`, `POST 400` y `POST 200` pasan bien. Sale de `h3@2.0.1-rc.25` dentro de `nitro-nightly` (`runtime/internal/vite/dev-worker.mjs` → "fetch failed"), así que **es solo del dev-worker**: en producción la API es otro origen y no hay proxy. **Consecuencia:** el camino de error más común de cualquier app —credenciales inválidas— muestra "No se pudo conectar con la API" en desarrollo. Antes de debuggear un error de auth, verificá contra `:8787` directo. Queda como `test.fail()` en el walkthrough E2E para que avise cuando se arregle.
- **2026-07-29 · Los tests E2E necesitan esperar la hidratación, no el DOM.** La app llega por SSR y los formularios son controlados por React: si Playwright hace click antes de que React monte, el `<form>` hace submit nativo, nunca corre el `preventDefault` y la página recarga sin llamar a la API. Da fallas intermitentes que parecen de backend. Hay que sondear la hidratación con una interacción que solo React pueda satisfacer — ver `waitForHydration` en `apps/web/e2e/walkthrough.spec.ts`.
- **2026-07-29 · `test.fail()` a nivel `describe` aplica a todos los tests que siguen**, no solo al próximo. Para marcar un test suelto va **dentro** del cuerpo. Puesto afuera hizo fallar los 16.
- **2026-07-29 · Los `<label>` de `login.tsx` no estaban asociados a sus inputs** (sin `htmlFor`/`id`), así que `getByLabel` no los encontraba y el formulario incumplía la accesibilidad que M2-D3 exige. Los tests de vitest no lo detectaban porque usaban otros selectores. Corregido. **Usá selectores accesibles en los tests: fallan cuando la accesibilidad está mal, que es justo lo que querés.**
- **2026-07-29 · Un `*.test.tsx` dentro de `src/routes/` lo escanea el router de TanStack** y avisa "does not export a Route". Prefijarlo con `-` o configurar `routeFileIgnorePattern`. Y `vitest` levanta los `.spec.ts` de `e2e/` si no se los excluye: su `include` por defecto matchea `test` **y** `spec`.
- **2026-07-29 · Las capturas de M2-D2 tienen datos mock, no datos de diseño.** M2-D1 §Primary platform characteristics lo dice: *"the maquette uses mock blockchain interactions"*. El panel del certifier (captura 55) muestra tres unidades del mismo proyecto en tres stages distintos, y **casi me hace modelar los stages por unidad** — cuando el dominio dice que un desarrollo tiene un solo trámite (D-029). Los hashes, TXIDs, números y combinaciones de las capturas son relleno. Lo normativo de una captura es la **estructura**: layout, componentes, jerarquía, estados. Los valores, no.
- **2026-07-29 · Grepear solo `*.md` esconde entregables.** Busqué "council of experts" en `docs/ --include="*.md"` y concluí que no aparecía. Estaba en un `.csv` — y encima en una carpeta que todavía no se había copiado. Grepeá sin filtro de extensión, y verificá que el árbol esté completo antes de afirmar una ausencia.
- **2026-07-29 · Los PDF de este repo no se leen con la herramienta de lectura** (falta `pdftoppm`). Y extraerles el texto no alcanza para un diagrama: las flechas son trazos vectoriales, no texto. Renderizalos primero: `qlmanage -t -s 1800 -o <dir> archivo.pdf` genera un PNG sin instalar nada.

- **2026-07-29 · Los códigos de entregable (`D1`, `D2a`…) se reinician en cada milestone y colisionan**: `M1-D1` es el whitepaper, `M2-D1` es el mapa de arquitectura de información; `M1-D2a` es la arquitectura del sistema, `M2-D2a` es el catálogo de pantallas. Dentro de los documentos de M2, un "D1 §5" suelto significa siempre M2-D1. Al citar en specs, commits o código, **usá siempre la forma completa** (`M2-D1 §4`).
- **2026-07-29 · `M2-D5` y `M2-D6` son entregables de Milestone 2, aunque vivan en `docs/milestone-3-implementacion/`**: son los planes *de* M3 escritos *en* M2. Están archivados junto al SOM de M3 porque en la práctica se leen juntos.
- **2026-07-29 · Tailwind v4 y `lucide-react` ya vienen instalados** en `apps/web` (los trajo el scaffold de TanStack Start). No los agregues de nuevo. Lo que falta es shadcn/ui y reemplazar `styles.css` (CSS de la maqueta vieja) por los tokens de M2-D3.
- **2026-07-29 · `contracts/aiken.toml` conserva naming de scaffold**: `name = "j/milestone-fsm"`, `repository.user = "j"`, `version = "0.0.0"` (que además incumple D-015, que pide entero incremental). Corregir junto con el rename de D-023.

- **2026-07-15 · Prisma ≥6.16 ya no carga `.env` desde el client**: el install fresco del workspace resolvió `^6.6.0` → 6.19.x y `prisma/seed.ts` falló con "Environment variable not found: DATABASE_URL" (en el repo original funcionaba). Fix: `import "dotenv/config"` primero en todo entrypoint que use PrismaClient fuera del server (el server ya lo carga en `app.ts`). El CLI de Prisma (`migrate`, `studio`) sí sigue cargando `.env` solo.

- **2026-07-15 · `@types/express` v5 con Express 4 rompe el typecheck** (21 errores `string | string[]` en `req.params`). Quedó pineado a `^4.17.21`. No "actualizar" ese paquete por su cuenta.
- **2026-07-15 · Warning `url.parse()` deprecado al arrancar la API**: viene de Multer 1.x, no de nuestro código. Inofensivo; desaparecería al migrar a Multer 2.x (requiere decisión nueva por cambios de API).
- **2026-07-15 · `contracts/validators/milestone.ak` y `milestone2.ak` son casi idénticos** (mismo validador, dos estilos). Consolidación pendiente — D-017.
- **2026-07-15 · Los validadores Aiken tienen 0 tests** (`aiken check` pasa en verde vacío). Los casos borde de la FSM (D-020) son la suite mínima a escribir.
- La sintaxis de Aiken cambia entre versiones: verificá contra la versión pineada en CI (`aiken --version`) antes de asumir stdlib. Los `.ak` de este repo asumen v1.1.x.
- Metadata de Cardano: strings > 64 bytes revientan al construir la tx — validar antes de firmar (D-006).
- El scaffolder de TanStack Start cambia de flags entre versiones: `pnpm create @tanstack/start@latest --help` primero.
