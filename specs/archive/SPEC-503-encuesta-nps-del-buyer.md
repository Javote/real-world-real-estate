# SPEC-503 — Encuesta NPS del buyer

> Milestone 4, criterio 1 (`buyer NPS ≥70`). Ver [`ESTADO-2026-09-22-catalyst-milestone-4.md`](ESTADO-2026-09-22-catalyst-milestone-4.md).
>
> **Cerrada 2026-10-21; la pantalla para responder, el mismo día** (ver abajo). Módulo
> `apps/api/src/modules/encuestas/`, contrato en `packages/shared/src/contract/encuestas.ts`, tabla en
> la migración `0015_nps_survey.sql`; los casos borde son `apps/api/test/spec-503-encuesta-nps.test.ts`.

## Propósito

NPS (*Net Promoter Score*) es una medición estándar de una sola pregunta —"del 0 al 10, ¿qué tan
probable es que recomiendes esto?"— con una fórmula fija: `% promotores (9-10) − % detractores
(0-6)`. Hoy no existe ningún mecanismo para preguntarle nada a un investor después de un evento del
ciclo de vida. Sin esto, el criterio 1 no tiene cómo sustanciarse — y la regla 17 (nunca mostrar una
señal de prueba que no se pueda sustanciar) aplica también a un número que se reporta a Catalyst:
**no se inventa un NPS, se mide uno.**

## Alcance / NO-alcance

- **Cubre:** una encuesta de una sola pregunta, disparada al investor después de que su unidad
  complete su primer stage con release asociado (o al cerrar una disputa a su favor — el momento
  exacto es una decisión de producto, no de esta spec). Cubre el cálculo de `npsScore` para
  `SPEC-501`.
- **NO cubre:** una plataforma de encuestas general ni un sistema de feedback cualitativo abierto —
  es una pregunta, un número del 0 al 10, y un comentario opcional. No cubre reenvíos ni
  recordatorios automáticos (nada de cron nuevo, D-077 ya fijó el criterio para este repo: el
  disparo es un evento, no un timer).

## Interfaz

```
POST /investor/surveys/:token/respond   { score: 0-10, comment?: string }   → 200
GET  /admin/nps                                                             → { promoters, passives, detractors, score, responseCount }
```

`:token` es opaco (mismo patrón que `shareToken` del dossier) — la encuesta se manda por
notificación interna (`Notification`, tabla ya existente) con un link que no requiere que el
investor esté logueado para responder, porque el objetivo es maximizar la tasa de respuesta.

| Tabla | Columnas nuevas |
|---|---|
| `NpsSurvey` | `id, investorId, projectId, triggerEventType, token, score, comment, sentAt, respondedAt` |

## Invariantes

- `score` es un entero 0-10, validado con Zod en `packages/shared` (regla 6) — nunca se acepta un
  valor fuera de rango, ni siquiera para "no sé" (eso es no responder, `respondedAt: null`).
- Un investor no puede responder la misma encuesta dos veces — `respondedAt` ya seteado rechaza con
  409, no sobrescribe.
- **Cero PII en el reporte agregado**: `GET /admin/nps` nunca devuelve `comment` con el nombre del
  investor al lado sin que sea admin explícitamente pidiendo el detalle — el número agregado (regla
  del criterio) es lo que se reporta a Catalyst, no las respuestas individuales.
- `npsScore` con menos de un umbral de respuestas mínimo (a definir, ver Preguntas abiertas) se
  reporta con esa advertencia — un NPS de "1 de 1 encuestados" es ruido, no señal, y regla 17 aplica
  igual acá.

## Casos borde (definen los tests)

- `score` fuera de 0-10 (ej. 11, -1) — 400.
- Responder con token ya usado — 409.
- Responder con token inexistente/vencido — 404.
- Cero respuestas — `npsScore` es `null`, no `0` (0 significa "todos detractores", que es un dato
  distinto de "no hay datos").
- `comment` vacío o ausente — válido, es opcional.

## Lo que quedó decidido al implementar

- **El disparo es la primera liberación** (dueño, 2026-10-21, D-104): `POST
  /developer/contracts/:id/releases/:stageNum`, cuando crea la `PaymentAttestation` (201), le manda
  la encuesta al investor del contrato. **Una sola por investor, proyecto y evento** (índice único
  de `NpsSurvey`): la segunda liberación no vuelve a preguntar. La notificación va en el mismo lote
  que la encuesta y entra solo si la encuesta es nueva (`notifySiGano`), con categoría `release` —
  la encuesta nace de una liberación, y una categoría nueva sería un estado que M2-D3 no lista.
- **El piso de respuestas es 30** (`NPS_MINIMUM_RESPONSES`, `packages/shared/src/nps.ts`): por
  debajo, `belowMinimum: true`. Es el umbral de muestra chica habitual, no una decisión del dueño:
  se revisa cuando se sepa cuántos investors tiene el piloto. La respuesta también trae
  `sentCount`, para que la tasa de respuesta sea visible.
- **El score no se redondea**: `% promotores − % detractores` exacto, de -100 a 100. El redondeo es
  de presentación.
- **"Vencido" no existe todavía**: el token no caduca. Un token inexistente es 404; uno ya
  respondido, 409 `SURVEY_ALREADY_ANSWERED`, sin sobrescribir.
- **La respuesta escribe `AuditLog`** (`RESPOND_NPS_SURVEY`, actor el investor) sin el puntaje ni el
  comentario: el audit dice que respondió, no qué.
- **`/investor/surveys` lleva límite de tasa**, como el link público del dossier (`SPEC-211`): es la
  otra ruta sin sesión.
- **`GET /admin/nps` no lleva filtro**: agrega todos los proyectos. `SPEC-501` filtra llamando al
  caso de uso con sus `projectIds`.

## La pantalla para responder

**Ni M2-D2 ni M2-D5 tienen una superficie donde el investor responda.** El dueño la pidió el mismo
día (D-104): `/survey/$token`, pública como el dossier compartido, con test ID
`INV-SURVEY-NPS-001` (fuera del backlog, declarado en `scripts/check-testids.mjs`). La notificación
`notifications.survey.nps` lleva ahí con el `surveyToken` de sus `params`, desde las dos listas
del investor (`useAbrirNotificacion`, `lib/notificaciones.ts`).

- La pregunta es la misma clave de la notificación; el puntaje, once `CategoryChip` del 0 al 10; el
  comentario, un `TextArea` opcional que no viaja si queda en blanco.
- Ya respondida (409) o inexistente (404) cierran el formulario con su mensaje: no hay nada que
  reintentar. Cualquier otro error deja el formulario con el aviso genérico.
- No hay un `GET` de la encuesta: la pantalla no sabe si ya se respondió hasta que el investor envía.
  Con una sola respuesta por token, no hizo falta.
- El e2e (`INV-SURVEY-NPS-001`, `apps/web/e2e/investor-surface.spec.ts`) entra sin sesión, responde
  contra la API real con un token que no existe y ve el 404: la ruta es pública y el cuerpo pasa el
  Zod de la API. No siembra una encuesta: crearla pide certificar y liberar una etapa del seed, que
  leen los demás specs. El camino con token válido es `apps/api/test/spec-503-encuesta-nps.test.ts`.
