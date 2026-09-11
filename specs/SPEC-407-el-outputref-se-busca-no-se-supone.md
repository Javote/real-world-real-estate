# SPEC-407 — El `outputRef` del recibo se busca, no se supone

> **Origen:** [`AUDITORIA-2026-09-11-calidad-de-packages.md`](AUDITORIA-2026-09-11-calidad-de-packages.md)
> §C-02. Nivel 🟡 — toca la construcción de transacciones. **Independiente.**
> No toca ningún criterio del SOM, pero **vale antes de mainnet**: es el campo cuyo error no se
> deshace.

## El problema, en una frase

`enviar()` devuelve `outputRef: ${txid}#0` fijo para los tres caminos, cuando **la respuesta correcta
ya está calculada en la misma función y se descarta**.

## Qué es ese campo

`port.ts` lo dice sin rodeos:

> *"El hilo que **queda vivo** después de la operación. Es estado crítico: si se pierde, el thread
> token queda en un UTxO que nadie sabe cuál es y ese stage **no se puede volver a mover nunca**."*

No hay reparación posible del lado de la base: el token está en la cadena, en un UTxO que habría que
encontrar barriendo la dirección del script. `findLiveThread` existe precisamente porque ese barrido
hizo falta una vez (Capa 1 de la prueba de volumen).

## Por qué hoy funciona, y por qué igual es deuda

El valor es correcto para los hilos: `openThread` y `avanzar` declaran **una sola** salida explícita
y Lucid agrega el vuelto después, así que el contrato queda en el índice 0. Es una propiedad de la
librería que el código **no declara, no prueba y no controla**.

Dos cosas la vuelven deuda:

1. **El archivo ya sabe hacerlo bien, en dos lugares.** `enviar()` recibe `salidas` y se la pasa a
   `anotarLoEnviado`, que recorre buscando `salida.address === this.refs.address` — o sea, ya
   encuentra la salida al script sin suponer índices. `publishReferenceScript` hace lo mismo con un
   `find` por `scriptRef` y **lanza si no aparece**. El archivo ya distingue entre buscar y suponer:
   `enviar()` es el único que supone, y es el único cuyo resultado se persiste.
2. **Para `anchorCommitment` el `#0` no es frágil: es falso.** Esa transacción no crea ninguna salida
   al script, así que el `outputRef` apunta al vuelto de la wallet. Quien llama lo descarta hoy
   (`const { txid } = await …`), y el campo miente igual — un día alguien lo va a leer.

## Qué se cambia

`enviar()` deja de fabricar el `outputRef` y **lo busca entre las salidas que ya tiene**:

- **Con hilo** (`openThread`, `avanzar`): la salida a `this.refs.address` **que lleva el thread
  token** (`unit`). Filtrar por el token y no solo por la dirección es lo que hace correcta la
  búsqueda aunque algún día haya dos salidas al script en una transacción. Si no aparece, **lanza** —
  el mismo criterio que `publishReferenceScript`, porque una transacción que se envió sin dejar el
  hilo es exactamente el estado que hay que gritar y no registrar.
- **Sin hilo** (`anchorCommitment`): `MetadataAnchorReceipt` ya no tiene `outputRef` y no hay nada
  que inventar. Hoy `enviar()` devuelve un `AnchorReceipt` para los tres; la forma correcta es que
  devuelva el txid y las salidas, y que cada llamador arme su recibo.

## Alcance / NO-alcance

- **Cubre:** `enviar()` y los tres llamadores, en `packages/cardano/src/real.ts`.
- **NO cubre:** el simulador. Ahí `${txid}#0` **es la verdad**: es su propia cadena y él decide los
  índices (`commit()`).
- **NO cubre:** `apps/api`. La forma de `AnchorReceipt` no cambia para el hilo; lo que cambia es de
  dónde sale el valor.
- **NO cubre:** reparar los `outputRef` ya guardados. Los 180 eventos anclados tienen el valor
  correcto —el índice 0 era el bueno—; no hay backfill que hacer.

## Invariantes

1. **Ningún `outputRef` se construye suponiendo un índice.** Sale de una salida encontrada.
2. **Una transacción de hilo que no deja una salida con el thread token es un error**, no un recibo.
3. **Un recibo sin hilo no tiene `outputRef`.** El tipo lo impide, no la disciplina.
4. El `outputRef` que se persiste es siempre el UTxO que lleva el token, para las dos operaciones.

## Casos borde (definen los tests)

| Caso | Esperado |
|---|---|
| `openThread` contra el `Emulator` | el `outputRef` apunta al UTxO con el token — **verificado leyendo la cadena**, no comparando con `#0` |
| `advanceThread` | ídem, y el UTxO viejo queda gastado |
| El índice del contrato **no** es 0 | sigue devolviendo el correcto (hoy fallaría en silencio) |
| `anchorCommitment` | el recibo no tiene `outputRef`; no compila si alguien lo pide |
| Transacción enviada sin salida al script | lanza, con el txid en el mensaje |
| Los tests de encadenamiento y de la vista local | siguen verdes sin tocarse |

El primero es el que mide si la spec sirvió: hoy el test pasaría igual afirmando `#0`, y por eso el
bug no se ve. El test nuevo tiene que leer el UTxO y comprobar que tiene el token.

## Preguntas abiertas

¿Vale también fijar el orden de salidas con un test del `Emulator` que declare dos salidas al script?
No hay ninguna operación que lo haga hoy, y agregarla solo para el test sería probar código que no
existe. Se deja anotado: si alguna vez se fusiona el anclaje de evidencia con la transición
([`PROPUESTA-2026-09-09`](PROPUESTA-2026-09-09-fusionar-anclaje-evidencia-transicion.md)), esa
transacción tendría dos salidas y **esta spec es un prerrequisito**.
