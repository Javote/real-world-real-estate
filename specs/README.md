# specs/ — El mapa de desarrollo

> ## ⚠️ Este archivo se disuelve en el commit 1 del plan
>
> Ver **`specs/PLAN-2026-08-21-saneamiento-y-flujo.md`**. El §Orden de trabajo de abajo (11 rebanadas
> inventadas) queda reemplazado por las **53 filas de backlog de M2-D5**
> (`docs/milestone-3-implementacion/UI-implementation-plan.md`), que ya traen path, componentes,
> endpoints, test IDs y patrón por superficie. Una rebanada = un grupo de filas que comparten
> `M3-BE-XX`.

> **Precedencia:** `DECISIONS.md` > `CLAUDE.md` > `specs/`. La numeración nunca se recicla.
> Un solo índice del trabajo, para que no haya dos listas que diverjan.
>
> **Una spec = una rebanada vertical** (cerrado el 2026-08-20, ver D-032). La spec no repite el
> backlog de M2-D5: lo linkea, y aporta lo que M2-D5 no trae — invariantes, casos borde, delta del
> modelo de datos y definición de terminado.

## Mandato

Entregar **Milestone 3 — Core Backend, Smart-Contract Development & Integration**: el backlog
completo de `M2-D5`, corriendo de punta a punta en pre-producción pública, con anclaje real en
Preprod y verificable por cualquier tercero vía TXID.

## Alcance de M3

| | |
|---|---|
| Red | **Preprod**, en todos los entornos (D-013) |
| Entorno | Pre-producción pública |
| Datos | Semilla + piloto con 3 participantes |
| Contratos | Escritos, testeados ≥95%, desplegados en testnet |
| Custodia de valor | **Ninguna** (D-021) |

Mainnet y producción quedan fuera de M3 y no se planifican acá: requieren entorno nuevo, wallet
nueva y aprobación explícita (D-013).

## Qué controlamos y qué no

- **Controlamos:** el código, el deploy, la red Preprod (faucet libre), el alcance de cada rebanada.
- **No controlamos:** disponibilidad de Blockfrost, tiempos de confirmación, adopción de wallets
  CIP-30 por notarios y certificadores, y la **disponibilidad de los 3 participantes piloto** que el
  SOM exige que elijan los developers socios.
- **Consecuencia (principio 8):** "listo" es *listo para activar* — lo que depende de terceros queda
  detrás de configuración (`CARDANO_NETWORK`, `ANCHOR_MODE`), activable en días.
- **Riesgo de agenda no técnico, atenuado:** la carta de confirmación de los pilotos es un entregable
  de M3 y depende de gente externa. La buena noticia es que **la relación ya existe desde M1**:
  `M1-D3-PilotPlan.pdf` incluye cartas de conformidad de un notario y dos developers, y define
  timeline, alcance y métricas del piloto. Hay que leerlo antes de planificar la validación con
  pilotos — probablemente ya contesta parte del criterio 4. Lo que sigue siendo nuestro trabajo es
  **volver a contactarlos temprano**, no en la última rebanada.

## "Listo" — los criterios de aceptación del SOM

M3 se aprueba cuando estas afirmaciones son verificables por un tercero sin ayuda del equipo.
Tomados de `docs/milestone-3-implementacion/Milestone-3-info.md`; el mapeo a evidencia es nuestro.

| # | Criterio | Evidencia |
|---|---|---|
| 1 | Los contratos compilan | `aiken check` verde en CI; `plutus.json` coincide con el código |
| 2 | Unit tests **≥95% coverage** | Reporte de coverage en CI (hoy: **0 tests**) |
| 3 | **≥8 stages** con signers/percentages configurables | Tests parametrizados; plantilla estándar de 10 stages |
| 4 | **3 participantes piloto** confirman que refleja el avance de obra y la lógica de certificación | Carta firmada |
| 5 | Endpoints documentados | Colección Postman/OpenAPI publicada |
| 6 | Proof objects validados | Tests por patrón P1–P10 contra M2-D4 §8.1 |
| 7 | **Rechaza evidencia sin firmar** | Test de rechazo — ⚠️ *falta definir qué significa "firmada"* |
| 8 | Flujos de UI end-to-end en pre-prod | Test IDs de M2-D5 §4-6 verdes + walkthrough |
| 9 | Mediana **reserva → escrow < 12 min** | Telemetría + capturas; métrica definida en D-021 |
| 10 | Audit logs persistidos | Ledger append-only paginable (M2-D4 P6) |
| 11 | **Sin hallazgos P1** de seguridad abiertos | Reporte de security review con fixes — el P1 conocido (`JWT_SECRET`) se cerró el 2026-08-20 (D-042, `SPEC-010`); falta correr el review |
| 12 | Pre-prod en **URL pública** | La URL, viva |
| 13 | **Video walkthrough** | El video del flujo completo |
| 14 | **Runbook** deploy / rollback / incidente | El runbook + capturas de monitoreo |
| 15 | Lista de **TXIDs** de anclajes de prueba | Publicada y resoluble en un explorador |
| 16 | README marca **carpetas públicas vs privadas** | ⚠️ *requisito hoy no atendido* |

