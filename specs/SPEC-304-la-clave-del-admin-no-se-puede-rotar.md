# SPEC-304 — La clave del `admin` es irreemplazable por construcción, y hay que decirlo

> **Origen:** [`AUDITORIA-2026-09-11-calidad-de-contracts.md`](AUDITORIA-2026-09-11-calidad-de-contracts.md)
> §C-02. Nivel 🟢 (es documentación). **Independiente.** **No es código**: lo que falta es una
> decisión escrita y una línea en el checklist de mainnet. Cambiar el diseño es 🔴 y no entra acá.

## El problema, medido

`validator stage(admin: VerificationKeyHash)` — el firmante es un **parámetro del script**, y el
parámetro se aplica al compilar:

```
stage.stage.spend | params: ['admin'] | hash: 0a2571c121481939
stage.stage.mint  | params: ['admin'] | hash: 0a2571c121481939
```

`packages/cardano/src/blueprint.ts:69` hace `applyParamsToScript(validator.compiledCode,
[adminKeyHash])` y `:94` deriva `policyId = mintingPolicyToId(script)`. **La dirección del script y
el policy id son función de la clave del admin.**

Encadenado con el resto del diseño:

- `spend` exige `list.has(tx.extra_signatories, admin)` — **un** firmante, sin alternativa.
- **No hay burn** y el `spend` exige que el token quede en la misma dirección: el hilo no tiene
  salida.
- Por lo tanto, si `SERVICE_WALLET_PRIVATE_KEY` se pierde o se compromete, **todos los hilos
  existentes quedan congelados para siempre**: no se pueden avanzar, ni cerrar, ni quemar. Y los
  hilos nuevos nacen bajo **otro** policy id, así que la continuidad de la cadena de prueba se corta
  ahí: **un stage a medio camino no se puede terminar, nunca.**

Es más grave que las 2 ADA bloqueadas por etapa que D-057 ya acepta: eso es **costo**, esto es
**pérdida de la función del producto** para las obras en vuelo.

**No es un bug.** Es una decisión de diseño razonable —la impone D-058, que sale del whitepaper
§System Overview— que hoy **no está tomada explícitamente ni registrada como riesgo**. Para Preprod
con datos de demo es perfectamente aceptable.

## Qué se cambia

| | Dónde | Qué |
|---|---|---|
| 1 | `DECISIONS.md` | decisión nueva (la próxima libre, hoy `D-094`): **la clave del `admin` no es rotable** — es parámetro del script, así que rotarla cambia el policy id y abandona los hilos vivos. Con la consecuencia escrita, no solo el hecho |
| 2 | `CLAUDE.md` raíz · §Estado, ítem 1 (Mainnet) | el checklist dice hoy *"runbook, habilitar la red, custodia de la clave"*. Sumar que **la clave es irreemplazable por construcción**, y que por eso la custodia no es una tarea de operaciones sino un requisito de diseño |
| 3 | `contracts/CLAUDE.md` · §Estado y deuda | la misma consecuencia, del lado del subárbol que la causa |

## Las opciones, para que la decisión de mainnet no arranque de cero

**Ninguna se implementa en esta spec.** Se registran porque todas cambian el script hash, y por eso
hay que elegir **antes del primer mint en mainnet**, no después:

| Opción | Qué implica |
|---|---|
| **Dejarlo así** | Aceptar el riesgo explícitamente, y que la custodia de la clave sea el control. Es lo que hay hoy, y es defendible si la custodia está a la altura |
| **Multisig M-de-N** | `admin` pasa de un VKH a una lista con umbral. Cambia el `spend`, el `mint` y el armado de la tx en `packages/cardano`. 🔴 |
| **Segundo VKH de recuperación** | Un `recovery` como parámetro además de `admin`, que pueda firmar solo transiciones. Más chico que el multisig, y ya alcanza para no perder los hilos. 🔴 |

La comparación honesta es entre la primera y la tercera: el multisig resuelve además el compromiso
de la clave (no solo la pérdida), pero es el cambio más grande y hoy **no hay valor en riesgo**
(D-021) que lo justifique.

## Invariantes

1. **La consecuencia está escrita donde alguien la va a leer antes de mainnet**, no solo en una
   auditoría.
2. **La decisión dice qué se decidió, no solo qué pasa**: si se elige dejarlo así, eso es la
   decisión y queda firmada.
3. **Nada cambia de comportamiento.** Esta spec no toca código ni el script.
4. La decisión **no contradice D-058** (un solo firmante, ratificado por el dueño): la extiende con
   la consecuencia que D-058 no nombra.

## Verificación

No hay test: es prosa. Lo que se comprueba es que las tres referencias del punto "Qué se cambia"
digan lo mismo —el chequeo de contradicción entre documentos de la raíz— y que el commit sea
solo-`.md`, con lo cual aplica la excepción de `verify:all`.
