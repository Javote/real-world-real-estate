# Auditoría — Calidad de `contracts/`: el validador Aiken (2026-09-11)

> Tercera de la serie del 2026-09-11, con el mismo encargo que las de backend y frente: la pregunta
> explícita del dueño de si el código *"tiene sentido o es spaghetti del diablo"*, y si
> **falta algo importante que nos estamos olvidando**.
>
> **La respuesta corta a la primera pregunta: no, no es spaghetti — es la parte mejor organizada del
> repo.** El corte de D-008 (núcleo puro + cáscara delgada) está aplicado de verdad, los 82 tests
> mapean uno a uno contra los puntos de rechazo, y el blueprint commiteado reproduce byte por byte.
> No hay nada que reescribir.
>
> **La respuesta a la segunda es que sí, faltan dos cosas, y una no es pulido.** `C-01` es un agujero
> real en la garantía central del thread token: **la policy no es one-shot, el mismo `stage_ref` se
> puede acuñar dos veces**, y hoy `contracts/CLAUDE.md` afirma lo contrario. `C-02` es la rotación de
> la clave del `admin`, que no existe y congela los hilos para siempre si la clave se pierde.
> **Ninguno toca los 16 criterios del SOM ni bloquea la entrega del Milestone 3** — pero `C-01`
> contradice una afirmación publicada y `C-02` es checklist de mainnet.

## Cómo se hizo

Se leyeron **los dos archivos completos** (`lib/propnexus/fsm.ak` 474 líneas, `validators/stage.ak`
913) más `aiken.toml`, `plutus.json`, el `CLAUDE.md` del subárbol y el job de CI. Nada se dedujo de
la prosa: cada afirmación de este documento se verificó ejecutando algo (memoria del dueño,
*"verificar contra el código, no contra las decisiones"*).

- **Lo que se pudo ejecutar, se ejecutó.** `C-01`, `C-03` y `C-04` no son lectura: se agregaron tres
  tests descartables (`tmp_*`) al final de `validators/stage.ak`, se corrieron con
  `aiken check -m tmp_`, se copió la salida real acá y se revirtió con `git checkout`. El árbol
  quedó limpio y el baseline volvió a 82/82 antes de escribir esto.
- **Reproducibilidad del blueprint**: se hasheó `plutus.json`, se corrió `aiken build` y se volvió a
  hashear. Idéntico (`23eb6fc3…49ef3`), `git status` limpio.
- **El boundary con TypeScript se cruzó en los dos sentidos**: se siguió `openThread` desde
  `apps/api/src/domain/stage-transition.ts` hasta `mintAssets` en `packages/cardano/src/real.ts`, y
  el espejo de la FSM en `packages/shared`. Es lo que convirtió `C-01` de curiosidad teórica en
  camino alcanzable.
- **Se descartó un hallazgo candidato** antes de escribirlo, y conviene decirlo porque es el tipo de
  cosa que una auditoría apurada reporta mal: parecía que `isValidInitialDatum` de
  `packages/shared` no espejaba el tope de 32 bytes de `valid_ref`. **Es falso** —
  `buildStageDatum` construye las refs con `refToHex`, que aplica `refSchema.parse` con
  `.max(MAX_REF_BYTES)`, y está testeado (`stage-datum.test.ts:35`). El espejo está bien.

Baseline al momento de la auditoría, medido en la máquina:

```
aiken --version                →  aiken v1.1.21+42babe5
aiken check                    →  82 checks, 0 errors, 0 warnings   (fsm 43 · stage 39)
aiken build + shasum           →  plutus.json idéntico al commiteado
```

Presupuesto de ejecución, del propio `aiken check`: el test más caro del validador mide
**~163 K mem / ~51 M cpu**, contra límites de Plutus V3 de 14 M mem / 10 000 M cpu por transacción.
**Dos órdenes de magnitud de aire.** No hay riesgo de presupuesto y no hace falta optimizar nada.

---

