# contracts — validadores Aiken

> Se carga solo al tocar este subárbol. Las reglas duras (nunca custodiar valor, cero PII,
> metadata ≤64 bytes, blueprint commiteado) están en el `CLAUDE.md` de la raíz.

Aiken **v1.1.21** · **Plutus V3** (D-019) · stdlib v3.0.0 · `aiken-lang/fuzz` v2.1.1 (property
tests, `SPEC-306`).
Aislado del workspace pnpm (D-054): **corre en paralelo y no bloquea a nadie.** Es el track ideal
para trabajarlo por separado del resto del workspace.

```
lib/propnexus/fsm.ak     núcleo puro: tipos, tabla de transiciones, reglas del datum (45 tests)
validators/stage.ak      el validador: spend + mint, lo que necesita la tx    (40 tests)
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

**Qué significa cada estado: a quién le toca.** Los cuatro no son cuatro momentos de la obra —
son de quién es el turno, y por eso `Pending` e `InProgress` no son redundantes aunque lo parezcan.
La tabla completa está en D-020; acá va el resumen porque explica el diseño del datum:

| Estado | Espera a | Afirma |
|---|---|---|
| `Pending` | developer | declarada y anclada; nada en el registro |
| `InProgress` | certifier | hay evidencia; nadie la juzgó |
| `Observed` | developer | el certifier encontró un problema |
| `Completed` | nadie | cerrada, con el root del bundle en el datum |

**El validador no sabe nada de esos roles, y está bien**: acá todo lo firma el `admin` (ver más
abajo, D-058), así que quién tenía derecho a pedir cada transición es una regla off-chain que vive
en `apps/api`. El validador garantiza que la **secuencia** sea legal y que nadie la reescriba
después; quién la pidió lo garantiza `authorize()`.

**Una sola tabla de transiciones, y desde D-059 el espejo existe de verdad**: la misma tabla vive
en `packages/shared` (`STAGE_TRANSITIONS`) y la aplica `PATCH /stages/:id/state` antes de
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

- `mint` acuña **exactamente uno por transacción** y lo deja en el script con un datum inicial
  legítimo (`Pending`, sin evidencia, sin fecha, `sequence_order > 0`, refs no vacías ≤32 bytes).
  **La unicidad por stage no la garantiza el validador** — el handler no mira `tx.inputs`, así que
  nada ata la acuñación a un UTxO consumido y una segunda transacción vuelve a acuñar el mismo
  `stage_ref` (reproducido en `AUDITORIA-2026-09-11-calidad-de-contracts.md` §C-01). La sostiene el
  backend: `retryStageMint` (`apps/api/src/domain/stage-transition.ts`) consulta
  `findLiveThread` contra la cadena antes de mintear, no solo `OnChainEvent`
  (`SPEC-301`). Cerrar el agujero on-chain de verdad —que el validador exija gastar un UTxO
  semilla— cambia el script hash y es decisión de mainnet (`SPEC-305`).
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
esta tabla.

**La tabla se mide, no solo se afirma** (`SPEC-017` paso 6). Dos scripts en `contracts/scripts/`,
que se corren a mano desde la raíz del repo:

```bash
node contracts/scripts/rechazos-mutantes.mjs --listar   # qué chequeos se van a mutar, sin correr aiken
node contracts/scripts/rechazos-mutantes.mjs            # saca cada chequeo de a uno: algún test tiene que ponerse rojo (~4 s por mutante)
node contracts/scripts/rechazos-trazas.mjs              # cada `expect` contra el test de rechazo que aborta exactamente ahí
```

`rechazos-mutantes.mjs` cubre las conjunciones de `and`, los `expect` booleanos, los patrones de
lista, las puntas de la ventana de validez, las ramas de la tabla de transiciones y el `fail` del
`else` (51 mutantes). Los `expect` que desarman o castean (`Some(x) = …`, `x: StageDatum = …`, 7) no
se pueden mutar sin romper los tipos: los cubre `rechazos-trazas.mjs` con la traza que devuelve
`aiken check`. Los dos salen con código ≠ 0 si queda un chequeo sin test. **102 tests, 0 fallando** (dos de ellos, property tests, corren 100 casos generados
cada uno — ver la fila de abajo).

**Medida de verdad, no solo argumentada (`SPEC-017`, cerrado 2026-09-22).** La corrida vigente —
[`specs/evidencia-m3/1-repo-ci-tests/aiken-coverage-report.md`](../specs/evidencia-m3/1-repo-ci-tests/aiken-coverage-report.md)
(en inglés; consolida los dos reportes que hasta el 2026-09-24 vivían en archivos separados,
`mutation-report.md` y `expect-trace-report.md`)— da **51 mutantes: 51 muertos** y **18 `expect`: 18
con test**: el 100% que la tabla de abajo venía afirmando queda medido, no solo argumentado. El
triage del paso 6 había marcado `stage.ak:91`
(`own_input` lleva exactamente 1 unidad del token) como equivalencia genuina —`carrying_thread`
sobre el output de continuación (línea 104) más la igualdad de valor (línea 125) parecían forzar la
misma cardinalidad por otro camino—, pero esa lectura asumía que `carrying_thread` termina mirando
al output de continuación. No tiene por qué: filtra **todos** los outputs por payment credential,
así que un decoy en una dirección con el mismo payment credential pero otro staking credential
(el mismo hueco de C-01/SPEC-301) puede absorber el único match en su lugar, sin que la cantidad
mal formada de `own_input` importe. `spend_rejects_own_input_with_two_units_when_a_decoy_absorbs_
carrying_thread` arma exactamente ese ataque y mata el mutante — no era equivalencia, era un test
que faltaba.

`lib/propnexus/fsm.ak` — 48:

| Qué prueba | Tests |
|---|---|
| La tabla de transiciones, **exhaustiva**: los 4 pares válidos y los 12 inválidos | `t_*_to_*` (16) |
| `Completed` es terminal (las 4 salidas fallan) | `t_completed_is_terminal_to_*` (4, incluidas arriba) |
| La identidad no se reescribe (proyecto, stage, orden, criticidad) | `t_identity_*` (5) |
| Un stage crítico exige commitment de 32 bytes; uno no crítico no | `t_critical_needs_a_full_commitment`, `t_non_critical_completes_without_evidence` |
| Evolución del datum: completar, no completar, y los cruces inválidos | `t_evolution_*` (12, de los cuales 3 son `SPEC-017`: una transición no-terminal con `Completion` adjunto, un `evidence_root` de redeemer y datum que difieren, y un `completed_at` de redeemer y datum que difieren — las tres evaden en sustancia la garantía anti-backdating y de evidencia obligatoria si no se prueban) |
| **Property tests sobre `valid_datum_evolution`** — el único lugar del subárbol con espacio de entrada ancho de verdad; la tabla de transiciones de arriba ya está probada exhaustivamente y ahí un property test no agregaría nada (`SPEC-306`). Generador de `StageDatum` con refs/roots de largo variado, incluidos 0 y 32 | `prop_non_completing_evolution_preserves_evidence`, `prop_evolution_never_bypasses_the_transition_table` (2, 100 casos c/u) |
| Nacimiento del hilo: estado inicial, evidencia y fecha en cero, orden positivo, refs no vacías y ≤32 bytes | `t_initial_*` (7) |
| El datum codifica al mismo CBOR que el códec de `packages/cardano` espera — el "valor dorado" (ver `packages/cardano/CLAUDE.md`) | `t_golden_datum_encoding` (1) |
| El redeemer (`StageRedeemer`/`MintAction`) codifica al mismo CBOR que `encodeAdvanceRedeemer`/`encodeInitRedeemer` de `packages/cardano` — mismo boundary que el datum, cerrado el 2026-09-08 (`specs/PLAN-2026-09-08-tests-aiken-robustez.md`) | `t_golden_redeemer_*` (3) |

`validators/stage.ak` — 54 (10 caminos felices + 43 puntos de rechazo + 1 sobre el `else`
genérico). Los 14 que suma `SPEC-017` (cerrado 2026-09-22) aíslan un punto de rechazo que otro test
ya tocaba de rebote, y quedan marcados abajo:

| Punto de rechazo | Test |
|---|---|
| el camino feliz tolera un output ajeno en otra dirección (`SPEC-017`) | `spend_accepts_an_unrelated_output_elsewhere` |
| el camino feliz tolera un input de wallet extra, además del del script (`SPEC-017`) | `spend_accepts_an_extra_wallet_input` |
| datum ausente | `spend_rejects_missing_datum` |
| el `own_ref` no está entre los inputs | `spend_rejects_unknown_own_ref` |
| `own_input` en una dirección de wallet, no de script (`SPEC-017`) | `spend_rejects_own_input_not_locked_by_a_script` |
| un segundo output parado en la dirección exacta del script, sin el token (aísla la cardinalidad de `at_address`, no la de `carrying_thread` — `SPEC-017`) | `spend_rejects_a_second_output_at_the_exact_script_address` |
| dos inputs del script en la misma tx | `spend_rejects_two_script_inputs` |
| dos outputs al script | `spend_rejects_two_script_outputs` |
| el hilo partido en dos outputs con el mismo payment credential y distinto staking credential — el ataque real que argumenta el comentario de SPEC-303 (`SPEC-017`) | `spend_rejects_thread_split_across_a_staking_variant_of_the_script_address` |
| ningún output de continuación | `spend_rejects_no_continuing_output` |
| falta la firma del operador | `spend_rejects_missing_admin_signature` |
| datum de salida no inline | `spend_rejects_non_inline_datum` |
| el cast a `StageDatum` del datum de continuación, con `Init` como forma estructural distinta (`SPEC-017`) | `spend_rejects_new_datum_of_the_wrong_type` |
| el valor bloqueado cambia (D-021) | `spend_rejects_value_drain` |
| solo el ADA se drena, con la unidad del thread token intacta — aísla D-021 de la cardinalidad de `carrying_thread` (`SPEC-017`) | `spend_rejects_ada_drain_while_keeping_the_token` |
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
| ventana semiabierta: inferior infinito, superior finito — aísla la punta inferior (`SPEC-017`) | `spend_rejects_missing_lower_bound` |
| ventana semiabierta: superior infinito, inferior finito — aísla la punta superior (`SPEC-017`) | `spend_rejects_missing_upper_bound` |
| el UTxO gastado no lleva thread token | `spend_rejects_utxo_without_thread_token` |
| el token es el de otro stage | `spend_rejects_thread_token_of_another_stage` |
| el UTxO gastado lleva 2 unidades del propio thread token, no 1 (análogo al de `mint`) | `spend_rejects_utxo_with_two_units_of_own_token` |
| lo mismo, pero con un decoy en una dirección de mismo payment credential absorbiendo el único match de `carrying_thread` — la única forma de aislar la línea 91 de la red de 104+125 (`SPEC-017`) | `spend_rejects_own_input_with_two_units_when_a_decoy_absorbs_carrying_thread` |
| la transición se queda con el token | `spend_rejects_dropping_the_thread_token` |
| acuñar sin firma del operador | `mint_rejects_missing_admin_signature` |
| acuñar 2 unidades del mismo token | `mint_rejects_two_units_of_the_thread` |
| acuñar dos hilos en la misma tx | `mint_rejects_two_threads_in_one_tx` |
| el token acuñado no queda en el script | `mint_rejects_token_not_locked_in_the_script` |
| el asset name no coincide con el `stage_ref` del datum | `mint_rejects_asset_name_not_matching_stage_ref` |
| nacer fuera de `Pending` | `mint_rejects_starting_outside_pending` |
| nacer con evidencia o fecha ya puestas | `mint_rejects_preloaded_evidence` |
| el output ya carga 2 unidades del token (el token "donado" por un input externo) | `mint_rejects_output_holding_extra_units_of_the_token` |
| dos asset names distintos, los dos presentes en el output — aísla la cardinalidad pura de `dict.to_pairs`, no el mismatch con `stage_ref` (`SPEC-017`) | `mint_rejects_two_asset_names_when_both_are_present_in_the_output` |
| dos outputs en la dirección del script, cada uno con 1 unidad del mismo asset — el mismo truco del token "donado", análogo al de `spend` (`SPEC-017`) | `mint_rejects_two_outputs_each_carrying_one_unit` |
| datum inicial no inline | `mint_rejects_non_inline_datum` |
| el cast a `StageDatum` del datum inicial, con `Init` como forma estructural distinta (`SPEC-017`) | `mint_rejects_initial_datum_of_the_wrong_type` |
| quemar el thread token (D-008: "no hay burn" era un argumento, ahora es un test — `SPEC-302`) | `mint_rejects_a_burn` |
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
- **La clave del `admin` no es rotable (D-093, `SPEC-304`).** Es un parámetro del script: la
  dirección y el policy id son función de esa clave. Si `SERVICE_WALLET_PRIVATE_KEY` se pierde o se
  compromete, todos los hilos vivos quedan congelados para siempre —`spend` exige su firma sin
  alternativa, no hay burn— y los hilos nuevos nacerían bajo otro policy id. Es más grave que las 2
  ADA bloqueadas por etapa (D-057): eso es costo, esto es pérdida de la función del producto. Para
  Preprod con datos de demo es aceptable; antes del primer mint en mainnet hay que elegir entre
  dejarlo así, un multisig M-de-N o un segundo VKH de recuperación — las tres opciones y por qué
  ninguna se implementa todavía están en `SPEC-304`.
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
- **2026-09-18 · `use aiken/fuzz` no anda solo con `aiken-lang/stdlib` como dependencia — hace
  falta declarar `aiken-lang/fuzz` aparte** (`SPEC-306`). Los `.test.ak` de la propia stdlib
  (`interval.test.ak`, `cbor.test.ak`) importan `aiken/fuzz` y usan property tests, y eso hizo creer
  que el módulo venía con el paquete. No: es una dependencia **de stdlib**
  (`aiken-lang/fuzz v2.1.1`, visible en `build/packages/aiken-lang-stdlib/aiken.toml`), no una
  re-exportación hacia quien consume stdlib. El error es `unknown module: 'aiken/fuzz'`, sin pista
  de que la solución es un `[[dependencies]]` nuevo en `aiken.toml` — hay que ir a mirar el `.toml`
  del propio paquete vendorizado para encontrar el nombre y la versión exactos.

## Autonomía

🟡 amarillo: el LLM propone, el humano revisa línea por línea antes de integrar. Bajó de rojo por
D-021 — no hay fondos en riesgo.

## Comandos

```bash
pnpm contracts:check      # aiken check (compila + corre los tests; ver §Coverage por el total vigente)
pnpm contracts:build      # regenera plutus.json — commitealo (el CI verifica que esté al día)
aiken fmt                 # el CI corre 'aiken fmt --check'
aiken check -m <patrón>   # solo los tests cuyo nombre matchee
```
