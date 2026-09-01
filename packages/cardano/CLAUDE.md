# packages/cardano — el `AnchorPort`

> Se carga solo al tocar este subárbol. Lo transversal está en el `CLAUDE.md` de la raíz;
> el plan de las tres rebanadas, en `specs/SPEC-013-anchorport.md`.

**Es la única puerta a Cardano** (D-014). Nada fuera de acá importa Lucid ni Blockfrost; la API pide
el puerto y no sabe que la cadena existe.

```
port.ts        la interfaz: openThread · advanceThread · verify · awaitConfirmation
ledger.ts      LedgerStore — el estado del simulador (memoria o SQLite)
simulated.ts   adaptador simulado: rechaza lo mismo que rechazaría el validador
real.ts        LucidAnchorAdapter: construye las transacciones de verdad
codec.ts       StageDatum ⇄ Data de Plutus — el contrato binario con contracts/
blueprint.ts   carga plutus.json, aplica el admin, deriva dirección y policy
factory.ts     createAnchorPort(): ANCHOR_MODE, sin defaults inseguros
```

## El valor dorado, y por qué existe

`codec.test.ts` compara el CBOR contra un hex fijo. **Ese mismo hex está fijado del otro lado**, en
`contracts/lib/propnexus/fsm.ak` (`t_golden_datum_encoding`), sobre el mismo datum. Sale de correr
el test en Aiken con un valor cualquiera y leer lo que el error dice que esperaba.

Es la única defensa real contra el modo de falla más caro de esta rebanada: **un campo corrido o un
índice de constructor equivocado pasa el typecheck, pasa los tests de lógica, y falla recién en la
cadena** — después de firmar y pagar el fee, con un mensaje que no dice nada. Si tocás `StageDatum`
en cualquiera de los dos lados, los dos tests se ponen rojos. Es a propósito.

Índices que **no son libres** (salen del orden de declaración en Aiken):

| Tipo | Índices |
|---|---|
| `StageState` | `Pending`=0 · `InProgress`=1 · `Observed`=2 · `Completed`=3 |
| `Bool` | `False`=0 · `True`=1 (convención de Plutus) |
| `Option` | `Some`=0 · `None`=1 |
| `StageDatum`, `Completion`, `Advance`, `Init` | constructor 0, campos en orden |

## Trampas

- **2026-08-23 · `auto-install-peers=false` + `strict-peer-dependencies=false` = un `instanceof`
  que revienta en runtime.** Lucid trae los `@harmoniclabs/*` como **peers**, y este repo no
  instala peers automáticamente a propósito (D-052: con `true` arrastraba Prisma y Drizzle vía un
  peer opcional de Nitro). O sea que hay que declararlos a mano — y **a la versión que el dependent
  pide**, que nadie verifica: `pnpm add @harmoniclabs/cbor` trae la 2.x, `uplc@1.4.1` pide `^1.3.0`,
  y el síntoma es `TypeError: Right-hand side of 'instanceof' is not an object` en el encoder,
  a diez frames de profundidad, sin ninguna señal en el typecheck. **Antes de agregar un peer a
  mano, mirá el rango que declara quien lo necesita** (`peerDependencies` de su `package.json`).
- **2026-08-23 · Copias con peers distintos rompen `instanceof` aunque la versión sea la misma.**
  Agregar peers de a uno deja variantes viejas en `node_modules/.pnpm` y dos clases "iguales" de
  archivos distintos nunca son `instanceof`. Si el error persiste después de arreglar versiones:
  `rm -rf node_modules apps/*/node_modules packages/*/node_modules && pnpm install`.
- **2026-08-23 · El warning `The "pnpm" field in package.json is no longer read`** sale en cada
  comando: el `overrides` de la raíz (`@types/express`) está siendo **ignorado**. Hoy no rompe nada
  porque `apps/api` ya declara `^5.0.6` directo, pero el override no está haciendo lo que parece.