## Lo que está bien, y por qué vale nombrarlo

No es cortesía: varias de estas son cosas que la mayoría del código Aiken en producción hace mal, y
si alguien "simplifica" alguna, rompe una garantía sin darse cuenta.

| Qué | Por qué importa |
|---|---|
| **El corte de D-008 es real** | `fsm.ak` no importa nada de `cardano/*`: son funciones puras sobre datos. Por eso 43 de los 82 tests corren sin construir una `Transaction`. El validador no repite ninguna de esas reglas, las llama |
| **Las dos puntas de la ventana de validez se exigen finitas** | `within_validity_range` hace `expect Finite(lower)` **y** `expect Finite(upper)`. Es la trampa clásica: con la punta superior infinita, `completed_at` vuelve a ser un número que el operador elige. Está cerrado, y con test del borde exacto **y** de un instante más allá, de los dos lados |
| **Valores dorados de CBOR en los dos lados del boundary** | `t_golden_datum_encoding` + los 3 `t_golden_redeemer_*` fijan el mismo hex que `packages/cardano/src/codec.test.ts`. Sin esto, un cambio de orden de campo se descubre como una tx firmada, pagada y rechazada sin mensaje útil. **Es la mejor idea del subárbol** |
| **`else(_) { fail }` con test** | Cierra withdraw/publish/vote/propose. Muchos proyectos lo dejan implícito; acá hay un test que lo fija |
| **Un input y un output del script por tx** | `inputs_at_address == 1` + `[continuing_output]` es lo que impide fusionar o partir hilos |
| **El valor no se toca** | `continuing_output.value == own_input.output.value` sostiene D-021 de forma literal, y además hace el trabajo pesado de `C-05` |
| **CI con candado de blueprint** | `aiken fmt --check`, `aiken check`, `aiken build` y `git diff --exit-code plutus.json`, con la action pineada por SHA. El blueprint no puede quedar viejo en silencio |
| **Cero warnings** | 82 checks sin un solo warning: no hay imports muertos ni código sin usar |

---

## Los hallazgos

| ID | Qué | Severidad | Dónde |
|---|---|---|---|
| **C-01** | **La policy no es one-shot: el mismo `stage_ref` se puede acuñar dos veces** | 🟠 no es pulido | `validators/stage.ak:133` |
| **C-02** | El `admin` es parámetro del script: no hay rotación ni recuperación de clave | 🟠 pre-mainnet | `validators/stage.ak:77` |
| **C-03** | "No hay burn" es invariante declarada y publicada, **sin test propio** | 🟡 cobertura | `validators/stage.ak:140` |
| **C-04** | `evidence_root` no tiene tope de largo para stages no críticos | 🟢 pulido | `lib/propnexus/fsm.ak:116` |
| **C-05** | La retención del token la sostiene la igualdad de valor, no el chequeo que parece sostenerla | 🟢 trampa latente | `validators/stage.ak:104` |
| **C-06** | `--property-coverage` no se usa; los 82 tests son todos por valor fijo | 🟢 observación | — |

---

### C-01 · La policy no es one-shot: el mismo `stage_ref` se puede acuñar dos veces 🟠

**La afirmación que hoy es falsa.** `contracts/CLAUDE.md` dice:

> `mint` acuña **exactamente uno** por stage

y justifica el token entero con:

> Sin el token, el operador podía crear dos UTxOs para el mismo stage con estados contradictorios y
> **los dos validaban**: quien verifica tenía que preguntarnos cuál era el bueno, que es la
> confianza que el producto viene a eliminar.

El token **acota** ese problema pero **no lo cierra**. Lo que el handler `mint` garantiza es
*"exactamente un token por transacción"*, no *"exactamente un token por stage"*:

```aiken
expect [Pair(asset_name, 1)] = dict.to_pairs(assets.tokens(tx.mint, policy_id))
```

