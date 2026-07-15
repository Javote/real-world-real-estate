# DECISIONS.md

> **Jerarquía de precedencia:** DECISIONS.md > CLAUDE.md > specs/ > ROADMAP.md y docs/ (históricos).
> Ante contradicción entre documentos, gana el de mayor precedencia y el documento en conflicto se corrige en el mismo PR en que se detecta.
> Reabrir una decisión **Aceptada** requiere evidencia (spike, incidente, medición), no preferencia. La numeración nunca se recicla.
>
> **Historia:** este repo consolida la guía de implementación con el backend PoC (`cardano-real-estate-backend`). Los ADR-001..009 de ese repo quedan absorbidos acá (los vigentes, como D-016/D-017; el resto como contexto) y su registro original se conserva congelado en `docs/context/backend/DECISIONS-backend.md`.

## Índice

| # | Decisión | Estado |
|---|---|---|
| D-001 | Monorepo pnpm con `contracts/` adentro | Aceptada (trigger de revisión definido) |
| D-002 | Frontend: TanStack Start + shadcn/ui | Aceptada |
| D-003 | Backend separado (Hono), no server functions del frontend | Aceptada en su núcleo (separación web/api); framework reemplazado por D-016 |
| D-004 | Drizzle ORM + PostgreSQL | Reemplazada por D-016 |
| D-005 | Web3 TS: Lucid Evolution + Blockfrost | Default → spike (el walking skeleton ES el spike) |
| D-006 | Anclaje Fase A por metadata de transacción (label 1904) | Aceptada |
| D-007 | Lifecycle de milestones: backend = fuente de verdad; on-chain solo Fase B | Aceptada |
| D-008 | Validador de milestones: patrón state-thread con thread token, núcleo puro separado | Aceptada |
| D-009 | Custodia de firmas de certificador/notario | Default → spike |
| D-010 | Deploy: Railway con "Wait for CI"; GitHub Actions no despliega | Default (reversión barata a Coolify) |
| D-011 | Storage: S3 genérico — MinIO en dev, Cloudflare R2 en prod | Aceptada (transición: dev usa disco local por D-016 hasta integrar S3) |
| D-012 | Cambios aditivos entre deploys; migraciones idempotentes en entrypoint | Aceptada |
| D-013 | Red Cardano: Preprod hasta aprobación de gobernanza | Aceptada |
| D-014 | Dependencia blockchain detrás de puerto propio con modo real/simulado | Aceptada |
| D-015 | Versionado: CalVer para servicios; enteros para contratos | Aceptada |
| D-016 | Adoptar el backend PoC (Express 4 + Prisma + SQLite + JWT/bcrypt + disco local) como `packages/api` | Aceptada (trigger de revisión definido) |
| D-017 | Contratos: adoptar el proyecto Aiken del backend en `contracts/`, junto a los validadores de referencia | Aceptada (consolidación de duplicados Abierta) |

---

## D-001 — Monorepo pnpm con `contracts/` adentro

**Contexto.** El playbook decide mono vs multi-repo por ciclo de vida: los contratos que se congelan y auditan suelen ir aparte. Acá los contratos de Fase A/B son anclaje e integridad (sin fondos), evolucionan junto al backend que los consume vía blueprint, y el equipo es chico.
**Decisión.** Un solo repo. `contracts/` vive adentro pero aislado (fuera del workspace pnpm, CI propio con `aiken check` + verificación de `plutus.json`).
**Alternativas descartadas.** Repo aparte de contratos desde el día 1: fricción de sincronización de blueprint sin beneficio mientras no haya auditoría.
**Trigger de revisión (no opcional).** Cuando `stage_release` (M3-SC-03, custodia fondos reales) entre en camino a auditoría/mainnet, se re-evalúa extraer `contracts/` a repo propio congelable. Registrar el resultado como D-0XX nueva.
**Reversión.** `git filter-repo` sobre `contracts/` + el blueprint pasa a consumirse como artefacto versionado.

