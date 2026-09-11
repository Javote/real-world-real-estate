# SPEC-409 — `verify()` devuelve el timestamp del bloque, que ya sabe leer

> **Origen:** [`AUDITORIA-2026-09-11-calidad-de-packages.md`](AUDITORIA-2026-09-11-calidad-de-packages.md)
> §C-04. Nivel 🟢. **Independiente.** No toca ningún criterio del SOM.
>
> No confundir con [`SPEC-214`](SPEC-214-telemetria-con-blocktimestamp.md), que es sobre la métrica
> de `apps/api`. Esta es sobre la fuente: de dónde sale el número.

## El problema, en una frase

`threadProof` devuelve `blockTimestamp: this.now()` —el reloj del proceso— cuando `confirmedAt()`,
cuarenta líneas más abajo en el mismo archivo, ya lee el `block_time` de verdad.

## El comentario era cierto y dejó de serlo

```ts
// El timestamp autoritativo es el del bloque; leerlo necesita el indexer
// de la rebanada C. Hasta entonces, el momento de la confirmación.
blockTimestamp: this.now(),
```

Cierto cuando se escribió. **Dejó de serlo cuando se agregó `confirmedAt()`**, que hace un GET a
`/txs/{hash}` de Blockfrost y devuelve `block_time * 1000` en POSIX ms. El indexer sigue haciendo
falta para *reconstruir la historia completa* —cada transición con su bloque—; para **este campo**,
no.

## Por qué no es un detalle

`AnchorProof.blockTimestamp` está documentado como *"POSIX ms del bloque"*. Hoy es el reloj de quien
preguntó — un número que depende de cuándo alguien abrió la pantalla, no de cuándo entró la
transacción. En un producto cuya afirmación central es *"se registró en este momento"* (D-026), es el
campo que no puede ser aproximado.

La diferencia es real y medible: la prueba de volumen del 2026-09-10 y el cierre del criterio 9
mostraron minutos entre la confirmación on-chain y la lectura que la vio (D-077: no hay poll en
background, a propósito). Ese hueco es exactamente el error de este campo.

## Qué se cambia

`threadProof` pide el timestamp a `confirmedAt(txid)` y lo usa. Cuando no hay fuente
—`this.blockfrost` es `undefined`, que es el caso del `Emulator` y del devnet— **el campo tiene que
decir que no sabe**, no inventar: `blockTimestamp: number | null` en `AnchorProof`.

Esa nulabilidad es el cambio de forma, y es el punto de la spec: hoy el tipo promete un número
siempre y por eso hay que inventarlo. `LucidAnchorOptions.blockfrost` ya está documentado con ese
mismo criterio —*"ahí `confirmedAt()` devuelve `null`, lo que es honesto, no roto: sin fuente no se
afirma que algo confirmó"*—; esto es aplicarlo al otro método.

**El simulador sí puede contestar siempre:** su `bloques` tiene el momento de inclusión y ese es el
timestamp real **de su cadena**. No pasa a `null` ahí.

## Alcance / NO-alcance

- **Cubre:** `threadProof` y el tipo `AnchorProof` en `port.ts`; los cuatro adaptadores se adaptan.
- **NO cubre:** la métrica del criterio 9 — es `SPEC-214`, que lee `OnChainEvent.blockTimestamp` (una
  columna, ya poblada por la reconciliación desde `confirmedAt`). Las dos son compatibles y ninguna
  depende de la otra.
- **NO cubre:** el indexer de la rebanada C, ni `reconcile()` completo.
- **NO cubre:** agregar una segunda llamada a Blockfrost donde ya había una. `verify()` hoy hace
  `awaitTx` + `utxosAt`; se le suma `confirmedAt`, que es un GET. Si eso pesa, la alternativa es
  llamar a `confirmedAt` **primero** y saltear `awaitTx` cuando ya contestó — **se mide antes de
  decidir**.

## Invariantes

1. **`AnchorProof.blockTimestamp` es el timestamp del bloque, o `null`.** Nunca el reloj local.
2. **Sin fuente no se afirma.** Sin Blockfrost configurado, `null`.
3. El simulador contesta con el momento de inclusión en **su** cadena, que para él es autoritativo.
4. **El comentario que decía "hasta entonces" se borra.** Si queda, vuelve a envejecer.

## Casos borde (definen los tests)

| Caso | Esperado |
|---|---|
| `verify` contra Preprod, tx en un bloque | el `block_time` del bloque, en ms |
| `verify` contra el `Emulator` (sin Blockfrost) | `blockTimestamp: null`, el resto del proof igual |
| `verify` contra el simulador | el momento de inclusión que guardó, no `now()` |
| `verify` de un txid que no confirmó | `null` como proof entero, como hoy |
| Blockfrost contesta 404 al pedir el `block_time` | proof con `blockTimestamp: null`, no una excepción |
| Blockfrost contesta 500 | propaga — es un error de infraestructura, no un "no confirmó" |

## Preguntas abiertas

`AnchorProof.blockTimestamp` pasa a nullable: hay que revisar quién lo lee en `apps/api` antes de dar
la spec por cerrada. Si nadie lo usa —posible, porque la promoción a `Confirmed` va por `confirmedAt`
y no por `verify`—, el cambio es de una línea y el tipo solo deja de mentir.
