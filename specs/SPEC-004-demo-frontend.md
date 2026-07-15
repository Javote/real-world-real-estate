# SPEC-004 — Demo local: frontend navegable (login → crear proyecto → subir documentación)

> **Estado tras la consolidación (2026-07-15):** `apps/web` ya existe con las pantallas portadas de la maqueta PropTrust (`docs/context/maqueta/`) y un `ApiPort` con **adaptador real** contra la API existente (`packages/api`, SPEC-006/007) — no contra los endpoints `/developer/*` del borrador de SPEC-005. El usuario demo es el del seed del backend (`admin@example.com` / `admin123`, más los roles developer/buyer/verifier). Pendiente de esta spec: el adaptador `mock` y sus casos borde. Las rutas y componentes de dominio de abajo siguen siendo el contrato.

## Propósito

Poder levantar el proyecto en local y **mostrar** un flujo completo desde el navegador: un usuario demo se loguea, crea un proyecto (dirección, pisos, unidades), sube documentación y la ve listada con su estado de anclaje. Estética provisional tipo Airbnb (grid de cards con foto, dirección, chips) — el diseño final la reemplaza después sin tocar la lógica.

## Alcance / NO-alcance

- **Cubre:** login hardcodeado, listado y creación de proyectos, detalle de proyecto, subida y listado de documentación, estado `pending_anchor`/`anchored` visible, modo de datos mock|real conmutables.
- **NO cubre:** anclaje real (SPEC-001 se integra después), roles investor/notary/certifier, diseño final D1/D3, registro de usuarios, permisos finos, i18n completo.

## Interfaz

**Usuario demo (hardcodeado en seed, no en el código del front):** `demo@demo.com` / `demo123`, rol `developer`.

**Rutas (TanStack Start):**

| Ruta | Contenido |
|---|---|
| `/login` | email + password, error simple |
| `/projects` | grid estilo Airbnb: `ProjectCard` (imagen placeholder, nombre, dirección, chips: N pisos · M unidades · D documentos) + botón "Nuevo proyecto" |
| `/projects/new` | form: nombre*, dirección* (calle, ciudad), pisos* (int ≥1), unidades por piso* (int ≥1), descripción, foto (opcional, placeholder si falta) |
| `/projects/:id` | header con dirección y foto; resumen de pisos/unidades; sección **Documentación**: dropzone + tabla (nombre, categoría, tamaño, `HashChip` con sha256, `StatusPill` con estado de anclaje, fecha) |

**Puerto de datos (espejo de `AnchorPort`, principio D-014):** el front **jamás hace `fetch` directo**; todo pasa por `ApiPort` (`apps/web/src/api/port.ts`) con dos adaptadores:
- `mock`: en memoria, arranca con seed (1 proyecto de ejemplo con 2 documentos), latencia simulada 200–500 ms, valida con los mismos schemas Zod. Es producto, no stub: permite demo sin backend.
- `real`: llama a la API de SPEC-005.
Selección por `VITE_API_MODE=mock|real` (default `mock`).

**Contrato de datos:** exclusivamente los schemas Zod de `packages/shared/src/schemas/demo.ts` (ver SPEC-005 — son los mismos). El front no define tipos propios de dominio.

**Componentes de dominio usados desde el día 1** (aunque el diseño sea provisional): `HashChip`, `StatusPill`, `ProjectCard` en `src/components/domain/`.

**Comando:** `pnpm demo` = front en modo mock (`:3000`). `pnpm demo:full` = front en modo real + api + docker (db/minio).

## Invariantes

1. Ninguna llamada de red fuera de `ApiPort`; los dos adaptadores implementan exactamente la misma interfaz tipada.
2. Todo dato mostrado o enviado valida contra los schemas de `shared` (si el mock y la API divergen, TypeScript rompe en CI — ese es el mecanismo de sincronización).
3. Un documento recién subido SIEMPRE muestra `anchor_status: "pending"` y `HashChip` con su sha256 (el hash se calcula aunque no haya anclaje).
4. El modo mock funciona sin backend, sin Docker y sin red.
5. La sesión demo vive en memoria/cookie de sesión; nada de tokens hardcodeados en el bundle.

## Casos borde (definen los tests)

1. Login con credenciales incorrectas → error visible, sin redirect.
2. Crear proyecto sin dirección o con pisos = 0 → validación Zod en el form, submit bloqueado.
3. Subir archivo con MIME fuera de whitelist → rechazo en UI con mensaje, nada llega al adaptador.
4. Subir 3 archivos a la vez → 3 filas `pending` con sus 3 hashes distintos.
5. `VITE_API_MODE=real` sin API levantada → estado de error claro con instrucción ("levantá la API: pnpm demo:full"), no pantalla blanca.
6. Recargar en modo mock → el seed se restablece (documentado en la UI con un badge "modo demo").
7. Proyecto sin foto → placeholder, la card no se rompe.

## Preguntas abiertas

- ¿Persistencia del mock entre recargas? **Default:** no (seed en memoria); si la demo lo pide, IndexedDB después.
- ¿Mapa en la card (dirección geocodificada)? **Default:** no en la demo; texto de dirección alcanza.
