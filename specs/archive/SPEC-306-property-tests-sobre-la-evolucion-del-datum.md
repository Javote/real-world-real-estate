# SPEC-306 — Una propiedad sobre `valid_datum_evolution`

> **Origen:** [`AUDITORIA-2026-09-11-calidad-de-contracts.md`](AUDITORIA-2026-09-11-calidad-de-contracts.md)
> §C-06. Nivel 🟢. **Independiente.** **No cambia el script hash.**
>
> **Es la de menor valor de la serie y la auditoría no la recomienda dentro del milestone.** Se
> escribe para que el registro esté completo, no porque haga falta. Si hay que descartar una, es
> esta.

## El problema, en una frase

Los 82 tests de `contracts/` son todos sobre **valores fijos**. `aiken check --property-coverage`
existe —el `CLAUDE.md` del subárbol lo nombra justamente al explicar por qué la cobertura se
demuestra con una tabla y no con un porcentaje— y no se usa.

**Y en la mayor parte del subárbol no haría falta.** La tabla de transiciones ya está probada
**exhaustivamente**: los 16 pares de 4×4, cada uno con su test. Ahí un property test no agrega nada,
porque no hay espacio de entrada sin cubrir.

El único lugar con espacio de entrada ancho de verdad es `valid_datum_evolution`, que hoy tiene 9
casos sobre un dominio de (estado × estado × `Option<Completion>` × datum arbitrario).

## Qué se cambia

Una propiedad en `lib/propnexus/fsm.ak`, la que más carga tiene:

> **Si la transición no va a `Completed`, entonces `evidence_root` y `completed_at` no cambian** —
> para cualquier datum de entrada.

Es la invariante que sostiene que la evidencia no se reescribe por el costado, y hoy la cubren dos
tests puntuales (`t_evolution_rejects_evidence_rewrite_on_flag` y
`t_evolution_rejects_completed_at_rewrite_on_flag`) sobre un datum cada uno.

Una segunda, si la primera resulta barata:

> **`valid_datum_evolution` nunca acepta una transición que `valid_transition` rechaza** — o sea que
> la tabla no se puede eludir por la puerta del datum.

**Dos propiedades, no más.** El objetivo no es coverage: es cubrir el único lugar donde el valor
fijo deja dudas.

## Invariantes

1. **Las propiedades no reemplazan ningún test existente.** Los 16 pares exhaustivos se quedan: son
   la evidencia del criterio 2 del SOM y un property test es peor evidencia para eso, porque no
   demuestra que no falta un par.
2. **El script hash no cambia**: son tests.
3. Si una propiedad encuentra un contraejemplo, **se agrega como test de valor fijo** además de
   arreglar la causa — un contraejemplo que solo vive en el generador se pierde.

## Casos borde (definen los tests)

No aplica: esta spec **son** tests. Lo que hay que decidir al implementarla es el generador de
`StageDatum`, y ahí el único criterio es que **genere refs y roots de largos variados**, incluidos 0
y 32 — si el generador solo produce datums bien formados, la propiedad no prueba nada.

## Verificación

`aiken check --property-coverage` en verde, y el conteo de tests del `CLAUDE.md` del subárbol
actualizado.
