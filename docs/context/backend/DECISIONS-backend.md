# DECISIONS.md

Registro de decisiones (ADR liviano). **Jerarquía de precedencia documental: este archivo > CLAUDE.md > specs/ > docs/context/.** La numeración es secuencial y nunca se recicla; una decisión revertida se marca como Reemplazada y se agrega una nueva entrada.

Reabrir una decisión Aceptada requiere evidencia (un spike, un bug, un requerimiento nuevo), no preferencia.

## Índice

| # | Decisión | Estado |
|---|---|---|
| ADR-001 | Monorepo: backend + smart contracts juntos | Aceptada |
| ADR-002 | Stack backend: Node + TypeScript + Express 4 | Aceptada |
| ADR-003 | Prisma ORM con SQLite en desarrollo | Aceptada |
| ADR-004 | Auth propia: JWT firmado + bcrypt | Aceptada |
| ADR-005 | Evidencia en disco local + SHA-256 como ancla | Aceptada |
| ADR-006 | Autorización en dos capas: rol global + membresía | Aceptada |
| ADR-007 | Aiken / Plutus V3 para el validador de milestones | Aceptada |
| ADR-008 | Integración Cardano fuera del alcance de este repo | Aceptada |
| ADR-009 | Consolidar validadores duplicados (milestone vs milestone2) | Abierta (default: conservar `milestone.ak`) |

---

## ADR-001 — Monorepo: backend + smart contracts juntos

- **Contexto:** PoC de un equipo chico; el backend y los validadores Aiken evolucionaron juntos durante la demo. El playbook manda decidir mono vs multi-repo por ciclo de vida del código.
- **Decisión:** Un solo repositorio con `smart-contracts/` como subproyecto Aiken independiente (toolchain y CI propios dentro del mismo repo).
- **Alternativas descartadas:** Repo aparte para contratos — prematuro: los contratos aún cambian al ritmo del backend y no hay auditoría en el horizonte inmediato.
- **Cómo se revierte:** Cuando los contratos se congelen para auditoría o despliegue a mainnet, extraer `smart-contracts/` a su propio repo (con `git filter-repo` para preservar historia) y dejar acá un link.

## ADR-002 — Stack backend: Node + TypeScript + Express 4

- **Contexto:** Se necesitaba una API REST convencional, rápida de construir con asistencia LLM.
- **Decisión:** Node.js + TypeScript, Express **4.x**, Zod para validación. Los tipos (`@types/express`) quedan pineados a la línea 4 (`^4.17.21`): los tipos v5 rompen el typecheck (ver gotchas en CLAUDE.md).
- **Alternativas descartadas:** Fastify (menos familiaridad del equipo), NestJS (demasiado andamiaje para un PoC), Express 5 (todavía inmaduro en el ecosistema de tipos al momento de la decisión).
- **Cómo se revierte:** Migración a Express 5 o Fastify con un ADR nuevo; las rutas están aisladas por recurso, lo que acota el costo.

## ADR-003 — Prisma ORM con SQLite en desarrollo

- **Contexto:** El PoC necesita persistencia sin operar infraestructura.
- **Decisión:** Prisma + SQLite (`prisma/dev.db`, gitignoreado). El schema evita tipos exclusivos de SQLite para mantener portable la migración.
- **Alternativas descartadas:** Postgres local vía Docker (fricción innecesaria para demo), TypeORM (peor DX con LLMs), SQL a mano.
- **Cómo se revierte:** Cambiar `provider` del datasource a `postgresql` + regenerar migraciones. Es el paso obligado antes de cualquier despliegue real.

## ADR-004 — Auth propia: JWT firmado + bcrypt

- **Contexto:** El PoC necesita login con roles (`admin`, `developer`, `buyer`, `verifier`) sin depender de un proveedor externo.
- **Decisión:** JWT firmado con secreto simétrico (`JWT_SECRET`), expiración 7 días, sin refresh tokens. Passwords con bcrypt cost 10. El middleware revalida contra DB en cada request (`isActive`), así un usuario desactivado pierde acceso aunque su token siga vigente.
- **Alternativas descartadas:** Auth0/Clerk (dependencia externa que el playbook manda desacoplar; overkill para PoC), sesiones con cookie (la API se pensó para clientes múltiples).
- **Cómo se revierte:** La emisión/verificación está encapsulada en `src/lib/jwt.ts`; cambiar de mecanismo no toca las rutas.

