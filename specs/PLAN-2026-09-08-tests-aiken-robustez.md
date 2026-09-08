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

**No.** Todo lo que se usa hoy (`aiken/collection/dict`, `aiken/collection/list`, `aiken/crypto`,
`aiken/interval`, `cardano/address`, `cardano/assets`, `cardano/transaction`) es stdlib puro, y
**stdlib v3.0.0 —la pineada— ya trae `aiken/fuzz` nativo** para property-based testing
(`test nombre(x via fuzzer()) { ... }`, con `--property-coverage` para la distribución de labels,
que es la única métrica de coverage real que da la herramienta — `contracts/CLAUDE.md` ya lo dice).
Se puede hacer 100% nativo. No hay motivo para traer un paquete externo a `contracts/`, que además
está fuera del workspace pnpm a propósito (D-054): otro toolchain, otro lockfile, otra caché.

## La secuencia propuesta

Un commit por paso, cada uno con `pnpm contracts:check` en verde. Nivel 🟡: cada commit se propone,
no se integra sin que el dueño lo revise línea por línea.

| # | Paso | Criterio de cierre |
|---|---|---|
| 1 | Golden CBOR del redeemer: 2 tests en `fsm.ak` (`Advance` con y sin `Completion`, y `Init`) contra los mismos hex que ya fija `codec.test.ts` | Los hex de Aiken y de TS coinciden byte a byte, 0 tests rotos |
| 2 | Test del branch `else`: una `Transaction` con purpose no-spend/no-mint, confirmando `fail` | El test nuevo pasa; ningún test existente cambia |
| 3 | `spend_rejects_utxo_with_two_units_of_own_token` (análogo a su hermano de `mint`) | Test nuevo en rojo antes del fix (si hiciera falta uno) o ya en verde si el validador ya lo cubre — a confirmar al escribirlo |
| 4 | Boundary exacto de `within_validity_range`: `completed_at == lower` y `completed_at == upper` deben aceptar; `lower - 1`/`upper + 1` deben rechazar | 4 tests nuevos, todos verdes contra el código actual (sin tocar el validador) |
| 5 | Property tests con `aiken/fuzz` sobre `completion_evidence_ok` (longitud de `evidence_root` fuzzeada) y `valid_ref` (longitud de la ref fuzzeada alrededor de 0 y 32) | `--property-coverage` corrido y leído, no solo "pasó" |

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
