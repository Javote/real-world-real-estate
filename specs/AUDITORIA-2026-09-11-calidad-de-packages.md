# Auditoría — calidad de `packages/` · 2026-09-11

> Los dos packages compartidos leídos completos: **28 archivos, ~5.900 líneas** (`shared` 21
> archivos, `cardano` 13 más dos scripts). Todo lo que se afirma acá está **reproducido
> ejecutándolo**, no leído: cada hallazgo trae su "cómo se comprobó".
>
> **Método:** los 28 archivos completos, más el cruce contra los consumidores reales
> (`apps/api/src/lib/anchor.ts`, `apps/api/src/db/sqlite-type-plugin.ts`, los handlers que
> `.parse()` cada schema, `apps/web/src/api/types.ts`). Un schema que describe una forma que el
> handler no produce no se ve leyendo el schema.

---

## El veredicto general, y conviene decirlo primero

**No es spaghetti, y no está cerca de serlo.** Es el código mejor tipado del repo:

| Señal | `packages/` | Comparación |
|---|---|---|
| `any`, `@ts-ignore`, `@ts-expect-error`, `biome-ignore` | **0** | — |
| `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` | **los dos, en los dos packages** | `apps/api` tiene solo `strict` (SPEC-208) |
| Tests | 72 en `cardano` (5 archivos) + 4 archivos en `shared` | el códec se fija contra Aiken byte por byte |
| Dependencias que cruzan el límite | **0** | verificado: nada fuera de `packages/cardano` importa Lucid, el códec ni el blueprint |

Las dos decisiones de arquitectura se sostienen al leerlas:

- **El puerto y sus adaptadores** (`simulated`, `real`, `disabled`, más el `LedgerStore`
  inyectable) están bien separados. `port.ts` no importa nada de Lucid; el simulador rechaza lo
  mismo que el validador y eso está probado caso por caso; `disabled` es un adaptador de verdad y
  no un `if` desparramado por la API.
- **La función de hash inyectada en `merkle.ts`** es la razón por la que ese archivo puede vivir en
  `shared` y correr en el browser. Es la pieza que hace verificable la promesa de M1-D1, y está
  bien resuelta.

Los comentarios explican **por qué**, con la medición al lado, y eso es lo que hace auditable el
package: `TIP_LAG_MARGIN_MS` no dice "2 minutos", dice contra qué bloque de Preprod se midió el
retraso y qué porcentaje de la distribución cubre. Varios de los hallazgos de abajo salieron de
seguir un comentario hasta el código y encontrar que el código ya no decía lo mismo.

**Ninguno de los 14 hallazgos toca los 16 criterios del SOM, y ninguno bloquea el Milestone 3.**
Tres valen antes de mainnet y se dicen al final; el resto es deuda de claridad.

---

## Lo que ya está abierto y no se duplica acá

**El hallazgo más grande de `packages/shared` ya tiene spec: [`SPEC-109`](SPEC-109-tipos-de-respuesta-desde-shared.md).**
Esta auditoría lo confirma desde el otro lado del límite y le pone el número que faltaba:

> **63 de los 107 tipos inferidos que `packages/shared` exporta no tienen ningún consumidor** en
> `apps/` ni en `packages/`. El 59 % de la mitad-tipos del contrato es superficie muerta, porque el
> consumidor que debía usarla —el front— mantiene 414 líneas de espejo a mano.

Y la causa está confirmada ejecutándola, tal como `SPEC-109` la diagnostica: `projectDocumentSchema`
y el `ProjectDocument` del front son **idénticos campo por campo salvo uno** — `uploadedAt` es
`z.coerce.date()` (o sea `Date`) de un lado y `string` del otro. El tipo inferido no describe lo que
viaja por el cable, así que el front no podía importarlo aunque quisiera. `SPEC-109` ya tiene la
salida correcta (`Serializado<T>`, derivado, viviendo en `shared`). **No se abre spec nueva.**

