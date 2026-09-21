# SPEC-301 — La unicidad del hilo deja de depender de la base

> **Origen:** [`AUDITORIA-2026-09-11-calidad-de-contracts.md`](AUDITORIA-2026-09-11-calidad-de-contracts.md)
> §C-01, pasos 1 y 2. Nivel 🟡 (camino de anclaje). **Independiente.** No toca ningún criterio del
> SOM y **no cambia el script hash** — cerrar el agujero *on-chain* es otra cosa y vive en
> [`SPEC-305`](SPEC-305-el-proximo-cambio-de-script-hash.md).

## El problema, reproducido

`contracts/CLAUDE.md` afirma que `mint` *"acuña **exactamente uno** por stage"*. Lo que el
validador garantiza es **uno por transacción**:

```aiken
expect [Pair(asset_name, 1)] = dict.to_pairs(assets.tokens(tx.mint, policy_id))
```

Es un predicado sobre **esta** tx. El handler `mint` **no mira `tx.inputs` en ninguna de sus 19
líneas**, así que nada ata la acuñación a un UTxO consumido y una segunda transacción vuelve a
acuñar el mismo asset name. Sonda `tmp_mint_is_not_one_shot` de la auditoría —dos `stage.mint` con
el mismo `stage_ref` y distinto input de semilla, exigiendo que las dos den `True`—:

```
│ PASS [mem: 302.61 K, cpu:  96.22 M] tmp_mint_is_not_one_shot
```

**Y el backend tiene el camino construido para hacerlo sin querer:**

1. `POST /projects/:id/stages/:stageId/retry-anchor` → `retryStageMint`
   (`apps/api/src/domain/stage-transition.ts:479`).
2. Su única guarda contra el doble mint es `cabezaDelHilo(stage.id) !== null` → `THREAD_ALREADY_OPEN`.
3. **`cabezaDelHilo` es una consulta a la base y nada más** (`:209`): lee `OnChainEvent.outputRef` y
   **nunca toca la cadena**.
4. El estado "`outputRef` en `null` con el hilo vivo on-chain" está documentado en el propio archivo
   (`:231-236`) y **ya ocurrió**: son las dos etapas con anclaje perdido del
   [`evidencia-m3/3-preprod/REPORTE-2026-09-10-prueba-de-volumen.md`](evidencia-m3/3-preprod/REPORTE-2026-09-10-prueba-de-volumen.md).

En ese estado la guarda pasa, se mintea de nuevo y quedan **dos hilos vivos con el mismo asset
name**, cada uno capaz de avanzar por su cuenta a estados distintos. Después `findLiveThread`
desempata con `utxos.find(...)` (`packages/cardano/src/real.ts:313`) — **el primero que aparezca**,
que es literalmente *"preguntarnos cuál era el bueno"* sin preguntar.

No hay valor en riesgo (D-021) y el duplicado es detectable on-chain (el supply del asset name pasa
a 2). Lo que no se sostiene es la afirmación publicada.

## Qué se cambia

| | Dónde | Qué |
|---|---|---|
| 1 | `domain/stage-transition.ts` · `retryStageMint` | antes de mintear, consultar `anchorPort().findLiveThread(refToHex(stage.id))`; si la cadena ya tiene el hilo, **no mintear** |
| 2 | `domain/stage-transition.ts` · `RetryMintFailure` | código nuevo `THREAD_ALREADY_ON_CHAIN` (409), distinto de `THREAD_ALREADY_OPEN` |
| 3 | `contracts/CLAUDE.md` | la afirmación dice lo que el código garantiza: **un token por transacción**, y la unicidad por stage la sostiene el backend |

**Por qué dos códigos y no uno.** `THREAD_ALREADY_OPEN` significa *"la base ya sabe del hilo"* —no
hay nada que hacer—. `THREAD_ALREADY_ON_CHAIN` significa *"la cadena tiene el hilo y la base no"*,
que **es un caso reparable** y le dice al operador qué correr: `POST /evidence/reconcile`. Un solo
código los confunde y el operador no sabe si tiene trabajo pendiente.

**La capacidad ya existe**: `findLiveThread` está en el puerto, con las tres implementaciones
(simulado, real, disabled). Es usarla en un lugar más.

## Lo que esta spec NO hace

**No repara el bookkeeping desde el retry.** Es tentador —el dato ya está leído— pero esa lógica es
`repararHilosSospechosos` (`apps/api/src/domain/reconcile.ts:264`), que además compara el `state`
del datum contra el `toState` declarado antes de escribir. Duplicarla acá es el mismo argumento que
su propio doc-comment usa para no repetir la promoción a `Confirmed`: **la misma pregunta en dos
lugares diverge**. El retry detecta y nombra; reconcile repara.

**No toca el validador.** El agujero on-chain sigue abierto después de esta spec, a propósito:
cerrarlo cambia el script hash y es decisión de mainnet ([`SPEC-305`](SPEC-305-el-proximo-cambio-de-script-hash.md)).

**No corre reconcile automáticamente.** Sigue siendo un endpoint que alguien dispara.

## Invariantes

1. **`retryStageMint` no mintea si la cadena ya tiene un hilo vivo para ese `stage_ref`**, sin
   importar qué diga `OnChainEvent`.
2. **La base deja de ser la única fuente de la decisión de mintear**: la cadena manda, porque es la
   que tiene el token.
3. **El 409 distingue los dos casos** (`THREAD_ALREADY_OPEN` vs. `THREAD_ALREADY_ON_CHAIN`) y el
   segundo nombra el remedio.
4. **Si el puerto falla al consultar, no se mintea.** Fail-closed: un `findLiveThread` que tira
   error no habilita el mint — acuñar de más es irreversible (no hay burn) y no acuñar no pierde
   nada, se reintenta.
5. **`mode === "disabled"` sigue funcionando como hoy**: no hay cadena que consultar y el retry no
   tiene sentido, igual que en `repararHilosSospechosos`.
6. **La documentación no promete más que el código** (punto 3). Un documento que afirma de más es el
   mismo modo de falla que el TXID simulado indistinguible del real: no falla, miente.

## Casos borde (definen los tests)

| Caso | Esperado |
|---|---|
| Stage `Pending`, sin `outputRef` en la base, **sin** hilo en la cadena | mintea (el caso legítimo de hoy) |
| Stage `Pending`, sin `outputRef` en la base, **con** hilo en la cadena | 409 `THREAD_ALREADY_ON_CHAIN`, **cero** transacciones enviadas |
| Stage `Pending`, **con** `outputRef` en la base | 409 `THREAD_ALREADY_OPEN`, sin consultar la cadena |
| `findLiveThread` tira error | falla sin mintear (invariante 4); el stage queda como estaba |
| Stage que ya avanzó off-chain | 409 `STAGE_ALREADY_ADVANCED`, como hoy |
| Puerto `disabled` | como hoy |
| Dos `retry-anchor` concurrentes sobre el mismo stage | **a lo sumo un** mint |

## Verificación

Los casos de arriba como tests en `apps/api/test/`, con el puerto simulado —que ya implementa
`findLiveThread` (`packages/cardano/src/simulated.ts:152`)—, **incluido el concurrente**: dos
`retry-anchor` en `Promise.all`, misma forma que la reproducción de `SPEC-201`.

El caso interesante se arma sembrando la asimetría a mano: abrir el hilo con el puerto y después
poner `OnChainEvent.outputRef` en `null`, que es exactamente el estado que dejó la prueba de
volumen.
