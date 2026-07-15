# CLAUDE.md — cardano-real-estate-backend

## Contexto (3 líneas)

PoC de una plataforma de tokenización inmobiliaria (RWA): backend que gestiona proyectos de construcción, sus hitos (milestones) y la evidencia documental de avance, con hash SHA-256 de cada archivo como ancla para verificación on-chain futura. Incluye validadores Aiken (Cardano) que replican la máquina de estados de milestones on-chain. La integración backend↔Cardano se desarrolla en otro repositorio (ver ADR-008).

**Jerarquía de precedencia documental:** DECISIONS.md > CLAUDE.md > specs/ > docs/context/ (histórico). El documento en conflicto se corrige en el mismo PR en que se detecta la contradicción.

## Stack (cerrado — ver DECISIONS.md antes de cambiar algo)

- Node.js + TypeScript, Express **4** (no migrar a 5 sin ADR)
- Prisma ORM + SQLite en desarrollo (Postgres al desplegar, ADR-003)
- Zod para validación de entrada, JWT + bcrypt para auth, Multer para uploads
- Smart contracts: Aiken v1.1.21, Plutus V3, stdlib v3.0.0 (en `smart-contracts/`)

## Estructura

```
src/
  app.ts               # Express app: middlewares + montaje de rutas
  server.ts            # entrypoint (app.listen)
  routes/              # un router por recurso (auth, users, projects, milestones, evidence, audit)
  middlewares/         # authenticate, requireRole, canAccessProject, errorHandler
  lib/                 # prisma client, jwt, multer (upload)
  utils/               # sha256File, writeAuditLog
prisma/                # schema, migraciones, seed
smart-contracts/       # proyecto Aiken independiente (validators/, aiken.toml)
specs/                 # specs con índice-registro en specs/README.md
docs/context/          # contexto histórico del proyecto
```

## Comandos reales

```bash
npm run dev              # servidor en watch (tsx), puerto 3000
npm run typecheck        # tsc --noEmit — correr SIEMPRE antes de proponer un cambio
npm run build            # compila a dist/
npm run prisma:generate  # regenerar cliente tras tocar schema.prisma
npm run prisma:migrate   # nueva migración en desarrollo
npm run seed             # datos demo (usuarios admin/dev/buyer/verifier, proyecto torre-a)
cd smart-contracts && aiken check   # compila y corre tests de los validadores
```

Smoke test manual: `npm run dev`, luego `POST /api/v1/auth/login` con `admin@example.com` / `admin123` y `GET /api/v1/projects` con el token.

## Reglas duras (innegociables)

1. **Passwords solo con bcrypt** (cost 10). Jamás loguear ni devolver `passwordHash` en ninguna respuesta.
2. **Todo archivo subido recibe hash SHA-256** calculado del archivo en disco y persistido en `Evidence.sha256Hash`. Ese hash es el ancla de la verificación on-chain futura: no se recalcula ni se edita después de creado.
3. **Toda mutación escribe AuditLog** vía `writeAuditLog` (acción en MAYÚSCULAS_CON_GUIONES, ej. `CREATE_EVIDENCE`).
4. **Autorización en dos capas, siempre**: rol global (`requireRole`) + membresía por proyecto (`canAccessProject`). `admin` bypasea membresías; el resto solo ve proyectos donde es miembro.
5. **Todo body se valida con Zod** (`safeParse` + 400 con `error.flatten()`). Nada llega a Prisma sin pasar por un schema.
6. **Secretos solo por variables de entorno** (`.env` está gitignoreado; `.env.example` documenta las claves).
7. Si un upload falla la validación después de que Multer escribió el archivo, **borrar el archivo huérfano** antes de responder (patrón ya presente en `evidence.routes.ts`).
8. Uploads: solo `application/pdf`, `image/jpeg`, `image/png`; máximo `MAX_FILE_SIZE_MB` (default 10).

## Prohibiciones (qué NO hacer aunque parezca buena idea)

- **No subir `@types/express` a v5** mientras `express` sea v4: los tipos v5 declaran `req.params` como `string | string[]` y rompen todas las rutas (ver gotchas).
- **No editar migraciones ya aplicadas** en `prisma/migrations/`; siempre migración nueva.
- **No tocar `smart-contracts/build/`** (generado) ni editar `aiken.lock` a mano.
- **No integrar Cardano en este repo** (SDKs, Blockfrost, Lucid, etc.): esa integración vive en otro repositorio (ADR-008).
- **No agregar dependencias sin justificarlas** en el PR que las introduce.
- **No commitear** `.env`, `prisma/dev.db`, `uploads/` ni artefactos de build.
- **No usar float para dinero** si se agregan campos monetarios: enteros en unidad mínima (centavos / lovelace).

## Método LLM

- Spec-driven: el trabajo sobre el flujo de evidencia, el validador o auth arranca leyendo la spec correspondiente en `specs/` (índice en `specs/README.md`). Si el cambio contradice la spec, se actualiza la spec en el mismo PR.
- PRs chicos. Antes de proponer un cambio: `npm run typecheck` y, si tocaste contratos, `aiken check`.
- Toda decisión nueva o gotcha descubierto se persiste (DECISIONS.md o sección de gotchas de abajo) en el mismo PR. El chat es descartable; el repo es la memoria.

## Commits

Conventional Commits con tipos y scopes **cerrados**:

- **Tipos:** `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`
- **Scopes:** `api`, `db`, `contracts`, `specs`, `ci`, `repo`

Ejemplo: `feat(api): endpoint de descarga de evidencia con control de membresía`

### Tabla de autonomía LLM

| Nivel | Qué cubre | Regla |
|---|---|---|
| 🟢 Verde | docs, specs, tests, refactors sin cambio de comportamiento, rutas CRUD siguiendo patrones existentes | El LLM propone y aplica; el humano revisa el diff |
| 🟡 Amarillo | schema de Prisma + migraciones, middlewares de auth, manejo de archivos, CI | El LLM propone; el humano revisa línea por línea antes de aplicar |
| 🔴 Rojo | validadores Aiken, lógica de permisos (`canAccessProject`), hashing, todo lo que toque el ancla criptográfica | El LLM asiste; el humano escribe/aprueba y debe poder explicar cada línea sin mirar el chat |

## Gotchas (sección viva — agregar el mismo día que se descubren)

- **2026-07-15 · `@types/express` v5 con Express 4 rompe el typecheck** (21 errores `string | string[]` en `req.params`). Quedó pineado a `^4.17.21`. No "actualizar" ese paquete por su cuenta.
- **2026-07-15 · Warning `url.parse()` deprecado al arrancar el server**: viene de Multer 1.x, no de nuestro código. Inofensivo; desaparecería al migrar a Multer 2.x (requiere ADR por cambios de API).
- **2026-07-15 · `validators/milestone.ak` y `milestone2.ak` son casi idénticos** (mismo validador, uno con `when`, otro con `let` destructuring). Duplicación pendiente de consolidar — ver ADR-009 (Abierta).
- **2026-07-15 · Los validadores Aiken tienen 0 tests** (`aiken check` pasa en verde vacío). Escribir tests de `valid_transition` es la primera deuda de test del repo.