Y una que está bien y no hay que tocar: los cinco timestamps sin coercionar
(`signedAt`, `releasedAt`, `respondedAt`, `compiledAt`, `readAt`) están declarados `z.number()` en
`contract.ts` e `invitation.ts`. Se verificó contra `TIMESTAMP_COLUMNS` en
`sqlite-type-plugin.ts`: **el schema dice la verdad sobre la forma real**, con el comentario
explicando por qué no es la que "debería" ser. Eso es exactamente lo que un contrato tiene que
hacer. Es deuda de `apps/api`, no de acá.

---

## `packages/shared` — 7 hallazgos

### P-01 🟡 · `anchorStatus` es un enum de tres valores declarado como `z.string()`, en 3 de 4 lugares

`anchorStatus` siempre sale del mismo lado: `"OnChainEvent.status as anchorStatus"`, en los cuatro
handlers que lo seleccionan (`developer.routes.ts:326`, `contracts.routes.ts:84`,
`certifier.routes.ts:239`, `evidence.routes.ts:440`). O sea que su dominio real son los tres
valores de `ONCHAIN_EVENT_STATUSES`. Pero:

| Dónde | Cómo está declarado | |
|---|---|---|
| `contract.ts` — `contractReleaseSchema` | `onChainEventStatusSchema.nullable()` | ✔ |
| `documents.ts` — `projectDocumentSchema` | `z.string()` | ✗ |
| `documents.ts` — `developerDocumentSchema` | `z.string().nullable()` | ✗ |
| `certifier.ts` — `certifierCertificateSchema` | `z.string().nullable()` | ✗ |

**Cómo se comprobó:** `developerDocumentSchema.safeParse({…, anchorStatus: "Cualquiera" })` → `success: true`.

Importa más que un tipo flojo cualquiera porque **`anchorStatus` es el campo de la regla 17**: es lo
que decide si una pantalla dice "Verificado" o "Pendiente". Con `z.string()` el front no puede hacer
un `switch` exhaustivo, y el compilador no avisa si mañana aparece un cuarto estado.
→ [`SPEC-401`](SPEC-401-dos-campos-del-contrato-mas-flojos-que-la-realidad.md)

### P-02 🟡 · `z.coerce.boolean()` acepta literalmente cualquier cosa

`developerDocumentSchema.authoritative` es `z.coerce.boolean()`, que es `Boolean(v)`:

**Cómo se comprobó:**

```
coerce.boolean("false") => true
coerce.boolean("0")     => true
coerce.boolean({})      => true
```

Ese campo **no puede fallar nunca**, que es lo contrario de lo que el `z.strictObject` alrededor
existe para hacer. Y la coerción no hace falta: `authoritative` está en `BOOLEAN_COLUMNS` del
`SqliteTypeCoercionPlugin` y el handler la selecciona sin renombrar
(`"Evidence.authoritative as authoritative"`), así que llega ya como `boolean` — el resto de los
schemas la declaran `z.boolean()` a secas. Es una coerción que no arregla nada y apaga la defensa.
→ [`SPEC-401`](SPEC-401-dos-campos-del-contrato-mas-flojos-que-la-realidad.md)

### P-03 🟡 · 36 campos de hash y TXID viajan como `z.string()` pelado

`sha256Hash`, `txid`, `masterHash`, `merkleRoot`, `commitment`, `commitmentHash`, `signatureTxid`,
`sha256`: **36 declaraciones**, ninguna con forma. Un `""` pasa, un `"pendiente"` pasa, un hash en
mayúscula pasa.

Lo llamativo es que **la validación estricta ya existe en este mismo package y no se usa acá**:
`commitmentSchema` (`stage-datum.ts`) exige `^[0-9a-f]{64}$`, y `hex64ParamSchema` (`params.ts`) lo
mismo para los path params. Se aplican al datum y a la URL —o sea, a lo que entra— y no a lo que
sale.

