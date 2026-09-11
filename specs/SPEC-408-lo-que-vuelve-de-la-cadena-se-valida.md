# SPEC-408 — Lo que vuelve de la cadena se valida, por las dos puertas

> **Origen:** [`AUDITORIA-2026-09-11-calidad-de-packages.md`](AUDITORIA-2026-09-11-calidad-de-packages.md)
> §C-03. Nivel 🟡 — toca el códec y el adaptador real. **Independiente.**
> No toca ningún criterio del SOM, pero **vale antes de mainnet**.

## El problema, en una frase

El datum que vuelve de la cadena entra al proceso **sin validarse**, y por una de las dos puertas
entra además **sin comprobar que sea nuestro**.

## Puerta 1 · `decodeStageDatum` no valida

`stageDatumSchema` existe en `packages/shared` y el códec no lo aplica. `decodeStageDatum` son siete
casts:

```ts
projectRef: projectRef as string,
sequenceOrder: Number(sequenceOrder as bigint),
```

**Comprobado:**

- Datum de aridad corta → `TypeError: Cannot read properties of undefined (reading 'index')`. No un
  error de dominio: el resto del package produce `AnchorRejectedError` con código estable, y quien
  llama distingue "el puerto rechazó" de "algo explotó".
- Siete campos del tipo equivocado → devuelve un objeto plausible **sin quejarse**. Un
  `sequenceOrder` que no era un entero sale como `NaN`; un `projectRef` que era un `Constr` sale como
  un objeto tipado `string`.

El asimétrico es que **`encodeStageDatum` sí está defendido**: quien lo llama pasó por
`buildStageDatum`, que hace `stageDatumSchema.parse`. La ida valida, la vuelta no — y la vuelta es la
que trae datos de afuera.

## Puerta 2 · `verify()` no filtra por el thread token

```ts
const vivo = utxos.find((u) => u.txHash === txid);              // threadProof
const vivo = utxos.find((u) => (u.assets[unit] ?? 0n) > 0n);    // findLiveThread
```

**Cualquiera puede pagar a la dirección de un script con el datum que quiera.** El thread token no:
lo acuña el validador, que exige la firma del admin. Por eso el token —y no la dirección— es lo que
prueba que un UTxO es un hilo nuestro.

`findLiveThread`, que es el método más nuevo, filtra por el token. `threadProof` filtra solo por
`txHash` y después le pasa ese datum al decoder sin validar. Son las dos mitades del mismo agujero, y
el resultado viaja como `AnchorProof` — el tipo que el producto usa para decir "esto está en la
cadena".

## Qué se cambia

1. **`decodeStageDatum` valida con `stageDatumSchema`** antes de devolver, y lanza
   `AnchorRejectedError` con código `BAD_DATUM` si no cierra. La aridad se chequea explícitamente
   (`data.fields.length !== 7`) para que el mensaje diga qué pasó y no explote indexando.
2. **`threadProof` filtra por el thread token**, igual que `findLiveThread`. Necesita el `unit`, que
   sale del `stageRef`; `verify(txid)` hoy no lo recibe — **resolver eso es parte de la spec**
   (la opción simple: encontrar la salida por txid y exigir que lleve *algún* asset de nuestra
   policy, que es lo único verificable con lo que `verify` sabe).

## Alcance / NO-alcance

- **Cubre:** `codec.ts` (`decodeStageDatum`) y `real.ts` (`threadProof`).
- **NO cubre:** el CBOR ni los índices de constructor. **El valor dorado de `codec.test.ts` no se
  toca**: está fijado del otro lado en `fsm.ak` (`t_golden_datum_encoding`) y cualquier cambio ahí
  rompe el contrato binario con `contracts/`.
- **NO cubre:** `encodeStageDatum`, que ya está defendido aguas arriba.
- **NO cubre:** el simulador, que no decodifica nada: guarda el objeto.

## Invariantes

1. **Ningún `StageDatum` entra al proceso sin pasar por `stageDatumSchema`.**
2. **Un datum que no cierra produce `AnchorRejectedError`, nunca un `TypeError`.** Quien llama tiene
   que poder distinguir "esto no es un hilo nuestro" de "el proceso se rompió".
3. **Un UTxO en la dirección del script no es un hilo hasta que lleva el thread token.** Vale para
   los dos métodos que leen la cadena.
4. El round-trip `decode(encode(x)) === x` sigue siendo cierto para todo datum válido, y el CBOR de
   salida **no cambia**.

## Casos borde (definen los tests)

| Caso | Esperado |
|---|---|
| Datum válido | igual que hoy, campo por campo |
| Datum con menos de 7 campos | `AnchorRejectedError("BAD_DATUM")`, no `TypeError` |
| Datum con más de 7 campos | ídem |
| `sequenceOrder` no entero o ≤ 0 | rechaza (hoy: `NaN` o un cero que pasa) |
| `state` con índice 4 o más | rechaza — ya lo hace, se conserva el mensaje |
| `evidenceRoot` que no es hex64 ni vacío | rechaza |
| `projectRef`/`stageRef` que no son hex de bytes | rechaza |
| UTxO en la dirección del script **sin** thread token | `verify` da `null`, no un proof |
| UTxO con token de **otra** policy | `verify` da `null` |
| El valor dorado de `codec.test.ts` | **idéntico** |

## Preguntas abiertas

¿`verify(txid)` debería recibir el `stageRef`? Le permitiría el mismo filtro exacto que
`findLiveThread` en vez de "algún asset de nuestra policy". Cambia la firma del puerto, así que
toca los cuatro adaptadores y a `apps/api`. Se decide al implementar: si el filtro por policy alcanza
para el invariante 3, no vale el cambio de firma.
