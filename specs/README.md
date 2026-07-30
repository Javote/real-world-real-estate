# specs/ — El mapa de desarrollo

> **Precedencia:** `DECISIONS.md` > `CLAUDE.md` > `specs/`. La numeración nunca se recicla.
> Este archivo absorbe el antiguo `ROADMAP.md` (2026-07-29): un solo índice del trabajo, para que
> no haya dos listas que diverjan.
>
> ⚠️ **La estructura de specs está en rediscusión.** El registro de abajo es el heredado y quedó
> superado por la documentación oficial de M2/M3. La auditoría de conformidad y los criterios de
> aceptación **sí son vigentes**.

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
| 11 | **Sin hallazgos P1** de seguridad abiertos | Reporte de security review con fixes |
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
  shape de `Project`/`Evidence` en Prisma.
- **Se reemplaza:** las 5 rutas web como UI · `styles.css` · `MilestoneStateBadge` y `AppHeader` ·
  el CRUD de `users` (no aparece en ninguna superficie de rol) · `/dashboard` y `/verify`.

> **Hueco entre entregables detectado en la auditoría.** `/verify` no existe en M2-D5, pero M1-D1
> §Evidence Model promete *"una guía paso a paso para que cualquier revisor externo verifique la
> integridad de forma independiente"*. O esa verificación es un documento y no una pantalla, o M2
> tiene un hueco respecto del whitepaper. **Hay que decidirlo, no descubrirlo en la revisión.**

## Orden de trabajo

Ordenado por **dependencia de datos**, siguiendo los flujos cross-rol de M2-D1 §6: el developer crea
lo que el certifier valida, y ambos producen lo que el investor consume y el notary firma.

Cada rebanada deja la app **corriendo y demostrable** — ese es el criterio de corte.

| # | Rebanada | Qué podés hacer que antes no |
|---|---|---|
| 1 | Login de 4 roles | Entrás como cada rol y ves su panel, en ambos idiomas, en mobile |
| 2 | Developer crea proyecto, unidades y stages | Creás un desarrollo con su plantilla de 10 stages |
| 3 | **Evidencia → Merkle → TXID real** *(walking skeleton)* | Subís evidencia y obtenés un TXID verificable en cardanoscan |
| 4 | Certifier certifica y observa | La FSM cierra el lazo: observar devuelve el stage al developer |
| 5 | Invitación y aceptación | La unidad aparece en el portfolio del investor |
| 6 | Releases por stage | Cada liberación con su TXID, visible para ambas partes |
| 7 | Investor: browse, unidad, progreso | Recorrés el producto como comprador |
| 8 | Dossier + share público + export | Un tercero verifica sin cuenta |
| 9 | Notary firma | El dossier queda firmado con TXID |
| 10 | Audit log completo | Historia filtrable con verificación a un tap |
| 11 | Pre-prod, telemetría, seguridad, evidencia | Los 16 criterios en verde |

**Track paralelo — contratos.** `contracts/` está aislado del workspace pnpm y no bloquea a nadie:
corre en paralelo desde el inicio. (a) rename y naming PropNexus (D-023) + consolidar
`milestone.ak`/`milestone2.ak` (D-017); (b) **suite de tests desde cero** — es el criterio 2 y
estamos en 0; (c) las 6 ops como anclaje de commitment (D-021); (d) ≥8 stages, signers por rol,
timeouts y fallback branches (los caminos de excepción que M1-D1 §Workflow exige y hoy no existen).

## Decisiones abiertas

| Decisión | Default | Qué la cierra | Cuándo |
|---|---|---|---|
| ~~Qué significa "evidencia sin firmar"~~ | — | **Cerrada: D-028.** Ya no bloquea el modelo de datos. | — |
| **Vocabulario "certificate" en la UI** | Calificar levemente ("Certificado técnico") | Postura legal, no técnica — decisión del owner. Sub-ítem Abierto de D-026 | Rebanada 4 |
| **`/verify`: verificación independiente** | Sin default | M1-D1 la promete, M2-D5 no tiene pantalla. ¿Documento o superficie? | Rebanada 3 |
| D-005 Lucid vs Mesh | Lucid Evolution | El walking skeleton mismo | Rebanada 3 |
| D-009 Custodia de firmas profesionales | Co-firma CIP-30 | Prototipo con un certificador real | Rebanada 9 |
| D-017 `milestone.ak` vs `milestone2.ak` | Conservar `milestone.ak` | Spike ≤1 día | Track contratos |
| Unificar TypeScript 5.8 / 6.0 | — | Deuda; bloquea `packages/shared` | Rebanada 1 |

## Riesgos, señal temprana y plan B

| Riesgo | Señal temprana | Plan B |
|---|---|---|
| **Coverage ≥95%** es un salto desde 0 | Track de contratos sin tests al cerrar la rebanada 3 | Criterio duro: no hay plan B, hay que empezarlo temprano |
| **Los 3 pilotos no responden a tiempo** | Sin contacto al cerrar la rebanada 3 | Escalar a los developers socios; es su compromiso elegirlos |
| Lib web3 bloquea (D-005) | El skeleton no ancla | Repetir con Mesh; decidir con evidencia |
| Fricción CIP-30 con profesionales (D-009) | Spike de la rebanada 9 | Custodia delegada documentada con sus controles |
| Blockfrost caído o limitado | Errores 402/429 en el adaptador | `ANCHOR_MODE=simulated` mantiene el producto usable; cola de re-anclaje |
| Confirmaciones lentas rompen la UX | `AnchoringSuccessModal` tarda >30s | Modal en dos tiempos: "enviado" (TXID) → "confirmado" (poll) |
| **Scope creep de UI**: 70 pantallas, 36 componentes | Una rebanada de superficie no cierra | Cortar superficies secundarias antes que mover la fecha. Dossier y audit log **no** son cortables: son la tesis del producto |
| La métrica de 12 minutos se descubre tarde | No hay telemetría al llegar a la rebanada 11 | Instrumentarla en la rebanada 5, cuando nace el flujo de invitación |

---

## Registro de specs

**Vacío.** Las siete specs heredadas (`SPEC-001` a `SPEC-007`) se eliminaron el 2026-07-29: todas
precedían a la documentación oficial y describían prototipos descartables. Lo vigente de cada una ya
está absorbido en `DECISIONS.md` y en este mapa. Siguen en el historial: `git log --diff-filter=D --name-only -- 'specs/SPEC-*'`.

**La numeración no se recicla.** Las specs nuevas arrancan en `SPEC-008`.

La estructura en discusión —referencias normativas para los invariantes, y specs = rebanadas
verticales que dejan la app demostrable— todavía no está cerrada. Este archivo se actualiza cuando
lo esté.
