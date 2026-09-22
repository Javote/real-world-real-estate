# SPEC-112 — La pasada de accesibilidad con VoiceOver, más allá de las live regions

> **Origen:** se separa de [`SPEC-104`](SPEC-104-live-regions.md) el 2026-09-22 — esa spec cerró con
> su código y tests automatizados hechos, pero la verificación manual que le quedaba pendiente no
> era solo suya: `SPEC-104` construyó las live regions, no auditó accesibilidad en general.
> Nivel 🟢. **Independiente.** No toca ningún criterio del SOM.

## Propósito

`M2-D3` exige WCAG 2.1 AA (regla de diseño, no opcional) y nadie corrió nunca una pasada real con un
lector de pantalla sobre la app entera — solo `grep` (F-03 de la auditoría del frente, que dio pie a
`SPEC-104`) y los tests automatizados de accesibilidad que ya corren en CI. Un `grep` prueba que un
atributo existe, no que un lector de pantalla haga algo razonable con él; y un test automatizado de
accesibilidad (axe, jest-axe o similar, si lo hay) prueba violaciones estructurales, no la
experiencia de navegar la app entera con VoiceOver. Ninguno de los dos reemplaza escuchar la app.

## Alcance / NO-alcance

- **Cubre:** una pasada manual con VoiceOver (macOS) sobre las superficies más usadas de cada rol —
  no las 42 rutas completas, un recorrido representativo (login, alta de proyecto, subir evidencia,
  certificar, dossier, audit log) — evaluando: foco visible y su orden al tabular, `label`/`alt`
  en controles e imágenes, jerarquía de `h1`-`h3`, asociación de `label`↔`input` en formularios,
  landmarks (`nav`, `main`, `header`) y anuncios de las tres live regions que ya construyó
  `SPEC-104` (login fallido, subida con anclaje, transición por poll — heredados de esa spec, no se
  re-diseñan acá).
- **NO cubre:** escribir código nuevo a priori. Esta spec es de verificación; si la pasada encuentra
  un defecto real (un botón sin label, un foco que salta a un lugar sin sentido), ese hallazgo se
  convierte en su propia spec `1xx` — mismo patrón que usó la auditoría original del frente, no se
  parchea dentro de esta.
- **NO cubre:** un audit automatizado nuevo (axe/jest-axe) — si no existe, es una spec aparte, y
  esta no la reemplaza: automatizado y manual encuentran cosas distintas.

## Interfaz

No aplica — es una pasada de QA manual, no una pieza de código con entradas/salidas.

## Invariantes

- La pasada corre sobre la **app desplegada o `pnpm dev`**, nunca sobre el código leído: el punto es
  escuchar lo que un lector de pantalla realmente anuncia, no inferirlo de la marca.
- Cada superficie recorrida se registra con su resultado (bien / hallazgo) en este archivo o en un
  reporte fechado — no queda solo en la cabeza de quien la corrió.
- Un hallazgo nuevo no bloquea el resto de la pasada — se anota y se sigue, igual que hicieron las
  cuatro auditorías del 2026-09-11.

## Casos borde (definen la pasada)

- Los tres caminos que ya cubría `SPEC-104` (login fallido, anclaje, poll) — confirmar que siguen
  anunciando correctamente, no repetir el diseño.
- Un modal (`AnchoringSuccessModal`, cualquiera de los 11 de `SPEC-102`) — el foco tiene que quedar
  atrapado adentro y volver al disparador al cerrar.
- Un formulario largo (alta de proyecto, invitación) — el orden de tabulación sigue el orden visual,
  no el orden del DOM si difieren.
- La navegación responsive (`SPEC-106`/D-074, sidebar → bottom nav en mobile) — confirmar que
  también es navegable sin mouse en ese layout.

## Preguntas abiertas

- **¿Quién la corre y cuándo?** Es trabajo humano sin fecha asignada — mismo estado que tenía la
  pasada dentro de `SPEC-104` antes de separarla. No bloquea nada del SOM (nivel 🟢, independiente),
  así que puede tomarse cuando haya disponibilidad, sin presión de milestone.