**Seis de los dieciséis no se resuelven programando** (4, 11, 12, 13, 14, 16) y son los que siempre
se dejan para el final.

## Conformidad actual (auditoría 2026-07-29)

| Frente | Conforme | Detalle |
|---|---|---|
| Endpoints | **2 de ~80** | Solo `POST /auth/login` y `GET /auth/me` coinciden exacto. El resto existe con paths no scopeados por rol, o no existe. |
| Pantallas | **1 de 53** | Solo `/login`, y no conforma: pide email (M2-D2 pide *Username*), sin las 4 solapas de rol, sin `LanguageToggle`, sin `GradientHeader`. |
| Componentes | **4 de 36 por nombre, 0 conformes** | `HashChip` no trunca 6+4 y usa emoji en vez de Lucide; `StatusPill` es booleano en vez de la matriz de 5 estados. `MilestoneStateBadge` y `AppHeader` no existen en M2-D3. |
| Entidades | **6 de ~18** | Falta `Unit` —sobre la que giran contrato, releases y dossier— y el rol `notary`. |
| Contratos | topología correcta, **0 tests** | El criterio 2 pide ≥95%. Las 6 ops `M3-SC-01..06` no existen como tales. |
| i18n · tokens · shell mobile · Merkle · `AnchorPort` | **0%** | Nada implementado. |

**Conformidad global ≈ 2%.** El código existente es una **semilla** cuyo valor son decisiones de
arquitectura, no superficie terminada:

- **Se conserva:** auth JWT+bcrypt con autorización en dos capas · SHA-256 en el servidor al subir ·
  `AuditLog` append-only · el patrón `ApiPort` en el front · la topología de la FSM en Aiken · el
  shape de `Project`/`Evidence`.
- **Se reemplaza:** las 5 rutas web como UI · `styles.css` · `MilestoneStateBadge` y `AppHeader` ·
  el CRUD de `users` (no aparece en ninguna superficie de rol) · `/dashboard` y `/verify`.

> **Hueco entre entregables detectado en la auditoría.** `/verify` no existe en M2-D5, pero M1-D1
> §Evidence Model promete *"una guía paso a paso para que cualquier revisor externo verifique la
> integridad de forma independiente"*. O esa verificación es un documento y no una pantalla, o M2
> tiene un hueco respecto del whitepaper. **Hay que decidirlo, no descubrirlo en la revisión.**

## Auditoría 2026-08-20 — qué bloquea el arranque de M3

> Hecha al preparar el harness de agentes, con luz verde para ir a fondo con M3. La de arriba mide
> **conformidad con el diseño**; esta mide **qué impide producir código**. Las mediciones están
> verificadas, no estimadas.

**Veredicto: el pensamiento es sólido, la configuración es de la fase anterior.** M1 y M2 fueron
entregables documentales y el sistema de gobernanza es excelente para eso. M3 es un hito de código
con 16 criterios binarios, y el repo llega con 30 decisiones, **0 specs**, **4 tests** y ~2% de
conformidad. Lo que sigue es lo que hay que cambiar, por palanca:

| # | Hallazgo | Evidencia | Estado |
|---|---|---|---|
| 1 | **La puerta no existía.** `pnpm test` corría 4 tests de 1 archivo; `apps/api` no tiene script `test` y `pnpm -r` lo saltea **en silencio** (`Scope: 2 of 3`); los contratos no estaban en `pnpm test`. 3 de los 5 ítems de la puerta eran inverificables. | medido | **resuelto** — hoy `pnpm verify` + CI; la puerta de D-032 se borró en D-053 |
| 2 | **`packages/shared` vacío desactiva la regla 6**, que es lo único que vuelve imposible el drift API↔web. Bloqueada por el skew TS 5.8/6.0. | — | **resuelto** — SPEC-008: TS unificado en 6.0, contrato de auth compartido, 21 tests |
| 3 | **El principio 1 ya se violaba:** jerarquía de precedencia escrita **4 veces**; "2% de conformidad" **4 veces**; trampas del front duplicadas entre `CLAUDE.md` y un skill; 267 líneas de README de scaffold sin información del proyecto. | grep | **resuelto** — contexto por subárbol (D-032) |
| 4 | **Los 6 criterios que no se programan estaban todos en la última rebanada.** El criterio 4 (3 pilotos) depende de gente externa y tiene el lead time más largo del proyecto; el 12 (URL pública) hacía caer el primer deploy real al final. | plan | **resuelto** — Track C, abajo |
| 5 | **Contratos: 0 tests contra un criterio de ≥95%**, declarado paralelo y sin nadie encima. Único criterio duro sin plan B. | `aiken check` verde vacío | **track propio** |
| 6 | **El rename D-023 sigue sin hacerse** y hoy es lo más barato que va a ser. | — | **SPEC-009** |
| 7 | **`contracts/aiken.toml` con naming de scaffold** (`j/milestone-fsm`, `version = "0.0.0"`, que incumple D-015). | — | **SPEC-009** |
| 9 | **La segunda capa de autorización es una función que hay que acordarse de llamar**, no un middleware que no se pueda olvidar. `requireRole` está en la cadena o no está; `canAccessProject` devuelve un booleano que alguien tiene que chequear, y un endpoint que se lo olvide **no tiene segunda capa y nada lo detecta**: ni el compilador, ni un test, ni la puerta. Hoy son 27 endpoints auditados sin agujeros; el backlog de M2-D5 son ~80. | auditoría 🔴 del 2026-08-20 + repaso del 2026-08-21 | **mitigado, no resuelto** — `scripts/check-project-access.py` corre en la puerta y hace que olvidarse sea ruidoso (D-044). La **forma** sigue 🔴 y con dueño humano: un `requireProjectAccess(...)` de Express que lea `req.params.projectId`. Se hace al arrancar la rebanada 1, o antes si el detector salta (trigger en D-044) |
| 8 | **D-030 no cubría los agentes en paralelo.** Su trigger era "segunda persona"; lo que llegó fue concurrencia de árboles. Los puertos estaban fijos en 3 lugares, así que dos árboles se pisaban. | medido | **resuelto** — D-031 |


## Orden de trabajo

Ordenado por **dependencia de datos**, siguiendo los flujos cross-rol de M2-D1 §6: el developer crea
lo que el certifier valida, y ambos producen lo que el investor consume y el notary firma.

Cada rebanada deja la app **corriendo y demostrable** — ese es el criterio de corte.

| # | Spec | Rebanada | Qué podés hacer que antes no | Estado |
|---|---|---|---|---|
| 0 | `SPEC-008` | **Cimientos verificables** *(no es vertical, a propósito)* | La puerta puede verificar la API y el contrato API↔web | **cerrada** 2026-08-20 |
| 0b | `SPEC-009` | Rename D-023 + naming de contratos | El dominio dice `stage` en todos lados | no escrita |
| 0c | `SPEC-010` | **Endurecer la superficie 🔴** *(tampoco es vertical)* | El código 🔴 no tiene defaults inseguros | **cerrada** 2026-08-21 |
| 0d | — | **Migrar `apps/api` de Prisma a Drizzle → Kysely** *(tampoco es vertical)* | El ORM deja de ser deuda antes de que el código nuevo se acople a Prisma | **cerrada** 2026-08-21 — D-048, D-049 |
| 1 | `SPEC-011` | Login de 4 roles | Entrás como cada rol y ves su panel, en ambos idiomas, en mobile | **cerrada** 2026-08-21 |
| **0e** | `SPEC-012` | **`requireProjectAccess`: la segunda capa como middleware** 🔴 *(tampoco es vertical)* | Olvidarse de la membresía se ve en la firma de la ruta, como se ve un `requireRole` faltante | **cerrada** 2026-08-23 |
| 2 | — | Developer crea proyecto, unidades y stages | Creás un desarrollo con su plantilla de 10 stages | no escrita |
| 3 | `SPEC-013` | **`AnchorPort`: conectar el registro con la cadena** — en tres cortes (A: puerto + simulador · B: adaptador real · C: reconciliación y `verify()`) | Subís evidencia, la anclás, completás el stage y el Merkle root queda en la cadena — verificado contra un nodo Cardano local | **A y B cerradas** 2026-08-23; C pendiente |
| 4 | — | Certifier certifica y observa | La FSM cierra el lazo: observar devuelve el stage al developer | no escrita |
| 5 | — | Invitación y aceptación | La unidad aparece en el portfolio del investor | no escrita |
| 6 | — | Releases por stage | Cada liberación con su TXID, visible para ambas partes | no escrita |
| 7 | — | Investor: browse, unidad, progreso | Recorrés el producto como comprador | no escrita |
| 8 | — | Dossier + share público + export | Un tercero verifica sin cuenta | no escrita |
| 9 | — | Notary firma | El dossier queda firmado con TXID | no escrita |
| 10 | — | Audit log completo | Historia filtrable con verificación a un tap | no escrita |
| 11 | — | Telemetría y cierre de evidencia | Los 16 criterios en verde | no escrita |