## D-002 — Frontend: TanStack Start + shadcn/ui

**Contexto.** Requisito del mandato. Cuatro superficies por rol según el diseño D1/D3.
**Decisión.** TanStack Start (SSR para browse público y dossier compartido) + shadcn/ui + TanStack Query.
**Alternativas descartadas.** Next.js (peso innecesario declarado por el owner); SPA pura (pierde SSR del browse público).
**Nota de consolidación (2026-07-15).** La primera versión de `apps/web` porta las pantallas de la maqueta PropTrust con su CSS original (snapshot en `docs/context/maqueta/`); shadcn/ui entra con el rediseño de identidad visual a cargo de UX/UI, sin cambiar esta decisión.
**Reversión.** Alta fricción; solo con evidencia de bloqueo del framework.

## D-003 — Backend separado (Hono) — **núcleo vigente; framework reemplazado por D-016**

**Contexto.** TanStack Start podría hacer fullstack, pero: la seed de la wallet de servicio no debe convivir con el proceso web público; el pipeline de anclaje son operaciones largas; hará falta un worker de confirmaciones.
**Decisión.** `packages/api` como servicio propio. El frontend jamás toca Cardano. **Lo que sigue vigente:** la separación web/api. **Lo reemplazado:** el framework elegido era Hono; por D-016 la API es el backend Express adoptado.
**Alternativas descartadas.** Server functions de Start (mezcla secretos y timeouts); NestJS (peso sin beneficio a esta escala).
**Reversión.** Los routers se montan casi 1:1 como server routes de Start si algún día se colapsa. El camino inverso (extraer después) es el caro — por eso se separa ahora.

## D-004 — Drizzle + PostgreSQL — **Reemplazada por D-016**

**Decisión original.** Drizzle ORM, migraciones drizzle-kit, PostgreSQL 16.
**Reemplazo (2026-07-15).** Existe un backend funcionando con Prisma + SQLite (dev); reescribirlo costaría días sin agregar valor a la demo. Ver D-016. PostgreSQL sigue siendo el destino al desplegar (cambiar `provider` del datasource + regenerar migraciones).

## D-005 — Lucid Evolution + Blockfrost — **Default → spike**

**Contexto.** Dos libs TS maduras: Lucid Evolution y Mesh SDK. Lucid integra natural con blueprints CIP-57 de Aiken.
**Default.** Lucid Evolution + Blockfrost Preprod.
**Spike que lo refuta o confirma (≤2 días).** El walking skeleton (Sprint 1) se implementa con el default; si aparece bloqueo real (API rota, incompatibilidad de blueprint, docs muertas), se repite el skeleton con Mesh y se decide con evidencia. Al cierre del Sprint 1, esta entrada pasa a Aceptada o se reemplaza.

## D-006 — Anclaje Fase A por metadata (label 1904)

**Contexto.** El baseline (§13) pide empezar con transacciones de anclaje compactas y subir a validadores solo donde agreguen valor.
**Decisión.** Fase A: tx con metadata `{v, t, h, r, p?}` bajo `ANCHOR_METADATA_LABEL`; strings ≤64 bytes; cero PII. Cubre M3-SC-01/02/06.
**Alternativas descartadas.** Validador para todo desde el día 1 (complejidad sin retorno); NFT por evidencia (costo y ruido).
**Reversión.** N/A — Fase B se suma, no reemplaza: los anchors de metadata siguen siendo válidos históricamente.

## D-007 — Lifecycle de milestones: backend = fuente de verdad

**Contexto.** El baseline §11 dice explícito que la fase 1 no exige enforcement on-chain del ciclo de vida.
**Decisión.** La máquina de estados se persiste en el backend (hoy: enum `MilestoneState` + rutas de la API; objetivo: función pura en `packages/shared`). On-chain se anclan pruebas de las transiciones relevantes. El validador de milestones (D-008) es opt-in de Fase B para milestones `validation_critical` o como precondición de releases.
**Reversión.** Subir enforcement es aditivo (D-006).

