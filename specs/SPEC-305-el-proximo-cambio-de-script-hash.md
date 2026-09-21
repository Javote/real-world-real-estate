# SPEC-305 — El próximo cambio de script hash: unicidad del hilo on-chain y el tope de `evidence_root`

> **Origen:** [`AUDITORIA-2026-09-11-calidad-de-contracts.md`](AUDITORIA-2026-09-11-calidad-de-contracts.md)
> §C-01 paso 3 y §C-04. Nivel 🟡/🔴. **Independiente de las otras cuatro**, y la única de la serie
> que **cambia el script hash**. No toca ningún criterio del SOM.
>
> **Es deliberadamente la spec más larga de la serie, y trae dos cambios en vez de uno.** No es
> descuido: el script hash es la restricción dura de este subárbol, y **todo cambio al validador
> tiene que viajar en el mismo bump**. Partirla en "unicidad" y "tope del root" produciría dos
> specs que no se pueden implementar por separado sin pagar dos veces el costo más caro del
> cambio — exactamente el quilombo que separar por tamaño en vez de por concern provoca.
>
> **Es decisión de mainnet y no debería tomarse dentro del Milestone 3.** Lo urgente de C-01 —que la
> afirmación publicada sea verdadera y que el backend no mintee dos veces— ya está resuelto sin
> tocar el script en [`SPEC-301`](SPEC-301-unicidad-del-hilo-no-depende-de-la-base.md).

## Por qué el script hash es la restricción

`plutus.json` tiene hoy el hash `0a2571c121481939…`, y **bajo ese hash hay 180 eventos anclados en
Preprod** ([`evidencia-m3/3-preprod/EVIDENCIA-2026-09-11-lista-formal-de-txids.md`](evidencia-m3/3-preprod/EVIDENCIA-2026-09-11-lista-formal-de-txids.md)).
Cualquier cambio al código compilado —una línea en `fsm.ak` alcanza— produce otro hash, y con él:

- **otra dirección de script** y **otro policy id** (los dos derivan del hash, ver
  [`SPEC-304`](SPEC-304-la-clave-del-admin-no-se-puede-rotar.md));
- los hilos vivos **siguen siendo gastables, pero solo con el script viejo**. No se rompen: dejan de
  estar en la dirección que el backend usa para los nuevos;
- el corpus a verificar **se parte en dos hashes**, y quien verifique de forma independiente tiene
  que saber que hay dos.

**Lo bueno: el plumbing ya lo permite.** `loadBlueprint(blueprintPath?)` toma un path opcional y
`stageScriptRefs(adminKeyHash, network, blueprint)` recibe el blueprint **inyectado**, no
hardcodeado (`packages/cardano/src/blueprint.ts:52,61`). Sostener dos versiones es cargar dos
blueprints. **Lo que no existe es la lógica de selección**: qué script usar para qué hilo. Eso es
trabajo nuevo de esta spec, y es la parte que hay que presupuestar.

## Parte A — Unicidad del hilo, on-chain

### El problema

`mint` garantiza *un token por transacción*, no *uno por stage*: no mira `tx.inputs`, así que una
segunda tx re-acuña el mismo asset name. Reproducido en la auditoría (`tmp_mint_is_not_one_shot`, las
dos llamadas dan `True`). El detalle completo y el camino alcanzable desde el backend están en
[`SPEC-301`](SPEC-301-unicidad-del-hilo-no-depende-de-la-base.md); acá interesa solo cerrarlo en el
validador.

### Por qué el patrón habitual no sirve

El one-shot canónico parametriza la policy con un `OutputReference` semilla y exige consumirlo. Eso
da **un** mint para toda la policy. Acá se necesita **uno por stage** bajo la **misma** policy,
porque `spend` y `mint` comparten validador y dirección. **El patrón estándar no aplica**, y por eso
esto es diseño y no un parche.

### Las dos salidas reales

| Opción | Cómo | Costo |
|---|---|---|
| **A1 · UTxO registro por proyecto** | un UTxO que el `mint` tiene que **gastar y actualizar**, llevando la lista de `stage_ref` ya acuñados | Unicidad **genuina y trustless**. Serializa los mints de un proyecto (un UTxO, una tx a la vez) y agrega un segundo datum que mantener. Es el cambio más grande de todo el subárbol |
| **A2 · Asset name derivado de un input consumido** | estilo CIP-68: `asset_name = hash(outputRef consumido)`. La unicidad la garantiza el ledger, porque un UTxO se gasta una sola vez | Más chico on-chain, **pero rompe `asset name = id del stage`**, que es justo lo que hace fácil la verificación independiente: hoy alguien con el id del stage encuentra el hilo. Con A2 hace falta una tabla de traducción — y el `CLAUDE.md` del subárbol ya declara que el criterio **no se puede cambiar con hilos ya acuñados** |

