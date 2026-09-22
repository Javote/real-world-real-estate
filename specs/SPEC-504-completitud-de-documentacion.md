# SPEC-504 — Completitud de documentación por unidad

> Milestone 4, criterio 1 (`document completeness ≥95%`). Ver [`ESTADO-2026-09-22-catalyst-milestone-4.md`](ESTADO-2026-09-22-catalyst-milestone-4.md).

## Propósito

El criterio pide un número — "≥95% completa" — y hoy no hay definición de qué significa que la
documentación de una unidad esté completa. Lo único que existe es D-028: un stage
`validationCritical` rechaza completarse sin evidencia atribuida. Eso es una condición binaria por
stage (pasa o no pasa), no un porcentaje por unidad. Sin definir la fórmula antes de medirla, "95%"
es un número que se puede hacer decir cualquier cosa — exactamente lo que regla 17 prohíbe.

## Alcance / NO-alcance

- **Cubre:** la fórmula de completitud por unidad y el endpoint que la calcula para `SPEC-501`. La
  fórmula se basa en **lo que `DEFAULT_STAGE_CATALOG` ya declara como exigible**, no en una lista
  nueva de documentos — D-028/D-084/D-086 ya definen qué stage exige evidencia atribuida; esto solo
  agrega "y de los que la exigen, ¿cuántos ya la tienen?".
- **NO cubre:** decidir qué evidencia es exigible por stage — eso ya está decidido y vive en
  `DEFAULT_STAGE_CATALOG` (`packages/shared`) y en la validación de `PATCH /stages/:id/state`. No
  cubre completitud a nivel proyecto (el criterio habla de unidades, y una unidad es lo que tiene
  comprador — un proyecto sin unidades vendidas no entra en el cálculo).

## Interfaz

```
GET /admin/document-completeness?projectId=   → { perUnit: [{unitId, completedRequired, totalRequired, rate}], overallRate }
```

**Fórmula, por unidad:**

```
totalRequired    = count(stages del proyecto de la unidad WHERE validationCritical = true)
completedRequired = count(esos stages WHERE state = 'Completed')
rate              = completedRequired / totalRequired
```

`overallRate` es el promedio simple de `rate` sobre las unidades **vendidas** (`Unit.investorId is
not null`) — una unidad sin comprador no tiene documentación que completar todavía.

## Invariantes

- Un stage no-crítico nunca entra en el denominador — la completitud mide lo que D-028 exige, no
  todo el catálogo. Subir el número agregando stages no críticos al cálculo sería inflarlo sin
  cambiar nada real.
- `totalRequired = 0` (un proyecto sin ningún stage crítico, caso hoy inexistente porque el template
  de 10 etapas ya trae críticos, pero no imposible si cambia el catálogo) da `rate: null`, no
  división por cero ni `100%` por default.
- El cálculo es sobre el estado **actual**, no una foto histórica — completitud es "¿está completo
  hoy?", no "¿llegó a estar completo alguna vez?" (un stage no vuelve de `Completed` hacia atrás por
  la FSM, D-020, así que en la práctica esto rara vez importa, pero la definición tiene que ser
  explícita).

## Casos borde (definen los tests)

- Unidad con los 10 stages del template, todos `Completed` — `rate: 1.0` sobre los críticos, aunque
  algunos no-críticos sigan `Pending`.
- Unidad sin comprador — no aparece en `perUnit`, no cuenta en `overallRate`.
- Proyecto con una sola unidad vendida y completitud parcial — `overallRate === rate` de esa unidad.
- Dos unidades, una al 100% y otra al 50% — `overallRate = 0.75` (promedio simple, no ponderado por
  cantidad de stages, para que un proyecto con más etapas no pese más que uno con menos).

## Preguntas abiertas

- **¿Promedio simple entre unidades o ponderado por total de stages críticos?** Se propone simple
  arriba porque es lo que un lector de Catalyst esperaría de "95% completo" sin aclaración — pero si
  un proyecto tiene unidades con catálogos de tamaño muy distinto (hoy no pasa, `DEFAULT_STAGE_CATALOG`
  es uniforme; podría pasar si el catálogo se vuelve configurable por proyecto, que hoy no lo es,
  D-092), esto habría que revisarlo.
