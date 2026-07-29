# ROADMAP.md

> **Precedencia:** direccional. Ante conflicto mandan `DECISIONS.md`, `CLAUDE.md` y `STACK.md`.
> El detalle pantalla-por-pantalla **no se duplica acá**: vive en `M2-D5` (53 entradas con endpoint,
> test ID y work stream). Este documento define el orden, las dependencias y los criterios de salida.
>
> **Reescrito 2026-07-29**, al incorporar la documentación oficial completa. La versión anterior
> planificaba contra un recorte de demo; esta planifica contra el alcance real de M3.

## Mandato (una frase)

Entregar **Milestone 3 — Core Backend, Smart-Contract Development & Integration**: el backlog
completo de `M2-D5`, corriendo de punta a punta en un entorno de pre-producción público, con
anclaje real en Preprod y verificable por cualquier tercero vía TXID.

## Alcance: qué es M3 y qué es M4

| | Milestone 3 | Milestone 4 |
|---|---|---|
| Red | **Preprod** (D-013) | Mainnet |
| Entorno | Pre-producción pública | Producción |
| Datos | Semilla + piloto con 3 participantes | Reales |
| Contratos | Escritos, testeados ≥95%, desplegados en testnet | Congelados y auditados (trigger de D-001) |
| Custodia de valor | **Ninguna** (D-021) | **Ninguna** (D-021) |

D-021 aplica a las dos columnas: la plataforma nunca custodia ni transfiere dinero. Lo que cambia
en M4 es la red y el rigor operativo, no el modelo de confianza.

## Qué controlamos y qué no

- **Controlamos:** todo el código, el deploy, la red Preprod (faucet libre), el alcance de cada fase.
- **No controlamos:** disponibilidad de Blockfrost, tiempos de confirmación de la red, adopción de
  wallets CIP-30 por notarios y certificadores, y la **disponibilidad de los 3 participantes piloto**
  que el SOM exige que elijan los developers socios.
- **Consecuencia:** "listo" se define como **listo para activar**. Todo lo que depende de terceros
  queda detrás de configuración (`CARDANO_NETWORK`, `ANCHOR_MODE`, D-014), activable en días.
- **Riesgo de agenda no técnico:** la carta de confirmación de los participantes piloto es un
  entregable de M3 y depende de gente fuera del equipo. **Arrancar ese contacto en la Fase 1, no
  en la Fase 7.**

## "Listo" — los criterios de aceptación del SOM, verbatim y verificables

M3 se aprueba cuando estas afirmaciones son verificables por un tercero sin ayuda del equipo.
Están tomadas de `docs/milestone-3-implementacion/Milestone-3-info.md`; el mapeo a evidencia es nuestro.

| # | Criterio del SOM | Evidencia que lo demuestra |
|---|---|---|
| 1 | Los contratos compilan | `aiken check` verde en CI; `plutus.json` commiteado coincide con el código |
| 2 | Unit tests ≥ **95% coverage** | Reporte de coverage en CI (hoy: **0 tests**) |
| 3 | Soporta **≥8 stages** con signers/percentages configurables | Tests parametrizados; plantilla estándar de 10 stages (M2-D1 §5.2) |
| 4 | **3 participantes piloto** confirman que la plataforma refleja correctamente el avance de obra y la lógica de certificación | Carta de confirmación firmada |
| 5 | Endpoints de API documentados | Colección Postman/OpenAPI publicada |
| 6 | Proof objects validados | Tests por patrón P1–P10 contra los contratos de datos de M2-D4 §8.1 |
| 7 | **Rechaza evidencia sin firmar** | Test de rechazo — ⚠️ *requiere definir qué significa "firmada"; ver Decisiones abiertas* |
| 8 | Flujos de UI funcionan end-to-end en pre-prod | Los test IDs de M2-D5 §4-6 verdes en CI + walkthrough grabado |
| 9 | Mediana **reserva → escrow < 12 min** | Telemetría instrumentada + capturas; definición de la métrica en D-021 |
| 10 | Audit logs persistidos | Ledger append-only consultable y paginable (M2-D4 §Patrón 6) |
| 11 | **Sin hallazgos P1 de seguridad** abiertos tras remediación | Reporte de security review con hallazgos y fixes aplicados |
| 12 | Pre-prod accesible en una **URL pública** | La URL, viva |
| 13 | **Video walkthrough** grabado | El video, del flujo completo |
| 14 | **Runbook** completo (deploy / rollback / incidente) | El runbook en el repo + capturas de monitoreo |
| 15 | Lista de **TXIDs** de los anclajes de prueba | Publicada y resoluble en un explorador de Preprod |
| 16 | README marca **carpetas públicas vs privadas** | ⚠️ *requisito del SOM que hoy no está atendido* |

