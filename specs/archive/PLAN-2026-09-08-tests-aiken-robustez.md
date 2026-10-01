# PLAN 2026-09-08 — robustecer los tests de `contracts/`

Pedido del dueño el 2026-09-08: revisar los validadores Aiken, confirmar cuántos tests hay,
proponer tests nuevos, y decidir si hace falta una librería nueva o si se puede todo nativo.

Vive acá y no en una memoria porque toca la zona 🟡 (`validadores Aiken`, ver `CLAUDE.md` raíz
§Niveles de autonomía: *"el LLM propone; revisión humana línea por línea"*) — quien lo retome, sea
el dueño o este asistente en otra sesión, tiene que poder auditar cada paso sin el chat.

## Punto de partida, verificado, no asumido

`aiken --version` → v1.1.21+42babe5 (coincide con la pineada). `aiken check` corrido en una pty real
(no en un pipe — la trampa documentada en `contracts/CLAUDE.md` §Trampas): **73 tests, 73 passed, 0
failed.** El conteo de `contracts/CLAUDE.md` es exacto:

- `lib/propnexus/fsm.ak` — 40 (núcleo puro: tabla de transiciones exhaustiva, identidad, evidencia
  crítica, evolución del datum, nacimiento del hilo, golden CBOR del datum).
- `validators/stage.ak` — 33 (5 caminos felices + 27 puntos de rechazo, spend y mint).

No hay drift entre lo documentado y lo que compila.

## Lo que encontré, no lo que supuse

**El golden CBOR está pinneado de un solo lado del boundary.** `t_golden_datum_encoding` (acá) y
`codec.test.ts` (`packages/cardano`) fijan el mismo `StageDatum` al mismo hex de los dos lados — así
una divergencia entre el códec de Aiken y el códec de TypeScript se ve como test rojo, no como una
transacción rechazada en la cadena. Confirmado leyendo `packages/cardano/src/codec.ts`:
`encodeAdvanceRedeemer`/`encodeInitRedeemer` existen, y `codec.test.ts:64,80` los fija a hex
hardcodeado (`d8799fd87c80...`, `d87980`). **Pero nada en Aiken confirma que `cbor.serialise(Advance
{...})` o `cbor.serialise(Init)` produzcan exactamente esos bytes.** Es la misma clase de riesgo que
el propio comentario de `fsm.ak` señala para el datum, cerrada de un lado y abierta del otro.

Otros tres gaps, más chicos, encontrados leyendo `stage.ak` línea por línea:

- **El branch `else(_) { fail }` nunca se ejercita.** Ningún test arma una `Transaction` con purpose
  `withdraw`/`publish`/`vote`/`certify` y confirma el rechazo. Hoy se sostiene por lectura de código.
- **`spend` con el UTxO cargando 2 unidades del propio thread token** no está probado — existe el
  análogo del lado `mint` (`mint_rejects_two_units_of_the_thread`) pero no uno para `spend`.
- **El boundary exacto de `within_validity_range`** nunca se prueba: todos los tests usan
  `now - 1`/`now + 1` de margen. Un `>=`/`<=` que se degradara a `>`/`<` no lo vería ningún test hoy.

## ¿Hace falta una librería nueva?

**Para los pasos 1-4, no** — son deterministas y usan lo que ya está importado
(`aiken/collection/dict`, `aiken/collection/list`, `aiken/crypto`, `aiken/interval`,
`cardano/address`, `cardano/assets`, `cardano/transaction`, `cardano/script_context`), todo stdlib
puro.

**Para property-based testing (lo que motivó el paso 5), sí, y acá esta sección estaba mal cuando se
escribió** — corregido el 2026-09-08 al llegar al paso 5, verificado en vez de asumido:
`use aiken/fuzz` no compila contra la stdlib pineada (`unknown module`), y contra el repo real de
`aiken-lang/stdlib` en GitHub (consultado con `gh`, las tags `v3.0.0` a `v3.1.0` —la última—) `fuzz`
**nunca existió en stdlib**. El `Fuzzer`/`via` que reporta `aiken check --help` (`--seed`,
`--max-success`) es soporte del *compilador* para el mecanismo; los generadores
(`fuzz.int()`, `fuzz.bytearray()`, etc.) viven en un paquete aparte, **`aiken-lang/fuzz`**, que no
está en el proyecto. Y su última tag (`v2.2.0`) declara `stdlib v2.2.0` como dependencia — un
escalón atrás de nuestro `stdlib v3.0.0` pineado —, así que agregarlo no es gratis: hay que probar
si el resolver de Aiken tolera dos versiones de stdlib conviviendo (una directa, una transitiva) o
si eso rompe la build, antes de saber si "se puede todo nativo" para el paso 5.

**Decisión del dueño, 2026-09-08: no vale la pena para esta rebanada.** El paso 5 se cierra sin
fuzz — ver el cierre más abajo.

## La secuencia propuesta

Un commit por paso, cada uno con `pnpm contracts:check` en verde. Nivel 🟡: cada commit se propone,
no se integra sin que el dueño lo revise línea por línea.