**Las specs se escriben una por vez, un paso antes de necesitarlas** (principio 5). Escribir las
once ahora produciría once archivos especulativos que nadie corrige.

### 0e, cerrada el 2026-08-23

Al borrar el harness (D-053) se fue con él `check-project-access.py`, que era lo único que gritaba
cuando un endpoint se olvidaba de la segunda capa. Se reemplazó por la forma que no lo necesita:
`requireProjectAccess(...)`, hermano de `requireRole`, que se lee en la firma de la ruta. Los 12
call sites quedaron convertidos y **`canAccessProject` ya no se llama desde ninguna ruta**.

Se hizo antes que la rebanada 2 a propósito: el momento barato de cambiar la forma era antes de la
tanda grande de endpoints, no después de escribir 50 con la forma vieja. Detalle en `SPEC-012`.

### Tracks paralelos

**Track B — contratos.** `contracts/` está aislado del workspace pnpm y no bloquea a nadie:
corre en paralelo desde el inicio. ~~(a) rename y naming PropNexus (D-023) + consolidar
`milestone.ak`/`milestone2.ak` (D-017)~~ *(cerrado: D-054 y D-057)*; ~~(b) **suite de tests desde
cero** — es el criterio 2~~ *(cerrado: D-057, 53 tests)*; (c) las 6 ops como anclaje de commitment
(D-021); (d) ≥8 stages, signers por rol, timeouts y fallback branches (los caminos de excepción que
M1-D1 §Workflow exige y hoy no existen). ~~Thread token y co-firma por rol~~ *(cerrados: D-058 —
un NFT por stage con `mint` validado; el operador es el único firmante)*.

**Track C — los seis criterios que no se programan.** Dueño: el humano. Estaban todos apilados en
la última rebanada, que es donde los proyectos mueren. Arrancan **ahora**, en paralelo:

| Criterio | Qué hacer ya | Por qué no puede esperar |
|---|---|---|
| **4 · 3 pilotos confirman** | Releer `M1-D3-PilotPlan.pdf` (ya trae cartas de un notario y dos developers) y **recontactarlos** | Es el lead time más largo del proyecto y no lo controlamos |
| **12 · URL pública** | Desplegar el esqueleto actual a Render free, aunque muestre poco. **Arranca de cero: hay que escribir el `render.yaml`** — runtime nativo, sin Docker (D-041). **Antes**: migrar evidencia a R2 — en free no hay disco persistente y el archivo se pierde cada 15 min (D-040). Dos variables que el `render.yaml` no puede olvidar: `JWT_SECRET` con `generateValue: true` (D-042) y `TRUST_PROXY_HOPS=1` (D-045). **El seed no se corre contra la instancia pública**, y desde D-047 ya no puede hacerse por accidente: contra una base no local exige `SEED_ADMIN_PASSWORD`/`SEED_DEMO_PASSWORD` o revienta | Un primer deploy al final es donde los proyectos mueren |
| **16 · README público/privado** | Una tabla en `README.md` | 20 minutos, hoy no está atendido |
| **11 · sin hallazgos P1** | El P1 conocido (`JWT_SECRET` caía a un literal público) **está cerrado**: D-042 + `SPEC-010`. Queda correr `/security-review` sobre el resto, antes del deploy | Los hallazgos tempranos son baratos, y ese se armaba solo el día que hubiera URL pública |
| **14 · runbook** | Se escribe con el primer deploy, no después | Se escribe solo si se escribe mientras pasa |
| **13 · video walkthrough** | Sale de `pnpm e2e`, que ya graba video | Ya está resuelto técnicamente |

