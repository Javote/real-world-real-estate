# SPEC-502 — Registro de disputas

> Milestone 4, criterio 1 (`disputes ≤3%`) y output 1 (fallback: *"failed inspection →
> re-inspection/refund"`). Ver [`ESTADO-2026-09-22-catalyst-milestone-4.md`](ESTADO-2026-09-22-catalyst-milestone-4.md).

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

## Preguntas abiertas

- **¿El denominador de `disputeRate` es por stage, por contrato o por release?** El SOM dice
  "disputes ≤3%" sin definir sobre qué universo. Elegir uno antes de instrumentar — se propone
  **por release** (`PaymentAttestation`), porque el output 1 habla de "failed inspection" en el
  contexto de una liberación, y es la unidad que ya cuenta `SPEC-501`.
