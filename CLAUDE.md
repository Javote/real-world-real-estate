# CLAUDE.md

## Contexto (3 líneas)

Plataforma de ventas inmobiliarias en pozo: estructura el ciclo por unidad en **milestones**, organiza **evidencia** (planos, fotos, permisos, certificados) y ancla **huellas criptográficas** (SHA-256/Merkle) en **Cardano** con timestamps. Off-chain: documentos, PII y lógica de negocio. On-chain: solo commitments compactos y TXIDs. Cuatro roles con superficie propia: developer, buyer/investor, certifier/verifier, notary. Este repo consolida tres frentes previos: la guía de implementación, el backend PoC funcionando y la maqueta visual (ver docs/context/).

## Jerarquía de precedencia

**DECISIONS.md > CLAUDE.md > specs/ > ROADMAP.md y docs/ (históricos).**
Si encontrás una contradicción entre documentos: manda la de mayor precedencia y corregí el documento en conflicto **en el mismo PR**. Si la contradicción es con código, avisá antes de "arreglar" nada.

## Stack (cerrado — cambiarlo requiere una D-0XX nueva)

pnpm workspaces · TypeScript estricto · **web:** TanStack Start + TanStack Query (shadcn/ui entra con el rediseño de UX/UI; hoy el CSS es el de la maqueta) · **api:** Express 4 + Zod + JWT/bcrypt + Multer (D-016 — adoptado del backend PoC; migración a Hono es decisión abierta) · **db:** Prisma + SQLite en dev, PostgreSQL al desplegar (D-016) · **shared:** Zod (contrato único API↔web, se puebla al extraer schemas) · **cardano:** puerto `AnchorPort` con adaptadores `blockfrost` (Lucid Evolution, D-005) y `simulated` (D-014) — pendiente de implementar · **contratos:** Aiken v1.1.21 / Plutus V3, blueprint `plutus.json` commiteado · **deploy:** Docker, Railway, GHA solo valida (D-010).

## Estructura

`apps/web` (TanStack Start, pantallas de la maqueta) y `packages/api` (Express + Prisma, el backend adoptado) son los únicos servicios. `shared`/`db`/`cardano` son librerías (hoy placeholders con .gitkeep; el esquema Prisma vive en `packages/api/prisma`). `contracts/` es el proyecto Aiken: no se hostea, su versión es un entero (D-015). Specs en `specs/`, decisiones en `DECISIONS.md`, material fuente congelado en `docs/context/` (maqueta PropTrust, análisis funcional, registro original del backend).

## Reglas duras (innegociables)

1. **Datos primero:** dinero jamás en float — montos en unidades enteras mínimas (lovelace como `bigint`; moneda fiat en centavos `integer`). Timestamps en UTC. IDs = UUID.
2. **Cero PII on-chain o en logs:** ni nombres, ni emails, ni URLs internas, ni nombres de archivo en metadata, datums o logs. Solo hashes y refs opacas. Strings de metadata ≤ 64 bytes.
3. **Todo archivo subido recibe hash SHA-256** calculado del archivo en el servidor y persistido en `Evidence.sha256Hash`. Es el ancla de la verificación on-chain: no se recalcula ni se edita después de creado (SPEC-007).
4. **Passwords solo con bcrypt** (cost 10). Jamás loguear ni devolver `passwordHash` en ninguna respuesta.
5. **Autorización en dos capas, siempre:** rol global (`requireRole`) + membresía por proyecto (`canAccessProject`). `admin` bypasea membresías; el resto solo ve proyectos donde es miembro (SPEC-006).
6. **Todo body se valida con Zod** (`safeParse` + 400 con `error.flatten()`). Nada llega a Prisma sin pasar por un schema. Para endpoints nuevos: el schema va a `packages/shared` ANTES que el endpoint, y el frontend importa el mismo tipo.
7. **Toda mutación relevante escribe `AuditLog`** (append-only) vía `writeAuditLog`, con actor, entidad, acción, timestamp.
8. **Idempotencia en todo lo que toca plata o chain:** re-ejecutar un anclaje, release o migración no duplica efectos.
9. **Máquina de estados de milestone:** `Pending → InProgress → {Observed ⇄ InProgress, Completed}`, `Completed` terminal (SPEC-002). Una sola tabla de transiciones, espejada entre backend y `contracts/`.
10. Uploads: solo `application/pdf`, `image/jpeg`, `image/png`; máximo `MAX_FILE_SIZE_MB` (default 10). Si un upload falla la validación después de que Multer escribió el archivo, **borrar el archivo huérfano** antes de responder.
11. **`contracts/plutus.json` se commitea** tras cada `aiken build`; direcciones de script derivadas del blueprint, jamás hardcodeadas.
12. **Secrets solo por env.** Si ves una seed/key commiteada: frená y avisá.

