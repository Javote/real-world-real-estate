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

## Cerrada 2026-09-19 — la invariante 1 estaba mal escrita, corregida al implementar

**Medido (paso 1):** "Terminaciones" de `torre-a` era el único caso en toda la base — 4 bundles, 3
roots. Los otros 32 stages con bundle tenían exactamente uno. Sí hubo que responder la pregunta
abierta: de los dos roots anclados (`c664368c…`, dos veces, y otro par de roots más viejos), gana
`c664368c…` porque es el que el datum de la transición `Completed` dejó grabado — el estado final
real, no un snapshot intermedio. Detalle completo, con las 4 filas y sus 6 `OnChainEvent`:
`specs/evidence/evidence-bundle-torre-a-terminaciones-2026-09-18.json`.

**La invariante 1 ("un stage tiene como máximo un `EvidenceBundle`") es falsa, y se comprobó
implementándola:** `UNIQUE(stageId)` rechazaba con 409 la segunda subida de evidencia de cualquier
stage, porque `crearBundle` corre en cada subida —no solo al completar— y cada subida antes de
completar escribe, a propósito, un bundle con un root distinto. Rompía
`test/evidence-upload.test.ts` → *"un stage Observed SÍ acepta evidencia (remediación)"*, que es
comportamiento correcto. El hallazgo real de producción era más angosto: **dos bundles con el MISMO
root para el MISMO stage** — la fila gemela de la doble-llamada a `crearBundle`, no la acumulación
legítima de evidencia. `EvidenceBundle_stageId_commitmentHash_key` (`UNIQUE(stageId,
commitmentHash)`, `migrations/0007`) cierra eso sin romper la subida normal.

**Consecuencia para la invariante 2, la que de verdad importa:** ningún índice único hace que un
stage tenga un solo bundle a lo largo de su vida — legítimamente puede tener varios. Un `leftJoin`
directo a `EvidenceBundle` sigue multiplicando filas por stage con solo 2+ subidas de evidencia
antes de completar, sin que haga falta ningún bug. Lo que cierra la invariante 2 de verdad es
`ultimoBundlePorStage` (`domain/stage-transition.ts`, mismo criterio de "vigente" que ya usaba
`rootDelStage`: el de `createdAt` más reciente) — los tres `leftJoin` (`dossier.ts`,
`certifier.routes.ts`, `investor.routes.ts`) lo usan en vez de un `leftJoin` directo.

**La lección:** un hallazgo de auditoría describe bien el síntoma (4 bundles, 3 roots) pero infiere
mal la causa si no se ejecuta el código alrededor. "Un stage tiene como máximo un bundle" sonaba
como la lectura obvia de "esto no debería pasar", y era la lectura equivocada — el diseño real
permite varios bundles por stage a propósito, y el bug era más específico que eso. Verificarlo
contra el comportamiento (subir dos evidencias a un stage nuevo, mirar cuántos bundles quedan) antes
de escribir el índice es lo que lo encontró.
