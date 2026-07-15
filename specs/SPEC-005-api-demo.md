# SPEC-005 — API mínima de la demo (contract-first, anclaje desacoplado)

> **Estado tras la consolidación (2026-07-15):** la necesidad que cubría esta spec quedó satisfecha por la API real adoptada en D-016 (`packages/api`: Express + Prisma; contratos en SPEC-006 y SPEC-007) — los endpoints `/developer/*` de abajo **no se implementan**; los reales son `/api/v1/*`. Sigue vigente de esta spec: (a) el **contrato Zod compartido en `packages/shared`** como primera tarea al tocar la API para el front, y (b) el **costurón `anchorQueue`** (§3) que el Sprint 2 conecta a `AnchorPort`. Se conserva entera como referencia de diseño contract-first.

## Propósito

Implementar el subconjunto de la API (docs/03) que el frontend de la demo (SPEC-004) necesita, arrancando por el **contrato Zod compartido** — que es lo único que sincroniza ambos frentes. La subida de documentación calcula y persiste hashes pero NO ancla: deja el enganche listo para `AnchorPort` (SPEC-001).

## Alcance / NO-alcance

- **Cubre:** schemas Zod del dominio demo, auth con usuario seed, CRUD mínimo de proyectos con dirección/pisos/unidades, subida de documentos (multipart → storage → sha256 → `pending`), listado.
- **NO cubre:** anclaje on-chain (SPEC-001 lo enchufa después), roles no-developer, invitaciones, contratos, milestones (SPEC-002), notificaciones.

## Interfaz

### 1. Contrato compartido — **PRIMERA tarea, bloquea a ambos frentes** (`packages/shared/src/schemas/demo.ts`)

```ts
export const Address = z.object({ street: z.string().min(1), city: z.string().min(1) });

export const Project = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  address: Address,
  floors: z.number().int().min(1),
  unitsPerFloor: z.number().int().min(1),
  description: z.string().optional(),
  photoUrl: z.string().url().nullable(),
  documentCount: z.number().int(),
  createdAt: z.string().datetime(),
});
export const CreateProjectRequest = Project.pick({ name: true, address: true, floors: true, unitsPerFloor: true, description: true });

export const DocumentItem = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  fileName: z.string(),
  category: z.enum(["technical_plans","site_progress","certifications","permits","subdivision"]),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  sha256: z.string().length(64),
  anchorStatus: z.enum(["pending","anchored"]),   // ← el enganche con SPEC-001
  txid: z.string().nullable(),
  uploadedAt: z.string().datetime(),
});

export const LoginRequest = z.object({ email: z.string().email(), password: z.string().min(6) });
export const Session = z.object({ accountId: z.string().uuid(), displayName: z.string(), role: z.enum(["developer"]) });
```

### 2. Endpoints (subset de docs/03; mismos paths para que nada se tire después)

| Método y ruta | Request/Response | Notas |
|---|---|---|
| `POST /auth/login` | `LoginRequest` → `{ session, accessToken }` | usuario del seed: demo@demo.com / demo123 |
| `GET /auth/me` | → `Session` | |
| `GET /developer/projects` | → `Project[]` | |
| `POST /developer/projects` | `CreateProjectRequest` → `Project` | genera las unidades: `floors × unitsPerFloor` |
| `GET /developer/projects/:id` | → `Project` | |
| `GET /developer/projects/:id/documents` | → `DocumentItem[]` | |
| `POST /developer/projects/:id/documents` | multipart (`files[]`, `category`) → `DocumentItem[]` | valida MIME/tamaño → S3/MinIO → sha256 del stream → persiste con `anchorStatus:"pending"`, `txid:null` |

### 3. Enganche con el anclaje (NO implementar acá — solo dejar el costurón)

```ts
// documents.service.ts
const item = await saveDocument(file);            // S3 + sha256 + estado "pending"
await anchorQueue.enqueue(item.id);               // no-op en la demo
// Cuando SPEC-001 esté integrada: un worker toma la cola, arma el bundle,
// llama AnchorPort.anchor(), y actualiza { anchorStatus: "anchored", txid }.
```

`anchorQueue` con dos implementaciones: `noop` (demo) y la real (Sprint 2). Nada del handler cambia al integrar.

## Invariantes

1. Cada endpoint valida entrada y salida con los schemas de `shared` (los MISMOS que usa el mock del front — invariante 2 de SPEC-004).
2. `sha256` se calcula del stream subido en el servidor; nunca se confía en un hash enviado por el cliente.
3. `anchorStatus` solo transiciona `pending → anchored`, y solo con `txid` no nulo. Jamás vuelve atrás.
4. `storage_key` no aparece en ninguna respuesta; descargas por URL prefirmada TTL ≤ 15 min.
5. La contraseña del usuario demo vive hasheada en el seed, no en el código.

## Casos borde (definen los tests)

1. Login incorrecto → 401 `{error:{code:"INVALID_CREDENTIALS"}}`.
2. `POST /developer/projects` con `floors: 0` → 400 con detalle Zod.
3. Multipart con MIME fuera de whitelist → 422; nada en S3, nada en DB.
4. Multipart con 1 archivo válido y 1 inválido → 422 atómico (ninguno se guarda) — documentar la decisión en la respuesta.
5. Mismo archivo subido dos veces → dos DocumentItem distintos con el mismo `sha256` (permitido; la dedupe no es alcance).
6. `GET /developer/projects/:id` ajeno o inexistente → 404 (no 403 que filtre existencia).
7. Re-encolado del mismo documento en `anchorQueue` → idempotente (clave por document id).

## Preguntas abiertas

- ¿La demo corre con Postgres+MinIO (docker) o con SQLite+disco? **Default:** Postgres+MinIO vía `pnpm demo:full` (mismo camino que producción; el modo mock del front ya cubre el caso "sin docker").