Las reglas 16 y 17 hacen que estos campos sean *la prueba misma*: son lo único que sostiene las
cuatro afirmaciones del producto. Un contrato que no les pone forma es un contrato que no defiende
lo que más importa.
→ [`SPEC-402`](SPEC-402-los-hashes-y-txid-tienen-forma.md)

### P-04 🟡 · `authoritative` del multipart solo entiende el literal `"true"`

`stageEvidenceUploadSchema.authoritative` es `.transform((v) => v === "true")`.

**Cómo se comprobó:**

```
authoritative("true") => true
authoritative("True") => false      authoritative("on")  => false
authoritative("1")    => false      authoritative("yes") => false
```

`"on"` es lo que manda un `<input type="checkbox">` sin `value` explícito. No hay ningún test sobre
esta transformación, y el fallo es silencioso en la dirección peligrosa: la evidencia se sube igual,
se declara **no** autoritativa, y el guard `STAGE_EVIDENCE_UNATTRIBUTED` de D-028 nunca se dispara
porque no hay nada que atribuir. Nadie ve un error; hay un campo que el usuario marcó y el registro
no tiene.

*(Hoy `apps/web` no manda el campo en ninguna superficie —verificado—, así que no está roto en
producción: está indefenso ante el primer cliente que lo mande.)*
→ [`SPEC-403`](SPEC-403-el-authoritative-del-multipart.md)

### P-05 🟢 · Las funciones puras validan en una dirección sola

`refToHex` valida con `refSchema` (ASCII imprimible, ≤ 32 bytes) y lanza. `hexToRef` —la vuelta, la
que camina un verificador externo— no valida nada:

**Cómo se comprobó:** `hexToRef("zz")` → `" "`; `hexToRef("616")` → `"a"`. Sin error.

Lo mismo en `merkle.ts`: `merkleRoot` y `merkleProof` llaman a `assertLeaf` sobre cada hoja;
`merkleRootFromProof` —otra vez, la que corre el verificador— no valida ni la hoja ni los hermanos.

Es la asimetría al revés de la que conviene: la dirección laxa es justamente la de **verificar**, que
es la que un tercero ejecuta con datos que no controlamos.
→ [`SPEC-404`](SPEC-404-las-funciones-puras-validan-las-dos-direcciones.md)

### P-06 🟢 · `MerkleStep` está declarado dos veces, en el package que existe para que eso no pase

`merkle.ts` exporta `interface MerkleStep { sibling: string; position: "left" | "right" }`.
`documents.ts` exporta `merkleStepSchema = z.strictObject({ sibling, position })`. Misma forma, dos
declaraciones, nada que las ate: si una gana un campo, la otra no se entera.

Hoy coinciden. El punto no es que estén mal — es que **este es el package cuya tesis entera es
"declarado una sola vez"**, y adentro hay una excepción sin motivo.
→ [`SPEC-404`](SPEC-404-las-funciones-puras-validan-las-dos-direcciones.md)

### P-07 🟢 · Higiene: el idioma Zod, dos tipos que faltan, y un comentario que afirma lo contrario del código

- `evidenceProofSchema.timestamp` usa `z.string().datetime()`. Es el **único** lugar: los otros usan
  `z.iso.datetime()`. `auth.ts` abre con el aviso de por qué importa: *"este archivo es el patrón que
  copian los schemas de cada rebanada: si acá queda el idioma viejo, se replica ochenta veces"*.
- `merkleStepSchema` y `notificationQuerySchema` no exportan su tipo inferido, contra la regla 2 de
  `packages/shared/CLAUDE.md` (*"exportá el schema **y** el tipo inferido"*). Los otros cinco
  schemas sin tipo son primitivos (`passwordSchema`, `refSchema`…) y está bien que no lo tengan.
