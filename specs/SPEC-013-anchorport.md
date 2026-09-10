# SPEC-013 — `AnchorPort`: conectar el registro con la cadena

> Rebanada 3 del mapa (`specs/README.md`), en **tres cortes**. Este documento cubre los tres; la
> rebanada A es la que se implementa primero y las otras dos heredan sus invariantes.

## Propósito

Entre `apps/api` y `contracts/` no hay nada: el validador está probado y nadie construye la
transacción (D-059). `AnchorPort` es esa pieza — la dependencia externa más lenta e incierta detrás
de una interfaz propia con modo real/simulado (principio 7, D-014), para que el resto del sistema
no sepa que Cardano existe.

## Los tres cortes

| | Qué deja funcionando | Qué introduce | Riesgo |
|---|---|---|---|
| **A · el puerto y el simulador** ✅ | El ciclo completo: declarar → anclar → TXID → estado del hilo, sin red | `packages/cardano`, `AnchorPort`, adaptador `simulated` con ledger propio | ninguno: sin secretos, sin red, corre en CI |
| **B · el adaptador real** ✅ *(local)* | Transacciones de verdad: contra el `Emulator` en CI y contra un devnet local con Conway + PlutusV3 | Lucid Evolution, códec CBOR con valor dorado, dirección derivada del blueprint, `compose.dev.yml` | el códec era donde vivían los bugs — cerrado con el dorado. **Falta Preprod**: 🔴 `SERVICE_WALLET_PRIVATE_KEY` y cuenta Blockfrost |
| **C · reconciliación y verificación** ✅ | `/verify` verifica contra la cadena, no contra la API | `reconcile()` en lectura (D-077, `reconciliarParaLectura` en cinco routers), `verify()` público (`AnchorPort.verify()`), estados de la UI (P1/P2, auditados `M3-2.3`) | medio: depende de disponibilidad de Blockfrost |

**Lo que queda de B es Preprod, y no es código:** el adaptador es agnóstico del provider, así que pasar del devnet local a Preprod es cambiar la instancia de Lucid y tener una wallet fondeada.

**El corte es por riesgo, no por tamaño.** A no toca ningún secreto ni ninguna red y sin embargo
cierra el circuito entero: es donde se descubren los errores de diseño baratos.

## Alcance / NO-alcance

- **Cubre (A):** la interfaz del puerto, el adaptador simulado con verificación real (detecta
  doble gasto y hilos duplicados), el cableado en `PATCH /milestones/:id/state` y en la creación de
  stages, y la actualización de `OnChainEvent`.
- **NO cubre (A):** ninguna transacción de Cardano, ninguna dependencia de Lucid o Blockfrost,
  ninguna key. `ANCHOR_MODE=real` existe y **falla explícito** hasta la rebanada B.
- **NO cubre (ninguna):** `EvidenceBundle` ni el cálculo del Merkle root — sin eso, un stage
  `validationCritical` no puede completarse **con anclaje**, porque el validador exige 32 bytes
  (ver §Preguntas abiertas). Tampoco mainnet (D-013), ni valor de ningún tipo (D-021).

## Interfaz

```ts
type AnchorMode = "simulated" | "real";

interface AnchorPort {
  // mint: acuña el thread token y crea el hilo en Pending
  openThread(input: { datum: StageDatum }): Promise<AnchorReceipt>;
  // spend: gasta el hilo y lo recrea con el datum nuevo
  advanceThread(input: {
    outputRef: string;            // el UTxO del hilo, `txid#index`
    previous: StageDatum;
    next: StageDatum;
  }): Promise<AnchorReceipt>;
  verify(txid: string): Promise<AnchorProof | null>;
  awaitConfirmation(txid: string): Promise<AnchorProof>;
}

