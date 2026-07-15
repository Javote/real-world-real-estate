# 03 — Especificación de API REST

Base: `http://localhost:8787`. JSON. Auth: `Authorization: Bearer <jwt>` salvo endpoints públicos. Todos los cuerpos validados con Zod desde `packages/shared` (un schema por endpoint: `<Nombre>Request` / `<Nombre>Response`).

**Formato de error uniforme:**

```json
{ "error": { "code": "MILESTONE_INVALID_TRANSITION", "message": "..." } }
```

Códigos HTTP: 400 validación, 401 sin auth, 403 rol/membresía, 404, 409 conflicto de estado, 422 regla de negocio, 500.

**Paginación:** cursor opaco — `?cursor=` en query, `{ items, nextCursor }` en respuesta.

---

## Auth — M3-BE-01

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/login` | `{email, password}` → `{accessToken, refreshToken, account}`. Multi-rol: el rol viene del account. |
| POST | `/auth/refresh` | Rota refresh token. |
| GET | `/auth/me` | Cuenta actual + rol + membresías. |

Guards: `requireRole("developer" | "investor" | "notary" | "certifier")` + `requireProjectMembership(projectId)` donde aplique.

## Browse público — M3-BE-02

| GET | `/projects?status=&sort=&q=&bbox=` | Listado público con filtros, búsqueda typeahead (`q`) y bounding box para mapa (`bbox=w,s,e,n`). |
| GET | `/projects/:id` | Detalle público. |
| GET | `/projects/:id/documents` | Documentos públicos del proyecto (metadata + badge de verificación; nunca storage keys crudas — URLs prefirmadas con expiración). |
| GET | `/projects/:id/stages` | Etapas con estado (para ProgressTimeline). |
| GET | `/projects/:id/stages/:stageId` | Detalle de etapa + evidencia visible. |
| GET | `/projects/:id/building-schematic` | Esquema del edificio (units por piso). |

## Projects (developer) — M3-BE-03 / Stages — M3-BE-04

| POST | `/developer/projects` | Crear proyecto (nombre, descripción, geo, unidades iniciales). |
| GET | `/developer/projects` / `/:id` | Lista y detalle propios. |
| PATCH | `/developer/projects/:id` | Editar. |
| GET | `/developer/progress` | Progreso cross-proyecto (por etapa). |

## Units — M3-BE-06

| GET | `/developer/projects/:id/units` · POST idem · PATCH `/developer/units/:id` | ABM de unidades. |
| GET | `/developer/units` | Inventario cross-proyecto con ocupación. |
| GET | `/investor/units` · `/investor/units/:id` · `/investor/units/:id/news` | Mis unidades, detalle con timeline, novedades. |

## Favoritos — M3-BE-05

| GET | `/investor/favorites` · POST/DELETE `/investor/favorites/:projectId` |

## Notificaciones — M3-BE-07

| GET | `/investor/notifications?unitId=&category=` · GET `/notifications/unread-count` · PATCH `/notifications/:id/read` | Role-scoped y filtrable por categoría. |

## Contratos y releases — M3-BE-08

| GET | `/investor/contracts/:unitId` · GET `/contracts/:contractId/releases` |
| GET | `/developer/projects/:id/contracts` |
| POST | `/developer/contracts/:id/releases/:stageNum` | Ejecuta liberación por etapa → **TXID** (M3-SC-03 en fase B; en fase A registra release + ancla commitment). |

## Perfil — M3-BE-09

| GET/PATCH | `/profile` · PATCH `/profile/notifications` | Reusable por los 4 roles (idioma, prefs, credenciales del certificador/notario). |

## Invitaciones — M3-BE-10 (+ M3-SC-01)

| POST | `/developer/projects/:id/invitations` | `{email, unitId, amount}` → crea invitación y **ancla TXID**. |
| GET | `/investor/invitations/:id` |
| POST | `/investor/invitations/:id/accept` | → **TXID** de aceptación. |
| POST | `/investor/invitations/:id/decline` |

## KPIs y dashboards — M3-BE-11

| GET | `/developer/kpis` · `/developer/capital/summary` · `/developer/capital/monthly` · `/developer/capital/by-project` |
| GET | `/certifier/kpis` · `/notary/kpis` |

## Dossier — M3-BE-12

| GET | `/investor/units/:id/dossier` | Compilación completa (evidencia + hashes + TXIDs + estados). |
| GET | `/investor/units/:id/dossier/export.pdf` | Export PDF. |
| POST | `/investor/units/:id/dossier/share` | → `{shareToken}`. |
| GET | `/public/dossier/:shareToken` | Vista pública de solo lectura, sin datos personales de terceros. |

## Anclaje de evidencia — M3-BE-13 (+ M3-SC-02)

| POST | `/developer/projects/:id/stages/:stageId/evidence` | **Multipart** (archivos + `{category, evidenceType, notes}`). Pipeline: validar → S3 → SHA-256 por archivo → Merkle root → anchor tx → respuesta `{bundleId, files:[{id, sha256}], merkleRoot, txid, explorerUrl}`. |
| GET | `/evidence/:bundleId/files` | Archivos del bundle con hashes. |
| GET | `/evidence/:bundleId/proof/:fileHash` | Prueba de inclusión Merkle `{leaf, path[], root, txid}`. |

## Documentación — M3-BE-14 (+ M3-SC-06)

| GET | `/developer/documents?status=` · POST `/developer/documents` (anchor de documento suelto → TXID). |

## Directorio de inversores — M3-BE-15

| GET | `/developer/investors` |

## Audit log — M3-BE-16

| GET | `/developer/audit-log?category=&cursor=` | Ledger append-only paginado, 5 categorías: `auth`, `project`, `evidence`, `milestone`, `governance`. |

## Workflow notarial — M3-BE-17 (+ M3-SC-04)

| GET | `/notary/kpis` · `/notary/dossiers/pending` · `/notary/dossiers/:id` |
| POST | `/notary/dossiers/:id/sign` | → `{signatureTxid}` (commit de firma sobre hash del dossier). |
| POST | `/notary/dossiers/:id/reject` | `{observations}`. |
| GET | `/notary/signatures?cursor=` | Historial firmado (dossier hash + TXID). |

## Workflow de certificación — M3-BE-18 (+ M3-SC-05)

| GET | `/certifier/kpis` · `/certifier/assignments` · `/certifier/stages/:stageId` |
| POST | `/certifier/stages/:stageId/certify` | Valida precondiciones de la máquina de estados → commit on-chain → `{certificateHash, txid}` → estado `Certified`. |
| POST | `/certifier/stages/:stageId/observe` | `{notes}` → estado `Observed` (correctivo). |
| GET | `/certifier/certificates?cursor=` | Historial emitido. |

---

## Convenciones de implementación

- Un router Hono por dominio (`auth.ts`, `projects.ts`, `evidence.ts`, `notary.ts`, `certifier.ts`, ...), montados en `app.route()`.
- Middleware: `authJwt` → `requireRole` → `requireProjectMembership` → handler.
- Toda mutación relevante llama `audit(category, action, actor, entity)` antes de responder.
- Ningún endpoint devuelve `storage_key`; siempre URL prefirmada con TTL ≤ 15 min.
- Los TXID devueltos incluyen `explorerUrl = ${EXPLORER_BASE}/tx/${txid}` para los modales `TxidModal` / `AnchoringSuccessModal`.
