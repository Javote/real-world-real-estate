# SPEC-206 — El anclaje por commitment está escrito dos veces, y ya divergieron

> **Origen:** [`AUDITORIA-2026-09-11-calidad-del-backend.md`](AUDITORIA-2026-09-11-calidad-del-backend.md) §B-08.
> Nivel 🟡 — toca el camino de anclaje. **Independiente.** No toca ningún criterio del SOM.
> **Borra ~60 líneas** y cierra un camino de divergencia futura.

## El problema, en una frase

`POST /evidence/:id/anchor` (`evidence.routes.ts:229`) reimplementa inline lo que
`anchorCommitmentEvent` (`domain/anchoring.ts:29`) hace: leer el `eventIndex` previo, insertar el
evento `Pending`, llamar al puerto, **guardar el recibo apenas existe**, intentar `confirmedAt`,
marcar `Failed` si explota, loguear a Sentry. Unas 60 líneas gemelas.

## Ya divergieron, y en el campo que más duele

**La versión inline no escribe `referenceId`.** El docstring de la función buena dice qué se pierde:

> *"La ref queda persistida, no solo enviada al port: es lo único que permite volver del registro
> off-chain a su TXID sin recomputar un commitment que incluye timestamps."*

O sea: una evidencia anclada por `POST /developer/documents` (que **sí** usa la función) es
reconciliable por `reconciliarParaLectura({ referenceId })`; **una anclada por
`POST /evidence/:id/anchor` no**. Dos caminos al mismo hecho con distinta capacidad de reconciliación.

Y el recibo de la duplicación está en los comentarios: **los tres sitios llevan la misma nota con la
misma fecha** —*"mismo fix que `anchorEvent`/`anchorCommitmentEvent` (2026-09-10, ver
`specs/evidencia-m3/3-preprod/REPORTE-2026-09-10-prueba-de-volumen.md`)"*—. El bug que encontró la prueba de volumen **hubo
que arreglarlo tres veces**. Esa nota repetida es el síntoma, escrito por quien lo arregló.

## Qué se cambia

Que la ruta llame a la función:

```ts
await anchorCommitmentEvent({ …, reference: evidencia.id, evidenceId: evidencia.id });
```

Un `DELETE` de ~60 líneas y una columna que **se empieza a poblar**.

## Lo que NO se toca

**`anchorEvent` (el del hilo) se queda como está.** `openThread`/`advanceThread` son otra cosa —con
`outputRef` y datum— y fundirlo sería el error inverso: una abstracción que unifica dos mecanismos
distintos porque se parecen en la superficie. La duplicación que esta spec borra es entre **dos
copias del mismo mecanismo**, no entre dos mecanismos.

## Invariantes

1. **Un solo lugar en `src` implementa "anclar un commitment".**
2. **Todo `OnChainEvent` de commitment tiene `referenceId`**, venga del camino que venga.
3. **La asimetría registro/prueba se conserva** (D-059): el recibo se guarda apenas existe, la
   confirmación es best-effort, un proceso que muere nunca se lleva puesto un TXID real.
4. **El contrato HTTP de la ruta no cambia**: mismo status, mismo cuerpo, mismos códigos de error.

## Casos borde (definen los tests)

| Caso | Esperado |
|---|---|
| `POST /evidence/:id/anchor` camino feliz | mismo 201 y mismo cuerpo que hoy, **y** `referenceId` poblado |
| Re-anclar la misma evidencia | el comportamiento de hoy se conserva explícitamente (el test lo fija antes del refactor) |
| El puerto falla | evento `Failed`, log a Sentry, misma respuesta que hoy |
| El puerto confirma tarde | evento `Pending`, reconciliable **ahora también por `referenceId`** |
| `eventIndex` compartido con eventos del hilo | intercalado, como hoy: lo que distingue al hilo es `outputRef`, no el índice |

## Verificación

Los tests de la ruta **se escriben antes del borrado** y tienen que pasar sin tocarse después. Es la
única forma de probar que 60 líneas menos son 60 líneas equivalentes.
