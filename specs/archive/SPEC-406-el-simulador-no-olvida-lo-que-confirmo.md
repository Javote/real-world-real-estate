# SPEC-406 — El simulador deja de olvidar lo que confirmó cada vez que se reinicia

> **Origen:** [`AUDITORIA-2026-09-11-calidad-de-packages.md`](AUDITORIA-2026-09-11-calidad-de-packages.md)
> §C-01. Nivel 🟡 — toca el adaptador y su store. **Independiente.** No toca ningún criterio del SOM.
> **Reproducido con un test en verde**, no deducido.

## El problema, en una frase

`LedgerStore` se inyecta para que el estado del simulador sobreviva al reinicio —en `apps/api` es
SQLite—, **pero la mitad del estado no pasa por el store**: `proofs` y `bloques` son dos `Map` en
memoria de la instancia, así que cada reinicio borra todo lo que el simulador sabía haber confirmado.

## Reproducido

```
store persistido + instancia nueva del adaptador
  findLiveThread(stageRef)  → el hilo sigue ahí        ✔
  confirmedAt(txid)         → null                     ✗  (antes: un número)
  verify(txid)              → null                     ✗  (antes: el AnchorProof)
```

## Por qué importa

`reconciliarAnclajes` promueve `Pending → Confirmed` preguntando exactamente `confirmedAt`
(`domain/reconcile.ts:133`). Después de un reinicio, **todo evento anclado antes queda `Pending`
para siempre**: la única fuente que podía confirmarlo dejó de conocerlo, y no hay reintento que lo
recupere porque la respuesta `null` es estable.

Por la regla 17, la UI entonces dice "Pendiente" sobre un anclaje que el propio simulador produjo, y
el `AuditLog` y la telemetría del criterio 9 cuentan esas filas como no confirmadas. Es la misma
clase de incoherencia registro-vs-cadena que la prueba de volumen del 2026-09-10 encontró del lado
real — con la diferencia de que acá **el "ledger" somos nosotros**, así que no hay a quién
preguntarle.

Y contradice de frente lo que el `CLAUDE.md` del package promete: *"en `apps/api` es SQLite (tabla
`SimulatedLedgerUtxo`), así que reiniciar `pnpm dev` no pierde los hilos abiertos"*. Los hilos no;
las confirmaciones sí.

**Alcance real del daño:** dev y CI. En producción el simulador está prohibido contra una base
remota (`motivoParaNoAnclar`, D-087), así que esto no puede pasar en Render. Lo que arruina es la
confianza en el entorno donde se prueba todo.

## Qué se cambia

El registro de lo que el simulador incluyó **pasa por el store**, igual que los UTxOs. `LedgerStore`
gana lo mínimo para contestar las dos preguntas:

| Método nuevo | Contesta |
|---|---|
| `registrarBloque(txid, at)` | "este txid entró, en este momento" — idempotente: no pisa si ya estaba |
| `bloqueDe(txid)` | el POSIX ms, o `undefined` |

`InMemoryLedgerStore` lo implementa con un `Map` (los tests siguen sin tocar disco) y
`KyselyLedgerStore` en `apps/api` con una tabla —o una columna en `SimulatedLedgerUtxo`, que ya
tiene `createdAt`—. **La decisión de esquema es parte de esta spec**, porque es una migración (🟡).

`verify()` es el caso más largo: devuelve un `AnchorProof` completo (con `outputRef` y `datum`), y
eso ya está en `SimulatedLedgerUtxo`. **No hace falta persistir `proofs`: se puede reconstruir** —
buscar el UTxO cuyo `outputRef` arranca con ese txid y armar el proof desde su datum. Esa es la
opción preferida: menos estado nuevo y una sola fuente.

## Alcance / NO-alcance

- **Cubre:** `ledger.ts`, `simulated.ts`, y la implementación de `KyselyLedgerStore` +
  su migración en `apps/api`.
- **NO cubre:** el adaptador real. Ahí `confirmedAt` le pregunta a Blockfrost, que no se reinicia
  con nosotros — es justamente la asimetría correcta.
