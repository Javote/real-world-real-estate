# docs/context — Snapshots congelados

Material fuente **congelado**: nada de acá se edita nunca; una versión nueva es un archivo nuevo. Ante conflicto con cualquier otro documento, esto es histórico y pierde (precedencia: DECISIONS.md > CLAUDE.md > specs > docs).

| Qué | Dónde | Origen |
|---|---|---|
| Extracto técnico del material fuente (1 pág, alimenta las specs) | `extracto-tecnico.md` | Guía de implementación |
| Maqueta navegable PropTrust (login, dashboards por rol, detalle de proyecto, verificación pública) | `maqueta/3-demo-real-estate.html` (+ `.docx`) | Carpeta `analisis-funcional-y-maqueta-2` (2026-03/04) |
| Análisis funcional | `maqueta/analisis-funcional.md` (+ `.docx`) | Ídem |
| Imagen de referencia | `maqueta/imagen-real-estate.jpg` | Ídem |
| Registro de decisiones original del backend (ADR-001..009) | `backend/DECISIONS-backend.md` | Repo `cardano-real-estate-backend` (2026-07-15) |
| CLAUDE.md original del backend | `backend/CLAUDE-backend.md` | Ídem |

## Whitepaper — pendiente

A 2026-07-15 el whitepaper se está terminando en otro frente. **Cuando exista:** guardarlo acá como `whitepaper-vX.pdf` y, si supera ~5 páginas, agregar un extracto técnico de 1-2 páginas (o actualizar el existente).

## Estado del proyecto al momento de la consolidación (2026-07-15)

- Backend funcional (hoy `packages/api`): auth JWT, CRUD de usuarios/proyectos/milestones, upload de evidencia con SHA-256, audit log. Verificado end-to-end.
- Validadores Aiken compilan; sin tests todavía.
- Maqueta: referencia visual/UX; su login hardcodeado y su JS vanilla NO son referencia de implementación.
- Frontend: pantallas de la maqueta portadas a TanStack Start en `apps/web`, conectadas a la API real.
