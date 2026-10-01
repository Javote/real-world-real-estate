# SPEC-201 — Aceptar una invitación deja de poder sacarle la unidad a quien ya la compró

> **Origen:** [`AUDITORIA-2026-09-11-calidad-del-backend.md`](AUDITORIA-2026-09-11-calidad-del-backend.md) §B-01.
> Nivel 🟢. **Independiente.** No toca ningún criterio del SOM — **pero es corrupción de datos
> reproducida, y vale antes de mainnet**: repararlo después es SQL a mano contra producción, como
> las migraciones 0004 y 0005.

## El problema, reproducido

`POST /developer/projects/:id/invitations` (`developer-comercial.routes.ts:179`) valida que la unidad
pertenezca al proyecto y **no mira `Unit.status`**: se puede emitir una invitación a B por una unidad
que ya está `sold` a A.

Cuando B acepta, `POST /investor/invitations/:id/accept` (`investor.routes.ts:441`) hace cuatro
escrituras **sin transacción**, y la que puede fallar es la última:

```
1. UPDATE Invitation  SET status='accepted'
2. UPDATE Unit        SET status='sold', investorId = B    ← la unidad cambia de dueño
3. INSERT ProjectMember (B, buyer)
4. INSERT Contract                                         ← choca Contract_unitId_key
```

Salida real de la reproducción (dos invitaciones `pending` sobre la misma unidad, aceptadas en orden):

```
accept A → 201
accept B → 409 {"message":"Resource already exists","code":"RESOURCE_ALREADY_EXISTS"}

Unit.investorId  = B            ← la unidad es de B
Unit.status      = sold
Contratos        = [ 'A' ]      ← el contrato es de A
ProjectMember    = [ 'A', 'B' ] ← B quedó con membresía de lectura
```

**Las consecuencias son las que el producto promete que no pasan:**

- **A pierde su unidad en silencio.** `GET /investor/units` filtra `Unit.investorId = usuario`, así
  que la unidad desaparece de su portfolio; `GET /investor/units/:id` le devuelve **403**, porque el
  guard `{ dueño: { via: "Unit" } }` lee esa misma columna.
- **B se lleva lectura del proyecto entero**: stages, evidencia y pruebas de Merkle. Es exactamente
  el aislamiento cross-rol de M2-D1 §Cross-role data isolation.
- **La invitación de B queda `accepted`** sobre una aceptación que falló.

## Qué se cambia

| | Dónde | Qué |
|---|---|---|
| 1 | `investor.routes.ts` · accept | las **4 escrituras adentro de `db.transaction()`** |
| 2 | `investor.routes.ts` · accept | `.where("status", "=", "pending")` en el `UPDATE Invitation` y chequear `numUpdatedRows` |
| 3 | `developer-comercial.routes.ts` · emitir | 409 si `Unit.status !== "available"` |

**La forma ya existe y está bien usada**: `POST /developer/projects` (`developer.routes.ts:175`) es
hoy la **única** `db.transaction()` de todo `src`, y su comentario explica por qué proyecto +
membresía + las 10 etapas nacen atómicos. Es el mismo argumento.

El punto 2 cierra además **el doble click concurrente sobre una sola invitación**: hoy los dos
requests pasan el `if (invitacion.status !== "pending")` porque leen antes de que el otro escriba.

## El anclaje queda afuera de la transacción

`anchorCommitmentEvent` es una transacción de **Cardano**: no puede ser atómica con la base, y D-059
dice que el registro nunca depende de ella. **Se ancla después del `commit`, como hoy.** El
`writeAuditLog` también queda afuera, porque consume `anchor.txid`.

## Invariantes

1. **Una unidad `sold` no admite invitaciones nuevas.**
2. **Aceptar es todo o nada**: no existe un estado con la unidad transferida y sin contrato, ni con
   membresía otorgada y sin contrato.
3. **Una invitación se acepta exactamente una vez**, aunque lleguen dos requests en el mismo
   milisegundo.
4. **El 409 describe lo que pasó**: `UNIT_NOT_AVAILABLE` / `INVITATION_NOT_PENDING`, no el
   `RESOURCE_ALREADY_EXISTS` genérico que hoy llega desde el índice único.
5. El anclaje sigue siendo best-effort y posterior al commit (D-059).

## Casos borde (definen los tests)

| Caso | Esperado |
|---|---|
| Dos invitaciones `pending` sobre la misma unidad, aceptadas en orden | la segunda **no** se emite (punto 3); si existía de antes, el accept falla sin tocar nada |
| Dos `accept` concurrentes sobre **la misma** invitación | uno 201, otro 409; **un solo** contrato, una sola membresía |
| Falla el `INSERT Contract` por cualquier motivo | `Unit.investorId` y `Unit.status` quedan como estaban; la invitación sigue `pending` |
| El anclaje falla después del commit | la aceptación queda firme y el evento queda `Pending` para reconciliar (D-059) |
| Invitación ya `declined` | 409 `INVITATION_NOT_PENDING`, sin escrituras |
| Reintento del mismo accept ya exitoso | 409, no un segundo contrato (regla 8) |

## Verificación

Los casos de arriba como tests en `apps/api/test/`, **incluido el concurrente** — la reproducción de
la auditoría ya existe como forma: dos `accept` en `Promise.all` sobre la misma base.
