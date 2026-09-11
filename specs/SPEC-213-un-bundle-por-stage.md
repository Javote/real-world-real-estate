# SPEC-213 — `EvidenceBundle` duplicado por stage: medir antes de decidir

> **Origen:** [`AUDITORIA-2026-09-11-calidad-del-backend.md`](AUDITORIA-2026-09-11-calidad-del-backend.md)
> §Anexo. Nivel 🟡 — puede terminar en migración sobre base desplegada. **Independiente.**
> No toca ningún criterio del SOM.
>
> **Empieza con una medición, no con un cambio.** Es la única spec de la serie cuyo primer paso puede
> concluir "no hay nada que hacer" — y eso sería un resultado, no un fracaso.

## El problema

`EvidenceBundle` **no tiene índice único por `stageId`, y producción ya tuvo 4 bundles en un stage.**
Lo dice el propio comentario de `crearBundle`:

> *"el stage 'Terminaciones' de `torre-a` quedó con 3 evidencias, **4 bundles y 3 roots distintos**"*

La idempotencia por contenido que se agregó impide bundles **nuevos** duplicados. **Las filas viejas
siguen ahí**, y **tres queries las unen con `leftJoin`**:

| Query | Qué pasa con un stage de 4 bundles |
|---|---|
| `certifier.routes.ts:225` | filas duplicadas en la vista del certificador |
| `investor.routes.ts:189` | ídem del lado del investor |
| `domain/dossier.ts:59` | **la que el comentario no menciona**: duplica artefactos de tipo `stage`, y eso cambia el `masterHash` **y** el `completeness` |

La tercera es la que importa: el `masterHash` es lo que el escribano firma y lo que se ancla. Un
artefacto contado dos veces produce un hash distinto del que correspondía.

## Paso 1 — medir producción

```sql
SELECT stageId, count(*) FROM EvidenceBundle GROUP BY stageId HAVING count(*) > 1;
```

Y para cada stage que aparezca: cuántos roots distintos, cuáles tienen `OnChainEvent`, y si alguno
participa de un dossier firmado.

**El resultado decide la spec:**

- **Sin filas** → se cierra con el índice único como prevención (paso 2) y nada más.
- **Con filas** → hay que decidir cuál bundle sobrevive, y el criterio no puede ser arbitrario: gana
  el que tenga anclaje confirmado; entre varios anclados, **es una decisión del dueño**, porque
  significa elegir cuál de dos afirmaciones ancladas vale.

## Paso 2 — el índice, y los tres `leftJoin`

1. `CREATE UNIQUE INDEX EvidenceBundle_stageId_key ON EvidenceBundle (stageId)` —el mismo argumento
   que [`SPEC-202`](SPEC-202-un-dossier-por-unidad.md): la restricción de la base es la única
   respuesta verdadera a una carrera.
2. Los tres `leftJoin` **no pueden depender de que el índice exista**: un `leftJoin` que asume
   unicidad y no la declara es la forma en que este bug llegó hasta el dossier. Se revisan los tres, y
   el de `dossier.ts` lleva test propio sobre el `masterHash`.

## Invariantes

1. **Un stage tiene como máximo un `EvidenceBundle`.**
2. **El `masterHash` de un dossier no depende de cuántas filas devuelva un join.** Mismo stage, mismos
   artefactos, mismo hash.
3. **Ningún bundle anclado se borra sin decisión escrita del dueño.** Un `OnChainEvent` apuntándolo es
   una afirmación pública: borrar la fila de atrás la deja huérfana (es lo mismo que
   [`SPEC-210`](SPEC-210-borrar-evidencia-anclada.md) protege del otro lado).
4. La migración es idempotente (regla 8).

## Casos borde (definen los tests)

| Caso | Esperado |
|---|---|
| Stage con 1 bundle | todo igual que hoy |
| `compileDossier` sobre un stage con bundles duplicados (antes de la limpieza) | el test **reproduce** el `masterHash` inflado: es la evidencia de que el hallazgo es real |
| Dos `crearBundle` concurrentes sobre el mismo stage | uno gana, el otro relee; un solo root |
| Producción limpia | la migración corre sin borrar nada |

## Preguntas abiertas

- **¿Cuál gana entre dos bundles anclados?** Sin dueño todavía. Si la medición del paso 1 no devuelve
  ese caso, la pregunta se cierra sin responderla.
