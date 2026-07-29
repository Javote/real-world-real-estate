# SPEC-002 — Validador milestone FSM (Aiken)

> Adoptada del repo backend en la consolidación (2026-07-15), donde era su SPEC-002. Describe el validador V1 **ya escrito** en `contracts/validators/milestone.ak`. El diseño Fase B (state-thread con thread token, D-008) vive en `contracts/reference/`.
>
> **Pendiente de reescritura (2026-07-29).** Esta spec precede a la documentación oficial de M2/M3 y quedó desactualizada en tres puntos: el rename a `ConstructionStage` (D-023), la FSM canónica (D-020) y el alcance del validador bajo D-021 (nunca custodia valor). Ver `specs/README.md`.

## Propósito

Validador `spend` que custodia el estado on-chain de un milestone de obra y garantiza que solo el admin pueda moverlo, y solo a través de transiciones válidas de la máquina de estados — espejo del enum `MilestoneState` del backend.

## Alcance / NO-alcance

- **Cubre:** las reglas de gasto del UTxO que representa un milestone (`contracts/validators/milestone.ak`).
- **NO cubre:** creación del UTxO inicial (mint/bootstrap), construcción de transacciones desde el backend (llega con `packages/cardano`, SPEC-001/D-014), multi-firma o roles distintos de un único admin.

## Interfaz

- **Parámetro del validador:** `admin: VerificationKeyHash`.
- **Datum** (`MilestoneDatum`): `project_id: ByteArray`, `project_name: ByteArray`, `milestone_id: Int`, `state: MilestoneState`.
- **Redeemer** (`MilestoneRedeemer`): `UpdateState(MilestoneState)`.
- **Estados:** `Pending | InProgress | Observed | Completed`.

### Transiciones válidas (`valid_transition`)

| Desde | Hacia |
|---|---|
| Pending | InProgress |
| InProgress | Observed, Completed |
| Observed | InProgress |
| Completed | — (terminal) |

## Invariantes

1. La tx lleva la firma del `admin` parametrizado (`extra_signatories`).
2. Exactamente 1 input y 1 output en la dirección del script por transacción (V1 simple: un milestone por tx).
3. El output continuador lleva `InlineDatum` decodificable como `MilestoneDatum`.
4. Identidad inmutable: `project_id`, `project_name` y `milestone_id` del datum nuevo igualan al viejo.
5. El `state` del datum nuevo coincide con el pedido en el redeemer y la transición `old.state → new.state` es válida según la tabla.
6. El valor bloqueado se conserva: `continuing_output.value == own_input.output.value`.

## Casos borde (definen los tests — hoy NO existen)

- Transición `Completed → cualquiera` → rechaza (estado terminal).
- Transición `Pending → Completed` (salto) → rechaza.
- `Observed → InProgress → Observed` (ciclo de observación) → acepta cada paso.
- Tx sin firma del admin → rechaza.
- Datum nuevo con `milestone_id` distinto → rechaza.
- Redeemer `UpdateState(Completed)` pero datum nuevo con `state: InProgress` → rechaza.
- Dos inputs del script en la misma tx (double satisfaction) → rechaza.
- Output continuador con menos valor que el input → rechaza.

## Preguntas abiertas

- **D-017 (Abierta):** `milestone2.ak` duplica este validador; hay que consolidar en un solo archivo.
- 0 tests en Aiken: los casos borde de arriba son la suite mínima a escribir (`aiken check` los correría).
- El estado on-chain y el de la DB pueden divergir (la API cambia estados sin tocar la chain); la reconciliación llega con la integración de `packages/cardano` (Sprint 2+).
