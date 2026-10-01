# SPEC-303 — Escribir qué sostiene la igualdad de valor en el `spend`

> **Origen:** [`AUDITORIA-2026-09-11-calidad-de-contracts.md`](AUDITORIA-2026-09-11-calidad-de-contracts.md)
> §C-05. Nivel 🟢 (comentario). **Cero cambio de comportamiento, cero cambio de script hash.**
> **Independiente.**

## El problema, en una frase

No es un bug: es una trampa para el próximo que edite el `spend`. La línea que **parece** garantizar
que el output de continuación conserva el thread token es esta:

```aiken
expect [_] = carrying_thread(tx.outputs, own_policy, old_datum.stage_ref)
```

Pero `carrying_thread` filtra por **payment credential**, no por la dirección completa, así que por
sí sola solo dice *"exactamente un output del script lleva el token"* — no *"el output de
continuación lo lleva"*. Lo que realmente ata el token al `continuing_output` es la línea de D-021:

```aiken
expect continuing_output.value == own_input.output.value
```

Como el input ya fue verificado con 1 unidad, la igualdad de valor **fuerza** al output de
continuación a llevarla, y entonces `carrying_thread` encontraría **dos** si alguien intentara mandar
el token a otro output del script con otro stake credential. Las dos líneas juntas cierran; cada una
sola, no.

**Por qué importa:** el día que alguien quiera relajar la igualdad de valor por un motivo razonable
—permitir un *top-up* de min-ADA si el protocolo sube el mínimo— la garantía de retención del token
se degrada en silencio a *"algún output del script lo tiene"*, y el `spend` **seguiría compilando y
pasando los 39 tests**.

## Qué se cambia

Un comentario de tres líneas sobre `expect continuing_output.value == own_input.output.value`
(`contracts/validators/stage.ak:115`), diciendo que además de sostener D-021 **sostiene la retención
del thread token**, y que relajarla exige fortalecer `carrying_thread` para que compare la dirección
completa en el mismo commit.

Es el mismo patrón que el comentario de `cabezaDelHilo` sobre el filtro `outputRef is not null`
(`apps/api/src/domain/stage-transition.ts:48-54`), que ya está escrito exactamente así y por el
mismo motivo: avisarle al que "simplifique" que hay algo colgando de ahí.

## Invariantes

1. **El comportamiento no cambia.** Es un comentario.
2. **`plutus.json` no cambia** — y conviene confirmarlo, porque es la forma de comprobar que no se
   tocó nada más por accidente.
3. El comentario **nombra la condición para relajar la regla**, no solo la prohíbe: si alguien
   necesita el top-up, la spec de ese cambio ya sabe qué tiene que hacer.

## Verificación

`aiken fmt --check` y `aiken check` en verde, y `git diff --exit-code plutus.json` limpio — que acá
es la prueba de que el cambio fue solo prosa.