## ADR-005 — Evidencia en disco local + SHA-256 como ancla

- **Contexto:** El corazón del PoC: evidencia documental de avance de obra cuya integridad debe poder verificarse on-chain más adelante.
- **Decisión:** Los archivos se guardan en disco local (`UPLOAD_DIR`, nombre aleatorizado con timestamp) y se persiste el **SHA-256 del archivo** en `Evidence.sha256Hash`. El hash se calcula una sola vez al crear la evidencia y es inmutable: es la única fuente de verdad de integridad y el dato que se anclará on-chain.
- **Alternativas descartadas:** Object storage (S3/R2) — default futuro, no necesario para demo; guardar el archivo en la DB (tamaño); IPFS (complejidad prematura).
- **Cómo se revierte:** El almacenamiento está detrás de Multer en `src/lib/upload.ts` + `storagePath` en DB; migrar a S3 es un spike acotado que no cambia el contrato de la API. El hash no se toca.

## ADR-006 — Autorización en dos capas: rol global + membresía

- **Contexto:** Un mismo usuario puede participar en varios proyectos con roles distintos.
- **Decisión:** Capa 1: rol global del usuario (`requireRole`). Capa 2: membresía en el proyecto con rol de membresía (`canAccessProject`, tabla `ProjectMember` con unique `[userId, projectId, membershipRole]`). `admin` bypasea la capa 2. Escrituras exigen membresía `developer` (o admin); lecturas, cualquier membresía.
- **Alternativas descartadas:** Solo roles globales (no modela múltiples proyectos), RBAC genérico con librería (overkill).
- **Cómo se revierte:** Toda la lógica vive en `src/middlewares/auth.ts`; es el único lugar a tocar (nivel rojo de autonomía LLM).

## ADR-007 — Aiken / Plutus V3 para el validador de milestones

- **Contexto:** El estado de los milestones debe poder certificarse on-chain con transiciones controladas.
- **Decisión:** Validador `spend` en Aiken (compiler v1.1.21, Plutus V3, stdlib v3.0.0) que implementa la FSM `Pending → InProgress → {Observed ⇄ InProgress, Completed}` con `Completed` terminal — espejo del enum `MilestoneState` del backend. Reglas: 1 input y 1 output del script por tx, firma del admin parametrizado, identidad del milestone inmutable, valor bloqueado conservado, datum nuevo consistente con el redeemer.
- **Alternativas descartadas:** Plutus/Haskell nativo (curva y toolchain), opshin/plu-ts (menos maduros).
- **Cómo se revierte:** El contrato es pequeño y auto-contenido; reescribirlo en otro lenguaje es viable mientras la FSM (documentada en SPEC-002) se mantenga.

## ADR-008 — Integración Cardano fuera del alcance de este repo

- **Contexto (2026-07-15):** La integración backend↔Cardano (construcción de transacciones, anclado de hashes, verificación on-chain) se empezó a desarrollar en un repositorio separado. Este repo conserva los validadores y el hash SHA-256 como punto de anclaje.
- **Decisión:** Este repo NO incorpora SDKs de Cardano (Lucid, Blockfrost, etc.). El walking skeleton completo (subir doc → hash → tx en testnet → verificar) se cierra en el otro repositorio.
- **Alternativas descartadas:** Integrar acá con un puerto real/simulado — era el plan original del playbook, pero se decidió separar el frente on-chain.
- **Cómo se revierte:** Si la integración vuelve a este repo, entra detrás de una interfaz propia con modo real/simulado conmutable por configuración (principio 7 del playbook), nunca llamadas directas desde las rutas.

## ADR-009 — Consolidar validadores duplicados — **Abierta**

- **Contexto (2026-07-15):** `validators/milestone.ak` y `validators/milestone2.ak` contienen el mismo validador con estilos distintos (`when` vs `let` destructuring). Ambos compilan; la duplicación viola el principio de única fuente de verdad.
- **Default:** Conservar `milestone.ak` (la versión comentada) y borrar `milestone2.ak`.
- **Spike para refutar (≤1 día):** Confirmar con quien escribió `milestone2.ak` si era un refactor destinado a reemplazar al original; en ese caso, conservar `milestone2.ak` renombrado a `milestone.ak`.
- **Se cierra:** Borrando uno de los dos en un PR que actualice esta entrada a Aceptada.
