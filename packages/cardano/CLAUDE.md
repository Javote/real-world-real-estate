# packages/cardano — el `AnchorPort`

> Se carga solo al tocar este subárbol. Lo transversal está en el `CLAUDE.md` de la raíz.

**Es la única puerta a Cardano** (D-014). Nada fuera de acá importa Lucid ni Blockfrost.

```
port.ts        la interfaz: openThread · advanceThread · verify · awaitConfirmation · confirmedAt
ledger.ts      LedgerStore — el estado del simulador (memoria o SQLite)
simulated.ts   adaptador simulado: rechaza lo mismo que rechazaría el validador
real.ts        LucidAnchorAdapter: construye las transacciones de verdad
codec.ts       StageDatum ⇄ Data de Plutus — el contrato binario con contracts/
blueprint.ts   carga plutus.json, aplica el admin, deriva dirección y policy
factory.ts     createAnchorPort(): ANCHOR_MODE, sin defaults inseguros; Mainnet se rechaza (D-013)
```

**El valor dorado.** `codec.test.ts` compara el CBOR del datum contra un hex fijo, y el mismo hex
está fijado en `contracts/lib/propnexus/fsm.ak` (`t_golden_datum_encoding`). Un campo corrido pasa
el typecheck y falla recién en la cadena; si tocás `StageDatum` de un lado, los dos tests se ponen
rojos a propósito. Los índices de constructor salen del orden de declaración en Aiken:
`Pending`=0 · `InProgress`=1 · `Observed`=2 · `Completed`=3; `False`=0 · `True`=1; `Some`=0 · `None`=1.

**Txid no es confirmación.** Los dos adaptadores devuelven `Pending` con txid; la promoción a
`Confirmed` la hace `confirmedAt()` (D-077, D-087). El simulador solo contesta por lo que él ancló
(D-079). La red de un TXID sale de `AnchorPort.network`, no de `CARDANO_NETWORK` (D-080).

## Trampas

- **Un peer de `@harmoniclabs/*` declarado a otra versión revienta en runtime** con
  `Right-hand side of 'instanceof' is not an object`: mirá el `peerDependencies` de quien lo pide
  (D-052 apaga `auto-install-peers`). Si persiste, borrá todos los `node_modules` y reinstalá.
- **El `Emulator` no ve su propio mempool**, igual que Preprod: un `awaitBlock` agregado "para que
  pase" apaga los tests de la cola.
- **La dirección del script depende del `admin`**: rotar la wallet de servicio no se puede sin
  migrar los hilos (D-093, `SPEC-304`).
- **`fromSeed` da dirección base y `fromPrivateKey` enterprise**, con el mismo payment credential:
  el faucet tiene que fondear la enterprise, que es la que mira el servicio (D-078).
- **Se construye con `chain()`, no con `complete()`**: con `complete()` desaparece el encadenamiento
  de la cola (D-082) y nada se pone rojo hasta dos anclajes seguidos.
- **El `outputRef` de un recibo sale de `reciboDelHilo()`**, que busca la salida con el thread token;
  nunca `${txid}#0`, que hoy coincide por cómo Lucid ordena las salidas y no por nada que declaremos
  (`SPEC-407`). El `#0` del simulador sí es verdad: ahí él decide los índices.
- **La vista de UTxOs pendientes se vence en `enCola()`**, antes del trabajo; adentro de `enviar()`
  llega tarde. La cola guarda una promesa que nunca rechaza (un rechazo suelto mata el proceso), y
  vale para una sola instancia.
- **El reference script vive en la wallet y la selección de monedas lo trata como plata**: Lucid
  0.6.2 solo excluye los declarados con `readFrom`, así que todo pasa por `entradasDeLaWallet()`.
  Se descubre al arrancar: publicarlo (`ref:publish`) pide reiniciar la API (D-083).
- **El `admin` se deriva de la wallet, no se configura**: configurarlo aparte desincroniza firma y
  dirección en silencio.
- **Los tests de rechazo del `Emulator` exigen `/failed script execution/`**, no un `toThrow()`
  pelado, que también pasa si falla por un UTxO o un fee nuestro.
- **yaci-devkit:** la imagen `latest` es Babbage y no corre Plutus V3 (está pineada en `0.10.6`); su
  entrypoint necesita `bash`; contra él va Kupmios, no Blockfrost (`cost_models_raw`); tarda ~5 min
  (yaci-store) y el `Java command not found` es ruido; `stop` sale con 137 y no es error.
- **La ventana de validez no puede pasar el safe zone de la era** (`PastHorizon`, 300 s en el
  devnet): por eso `VALIDITY_WINDOW_MS` son 3 minutos.
- **En `yaci.test.ts` el test del reference script va último**: publicar muta el adaptador.

## Comandos

```bash
pnpm --filter @plataforma/cardano test        # códec, blueprint, simulador y Emulator
pnpm --filter @plataforma/cardano ref:publish # publica el validador como reference script (🟡), una vez por red
pnpm --filter @plataforma/cardano test:yaci   # el flujo completo contra el devnet; levanta y baja compose solo
```

`test:yaci` no corre en CI ni en el `test` normal.