## Prohibiciones (qué NO hacer aunque parezca buena idea)

- No migrar lógica de negocio on-chain: el backend es la fuente de verdad del lifecycle (D-007); on-chain se anclan pruebas.
- No importar Lucid/Blockfrost fuera del futuro adaptador real de `packages/cardano` (D-014). Las rutas de la API jamás llaman a la chain directo.
- En el front, no hacer `fetch` fuera de `ApiPort` (`apps/web/src/api/`): los adaptadores implementan la misma interfaz tipada (SPEC-004).
- No tocar mainnet: `CARDANO_NETWORK=Preprod` siempre (D-013). CI no toca ninguna red.
- **No subir `@types/express` a v5** mientras `express` sea v4: los tipos v5 rompen todas las rutas (ver gotchas).
- **No editar migraciones ya aplicadas** en `packages/api/prisma/migrations/`; siempre migración nueva.
- No tocar `contracts/build/` (generado) ni editar `aiken.lock` a mano.
- No inventar endpoints, campos o dependencias fuera de spec/docs — proponer en el PR, no improvisar.
- No commitear `.env`, `dev.db`, `uploads/` ni artefactos de build.
- No "arreglar" tests cambiando contratos de API o esquema de DB para que pasen.
- No crear variantes ad-hoc de los componentes de dominio (HashChip/StatusPill/etc.): viven en `apps/web/src/components/domain/`.

## Método de trabajo LLM

- **Spec-driven:** antes de codear, leé la spec correspondiente (`specs/`, índice en `specs/README.md`); si no existe y la tarea la amerita, la spec se escribe primero (≤2 págs, con el template).
- **PRs chicos con tests:** una tarea = una rama = un PR. Correr `pnpm typecheck` (y `aiken check` si aplica) ANTES de proponer el diff.
- **Niveles de autonomía** (tabla completa en docs/GUIA-COMMITS.md): 🟢 UI/CRUD/tests/docs según spec → implementá directo. 🟡 migraciones, auth, manejo de archivos, pipeline de anclaje, CI/deploy → proponé y esperá revisión línea por línea. 🔴 validadores con fondos, manejo de seeds/keys, lógica de permisos (`canAccessProject`), hashing → el humano lidera; vos asistís.
- **Persistencia de conocimiento:** toda decisión, gotcha o convención que surja en tu sesión va al repo en el mismo PR (DECISIONS.md, la spec, o la sección Gotchas de abajo). El chat es descartable; el repo es la memoria.
- Confinamiento: trabajá solo en el frente asignado (web / api / contracts); las decisiones cruzadas las arbitra el humano.

## Comandos

```bash
pnpm install                      # bootstrap del workspace
pnpm dev                          # web (:3000) + api (:8787) en paralelo
pnpm typecheck                    # typecheck de todos los packages
pnpm --filter @plataforma/api dev            # solo la API
pnpm --filter @plataforma/api db:generate    # regenerar cliente Prisma tras tocar schema
pnpm --filter @plataforma/api db:migrate     # nueva migración en desarrollo
pnpm --filter @plataforma/api db:seed        # datos demo (admin/dev/buyer/verifier, proyecto torre-a)
pnpm contracts:check              # aiken check (compila y corre tests de validadores)
pnpm contracts:build              # regenera plutus.json (commitearlo)
```

Smoke test manual: `pnpm dev`, login en `http://localhost:3000` con `admin@example.com` / `admin123` (seed) y navegar a proyectos.

## Gotchas (sección viva — agregá acá el mismo día que te muerda una)

- **2026-07-15 · `@types/express` v5 con Express 4 rompe el typecheck** (21 errores `string | string[]` en `req.params`). Quedó pineado a `^4.17.21`. No "actualizar" ese paquete por su cuenta.
- **2026-07-15 · Warning `url.parse()` deprecado al arrancar la API**: viene de Multer 1.x, no de nuestro código. Inofensivo; desaparecería al migrar a Multer 2.x (requiere decisión nueva por cambios de API).
- **2026-07-15 · `contracts/validators/milestone.ak` y `milestone2.ak` son casi idénticos** (mismo validador, dos estilos). Consolidación pendiente — D-017.
- **2026-07-15 · Los validadores Aiken tienen 0 tests** (`aiken check` pasa en verde vacío). Los casos borde de SPEC-002 son la suite mínima a escribir.
- La sintaxis de Aiken cambia entre versiones: verificá contra la versión pineada en CI (`aiken --version`) antes de asumir stdlib. Los `.ak` de este repo asumen v1.1.x.
- Metadata de Cardano: strings > 64 bytes revientan al construir la tx — validar antes de firmar (caso 10 de SPEC-001).
- El scaffolder de TanStack Start cambia de flags entre versiones: `pnpm create @tanstack/start@latest --help` primero.
