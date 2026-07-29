# CLAUDE.md

## Contexto (3 líneas)

**PropNexus** (Catalyst 1400106) — plataforma de ventas inmobiliarias en pozo: estructura el ciclo de obra en **stages**, organiza **evidencia** (planos, fotos, permisos, certificados) y ancla **huellas criptográficas** (SHA-256/Merkle) en **Cardano** con timestamps. Off-chain: documentos, PII y lógica de negocio. On-chain: solo commitments compactos y TXIDs — **nunca valor** (D-021). Cuatro roles con superficie propia: investor (INV), developer (DEV), notary (NOT), certifier (CER).

## Vocabulario: "milestone" tiene dos significados — usá el correcto

| Término | Significa | Dónde |
|---|---|---|
| **Milestone** | Hito **Catalyst**: M1, M2, M3, M4. Etapas contractuales del proyecto. | `docs/milestone-N-*/`, reportes de entrega |
| **Stage** (`ConstructionStage`) | Etapa de **obra** de un desarrollo. Es la entidad del dominio. | Código, API, specs, contratos |

Nunca uses "milestone" para una etapa de obra (D-023). Si ves `Milestone` en código, es deuda de rename pendiente.

## Jerarquía de precedencia

**DECISIONS.md > CLAUDE.md > STACK.md > specs/ > ROADMAP.md.**
Si encontrás una contradicción entre documentos: manda la de mayor precedencia y corregí el documento en conflicto **en el mismo PR**. Si la contradicción es con código, avisá antes de "arreglar" nada.

**`docs/` está fuera de esta jerarquía y es INMUTABLE.** Son los entregables oficiales tal como se presentaron a Catalyst. Si encontrás un error o una ambigüedad en un entregable, **no lo edites**: registrá una decisión en `DECISIONS.md` citando documento y párrafo. Ya hay cuatro discrepancias resueltas así (D-019 a D-022); están listadas en `docs/README.md`.

## Stack

**El stack canónico vive en `STACK.md`.** No lo dupliques acá. Cambiarlo requiere una `D-0XX` nueva.

Lo esencial para no equivocarte: los entregables oficiales son agnósticos de stack y el único requisito técnico comprometido es que **los contratos sean en Aiken**. Todo lo demás es implementación nuestra.

## Estructura

`apps/web` (TanStack Start) y `packages/api` (Express + Prisma) son los únicos servicios. `shared`/`db`/`cardano` son librerías (hoy placeholders con .gitkeep; el esquema Prisma vive en `packages/api/prisma`). `contracts/` es el proyecto Aiken: no se hostea, su versión es un entero (D-015). Specs en `specs/`, decisiones en `DECISIONS.md`, stack en `STACK.md`, método de trabajo en `GUIA-COMMITS.md` y `PLAYBOOK.md`, entregables oficiales en `docs/` (índice en `docs/README.md`).

## Documentación oficial: qué leer antes de tocar cada frente

| Vas a tocar | Leé primero |
|---|---|
| Cualquier pantalla | `M2-D1` (árbol de pantallas y permisos del rol) + `M2-D3` (componentes) |
| Algo que muestre un hash, TXID o Merkle root | `M2-D4` (los 10 patrones son **normativos**) |
| Un endpoint | `M2-D5` §4-6 (trae el path, los test IDs y el work stream) + `M2-D6` §9 |
| Un validador | `M1-D1` §Workflow + D-020 (FSM) + D-021 (nunca valor) |
| El modelo de datos | `M1-D2b` + `M2-D1` §4 (matriz de permisos) |

## Reglas duras (innegociables)