- **NO cubre:** hacer que el simulador confirme solo. Sigue devolviendo `Pending` en el recibo
  (D-087): lo que se arregla es que **la pregunta posterior tenga respuesta**, no que se conteste
  sin preguntar.
- **NO cubre:** el determinismo del TXID, que se queda como está.

## Invariantes

1. **Un txid que el simulador produjo sigue siendo suyo después de reiniciar el proceso.**
2. **Un txid ajeno sigue dando `null`** (D-079). El arreglo no puede ensanchar lo que el simulador
   afirma conocer.
3. **El momento de inclusión no se mueve.** Anclar dos veces lo mismo da el mismo txid y el mismo
   timestamp que la primera vez, antes y después del reinicio.
4. El `AnchorReceipt` sigue diciendo `Pending` siempre.
5. **La migración es idempotente** (regla 8) y no toca filas de `OnChainEvent`.

## Casos borde (definen los tests)

| Caso | Esperado |
|---|---|
| `openThread` → instancia nueva con el mismo store → `confirmedAt` | el mismo número que antes |
| `openThread` → instancia nueva → `verify` | el mismo `AnchorProof` |
| `anchorCommitment` (metadata, sin hilo) → instancia nueva → `confirmedAt` | el mismo número |
| Un txid que nunca se ancló | `null`, antes y después |
| Re-anclar el mismo archivo después del reinicio | mismo txid, **mismo timestamp**, sin fila duplicada |
| `advanceThread` después del reinicio | funciona — hoy también, y no puede regresionar |
| `InMemoryLedgerStore` (tests) | sigue sin tocar disco |

## Verificación

El test de la auditoría, invertido: hoy pasa afirmando que se pierde, y con esta spec pasa afirmando
que se conserva. Más `pnpm dev`, anclar algo, reiniciar la API, y ver que la pantalla sigue diciendo
"Verificado" — que es el síntoma por el que esto se encontró.

## Cerrada — 2026-09-20

**`LedgerStore` gana `registrarBloque(txid, at)` y `bloqueDe(txid)`** (`packages/cardano/src/ledger.ts`),
implementados en `InMemoryLedgerStore` con un `Map` (los tests siguen sin tocar disco) y en
`KyselyLedgerStore` (`apps/api/src/lib/anchor.ts`) contra una tabla nueva, `SimulatedLedgerBlock`
(migración `0008_simulated_ledger_block.sql`) — no una columna en `SimulatedLedgerUtxo`: un anclaje
por metadata (`anchorCommitment`) nunca crea fila ahí, así que hacía falta una tabla propia indexada
por txid, sea cual sea el camino que lo produjo. `registrarBloque` es idempotente por
`onConflict().doNothing()` sobre la PK (regla 8), igual criterio que `crearBundle`.

`SimulatedAnchorAdapter.confirmedAt` pasa a leer del store en vez de un `Map` de la instancia.
`verify()` ya no persiste un `AnchorProof` aparte: se reconstruye buscando `store.get(`${txid}#0`)`
—el `outputRef` de un hilo es siempre esa forma— y combinando su `datum` con `store.bloqueDe(txid)`;
un anclaje sin hilo sigue dando `null`, igual que antes (**NO-alcance** respetado: el simulador
sigue sin confirmar solo).

**Reproducido de verdad, no deducido**: las 6 pruebas nuevas de "instancia nueva, mismo store" en
`simulated.test.ts` se corrieron primero contra el código viejo (`git stash` de `ledger.ts` +
`simulated.ts`) — 5 de las 6 fallan en rojo, exactamente los casos de la tabla de casos borde
(`confirmedAt`/`verify` de un hilo, `confirmedAt` de metadata, re-anclar tras el reinicio) — y
después restauradas contra el código nuevo, las 6 en verde. Dos tests más en `apps/api` prueban la
otra mitad, la que `packages/cardano` no puede ver: que `KyselyLedgerStore` de verdad escribe y lee
`SimulatedLedgerBlock` contra SQL, y que dos anclajes del mismo archivo no duplican la fila.

`pnpm --filter @plataforma/cardano test` (78, 6 nuevos), `pnpm --filter @plataforma/api test` (427,
2 nuevos) y `pnpm verify` completo, todos verdes.