- **`packages/shared/tsconfig.json` afirma en un comentario que `package.json` apunta `types` al
  fuente.** Apunta a `./dist/index.d.ts` — y el `CLAUDE.md` del package lo explica bien, con la
  tabla de resolución correcta. El comentario del tsconfig quedó del revés del cambio.

→ [`SPEC-405`](SPEC-405-higiene-de-shared.md)

---

## `packages/cardano` — 5 hallazgos

### C-01 🟡 · El simulador olvida todo lo que confirmó en cada reinicio · **reproducido**

`LedgerStore` es inyectable justamente para que el estado sobreviva: en `apps/api` es SQLite
(`SimulatedLedgerUtxo`), y el `CLAUDE.md` del package lo dice — *"reiniciar `pnpm dev` no pierde los
hilos abiertos"*. **Pero la mitad del estado del simulador no pasa por el store**: `proofs` y
`bloques` son dos `Map` en memoria de la instancia.

**Cómo se comprobó** (test escrito y corrido contra el package, en verde):

```
store persistido + instancia nueva del adaptador
  findLiveThread(stageRef)  → el hilo sigue ahí        ✔
  confirmedAt(txid)         → null                     ✗  (antes del reinicio: un número)
  verify(txid)              → null                     ✗  (antes del reinicio: el AnchorProof)
```

El efecto no es teórico: `reconciliarAnclajes` promueve `Pending → Confirmed` preguntando
exactamente `confirmedAt` (`domain/reconcile.ts:133`). Después de un reinicio, **todo evento anclado
antes queda `Pending` para siempre**, y por la regla 17 la UI dice "Pendiente" sobre un anclaje que
el propio simulador produjo. Es la misma clase de incoherencia registro-vs-cadena que la prueba de
volumen encontró del lado real, con la diferencia de que acá el "ledger" somos nosotros.
→ [`SPEC-406`](SPEC-406-el-simulador-no-olvida-lo-que-confirmo.md)

### C-02 🟡 · El `outputRef` del recibo supone que la salida es la `#0`

`enviar()` devuelve `outputRef: ${txid}#0` fijo, para los tres caminos.

`port.ts` describe ese campo así: *"Es estado crítico: si se pierde, el thread token queda en un UTxO
que nadie sabe cuál es y ese stage **no se puede volver a mover nunca**."*

Hoy el valor es correcto para los hilos, por una propiedad de Lucid que el código no declara ni
prueba: hay una sola salida explícita y el vuelto va después. Dos cosas lo vuelven deuda y no
paranoia:

1. **La respuesta correcta ya está calculada y se tira.** `enviar()` recibe `salidas` y se la pasa a
   `anotarLoEnviado`, que recorre las salidas buscando `salida.address === this.refs.address` — o
   sea, ya sabe encontrar la salida al script sin suponer el índice. `publishReferenceScript` hace
   lo mismo, con un `find` explícito y un error si no aparece. **El archivo ya distingue entre
   buscar y suponer; `enviar()` es el único que supone.**
2. Para `anchorCommitment` el `#0` no es frágil, es **sin sentido**: esa transacción no crea ninguna
   salida al script, así que el `outputRef` apunta al vuelto de la wallet. Quien llama lo descarta
   —hoy—, y el campo miente igual.

→ [`SPEC-407`](SPEC-407-el-outputref-se-busca-no-se-supone.md)

### C-03 🟡 · Lo que vuelve de la cadena entra sin validarse, por dos puertas

**`decodeStageDatum` no valida.** `stageDatumSchema` existe en `shared` y el códec no lo aplica: son
siete casts (`projectRef as string`, `Number(completedAt as bigint)`).

**Cómo se comprobó:** con un datum de aridad corta, `decodeStageDatum` tira
`TypeError: Cannot read properties of undefined (reading 'index')` —no un error de dominio, que es
lo que el resto del package produce (`AnchorRejectedError` con código estable)—; con siete campos
del tipo equivocado, devuelve un objeto plausible sin quejarse.

