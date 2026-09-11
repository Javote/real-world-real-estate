# SPEC-205 — Dos invariantes que hoy sostiene la buena fe del cliente

> **Origen:** [`AUDITORIA-2026-09-11-calidad-del-backend.md`](AUDITORIA-2026-09-11-calidad-del-backend.md)
> §B-05 y §B-07. Nivel 🟢. **Independiente.** No toca ningún criterio del SOM.
>
> Van juntos porque son la misma frase dicha dos veces: **el backend valida una condición, y después
> escribe sin volver a exigirla**. En los dos casos hay un anclaje en Cardano del otro lado de la
> escritura, así que lo que queda mal escrito queda probado.

## B-05 · La FSM se valida sobre un estado que ya puede haber cambiado

`transitionStage` (`domain/stage-transition.ts:427`) lee el stage, pregunta
`canTransition(existing.state, to)` y escribe:

```ts
.updateTable("Stage")
.set(data)
.where("id", "=", input.stageId)      // ← sin condición sobre el estado que acaba de leer
.returningAll()
.executeTakeFirstOrThrow();
```

Dos `PATCH /stages/:id/state` simultáneos leen los dos `InProgress`, pasan los dos la tabla de
transiciones, y escriben los dos. El índice único `(stageId, eventIndex)` salva el `OnChainEvent`
duplicado —y es la idempotencia que la regla 8 promete— pero **el `UPDATE` de `Stage` ya corrió dos
veces**, y en el medio hay una llamada a la cadena que dura segundos.

**La técnica correcta ya está en el repo, en el archivo de al lado.** `domain/reconcile.ts:150`:

```ts
.where("id", "=", evento.id)
// Solo si sigue `Pending`: entre la consulta y el update pudo haber pasado
// otra tanda. Sin esto, dos disparos concurrentes se pisan.
.where("status", "=", "Pending")
```

**El arreglo:** sumar `.where("state", "=", existing.state)`, cambiar a `executeTakeFirst()` y, si no
hubo fila, devolver el mismo `STAGE_TRANSITION_INVALID` que ya existe. **El tipo `TransitionFailure`
no necesita un caso nuevo.**

## B-07 · Se puede liberar más de lo que el contrato dice, y el anclaje lo deja escrito

`releasePaymentSchema` es `z.strictObject({ amountMinorUnits: z.number().int().positive() })` y nada
más. `POST /developer/contracts/:id/releases/:stageNum` valida que la etapa esté `Completed` y que no
haya un release previo para ese `stageNumber`, pero **nada compara la suma de `PaymentAttestation`
contra `Contract.totalMinorUnits`** — que ni siquiera se selecciona en el query del handler
(`developer-comercial.routes.ts:365`). Un release de 999.999.999 sobre un contrato de 100.000 entra,
se registra y **se ancla su commitment en Cardano**.

La prueba de que la invariante no se sostiene está del lado de la lectura, en `capital.routes.ts:107`:

```ts
// No puede ser negativo: liberar más de lo contratado no es un estado
// alcanzable, pero si lo fuera el piso es cero y no un número absurdo.
pendingMinorUnits: Math.max(raised - released, 0),
```

El comentario dice "no es un estado alcanzable" y el código de al lado se defiende de él. Es una
defensa en el lugar equivocado: **la plataforma no custodia plata (D-021), pero sí vende el registro**,
y este registro admite hoy una afirmación falsa, anclada.

**El arreglo:** sumar `totalMinorUnits` al select, sumar lo ya liberado antes de insertar, y devolver
409 `RELEASE_EXCEEDS_CONTRACT` con la misma forma que el `STAGE_NOT_CERTIFIED` que la ruta ya tiene
diez líneas arriba. La clave va a `packages/shared` (regla 15: claves, no copy).

## Invariantes

1. **Una transición escribe solo si el estado leído sigue siendo el estado real.**
2. **Una transición concurrente duplicada no produce un segundo `UPDATE` ni un segundo anclaje.**
3. **La suma de los `PaymentAttestation` de un contrato nunca supera su `totalMinorUnits`.**
4. **Nada que viole 1 o 3 llega a anclarse**: la validación va antes del `INSERT`, y el anclaje
   después.

## Casos borde (definen los tests)

| Caso | Esperado |
|---|---|
| Dos `PATCH .../state` concurrentes de `InProgress` → `Completed` | uno 200, otro `STAGE_TRANSITION_INVALID`; **un** `UPDATE`, **un** `OnChainEvent` |
| Transición válida sin concurrencia | idéntica a hoy |
| Release que iguala exacto el total restante | **entra** (el techo es `>`, no `>=`) |
| Release que lo supera por 1 unidad mínima | 409 `RELEASE_EXCEEDS_CONTRACT`, sin `INSERT` y sin anclaje |
| Dos releases concurrentes que juntos superan el total | a lo sumo uno entra; el otro 409 |
| Contrato sin releases previos | el techo es el total entero |