**Recomendación: A1**, y solo si la unicidad tiene que ser trustless de verdad. A2 compra menos
código on-chain al precio de la propiedad que hace verificable al producto, que es el peor
intercambio posible acá.

**Y la tercera opción es legítima: no hacer ninguna.** Con `SPEC-301` aplicada, el camino alcanzable
está cerrado, no hay valor en riesgo (D-021) y **el duplicado es detectable on-chain** (el supply
del asset name pasa a 2). Dejarlo así con la afirmación corregida es una postura defendible; lo que
no es defendible es el estado de hoy, donde el documento promete lo que el código no da.

## Parte B — `evidence_root` bien formado siempre (rider)

`completion_evidence_ok` solo exige los 32 bytes cuando `validation_critical` es `True`; para el
resto devuelve `True` sin mirar el largo. Un stage no crítico puede completarse con un
`evidence_root` de largo arbitrario en el datum, aunque el comentario del campo diga *"32 bytes
cuando existe"*. Reproducido con un root de 36 bytes
(`tmp_non_critical_accepts_garbage_root`, `PASS` = aceptado).

**El backend no puede producirlo** —`commitmentSchema` acepta `""` o exactamente 64 hex, y
`buildStageDatum` parsea con él—, así que **el espejo es más estricto que el validador**. Pero eso
es el problema en miniatura: la garantía vive off-chain y un verificador que lea solo el script no
puede confiar en que `evidence_root` sea un SHA-256.

Una línea en `fsm.ak`, dentro de `valid_datum_evolution`:

```aiken
let root_well_formed =
  bytearray.length(evidence_root) == 0 || bytearray.length(evidence_root) == commitment_length
```

**No invalida ninguna transacción válida de hoy** (el backend ya manda `""` o 64 hex). Por eso es un
rider: el cambio vale, y su costo real es el bump del hash — que esta spec ya paga por la Parte A.

## Invariantes

1. **Un `stage_ref` tiene a lo sumo un hilo**, y lo garantiza el validador, no el backend (Parte A,
   si se toma A1).
2. **`evidence_root` es `""` o 32 bytes**, siempre, crítico o no (Parte B).
3. **Ningún hilo vivo queda inaccesible.** El backend sabe gastar los hilos del hash viejo mientras
   existan, o se declara explícitamente que se abandonan — pero no se descubre después.
4. **La tabla de transiciones sigue siendo una sola** (D-020, regla 9): si algo de esto toca la FSM,
   `packages/shared` cambia en el mismo commit. Ninguna de las dos partes la toca.
5. **El espejo de `packages/shared` se revisa contra el validador nuevo**, no se asume.
6. **`plutus.json` se commitea y el CI lo verifica** (regla 11). El bump es explícito en el commit,
   nunca un efecto secundario.
7. **Los valores dorados de CBOR se recalculan si cambia el datum o el redeemer** — y los dos lados
   (`fsm.ak` y `packages/cardano/src/codec.test.ts`) en el mismo commit. La Parte B no los cambia;
   A1 **sí** agrega un datum nuevo, que necesita su propio valor dorado de los dos lados.

## Casos borde (definen los tests)

| Caso | Esperado |
|---|---|
| Segundo mint del mismo `stage_ref`, en otra tx | **rechazado** por el validador (A1) — es la sonda `tmp_mint_is_not_one_shot` al revés: pasa a `fail` |
| Mint de un `stage_ref` nuevo en el mismo proyecto | aceptado, con el registro actualizado (A1) |
| Dos mints del mismo proyecto en la misma tx | rechazado: el registro es un solo UTxO (A1) |
| Completar no crítico con root de largo ≠ 0 y ≠ 32 | **rechazado** (B) — la sonda `tmp_non_critical_accepts_garbage_root` pasa a `fail` |
| Completar no crítico con root vacío | aceptado, como hoy |
| Completar crítico con root de 32 bytes | aceptado, como hoy |
| Avanzar un hilo acuñado con el **hash viejo** | gastable con el script viejo, o abandono declarado (invariante 3) |

## Verificación

`aiken check` con las dos sondas de la auditoría convertidas en tests permanentes `fail`, más los
casos del registro si se toma A1. `aiken build` + `git diff` **debe** mostrar `plutus.json`
cambiado: acá el diff limpio sería la señal de que no se cambió nada.

Y antes de mainnet, el camino completo contra un nodo real: `pnpm --filter @plataforma/cardano
test:yaci`, que es lo que ya cubre el anclaje real, más una corrida de la prueba de volumen sobre el
hash nuevo. **Un cambio de script hash no se entrega con tests de unidad solamente.**