**Y `threadProof()` no filtra por el thread token:**

```ts
const vivo = utxos.find((u) => u.txHash === txid);             // threadProof   — cualquier UTxO de ese txid
const vivo = utxos.find((u) => (u.assets[unit] ?? 0n) > 0n);   // findLiveThread — el que lleva el token
```

Cualquiera puede pagar a la dirección de un script con el datum que quiera; el thread token, no —lo
acuña el validador—. `findLiveThread` (el método más nuevo) usa el token; `verify()` no, y después
le pasa ese datum al decoder sin validar. Son las dos mitades del mismo agujero.
→ [`SPEC-408`](SPEC-408-lo-que-vuelve-de-la-cadena-se-valida.md)

### C-04 🟢 · `verify()` inventa el `blockTimestamp` que `confirmedAt()`, en la misma clase, ya sabe leer

`threadProof` devuelve `blockTimestamp: this.now()`, con el comentario: *"El timestamp autoritativo
es el del bloque; leerlo necesita el indexer de la rebanada C. Hasta entonces, el momento de la
confirmación."*

Era cierto cuando se escribió. **Dejó de serlo cuando se agregó `confirmedAt()`**, cuarenta líneas
más abajo en el mismo archivo, que lee `block_time` de Blockfrost y lo devuelve en POSIX ms. El
indexer sigue haciendo falta para *reconstruir la historia*; para *este campo*, no.

Es un `AnchorProof` que afirma un timestamp de bloque que no es el del bloque, en un producto cuya
afirmación central es *"se registró en este momento"*.
→ [`SPEC-409`](SPEC-409-verify-devuelve-el-timestamp-del-bloque.md)

### C-05 🟢 · Tres asperezas chicas del adaptador

- **`canonical()` (simulado) no ordena por clave.** `Object.entries(v).sort()` ordena los pares
  `[clave, valor]` con el comparador por defecto, o sea por el string `"clave,valor"`. Con dos
  claves donde una es prefijo de la otra y el siguiente carácter cae por debajo de `,` (`!`…`+`), el
  orden sale distinto del orden por clave. Con las claves de hoy —identificadores— no cambia nada;
  es una trampa puesta en la única función cuyo trabajo es canonicalizar, y de la que dependen el
  TXID determinístico y el chequeo `STALE_DATUM`.
- **`utxoAt()` no guarda contra `NaN`.** Chequea que las dos partes del `outputRef` existan y después
  hace `Number.parseInt(index, 10)` sin mirar el resultado: `"abc#xyz"` pasa el guard y consulta al
  proveedor con `NaN`. El `BAD_OUTPUT_REF` que ya existe es el lugar donde debería caer.
- **`confirmedAt()` hace `fetch` sin timeout.** Un Blockfrost que acepta la conexión y no contesta
  cuelga la reconciliación sin límite. Es el único `fetch` del repo que sale a una red que no
  controlamos.

→ [`SPEC-410`](SPEC-410-tres-asperezas-del-adaptador.md)

---

## Dos cosas transversales

### T-01 🟢 · Lucid se carga siempre, ancle quien ancle: 2 s y 121 MB por proceso · **medido**

`apps/api/src/lib/anchor.ts` importa `createAnchorPort` de forma estática → `index.ts` → `factory.ts`
→ `real.ts` → `@lucid-evolution/lucid`. No hay camino que lo evite: el `import` es de módulo, no de
rama.

**Cómo se comprobó** (`require()` en un proceso Node limpio, contra el `dist` compilado):

| Qué se carga | Tiempo | Heap | Módulos |
|---|---:|---:|---:|
| `@plataforma/cardano` entero (lo de hoy) | **2015 ms** | **121,0 MB** | 1758 (453 de Lucid/harmoniclabs) |
| solo `simulated` + `disabled` + `ledger` | 160 ms | 14,3 MB | 103 |