## D-008 — Validador de milestones: state-thread + núcleo puro

**Decisión.** Un UTxO por milestone identificado por thread token (asset name = milestone_ref); transiciones = gastar y recrear con datum nuevo. Tipos y tabla de transiciones en `lib/plataforma/milestone.ak` (puro, testeable barato); el validador es cáscara delgada. Espejo 1:1 con la implementación del backend.
**Alternativas descartadas.** Todo en un archivo (impide importar tipos desde `stage_release.ak` y encarece tests); estado por datum sin token (falsificable por UTxOs paralelos).
**Nota de consolidación.** El validador ya escrito en el backend (`milestone.ak`, sin thread token, 1-input/1-output — ver SPEC-002) es la V1 vigente; este patrón state-thread es el objetivo de Fase B.

## D-009 — Custodia de firmas de certificador/notario — **Default → spike**

**Contexto.** Los commits Fase B (SC-04/05) exigen firma del profesional. Dos modelos: co-firma CIP-30 desde el navegador (no-custodial, más fricción de UX) vs. wallet por rol operada por el backend (custodial, más simple, más riesgo).
**Default.** Co-firma CIP-30: el backend arma la tx parcialmente firmada, el profesional co-firma con su wallet extension.
**Spike (≤3 días, durante Sprint de Fase B).** Prototipo del flujo CIP-30 con un certificador real. Si la fricción es inaceptable para los usuarios reales, documentar custodia delegada con sus controles como decisión nueva.

## D-010 — Deploy: Railway, "Wait for CI", GHA no despliega — **Default**

**Decisión.** GitHub Actions = barrera de calidad únicamente. Railway detecta push a `main`, buildea ambos Dockerfiles, rollout con healthcheck. Watch paths por servicio.
**Alternativas.** VPS + Coolify (más barato, self-hosted): la reversión es el propio `docker-compose.prod.yml` que ya existe — cambiar cuesta horas, no días. Por eso queda como Default con reversión barata en lugar de exigir spike.

## D-011 — Storage S3 genérico: MinIO dev / R2 prod

**Decisión.** El código habla S3 estándar; el entorno decide el proveedor. URLs prefirmadas TTL ≤ 15 min; `storage_key` jamás se expone.
**Alternativas descartadas.** Archivos en Postgres (bloat); disco local (mata portabilidad del deploy).
**Nota de transición (2026-07-15).** El backend adoptado (D-016) guarda evidencia en disco local vía Multer (`UPLOAD_DIR`); migrar a S3 es un spike acotado que no cambia el contrato de la API (el almacenamiento está detrás de `src/lib/upload.ts` + `storagePath` en DB). Esta decisión marca el destino; el disco local es el estado de partida documentado.

## D-012 — Cambios aditivos entre deploys

**Decisión.** Web y api salen del mismo push y conviven versiones por segundos. API agrega sin renombrar ni mutar en el mismo deploy; remociones en deploy posterior. Migraciones aditivas e idempotentes (las corre el entrypoint).
**Consecuencia.** Regla dura en CLAUDE.md; `packages/shared` + CI la vigilan.

## D-013 — Preprod hasta aprobación de gobernanza

**Decisión.** `CARDANO_NETWORK=Preprod` en todos los entornos. Mainnet = entorno nuevo con wallet nueva, checklist de docs/07 y aprobación explícita. CI jamás toca la red (ni Preprod).

## D-014 — Blockchain detrás de puerto propio con doble modo

**Contexto.** Principio 7 del playbook: la dependencia más lenta e incierta va detrás de una interfaz propia con modo real/simulado. Acá es Cardano/Blockfrost.
**Decisión.** `packages/cardano` expone `AnchorPort` (`anchor()`, `verify()`, `awaitConfirmation()`) con dos implementaciones: `blockfrost` (real) y `simulated` (determinística: txid = hash del payload, confirmación inmediata, verificación real contra un ledger en memoria/SQLite). **El simulador es producto**: lo usan los tests, el CI, el seed de demo y el desarrollo offline. `ANCHOR_MODE=real|simulated` por entorno.
**Consecuencia.** Ninguna parte del sistema importa Lucid/Blockfrost directamente salvo el adaptador real.