1. **Datos primero:** dinero jamás en float — montos en unidades enteras mínimas (lovelace como `bigint`; moneda fiat en centavos `integer`). Timestamps en UTC. IDs = UUID.
2. **Cero PII on-chain o en logs:** ni nombres, ni emails, ni URLs internas, ni nombres de archivo en metadata, datums o logs. Solo hashes y refs opacas. Strings de metadata ≤ 64 bytes.
3. **Todo archivo subido recibe hash SHA-256** calculado del archivo en el servidor y persistido en `Evidence.sha256Hash`. Es el ancla de la verificación on-chain: no se recalcula ni se edita después de creado (SPEC-007).
4. **Passwords solo con bcrypt** (cost 10). Jamás loguear ni devolver `passwordHash` en ninguna respuesta.
5. **Autorización en dos capas, siempre:** rol global (`requireRole`) + membresía por proyecto (`canAccessProject`). `admin` bypasea membresías; el resto solo ve proyectos donde es miembro (SPEC-006).
6. **Todo body se valida con Zod** (`safeParse` + 400 con `error.flatten()`). Nada llega a Prisma sin pasar por un schema. Para endpoints nuevos: el schema va a `packages/shared` ANTES que el endpoint, y el frontend importa el mismo tipo.
7. **Toda mutación relevante escribe `AuditLog`** (append-only) vía `writeAuditLog`, con actor, entidad, acción, timestamp.
8. **Idempotencia en todo lo que toca plata o chain:** re-ejecutar un anclaje, release o migración no duplica efectos.
9. **Máquina de estados del stage:** `Pending → InProgress → {Observed ⇄ InProgress, Completed}`, `Completed` terminal (D-020). `Observed` es remediación, no estado final. Una sola tabla de transiciones, espejada entre backend y `contracts/`. La etiqueta que ve el usuario ("Certificado"/"Certified") sale del diccionario i18n, no del nombre del estado.
10. Uploads: solo `application/pdf`, `image/jpeg`, `image/png`; máximo `MAX_FILE_SIZE_MB` (default 10). Si un upload falla la validación después de que Multer escribió el archivo, **borrar el archivo huérfano** antes de responder.
11. **`contracts/plutus.json` se commitea** tras cada `aiken build`; direcciones de script derivadas del blueprint, jamás hardcodeadas.
12. **Secrets solo por env.** Si ves una seed/key commiteada: frená y avisá.
13. **Ningún validador custodia ni transfiere valor** (D-021). On-chain solo commitments y TXIDs. Si una spec o un prompt te pide un validador que retenga fondos, está mal: frená y avisá. "Release" significa anclar el evento de liberación, no ejecutar el pago.
14. **Cero strings hardcodeados en la UI** (D-025). Todo texto visible sale del diccionario i18n; toda moneda, fecha, relativo y decimal se formatea con `Intl.*` y el locale activo. Default `es-AR` con voseo ("Mirá tu unidad", no "Mira" ni "Mire").
15. **El backend devuelve claves de traducción, nunca copy** (M2-D4 §8.2). Vale para acciones de audit log, categorías, etiquetas de rol y nombres de stage. El cliente renderiza.
16. **Los hashes viajan completos al cliente** (M2-D4 §8.2). La truncación a 6+4 es exclusivamente de presentación, la hace `HashChip`. Nunca truncar en la capa de datos. Los TXID son case-sensitive y se transportan verbatim.
17. **Nunca mostrar una señal de prueba que no puedas sustanciar** (M2-D4 §6.2). Un pill "Verified", una marca de agua VERIFIED o un `HashChip` requieren un anclaje real. Si no hay TXID, el estado es "Pending", no "Verified".

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
- **No editar nada dentro de `docs/`** (D-022). Ni para corregir un error evidente.
- **No inventar estados ni patrones de prueba nuevos.** M2-D3 dice *"never invent new statuses"* y M2-D4 dice que un patrón nuevo se documenta antes de usarse. Como el documento es inmutable, en la práctica: patrón nuevo = decisión nueva en `DECISIONS.md`.
- No abrir un modal de verificación automáticamente (M2-D4 §6.3). Toda superficie de prueba es iniciada por el usuario; la única excepción es `AnchoringSuccessModal`, que confirma una acción que el usuario acaba de disparar.

## Método de trabajo LLM