En producción (`ANCHOR_MODE=real`) Lucid hace falta y no se ahorra nada — **hay que decirlo**. Lo
paga de gusto todo lo demás: los 335 tests de `apps/api` (cada worker de vitest), `pnpm dev`, y el
camino `disabled`, que es justamente el que corre cuando la configuración de anclaje está rota.
→ [`SPEC-411`](SPEC-411-lucid-se-carga-solo-si-hace-falta.md)

### T-02 🟢 · El constructor de diez parámetros posicionales

`LucidAnchorAdapter` tiene un constructor privado con **10 parámetros posicionales**, de los cuales
tres son `number` seguidos (`validityWindowMs`, `tipLagMarginMs`, `pendingUtxoTtlMs`) y dos son
strings adyacentes (`walletAddress`, `network`). El único llamador —`create()`— los pasa en orden.
Intercambiar dos de los tres `number` compila, pasa los tests que no fijan el tiempo, y produce
ventanas de validez mal calculadas contra la red de verdad.

Es mecánico de arreglar y de cero cambio de comportamiento: un objeto de opciones, que es lo que
`create()` ya recibe.
→ [`SPEC-412`](SPEC-412-el-constructor-de-diez-parametros.md)

**Lo que esta auditoría NO propone: partir `real.ts`.** Son 704 líneas con cinco responsabilidades
(construcción de transacciones, cola, vista local de UTxOs, HTTP a Blockfrost, publicación del
reference script), y separarlas se defiende en abstracto. En concreto es el archivo de más riesgo
del repo (🟡), el que la prueba de volumen ejercitó entero, y sus partes están acopladas por el
estado que la cola protege. Partirlo sin un motivo que lo empuje es mover el código mejor probado
que tenemos para que quede más lindo. Queda anotado como pregunta abierta en `SPEC-412`, no como
trabajo.

---

## Resumen

| # | Hallazgo | Nivel | Spec |
|---|---|---|---|
| P-01 | `anchorStatus` declarado `z.string()` en 3 de 4 lugares | 🟡 | `SPEC-401` |
| P-02 | `z.coerce.boolean()` acepta cualquier cosa | 🟡 | `SPEC-401` |
| P-03 | 36 hashes y TXID sin forma | 🟡 | `SPEC-402` |
| P-04 | `authoritative` del multipart solo entiende `"true"` | 🟡 | `SPEC-403` |
| P-05 | `hexToRef`/`merkleRootFromProof` no validan | 🟢 | `SPEC-404` |
| P-06 | `MerkleStep` declarado dos veces | 🟢 | `SPEC-404` |
| P-07 | Idioma Zod, dos tipos que faltan, comentario al revés | 🟢 | `SPEC-405` |
| C-01 | El simulador pierde las confirmaciones al reiniciar | 🟡 | `SPEC-406` |
| C-02 | `outputRef` supone la salida `#0` | 🟡 | `SPEC-407` |
| C-03 | `decodeStageDatum` y `verify()` no validan lo que vuelve | 🟡 | `SPEC-408` |
| C-04 | `verify()` inventa el `blockTimestamp` | 🟢 | `SPEC-409` |
| C-05 | `canonical()`, `parseInt`, `fetch` sin timeout | 🟢 | `SPEC-410` |
| T-01 | Lucid se carga siempre: 2 s y 121 MB | 🟢 | `SPEC-411` |
| T-02 | Constructor de 10 parámetros posicionales | 🟢 | `SPEC-412` |

**Los tres que valen antes de mainnet** son `SPEC-407` y `SPEC-408` —los dos sobre el `outputRef` y
el datum, donde un error deja un hilo irrecuperable y no hay reparación posible después— y
`SPEC-402`, porque un hash sin forma en el contrato es lo único que separa un "Verificado" real de
uno que nadie validó. Ninguno de los tres está roto hoy: los tres son suposiciones no declaradas en
los lugares donde equivocarse no se deshace. El resto puede esperar a que el milestone deje aire.
