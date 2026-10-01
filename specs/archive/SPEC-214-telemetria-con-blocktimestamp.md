# SPEC-214 — La telemetría del criterio 9 mide lo que tardó alguien en volver a leer

> **Origen:** [`AUDITORIA-2026-09-11-calidad-del-backend.md`](AUDITORIA-2026-09-11-calidad-del-backend.md)
> §Anexo. Nivel 🟢. **Independiente.** **Toca evidencia del criterio 9 del SOM**, que ya está cerrado
> — por eso esta spec no cambia el número publicado, lo hace defendible.

## El problema, en una frase

`GET /audit-logs/telemetry/reservation-to-escrow` (`audit.routes.ts:58`) mide
**`updatedAt - createdAt`**. Hoy es correcto —una vez `Confirmed`, la fila sale del `where` de la
reconciliación y nadie la vuelve a tocar— **pero `updatedAt` no promete significar "cuándo confirmó"**.
Lo promete `blockTimestamp`, que **ya se puebla en el mismo `set`**.

El comentario de la ruta lo declara con honestidad: la métrica incluye *"lo que tardó alguien en volver
a leer"*. Y eso no es un detalle teórico acá: **el cierre del criterio 9 el 2026-09-11 descubrió
exactamente ese hueco** — el estado quedó `Pending` varios minutos después de confirmar on-chain
porque nada había disparado `reconciliarAnclajes()` (D-077: no hay poll en background, a propósito).
La mediana publicada, **2.76 min con `sampleSize` 1**, incluye ese tiempo de lectura.

## Qué se cambia

`blockTimestamp - createdAt` cuando `blockTimestamp` existe, con `updatedAt` como respaldo declarado
para las filas viejas que no lo tengan.

**Es la latencia de cadena pura**: lo que el SOM pregunta cuando pide *"mediana reserva → escrow"*.

## Lo que esta spec NO hace

- **No re-publica el número del criterio 9.** Ese criterio está cerrado con su evidencia y su muestra.
  Si la métrica nueva da distinto, se anota en `specs/README.md` **con las dos lecturas y qué mide cada
  una** — no se reemplaza una por otra en silencio, que sería exactamente el tipo de afirmación que
  este repo no se permite.
- **No agrega un poll en background.** D-077 decidió el disparo por lectura y sigue en pie.
- **No cambia qué se guarda.** `blockTimestamp` ya se escribe.

## Invariantes

1. **La métrica declara qué mide, en el endpoint y en el documento que la cita.**
2. **Ninguna fila sin `blockTimestamp` se cuenta como si lo tuviera.** O se excluye, o se marca en el
   resultado; el `sampleSize` tiene que seguir siendo interpretable.
3. **La forma de la respuesta no cambia** sin que cambie también quien la lee.

## Casos borde (definen los tests)

| Caso | Esperado |
|---|---|
| Fila con `blockTimestamp` | mide contra esa columna |
| Fila vieja sin `blockTimestamp` | respaldo declarado, y no ensucia la mediana en silencio |
| Cero filas | mismo comportamiento que hoy (`sampleSize: 0`) |
| `blockTimestamp` anterior a `createdAt` | imposible en teoría; si aparece, se descarta y se loguea — no se publica un negativo |
