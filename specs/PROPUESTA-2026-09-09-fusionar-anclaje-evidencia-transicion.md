# PROPUESTA 2026-09-09 — fusionar el anclaje de evidencia con el auto-avance a `InProgress`

> **Estado: sin decidir.** No es un plan en curso — es una idea para evaluar en algún momento
> futuro, surgida al presupuestar el costo on-chain de la prueba end-to-end de volumen (pendiente
> #0 de `CLAUDE.md` raíz). Nadie la aprobó todavía. Si se decide implementar, esto se convierte en
> un `PLAN-YYYY-MM-DD-*.md` propio.

## El problema que resuelve

`POST /developer/projects/:id/stages/:stageId/evidence` es el único endpoint del sistema que hoy
dispara **dos anclajes on-chain por la misma acción del usuario**, cuando el stage está en
`Pending`:

```
1. crearBundle() + anchorCommitmentEvent({eventType: "EVIDENCE_ANCHOR", ...})   → TX #1 (metadata pura)
2. transitionStage({to: "InProgress", ...}) → anchorEvent() → advanceThread()  → TX #2 (spend del hilo)
```

Son dos transacciones separadas para una sola intención del usuario ("subí la primera evidencia de
este stage"). Fusionarlas en una sola TX ahorra el fee base completo de la TX metadata-only —
estimado en ~0,18 tADA/ADA por evento, con los únicos números medidos que hay en el repo (D-083:
mint 599 bytes / 0,2317 tADA) más la fórmula estándar de fee de Cardano.

## Por qué es posible sin tocar el validador

La metadata de una transacción (`auxiliary_data`) **nunca llega al `ScriptContext`** que ve un
validador Plutus V3 — el validador no la puede leer ni rechazar. Adjuntar metadata adicional a la
misma TX que gasta el UTxO del hilo es un cambio puramente de construcción de transacción, del lado
TypeScript. **`contracts/` no cambia una línea.**

## Alcance

- **Cubre:** solo el caso "primera evidencia subida a un stage en `Pending`" —el único lugar donde
  hoy coinciden un `EVIDENCE_ANCHOR` y un `STAGE_TRANSITION` en la misma request.
- **NO cubre:** ningún otro endpoint. Evidencia subida a un stage ya `InProgress` (no hay
  transición que fusionar), `POST /developer/documents` (nunca toca el hilo del stage), certify/
  observe (no suben evidencia en el mismo paso), ni el mint de los 10 stages al crear un proyecto
  (cada mint ya es su propia TX por regla del validador, `mint_rejects_two_threads_in_one_tx`).

## Qué transacción reemplaza a las dos

Una sola TX que:

- **Gasta el UTxO del hilo** con el redeemer `Advance` (igual que hoy) — lo único que el validador
  valida.
- **Trae la metadata del `EVIDENCE_ANCHOR`** (el commitment del bundle) como auxiliary data
  adicional, bajo su propio label, junto a la metadata que el `advance` ya lleva.

## Qué cambia en el código

1. **`packages/cardano` (`AnchorPort`)** — `advanceThread()` gana un parámetro opcional:

   ```ts
   advanceThread(input: {
     stageRef, datum, redeemer,
     extraMetadata?: { label: number; commitment: string }  // nuevo
   })
   ```

   El adaptador real le agrega un `.attachMetadata(label, {...})` al mismo `TxBuilder` que arma el
   spend del hilo. El simulado hace lo mismo con su ledger en memoria.

2. **`domain/stage-transition.ts`** — `anchorEvent()`/`recordOnChainEvent()` necesitan poder recibir
   el commitment de evidencia cuando quien llama es el flujo de upload, y pasarlo como
   `extraMetadata` a `advanceThread`.

3. **`developer-evidencia.routes.ts`** — en vez de las dos llamadas secuenciales, una sola:
   `crearBundle()` para tener el root, y después algo como
   `transitionStage({to: "InProgress", evidenceCommitment: bundle.commitmentHash})` hace el spend
   con la metadata adjunta.

4. **Modelo de datos — nada nuevo, dos filas que comparten TXID.** Siguen existiendo dos
   `OnChainEvent` (uno `EVIDENCE_ANCHOR` con su `evidenceId`, otro `STAGE_TRANSITION` con su
   `fromState`/`toState`) porque D-006/M1-D2 los define como dos afirmaciones distintas. La
   diferencia es que ambos se crean `Pending` casi al mismo tiempo, apuntan al **mismo `txid`** una
   vez enviada la TX, y `reconciliarParaLectura` los confirma juntos porque comparten TXID.

5. **La respuesta de la API no cambia.** `stageEvidenceUploadResultSchema` sigue devolviendo
   `{ evidence, bundleId, merkleRoot, anchor }` — `anchor` sigue siendo el evento
   `STAGE_TRANSITION`, solo que ahora su `txid` es el mismo que el del `EVIDENCE_ANCHOR` sibling, en
   vez de dos TXID distintos.

## Qué NO toca

- `contracts/` (Aiken) — cero cambios.
- Ningún otro endpoint (certify, observe, `PATCH .../state`, anclaje de documento suelto).
- El contrato de respuesta de la API (`stageEvidenceUploadResultSchema`).

## Nivel y superficie

**🟡** — toca `packages/cardano` (el `AnchorPort`) y `domain/stage-transition.ts`, las dos zonas
donde `CLAUDE.md` raíz pide revisión humana línea por línea. No toca nada 🔴: no hay claves ni
firmas de por medio, solo construcción de transacción.

## Tests que se tocarían

`evidence-upload.test.ts` (el auto-avance `Pending → InProgress`) necesitaría un test nuevo que
confirme que las dos filas de `OnChainEvent` (evidencia y transición) terminan con el **mismo
txid** tras reconciliar — hoy el test solo confirma que cada una tiene *su propio* txid, sin
verificar que sean iguales o distintos.

## Costo estimado, comparado

| | Fee |
|---|---|
| Hoy (2 TXs separadas) | 0,238 + 0,18 ≈ **0,42 tADA/ADA** |
| Fusionada (1 TX + ~100-150 bytes de metadata extra) | 0,238 + ~0,005 ≈ **0,24 tADA/ADA** |
| **Ahorro por evento** | **~0,18 tADA/ADA (~43%)** |

Se aplica una sola vez por stage (el evento de arranque). En mainnet, con volumen real, es ahorro
que compone: cada proyecto nuevo de 10 stages ahorraría ~1,8 ADA reales, repetido por cada proyecto
que exista en la plataforma — a diferencia del presupuesto de una prueba puntual en preprod, que es
gasto único.

## Preguntas abiertas

- **¿El ahorro medido coincide con el estimado?** Los números de arriba salen de la fórmula
  estándar de fee de Cardano aplicada sobre el único dato real medido que hay en el repo (D-083, el
  mint) — no de una medición directa de una TX con datum+redeemer+metadata combinados. Antes de
  decidir con esto, conviene un dry run chico en preprod que mida el fee real.
- **¿Vale la pena el costo de desarrollo (🟡, tres archivos) para un ahorro que en preprod es
  ~12-13% de una prueba puntual?** El caso de negocio real es mainnet con volumen, no esta prueba —
  hay que decidir si se prioriza ahora o se deja para cuando mainnet esté más cerca.
- Si se decide seguir adelante, esto pasa a ser un `PLAN-YYYY-MM-DD-fusionar-anclaje-evidencia.md`
  propio, con su secuencia de pasos y su punto de control.
