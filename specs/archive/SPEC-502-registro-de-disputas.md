# SPEC-502 — Registro de disputas

> Milestone 4, criterio 1 (`disputes ≤3%`) y output 1 (fallback: *"failed inspection →
> re-inspection/refund"`). Ver [`ESTADO-2026-09-22-catalyst-milestone-4.md`](ESTADO-2026-09-22-catalyst-milestone-4.md).
>
> **Cerrada 2026-10-21.** Módulo `apps/api/src/modules/disputas/`, contrato en
> `packages/shared/src/contract/disputas.ts`, tabla en la migración `0014_dispute.sql`; los casos
> borde de abajo son `apps/api/test/spec-502-disputas.test.ts`.

## Propósito

El dominio no tiene hoy ningún lugar para registrar que un investor y un developer no están de
acuerdo sobre algo — ni el "failed inspection → re-inspection/refund" del output 1, ni el
`disputes ≤3%` del criterio 1 tienen dónde vivir. `Observed` (D-020) ya cubre la re-inspección
**cuando las dos partes están de acuerdo en que la evidencia no alcanza** — eso no es una disputa,
es el camino normal de remediación. Una disputa es cuando **no** están de acuerdo, o cuando el
desenlace no es "subir mejor evidencia" sino "devolver el pago liberado".

## Alcance / NO-alcance

- **Cubre:** una entidad `Dispute` que cualquiera de las dos partes de un stage puede abrir, referida
  a un `Stage` y opcionalmente a una `PaymentAttestation` (cuando el reclamo es sobre plata ya
  liberada). Un ciclo de vida corto: `Open → Resolved` con una resolución de texto libre y quién la
  cerró. Cubre el cálculo de `disputeRate` que `SPEC-501` consume.
- **NO cubre:** ejecutar un reembolso — la regla 17/D-021 no cambia: la plataforma nunca mueve
  valor. Una disputa resuelta como "reembolso" registra la **declaración** de que las partes
  acordaron reembolsar fuera de la plataforma, igual que `PaymentAttestation` registra una
  liberación que ocurrió "por los canales normales" (ver su docstring en `apps/api/CLAUDE.md`). No
  cubre mediación ni arbitraje — quién decide el desenlace es un acuerdo humano, no un flujo de la
  app.

## Interfaz

```
POST /disputes                          { stageId, reason }              → 201 Dispute (status: "Open")
GET  /disputes?projectId=&status=       lista, scopeada por proyecto
POST /disputes/:id/resolve              { resolution, outcome }          → 200 Dispute (status: "Resolved")
```

`outcome` es un enum cerrado, no texto libre, porque `disputeRate` y el reporte del milestone
necesitan distinguirlo: `"ReInspectionAgreed" | "RefundAgreed" | "Dismissed"`.

| Tabla | Columnas nuevas |
|---|---|
| `Dispute` | `id, stageId, projectId, openedById, reason, status, outcome, resolution, resolvedById, createdAt, resolvedAt` |

`projectId` se guarda directo (no se resuelve por join) — mismo motivo que evitó la deuda de
`AuditLog.projectId` (§Fuera de alcance de este milestone, `CLAUDE.md` raíz): filtrar disputas por
proyecto es exactamente la consulta que ese ítem señala como cara sin la columna.

## Invariantes

- **Autorización en dos capas + pertenencia**, como toda ruta nueva (reglas 5-6, checklist de
  `apps/api/CLAUDE.md`): solo el developer o el investor de la unidad del stage (`OwnerSource` vía
  `ContractOfUnit`, o el developer por `requireProjectAccess`) puede abrir una disputa sobre ese
  stage; solo `admin` o `certifier` del proyecto la resuelve — abrirla y resolverla son roles
  distintos a propósito, para que no sea la misma parte la que abre y cierra su propio reclamo.
- Una disputa `Resolved` es terminal — no vuelve a `Open`. Un reclamo nuevo sobre el mismo stage es
  una fila nueva.
- **Cero PII en `reason`/`resolution` que termine en metadata on-chain** (regla 2) — estos campos
  jamás se anclan; son 100% off-chain, a diferencia de la evidencia. Ninguna disputa produce un
  `OnChainEvent`.
- Toda mutación escribe `AuditLog` (regla 7).

## Casos borde (definen los tests)

- Abrir una disputa sobre un stage `Completed` — permitido: el output 1 pide justo el caso de una
  liberación ya hecha que se disputa después.
- Dos disputas abiertas sobre el mismo stage al mismo tiempo — permitido, cada una es independiente.
- Resolver con `outcome: "RefundAgreed"` sin que exista ninguna `PaymentAttestation` en ese
  stage — rechazado: no se puede declarar un reembolso de algo que nunca se liberó.
- Un investor intenta resolver su propia disputa — 403.
- `disputeRate` con cero stages completados en el denominador — el endpoint de `SPEC-501` devuelve
  `null`/`"sin datos"`, no `0` ni división por cero.

## Lo que quedó decidido al implementar

- **El denominador de `disputeRate` es por release** (dueño, 2026-10-21, D-104): disputas /
  `PaymentAttestation`. El numerador cuenta **toda** disputa abierta, también la `Dismissed`: el
  criterio mide cuánto se reclama, no cuánto se le da la razón al que reclama. Sin liberaciones,
  `null`; con más disputas que liberaciones, la tasa pasa de 1 y se muestra así. El cálculo es
  `tasaDeDisputas` (`modules/disputas/casos.ts`), que consume `SPEC-501`.
- **Abrir es del developer y del buyer del proyecto, sin admin**: los stages son del proyecto
  (D-029), así que "el investor de la unidad del stage" es el que tiene membresía `buyer`, que nace
  al aceptar la invitación. El admin y el certifier no son partes.
- **El comprador no lista** (`GET /disputes` es de admin, developer y certifier): el `reason` de
  otro comprador del mismo proyecto no es suyo para leer, y la guarda no sabe filtrar "solo las
  mías" sin un `if` en el handler. Su disputa le vuelve en el 201 de `POST /disputes`.
- **`projectId` es obligatorio en `GET /disputes`**: es lo que la guarda de dos capas lee.
- **Resolver es un reclamo condicional** (`status = 'Open'` en el `UPDATE`) con su audit en el mismo
  lote: dos resoluciones a la vez, gana una y la otra es `409 DISPUTE_ALREADY_RESOLVED`.
- **El audit no lleva `reason` ni `resolution`**: son texto libre. Lleva el `stageId` al abrir y el
  `outcome` al resolver.
- **Sin superficie en la web**: ni M2-D2 ni M2-D5 tienen una pantalla de disputas. Las cifras se ven
  en la sección de `/admin` de `SPEC-501`; abrir y resolver, por ahora, solo por la API.