- **2026-09-01 · El `Emulator` no ve su propio mempool, y eso es una ventaja.** `getUtxos()` lee
  solo el ledger, así que un anclaje sin `emulator.awaitBlock(1)` detrás reproduce **exactamente**
  la condición de Preprod: un proveedor que todavía no vio la transacción anterior. Los tests de la
  cola dependen de eso. Si alguna vez agregás un `awaitBlock` "para que pase", lo que estás haciendo
  es apagar el test.
- **La dirección del script depende del `admin`.** Rotar la wallet de servicio cambia la dirección,
  así que **no se puede rotar sin migrar todos los hilos**. Saberlo antes de generar la clave.
- **2026-08-31 · `fromSeed` y `fromPrivateKey` dan direcciones distintas para la misma clave.**
  `fromSeed` arma una dirección **base** (pago + staking, `addr_test1q…`); `fromPrivateKey` solo sabe
  armar una **enterprise** (`addr_test1v…`, `CML.EnterpriseAddress.new`). El *payment credential* —y
  por lo tanto el admin del validador— es **el mismo** en las dos, así que la clave puede gastar los
  UTxOs de las dos; lo que cambia es dónde los **busca** Lucid. Costó un rodeo entero: se fondeó la
  base con el faucet y al pasar a clave de pago (D-078) la wallet miraba la enterprise, vacía. **El
  faucet pide una dirección, no una clave: pedile la que el servicio va a usar de verdad.**

## El simulador es su propia cadena, y solo habla de ella

`confirmedAt(txid)` contesta desde el registro de lo que **él mismo ancló**, y da `null` para
cualquier otro txid (D-079). Antes devolvía `now()` para todo, o sea que afirmaba confirmación sobre
transacciones ajenas.

**El punto general, que vale para el adaptador real también:** tener un txid no es tener una
confirmación. El txid es el hash del cuerpo de la transacción y existe antes de enviarla; un submit
exitoso solo dice que el nodo la aceptó en su mempool. Por eso `openThread`/`advanceThread` devuelven
`Pending` con txid y la promoción a `Confirmed` la hace `confirmedAt()` (D-077).

## Un anclaje por vez, y el adaptador se acuerda de lo que envió

`LucidAnchorAdapter` serializa todas sus transacciones en una cola en memoria y, después de cada
envío, se queda con lo que acaba de crear: el vuelto de la wallet (`overrideUTxOs()`) y las salidas
al script, que `advanceThread` consulta **antes** que al proveedor. La vista vence a los 3 minutos
(`PENDING_UTXO_TTL_MS`). El porqué completo está en D-082; acá, lo que hay que tener presente al
tocar el archivo:

- **Se construye con `chain()`, no con `complete()`.** Es la misma transacción; `complete()` es
  `chain()` tirando dos de los tres valores. Si volvés a `complete()`, el encadenamiento desaparece
  sin que nada se ponga rojo hasta que haya dos anclajes seguidos.
- **La vista se vence en `enCola()`, antes del trabajo.** El primero que la lee es `utxoAt()`, que
  corre antes de construir nada: vencerla dentro de `enviar()` llega tarde.
- **La cola guarda una promesa que nunca rechaza.** Guardar el turno a secas deja un rechazo sin
  manejar —que en Node mata el proceso— aunque quien llamó lo haya atrapado.
- **Vale para un proceso.** Render corre una instancia; con dos, esto no alcanza.

## El validador viaja por referencia, si está publicado

El validador son 2289 bytes. Hasta el 2026-09-01 viajaban adentro de **cada** transacción de hilo;
ahora, si existe un UTxO que lo lleva, se lo referencia con `readFrom` (D-083). Medido: un
`openThread` pasa de 2890 a 599 bytes y de 0,2976 a 0,2317 tADA.

```bash
BLOCKFROST_API_KEY=… SERVICE_WALLET_PRIVATE_KEY=… \
  pnpm --filter @plataforma/cardano ref:publish    # una vez por red, idempotente
```

- **Vive en la dirección de la wallet**, no en la del script: ahí sería inmune a la selección de
  monedas pero también irrecuperable —los ~11 ADA del mínimo quedarían muertos—.