**Nada de esto es opcional y varios ítems no son código.** Los ítems 4, 11, 12, 13, 14 y 16 no se
resuelven programando y son los que históricamente se dejan para el final.

## Estado actual, sin maquillaje

| Frente | Hecho | Falta |
|---|---|---|
| Datos | User, Project, Milestone, Evidence, AuditLog | Unit, Invitation, Contract, PaymentRelease, EvidenceBundle, Certificate, Dossier, Signature, Notification, Favorite, Document, OnChainEvent · rol `notary` · rename D-023 |
| API | auth JWT+bcrypt, CRUD, SHA-256, audit log, permisos 2 capas, base `/api/v1` | 18 work streams `M3-BE-01..18`; Merkle y proof paths; proof objects |
| Web | 5 rutas, `ApiPort`, 4 componentes de dominio, tests de login | 26 work streams `M3-FE-01..26`; ~70 pantallas; 36 componentes; i18n; sistema de diseño M2-D3; shell mobile-first |
| Contratos | Proyecto Aiken v1.1.21 / Plutus V3, validador V1, blueprint en CI | **0 tests** (se exige ≥95%); 6 operaciones `M3-SC-01..06`; timeouts y fallback branches; naming de scaffold |
| Cardano | `AnchorPort` diseñado (D-014) | Sin implementar: ni `blockfrost` ni `simulated` |
| Ops | CI de calidad, Docker | Pre-prod público, telemetría, runbook, security review |

## Fases

Ordenadas por **dependencia de datos**, no por calendario. El orden sigue los flujos cross-rol de
M2-D1 §6: el developer crea lo que el certifier valida, y ambos producen lo que el investor consume
y el notary firma.

### Fase 0 — Consolidación documental y replanificación *(en curso)*

`docs/` reorganizado a los entregables oficiales; `STACK.md`; D-018 a D-025; `CLAUDE.md`, `README.md`
y este roadmap alineados. **Pendiente en esta fase:** reescribir `specs/` contra el backlog de M2-D5
(las specs actuales precedieron a la documentación oficial y varias quedaron superadas).

*Salida:* cero referencias colgadas; `specs/README.md` mapea cada spec a sus work streams `M3-*`.

### Fase 1 — Cimientos

Lo que todo lo demás asume, y que si se hace tarde obliga a reescribir cada pantalla dos veces.

- **Modelo de datos completo** + rol `notary` + rename D-023, en una migración.
- **Matriz de permisos de M2-D1 §4** implementada y testeada, incluido el aislamiento cross-rol
  (§7.3): un investor no puede ver la unidad de otro, un certifier solo ve stages asignados.
- **`packages/shared`**: schemas Zod reales, consumidos por API y web (antes, unificar TypeScript).
- **Sistema de diseño**: tokens de M2-D3, shadcn/ui, i18n es-AR/en-US, shell mobile-first con
  BottomNav por rol. Se tira `styles.css` de la maqueta vieja.
- **`AnchorPort` con adaptador `simulated`** funcionando: desbloquea todos los frentes sin red.
- **No técnico:** iniciar contacto con los 3 participantes piloto.

*Salida:* un componente cualquiera de M2-D3 se renderiza con sus tokens, en ambos locales, en mobile
y desktop; `pnpm test` corre los tests de permisos; el simulador ancla y verifica.

### Fase 2 — Walking skeleton: el flujo que define el producto

Un solo camino, de punta a punta, real: **DEV sube evidencia → Merkle + anclaje real en Preprod →
CER certifica → INV ve el TXID en su unidad**. Es M2-D1 §6.2 completo y toca los cuatro frentes.

Es además el **spike de D-005** (Lucid vs Mesh): si Lucid Evolution no ancla, se repite con Mesh y
se decide con evidencia.

*Salida:* criterio 15 arrancado (primer TXID público); D-005 cerrada; `AnchoringSuccessModal` muestra
Merkle root y TXID reales en la misma respuesta de la mutación (M2-D4 §8.1, Patrón 4).

### Fase 3 — Superficie Developer *(17 entradas de M2-D5 §5)*

Panel, projects (list/create/detail), units, invitaciones, upload de evidencia, contracts y releases,
capital, progress, documentation, investors, audit log.

*Salida:* `DEV-*` verdes en CI; audit log paginable y filtrable por las 5 categorías (M2-D4 §Patrón 6).

### Fase 4 — Superficie Certifier *(6 entradas de M2-D5 §6.2)*

Panel, assignments, certify, observe, issued. Cierra el lazo de la FSM: `Observed ⇄ InProgress`
funcionando de verdad (D-020).

*Salida:* `CER-*` verdes; una observación devuelve el stage al developer y queda en el audit log.