Eso es un predicado sobre **esta** transacción. Nada ata la acuñación a un UTxO consumido, y el
handler **no mira `tx.inputs` en ningún momento** (verificado: no hay una sola referencia a
`inputs` ni a `OutputReference` en las 19 líneas del `mint`). Una segunda transacción, idéntica
salvo el input de fee, vuelve a acuñar el mismo asset name y el validador la acepta igual.

**Reproducido**, no razonado — sonda `tmp_mint_is_not_one_shot`, que llama a `stage.mint` dos veces
con el mismo `stage_ref` y distinto input de semilla, y exige que **las dos** den `True`:

```
│ PASS [mem: 302.61 K, cpu:  96.22 M] tmp_mint_is_not_one_shot
3 tests | 3 passed | 0 failed
```

Resultado: dos UTxOs vivos en la dirección del script, cada uno con 1 unidad del **mismo** asset
name, cada uno un hilo `Pending` legítimo, cada uno capaz de avanzar por su cuenta a estados
distintos. Exactamente el escenario que el párrafo citado dice que el token elimina.

**Y es alcanzable desde el backend, no es teórico.** El camino está construido:

1. `POST /projects/:id/stages/:stageId/retry-anchor` → `retryStageMint`
   (`apps/api/src/domain/stage-transition.ts:479`).
2. Su guarda contra el doble mint es `cabezaDelHilo(stage.id) !== null` → `THREAD_ALREADY_OPEN`.
3. **`cabezaDelHilo` es una consulta a la base y nada más** (`:209`): lee
   `OnChainEvent.outputRef`. **Nunca toca la cadena.**
4. El modo de falla que deja `outputRef` en `null` con el hilo **vivo on-chain** está documentado en
   el propio archivo (`:231-236`) y **ya ocurrió**: son las *"dos etapas con anclaje perdido"* del
   `evidencia-m3/3-preprod/REPORTE-2026-09-10-prueba-de-volumen.md`.

En ese estado, la guarda pasa, `retryStageMint` mintea de nuevo y quedan dos hilos. Después
`findLiveThread` resuelve la ambigüedad con `utxos.find(...)` (`packages/cardano/src/real.ts:313`),
es decir **el primero que aparezca** — que es literalmente *"preguntarnos cuál era el bueno"*, solo
que sin preguntar.

**La defensa que sí existe, y por qué no alcanza sola.** `repararHilosSospechosos`
(`apps/api/src/domain/reconcile.ts:264`, Capa 1) hace exactamente lo correcto: lee la cadena con
`findLiveThread`, compara el `state` del datum contra el `toState` declarado y repara el
bookkeeping sin firmar nada. Si eso corre **antes** del retry, `cabezaDelHilo` ya devuelve el
`outputRef` y la guarda funciona. **Pero el orden no está forzado**: viven en endpoints distintos
(`POST /evidence/reconcile` vs. el retry), y el retry no llama a reconcile ni lee la cadena.

**Qué tan grave es, sin dramatizar:**

- **No hay valor en riesgo** (D-021): el validador no custodia nada, y esto no permite sacar ADA.
- **Es detectable on-chain**: los dos mints quedan en la cadena y el supply total del asset name
  pasa a 2. Un verificador independiente **puede** notarlo. La invariante es *auditable* aunque no
  esté *forzada*.
- **No es un criterio del SOM** y no bloquea el Milestone 3.
- Pero es la garantía que el subárbol publica como su razón de existir, y hoy la publica de más.

**Qué hacer, en orden de costo.** La parte barata vale hoy; la cara es decisión de mainnet.

1. **Corregir la afirmación (hoy, gratis).** `contracts/CLAUDE.md` tiene que decir lo que el código
   garantiza: *"un token por transacción, y la unicidad por stage la sostiene el backend"*. Un
   documento que promete más que el código es el mismo modo de falla que el TXID simulado
   indistinguible del real: **no falla, miente.**
