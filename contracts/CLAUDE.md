# contracts — validadores Aiken

> Se carga solo al tocar este subárbol. Las reglas duras (nunca custodiar valor, cero PII,
> metadata ≤64 bytes, blueprint commiteado) están en el `CLAUDE.md` de la raíz.

Aiken **v1.1.21** · **Plutus V3** (D-019) · stdlib v3.0.0.
Aislado del workspace pnpm (D-054): **corre en paralelo y no bloquea a nadie.** Es el track ideal
para trabajarlo por separado del resto del workspace.

```
lib/propnexus/fsm.ak     núcleo puro: tipos, tabla de transiciones, reglas del datum (32 tests)
validators/stage.ak      el validador: lo que solo se puede chequear con la tx (21 tests)
plutus.json              blueprint — se commitea tras cada build
```

El corte es el de D-008: **el validador es cáscara delgada sobre el núcleo puro.** Si una regla se
puede escribir sin mirar la transacción, va en `fsm.ak` y se prueba barato.

## La FSM canónica (D-020)

```
Pending → InProgress → Completed        (Completed es TERMINAL)
             ↑↓
          Observed                       (remediación, no estado final)
```

Sale textual del entregable original de M1 (`M1-D2/3-milestone-lifecycle.puml`). `Observed` es el
camino de remediación: se observa para que el developer corrija y vuelva a `InProgress`. El estado
en datos se llama `Completed` —no `Certified`, porque la plataforma no certifica (D-026)— y la
etiqueta visible sale del diccionario i18n.

**Una sola tabla de transiciones, espejada 1:1 con el backend.** Si cambia una, cambian las dos en
el mismo commit. **Ojo: hoy el espejo no existe del lado del backend** — `PATCH
/milestones/:id/state` acepta cualquier estado desde cualquier estado, así que la tabla solo se
aplica acá. Ver §Deuda.

## El datum sale de M1-D2, menos lo que no puede salir del off-chain

