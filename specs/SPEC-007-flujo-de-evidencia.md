# SPEC-007 — Flujo de evidencia

> Adoptada del repo backend en la consolidación (2026-07-15), donde era su SPEC-001. Describe código **ya escrito y verificado** en `packages/api`. Referencias de decisión: D-016 (absorbe ex ADR-005); el anclaje on-chain del hash llega por SPEC-001 de este repo.

## Propósito

La evidencia es el corazón del producto: archivos (documentos, fotos, certificados) que prueban el avance de obra de un proyecto/milestone. Cada archivo recibe un hash SHA-256 inmutable que actúa como ancla de integridad para la verificación on-chain (SPEC-001).

## Alcance / NO-alcance

- **Cubre:** upload con validación, hash, listado, detalle, descarga, edición de metadatos y borrado de evidencia. Almacenamiento en disco local (transición a S3: D-011).
- **NO cubre:** anclado del hash on-chain (SPEC-001 / `packages/cardano`), versionado de archivos, verificación de autenticidad del contenido del archivo.

## Interfaz

| Método y ruta | Rol requerido | Membresía | Descripción |
|---|---|---|---|
| `GET /api/v1/projects/:id/evidence` | cualquiera autenticado | cualquiera del proyecto | Lista con milestone y uploader |
| `POST /api/v1/projects/:id/evidence` | admin \| developer | developer (admin bypasea) | Upload multipart, campo `file` |
| `GET /api/v1/evidence/:id` | cualquiera autenticado | cualquiera del proyecto | Detalle |
| `GET /api/v1/evidence/:id/download` | cualquiera autenticado | cualquiera del proyecto | Descarga con nombre original |
| `PATCH /api/v1/evidence/:id` | admin \| developer | developer (admin bypasea) | Solo metadatos |
| `DELETE /api/v1/evidence/:id` | admin | — | Borra registro y archivo físico |

Body del POST (multipart): `file` (obligatorio), `evidenceType` ∈ {document, photo, certificate}, `category` (string no vacío), `milestoneId` (opcional), `authoritative` ("true"/otro, se transforma a boolean).

## Invariantes

1. Toda evidencia persistida tiene `sha256Hash` calculado sobre el archivo en disco; el hash nunca se recalcula ni se edita (el PATCH no lo acepta).
2. Tipos MIME permitidos: `application/pdf`, `image/jpeg`, `image/png`. Tamaño máximo: `MAX_FILE_SIZE_MB` (default 10 MB).
3. El nombre almacenado se aleatoriza (`timestamp-random-nombreSaneado`); el nombre original se conserva solo como metadato y se usa en la descarga.
4. Si la request falla después de que Multer escribió el archivo (403, validación, proyecto/milestone inexistente), el archivo huérfano se borra antes de responder.
5. `milestoneId`, si viene, debe pertenecer al mismo proyecto de la evidencia.
6. Toda mutación (create/update/delete) escribe `AuditLog` con el actor.
7. Al borrar evidencia se borra también el archivo físico.

## Casos borde (definen los tests)

- POST sin `file` → 400, sin registro creado.
- POST con MIME no permitido → error de Multer → 400 vía errorHandler, sin archivo residual.
- POST con `milestoneId` de OTRO proyecto → 400 "Milestone does not belong to project" y archivo borrado.
- POST por developer sin membresía en el proyecto → 403 y archivo borrado.
- POST por buyer/verifier → 403 (capa de rol, antes de Multer).
- GET/download de evidencia de un proyecto donde el usuario no es miembro → 403.
- Download cuando el archivo físico ya no existe en disco → 404 "Stored file not found" (el registro DB sobrevive).
- PATCH con `milestoneId: null` → desvincula del milestone (permitido).
- DELETE idempotencia: segundo DELETE del mismo id → 404.

## Preguntas abiertas

- No hay suite de tests que cubra estos casos (deuda declarada en CLAUDE.md). Framework a decidir (default razonable: vitest + supertest).
- `authoritative` se persiste pero ninguna regla lo consume aún; su semántica final depende del flujo de certificación on-chain.