| # | Paso | Criterio de cierre |
|---|---|---|
| 1 | Golden CBOR del redeemer: 3 tests en `fsm.ak` (`Advance` sin `Completion`, `Init`, y `Advance` con `Completion` — subido de 2 a 3: el tercer caso también quedó con match exacto, no solo el chequeo parcial que hace `codec.test.ts`) contra los mismos hex que ya fija `codec.test.ts` | ✅ **hecho** — 76/76 verde, `pnpm contracts:verify` completo (fmt+check+build), `plutus.json` sin cambios (no se tocó lógica, solo tests) |
| 2 | Test del branch `else`: una `Transaction` con purpose no-spend/no-mint, confirmando `fail` | ✅ **hecho** — 77/77 verde, `pnpm contracts:verify` completo, `plutus.json` sin cambios |
| 3 | `spend_rejects_utxo_with_two_units_of_own_token` (análogo a su hermano de `mint`) | ✅ **hecho** — ya en verde a la primera: `spend` ya rechazaba este caso (el `expect quantity_of(...) == 1` del input lo cubría). 78/78 verde, `pnpm contracts:verify` completo, `plutus.json` sin cambios |
| 4 | Boundary exacto de `within_validity_range`: `completed_at == lower` y `completed_at == upper` deben aceptar; `lower - 1`/`upper + 1` deben rechazar | ✅ **hecho** — 4 tests nuevos, los 4 verdes a la primera contra el código actual (sin tocar el validador). 82/82 verde, `pnpm contracts:verify` completo, `plutus.json` sin cambios |
| 5 | Property tests con `aiken/fuzz` sobre `completion_evidence_ok` (longitud de `evidence_root` fuzzeada) y `valid_ref` (longitud de la ref fuzzeada alrededor de 0 y 32) | ❌ **cerrado sin hacer, por decisión del dueño el 2026-09-08** — `aiken/fuzz` no es nativo (ver arriba), agregarlo es una dependencia nueva con riesgo de conflicto de versión de stdlib, y no se justificó el costo para esta rebanada |

**El orden importa:** los pasos 1-4 son tests deterministas sobre comportamiento ya existente —no
deberían encontrar bugs, solo cerrar la brecha entre "el código lo hace bien" y "hay un test que lo
demuestra". El paso 5 es el único que puede encontrar algo que los pasos anteriores no cubrían, y por
eso va último: si un fuzz test falla, es una discusión nueva, no parte de este plan.

## Cuándo frenar

- **Si el paso 1 encuentra que el hex de Aiken NO coincide con el de `codec.test.ts`.** Eso no es un
  test nuevo que agregar tranquilo — es un bug de anclaje real potencial (una transacción firmada con
  el redeemer equivocado) y se avisa antes de tocar nada más, como pide `CLAUDE.md` raíz ante
  contradicción entre código y documento.
- **Si el paso 5 (fuzz) encuentra un caso real que rompe una regla del validador.** Ahí se frena la
  secuencia, se documenta el hallazgo aparte (no se mezcla con "agregar cobertura") y se decide con
  el dueño si es 🟡 o si escaló.

## Qué NO hace

- No cambia ninguna regla del validador ni de `fsm.ak`. Es cobertura de tests, no un refactor.
- No agrega un `combinator` de reglas nuevo ni toca el datum, la FSM ni la tabla de transiciones.
- No mide "coverage de líneas" — Aiken no lo da (`aiken check` solo tiene `--property-coverage`,
  distribución de labels de property tests). El techo real de esta rebanada es esa métrica, no un
  porcentaje de líneas.
- No decide mainnet ni toca `packages/cardano` — si el paso 1 destapa un mismatch, la corrección del
  lado TypeScript (si hiciera falta) es harina de otro plan.

---

## Cerrado el 2026-09-08

Los 4 pasos deterministas (1-4), hechos y en `main`: 73 → 82 tests, 0 fallando, `plutus.json` sin
cambios en ningún commit (ninguno tocó una regla del validador). El paso 1 no encontró mismatch en
el golden CBOR del redeemer; los pasos 2-4 pasaron en verde a la primera — cerraron brecha de
cobertura, no encontraron bugs.

**El paso 5 se cierra sin hacer**, por la razón que quedó arriba: `aiken/fuzz` no es nativo de
stdlib —la premisa con la que se escribió este plan estaba mal, y se corrigió acá mismo al
descubrirlo, no en otro documento— y agregar `aiken-lang/fuzz` como dependencia nueva trae consigo
un riesgo de conflicto de versión de stdlib (`v2.2.0` transitivo contra `v3.0.0` directo) que no se
llegó a probar. El dueño decidió que no vale la pena para esta rebanada.

Si en el futuro hace falta property-based testing de verdad en `contracts/`, el punto de partida no
es este plan: es probar primero, en un commit aislado y descartable, si `aiken-lang/fuzz@v2.2.0`
resuelve contra `stdlib v3.0.0` sin romper nada — recién ahí se sabe si "se puede nativo" sigue
siendo cierto para ese caso.