`StageDatum` es la entidad `Milestone` de `M1-D2/2-core-domain-model.puml` con dos filtros
encima: todo lo legible se queda afuera (whitepaper §On-Chain/Off-Chain Boundaries: *"No document
contents, personal data (…) are written on-chain"*, y regla 2 de la raíz), y solo entra lo que el
validador necesita para decidir.

| Campo | De dónde sale | Por qué está |
|---|---|---|
| `project_ref`, `stage_ref` | `milestone_id: UUID` de M1-D2 | refs **opacas**; el `name` del stage no viaja |
| `sequence_order` | M1-D2 | orden del stage dentro del proyecto; parte de la identidad |
| `validation_critical` | M1-D2 | decide si completar exige evidencia |
| `state` | M1-D2 §3 | la FSM de D-020 |
| `evidence_root` | `EvidenceBundle.bundle_commitment_hash` (M1-D2) | 32 bytes cuando existe; vacío hasta `Completed` |
| `completed_at` | `certified_at` (M1-D2) | POSIX ms, acotado por la ventana de validez de la tx |

**La regla que trae el whitepaper**, §Signature and Certification Rules: *"Milestones designated as
validation-critical cannot reach Certified status unless their required evidence set is complete"*.
Acá eso es literal: `validation_critical == True` sin un commitment de 32 bytes **no llega a
`Completed`**.

**El firmante es un solo `admin`, y eso es lo que M1 pide.** El whitepaper §System Overview dice
*"All blockchain interactions are performed by operator-controlled backend services"*. La co-firma
CIP-30 del certificador (D-009) es Fase B: no está acá, y su ausencia no es un desvío.

## Coverage: cada punto de rechazo contra su test

`aiken check` **no mide coverage de líneas** —solo tiene `--property-coverage`, que es la
distribución de labels en property tests—, así que el ≥95% del criterio 2 del SOM se demuestra con
esta tabla. **53 tests, 0 fallando.**

`lib/propnexus/fsm.ak` — 32:

| Qué prueba | Tests |
|---|---|
| La tabla de transiciones, **exhaustiva**: los 4 pares válidos y los 12 inválidos | `t_*_to_*` (16) |
| `Completed` es terminal (las 4 salidas fallan) | `t_completed_is_terminal_to_*` (4, incluidas arriba) |
| La identidad no se reescribe (proyecto, stage, orden, criticidad) | `t_identity_*` (5) |
| Un stage crítico exige commitment de 32 bytes; uno no crítico no | `t_critical_needs_a_full_commitment`, `t_non_critical_completes_without_evidence` |
| Evolución del datum: completar, no completar, y los cruces inválidos | `t_evolution_*` (9) |

`validators/stage.ak` — 21 (5 caminos felices + 16 puntos de rechazo):

| Punto de rechazo | Test |
|---|---|
| datum ausente | `spend_rejects_missing_datum` |
| el `own_ref` no está entre los inputs | `spend_rejects_unknown_own_ref` |
| dos inputs del script en la misma tx | `spend_rejects_two_script_inputs` |
| dos outputs al script | `spend_rejects_two_script_outputs` |
| ningún output de continuación | `spend_rejects_no_continuing_output` |
| falta la firma del operador | `spend_rejects_missing_admin_signature` |
| datum de salida no inline | `spend_rejects_non_inline_datum` |
| el valor bloqueado cambia (D-021) | `spend_rejects_value_drain` |
| transición fuera de la tabla | `spend_rejects_invalid_transition` |
| salir del estado terminal | `spend_rejects_leaving_completed` |
| identidad del stage reescrita | `spend_rejects_identity_rewrite` |
| criticidad bajada para evitar la evidencia | `spend_rejects_criticality_downgrade` |
| stage crítico completado sin evidencia | `spend_rejects_completing_critical_without_evidence` |
| el datum nuevo no coincide con el redeemer | `spend_rejects_datum_not_matching_redeemer` |
| `completed_at` fuera de la ventana de validez | `spend_rejects_timestamp_outside_validity_range` |
| ventana de validez abierta (sin punta finita) | `spend_rejects_open_ended_validity_range` |

Los negativos van marcados `test ... fail` porque los `expect` abortan en vez de devolver `False`.

## Estado y deuda

- **El backend no espeja la tabla de transiciones.** `PATCH /milestones/:id/state`
  (`apps/api/src/routes/milestones.routes.ts`) valida el *enum* con Zod y escribe, sin mirar el
  estado anterior: hoy se puede ir de `Pending` a `Completed`, o salir de `Completed`. El validador
  lo prohíbe, el backend no. **Es el arreglo más barato y de mayor valor pendiente del proyecto**, y
  vive del otro lado: `apps/api/CLAUDE.md`.
- **No hay thread token** (D-057, punto abierto 1). El validador exige 1 input y 1 output en la
  dirección del script, pero nada ata *cuál* UTxO es el hilo legítimo: se pueden abrir hilos
  paralelos con datums inventados. Se mitiga off-chain guardando el `OutputReference` del hilo
  real, así que la propiedad on-chain que promete D-008 **no está**.
- **No hay handler de creación.** Sin `mint`, el primer UTxO del hilo lo crea el operador con el
  datum que quiera: `Pending`, `sequence_order` y refs no se validan al nacer, solo se preservan.
  Se cierra junto con el thread token.
- **Cero co-firma por rol** (D-057, punto abierto 2): D-009 pide CIP-30 de notario y certificador
  para Fase B; hoy firma solo el operador, que es lo que M1 describe para Fase A.
- **El mapeo de ids off-chain → `*_ref` no está definido.** M1-D2 dice UUID, la regla 1 también, y
  el backend usa cuid2. El datum acepta cualquier `ByteArray`, así que la decisión sigue afuera:
  bytes del id, o `sha256(id)`. Definirlo antes del primer anclaje real.
- **Hubo un `contracts/reference/`** con 353 líneas que el compilador no leía y que describía otra
  FSM (`Certified`, salida del terminal). Se borró en **D-056**; no lo recuperes del historial.
- **La sintaxis de Aiken cambia entre versiones**: verificá contra la pineada (`aiken --version`)
  antes de asumir stdlib.

## Trampas

- **`aiken` no imprime diagnósticos si stdout no es un TTY.** Un `aiken check 2>&1 | tail` devuelve
  exit 1 y **ninguna línea de error**. Si algo falla y no ves por qué, corrélo en una terminal de
  verdad o envolvelo en un pty.
- **Los `use` van todos arriba del archivo**, incluso los que solo usan los tests. Un `use` a mitad
  de archivo es error de parseo, no advertencia.
- **Un módulo de `lib/` no puede llamarse igual que un validador**: `use propnexus/stage` junto a
  `validator stage` es "two top-level objects referred to as 'stage'". Por eso el núcleo puro es
  `fsm.ak` y no `stage.ak`.

## Autonomía

🟡 amarillo: el LLM propone, el humano revisa línea por línea antes de integrar. Bajó de rojo por
D-021 — no hay fondos en riesgo.

## Comandos

```bash
pnpm contracts:check      # aiken check (compila + corre los 53 tests)
pnpm contracts:build      # regenera plutus.json — commitealo (el CI verifica que esté al día)
aiken fmt                 # el CI corre 'aiken fmt --check'
aiken check -m <patrón>   # solo los tests cuyo nombre matchee
```