- **Y por eso hay que filtrarlo a mano.** Para la selección de monedas es plata. El error de Lucid
  dice que excluye los UTxOs con script, y en 0.6.2 **solo excluye los que la transacción declaró
  con `readFrom`**: un anclaje por metadata no declara ninguno y se lo lleva puesto. Lo filtra
  `entradasDeLaWallet()`, que es el único lugar por el que pasan todas.
- **Se descubre al arrancar**, comparando el hash del script. Publicar con la API arriba no la
  cambia: hay que reiniciarla.
- **`null` es un estado legítimo**: sin reference script, el adaptador adjunta el validador y todo
  funciona igual, más caro. Los tres primeros tests de `yaci.test.ts` corren así a propósito.
- **Los dos caminos están probados contra un nodo de verdad.** El test del reference script va
  **último** en `yaci.test.ts` porque publicar muta el adaptador: los de arriba cubren el validador
  adjunto y el de abajo el referenciado, que es la diferencia que existe en producción según haya o
  no un UTxO publicado.

## El puerto declara su red, y por eso la fila puede ser honesta

`AnchorPort.network` dice contra qué ledger resuelven los TXID que produce: `Preprod`, `Mainnet`,
`Custom`, o `Simulated` para el simulador —que es su propia cadena y sus TXID resuelven contra
`SimulatedLedgerUtxo`—. `disabled` devuelve `null`: no produce ninguno.

**Sale del puerto y no de `CARDANO_NETWORK`.** El env es lo que se *pidió*; el puerto es lo que se
*construyó*. Si la API lee el entorno al insertar la fila, los dos se pueden desincronizar en
silencio y la columna termina afirmando una red contra la que ese TXID no existe — exactamente lo
que la columna existe para impedir (D-080). Lo cubre un test que pone `CARDANO_NETWORK=Preprod` con
el puerto en `simulated` y exige que la fila diga `Simulated`.

**No es la columna `anchorMode` que D-080 rechazó.** Aquella registraba qué adaptador corrió; esta
registra contra qué ledger se resuelve un TXID. Que correlacionen es incidental.

## El adaptador real es agnóstico del provider, y eso no es cosmético

`LucidAnchorAdapter` recibe una instancia de Lucid ya configurada, así que **el mismo código** corre
contra el `Emulator` (en proceso, en CI), contra yaci-devkit (nodo local) y contra Preprod. Si
hiciera falta cambiar una línea al pasar de uno a otro, lo que prueba el CI no sería lo que corre
desplegado.

El `admin` **no se configura**: se deriva de la wallet de la instancia. Configurarlo aparte
permitiría que la firma y la dirección del script se desincronicen, y el síntoma sería hablarle a
una dirección donde no hay ningún hilo — sin error, solo silencio.

**Los tests del `Emulator` ejecutan el validador de verdad.** Un rechazo ahí es el mismo rechazo que
daría la cadena. Por eso exigen `/failed script execution/` y no un `toThrow()` pelado: sin el
regex, el test pasaría también si la transacción fallara por una razón nuestra —un UTxO que no
está, plata que no alcanza— y estaría diciendo que el validador rechazó algo que nunca evaluó.

## El devnet local, y las tres cosas que costaron

`compose.dev.yml` levanta yaci-devkit: un Cardano de verdad con bloques de 1 segundo. El mismo
adaptador que corre contra el `Emulator` corre contra él sin tocar una línea — cambia el provider.

1. **La imagen `latest` no sirve**: quedó en enero de 2024 y reporta `protocol_major_ver: 8`
   (Babbage), que **no ejecuta Plutus V3**. Por eso está pineada en `0.10.6`, que da Conway
   (`protocol_major_ver: 10`) con cost models de V3.
2. **Su entrypoint está roto**: invoca con `sh` un script que usa `==` de bash, y el contenedor
   muere con `unexpected operator`. Se puentea con `entrypoint: ["bash", "/app/yaci-cli.sh"]`.