- **Spec-driven:** antes de codear, leé la spec correspondiente (`specs/`, índice en `specs/README.md`); si no existe y la tarea la amerita, la spec se escribe primero (≤2 págs, con el template).
- **PRs chicos con tests:** una tarea = una rama = un PR. Correr `pnpm typecheck && pnpm test` (y `aiken check` si aplica) ANTES de proponer el diff.
- **Niveles de autonomía** (tabla completa en `GUIA-COMMITS.md`): 🟢 UI/CRUD/tests/docs según spec → implementá directo. 🟡 migraciones, auth, manejo de archivos, pipeline de anclaje, validadores, CI/deploy → proponé y esperá revisión línea por línea. 🔴 manejo de seeds/keys, lógica de permisos (`canAccessProject`), hashing y construcción de commitments → el humano lidera; vos asistís. *(Los validadores bajaron de 🔴 a 🟡 por D-021: no custodian valor.)*
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

- **2026-07-29 · Los códigos de entregable (`D1`, `D2a`…) se reinician en cada milestone y colisionan**: `M1-D1` es el whitepaper, `M2-D1` es el mapa de arquitectura de información; `M1-D2a` es la arquitectura del sistema, `M2-D2a` es el catálogo de pantallas. Dentro de los documentos de M2, un "D1 §5" suelto significa siempre M2-D1. Al citar en specs, commits o código, **usá siempre la forma completa** (`M2-D1 §4`).
- **2026-07-29 · `M2-D5` y `M2-D6` son entregables de Milestone 2, aunque vivan en `docs/milestone-3-implementacion/`**: son los planes *de* M3 escritos *en* M2. Están archivados junto al SOM de M3 porque en la práctica se leen juntos.
- **2026-07-29 · Tailwind v4 y `lucide-react` ya vienen instalados** en `apps/web` (los trajo el scaffold de TanStack Start). No los agregues de nuevo. Lo que falta es shadcn/ui y reemplazar `styles.css` (CSS de la maqueta vieja) por los tokens de M2-D3.
- **2026-07-29 · `contracts/aiken.toml` conserva naming de scaffold**: `name = "j/milestone-fsm"`, `repository.user = "j"`, `version = "0.0.0"` (que además incumple D-015, que pide entero incremental). Corregir junto con el rename de D-023.

- **2026-07-15 · Prisma ≥6.16 ya no carga `.env` desde el client**: el install fresco del workspace resolvió `^6.6.0` → 6.19.x y `prisma/seed.ts` falló con "Environment variable not found: DATABASE_URL" (en el repo original funcionaba). Fix: `import "dotenv/config"` primero en todo entrypoint que use PrismaClient fuera del server (el server ya lo carga en `app.ts`). El CLI de Prisma (`migrate`, `studio`) sí sigue cargando `.env` solo.

- **2026-07-15 · `@types/express` v5 con Express 4 rompe el typecheck** (21 errores `string | string[]` en `req.params`). Quedó pineado a `^4.17.21`. No "actualizar" ese paquete por su cuenta.
- **2026-07-15 · Warning `url.parse()` deprecado al arrancar la API**: viene de Multer 1.x, no de nuestro código. Inofensivo; desaparecería al migrar a Multer 2.x (requiere decisión nueva por cambios de API).
- **2026-07-15 · `contracts/validators/milestone.ak` y `milestone2.ak` son casi idénticos** (mismo validador, dos estilos). Consolidación pendiente — D-017.
- **2026-07-15 · Los validadores Aiken tienen 0 tests** (`aiken check` pasa en verde vacío). Los casos borde de SPEC-002 son la suite mínima a escribir.
- La sintaxis de Aiken cambia entre versiones: verificá contra la versión pineada en CI (`aiken --version`) antes de asumir stdlib. Los `.ak` de este repo asumen v1.1.x.
- Metadata de Cardano: strings > 64 bytes revientan al construir la tx — validar antes de firmar (caso 10 de SPEC-001).
- El scaffolder de TanStack Start cambia de flags entre versiones: `pnpm create @tanstack/start@latest --help` primero.