interface AnchorReceipt {
  txid: string;
  outputRef: string;              // el hilo QUE QUEDA vivo — estado crítico
  status: "Pending" | "Confirmed";
}
```

`openThread`/`advanceThread` espejan los dos handlers del validador. Los nombres del puerto son los
de D-014 (`anchor`, `verify`, `awaitConfirmation`); `anchor` se abre en dos porque `mint` y `spend`
son operaciones distintas con precondiciones distintas.

## Invariantes

1. **Nada fuera de `packages/cardano` importa Lucid ni Blockfrost** (D-014). La API llama al puerto.
2. **El registro nunca depende del anclaje.** Si el puerto falla, la declaración ya está escrita y
   el evento queda `Failed`; jamás al revés (D-059). **Incluye el puerto que no se pudo construir**
   (D-075): configuración rota inhabilita el anclaje, no la API. Un puerto inhabilitado rechaza toda
   operación, así que no produce ningún TXID — degradar nunca significa aflojar la regla 17.
3. **Idempotencia (regla 8):** un `OnChainEvent` que ya tiene `txid` no se vuelve a anclar. El
   índice único `(milestoneId, eventIndex)` es la barrera.
4. **Un hilo vivo por stage.** El simulador rechaza abrir un segundo hilo para un `stageRef` que ya
   tiene UTxO sin gastar — es la propiedad del thread token, verificada sin cadena.
5. **El `outputRef` se persiste siempre** que exista. Perderlo es perder el hilo: el token queda en
   un UTxO que nadie sabe cuál es y ese stage no se mueve nunca más.
6. **El simulador aplica las mismas reglas que el validador**, no menos: transición válida,
   identidad preservada, evidencia en stages críticos, doble gasto. Un simulador que dice que sí a
   todo no simula: miente.
7. **`ANCHOR_MODE` no tiene default inseguro** (D-042): `simulated` es el default; `real` sin
   configuración completa revienta al arrancar, no en el primer anclaje.
8. **Anclar es secuencial por stage.** El evento N no se ancla hasta que N−1 tenga `outputRef`.

## Casos borde (definen los tests)

| Caso | Esperado |
|---|---|
| Abrir hilo de un stage que ya tiene uno vivo | rechazo (invariante 4) |
| Avanzar desde un `outputRef` ya gastado | rechazo por doble gasto |
| Avanzar desde un `outputRef` inexistente | rechazo |
| Avanzar con una transición fuera de la tabla | rechazo (espeja `valid_transition`) |
| Avanzar reescribiendo `sequenceOrder` o `validationCritical` | rechazo (espeja `identity_preserved`) |
| Completar un stage crítico sin `evidenceRoot` de 32 bytes | rechazo (espeja `completion_evidence_ok`) |
| Anclar dos veces el mismo evento | el segundo no produce transacción nueva |
| El puerto tira una excepción | la declaración queda escrita, el evento en `Failed`, respuesta 200 |
| `ANCHOR_MODE=real` en la rebanada A | error explícito al construir el puerto |
| El puerto no se puede construir (falta un secreto, Blockfrost caído) | la API arranca con el puerto inhabilitado; todo anclaje rechaza (D-075) |
| El mismo payload anclado dos veces | mismo `txid` (el simulador es determinístico) |

## Plan de trabajo — el vertical local completo

El objetivo del dueño, textual: *"quiero poder testear de forma local el flujo completo. Crear un
proyecto en la app, subir un documento, y enviar el hash de esa evidencia al smart contract"*. Eso
es más que el `AnchorPort`: son seis piezas, y solo dos necesitan Docker.

| # | Pieza | Necesita | Estado |
|---|---|---|---|
| 1 | **Todo stage es `validation_critical`** — su decisión | — | **hecha** (D-061) |
| 2 | Transacciones reales contra el **`Emulator`** de Lucid: `mint` + `spend` con el validador ejecutándose de verdad | — | **hecha** |
| 3 | **`EvidenceBundle`**, Merkle root y el endpoint de anclaje **manual del admin** | — | **hecha** |
| 4 | **MinIO** por `compose.dev.yml` + cliente S3 (D-011) | Docker | **hecha** |
| 5 | **yaci-devkit**: devnet local con Conway + Plutus V3 | Docker | **hecha** |
| 6 | **Frontend**: crear proyecto → subir PDF → botón *anclar* → ver el TXID | — | pendiente |

**El `Emulator` cambia el orden.** Lucid trae un ledger en proceso que **ejecuta el validador**, así
que las transacciones se prueban sin Docker y en CI: yaci deja de ser el requisito para probar y
pasa a ser el escalón de realismo (nodo real, fees reales, persistencia). El camino es
`Emulator → yaci local → Preprod`, y el código del adaptador es el mismo en los tres.

## Preguntas abiertas

1. **¿Todos los stages tienen hilo, o solo los `validationCritical`?** D-008 justifica el validador
   donde importa la integridad de la *secuencia*. Anclar todo es más simple de explicar; anclar
   solo los críticos cuesta menos fee y menos ADA inmovilizada. **Default vigente: todos**, porque
   hoy no cuesta nada en Preprod y evita una regla más. Se decide antes de la rebanada B.
2. ~~**El Merkle root del bundle.**~~ **Cerrada**: `EvidenceBundle` existe (en `0000_init.sql`), el
   root se calcula con `merkleRoot` de `packages/shared` y viaja al datum al completar. Lo que
   **sigue abierto** es la otra mitad de D-028: atribución de autoridad (`issuingAuthority`; D-084
   sacó `authorityReference`) y atestación del revisor, que son columnas que no existen. **Dueño:
   producto.**
3. **Qué pasa con un anclaje que falla definitivamente.** `status = "Failed"` existe y nadie lo
   escribe todavía. ¿Reintento automático, o queda visible como "no anclado"? Es decisión de
   producto, no técnica.
4. **La wallet de servicio no se puede rotar sin migrar los hilos**: el validador está
   parametrizado por `admin`, así que cambiar la wallet cambia la dirección del script. Hay que
   saberlo antes de generar la seed de la rebanada B, no después.