### Fase 5 — Superficie Investor *(24 entradas de M2-D5 §4)*

Buy (list/map/search/filter), project detail, stage detail con pruebas Merkle, favorites, units,
unit detail, contract y releases, notificaciones, invitación, **dossier + share + export**.

Es la fase más grande y la más rica en patrones de prueba: P1, P2, P3, P5, P7, P8, P9, P10.

*Salida:* `INV-*` verdes; dossier público por token accesible sin login y **sin PII de terceros**
(revisión manual además del test).

### Fase 6 — Superficie Notary *(6 entradas de M2-D5 §6.1)*

Panel, cola de dossiers, review, verify-and-sign, reject, signed history. Depende de que el dossier
exista (Fase 5). Incluye el **spike de D-009** (co-firma CIP-30 vs wallet por rol) con un profesional real.

*Salida:* `NOT-*` verdes; D-009 cerrada con evidencia.

### Track paralelo — Contratos

`contracts/` está aislado del workspace pnpm y no bloquea a nadie: corre en paralelo desde la Fase 1.

1. Rename y naming PropNexus (D-023); consolidar `milestone.ak` / `milestone2.ak` (D-017, Abierta).
2. **Suite de tests desde cero** — es el criterio 2 y hoy estamos en 0. Los casos borde de la FSM
   (D-020) son la suite mínima.
3. Las 6 operaciones `M3-SC-01..06`, todas como anclaje de commitment (D-021).
4. `≥8 stages`, signers parametrizados por rol, **timeouts y fallback branches** — los caminos de
   excepción que M1-D1 §Workflow exige y que hoy no existen.

*Salida:* criterios 1, 2 y 3.

### Fase 7 — Pre-producción y evidencia de entrega

Todo lo que no es código de producto y que el SOM exige igual: PostgreSQL (trigger de D-016), S3
(D-011), URL pública, telemetría de coverage/latencia/error budget, instrumentación de la métrica
de 12 minutos, security review con remediación de P1, runbook, video walkthrough, colección de API,
lista de TXIDs, marcado de carpetas públicas/privadas en el README, y la carta de los pilotos.

*Salida:* los 16 criterios verdes.

## Decisiones abiertas

| Decisión | Default | Qué la cierra | Fase |
|---|---|---|---|
| **"Rechaza evidencia sin firmar" (criterio 7): qué significa "firmada"** | Sin default — hay que decidirlo | M1-D1 §Identity & Signatures exige "autoridad primero" y prohíbe certificar un stage crítico con firmas incompletas. Hace falta una `D-0XX` que defina el modelo concreto. **Bloquea el diseño de `Evidence`** | Fase 1 |
| D-005 Lucid vs Mesh | Lucid Evolution | El walking skeleton mismo | Fase 2 |
| D-009 Custodia de firmas profesionales | Co-firma CIP-30 | Prototipo con un certificador real | Fase 6 |
| D-017 `milestone.ak` vs `milestone2.ak` | Conservar `milestone.ak` | Spike ≤1 día | Track contratos |
| Unificar TypeScript 5.8 / 6.0 | — | Deuda de `STACK.md` | Fase 1 |
| Nitro nightly → estable | — | Deuda de `STACK.md` | Fase 7 |

## Riesgos, señal temprana y plan B

| Riesgo | Señal temprana | Plan B |
|---|---|---|
| **Coverage ≥95% en contratos** es un salto desde 0 | Track de contratos sin tests al cerrar la Fase 2 | Es criterio de aceptación duro: no hay plan B, hay que empezarlo temprano |
| **Los 3 pilotos no responden a tiempo** | Sin contacto establecido al cerrar la Fase 2 | Escalar a los developers socios; es su compromiso elegirlos |
| Lib web3 bloquea (D-005) | El skeleton no ancla en la Fase 2 | Repetir con Mesh; decidir con evidencia |
| Fricción CIP-30 con profesionales (D-009) | Spike de la Fase 6 | Custodia delegada documentada con sus controles |
| Blockfrost caído o limitado | Errores 402/429 en el adaptador | `ANCHOR_MODE=simulated` mantiene el producto usable; cola de re-anclaje al volver |
| Confirmaciones lentas rompen la UX | `AnchoringSuccessModal` tarda >30s | Modal en dos tiempos: "enviado" (TXID) → "confirmado" (poll) |
| **Scope creep de UI**: 70 pantallas, 36 componentes | Una fase de superficie no cierra su criterio | M2-D5 lista las entradas; cortar las secundarias antes que mover la fecha. El dossier y el audit log **no** son cortables: son la tesis del producto |
| La métrica de 12 minutos se descubre tarde | No hay telemetría al llegar a la Fase 7 | Instrumentarla en la Fase 3, cuando nace el flujo de invitación |
