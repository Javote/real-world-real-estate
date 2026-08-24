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
- **La dirección del script depende del `admin`.** Rotar la wallet de servicio cambia la dirección,
  así que **no se puede rotar sin migrar todos los hilos**. Saberlo antes de generar la seed.

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

Y dos fricciones del devnet que quedaron documentadas en el propio test: los cost models vienen con
el i64 máximo, que al pasar por un `number` se redondea fuera de rango y CML rechaza; y la **ventana
de validez no puede pasar el safe zone de la era** (`PastHorizon`), que en un devnet son 300
segundos — de ahí que `VALIDITY_WINDOW_MS` sean 3 minutos y no 10.

## Estado

Rebanadas **A** (puerto + simulador) y **B** (códec, blueprint, `Emulator` y **devnet local**)
cerradas. Falta Preprod —que no cambia el código, solo el provider y la seed— y el
`reconcile()`/`verify()` completo de la rebanada C, que necesita un indexer.

## Comandos

```bash
pnpm --filter @plataforma/cardano test        # códec, blueprint, simulador y Emulator
docker compose -f compose.dev.yml up -d       # MinIO + devnet de Cardano
pnpm --filter @plataforma/cardano test:yaci   # el flujo completo contra el devnet
```

`test:yaci` **no corre en CI** (el CI no levanta infraestructura) y está excluido del `test` normal.
Se corre a mano, con el compose arriba.
