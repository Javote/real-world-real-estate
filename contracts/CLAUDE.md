# contracts — validadores Aiken

> Se carga solo al tocar este subárbol. Las reglas duras (nunca custodiar valor, cero PII,
> metadata ≤64 bytes, blueprint commiteado) están en el `CLAUDE.md` de la raíz.

Aiken **v1.1.21** · **Plutus V3** (D-019) · stdlib v3.0.0.
Aislado del workspace pnpm (D-054): **corre en paralelo y no bloquea a nadie.** Es el track ideal
para trabajarlo por separado del resto del workspace.

```
lib/propnexus/fsm.ak     núcleo puro: tipos, tabla de transiciones, reglas del datum (40 tests)
validators/stage.ak      el validador: spend + mint, lo que necesita la tx    (33 tests)
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

**Una sola tabla de transiciones, y desde D-059 el espejo existe de verdad**: la misma tabla vive
en `packages/shared` (`STAGE_TRANSITIONS`) y la aplica `PATCH /milestones/:id/state` antes de
escribir. Si cambia una, cambian las dos en el mismo commit — y las dos suites prueban los 16 pares
exhaustivamente, así que una divergencia se ve como test rojo, no como una transacción rechazada en
la cadena.

## El datum sale de M1-D2, menos lo que no puede salir del off-chain

`StageDatum` es la entidad `Milestone` de `M1-D2/2-core-domain-model.puml` con dos filtros
encima: todo lo legible se queda afuera (whitepaper §On-Chain/Off-Chain Boundaries: *"No document
contents, personal data (…) are written on-chain"*, y regla 2 de la raíz), y solo entra lo que el
validador necesita para decidir.

| Campo | De dónde sale | Por qué está |
|---|---|---|
| `project_ref`, `stage_ref` | `milestone_id: UUID` de M1-D2 | refs **opacas**: los bytes crudos del id off-chain (hoy cuid2, 24 bytes). `stage_ref` es además el asset name del thread token, de ahí el tope de 32 |
| `sequence_order` | M1-D2 | orden del stage dentro del proyecto; parte de la identidad |
| `validation_critical` | M1-D2 | decide si completar exige evidencia |
| `state` | M1-D2 §3 | la FSM de D-020 |
| `evidence_root` | `EvidenceBundle.bundle_commitment_hash` (M1-D2) | 32 bytes cuando existe; vacío hasta `Completed` |
| `completed_at` | `certified_at` (M1-D2) | POSIX ms, acotado por la ventana de validez de la tx |

**La regla que trae el whitepaper**, §Signature and Certification Rules: *"Milestones designated as
validation-critical cannot reach Certified status unless their required evidence set is complete"*.
Acá eso es literal: `validation_critical == True` sin un commitment de 32 bytes **no llega a
`Completed`**.

**El firmante es un solo `admin`, y es definitivo** (D-058): el whitepaper §System Overview dice
*"All blockchain interactions are performed by operator-controlled backend services"*, y el dueño
ratificó que no hace falta un certificador externo firmando en la cadena. No hay co-firma CIP-30
pendiente acá. **Consecuencia, y hay que decirla:** lo que la cadena prueba es la **integridad de la
secuencia y del momento**, no que un profesional atestiguó. La atestiguación vive off-chain
(documento firmado + `AuditLog`), que es exactamente el reparto de las cuatro afirmaciones de D-026.

## El hilo: un token por stage, y no se puede quemar

Todos los stages viven en la **misma dirección de script**, así que la dirección no identifica a
nadie. Lo que identifica al hilo es un **NFT** cuyo asset name es el `stage_ref`:

- `mint` acuña **exactamente uno** por stage y lo deja en el script con un datum inicial legítimo
  (`Pending`, sin evidencia, sin fecha, `sequence_order > 0`, refs no vacías ≤32 bytes).
- `spend` exige que el UTxO que se gasta lleve el token **y** que el output de continuación lo siga
  llevando. Un UTxO cualquiera abandonado en la dirección del script no es un hilo.
- **No hay burn.** Quemar el token sería borrar la historia de un stage, y el punto entero del hilo
  es que ni el operador pueda hacerlo (D-008). El hilo es append-only, como el `AuditLog`.

Sin el token, el operador podía crear dos UTxOs para el mismo stage con estados contradictorios y
**los dos validaban**: quien verifica tenía que preguntarnos cuál era el bueno, que es la confianza
que el producto viene a eliminar.

## Coverage: cada punto de rechazo contra su test

`aiken check` **no mide coverage de líneas** —solo tiene `--property-coverage`, que es la
distribución de labels en property tests—, así que el ≥95% del criterio 2 del SOM se demuestra con
esta tabla. **82 tests, 0 fallando.**

`lib/propnexus/fsm.ak` — 43:

| Qué prueba | Tests |
|---|---|
| La tabla de transiciones, **exhaustiva**: los 4 pares válidos y los 12 inválidos | `t_*_to_*` (16) |
| `Completed` es terminal (las 4 salidas fallan) | `t_completed_is_terminal_to_*` (4, incluidas arriba) |
| La identidad no se reescribe (proyecto, stage, orden, criticidad) | `t_identity_*` (5) |
| Un stage crítico exige commitment de 32 bytes; uno no crítico no | `t_critical_needs_a_full_commitment`, `t_non_critical_completes_without_evidence` |
| Evolución del datum: completar, no completar, y los cruces inválidos | `t_evolution_*` (9) |
| Nacimiento del hilo: estado inicial, evidencia y fecha en cero, orden positivo, refs no vacías y ≤32 bytes | `t_initial_*` (7) |
| El datum codifica al mismo CBOR que el códec de `packages/cardano` espera — el "valor dorado" (ver `packages/cardano/CLAUDE.md`) | `t_golden_datum_encoding` (1) |
| El redeemer (`StageRedeemer`/`MintAction`) codifica al mismo CBOR que `encodeAdvanceRedeemer`/`encodeInitRedeemer` de `packages/cardano` — mismo boundary que el datum, cerrado el 2026-09-08 (`specs/PLAN-2026-09-08-tests-aiken-robustez.md`) | `t_golden_redeemer_*` (3) |

`validators/stage.ak` — 39 (8 caminos felices + 30 puntos de rechazo + 1 sobre el `else` genérico):

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
| `completed_at` un instante antes del borde inferior de la ventana (el borde exacto acepta — caminos felices) | `spend_rejects_timestamp_one_below_lower_bound` |
| `completed_at` un instante después del borde superior de la ventana | `spend_rejects_timestamp_one_above_upper_bound` |
| el UTxO gastado no lleva thread token | `spend_rejects_utxo_without_thread_token` |
| el token es el de otro stage | `spend_rejects_thread_token_of_another_stage` |
| el UTxO gastado lleva 2 unidades del propio thread token, no 1 (análogo al de `mint`) | `spend_rejects_utxo_with_two_units_of_own_token` |
| la transición se queda con el token | `spend_rejects_dropping_the_thread_token` |
| acuñar sin firma del operador | `mint_rejects_missing_admin_signature` |
| acuñar 2 unidades del mismo token | `mint_rejects_two_units_of_the_thread` |
| acuñar dos hilos en la misma tx | `mint_rejects_two_threads_in_one_tx` |
| el token acuñado no queda en el script | `mint_rejects_token_not_locked_in_the_script` |
| el asset name no coincide con el `stage_ref` del datum | `mint_rejects_asset_name_not_matching_stage_ref` |
| nacer fuera de `Pending` | `mint_rejects_starting_outside_pending` |
| nacer con evidencia o fecha ya puestas | `mint_rejects_preloaded_evidence` |
| datum inicial no inline | `mint_rejects_non_inline_datum` |
| purpose que no es spend ni mint (withdraw, publish, vote, propose) — cerrado el 2026-09-08, antes solo se sostenía por lectura de código | `else_rejects_other_script_purposes` |

Los negativos van marcados `test ... fail` porque los `expect` abortan en vez de devolver `False`.

## Estado y deuda

- **~~El backend no espeja la tabla de transiciones.~~** Cerrado por D-059: la tabla vive en
  `packages/shared`, la ruta la aplica, y el stage nace en `Pending` como el `mint` exige.
- **~~El commitment de evidencia no lo calcula nadie.~~** Cerrado (`SPEC-013` §3): `EvidenceBundle`
  existe, `crearBundle` congela la evidencia del stage al completarlo y el Merkle root
  (`packages/shared`) viaja al datum. El estado real vive en `SPEC-013`, no acá.
- **El `stage_ref` es el id off-chain en bytes, y hoy ese id es cuid2** (24 bytes), no UUID como
  piden M1-D2 y la regla 1. El validador no opina —cualquier `ByteArray` de 1 a 32 bytes entra—
  así que si el backend migra a UUID, migra sin tocar el script. Lo que **no** se puede es cambiar
  de criterio con hilos ya acuñados: el asset name es el id, y no se puede reacuñar.
- **~~El anclaje todavía no existe del lado del backend.~~** Cerrado: `packages/cardano` tiene
  `AnchorPort` completo (puerto + simulador + adaptador real contra `Emulator`/yaci, 40/40 tests) y
  `apps/api` lo llama desde `PATCH /milestones/:id/state` y `POST /evidence/:id/anchor`
  (`apps/api/src/lib/anchor.ts`, `apps/api/src/domain/stage-transition.ts`). El detalle de qué
  falta (rebanada C — `verify()`/`reconcile()` contra la cadena real, y Preprod) vive en
  `specs/SPEC-013-anchorport.md`, no acá.
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
pnpm contracts:check      # aiken check (compila + corre los 73 tests)
pnpm contracts:build      # regenera plutus.json — commitealo (el CI verifica que esté al día)
aiken fmt                 # el CI corre 'aiken fmt --check'
aiken check -m <patrón>   # solo los tests cuyo nombre matchee
```
