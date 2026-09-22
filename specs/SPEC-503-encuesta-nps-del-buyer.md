# SPEC-503 — Encuesta NPS del buyer

> Milestone 4, criterio 1 (`buyer NPS ≥70`). Ver [`ESTADO-2026-09-22-catalyst-milestone-4.md`](ESTADO-2026-09-22-catalyst-milestone-4.md).

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

## Preguntas abiertas

- **¿Qué evento dispara el envío?** Se propone "primera liberación (`PaymentAttestation`) de un
  contrato del investor" como default razonable, pero es una decisión de producto que el dueño
  tiene que confirmar antes de construir — dispararla muy temprano (ej. al firmar el contrato) mide
  la venta, no el servicio.
- **¿Hay un piso de respuestas para que el NPS cuente como evidencia?** Con dos pilotos y ≥120
  wallets el universo de encuestables es chico; un NPS con 3 respuestas no sostiene "≥70" frente a
  un revisor de Catalyst sin una nota que diga el tamaño de muestra (mismo patrón que el criterio 9
  de M3, que declaró `sampleSize: 1` explícito en vez de esconderlo).