2. **Cerrar el camino alcanzable (chico, off-chain).** Que `retryStageMint` consulte
   `findLiveThread(refToHex(stage.id))` antes de mintear y devuelva `THREAD_ALREADY_OPEN` si la
   cadena ya tiene el hilo, en vez de confiar solo en la base. La capacidad ya existe en el puerto;
   es usarla en un lugar más. **Es el arreglo con mejor relación valor/riesgo, y lo recomiendo
   para esta tanda.**
3. **Cerrarlo on-chain (grande, y es diseño nuevo — no una línea).** Conviene decir con precisión
   por qué no es trivial: el patrón one-shot habitual parametriza la policy con un `OutputReference`
   semilla, pero eso da **un** mint para toda la policy, y acá se necesita uno **por stage** bajo la
   misma policy (el `spend` y el `mint` comparten validador y dirección). Las salidas reales son:
   - un **UTxO registro por proyecto** que el `mint` tenga que gastar y actualizar, llevando la
     lista de `stage_ref` ya acuñados — unicidad genuina, al precio de serializar los mints del
     proyecto; o
   - **derivar el asset name de un input consumido** (estilo CIP-68), que la unicidad la garantiza
     el ledger, pero rompe el diseño actual donde *asset name = id del stage* — que es justo lo que
     hace fácil la verificación independiente, y que **no se puede cambiar con hilos ya acuñados**
     (un NFT no se reacuña; ya está escrito en el `CLAUDE.md` del subárbol).

   Es una decisión 🟡/🔴 con trade-off real, y **no debería tomarse dentro del milestone.** Lo que
   corresponde es registrarla como decisión abierta para mainnet.

---

### C-02 · El `admin` es parámetro del script: no hay rotación ni recuperación de clave 🟠

`validator stage(admin: VerificationKeyHash)` — y el parámetro se aplica al compilar:

```
stage.stage.spend | params: ['admin'] | hash: 0a2571c121481939
stage.stage.mint  | params: ['admin'] | hash: 0a2571c121481939
```

`packages/cardano/src/blueprint.ts:69` hace `applyParamsToScript(validator.compiledCode,
[adminKeyHash])` y `:94` deriva `policyId = mintingPolicyToId(script)`. **La dirección del script y
el policy id son función de la clave del admin.**

La consecuencia, encadenada con el resto del diseño:

- `spend` exige `list.has(tx.extra_signatories, admin)` — **un** firmante, sin alternativa.
- **No hay burn** y el `spend` exige que el token quede en la misma dirección: el hilo no tiene
  salida.
- Por lo tanto, si `SERVICE_WALLET_PRIVATE_KEY` se pierde o se compromete, **todos los hilos
  existentes quedan congelados para siempre**: no se pueden avanzar, no se pueden cerrar, no se
  pueden quemar. Y los hilos nuevos nacen bajo **otro** policy id, así que la continuidad de la
  cadena de prueba se corta ahí: un stage a medio camino no se puede terminar, nunca.

Esto es más grave que las 2 ADA bloqueadas por etapa que D-057 ya acepta: eso es costo, esto es
**pérdida de la función del producto** para las obras en vuelo.

No es un bug —es una decisión de diseño que hoy no está tomada explícitamente ni documentada como
riesgo—, y para Preprod con datos de demo es perfectamente aceptable. **Pero pertenece al checklist
de mainnet**, que hoy dice *"runbook, habilitar la red, custodia de la clave"* y no menciona que la
clave es irreemplazable por construcción. Las opciones (multisig de M-de-N, o un segundo VKH de
recuperación en el datum o como parámetro) son todas 🔴 y cambian el script hash, así que hay que
decidirlas **antes** del primer mint en mainnet, no después.

**Lo que pido acá es una línea en `DECISIONS.md` y una en el checklist de mainnet**, no código.

---

### C-03 · "No hay burn" es invariante publicada, sin test propio 🟡

`contracts/CLAUDE.md` y el doc-comment de `MintAction` lo declaran como garantía de diseño:

> No hay `Retire`/burn a propósito. Quemar el thread token sería borrar la historia de un stage, y
> el punto entero del hilo es que ni el operador pueda hacer eso (D-008).

**La invariante se cumple** —lo verifiqué— pero se cumple *por consecuencia* del patrón
`[Pair(asset_name, 1)]`, que no matchea una cantidad negativa, y **no hay ningún test que la fije**.
La tabla de 30 puntos de rechazo del `CLAUDE.md` no la lista.

Sonda `tmp_mint_rejects_a_burn` (minteo de `-1`), marcada `fail`:

```
│ PASS [mem:  64.24 K, cpu:  19.96 M] tmp_mint_rejects_a_burn
│ · with traces
│ | the validator crashed / exited prematurely
│ x <expected> [Pair(asset_name, 1)] = dict.to_pairs(assets.tokens(tx.mint, policy_id))
```

Es exactamente el caso del criterio 2 del SOM y del ítem 2.3 de la Tanda 2: una garantía que se
sostenía *por lectura de código*, como pasaba con el `else` genérico antes del 2026-09-08. **El
arreglo es agregar ese test tal cual está arriba** (renombrado a `mint_rejects_a_burn`) y sumar la
fila a la tabla. Cuatro líneas, y la garantía pasa de argumento a evidencia.

---

### C-04 · `evidence_root` sin tope de largo para stages no críticos 🟢

`completion_evidence_ok` solo exige los 32 bytes cuando `validation_critical` es `True`; para el
resto devuelve `True` sin mirar el largo. Así que un stage no crítico puede completarse escribiendo
un `evidence_root` de largo arbitrario en el datum, aunque el comentario del campo diga
*"32 bytes cuando existe"*.

Sonda `tmp_non_critical_accepts_garbage_root` (root de 36 bytes, `PASS` = el validador lo acepta):

```
│ PASS [mem: 309.64 K, cpu: 108.46 M] tmp_non_critical_accepts_garbage_root
```

**Impacto real: bajo, y hay que decir por qué.** El backend no puede producirlo: `commitmentSchema`
en `packages/shared` acepta `""` o exactamente 64 hex, y `buildStageDatum` parsea con él. O sea que
**el espejo es más estricto que el validador**.

Pero eso es justamente el problema en miniatura: la garantía vive off-chain, y un verificador
independiente que lea solo el script no puede confiar en que `evidence_root` sea un SHA-256. El
arreglo es de una línea en `fsm.ak` — exigir siempre `""` o 32 bytes, con el requisito de los 32
cuando es crítico:

```aiken
let root_well_formed = bytearray.length(evidence_root) == 0 || bytearray.length(evidence_root) == commitment_length
```

**No cambia ninguna transacción válida de hoy** (el backend ya manda "" o 64 hex), así que es
compatible con los hilos vivos — pero cambia el script hash, con lo cual **solo se puede hacer
junto con cualquier otro cambio de `C-01`/`C-02`, nunca solo.** Anotado con esa condición.

---

### C-05 · La retención del token la sostiene la igualdad de valor, no el chequeo que parece sostenerla 🟢

Esto no es un bug: es una trampa para el próximo que edite el `spend`, y por eso va escrita.

El `spend` parece garantizar que el output de continuación conserva el token con esta línea:

```aiken
expect [_] = carrying_thread(tx.outputs, own_policy, old_datum.stage_ref)
```

Pero `carrying_thread` filtra por **payment credential**, no por la dirección completa, así que por
sí sola esa línea solo dice *"exactamente un output del script lleva el token"* — no *"el output de
continuación lo lleva"*. Lo que realmente ata el token al `continuing_output` es la línea de D-021:

```aiken
expect continuing_output.value == own_input.output.value
```

Como el input ya fue verificado con 1 unidad, la igualdad de valor **fuerza** al output de
continuación a llevarla, y entonces `carrying_thread` encontraría dos si alguien intentara mandar el
token a otro output del script (con otro stake credential, digamos). Las dos líneas juntas cierran;
cada una sola, no.