## Decisiones abiertas

| Decisión | Default | Qué la cierra | Cuándo |
|---|---|---|---|
| ~~Qué significa "evidencia sin firmar"~~ | — | **Cerrada: D-028.** Ya no bloquea el modelo de datos. | — |
| **Vocabulario "certificate" en la UI** | Calificar levemente ("Certificado técnico") | Postura legal, no técnica — decisión del owner. Sub-ítem Abierto de D-026 | Rebanada 4 |
| **`/verify`: verificación *independiente*** | La pantalla ya existe (168 líneas, `ApiPort` + `HashChip`) — pero exige sesión y verifica contra la API, no contra la chain | Llega con `AnchorPort` (D-014): verificar sin cuenta y sin confiar en la plataforma. La pregunta ya no es si hay pantalla | Rebanada 3 |
| ~~D-005 Lucid vs Mesh~~ | — | **Cerrada: D-005 Aceptada** (2026-08-20). Lucid Evolution + Blockfrost, sin spike previo. | — |
| ~~D-009 Custodia de firmas profesionales~~ | — | **Cerrada: D-009 Aceptada** (2026-08-20). Co-firma CIP-30 no-custodial. | — |
| ~~D-017 `milestone.ak` vs `milestone2.ak`~~ | — | **Cerrada por D-054**: compilaban al mismo hash | — |
| ~~Unificar TypeScript 5.8 / 6.0~~ | — | **Cerrada: SPEC-008.** Los tres packages en `^6.0.2`. | — |

## Riesgos, señal temprana y plan B

| Riesgo | Señal temprana | Plan B |
|---|---|---|
| **Coverage ≥95%** es un salto desde 0 | Track de contratos sin tests al cerrar la rebanada 3 | Criterio duro: no hay plan B, hay que empezarlo temprano |
| **Los 3 pilotos no responden a tiempo** | Sin contacto al cerrar la rebanada 3 | Escalar a los developers socios; es su compromiso elegirlos |
| Lib web3 bloquea (D-005 ya aceptada, sin spike) | El skeleton no ancla | Repetir con Mesh y reabrir D-005 con esa evidencia |
| Fricción CIP-30 con profesionales (D-009 ya aceptada, sin prototipo) | Rechazo de los pilotos en la rebanada 9 | Custodia delegada documentada con sus controles, como decisión nueva |
| Blockfrost caído o limitado | Errores 402/429 en el adaptador | `ANCHOR_MODE=simulated` mantiene el producto usable; cola de re-anclaje |
| Confirmaciones lentas rompen la UX | `AnchoringSuccessModal` tarda >30s | Modal en dos tiempos: "enviado" (TXID) → "confirmado" (poll) |
| **Scope creep de UI**: 70 pantallas, 36 componentes | Una rebanada de superficie no cierra | Cortar superficies secundarias antes que mover la fecha. Dossier y audit log **no** son cortables: son la tesis del producto |
| La métrica de 12 minutos se descubre tarde | No hay telemetría al llegar a la rebanada 11 | Instrumentarla en la rebanada 5, cuando nace el flujo de invitación |

---

## Registro de specs

| Spec | Título | Rebanada | Estado |
|---|---|---|---|
| `SPEC-008` | Cimientos verificables | 0 | **cerrada** 2026-08-20 |
| `SPEC-010` | Endurecer la superficie 🔴 | 0c | **cerrada** 2026-08-21 |
| `SPEC-011` | Login de 4 roles | 1 | **cerrada** 2026-08-21 |
| `SPEC-012` | `requireProjectAccess`: la segunda capa como middleware | 0e | **cerrada** 2026-08-23 |
| `SPEC-013` | `AnchorPort`: conectar el registro con la cadena | 3 | **A y B cerradas** 2026-08-23 · C pendiente |

`SPEC-009` está reservada (rebanada 0b, rename D-023 + naming de contratos) pero todavía no
escrita.

Las siete specs heredadas (`SPEC-001` a `SPEC-007`) se eliminaron el 2026-07-29: precedían a la
documentación oficial y describían prototipos descartables. Lo vigente de cada una está absorbido
en `DECISIONS.md` y en este mapa. Siguen en el historial:
`git log --diff-filter=D --name-only -- 'specs/SPEC-*'`.

**La numeración no se recicla.** Por eso las nuevas arrancan en `SPEC-008`.
