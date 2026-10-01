# SPEC-302 — "No hay burn" pasa de argumento a evidencia

> **Origen:** [`AUDITORIA-2026-09-11-calidad-de-contracts.md`](AUDITORIA-2026-09-11-calidad-de-contracts.md)
> §C-03. Nivel 🟡 por vivir en `contracts/`, aunque **no toca el validador**: agrega un test y una
> fila. **No cambia el script hash.** **Independiente.**

## El problema, en una frase

`contracts/CLAUDE.md` y el doc-comment de `MintAction` declaran como garantía de diseño que
**quemar el thread token es imposible** —*"el punto entero del hilo es que ni el operador pueda
hacer eso (D-008)"*— y **no hay ningún test que lo fije**. La tabla de 30 puntos de rechazo del
`CLAUDE.md` del subárbol no lo lista.

La invariante **se cumple**: la auditoría lo verificó. Pero se cumple *por consecuencia* del patrón
`[Pair(asset_name, 1)]`, que no matchea una cantidad negativa — no porque alguien lo haya escrito
como regla. Es exactamente el caso del `else` genérico antes del 2026-09-08: una garantía que se
sostenía por lectura de código.

## Qué se cambia

| | Dónde | Qué |
|---|---|---|
| 1 | `contracts/validators/stage.ak` | test `mint_rejects_a_burn`, marcado `fail`, junto a los otros `mint_rejects_*` |
| 2 | `contracts/CLAUDE.md` | la fila en la tabla de puntos de rechazo, y el conteo de tests |

El test es el de la sonda de la auditoría, que ya corrió en verde:

```aiken
test mint_rejects_a_burn() fail {
  let initial = datum_at(Pending, True)
  stage.mint(
    admin_key,
    Init,
    script_hash,
    mint_tx(
      assets.from_asset(script_hash, stage_ref, -1),
      [script_output_with(InlineDatum(initial), locked_value())],
    ),
  )
}
```

Salida real de la sonda, para que no haya que descubrir de nuevo por qué rechaza:

```
│ PASS [mem:  64.24 K, cpu:  19.96 M] tmp_mint_rejects_a_burn
│ x <expected> [Pair(asset_name, 1)] = dict.to_pairs(assets.tokens(tx.mint, policy_id))
```

## Invariantes

1. **Quemar el thread token está rechazado**, y hay un test que lo dice.
2. El conteo de tests del `CLAUDE.md` del subárbol **coincide con `aiken check`** después del cambio
   (hoy son 82: 43 + 39).
3. **El script hash no cambia**: agregar un test no toca el código compilado, así que `plutus.json`
   queda idéntico y el candado de CI (`git diff --exit-code plutus.json`) pasa sin regenerar nada.

## Casos borde (definen los tests)

Es un test. El único caso adyacente que vale nombrar:

| Caso | Esperado |
|---|---|
| Minteo de `-1` del propio asset name | rechazado (este test) |
| Minteo de `-1` de **otro** asset name de la misma policy | rechazado por el mismo patrón; **no** se agrega un segundo test, es el mismo camino |

## Verificación

`aiken check` en verde con un test más, y `git diff --exit-code plutus.json` limpio.