3. **Provider Kupmios, no Blockfrost.** El provider Blockfrost de Lucid 0.6 lee `cost_models_raw`,
   un campo que la API agregó después y que yaci-store todavía no devuelve (`Cannot read properties
   of undefined (reading 'PlutusV1')`). Ogmios entrega los parámetros nativos. En Preprod se usa
   Blockfrost, que sí lo trae, y el adaptador no se entera.

4. **Tarda ~5 minutos en estar listo, y miente mientras tanto.** Ogmios (1337) y Kupo (1442)
   contestan casi enseguida, pero **yaci-store (8080) es un Spring Boot** que sigue arrancando. En
   el medio los logs escupen `Java command not found in the provided JRE folder` — **es ruido**:
   cae a `java` del PATH (`/opt/java/openjdk`) y arranca igual. La señal buena es
   `[OK] Yaci Store Started`, o un 200 en `curl localhost:8080/api/v1/blocks/latest`.
   **Esa espera ya no es tuya**: `vitest.devnet.mts` levanta el devnet, aguanta hasta 8 minutos a
   que `/blocks/latest` conteste, y lo baja al terminar. Solo apaga lo que prendió — si el devnet
   ya estaba arriba, lo usa y lo deja. El teardown corre aunque los tests fallen, que es justo
   cuando uno se olvidaría de limpiar.
5. **`docker compose stop yaci` termina con exit 137, y no es un error.** La imagen no maneja
   `SIGTERM`, así que compose la mata con `SIGKILL` después del timeout. No hay estado que perder:
   el devnet se regenera entero en el próximo arranque.

Y dos fricciones del devnet que quedaron documentadas en el propio test: los cost models vienen con
el i64 máximo, que al pasar por un `number` se redondea fuera de rango y CML rechaza; y la **ventana
de validez no puede pasar el safe zone de la era** (`PastHorizon`), que en un devnet son 300
segundos — de ahí que `VALIDITY_WINDOW_MS` sean 3 minutos y no 10.

## Estado

Rebanadas **A** (puerto + simulador) y **B** (códec, blueprint, `Emulator` y **devnet local**)
cerradas. Desde el 2026-08-27 `factory.ts` **cablea el adaptador real**: `ANCHOR_MODE=real` levanta
Lucid contra Blockfrost, selecciona la wallet desde `SERVICE_WALLET_PRIVATE_KEY` y arma el
`LucidAnchorAdapter`. Mainnet se rechaza ahí mismo (D-013).

Hasta entonces se decía que "Preprod no cambia el código, solo el provider y la seed", y era
inexacto: el adaptador no cambiaba, pero **nadie lo construía** — pedir `real` tiraba un error que
remitía a esta misma rebanada. Ahora sí: lo que falta para Preprod es la cuenta de Blockfrost y una
wallet fondeada, nada de código.

Desde el 2026-09-01 el adaptador **referencia** el validador en vez de adjuntarlo cuando está
publicado (D-083), y **encadena**: dos anclajes dentro del mismo bloque ya no chocan por
el UTxO único de la wallet, y el hilo se puede avanzar sin esperar a que el bloque publique el
`openThread` (D-082).

De la rebanada **C** está lo mínimo: `confirmedAt(txid)` en el puerto, que responde con el POSIX ms
del bloque o `null`. **Existe porque `verify()` no servía**: devuelve un `AnchorProof`, que exige
`outputRef` y `datum` —cosas de un anclaje **con hilo**—, así que para uno por metadata daba `null`,
indistinguible de "no confirmó". Queda el `reconcile()`/`verify()` completo, que necesita un
indexer.

## Comandos

```bash
pnpm --filter @plataforma/cardano test        # códec, blueprint, simulador y Emulator
pnpm --filter @plataforma/cardano ref:publish # publica el validador como reference script (🟡)
pnpm --filter @plataforma/cardano test:yaci   # el flujo completo contra el devnet
docker compose -f compose.dev.yml up -d       # solo si querés dejarlo levantado entre corridas
```

`test:yaci` **no corre en CI** (el CI no levanta infraestructura) y está excluido del `test` normal.
Se corre a mano, con el compose arriba.