## D-015 — Versionado por tipo de artefacto

**Decisión.** Servicios desplegados (web, api): CalVer `YYYY.MM.N` en tags de release. Contratos on-chain: versión entera en `aiken.toml` que se incrementa con cualquier cambio de validador (un script on-chain nuevo ES otra versión, sin grises). Packages internos del workspace: sin versionado (viven y mueren juntos).
**Alternativas descartadas.** SemVer para todo: no hay consumidores externos de librerías que lo justifiquen.

## D-016 — Adoptar el backend PoC como `packages/api` (Express 4 + Prisma + SQLite)

**Contexto (2026-07-15).** Al consolidar los tres frentes existía un backend funcionando y verificado end-to-end (auth JWT+bcrypt, CRUD de usuarios/proyectos/milestones, evidencia con SHA-256, audit log, autorización en dos capas) construido con Express 4 + Prisma + SQLite + Multer — distinto del stack que esta guía había cerrado en D-003/D-004 (Hono + Drizzle + PostgreSQL + S3). El playbook manda documentar contra realidad, no intenciones, y reabrir decisiones con evidencia: la evidencia es que el código existe, funciona, y reescribirlo costaría días sin agregar valor a la demo.
**Decisión.** El backend entra tal cual como `packages/api`. Sus decisiones internas vigentes se absorben: Express 4 con `@types/express` pineado a la línea 4 (ex ADR-002), Prisma + SQLite en dev con schema portable a Postgres (ex ADR-003), JWT firmado + bcrypt cost 10 con revalidación `isActive` por request (ex ADR-004), evidencia en disco local + SHA-256 inmutable como ancla (ex ADR-005), autorización rol global + membresía (ex ADR-006). La integración Cardano, que el backend había excluido (ex ADR-008), **vuelve a estar en alcance en este repo** vía `packages/cardano`/`AnchorPort` (D-014).
**Alternativas descartadas.** Reescribir en Hono+Drizzle antes de la demo (costo sin retorno inmediato); mantener dos repos (contradice la consolidación).
**Trigger de revisión.** Antes del primer deploy real: migrar el datasource a PostgreSQL (obligatorio, el schema ya lo prevé) y evaluar S3 (D-011). La migración de framework Express→Hono solo se reabre con evidencia (bloqueo técnico o costo de mantenimiento medido), no por preferencia.
**Reversión.** Las rutas están aisladas por recurso y la auth encapsulada en `src/lib/jwt.ts` + `src/middlewares/auth.ts`; migrar framework u ORM es incremental por recurso.

## D-017 — Contratos: adoptar el proyecto Aiken del backend en `contracts/`

**Contexto (2026-07-15).** El backend traía un proyecto Aiken real (v1.1.21, Plutus V3, stdlib v3.0.0) con el validador de milestones V1 funcionando (`milestone.ak`, y un duplicado `milestone2.ak` — ex ADR-009 Abierta). La guía traía dos validadores de referencia del diseño Fase B (`certification.ak`, `milestone_state.ak` con thread token) y la lib pura `lib/plataforma/milestone.ak`.
**Decisión.** `contracts/` parte del proyecto Aiken del backend (aiken.toml, lock y validadores V1 vigentes). Los validadores de referencia de la guía entran en `contracts/reference/` como material de diseño de Fase B (D-008), NO como código activo: no compilan necesariamente contra la versión pineada y no se despliegan.
**Pendiente (hereda ex ADR-009, sigue Abierta).** Consolidar `milestone.ak` vs `milestone2.ak`: default conservar `milestone.ak`; spike ≤1 día confirmando con quien escribió `milestone2.ak`. Se cierra borrando uno en un PR que actualice esta entrada.
**Reversión.** Ver trigger de D-001 (extracción a repo propio al congelarse para auditoría).
