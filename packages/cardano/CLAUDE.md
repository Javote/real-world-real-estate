# packages/cardano — el `AnchorPort`

> Se carga solo al tocar este subárbol. Lo transversal está en el `CLAUDE.md` de la raíz;
> el plan de las tres rebanadas, en `specs/SPEC-013-anchorport.md`.

**Es la única puerta a Cardano** (D-014). Nada fuera de acá importa Lucid ni Blockfrost; la API pide
el puerto y no sabe que la cadena existe.

```
port.ts        la interfaz: openThread · advanceThread · verify · awaitConfirmation
ledger.ts      LedgerStore — el estado del simulador (memoria o SQLite)
simulated.ts   adaptador simulado: rechaza lo mismo que rechazaría el validador
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

## Estado

Rebanada **A cerrada** (puerto + simulador) y la mitad offline de la **B**: códec verificado contra
Aiken y dirección derivada del blueprint. Falta lo que toca la red: construir las transacciones
(`Emulator` primero, después yaci-devkit local, después Preprod) y el `reconcile()`/`verify()` de
la rebanada C.

## Comandos

```bash
pnpm --filter @plataforma/cardano test    # códec, blueprint y simulador
docker compose -f compose.dev.yml up -d   # MinIO (y yaci cuando esté)
```