**Por qué importa:** el día que alguien quiera relajar la igualdad de valor por un motivo razonable
—permitir un *top-up* de min-ADA si el protocolo sube el mínimo, por ejemplo— la garantía de
retención del token se degrada en silencio a "algún output del script lo tiene", y el `spend`
seguiría compilando y pasando los 39 tests. Es el mismo patrón que el comentario de `cabezaDelHilo`
sobre el filtro `outputRef is not null`, que ya está documentado justamente así en `apps/api`.

**El arreglo es un comentario de tres líneas sobre la igualdad de valor**, diciendo que además de
D-021 sostiene la retención del token. Cero cambio de comportamiento, cero cambio de script hash.

---

### C-06 · `--property-coverage` no se usa 🟢

Los 82 tests son todos sobre valores fijos. `aiken check --property-coverage` existe y el
`CLAUDE.md` del subárbol lo nombra al explicar por qué la cobertura se demuestra con una tabla.

**Prioridad baja y conviene ser honesto sobre por qué:** la tabla de transiciones ya está probada
**exhaustivamente** (los 16 pares de 4×4), y ahí un property test no agregaría nada — no hay espacio
de entrada sin cubrir. El único lugar con espacio de entrada ancho de verdad es
`valid_datum_evolution`, donde una propiedad como *"si `to != Completed`, entonces `evidence_root` y
`completed_at` no cambian, para cualquier datum"* cubriría más que los 9 casos actuales.

No lo recomiendo dentro del milestone: es la definición de pulido, y el criterio 2 del SOM ya está
demostrado por la tabla.

---

## Lo que NO hay que tocar

Para que la auditoría no se lea como una lista de permisos:

- **No hay nada que reorganizar.** Dos archivos, 1387 líneas, un corte claro. Partirlo más sería
  peor.
- **No optimizar presupuesto.** Dos órdenes de magnitud de aire, medidos.
- **No agregar un validador ni un handler.** Ninguno de los 6 hallazgos lo pide, y la prohibición
  de la raíz aplica igual acá.
- **No "arreglar" que el validador no sepa de roles.** Es correcto y está justificado: todo lo firma
  el `admin` (D-058), y la autorización por rol es off-chain por diseño.

## Qué haría, en qué orden

| Orden | Qué | Costo | Cambia script hash |
|---|---|---|---|
| 1 | **`C-01` paso 1** — corregir la afirmación de `contracts/CLAUDE.md` | 10 min, solo `.md` | no |
| 2 | **`C-03`** — el test de burn + su fila en la tabla | ~15 min | no |
| 3 | **`C-05`** — el comentario sobre la igualdad de valor | 5 min | no |
| 4 | **`C-01` paso 2** — `retryStageMint` consulta `findLiveThread` antes de mintear | ~1 h, 🟡 | no |
| 5 | **`C-02`** — una línea en `DECISIONS.md` + el checklist de mainnet | 20 min, solo `.md` | no |
| 6 | `C-04` + `C-01` paso 3 | decisión de mainnet, 🟡/🔴 | **sí** |

Los cinco primeros no tocan el blueprint, así que no hay riesgo de invalidar hilos vivos. **El
orden no es por severidad: es por costo creciente y por lo que se puede hacer sin cambiar el script
hash**, que es la restricción dura acá (hay 180 eventos anclados en Preprod bajo el hash actual).

## Registro

Los hallazgos de esta auditoría **todavía no están transcritos a specs implementables**, a
diferencia de las series `SPEC-101`…`SPEC-110` y `SPEC-201`…`SPEC-215` que salieron de las
auditorías de frente y backend. Si se decide abrirlos, la serie que corresponde es `SPEC-3xx`, con
el mismo criterio de granularidad (acotadas e independientes) — y los ítems 1, 2, 3 y 5 de la tabla
de arriba entran cómodos en una sola spec de documentación + tests, porque ninguno toca código de
producción.
