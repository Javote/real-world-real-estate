# DECISIONS.md

> **Jerarquía de precedencia — dos capas:**
>
> - **Obligaciones (el *qué*): `docs/` es ley.** Son los entregables aprobados por reviewers de Catalyst 1400106. Nada de este archivo puede reducir lo que debemos.
> - **Implementación (el *cómo*): DECISIONS.md > CLAUDE.md > specs/.**
>
> Ante contradicción, gana el de mayor precedencia y el documento en conflicto se corrige en el mismo commit en que se detecta. Reabrir una decisión **Aceptada** requiere evidencia (spike, incidente, medición), no preferencia. La numeración nunca se recicla.
>
> **`docs/` no se edita nunca.** Un error o una ambigüedad en un entregable se resuelve con una decisión acá que cite el documento y el párrafo. **Un desvío solo es legítimo si** (a) el entregable se contradice internamente, (b) es un error de redacción, o (c) seguirlo al pie contradiría una verdad del producto declarada por el dueño — **nunca por conveniencia**. Los desvíos vigentes están listados en §Desvíos vigentes, acá arriba, y se comunican en la entrega. Ver D-022 y D-033.
>
> **Historia:** este repo consolida la guía de implementación con el backend PoC (`cardano-real-estate-backend`). Los ADR-001..009 de ese repo quedan absorbidos acá (los vigentes, como D-016/D-017; el resto como contexto). El registro original y los snapshots del material fuente se eliminaron del árbol de trabajo en la consolidación documental de 2026-07-29; siguen disponibles en el historial de git: `git log --oneline --diff-filter=D --name-only -- 'docs/context/*'` da el commit que los borró, y el anterior los contiene.

## Índice

| # | Decisión | Estado |
|---|---|---|
| D-001 | Monorepo pnpm con `contracts/` adentro | Aceptada (trigger de revisión definido) |
| D-002 | Frontend: TanStack Start + shadcn/ui | Aceptada |
| D-003 | Backend separado (Hono), no server functions del frontend | Aceptada en su núcleo (separación web/api); framework reemplazado por D-016 |
| D-004 | Drizzle ORM + PostgreSQL | Reemplazada por D-016; el ORM (Drizzle) se ratifica como destino futuro por D-038 |
| D-005 | Web3 TS: Lucid Evolution + Blockfrost | Aceptada |
| D-006 | Anclaje Fase A por metadata de transacción (label 1904) | Aceptada |
| D-007 | Lifecycle de milestones: backend = fuente de verdad; on-chain solo Fase B | Aceptada |
| D-008 | Validador de milestones: patrón state-thread con thread token, núcleo puro separado | Aceptada |
| D-009 | Custodia de firmas de certificador/notario | Aceptada (co-firma CIP-30 no-custodial) |
| D-010 | Deploy: Railway con "Wait for CI"; GitHub Actions no despliega | Aceptada en su núcleo (GHA no despliega); **plataforma reemplazada por D-039** |
| D-011 | Storage: S3 genérico — MinIO en dev, Cloudflare R2 en prod | Aceptada (transición: dev usa disco local por D-016 hasta integrar S3) |
| D-012 | Cambios aditivos entre deploys; migraciones idempotentes en entrypoint | Aceptada |
| D-013 | Red Cardano: Preprod hasta aprobación de gobernanza | Aceptada |
| D-014 | Dependencia blockchain detrás de puerto propio con modo real/simulado | Aceptada |
| D-015 | Versionado: CalVer para servicios; enteros para contratos | Aceptada |
| D-016 | Adoptar el backend PoC (Express 4 + Prisma + SQLite + JWT/bcrypt + disco local) como `packages/api` | Aceptada (trigger de revisión enmendado por D-038: el destino ya no es PostgreSQL) |
| D-017 | Contratos: adoptar el proyecto Aiken del backend en `contracts/`, junto a los validadores de referencia | Aceptada; **consolidación cerrada por D-054** (mismo hash, `milestone2.ak` borrado); **`reference/` borrada por D-056** |
| D-018 | El producto se llama **PropNexus** | Aceptada |
| D-019 | Plutus **V3**, no V2 — desvío documentado del SOM de M3 | Aceptada |
| D-020 | FSM canónica del stage — confirma el entregable original | Aceptada |
| D-021 | **La plataforma nunca custodia ni transfiere valor**, en ninguna fase | Aceptada |
| D-022 | `docs/` inmutable (entregables oficiales); el stack canónico vive en `CLAUDE.md` | Aceptada (**enmendada 2026-08-23**: es regla, no bloqueo) |
| D-023 | `Milestone` → `ConstructionStage` en el dominio; "milestone" reservado a Catalyst | Aceptada |
| D-024 | Sistema de diseño: Tailwind v4 + shadcn/ui con los tokens normativos de M2-D3 | Aceptada |
| D-025 | i18n es-AR/en-US: diccionarios propios, cero strings hardcodeados | Aceptada |
| D-026 | **La plataforma no certifica, no valida y no decide** — solo registra, ancla y refleja | Aceptada |
| D-027 | Taxonomía de archivos: el hash es el ticket de entrada a la cadena de prueba | Aceptada |
| D-028 | Qué significa "evidencia sin firmar" (criterio 7 del SOM) | Aceptada |
| D-029 | Alcance del dominio: stages del proyecto; la unidad es lo comercial | Aceptada |
| D-030 | Trunk-based: una sola rama `main`, sin PRs | Aceptada (enmendada por D-031) |
| D-031 | Ramas cortas por track para árboles de trabajo paralelos | **Obsoleta por D-053** — `worktree.sh` borrado; nunca se usó |
| D-032 | El harness de agentes: la puerta es ejecutable y lo irreversible se bloquea por hook | **Revertida por D-053** |
| D-033 | `docs/` contiene solo entregables; el índice se muda a `specs/entregables.md` | Aceptada |
| D-034 | El inventario del stack vive en `specs/stack.md`; `CLAUDE.md` conserva lo de sesión | Aceptada |
| D-035 | Zod 4 en el contrato compartido | Aceptada |
| D-036 | Multer 2.x | Aceptada |
| D-037 | Nitro: versión publicada en vez de nightly | Aceptada; su deuda del `502` **cerrada por D-050** |
| D-038 | Datos: Drizzle (destino, diferido) · SQLite (default, no Postgres) · Turso (hosting en prod) | Aceptada (compromiso de dirección; migración diferida, ver Trigger) |
| D-039 | Plataforma de deploy: Render. Railway descartado | Aceptada |
| D-040 | El deploy de M3 corre en free tier ($0/mes). Restricción de diseño, no de presupuesto | Aceptada |
| D-041 | Deploy con runtime nativo de Node + `render.yaml`. Sin Docker | Aceptada |
| D-042 | En la superficie 🔴 el default inseguro no existe: se revienta al arrancar y se cierra al omitir | Aceptada |
| D-043 | La regla de visibilidad de proyectos existe una sola vez: `projectScope` | Aceptada |
| D-044 | La segunda capa de autorización la verifica la puerta; el middleware queda diferido | **Revertida por D-053** — el escáner se borró; la regla queda sin enforcement |
| D-045 | Rate limiting en `/auth/login`, y de dónde sale la IP del cliente | Aceptada |
| D-046 | bcrypt se ratifica —con el argumento del free tier— y la política de passwords sale de NIST/OWASP | Aceptada |
| D-047 | El seed de demo se niega a sembrar credenciales publicadas en una base que no sea local | Aceptada |
| D-048 | La migración a Drizzle deja de estar diferida: arranca antes de las rebanadas de M3 | Aceptada |
| D-049 | ORM: Drizzle → Kysely, un commit después de D-048 | Aceptada |
| D-050 | El `502` en `POST`+`401` es el spec de fetch, no h3: `credentials: "omit"` | Aceptada (cierra D-037) |
| D-051 | El primer deploy sale con evidencia efímera y marcada, en vez de esperar a R2 | Aceptada |
| D-052 | Saneamiento: se borra el rastro de Prisma y Drizzle, y cada cosa queda en un solo lugar | Aceptada |
| D-053 | El harness de agentes se borra entero. Vuelve el CI declarativo | Aceptada (revierte D-032) |
| D-054 | Reseteo de estándar: Express 5, errores que no mienten, Biome, un validador, TS separado de Aiken | Aceptada |
| D-055 | Estructura cerrada: `apps/` es lo desplegable, `packages/` es librería | Aceptada |
| D-056 | `contracts/reference/` se borra: describía otra FSM que la que corre | Aceptada (enmienda D-017) |

> **Repaso completo con la documentación oficial: ver §Repaso al final del archivo.** D-001..D-017 se
> escribieron sin los entregables delante; las 25 entradas se revisaron el 2026-07-29 y cada una
> tiene veredicto registrado.

## Desvíos vigentes

Los cinco lugares donde **no seguimos la letra** de un entregable, cada uno con el caso que lo
legitima. Ninguno se resolvió editando el entregable, y **todos se comunican en la entrega**.

| Qué dice el entregable | Resolución | Caso | Decisión |
|---|---|---|---|
| M3 SOM: "Plutus **V2** state machine"; M2-D5 §3 repite el supuesto. | El proyecto Aiken es v1.1.21 y compila **Plutus V3** (`contracts/plutus.json`). V3 es estrictamente posterior y es lo que Aiken 1.1.x emite nativamente. Ningún entregable fija versión de Aiken. | (b) error de redacción | D-019 |
| M3 SOM: "signers/**percentages** configurables", "reserva → creación de **escrow** < 12 min". | **La plataforma nunca custodia ni transfiere valor**, en ninguna fase. Los porcentajes son cronograma registrado como dato; el "escrow" es el contrato creado y anclado. | (c) contradice una verdad del producto | D-021 |
| M1 §README lista los estados como "…**Certified**…"; el `.puml` dice `Completed`. | Gana `Completed`: precedencia interna de M1 (artefactos especificados > README de cortesía), y además `Certified` implicaría que la plataforma certifica. | (a) contradicción interna | D-020, D-026 |
| M1 §README promete que la taxonomía indica "authoritative" y "anchored on-chain". | El CSV entregado no tiene esas columnas. El README prometió de más; el hueco lo llenan D-027 (qué se ancla) y D-028 (qué es autoritativo). | (a) contradicción interna | D-027, D-028 |
| M2-D5 §2.1 usa notación de rutas Wouter. | Las rutas se leen como **paths**, no como elección de router. Los entregables son agnósticos de stack. | (b) error de redacción | D-022 |

> Vivían en `docs/README.md` hasta el 2026-08-20. Estaban del lado inmutable, así que la tabla no
> se podía mantener: un desvío nuevo no tenía dónde anotarse. Ver D-033.


---

## D-001 — Monorepo pnpm con `contracts/` adentro

**Contexto.** El playbook decide mono vs multi-repo por ciclo de vida: los contratos que se congelan y auditan suelen ir aparte. Acá los contratos de Fase A/B son anclaje e integridad (sin fondos), evolucionan junto al backend que los consume vía blueprint, y el equipo es chico.
**Decisión.** Un solo repo. `contracts/` vive adentro pero aislado (fuera del workspace pnpm, CI propio con `aiken check` + verificación de `plutus.json`).
**Alternativas descartadas.** Repo aparte de contratos desde el día 1: fricción de sincronización de blueprint sin beneficio mientras no haya auditoría.
**Trigger de revisión (reescrito 2026-07-29).** El trigger original era "cuando `stage_release` (M3-SC-03) custodie fondos reales". **Esa condición nunca se va a cumplir:** por D-021 la plataforma no custodia valor en ninguna fase, así que ningún validador va a manejar fondos. El trigger vigente es otro: **cuando los validadores se congelen para auditoría externa de cara a mainnet**, se re-evalúa extraer `contracts/` a repo propio congelable. Registrar el resultado como D-0XX nueva.
**Reversión.** `git filter-repo` sobre `contracts/` + el blueprint pasa a consumirse como artefacto versionado.

## D-002 — Frontend: TanStack Start + shadcn/ui

**Contexto.** Requisito del mandato. Cuatro superficies por rol según el diseño D1/D3.
**Decisión.** TanStack Start (SSR para browse público y dossier compartido) + shadcn/ui + TanStack Query.
**Alternativas descartadas.** Next.js (peso innecesario declarado por el owner); SPA pura (pierde SSR del browse público).
**Nota de consolidación (2026-07-15).** La primera versión de `apps/web` porta las pantallas de la maqueta PropTrust con su CSS original; shadcn/ui entra con el rediseño de identidad visual a cargo de UX/UI, sin cambiar esta decisión.
**Actualización (2026-07-29).** Esa maqueta PropTrust quedó obsoleta: el diseño vigente es PropNexus (M2-D1/D3/D4) y no deriva de ella. El CSS portado y sus snapshots se eliminaron. La adopción de shadcn/ui con los tokens de M2-D3 se formaliza en D-024.
**Reversión.** Alta fricción; solo con evidencia de bloqueo del framework.

## D-003 — Backend separado (Hono) — **núcleo vigente; framework reemplazado por D-016**

**Contexto.** TanStack Start podría hacer fullstack, pero: la seed de la wallet de servicio no debe convivir con el proceso web público; el pipeline de anclaje son operaciones largas; hará falta un worker de confirmaciones.
**Decisión.** `packages/api` como servicio propio. El frontend jamás toca Cardano. **Lo que sigue vigente:** la separación web/api. **Lo reemplazado:** el framework elegido era Hono; por D-016 la API es el backend Express adoptado.
**Alternativas descartadas.** Server functions de Start (mezcla secretos y timeouts); NestJS (peso sin beneficio a esta escala).
**Reversión.** Los routers se montan casi 1:1 como server routes de Start si algún día se colapsa. El camino inverso (extraer después) es el caro — por eso se separa ahora.

## D-004 — Drizzle + PostgreSQL — **Reemplazada por D-016**

**Decisión original.** Drizzle ORM, migraciones drizzle-kit, PostgreSQL 16.
**Reemplazo (2026-07-15).** Existe un backend funcionando con Prisma + SQLite (dev); reescribirlo costaría días sin agregar valor a la demo. Ver D-016.
**Actualización (2026-08-20, D-038).** El ORM Drizzle de esta decisión original se ratifica como destino futuro (migración diferida, sin fecha). El destino de datastore ya **no** es PostgreSQL: default SQLite, con Turso como hosting probable en producción — ver D-038.

## D-005 — Lucid Evolution + Blockfrost — **Aceptada**

**Contexto.** Dos libs TS maduras: Lucid Evolution y Mesh SDK. Lucid integra natural con blueprints CIP-57 de Aiken.
**Decisión (ratificada 2026-08-20).** Lucid Evolution + Blockfrost Preprod como SDK Web3 TypeScript estándar para `packages/cardano` detrás del puerto `AnchorPort` (D-014).

## D-006 — Anclaje Fase A por metadata (label 1904)

**Contexto.** El baseline (§13) pide empezar con transacciones de anclaje compactas y subir a validadores solo donde agreguen valor.
**Decisión.** Fase A: tx con metadata `{v, t, h, r, p?}` bajo `ANCHOR_METADATA_LABEL`; strings ≤64 bytes; cero PII. Cubre M3-SC-01/02/06.
**Alternativas descartadas.** Validador para todo desde el día 1 (complejidad sin retorno); NFT por evidencia (costo y ruido).
**Criterio de qué se ancla (agregado 2026-07-29).** Se ancla lo que alguien podría necesitar verificar en una disputa; nada más. Ver D-027 para la taxonomía. **Perfil de carga observado:** lo anclable es escaso, valioso y llega temprano (permisos, planos, actas — de a uno) → el anclaje **individual** (`M3-SC-06`) es el caso normal, no la excepción, y el bundle con Merkle (`M3-SC-02`) es para cuando una etapa cierra con varios artefactos juntos. Lo voluminoso llega tarde (renders, fotos de unidad de muestra) y **no toca la cadena**: es presión sobre el almacenamiento (D-011), no sobre Cardano. Son dos subsistemas con perfiles opuestos; no dimensionarlos juntos.
**Reversión.** N/A — Fase B se suma, no reemplaza: los anchors de metadata siguen siendo válidos históricamente.

## D-007 — Lifecycle de milestones: backend = fuente de verdad

**Contexto.** El baseline §11 dice explícito que la fase 1 no exige enforcement on-chain del ciclo de vida.
**Decisión.** La máquina de estados se persiste en el backend (hoy: enum `MilestoneState` + rutas de la API; objetivo: función pura en `packages/shared`). On-chain se anclan pruebas de las transiciones relevantes. El validador de stages (D-008) es opt-in de Fase B para stages `validation_critical`.
**Reformulación del fundamento (2026-07-29).** El título original —"el backend es la fuente de verdad"— se presta a leer que el backend **decide** el estado de una obra. No decide nada (D-026). El estado real lo determinan procesos externos: un municipio aprueba, un profesional observa, una obra avanza. Lo que el backend es fuente de verdad **de** es el **registro** de ese estado: qué se declaró, cuándo, y quién lo declaró. La implementación no cambia; el fundamento sí, y esto importa para no derivar mal después — por ejemplo, no hay ninguna regla de negocio que la plataforma pueda "hacer cumplir" sobre la obra, solo sobre la coherencia de su propio registro.
**Reversión.** Subir enforcement es aditivo (D-006).

## D-008 — Validador de milestones: state-thread + núcleo puro

**Decisión.** Un UTxO por milestone identificado por thread token (asset name = milestone_ref); transiciones = gastar y recrear con datum nuevo. Tipos y tabla de transiciones en `lib/plataforma/milestone.ak` (puro, testeable barato); el validador es cáscara delgada. Espejo 1:1 con la implementación del backend.
**Alternativas descartadas.** Todo en un archivo (impide importar tipos desde `stage_release.ak` y encarece tests); estado por datum sin token (falsificable por UTxOs paralelos).
**Nota de consolidación.** El validador ya escrito en el backend (`milestone.ak`, sin thread token, 1-input/1-output) es la V1 vigente; este patrón state-thread es el objetivo de Fase B.
**Fundamento reformulado (2026-07-29) — por qué sigue haciendo falta un validador.** Con D-021 (nunca custodia valor) y D-026 (no decide nada), la pregunta obligada es: si la plataforma no controla nada, ¿para qué un validador Plutus en vez de simple metadata (D-006)?

> **El validador no controla el mundo real: controla al operador de la plataforma.**

Con anclaje por metadata suelto, quien tenga la wallet de servicio puede publicar cualquier secuencia de anchors —contradictoria, fuera de orden, o inventada a posteriori— y la cadena la acepta sin chistar. Con state-thread, cada transición debe gastar el UTxO anterior: la secuencia queda **encadenada y ni nosotros mismos podemos falsificarla después**.

Para un producto cuya tesis es "verificá sin confiar en la plataforma" (D-026), esa distinción *es* el producto: sin ella, el comprador sigue teniendo que confiar en nosotros, que es exactamente el problema que veníamos a resolver. Y es además lo que hace honesto el criterio del SOM cuando pide una *state machine* y no una lista de anclajes.
**Consecuencia.** El validador se justifica solo donde la integridad de la **secuencia** importa (stages `validation_critical`). Para artefactos sueltos sin secuencia —un documento aislado, `M3-SC-06`— la metadata alcanza y agregar validador sería complejidad sin retorno.

## D-009 — Custodia de firmas de certificador/notario — **Aceptada**

**Contexto.** Los commits Fase B (SC-04/05) exigen firma del profesional. Dos modelos: co-firma CIP-30 desde el navegador (no-custodial, más fricción de UX) vs. wallet por rol operada por el backend (custodial, más simple, más riesgo).
**Decisión (ratificada 2026-08-20).** Co-firma CIP-30 no-custodial: el backend arma la tx parcialmente firmada y el profesional co-firma desde su wallet extension (Eternl/Vespr/Nami). Preserva el principio D-021 (cero custodia de claves privadas o identidad ajena por la plataforma).

## D-010 — Deploy: Railway, "Wait for CI", GHA no despliega — **Default**

**Decisión.** GitHub Actions = barrera de calidad únicamente. Railway detecta push a `main`, buildea ambos Dockerfiles, rollout con healthcheck. Watch paths por servicio.
**Alternativas.** VPS + Coolify (más barato, self-hosted): cambiar cuesta horas, no días. Por eso queda como Default con reversión barata en lugar de exigir spike.

**Corrección de hecho (2026-08-20).** Esta entrada afirmaba que Railway "buildea ambos
Dockerfiles" y que la reversión era "el propio `docker-compose.prod.yml` que ya existe".
**Ninguno de los tres archivos existe** — no hay `Dockerfile` de web, ni de api, ni compose, ni
cuenta de Railway. La decisión sigue en pie como Default; lo que se corrige es la descripción,
que daba por construido lo que solo estaba decidido. Es exactamente el error que el principio 5
previene, y llegó a estar replicado en `README.md`. Inventario honesto: `specs/stack.md` §8.

**Reemplazo parcial (2026-08-20, D-039).** La plataforma deja de ser Railway: es **Render**. Lo que
sobrevive de esta entrada es su núcleo, que nunca fue el proveedor — **GitHub Actions es barrera de
calidad y no despliega**, el rollout va con healthcheck, y el build por servicio se dispara por push
a `main`. Ver D-039.

**Remanente corregido (2026-08-20, D-041).** Esta entrada también daba por sentado **Docker**
("buildea ambos Dockerfiles"), que era una exigencia *de Railway*. D-039 cambió la plataforma pero
ese supuesto pasó de contrabando adentro del núcleo preservado. Render corre Node con runtime
nativo: no hacen falta Dockerfiles. Ver D-041.

## D-011 — Storage S3 genérico: MinIO dev / R2 prod

**Decisión.** El código habla S3 estándar; el entorno decide el proveedor. URLs prefirmadas TTL ≤ 15 min; `storage_key` jamás se expone.
**Alternativas descartadas.** Archivos en Postgres (bloat); disco local (mata portabilidad del deploy).
**Nota de transición (2026-07-15).** El backend adoptado (D-016) guarda evidencia en disco local vía Multer (`UPLOAD_DIR`); migrar a S3 es un spike acotado que no cambia el contrato de la API (el almacenamiento está detrás de `src/lib/upload.ts` + `storagePath` en DB). Esta decisión marca el destino; el disco local es el estado de partida documentado.

**Promoción a prerequisito (2026-08-20, D-040).** Deja de ser "transición futura": el free tier de
Render **no tiene disco persistente** y su filesystem se borra en cada redeploy, restart y
spin-down (cada 15 min de inactividad). Con evidencia en disco local, el hash sobrevive en la base
y el archivo no — la app mostraría evidencia anclada que no puede exhibir, violando la regla 17.
**R2 tiene que estar antes del primer deploy, no después.** Ver D-040.

## D-012 — Cambios aditivos entre deploys

**Decisión.** Web y api salen del mismo push y conviven versiones por segundos. API agrega sin renombrar ni mutar en el mismo deploy; remociones en deploy posterior. Migraciones aditivas e idempotentes (las corre el entrypoint).
**Consecuencia.** Regla dura en CLAUDE.md; `packages/shared` + CI la vigilan.

## D-013 — Preprod hasta aprobación de gobernanza

**Decisión.** `CARDANO_NETWORK=Preprod` en todos los entornos. Mainnet = entorno nuevo con wallet nueva, checklist de despliegue y aprobación explícita. CI jamás toca la red (ni Preprod).
**Actualización (2026-07-29).** Preprod y no Preview: espeja mainnet en parámetros de protocolo y epochs, tiene faucet estable y es la mejor soportada por Blockfrost y los exploradores públicos donde el revisor va a verificar los TXIDs. **Mainnet queda fuera del alcance de M3**, que corre íntegramente en testnet: requiere entorno nuevo, wallet nueva y aprobación explícita.

## D-014 — Blockchain detrás de puerto propio con doble modo

**Contexto.** Principio 7 (`CLAUDE.md` §Principios de trabajo): la dependencia más lenta e incierta va detrás de una interfaz propia con modo real/simulado. Acá es Cardano/Blockfrost.
**Decisión.** `packages/cardano` expone `AnchorPort` (`anchor()`, `verify()`, `awaitConfirmation()`) con dos implementaciones: `blockfrost` (real) y `simulated` (determinística: txid = hash del payload, confirmación inmediata, verificación real contra un ledger en memoria/SQLite). **El simulador es producto**: lo usan los tests, el CI, el seed de demo y el desarrollo offline. `ANCHOR_MODE=real|simulated` por entorno.
**Consecuencia.** Ninguna parte del sistema importa Lucid/Blockfrost directamente salvo el adaptador real.

## D-015 — Versionado por tipo de artefacto

**Decisión.** Servicios desplegados (web, api): CalVer `YYYY.MM.N` en tags de release. Contratos on-chain: versión entera en `aiken.toml` que se incrementa con cualquier cambio de validador (un script on-chain nuevo ES otra versión, sin grises). Packages internos del workspace: sin versionado (viven y mueren juntos).
**Alternativas descartadas.** SemVer para todo: no hay consumidores externos de librerías que lo justifiquen.

## D-016 — Adoptar el backend PoC como `packages/api` (Express 4 + Prisma + SQLite)

**Contexto (2026-07-15).** Al consolidar los tres frentes existía un backend funcionando y verificado end-to-end (auth JWT+bcrypt, CRUD de usuarios/proyectos/milestones, evidencia con SHA-256, audit log, autorización en dos capas) construido con Express 4 + Prisma + SQLite + Multer — distinto del stack que esta guía había cerrado en D-003/D-004 (Hono + Drizzle + PostgreSQL + S3). El playbook manda documentar contra realidad, no intenciones, y reabrir decisiones con evidencia: la evidencia es que el código existe, funciona, y reescribirlo costaría días sin agregar valor a la demo.
**Decisión.** El backend entra tal cual como `packages/api`. Sus decisiones internas vigentes se absorben: Express 4 con `@types/express` pineado a la línea 4 (ex ADR-002), Prisma + SQLite en dev con schema portable a Postgres (ex ADR-003), JWT firmado + bcrypt cost 10 con revalidación `isActive` por request (ex ADR-004), evidencia en disco local + SHA-256 inmutable como ancla (ex ADR-005), autorización rol global + membresía (ex ADR-006). La integración Cardano, que el backend había excluido (ex ADR-008), **vuelve a estar en alcance en este repo** vía `packages/cardano`/`AnchorPort` (D-014).
**Alternativas descartadas.** Reescribir en Hono+Drizzle antes de la demo (costo sin retorno inmediato); mantener dos repos (contradice la consolidación).
**Trigger de revisión.** ~~Antes del primer deploy real: migrar el datasource a PostgreSQL~~ —
enmendado por D-038 (2026-08-20): el destino ya no es PostgreSQL, es mantener SQLite con Turso como
hosting probable en producción. Evaluar S3 (D-011) sigue vigente, es independiente del datastore.
La migración de framework Express→Hono solo se reabre con evidencia (bloqueo técnico o costo de
mantenimiento medido), no por preferencia.
**Reversión.** Las rutas están aisladas por recurso y la auth encapsulada en `src/lib/jwt.ts` + `src/middlewares/auth.ts`; migrar framework u ORM es incremental por recurso.

## D-017 — Contratos: adoptar el proyecto Aiken del backend en `contracts/`

**Contexto (2026-07-15).** El backend traía un proyecto Aiken real (v1.1.21, Plutus V3, stdlib v3.0.0) con el validador de milestones V1 funcionando (`milestone.ak`, y un duplicado `milestone2.ak` — ex ADR-009 Abierta). La guía traía dos validadores de referencia del diseño Fase B (`certification.ak`, `milestone_state.ak` con thread token) y la lib pura `lib/plataforma/milestone.ak`.
**Decisión.** `contracts/` parte del proyecto Aiken del backend (aiken.toml, lock y validadores V1 vigentes). Los validadores de referencia de la guía entran en `contracts/reference/` como material de diseño de Fase B (D-008), NO como código activo: no compilan necesariamente contra la versión pineada y no se despliegan.
**Enmendada (2026-08-23) por D-056.** `contracts/reference/` se borró entera: describía una FSM distinta de la canónica (D-020) y sus 10 tests probaban esa otra máquina. Guardar material de diseño *en el árbol del proyecto y en el mismo lenguaje que el código activo* fue el error; el `README.md` de la carpeta no alcanzó para distinguirlos.
**Pendiente (hereda ex ADR-009, sigue Abierta).** Consolidar `milestone.ak` vs `milestone2.ak`: default conservar `milestone.ak`; spike ≤1 día confirmando con quien escribió `milestone2.ak`. Se cierra borrando uno en un PR que actualice esta entrada.
**Reversión.** Ver trigger de D-001 (extracción a repo propio al congelarse para auditoría).

---

> Las decisiones D-018 a D-025 se registran el **2026-07-29**, al incorporar la documentación
> oficial completa de Milestones 1, 2 y 3 (`docs/`). Varias resuelven contradicciones entre los
> entregables y el código existente; ninguna se resolvió editando un entregable (D-022).

## D-018 — El producto se llama PropNexus

**Contexto.** El repo arrastraba el nombre **PropTrust**, tomado de una maqueta visual anterior. Toda la documentación oficial (M2-D1, M2-D3, M2-D4, apéndice de M2-D6) dice **PropNexus**, y así está registrado el proyecto Catalyst 1400106.
**Decisión.** PropNexus es el nombre del producto en todas las superficies: UI, logo del `GradientHeader`, copy, README, títulos de documentos propios. La clave de `localStorage` del selector de idioma es `propnexus.lang`, literal, como fija M2-D3 §Localization.
**Alcance del rename.** Sin efecto en nombres de paquetes internos (`@plataforma/api`), que no son visibles al usuario y renombrarlos es churn sin valor.
**Reversión.** N/A — el nombre lo fija un compromiso externo.

## D-019 — Plutus V3, no V2

**Contexto.** El SOM de M3 dice literalmente *"Smart-contract suite (**Plutus V2** state machine)"*, y M2-D5 §3 repite el supuesto. El proyecto Aiken existente es `v1.1.21` con `aiken-lang/stdlib v3.0.0`, y su blueprint declara `"plutusVersion": "v3"`.
**Decisión.** Se mantiene **Plutus V3**. Es lo que Aiken 1.1.x emite nativamente; bajar a V2 exigiría pinear una versión anterior de Aiken y su stdlib, reescribir los validadores existentes y renunciar a mejoras del intérprete, sin ningún beneficio funcional.
**Cómo se comunica.** El desvío se explicita en la entrega de M3: V3 es estrictamente posterior a V2 y satisface la intención del criterio ("una máquina de estados en un lenguaje de contratos de Cardano"), no su literalidad. Registrarlo en el reporte de entrega, no descubrirlo en la revisión.
**Reversión.** Cara y sin retorno técnico. Solo si un revisor lo exige explícitamente por escrito.

## D-020 — FSM canónica del stage

> **Reescrita el 2026-07-29 tras aparecer los artefactos originales de M1.** La versión anterior de
> esta decisión afirmaba que el diagrama de ciclo de vida de M1 estaba mal dibujado y que
> desviábamos de él. **Era falso.** Lo que estaba mal era un `.puml` regenerado a posteriori desde
> el PDF, que invirtió las flechas y que nunca formó parte de la entrega. El entregable original
> —`M1-D2-Architecture-and-Data-Models/3-milestone-lifecycle.puml`, y el PDF `M1-D2c` que coincide
> con él— dice exactamente lo que decidimos. **Esta decisión ya no es un desvío: es una
> confirmación.**

**Contexto.** El entregable original dice, textual:

```
[*] --> Pending
Pending    --> InProgress : work initiated
InProgress --> Completed  : evidence complete
InProgress --> Observed   : issue detected
Observed   --> InProgress : remediation completed
```

**Decisión.** La topología canónica es exactamente esa:

```
Pending → InProgress → Completed        (Completed es terminal)
             ↑↓
          Observed
```

`Observed` es un **camino de remediación**, no un estado final: se observa para que el developer corrija y vuelva a `InProgress`. El entregable lo confirma con las etiquetas de sus transiciones ("issue detected" / "remediation completed") y es consistente con M2-D1 §6.2.

**Nombre del estado: `Completed`.** Hay una inconsistencia *interna* del propio M1: el `README.md` de la carpeta lista los estados como "Pending / In Progress / **Certified** / Observed", mientras que el `.puml` dice `Completed`. Gana `Completed` por la regla de precedencia interna de M1 (ver D-022): los artefactos especificados en `Instructions.txt` —los cuatro `.puml` y el `.csv`— mandan sobre el `README.md`, que es un resumen de cortesía redactado después. Además `Completed` es el nombre correcto por D-026: `Certified` implicaría que la plataforma certifica, y no certifica.
**Etiqueta visible.** El estado en datos se llama `Completed`; la etiqueta que ve el usuario sale del diccionario i18n (D-025), respetando M2-D4 §8.2 (*"the server returns keys; the client renders"*).
**Lección registrada.** El error no estuvo en el entregable sino en un artefacto **derivado** de él. Verificar siempre contra lo entregado, nunca contra su transcripción — ver Gotchas de `CLAUDE.md`.
**Reversión.** Cambiar la topología rompe el validador, la tabla de transiciones del backend y la UI a la vez. Requiere decisión nueva — y ahora también contradiría un entregable aprobado.

## D-021 — La plataforma nunca custodia ni transfiere valor

**Contexto.** El SOM de M3 usa vocabulario financiero que sugiere custodia: *"≥8 stages con signers/**percentages** configurables"*, *"mediana desde reserva hasta creación de **escrow** < 12 minutos"*, y `M3-SC-03` se llama *"stage payment release"*. Leído literalmente, describe un validador que retiene y libera fondos.
**Decisión.** **La plataforma no custodia, no retiene y no transfiere valor — en ninguna fase, ahora ni después.** On-chain van exclusivamente commitments criptográficos (hashes, Merkle roots) y sus TXIDs. Todo movimiento de dinero ocurre íntegramente fuera de la plataforma, entre las partes, por sus canales habituales.
**Cómo se releen los términos del SOM:**

| Término del SOM | Qué es en realidad |
|---|---|
| "stage payment release" (`M3-SC-03`) | Anclaje del **evento** de liberación: qué stage, qué monto, quién lo liberó, cuándo. No ejecuta el pago. |
| "percentages configurables" | Cronograma de pagos registrado como dato del contrato. No es una distribución de fondos on-chain. |
| "signers configurables" | Qué rol puede autorizar cada transición del stage. Es autorización de **estado**, no de gasto. |
| "creación de escrow" | Creación del registro de contrato con su cronograma, y su anclaje. |
| "mediana reserva → escrow < 12 min" | Se mide desde que el investor acepta la invitación (M2-D1 §6.1 paso 5) hasta que el contrato queda creado y anclado con TXID confirmado. **Definir la instrumentación antes de la demo, no durante.** |

**Consecuencias.** (a) El frente de contratos baja de 🔴 a 🟡: no hay fondos en riesgo. (b) Lo único que justifica un validador real —y no solo anclaje por metadata (D-006)— es hacer cumplir transiciones de estado válidas on-chain para stages `validation_critical`, que es exactamente D-008. (c) El trigger de revisión de D-001 se reescribió, porque dependía de una custodia que no va a existir.
**Base documental.** Consistente con M1-D1 §On-Chain/Off-Chain Boundaries y §Non-Substitution Statement, y con M2-D6 §8.1–8.2. El SOM es el único documento que sugiere lo contrario, y lo hace por vocabulario, no por diseño.
**Reversión.** Introducir custodia sería un producto distinto con un perfil regulatorio distinto. Requiere renegociar el proyecto, no una decisión técnica.

## D-022 — `docs/` inmutable; tres `.md` en la raíz

**Contexto.** `docs/` pasó a contener los entregables oficiales de M1, M2 y M3 tal como fueron presentados. Editarlos para corregir errores desincronizaría el repo de lo que el revisor tiene, y volvería imposible verificar que entregamos lo que decimos. A la vez, esos entregables son **agnósticos de stack**: el único requisito técnico comprometido es que los contratos sean en Aiken.
**Decisión.** (a) `docs/` es de solo lectura; toda corrección, desvío o reinterpretación se registra como decisión acá, citando documento y párrafo. (b) El stack vigente —que es nuestro y es cambiable— se documenta **fuera de `docs/`**, en `CLAUDE.md` §Stack, y cambiarlo requiere una decisión acá, no una edición de esa tabla.
**Consecuencia estructural.** `docs/` queda con tres carpetas, una por milestone. (Tenía además un `README.md` de índice; se mudó a `specs/entregables.md` el 2026-08-20 — ver D-033.) Todo lo derivado que vivía ahí —guía de arquitectura, backlog, prompts, devops, snapshots de material fuente, reporte de sprint— se eliminó; lo vigente se re-derivó hacia `specs/` y estas decisiones.
**Actualización (2026-07-29, segunda pasada).** La raíz había quedado con ocho `.md`, lo que contradice el principio 1 (una sola fuente de verdad por cosa) por acumulación: dos índices del mismo trabajo, dos lugares con reglas de método. Se consolidó a **tres archivos**: `README.md` (entrada humana, arranque, entorno), `CLAUDE.md` (todo lo que un agente necesita por sesión: principios, stack, reglas, autonomía, commits, comandos, gotchas) y `DECISIONS.md`. `STACK.md`, `GUIA-COMMITS.md` y los diez principios de `PLAYBOOK.md` se absorbieron en `CLAUDE.md`; los pasos vivos de `SETUP.md` en `README.md`; `ROADMAP.md` en `specs/README.md`, que pasa a ser **el mapa de desarrollo** — un solo índice del trabajo en lugar de dos que divergen.
**Qué se perdió a propósito.** Instrucciones de acciones ya ejecutadas una sola vez (el scaffolding de `SETUP.md` contra un stack que no se usó; las fases 1-6 del playbook, ya cumplidas; la guía genérica de escalado). No son conocimiento vivo y siguen en el historial: `git log --diff-filter=D --name-only -- SETUP.md PLAYBOOK.md`.

**Enmienda (2026-07-29, tercera pasada) — precedencia en dos capas.** La formulación "docs/ está fuera de la jerarquía" quedó corta. Los entregables están **aprobados por reviewers** y no podemos decidir en contra de ellos; pero tomados al pie de la letra se contradicen entre sí y con verdades del producto. Se separa en dos autoridades:

- **`docs/` es ley sobre las obligaciones** — el *qué* y la vara de aceptación. Nada en este archivo puede reducir lo que debemos: ni el ≥95% de coverage, ni los pilotos, ni la URL pública, ni el runbook. Absoluto, sin excepción.
- **`DECISIONS.md` manda sobre la implementación** — el *cómo*, incluido dónde la letra de un entregable se interpreta en vez de seguirse literal.

**Un desvío solo es legítimo en tres casos:** (a) el entregable se contradice internamente, (b) es un error de redacción, (c) seguirlo al pie contradiría una verdad del producto declarada por el dueño. **Nunca por conveniencia ni por preferencia técnica.** Todo desvío se registra acá citando el párrafo, se lista en §Desvíos vigentes y **se comunica en la entrega**.

**Precedencia interna de M1.** `Instructions.txt` especifica el paquete entregado: cuatro `.puml` + un `.csv` + un `README.md`. Los **artefactos especificados** (`.puml`, `.csv`) mandan sobre el `README.md`, que es un resumen de cortesía escrito después para facilitarle la lectura a los reviewers. Resuelve la inconsistencia `Certified`/`Completed` (D-020) y aclara que las dos columnas que el README promete en la taxonomía —"authoritative" y "anchored on-chain"— nunca existieron en el CSV: son un hueco real que llenan D-027 y D-028, no una promesa incumplida que estemos pisando.

**Enmienda (2026-08-23) — `docs/` es una regla, no un bloqueo. La premisa original era más fuerte
de lo que los hechos sostienen.** Dato del dueño del producto: **los originales viven afuera y ya
fueron aprobados**. Los `.md` de `docs/` son adaptaciones que él mismo hizo de los PDF oficiales, y
las imágenes son copias literales de las entregadas. O sea que `docs/` en este repo es una **copia
de conveniencia**, no el ejemplar que tiene el revisor.

Eso desarma el argumento con el que arrancó esta decisión —*"editarlos desincronizaría el repo de lo
que el revisor tiene, y volvería imposible verificar que entregamos lo que decimos"*—: lo que el
revisor tiene no cambia si acá se edita algo, porque no es este archivo el que se le entregó.

**Qué cambia.** El bloqueo se va: el hook `guard-write.sh`, la entrada `Edit(./docs/**)` de
`permissions.deny` y el chequeo de la sección 1 de la puerta se borraron con el resto del harness
(D-053). **Qué NO cambia:** la disciplina de precedencia de las dos capas, entera. `docs/` sigue
siendo ley sobre las obligaciones, un desvío sigue siendo legítimo solo en los tres casos de abajo,
y sigue registrándose acá citando documento y párrafo. La razón para no editarlo deja de ser
"rompés un compromiso externo" y pasa a ser la de siempre: **una copia editada de un entregable
deja de servir como vara de aceptación**, que es lo único para lo que está en el repo.

**Artefactos derivados.** Solo lo entregado es canónico. Cuatro `.puml` regenerados desde los PDF se eliminaron el 2026-07-29 por contradecir los originales (flechas invertidas en la FSM, multiplicidades invertidas en el modelo de dominio, componentes perdidos en la arquitectura). Los PDF sí se conservan: fueron parte de la entrega, fueron aprobados y coinciden con los `.puml` originales.

**Desvío retirado (2026-07-29, mismo día).** Se había registrado acá un desvío `Milestone`/`UnitForSale` afirmando que M1 y M2 se contradecían. **No se contradicen** — la contradicción era mi lectura. Ver D-029, que resuelve el alcance del dominio sin desviarse de ningún entregable.

**Reversión.** Barata: `git revert` del PR de consolidación; todo sigue en el historial.

## D-023 — `Milestone` → `ConstructionStage` en el dominio

**Contexto.** "Milestone" se usa con dos significados incompatibles: los **hitos Catalyst** (M1, M2, M3… — etapas contractuales del proyecto) y las **etapas de obra** de un desarrollo inmobiliario. La documentación nueva ya resolvió la ambigüedad de hecho: M2 y M3 dicen **"stage"** de forma consistente (`/projects/:id/stages`, `/certifier/stages/:stageId`, `StageChip`, "Standard, 10 stages", "construction stage" en la matriz de permisos de M2-D1 §4). Los que dicen `Milestone` son M1-D2b y el código actual.
**Decisión.** El dominio se renombra a **`ConstructionStage`** (`stage` en rutas, props y variables). "Milestone" queda reservado **exclusivamente** para los hitos Catalyst. Alcance del rename:

| Dónde | De | A |
|---|---|---|
| Prisma | `model Milestone` | `model ConstructionStage` |
| Prisma | `enum MilestoneState` | `enum StageState` |
| Prisma | `Evidence.milestoneId` | `Evidence.stageId` |
| API | `/api/v1/…/milestones` | `/api/v1/…/stages` |
| Contratos | `validators/milestone.ak`, `lib/plataforma/milestone.ak` | `stage.ak` |
| Aiken | `name = "j/milestone-fsm"` | naming PropNexus |
| Specs | Referencias cruzadas al validador | renombradas |

**Reinterpretación de M1-D2b.** El entregable llama `Milestone` a esta entidad. Se lee como `ConstructionStage`; el entregable no se edita (D-022).
**Por qué ahora.** El rename cuesta una migración y un reemplazo cruzado hoy, cuando hay 5 rutas web y 6 archivos de rutas de API. Después de implementar las 53 entradas del backlog de M2-D5 cuesta un orden de magnitud más.
**Alternativas descartadas.** Mantener `Milestone` (la API expondría `/stages/` sobre un modelo llamado `Milestone`); renombrar solo la superficie pública (deja una capa de traducción permanente entre DB y API, que es lo que más confunde a quien lee el código por primera vez).

## D-024 — Sistema de diseño: Tailwind v4 + shadcn/ui con los tokens de M2-D3

**Contexto.** M2-D3 especifica un sistema de diseño completo y **normativo**: valores hex por rol semántico, escala tipográfica en px, iconografía Lucide con pares icono-significado reservados, escala de espaciado de 4px, radios, elevación, y 36 componentes con anatomía, estados y reglas de uso. `apps/web` hoy tiene ~1000 líneas de CSS portadas de la maqueta PropTrust anterior, que no deriva de este sistema. Tailwind v4 y `lucide-react` ya están instalados (los trajo el scaffold de TanStack Start); shadcn/ui no.
**Decisión.** Se activa la nota que D-002 dejaba pendiente. El sistema de diseño se implementa como: tokens de M2-D3 declarados como CSS custom properties + tema de Tailwind v4; shadcn/ui como base de los primitivos accesibles (Dialog, Select, Switch, Popover — que resuelven gratis el focus trap, `role="dialog"` y `aria-labelledby` que M2-D3 §Accessibility exige); los 36 componentes de M2-D3 construidos encima, en `apps/web/src/components/`.
**El CSS de la maqueta se elimina**, no se migra: el diseño vigente no deriva de él.
**Regla dura que se mantiene.** Los componentes de dominio (HashChip, StatusPill, VerificationBadge, …) viven en un único lugar y no se crean variantes ad-hoc. M2-D3 y M2-D4 son normativos: *"never invent new statuses"*, *"new patterns should be added to this document before being used"* — y como el documento es inmutable (D-022), en la práctica significa que un patrón nuevo requiere una decisión acá.
**Reversión.** Media. Los tokens son datos; los componentes son reescribibles. Lo caro sería volver a CSS a mano.

## D-025 — i18n es-AR / en-US con diccionarios propios

**Contexto.** M2-D3 §Principio 6 y §Localization lo fijan como requisito, no como preferencia: es-AR (registro voseo) por default, en-US secundario, **cero strings hardcodeados** en componentes, formateo con `Intl.*` para moneda/fechas/relativos/decimales, y toggle alcanzable desde el login y desde cada pantalla de perfil. M2-D4 §8.2 agrega la restricción del lado servidor: *"the server returns keys; the client renders"*.
**Decisión.** (a) Diccionarios propios en `apps/web/src/i18n/` — no se agrega una librería de i18n hasta tener evidencia de que hace falta (pluralización compleja, carga diferida por ruta): el `Intl` del runtime cubre formateo y el diccionario es un objeto tipado, lo que además da autocompletado y falla en typecheck si falta una clave. (b) **El backend devuelve claves de traducción, nunca copy** — para acciones de audit log, categorías, etiquetas de rol y nombres de stage. (c) Persistencia en `localStorage` bajo `propnexus.lang`, default `es-AR`.
**Consecuencia de diseño.** Los strings en español son 20–30% más largos que en inglés (M2-D3 §Text growth): los componentes se dimensionan al contenido; nada de anchos fijos salvo FAB e íconos.
**Alternativas descartadas.** `react-i18next` (peso y ceremonia para dos locales y un diccionario estático); copy hardcodeado con traducción posterior (contradice el requisito y garantiza reescritura).
**Reversión.** Barata mientras el acceso al diccionario esté detrás de un único hook.

---

> D-026 a D-028 se registran el **2026-07-29** tras el repaso completo de D-001..D-025 con la
> documentación oficial delante (ver §Repaso al final). D-026 es la de mayor alcance de todo el
> registro: gobierna copy, modelo de datos, validadores y postura legal.

## D-026 — La plataforma no certifica, no valida y no decide

**Contexto.** El vocabulario heredado —"certifier", "certificate", "Certified"— sugiere que la plataforma emite certificaciones. No lo hace, y creerlo lleva a diseñar mal: a poner reglas de negocio on-chain, a redactar copy que afirma validez legal, y a asumir una responsabilidad que el proyecto explícitamente rechaza en M1-D1 §Non-Substitution Statement.
**Decisión.** La plataforma **acompaña procesos que ya existen fuera de ella y los refleja**. No es autoridad de nada. Solo puede sostener cuatro afirmaciones:

1. este archivo tiene este hash;
2. se registró en este momento;
3. declara provenir de esta autoridad externa, con esta referencia;
4. esta persona, con este rol, atestiguó haberlo revisado en este momento.

Todo lo demás —que el permiso sea válido, que la obra esté bien ejecutada, que el profesional esté habilitado— ocurre y se determina afuera.

**El rol "certifier" verifica integridad y completitud**, no validez legal: contrasta lo presentado contra los hashes anclados y confirma que no cambió y que no falta nada. Su artefacto es una **atestación técnica**, y el modelo de datos usa *attestation*, no *certification*.

**Por qué existe la máquina de estados.** Porque el mundo real se retracta: documentación que parecía aprobada resulta observada, o aparece un error a subsanar. `Observed ⇄ InProgress` (D-020) no modela una decisión de la plataforma — modela una reversión que ya ocurre afuera y que hoy no queda registrada en ningún lado.

**El problema que resuelve.** Hoy es imposible verificar el estado real de esos procesos: la evidencia está dispersa en canales informales y nada garantiza que lo que se muestra hoy sea lo que existía ayer. Esa opacidad ya causó daño económico real a compradores. La plataforma no agrega una autoridad nueva; hace verificable el rastro de las que ya existen.

**Consecuencias operativas.** (a) Ninguna superficie afirma validez legal. (b) El aviso de no sustitución de M1-D1 se muestra donde aparecen atestaciones y dossiers. (c) Valida retroactivamente D-020: `Completed` y no `Certified` como nombre del estado, porque `Certified` habría implicado que certificamos.
**Vocabulario de la UI (cerrado 2026-07-29).** M2-D1, M2-D2 y M2-D5 usan "Issued certificates" y el pill "Certified". Como aparecen en entregables aprobados, **el copy queda literal** — calificarlo sería un desvío por conveniencia, que la regla de D-022 prohíbe. La precisión va a tres lugares que no tocan el entregable: el modelo de datos usa `attestation`, el aviso de no sustitución de M1-D1 se muestra donde aparecen atestaciones y dossiers, y el subtítulo "Technical history" que la propia maqueta ya trae en la pantalla 58 hace el trabajo de calificar.
**Reversión.** N/A — describe lo que el proyecto es. Cambiarlo sería otro producto con otro perfil regulatorio.

## D-027 — Taxonomía de archivos: el hash es el ticket de entrada a la cadena de prueba

**Contexto.** La regla 3 original de CLAUDE.md decía "todo archivo subido recibe hash SHA-256". Se escribió sin M2 delante y confunde dos cosas: hashear (milisegundos, sin efecto externo) y anclar (cuesta plata, ocupa cadena, crea una afirmación pública). Además, el flujo real tiene dos poblaciones muy distintas: documentación relevante que llega esporádica y temprano, y material informativo que llega en volumen y tarde.
**Decisión.** Dos categorías, sin estado intermedio:

| | **Anclable** (Evidence · Document) | **Asset** |
|---|---|---|
| Qué es | Permisos, planos aprobados, actas, informes, fotos de obra que sostienen el avance de una etapa | Renders, folletos, galería del proyecto, fotos de unidad de muestra |
| Se hashea | **Sí** | **No** |
| Se ancla | **Sí** (individual o por bundle) | No |
| Señales de prueba en UI | Sí | **Ninguna** — ni `HashChip` ni `VerificationBadge` |
| Mutabilidad | Inmutable desde su creación | Editable y borrable |

**Solo se hashea lo que se va a anclar.** Un hash guardado es una promesa implícita: si existe en la base, alguien lo va a mostrar o un revisor va a preguntar por qué no está en la cadena. Eso crearía un tercer estado ambiguo —hasheado-pero-no-anclado— que es exactamente lo que M2-D4 §6.2 prohíbe. El único estado transitorio legítimo es "Pendiente" mientras la tx confirma; nunca "Verificado".
**Criterio de corte.** Se ancla lo que alguien podría necesitar verificar en una disputa. Un permiso municipal sí; un render de marketing no.
**Consecuencia sobre el modelo.** El Prisma actual tiene una sola tabla `Evidence` para todo. M2-D1 y M2-D5 ya tratan `Evidence bundle`, `Document` y las galerías como entidades distintas con endpoints distintos; el modelo no lo reflejaba porque se escribió sin M2 a la vista.
**Alternativas descartadas.** Hashear todo "por si acaso" (crea el estado ambiguo y gasta la señal de prueba); anclar todo (costo y ruido sin retorno).

## D-028 — Qué significa "evidencia sin firmar" (criterio 7 del SOM)

**Contexto.** El SOM exige que la API *"rechace evidencia sin firmar"*, pero ningún documento define qué constituye una firma sobre una evidencia. M1-D1 §Identity & Signatures establece el flujo de "autoridad primero" (los documentos que requieren validación oficial deben estar certificados por la autoridad competente **antes** de subirse) y prohíbe marcar como certificado un hito crítico si faltan firmas — distinguiendo explícitamente entre firmas **nativas** y **de profesionales off-chain**. M1-D2b ya modela `EvidenceItem.authoritative: boolean`, campo que existe en el Prisma actual y está sin usar.
**Decisión.** Deriva de D-026: la plataforma no valida la firma, **registra de forma inmutable la declaración de origen y la atestación de revisión**. Evidencia sin firmar es:

- **(a)** la que se declara `authoritative` pero no trae atribución de autoridad externa — `issuingAuthority` y `authorityReference` (expediente, matrícula) pasan a ser obligatorios cuando `authoritative = true`; o
- **(b)** un bundle que ningún revisor atestiguó.

**El rechazo ocurre en la transición, no en el upload.** Un stage `validation_critical` no puede avanzar si le falta cualquiera de las dos. Subir es siempre posible; avanzar no.
**Sobre la firma criptográfica.** Se aplica sobre la **atestación del revisor** (CIP-30, D-009), no sobre cada archivo. Si el spike de D-009 sale mal, degrada a atestación custodial **sin rehacer el modelo de datos** — que es la razón principal para separar (a) de (b) en vez de depender de una sola.
**Que la autoridad sea "declarada" y no verificable por máquina no es una debilidad: es el alcance correcto** (D-026). Lo que la plataforma garantiza no es que el permiso sea válido, sino que ese archivo, con esa declaración de origen, existía en ese momento y no cambió desde entonces.
**Alternativa descartada.** Exigir firma criptográfica archivo por archivo: ningún documento lo pide, rompería al developer subiendo fotos de obra desde el teléfono, y confunde **integridad** —ya resuelta con SHA-256— con **autoría**, que es lo que el criterio busca.

## D-029 — Alcance del dominio: los stages son del proyecto; la unidad es lo comercial

**Contexto.** Hubo confusión sobre si las etapas de obra cuelgan del proyecto o de la unidad, y llegué a registrar un desvío inexistente entre M1-D2b y M2-D1. La evidencia parecía dividida: el panel del certifier (captura 55) muestra tres unidades del mismo proyecto en tres etapas distintas (7B→5, 5A→6, 9C→3), mientras que el progreso del developer (captura 45) muestra **una sola** progresión de diez con etapas como "Land acquisition" y "Earthworks and excavation".

**Lo que resolvió la ambigüedad** fue el dominio, no el documento: un desarrollo inmobiliario tiene **un solo trámite**. La subdivisión en unidades ocurre en un paso tardío del proyecto, y recién después se venden. No se hace movimiento de suelos por departamento.

**Y la captura 55 no era evidencia:** M2-D1 §Primary platform characteristics dice explícitamente que *"the maquette uses mock blockchain interactions"*. Los números por unidad son datos de relleno, no una afirmación de diseño. Le había dado peso de entregable a un dato de ejemplo.

**Decisión.**

```
Project ──1:N── ConstructionStage        ← el trámite: una sola progresión, compartida
                      └──1:N── EvidenceBundle / Document → anclajes
Project ──1:N── Unit                     ← nace en la subdivisión, paso tardío
                      ├── Contract, PaymentRelease, Invitation
                      └── Dossier = pruebas de los stages del proyecto
                                  + documentos propios de la unidad
```

**Dos familias de anclaje**, tres y tres:

| Ancla | Alcance | Op |
|---|---|---|
| Bundle de evidencia (Merkle root) | **Proyecto** → stage | `M3-SC-02` |
| Certificación de stage | **Proyecto** → stage | `M3-SC-05` |
| Documento suelto | **Proyecto** | `M3-SC-06` |
| Aceptación de invitación | **Unidad** | `M3-SC-01` |
| Release de pago por stage | **Unidad** → contrato | `M3-SC-03` |
| Firma del notario sobre dossier | **Unidad** → dossier | `M3-SC-04` |

**Consecuencias.**
- **El certifier certifica un stage una sola vez**, a nivel proyecto. No una vez por unidad — con 400 unidades sería absurdo.
- **El dossier sigue siendo por unidad** (lo manda M2), pero compone pruebas del proyecto —idénticas entre unidades hermanas— más lo propio de esa unidad. Es exactamente el *"mismo respaldo para unidades de un mismo proyecto"* que pide el negocio.
- **`Unit` puede no existir al principio.** Un proyecto pasa un tiempo acumulando stages y evidencia con **cero unidades**. El modelo debe soportarlo y el flujo de invitación solo se habilita después de la subdivisión.
- **`Milestone.scopeType` y `scopeUnitCount` se eliminan** del schema: nada en la cadena de prueba tiene alcance de unidad, así que el campo no distingue nada.

**M1-D2b no se contradice con esto.** `UnitForSale "1" -- "1..*" Milestone` se lee como **asociación** —la trazabilidad de una unidad comprende N stages— no como pertenencia. No hay desvío que registrar.
**Reversión.** Cara: toca el modelo entero. Requiere decisión nueva con evidencia del negocio.

## D-030 — Trunk-based: una sola rama `main`, sin PRs

**Contexto.** `CLAUDE.md` traía el flujo estándar: una rama por tarea, `main` protegida, merge solo por PR con squash, y un checklist en la descripción del PR. Eso viene del playbook y es correcto **para un equipo**. Hoy el equipo es una persona más agentes: no hay a quién revisarle, y el PR no agrega información — la agrega el mensaje de commit, que igual hay que escribir. Además el repo vivió sin remoto hasta el 2026-07-29, así que la ceremonia era puramente nominal.
**Decisión.** Una sola rama, `main`. Sin ramas de feature, sin PRs, sin protección de rama. El ciclo es **planificar → implementar → testear → commitear → pushear**, y pushear es parte del ciclo: un commit sin pushear no pasó por CI ni existe para nadie más.
**Lo que se conserva.** El checklist del PR no se tira, cambia de lugar: pasa a ser **puerta antes de pushear** (typecheck, tests, schema Zod, `AuditLog`, `aiken check`, cero datos sensibles). Y la regla de un cambio lógico por commit se vuelve **más** importante, no menos: el mensaje de commit es ahora la única revisión que va a existir.
**Lo que se pierde, dicho explícito.** (a) El CI ya no corre *antes* de que el código toque `main`, sino después — el workflow dispara con `push` a `main`. (b) No hay diff revisable por un tercero antes del merge. (c) Un commit malo se arregla con otro commit adelante, no descartando una rama. Se aceptan los tres a cambio de velocidad, con el equipo del tamaño actual.
**Trigger de revisión (no opcional).** **Cuando se sume la segunda persona al repo**, esto vuelve a ramas + PR: ahí el PR sí transporta información que el commit no (la conversación de revisión). Registrar la reversión como decisión nueva, no editando esta.
**Reversión.** Trivial: reinstaurar la protección de rama en GitHub y volver a la convención `<tipo>/<REF-en-kebab>-<descripción>`, que queda documentada en el historial de `CLAUDE.md`.

## D-031 — Ramas cortas por track para árboles de trabajo paralelos

**Contexto (2026-08-20).** D-030 estableció trunk-based —una sola rama, sin PRs— con este
fundamento: el equipo es una persona, no hay a quién revisarle, y el PR no agrega información que
el mensaje de commit no dé. Su **trigger de reversión** era "cuando se sume la segunda persona".

Lo que llegó no fue una segunda persona: fueron **agentes trabajando en paralelo**, en `git
worktree` separados. Eso crea el mismo problema de concurrencia por un motivo distinto, y el
trigger de D-030 no lo cubría. Con tres árboles commiteando a `main` a la vez, la puerta corre
sobre un árbol que ya no es `main` en cuanto otro track pushea primero, y los conflictos aparecen
en el peor momento: al integrar.

**Decisión.** Cada árbol de trabajo usa una rama corta `track/<nombre>` (`track/web`, `track/api`,
`track/contracts`). Se integra a `main` con **`merge --ff-only`** y la rama se borra. Vive horas o
días, no semanas.

**Lo que NO cambia — esto no reinstala PRs.** No hay revisión, no hay protección de rama, no hay
ceremonia. La rama es un **mecanismo de aislamiento**, no un artefacto de proceso: existe para que
dos árboles no se pisen, no para que alguien revise. `main` sigue siendo la única rama de
integración y el ciclo sigue siendo planificar → implementar → testear → commitear → pushear.

**Consecuencias operativas.** Un `git worktree add` pelado no alcanza en este repo: `.env`,
`dev.db` y `node_modules` están gitignoreados y no viajan, y los puertos estaban fijos en tres
lugares (`vite dev --port 3000`, `PORT=8787`, `const PORT = 3000` en Playwright), así que dos
árboles corriendo la app se pisaban. Se resolvió con `scripts/worktree.sh` —que deja el árbol
usable: rama, deps, base sembrada y puertos propios— y parametrizando los puertos en
`apps/web/ports.ts`, leído por Vite y por Playwright. Sin `apps/web/.env` el comportamiento es
idéntico al de antes (3000/8787).

**Qué track puede correr en paralelo.** `contracts` **siempre**: está aislado del workspace pnpm
(D-001) y no comparte nada. `web` y `api` están acoplados por `packages/shared`, que tipa a los
dos: si la rebanada toca el contrato de datos, va en un solo árbol.

**Alternativas descartadas.** (a) Los tres árboles commiteando directo a `main` con rebase previo:
es D-030 literal, pero la puerta verificaría un estado que deja de ser cierto en cuanto otro
pushea. (b) Sesiones secuenciales sin worktrees: renuncia al paralelismo justo del track que hoy
no bloquea a nadie y está en 0 tests contra un criterio de ≥95%.

**Trigger de revisión.** Si aparece una segunda persona, gana el trigger de D-030 y esto pasa a
ramas + PR de verdad, con revisión. Si en cambio los árboles paralelos dejan de usarse, la
convención muere sola y `main` queda como única rama sin necesidad de decisión nueva.
**Reversión.** Trivial: borrar las ramas `track/*` y trabajar solo en el árbol principal.

## D-032 — El harness de agentes: la puerta es ejecutable y lo irreversible se bloquea por hook

**Contexto (2026-08-20).** `CLAUDE.md` traía una "puerta antes de pushear" de cinco ítems
(typecheck, tests, schema Zod, `AuditLog`, `aiken check`). Al medirla, **tres de los cinco eran
inverificables**: `pnpm test` corría 4 tests de un solo archivo, `packages/api` no tiene script
`test` y `pnpm -r` lo saltea **en silencio**, y los contratos no estaban en `pnpm test`. La puerta
existía como párrafo, no como verificación.

Y hay una asimetría que la práctica dejó clara: **una regla en un `.md` es advisory para el
modelo; un hook lo ejecuta el harness.** Las dos cosas parecen equivalentes leídas, y no lo son.

**Decisión.** Tres capas, con criterio explícito de qué va en cada una:

| Capa | Qué contiene | Por qué ahí |
|---|---|---|
| **Ejecutable** — `scripts/gate.sh` | typecheck, tests del frente tocado, prohibiciones absolutas, blueprint al día | Un comando que **falla**. El CI corre **el mismo script**: si se separan, divergen |
| **Bloqueante** — hooks en `.claude/settings.json` | editar `docs/`, editar una migración aplicada o un archivo generado, escribir una clave privada, pushear con la puerta cerrada, pushear forzado | Es lo irreversible o lo que rompe un compromiso externo. No puede depender de que el modelo se acuerde |
| **Advisory** — `CLAUDE.md`, specs, skills | criterio, contexto, procedimiento, todo lo que requiere juicio | Bloquear el juicio produce fricción sin seguridad |

**El criterio de la puerta: la suite que existe se corre siempre; la suite que falta bloquea solo a
quien toca ese frente.** Así la deuda frena a quien la usa, no a quien la hereda: hoy tocar
`packages/api` cierra la puerta hasta que exista su script `test`, pero no frena a nadie más.

**Calibración registrada (2026-08-20, mismo día).** La primera versión verificaba **todo** en CI,
lo que sonaba más estricto y en la práctica dejaba el CI **rojo de forma permanente** por deuda
preexistente. Un CI rojo permanente es peor que no tener CI, porque se deja de mirar. En CI el
alcance pasó a ser el mismo concepto que en local —lo que este cambio tocó—, que además es lo que
mantiene honesta la promesa de "el mismo script en los dos lados". Segunda calibración: un `.md`
dentro de un subárbol no cuenta como tocar ese frente.

**Contexto por subárbol.** `CLAUDE.md` en la raíz queda con lo transversal; cada frente
(`apps/web/`, `packages/api/`, `contracts/`) tiene el suyo, que se carga solo cuando el agente
toca ese subárbol. Las trampas específicas de un frente estaban duplicadas entre el `CLAUDE.md`
raíz y el skill `run-app`, y la jerarquía de precedencia llegó a estar escrita **cuatro veces** —
exactamente lo que el principio 1 prohíbe. Los READMEs de scaffold de `apps/web` y `contracts`
(267 líneas de documentación genérica de TanStack y Aiken, cero información del proyecto) se
eliminaron: eran ruido en el lugar donde un agente busca contexto del frente.

**Subagentes divididos por el contexto que necesitan, no por rol nominal:** `spec` (leer los
entregables cuesta ~25k tokens que el implementador no necesita), `conformance` (**lector fresco**:
el agente que escribió el código es el peor juez de si cumple la spec) y `contracts` (Aiken/Plutus
es un universo disjunto del TypeScript).

**Alternativas descartadas.** (a) Correr la puerta en cada `git commit`: más estricto, pero cuesta
~40-90s por commit y empuja a commits grandes, que contradice la regla de un cambio lógico por
commit. El push es el momento correcto — es cuando el código empieza a existir para los demás, y
es literalmente lo que D-030 llamó "puerta antes de pushear". (b) Dejar todo como convención en
`CLAUDE.md`: es el estado que produjo una puerta inverificable durante meses.

**Trigger de revisión.** Si la puerta empieza a saltearse con los escapes (`GATE_ALLOW_DOCS`,
`GATE_SKIP_CONTRACTS`) de forma rutinaria, es señal de que un check está mal calibrado: se
corrige el check, no se relaja la puerta.
**Reversión.** Barata: los hooks se desactivan borrando `.claude/settings.json`; el script queda
igual de útil corrido a mano.

## D-033 — `docs/` contiene solo entregables; el índice se muda afuera

**Contexto (2026-08-20).** Al bloquear D-022 por hook apareció una fuga que la regla escrita no
distinguía: dentro de `docs/` convivían dos clases de archivo con naturaleza opuesta.

| Archivo | Qué es |
|---|---|
| `docs/README.md` | Índice **nuestro**. Nunca se entregó, nunca se hasheó. |
| `docs/milestone-1-fundamentos/M1-D2-Architecture-and-Data-Models/README.md` | Parte del paquete que `Instructions.txt` especifica y que **fue hasheado con SHA-256 en la Proof of Achievement de M1**. |

Dos consecuencias, las dos malas. **Primera:** `DECISIONS.md` —el documento de mayor precedencia—
decía en dos lugares que *"los desvíos vigentes están listados en `docs/README.md`"*, o sea que
delegaba información **mutable** (la tabla crece con cada desvío) en un área congelada. **Segunda:**
cualquier excepción por *nombre de archivo* ("los README son nuestros") habría dejado editable
justamente el que está comprometido criptográficamente.

**Decisión.** No se enmienda D-022: **`docs/` es inmutable, sin excepciones.** Lo que se corrige es
el contenido de la carpeta para que la regla sea verdadera sin excepciones — `docs/` pasa a
contener **únicamente entregables**:

- el índice bibliográfico se muda a **`specs/entregables.md`**, donde se puede mantener;
- la tabla de desvíos se muda a **`DECISIONS.md` §Desvíos vigentes**, junto a las decisiones que
  resume (principio 1: un resumen vive con lo resumido o diverge);
- lo que ya vivía en otro lado —jerarquía de precedencia, colisión de códigos `D1`/`D2a`, la
  lección de los artefactos derivados— no se copia: se linkea.

**Alternativa descartada: excepción por ruta exacta para `docs/README.md`.** Era más barata y
técnicamente segura (el hook matchea rutas, no nombres, así que el README hasheado seguía
protegido). Se descartó por elección del dueño: una regla absoluta con una excepción deja de ser
absoluta, y esta protege un compromiso externo —que el repo esté sincronizado con lo que el
revisor tiene—. Prefiere pagar el costo de que `docs/` no tenga mapa adentro.

**Consecuencia operativa.** La eliminación de `docs/README.md` es una escritura dentro de `docs/` y
exige el escape `GATE_ALLOW_DOCS=1`, ruidoso y visible en el commit. Eso destapó que **el escape
estaba documentado pero era inusable**: el hook corre en su propio proceso y no heredaba las
variables escritas en la línea de comando, así que `GATE_ALLOW_DOCS=1 git push` no tenía efecto.
Se corrigió reenviando explícitamente una lista **cerrada** de variables (`GATE_ALLOW_DOCS`,
`GATE_SKIP_CONTRACTS`) del comando a la puerta; cualquier otra se ignora, para que el mecanismo no
sea un canal de inyección de entorno. Y destapó un segundo problema, peor: con el escape activo, la
suite de guardias que la propia puerta ejecuta lo **heredaba** y pasaba sin verificar nada. Quedó
hermética (`unset` de los escapes al arrancar), porque un escape que apaga su propia verificación
es exactamente lo contrario de lo que un escape debe ser.

**Reversión.** Barata: `git mv` de vuelta y revertir los punteros. Nada de esto toca un entregable.

## D-034 — El inventario del stack vive en `specs/stack.md`

**Contexto (2026-08-20).** D-022 decidió que el stack vigente —que es nuestro y es cambiable— se
documenta **fuera de `docs/`**, y lo ubicó en `CLAUDE.md` §Stack. Esa ubicación funcionaba mientras
el stack fuera una tabla de doce filas. Al inventariarlo completo —front, back, contratos, datos,
blockchain, **infraestructura** y verificación, con versiones reales y estado de cada pieza— son
~170 líneas, y `CLAUDE.md` se carga entero en **cada** sesión.

**Decisión.** El inventario completo va a `specs/stack.md`. `CLAUDE.md` §Stack conserva solo lo que
hace falta al escribir código: qué framework se usa en cada frente y qué decisión lo respalda.
Versiones, estado, infraestructura, deuda y decisiones abiertas viven en un solo lugar y no se
repiten.

**Esto no contradice D-022, la honra.** Lo que D-022 decidió es que el stack **no vive en `docs/`**
porque no es un entregable: es nuestro y cambia. `CLAUDE.md` era el lugar disponible en ese
momento, no una propiedad de la decisión. Lo que sí se mantiene intacto: **cambiar el stack
requiere una decisión acá, no una edición de esas tablas.**

**Lo que el inventario destapó, y es la razón de fondo para haberlo escrito.** La capa de
infraestructura está en **0%** —ningún `Dockerfile`, ningún compose, ninguna cuenta de deploy— y
**tres documentos la describían como existente** (`README.md` con un `docker compose` que no
corre, y D-010 en dos lugares). Un inventario que mezcla lo que corre con lo que está decidido
produce exactamente eso. Por eso `specs/stack.md` marca el estado pieza por pieza: ● corre ·
◐ parcial · ○ decidido sin ejecutar · ? abierto.

**Reversión.** Trivial: el archivo vuelve a `CLAUDE.md` §Stack.

## D-035 — Zod 4 en el contrato compartido

**Contexto (2026-08-20).** La revisión de stack agarró `packages/shared` con **un solo archivo de
schemas**, recién creado en SPEC-008. Cada rebanada de acá en adelante agrega schemas hasta cubrir
los ~80 endpoints de M2-D5. Zod 4 estaba publicado (`4.4.3`) y —dato que decidió el timing— el zod
3 que ya teníamos instalado (`3.25.76`) **ya expone la API v4** bajo el subpath `zod/v4`: no era un
salto entre líneas incompatibles, era adelantar algo que la propia 3.x estaba transicionando.

**Decisión.** `zod@^4` en `packages/shared` y `packages/api`. Los schemas compartidos se escriben en
el idioma v4: `z.email()` y `z.iso.datetime()` en vez de encadenar sobre `z.string()`, y
`z.strictObject` en vez de `.strict()`.

**Evidencia de que el costo era mínimo.** Subir la dependencia no rompió **nada**: typecheck verde
en los tres packages y 21 tests en verde sin tocar una línea. Zod 4 mantiene funcionando las formas
de la 3.

**Por qué modernizar el idioma igual, si lo viejo funciona.** Porque `auth.ts` es el archivo que
toda spec futura va a copiar. Si ahí queda el idioma deprecado, se replica ochenta veces y la
migración real se paga entera más adelante — que era exactamente lo que esta decisión evitaba.

**Alcance de lo que NO se tocó.** Las cuatro rutas heredadas (`users`, `projects`, `milestones`,
`evidence`) siguen con las formas de la 3, que Zod 4 acepta. No se migran porque M2-D5 las reescribe
igual: sus paths no están scopeados por rol y de los ~80 endpoints del backlog conforman 2.
Migrarlas ahora sería trabajo sobre código con fecha de vencimiento.

**Consecuencia sobre la regla 4.** `z.strictObject` no es cosmética: con un objeto normal Zod
**descarta las claves desconocidas en silencio**, así que un `passwordHash` filtrado pasaría el
schema. Hay dos tests que lo fijan, uno por `loginResponse` y otro por `meResponse` — el segundo
existe porque `.extend()` podría haber perdido la estrictez, y eso no se asume: se verifica.

**Reversión.** Barata mientras `shared` tenga pocos schemas; cara después. Por eso se hizo ahora.

## D-036 — Multer 2.x

**Contexto (2026-08-20).** La revisión de stack encontró `multer@1.4.5-lts.2` contra `2.2.0`
publicado. La línea 1.x está en mantenimiento mínimo y Multer está sobre el camino de subida de
evidencia, que es el núcleo del producto.

**Decisión.** `multer@^2` y `@types/multer@^2`. **Cero cambios de código**: `diskStorage`,
`limits`, `fileFilter` y `.single()` funcionan igual.

**Cómo se verificó.** Se escribieron **primero** 7 tests del camino de subida —que no existía
ninguno— y pasaron contra Multer 1.x. Recién después se migró, y los mismos 7 volvieron a pasar.
Cubren lo que una migración de esta capa puede romper sin avisar: tipo de archivo rechazado,
límite de tamaño, body inválido, ausencia de archivo, autorización por membresía, y —el que más
importa— que **ningún rechazo deje el archivo huérfano en disco** (regla 10). Un directorio de
uploads que crece con basura rechazada es una fuga silenciosa.

**Corrección de un hecho que el repo daba por cierto.** Esta migración se justificaba en parte
porque "el warning de `url.parse()` deprecado viene de Multer 1.x". **Es falso.** El warning
sobrevivió a la migración; trazado con `tsx --trace-deprecation`, sale de **`bcrypt` vía
`@mapbox/node-pre-gyp`**. La afirmación estaba escrita como hecho en dos archivos. La decisión se
sostiene igual por sus propios méritos —línea mantenida, cero costo, tests nuevos— pero el motivo
era otro. **Antes de atribuir un warning, trazalo.**

**Lo que destapó.** `bcrypt` es un módulo **nativo**: la imagen Docker va a necesitar toolchain de
compilación. La alternativa `bcryptjs` es JS puro, compatible en formato de hash y ~30% más lenta.
No se decide acá: tocar el hashing de contraseñas es código 🔴 y lo lidera el humano.

**Reversión.** Trivial mientras la superficie sea `lib/upload.ts`: volver a `^1.4.5-lts.2`.

## D-037 — Nitro: versión publicada en vez de nightly

**Contexto (2026-08-20).** `apps/web` traía del scaffold `nitro` como alias de
`nitro-nightly@3.0.1-20260714-164552-c6e6168b`. Un nightly **no garantiza reproducibilidad**: si
se despublica o se recolecta, `pnpm install --frozen-lockfile` falla y el CI muere sin que nadie
haya tocado el código.

**Decisión.** `nitro@3.0.260610-beta`, la versión publicada más nueva. **Sigue siendo beta** —no
existe Nitro 3 estable— pero es una versión fija y publicada, que es lo que la reproducibilidad
exige.

**Verificación del spike.** typecheck verde en los tres packages · `pnpm build` de web OK ·
`pnpm dev` arriba · los cuatro códigos del proxy correctos salvo el conocido · **walkthrough E2E
completo: 16/16**. Se acepta ir un mes para atrás (la beta es del 10-jun, el nightly del 14-jul) a
cambio de builds reproducibles.

**Lo que el spike refutó, y es el hallazgo que más vale.** La hipótesis era que el `502` en
`POST`+`401` era una regresión de `h3@2.0.1-rc.25`, que es lo que este repo afirmaba como hecho.
La beta trae `h3@2.0.1-rc.22` y **el 502 sobrevivió idéntico**. El bug abarca al menos dos
versiones de h3, así que **no se resuelve eligiendo versión**: queda como deuda con su
atribución corregida.

Es la segunda atribución falsa que cae en la misma revisión —la otra fue el warning de
`url.parse()` achacado a Multer (D-036)— y las dos estaban escritas en el repo como hechos
verificados. La lección se repite: **una causa plausible anotada sin comprobar es una causa
inventada**, y sobrevive en la documentación hasta que alguien la testea.

**Trigger de revisión.** Cuando salga Nitro 3 estable, pasar a él.
**Reversión.** Trivial: volver al alias `npm:nitro-nightly@…` en `apps/web/package.json`.

> **Enmienda (2026-08-23) — la atribución de arriba también era falsa.** El `502` no era de h3 en
> ninguna versión: era `undici` cumpliendo el spec de WHATWG fetch al recibir un `401` con un body
> no reproducible. Se cierra con `fetchOptions: { credentials: "omit" }` en las route rules.
> El detalle medido, y por qué "probé dos versiones de h3 y el bug sobrevivió" llevaba a la
> conclusión equivocada, están en **D-050**. La mitad de esta entrada que sí se sostuvo es
> *"no se resuelve eligiendo versión"* — por el motivo opuesto al que se creía.

## D-038 — Datos: Drizzle diferido, SQLite como default, Turso como destino de hosting

**Contexto (2026-08-20).** Revisión de stack a pedido del dueño del producto, antes de liberar
agentes a trabajar en paralelo. Dos preguntas quedaban abiertas desde D-016: si el ORM sigue siendo
Prisma para siempre, y si el destino de base de datos al desplegar es PostgreSQL (lo que D-016
daba por sentado). El dueño zanjó las dos con una postura explícita, no una preferencia técnica del
LLM — es exactamente el tipo de evidencia que el principio 3 pide para reabrir una decisión Aceptada.

**Decisión — ORM.** Drizzle **sigue siendo el destino**, tal como decía D-004 originalmente. No se
reabre "¿Drizzle o Prisma?": se ratifica Drizzle, con la migración **diferida** a cuando haga falta,
no ahora. Prisma sigue siendo lo que corre hoy (D-016, intacta). No hay trigger de fecha; el trigger
es el mismo principio 3: evidencia concreta (un límite real de Prisma, o el momento en que el costo
de mantener dos ORMs mentales supere el de migrar), no conveniencia. Cuando llegue, es un spike
acotado (≤2-3 días) que compara el costo real de migrar `schema.prisma` + los queries de
`packages/api` contra Drizzle, no una reescritura a ciegas.

**Decisión — datastore.** El destino **deja de ser PostgreSQL**. Default: **mantener SQLite** todo
lo posible, en dev y en producción, salvo que aparezca una limitación real y medida para este
proyecto — no hipotética. Esto **enmienda el trigger de D-016** ("antes del primer deploy real:
migrar a PostgreSQL"), que quedaba desactualizado.

**Decisión — hosting en producción.** El deploy probable es **Render**. Ahí, el candidato es
**Turso** (libSQL gestionado) por encima de un disco persistente de Render + Litestream, por una
razón técnica concreta y no por costo (a la escala de este proyecto los dos son casi gratis: disco
de Render es ~$0.25/GB/mes, el free tier de Turso da 5GB / 500M lecturas / 10M escrituras por mes).
La razón es que **D-003 ya anticipa un worker de confirmaciones separado** del proceso web para el
pipeline de anclaje. Un disco persistente de Render solo se monta en una instancia; si el worker
termina siendo un segundo servicio, no puede compartir el archivo SQLite. Turso es una base
accesible por red — cualquier proceso se conecta igual que a un Postgres — y de paso resuelve backup
y point-in-time recovery sin tener que operar Litestream a mano. Se integra detrás de la misma
lógica de "dependencia externa detrás de interfaz propia" que ya rige Cardano (D-014, principio 7):
Turso no es una particularidad de Prisma ni de Drizzle, así que no ata la migración de ORM.

**Alternativas descartadas.** PostgreSQL gestionado (Neon/Supabase/Render Postgres): descartado no
por costo sino porque no hay evidencia de una limitación de SQLite que lo justifique — se reabre si
aparece. Disco persistente de Render + Litestream: descartado por el problema del worker
multi-proceso, no por precio; queda como alternativa barata si Turso resultara inviable por algún
motivo no previsto hoy.

**Lo que NO se hace ahora.** Esta decisión es de **dirección**, no de implementación: no se toca
`schema.prisma`, no se instala Drizzle, no se crea cuenta de Turso. `specs/stack.md` §10 pasa a
listar el trigger de cada spike.

**Consecuencia documental.** Corrige `specs/stack.md` fila "Base de datos" (destino: Turso, no
PostgreSQL) y la fila "Prisma" (nota: destino Drizzle). Corrige `CLAUDE.md` raíz §Stack, fila
**db**, que decía "PostgreSQL al desplegar".

**Trigger de revisión.** Migración de ORM: spike cuando aparezca evidencia (ver arriba). Turso:
se activa en el primer intento real de deploy a Render — ahí se crea la cuenta y se prueba contra
el worker de confirmaciones si ya existe, o contra el caso hipotético si todavía no.
**Reversión.** Todas las piezas están donde D-014/D-016 ya las aislaba: Prisma detrás de
`prisma/schema.prisma` + los repositorios de `packages/api`, y el datastore detrás de la variable de
conexión. Cambiar cualquiera de las tres no requiere tocar lógica de negocio.

**Actualización (2026-08-21, D-048).** La migración deja de estar diferida: arranca ya, antes de
las rebanadas de M3. Ver D-048 — el trigger de "evidencia, no preferencia" de este párrafo se da
por satisfecho ahí, no se ignora.


## D-039 — Plataforma de deploy: Render. Railway queda descartado

**Contexto (2026-08-20).** D-010 eligió Railway como **Default** con reversión barata, antes de que
existiera ningún deploy. Desde entonces D-038 razonó el hosting de datos entero sobre **Render**
(Turso vs. disco persistente + Litestream es un dilema *de Render*), y `CLAUDE.md` y `README.md`
quedaron diciendo Render mientras `specs/stack.md` §8 seguía diciendo Railway. El repo sostenía las
dos plataformas a la vez: contradicción detectada al auditar el stack.

**Decisión.** **Render.** Railway queda descartado explícitamente — no como default a refutar, sino
descartado. Es una postura del dueño del producto, que es exactamente la clase de evidencia que el
principio 3 admite para cerrar un **Default** (D-010 nunca fue Aceptada: los defaults existen para
ser reemplazados barato, y este se reemplaza sin spike porque no hay nada construido que migrar).

**Qué NO cambia.** El núcleo de D-010 sobrevive intacto porque nunca dependió del proveedor:
GitHub Actions es **barrera de calidad y no despliega** (la puerta sigue siendo el único juez),
rollout con healthcheck contra `GET /health` —que ya existe—, y build por servicio disparado por
push a `main`.

**Consecuencia — coherencia con D-038.** Esto deja de ser una contradicción y pasa a ser una sola
línea: Render como plataforma, **Turso** como base (D-038), y el motivo por el que Turso le gana al
disco persistente —que el disco de Render se monta en una sola instancia y no lo puede compartir el
worker de confirmaciones de D-003— ahora descansa sobre una plataforma decidida y no supuesta.

**Lo que NO se hace ahora.** Sigue sin existir un solo `Dockerfile`, ni cuenta de Render, ni deploy.
Esta decisión es de **dirección**: elimina una contradicción, no construye infraestructura.
`specs/stack.md` §8 sigue siendo el inventario honesto, y sigue en 0%.

**Alternativa preservada.** VPS + Coolify (self-hosted, más barato) sigue siendo la reversión barata
que D-010 ya documentaba: cambiar cuesta horas, no días, mientras el deploy siga siendo dos
contenedores sin estado y una base accesible por red. Railway no vuelve sin una decisión nueva.

**Trigger de revisión.** El primer deploy real. Si Render resulta inviable por algo no previsto
—límite de plan, healthcheck que no encaja, o el worker de confirmaciones que no entra en el
modelo de servicios— se reabre acá con esa evidencia concreta, no por preferencia.


## D-040 — El deploy de M3 corre en **free tier**: $0/mes, como restricción de diseño

**Contexto (2026-08-20).** Postura del dueño tras elegir Render (D-039): el deploy de M3 no debe
costar dinero. Se verificaron los límites vigentes de las tres piezas antes de aceptarlo, porque
"gratis" solo es una decisión si se sabe qué se rompe.

**Decisión.** M3 se despliega enteramente en planes gratuitos, y eso se trata como **restricción de
arquitectura**, no como una nota de presupuesto: hay cosas que dejan de ser posibles y quedan
prohibidas por esta entrada, no por olvido.

| Pieza | Plan | Límite que importa |
|---|---|---|
| `apps/web` (SSR) + `packages/api` | Render Free web service ×2 | **750 instance-hours/mes compartidas**; spin-down a los 15 min; ~1 min de arranque |
| Base | **Turso** free | 5 GB · 500M lecturas · 10M escrituras/mes · no vence |
| Evidencia | **Cloudflare R2** free | 10 GB · 1M ops A · 10M ops B · egress $0 · no vence |
| Worker de confirmaciones | **cron de GitHub Actions** | gratis en repo público |

**Consecuencia 1 — R2 antes del primer deploy.** El free tier no tiene disco persistente y borra el
filesystem en cada redeploy, restart y spin-down. Evidencia en disco local se pierde cada 15 minutos
de inactividad, y lo grave no es perder archivos: el hash sobrevive en la base y el archivo no, así
que la app mostraría prueba que no puede sustanciar (regla 17). **D-011 pasa de destino a
prerequisito.**

**Consecuencia 2 — Turso deja de ser preferencia y pasa a ser obligación.** D-038 eligió Turso por
el worker multi-proceso. En free el argumento es más fuerte y más simple: **SQLite en archivo es
imposible**, no inconveniente. De paso se esquiva una trampa — el Postgres free de Render **expira a
los 30 días**, o sea que habría muerto justo cuando los reviewers de Catalyst fueran a mirar.

**Consecuencia 3 — el worker de D-003 no puede ser un servicio.** Los background workers de Render
no tienen plan gratuito (desde $7/mes). El pipeline de confirmaciones se dispara desde un **cron de
GitHub Actions** contra un endpoint autenticado. Un `setInterval` dentro de la API **no sirve**:
cuando el servicio duerme, deja de contar.

**Consecuencia 4 — migraciones en el entrypoint, obligatorio.** Free no tiene shell ni one-off jobs.
Es lo que D-012 ya pedía; ahora no hay alternativa.

**Prohibido por esta decisión: keep-warm.** El truco de pinguear para evitar cold starts es
justamente lo que rompe el free — dos servicios despiertos 24/7 son ~1460 h contra 750, suspendidos
cerca del día 15. **Se puede tener "sin cold start" o "gratis", no las dos.** Con spin-down normal el
presupuesto sobra (~1500 visitas frías al mes), así que la mitigación aceptada es **calentar la URL
a mano justo antes de una demo, revisión o grabación**, y dejarla dormir el resto del tiempo.

**Lo que se acepta a cambio.** ~1 min de cold start en los criterios 12 (URL pública), 13 (video) y
8 (E2E en pre-prod). Es un costo de credibilidad ante reviewers, no un incumplimiento: la URL
responde.

**Alternativa evaluada y descartada.** Hacer `apps/web` un **static site** (no consume horas, no
duerme) dejaría a la API sola en 730 h contra 750 y podría correr caliente 24/7. Se descarta: cuesta
el SSR de D-002, elegido para el browse público y el dossier compartido, y el colchón sería de 20 h
—un redeploy o un tercer servicio lo rompen—. No se cambia arquitectura por 20 horas de margen.

**Trigger de revisión.** Se paga algo el día que (a) los cold starts hagan fracasar una demo con
pilotos o reviewers, (b) 750 h dejen de alcanzar por tráfico real, o (c) el worker necesite correr
más seguido de lo que un cron de GHA permite. El primer plan pago relevante es un web service
Starter (~$7/mes); no se contrata por comodidad, se contrata contra uno de esos tres hechos.


## D-041 — Deploy con **runtime nativo de Node** y `render.yaml`. Docker sale del plan

**Contexto (2026-08-20).** Pregunta del dueño: *¿por qué Docker? ¿Render free acepta contenedores?*
Las dos mitades tienen respuesta y la segunda no es la importante. **Sí**, Render acepta
`runtime: docker` y funciona con `plan: free`. Pero al rastrear de dónde salía la exigencia, las
tres filas de `specs/stack.md` §8 que pedían Dockerfiles estaban atribuidas a **D-010**, que decía
literalmente *"Railway buildea ambos Dockerfiles"*. **Docker era un requisito de Railway.** D-039
reemplazó la plataforma y preservó el núcleo de D-010, pero el supuesto de Docker viajó adentro de
ese núcleo sin que nadie lo examinara. Es el modo de falla del principio 1 en su versión sutil: no
una copia que diverge, sino un supuesto que sobrevive a la decisión que lo justificaba.

**Decisión.** `apps/web` y `packages/api` se despliegan con el **runtime nativo de Node** de Render.
El artefacto de infraestructura que se commitea es **`render.yaml`** (Blueprint: admite `plan: free`,
`rootDir` y `buildFilter` para monorepo), **no dos Dockerfiles**. La documentación de Render es
explícita al respecto: el runtime nativo es el camino corto salvo que ya uses Docker, necesites un
lenguaje no soportado o paquetes de SO propios. Nada de eso aplica — esto es Node 20+ con pnpm
workspaces.

**Consecuencia — la deuda de `bcrypt` se desinfla a la mitad.** `specs/stack.md` §11 justificaba su
costo con *"la imagen Docker necesita toolchain de compilación (node-pre-gyp)"*. Sin imagen propia,
ese costo lo absorbe el entorno de build de Render. La deuda **no desaparece** —sigue siendo un
módulo nativo, y sigue siendo código 🔴— pero su argumento más caro se cae.

**Hueco que encontró esta revisión.** `apps/web` no tenía script `start`. Se agrega
`node .output/server/index.mjs`, verificado contra un build real: levanta, respeta `PORT` y responde
200. Hacía falta con Docker o sin Docker; es exactamente la clase de cosa que se descubre a las 11
de la noche del primer deploy.

**Costo aceptado — la reversión a Coolify se encarece.** D-039 preservó "VPS + Coolify" como
reversión barata, y Coolify despliega contenedores. Sin Dockerfiles, esa salida deja de ser
inmediata. **Se acepta a conciencia:** escribir dos Dockerfiles hoy para preservar opcionalidad
sobre el fallback de una plataforma que todavía no usamos es trabajo especulativo (principio 5). Si
Render falla, dockerizar dos servicios Node sin estado es un día de trabajo, no una reescritura, y
el trigger de revisión de D-039 ya cubre ese caso.

**Lo que NO cambia.** Todo lo de D-040 sigue igual: free tier, 750 h, spin-down, Turso, R2, cron de
GHA, migraciones en el `buildCommand`/`startCommand` en vez de un entrypoint de imagen. Y sigue sin
existir el `render.yaml`: esta decisión define **qué** hay que escribir, no lo escribe.

**Trigger de revisión.** Se vuelve a Docker si (a) hace falta un paquete de SO que el runtime nativo
no trae, (b) el build nativo deja de ser reproducible de forma que moleste, o (c) se ejecuta la
reversión a Coolify.


## D-042 — En la superficie 🔴, el default inseguro no existe: se revienta

**Contexto (2026-08-20).** La auditoría de la superficie 🔴 (`packages/api/CLAUDE.md`) encontró dos
hallazgos con la **misma forma**, en los dos lugares donde más duele:

- `lib/jwt.ts` hacía `process.env.JWT_SECRET || "dev-secret"`. Sin la variable —o con
  `JWT_SECRET=""`, que es lo que trae `.env.example` y en JS es falsy— la API firmaba con un
  literal público. Cualquiera forja `{userId, role:"admin"}`: no es escalar privilegios, es saltear
  la autenticación entera. Era el **P1** que bloqueaba el primer deploy.
- `canAccessProject(userId, role, projectId, allowedMemberships?)` tenía el 4º parámetro opcional, y
  **omitirlo acepta cualquier membresía**. Quien quiso decir "solo developer" y se olvidó del
  argumento obtiene "cualquier miembro", en silencio.

Los dos son el mismo error de diseño: **el camino de menor esfuerzo era el inseguro**. No se
llegaba a ellos equivocándose, se llegaba a ellos por omisión.

**Decisión.** En el código 🔴 —claves, firmas, hashing, membresías— ningún valor ausente resuelve a
un default que funciona:

1. **Secreto ausente ⇒ el proceso no arranca.** Nada de fallback, ni siquiera "solo en desarrollo".
   La verificación corre al importar el módulo, no en la primera request. Aplica desde ya a
   `JWT_SECRET`, y por adelantado a `SERVICE_WALLET_SEED` y `BLOCKFROST_API_KEY` cuando existan
   (`packages/cardano` está vacío). Un valor presente pero **vacío o solo espacios** cuenta como
   ausente: es el caso real, no el hipotético.
2. **Parámetro de permiso ausente ⇒ error de compilación.** Un argumento que decide alcance no
   puede ser opcional: el default de un permiso es "ninguno", y "ninguno" no es un default útil, así
   que la única salida honesta es exigirlo.
3. **Ampliar un permiso ⇒ acto deliberado.** El conjunto de "a quién le alcanza con ser miembro"
   se escribe a mano y el tipo obliga a que esté completo. Nada que decida alcance se mantiene solo:
   un rol nuevo tiene que hacer fallar el build y esperar a que alguien diga qué puede ver.

**Por qué reventar y no advertir.** El free tier de Render no da shell (D-040): no hay forma de
entrar a ver qué variables quedaron cargadas. Un warning en un log que nadie mira es
indistinguible de no tener nada, y el modo degradado sería justamente el explotable. Un proceso que
no levanta se ve en el primer deploy; una API firmando con `dev-secret` se ve cuando alguien la usa.

**Alternativas descartadas.**

- *Fallback solo si `NODE_ENV !== "production"`.* Es el patrón habitual y es una trampa: `NODE_ENV`
  llega mal seteado más seguido que `JWT_SECRET`, y el modo inseguro pasa a depender de una segunda
  variable igual de olvidable. Se descarta por la misma razón que el original.
- *Generar un secreto aleatorio al arrancar si falta.* Arranca, pero invalida todas las sesiones en
  cada reinicio — y con el spin-down de free (D-040) eso es varias veces por día. Convierte un fallo
  de configuración en un bug intermitente de sesión, que es peor de diagnosticar.
- *Exigir además un largo mínimo.* Tiene sentido y no entra todavía: fijar un número es una política
  y hoy no hay dónde sostenerla. Queda para el security review del criterio 11.

**Consecuencias.**

- `pnpm dev` **falla** en un checkout sin `packages/api/.env`. Es a propósito y es el punto: antes
  "funcionaba" en modo inseguro. `README.md` §Arranque rápido ya manda copiar el `.env.example`, que
  ahora explica cómo generar el valor.
- El `render.yaml` que falta escribir (D-041, criterio 12) tiene que declarar `JWT_SECRET` con
  `generateValue: true`. Si se olvida, el servicio no levanta — que es exactamente el
  comportamiento buscado.
- **`ANY_MEMBERSHIP` no crece solo.** La primera versión lo derivaba con
  `Object.values(MembershipRole)`, que se mantenía sola y por eso mismo estaba mal: una membresía
  nueva quedaba leyendo todos los proyectos por herencia. No es hipotético — el dominio tiene cuatro
  roles (investor, developer, notary, certifier) y el enum tiene tres, con los nombres viejos, así
  que `notary` va a entrar. Ahora la lista es literal con `satisfies Record<MembershipRole, true>`:
  agregar el rol al schema sin decidir qué puede leer **no compila**. Verificado metiendo `notary`
  en el enum a propósito (TS1360).
- La suite ya cargaba `JWT_SECRET` en `vitest.config.mts`, así que no hubo que tocar el entorno de
  tests. Que no haga falta un escape para testear es la señal de que la regla está bien puesta.

**Trigger de revisión.** Si aparece un entorno donde reventar al arrancar sea inaceptable —un
health check que deba responder aunque falte configuración, por ejemplo— se reabre con ese caso
concreto delante, no antes.

**Reversión.** Es una línea por sitio. Lo que no se revierte es el test: `test/jwt.test.ts` fija que
el import falle sin la variable, así que reponer un fallback deja la puerta cerrada.


## D-043 — La regla de visibilidad de proyectos existe una sola vez: `projectScope`

**Contexto (2026-08-21).** Al cerrar el fail-open de `canAccessProject` (D-042) quedó a la vista que
"qué proyectos puede ver este usuario" estaba escrito en **tres** lugares:

1. `canAccessProject`, la función.
2. El bypass de `admin`, repetido en 5 call sites como `if (!allowed && req.user!.role !== "admin")`
   — redundante, porque la función ya devolvía `true` para admin, pero al leerlo parecía que la
   decisión vivía en la ruta.
3. `GET /projects`, que no la llamaba: traía todas las membresías del usuario y filtraba en JS.

Las tres daban el mismo resultado, y ninguna auditoría lo había marcado porque **el resultado era
correcto**. Pero coincidían por casualidad, solo una tenía tests, y es una regla de autorización:
cuando dos copias divergen, el síntoma no es un error, es que alguien ve de más.

Que la copia (3) tenía deriva propia se comprobó al unificar. Dos bugs que nadie miraba:

- El listado de un **no-admin** salía en orden de inserción de membresías; el de admin, por fecha.
- Un usuario con **dos membresías en el mismo proyecto** —el schema lo permite: `@@unique` es por
  `userId + projectId + membershipRole`— veía el proyecto **duplicado**.

**Decisión.** La regla se escribe una vez, como filtro de Prisma, y las dos preguntas la usan:

```ts
projectScope(role, userId, allowedMemberships): Prisma.ProjectWhereInput
```

`canAccessProject` la aplica a un id (`findFirst` con `id` + el scope) y `GET /projects` la aplica a
la colección. El bypass de `admin` —matriz de M2-D1 §4— vive adentro de `projectScope` y en ningún
otro lado; los 5 chequeos redundantes de las rutas se van.

**Consecuencia deliberada — `admin` sobre un proyecto inexistente ahora da `false`.** Antes el
bypass cortaba antes del query y devolvía `true` sin mirar si el proyecto existía. Ahora es un
filtro vacío sobre la misma consulta, así que "no existe" responde igual para todos: 403 para
cualquiera, en vez de 403 o 404 según quién pregunte. Es la misma postura que el login (no ser un
oráculo) y está fijada por test.

**Alternativas descartadas.**

- *Dejar el `if (role === "admin") return true` adentro de `canAccessProject`.* Preserva el
  comportamiento exacto y es el diff más chico, que en código 🔴 pesa. Se descarta porque deja el
  bypass en dos lugares dentro del mismo archivo: se gana poco y se pierde justamente lo que esta
  decisión viene a comprar.
- *Que `GET /projects` llame a `canAccessProject` por proyecto.* Una consulta por fila, y la
  pregunta de una colección no es la de un id.

**Lo que esta decisión NO resuelve.** `canAccessProject` sigue siendo una **función que hay que
acordarse de llamar**, no un middleware que no se pueda olvidar. Un endpoint nuevo que se la olvide
no tiene segunda capa y nada lo detecta. Está registrado como hallazgo 9 de `specs/README.md`
§Auditoría y como pregunta abierta de `specs/SPEC-010`, con dueño humano: es 🔴 y toca los 27 call
sites. Unificar la regla primero es lo que vuelve mecánico ese refactor.

**Trigger de revisión.** Si aparece una superficie donde la visibilidad no dependa solo de
membresía —un proyecto público, un dossier compartido sin cuenta (rebanada 8)— `projectScope` es el
lugar donde se agrega, no una condición nueva en una ruta.

**Reversión.** El filtro es una función pura de tres argumentos; volver atrás es reponer el query
viejo en la ruta. Lo que no se revierte son los tests del listado: fijan el scope, el orden y la
deduplicación, que antes no cubría nada.


## D-044 — La segunda capa de autorización la verifica la puerta; el middleware queda diferido

**Contexto (2026-08-21).** La auditoría 🔴 dejó un hallazgo que D-042 y D-043 no resuelven:
`canAccessProject` es una **función que hay que acordarse de llamar**, no un middleware que no se
pueda olvidar. `requireRole` está en la cadena o no está; la segunda capa devuelve un booleano que
alguien tiene que chequear. Un endpoint nuevo que se la olvide no tiene segunda capa y **nada lo
detecta**: ni el compilador, ni un test, ni la puerta.

La forma correcta es un `requireProjectAccess(...)` de Express que lea `req.params.projectId`. Pero
ese refactor toca los 27 call sites, es 🔴 —lo lidera el humano, línea por línea— y **no bloquea
nada hoy**: las 27 rutas están auditadas y sin agujeros, y el hallazgo no es un P1 (no hay
explotación posible, es riesgo estructural), así que no toca el criterio 11 ni ningún otro de los
16. Al mismo tiempo no se puede diferir para siempre: el backlog de M2-D5 son ~80 endpoints, y
retrofitear 80 cuesta el triple que 27.

**Decisión.** Separar el problema en sus dos mitades y resolver primero la barata:

| | Detector en la puerta | Middleware |
|---|---|---|
| Qué compra | que olvidarse sea **ruidoso** | que olvidarse sea **imposible** |
| Nivel | 🟡 — es verificación, no lógica de auth | 🔴 — lo lidera el humano |
| Costo | una sesión corta | 27 call sites revisados a mano |
| Caducidad | ninguna: sigue sirviendo con el middleware puesto | — |

`scripts/check-project-access.py` corre en la **sección 1 de la puerta**, junto a las prohibiciones
absolutas y no junto a la verificación por frente: es un invariante, no el test de un subárbol.
La regla es una línea — *una ruta con parámetro en el path, o que liste proyectos, necesita
`canAccessProject`/`projectScope` o ser admin-only*— y `requireRole("admin", "developer")` **no**
cuenta como admin-only, porque ahí el developer entra por rol y necesita la membresía igual.

**El detector no reemplaza al middleware.** "Imposible" es estrictamente mejor que "ruidoso", y esto
es análisis de texto sobre archivos de rutas: se lo puede engañar registrando rutas de una forma que
no matchee. Lo que compra es que el modo de falla realista —alguien escribe un endpoint más y se
olvida— deje de ser silencioso. El hallazgo sigue **abierto** (hallazgo 9 de `specs/README.md`).

**Alternativas descartadas.**

- *Hacer el middleware ahora.* Es lo correcto y es prematuro: gasta atención humana —el recurso más
  escaso del proyecto, con el criterio 4 dependiendo de recontactar pilotos— en algo que no bloquea
  ningún criterio, y lo hace sobre archivos que `SPEC-009` va a renombrar igual.
- *Anotarlo y seguir.* Es lo que ya estaba, y es exactamente la queja: un párrafo no detecta nada
  (D-032). La deuda anotada que no tiene quien la haga sonar se paga cuando ya es cara.
- *Un test en vez de un chequeo de la puerta.* Tendría que enumerar rutas de todas formas, y viviría
  en la suite de un frente en vez de correr siempre. La puerta es el lugar de los invariantes.

**Allowlist vacía a propósito.** El script tiene un diccionario de excepciones y hoy no tiene
ninguna — las 27 rutas pasan sin excepción, que es la confirmación ejecutable de la auditoría manual
del 2026-08-20. Si algo tiene que entrar ahí, que cueste escribirlo con su motivo al lado.

**Se verifica a sí mismo.** `check-project-access.py --self-test` corre 10 casos contra fixtures
sintéticos y lo ejecuta `scripts/hooks/test-guards.sh`. Un chequeo que no se prueba termina pasando
siempre, que es peor que no tenerlo: da confianza sin dar cobertura.

**Trigger de revisión — cuándo se hace el middleware.** El primero que ocurra: (a) el detector
salta por un olvido real, (b) arranca la rebanada 1, que es donde empieza la tanda grande de
endpoints, o (c) aparece una ruta que el detector no sabe leer. Si al llegar a (b) el detector nunca
saltó, eso es evidencia de que se puede seguir difiriendo — y si saltó dos veces, de que no.

**Reversión.** Sacar una línea de `gate.sh`. Lo que no se revierte es la evidencia que va a haber
juntado para entonces.


## D-045 — Rate limiting en `/auth/login`, y de dónde sale la IP del cliente

**Contexto (2026-08-21).** Cerrar el oráculo de tiempos del login tuvo un costo que hay que pagar
en otro lado. Antes, un email inventado cortaba antes de `bcrypt.compare` y no costaba nada; ahora
**todo** intento paga un hash completo. Tirar 10.000 emails al azar pasó de gratis a 10.000 hashes,
y en el free tier de Render son **0.1 CPU** (D-040), donde los 82 ms medidos en una máquina rápida
se van a varios cientos.

Eso no es una vulnerabilidad abstracta: el criterio 12 del SOM pide una **pre-prod en URL pública**,
y la URL tiene que estar viva cuando la miren. Un spray sin autenticar la voltea. La API no tenía
rate limiting en ningún endpoint — verificado, no supuesto.

La salida no es reabrir el oráculo. Es limitar.

**Decisión — el límite.** `express-rate-limit` sobre `POST /auth/login`, 20 intentos por IP cada 15
minutos, configurable con `LOGIN_RATE_LIMIT_MAX`. Tres elecciones que no son obvias:

- **Se cuentan todos los intentos, no solo los fallidos.** Lo que se protege es CPU, y el hash se
  paga igual cuando la password es correcta. Un limiter con `skipSuccessfulRequests` no defiende de
  nada acá.
- **La clave es la IP, no el email.** Limitar por email deja que cualquiera bloquee la cuenta de
  otro con 20 intentos: se cambia una denegación de servicio general por una **dirigida**, que es
  peor. El costo aceptado es el simétrico: una oficina detrás de un NAT comparte cupo.
- **Solo `/login`, no toda la API.** Ahí es donde está el bcrypt. Un limiter global es una decisión
  de producto que nadie tomó y que rompería clientes legítimos sin haberlo medido.

**Decisión — de dónde sale la IP.** Es la mitad que se rompe en silencio. `app.set("trust proxy", …)`
decide si `req.ip` es la IP del socket o la de `X-Forwarded-For`, y las dos configuraciones
equivocadas fallan muy distinto:

| Config | Qué pasa | Cómo se entera uno |
|---|---|---|
| **De menos** — 0 detrás del proxy de Render | todos comparten la IP del proxy, caen en el mismo balde, la app queda inusable | en el primer minuto |
| **De más** — `trust proxy: true` | cualquiera falsifica `X-Forwarded-For` y el límite no existe | **nunca** |

Se elige el que falla ruidoso: **el default es 0**. Y la configuración que falla en silencio queda
**inalcanzable por construcción** — `trustProxyHops()` parsea siempre a entero, así que `true` no es
un valor escribible; `"true"`, `"-1"` y cualquier basura caen a 0. Está fijado por test.

**Prerequisito del deploy.** El `render.yaml` que falta escribir (D-041, criterio 12) tiene que
setear `TRUST_PROXY_HOPS=1`. Es la segunda entrada de esa lista, después del `generateValue: true`
de `JWT_SECRET` (D-042). Si se olvida, la app se ve rota enseguida — que es el modo de falla que
elegimos, no un accidente.

**Store en memoria.** Alcanza porque el free tier da **una** instancia (D-040). Con dos, cada una
lleva su propia cuenta y el límite efectivo se duplica. No es un problema hoy y no se resuelve por
adelantado: meter Redis para un servicio que no existe es trabajo especulativo (principio 5).

**Alternativas descartadas.**

- *Bajar el cost de bcrypt.* Haría el spray más barato de aguantar y **la regla 4 fija 10**. No es
  negociable por performance.
- *Volver al corte temprano cuando el email no existe.* Reabre el oráculo de enumeración. Cambiar
  una vulnerabilidad por otra no es un arreglo.
- *Un limiter escrito a mano.* Son 30 líneas hasta que aparecen la limpieza de la tabla, las
  cabeceras `draft-7` y el manejo de proxy. Es superficie de auth: acá una dependencia madura y
  chica gana.

**Trigger de revisión.** (a) el free tier deja de alcanzar y hay más de una instancia — ahí el store
en memoria deja de ser correcto; (b) aparece otro endpoint caro sin autenticar (el primer candidato
es el upload de evidencia, que hashea); (c) usuarios legítimos detrás de un NAT chocan con el
límite, que se mide subiendo `LOGIN_RATE_LIMIT_MAX` y no sacando el limiter.

**Reversión.** Sacar el middleware de la ruta. Lo que no se revierte es `trust proxy`: esa línea
tiene que quedar aunque el limiter se vaya, porque cualquier cosa futura que mire `req.ip` —logs de
auditoría incluidos— depende de ella.


## D-046 — bcrypt se ratifica, y la política de passwords sale de NIST/OWASP

**Contexto (2026-08-21).** Pregunta del dueño: *¿por qué estamos usando bcrypt?* Al rastrearlo, la
respuesta que daba el repo era circular. bcrypt **nunca se eligió**: entró en bloque con el backend
PoC (D-016, que absorbe *"JWT firmado + bcrypt cost 10 con revalidación `isActive` por request (ex
ADR-004)"* al lado de Express, Prisma y Multer), y después la **regla 4 de `CLAUDE.md`** lo congeló
como restricción dura. El único debate que hubo desde entonces fue **bcrypt nativo vs `bcryptjs`**,
que es una pregunta de empaquetado —toolchain, `node-pre-gyp`, el warning de `url.parse()`— y no de
criptografía. La pregunta de fondo no se había hecho nunca.

**Decisión 1 — bcrypt se queda, ahora con un argumento.** No es que "no esté roto": es que en
**este** hardware es la forma correcta.

La recomendación general hoy es **Argon2id**, y bcrypt quedó como alternativa aceptable pero no
como default. Lo que da vuelta el análisis acá es que Argon2id y scrypt son **memory-hard**, y
corremos en el free tier de Render: **0.1 CPU** y RAM acotada (D-040). Y desde D-045 **todo** intento
de login paga un hash, exista o no la cuenta. Un KDF memory-hard es exactamente la forma equivocada
para esa caja: la misma restricción que nos obligó a poner rate limiting es la que sostiene a
bcrypt. **El cost 10 no se baja** — la regla 4 lo fija y bajarlo abarata el ataque offline.

**Decisión 2 — la política de passwords, que es lo que de verdad decide cuánto aguanta esto.** El
algoritmo es el multiplicador; la entropía es el número. Ningún KDF compensa una password de 6
caracteres, y `POST /users` pedía exactamente eso. Se alinea con NIST SP 800-63B §5.1.1.2 y la
Authentication Cheat Sheet de OWASP:

| Regla | Qué hacemos | Fuente |
|---|---|---|
| Largo mínimo | **8 caracteres** (era 6) | NIST SHALL · OWASP cheat sheet |
| Largo máximo | **72 bytes**, y se **rechaza**, no se trunca | NIST: *truncation SHALL NOT be performed* |
| Reglas de composición | **ninguna** — nada de "una mayúscula y un número" | NIST SHALL NOT |
| Alfabeto | todo: espacios, Unicode, emoji | NIST SHALL |
| Rotación periódica | **no** | NIST SHALL NOT |

**Por qué el máximo es 72 bytes y no un número redondo.** Es el límite de bcrypt: más allá de eso
**trunca en silencio**, así que alguien con una passphrase larga tendría hasheados solo los primeros
72 bytes y no se enteraría nunca. NIST prohíbe truncar; la salida honesta es rechazar y decirlo. Se
mide en **bytes** y no en caracteres porque el límite de bcrypt es en bytes, y con
`new TextEncoder()` en vez de `Buffer` para que el schema siga funcionando en el browser
(`packages/shared` lo importan los dos lados).

**Costo aceptado del máximo.** NIST pide permitir al menos 64 **caracteres**. Con ASCII se cumple
holgado (64 < 72). Con Unicode multibyte no: 64 caracteres de kanji son 192 bytes y se rechazan. Es
una limitación real de bcrypt, no de la política, y se documenta en vez de disimularse. La salida —
pre-hashear con SHA-256 y base64 antes de bcrypt— tiene su propia trampa (bytes nulos) y cambia la
semántica de los hashes guardados. No entra hoy.

**Por qué 8 y no 12.** OWASP **ASVS 4.0 §2.1.1** pide 12 para passwords elegidas por el usuario;
NIST y la Authentication Cheat Sheet piden 8. Se toma el piso que ambos mandan, que es el default
(principio 3), y queda registrado que 12 es la vara más dura. **Subirlo es cambiar un número** en
`passwordSchema` y las passwords del seed: si el owner lo quiere más estricto, no hay nada que
rediseñar.

**Dónde vive la política.** `passwordSchema` en `packages/shared` (regla 6), no en las rutas.
`POST /users` y `PATCH /users/:id` la importan: una sola definición, y el front puede validar contra
la misma antes de mandar.

**El login NO valida la política, a propósito.** `loginRequestSchema` solo exige que venga algo.
Aplicar la política ahí haría dos cosas malas: convertiría a `/login` en un oráculo de cuál es la
política —justo después de que D-045 y el hash dummy la sacaran de ser un oráculo de otras cosas— y
dejaría afuera a cuentas viejas creadas bajo una política anterior, que es un modo de falla que
aparece recién en la migración. **La política se aplica donde la password se ESCRIBE, no donde se
verifica.**

**Lo que NO entra, y por qué.**

- **Chequeo contra listas de passwords filtradas** (NIST SHOULD, la que más valdría). Es una llamada
  de red con k-anonimato dentro del camino de auth: dependencia externa, latencia y un modo de falla
  nuevo justo donde menos se quiere. Va con el `/security-review` del criterio 11, decidiendo antes
  qué pasa cuando el servicio no responde.
- **`scrypt` de `node:crypto`.** Es lo único que se llevaría puesta toda la deuda del módulo nativo
  de una —`node-pre-gyp`, el warning de `url.parse()`, la línea de 🔴 por ser nativo en
  `specs/stack.md`— y no agrega dependencias. Pero es memory-hard igual, y migrar los hashes
  guardados obliga a rehashear en el próximo login de cada usuario. Queda anotado como la salida.

**Trigger de revisión.** (a) Se sale del free tier y hay CPU y RAM de sobra ⇒ **Argon2id** vuelve a
la mesa y esta decisión se reabre con el hardware nuevo delante. (b) El módulo nativo rompe un
build ⇒ `node:crypto/scrypt`, no `bcryptjs`. (c) El owner pide la vara de ASVS ⇒ el mínimo pasa a 12.
(d) Aparecen usuarios reales (no pilotos) ⇒ entra el chequeo de passwords filtradas.

**Reversión.** La política es un schema en `packages/shared`: cambiar el número es un commit. El
algoritmo no se revierte tan barato —los hashes guardados llevan el prefijo `$2b$`— así que migrar
KDF significa rehashear en el login, que es exactamente el trabajo que (a) y (b) implican.


## D-047 — El seed de demo se niega a sembrar credenciales publicadas en una base que no sea local

**Contexto (2026-08-21).** `prisma/seed.ts` crea `admin@example.com` con una password que está
**publicada**: en `README.md`, en el skill `run-app`, en los presets del login y en los e2e. Eso es
correcto para un SQLite en un disco propio y es un problema serio para la instancia pública que pide
el criterio 12 del SOM — una cuenta admin de credenciales conocidas, en internet, a un `pnpm db:seed`
de distancia. El comando que lo produce es exactamente el que uno corre sin pensar después de
migrar.

El owner además quiere **conservar `admin@example.com`**, y tiene razón: el email está referenciado
en cinco lugares y cambiarlo no compra nada. El email no es el problema.

**Decisión.** El límite no es la password, es **la base de datos**. `DATABASE_URL` que empieza con
`file:` es un SQLite de esta máquina; cualquier otra cosa —`libsql://` de Turso (D-038),
`postgres://`— es una base que alguien más puede alcanzar.

| Base | `SEED_ADMIN_PASSWORD` / `SEED_DEMO_PASSWORD` | Qué pasa |
|---|---|---|
| `file:…` | ausente | se usa el default documentado — no hay nada que proteger |
| `file:…` | presente | se usa, validada contra la política |
| cualquier otra | ausente | **revienta**, y explica por qué |
| cualquier otra | presente | se usa, validada contra la política |

Sin `DATABASE_URL` cuenta como remota: *"no sé contra qué base estoy"* no puede significar *"local"*.
Es la misma lectura de D-042 — el valor ausente no resuelve a algo que funciona.

**Por qué no las otras salidas.**

- *Cambiar o sacar `admin@example.com` del seed.* No arregla nada: el problema no es qué email es,
  es que sus credenciales están en el repo. Y los reviewers de Catalyst necesitan entrar como admin.
- *Poner una password de demo más fuerte.* Es la respuesta intuitiva y no sirve: una password
  publicada sigue publicada por larga que sea. La fuerza es irrelevante cuando el atacante la lee.
- *Exigir las variables siempre, también en local.* Le pone fricción a `pnpm db:seed` —el primer
  comando de cualquiera que clona— para defenderse de una amenaza que en un archivo local no existe.
  Y una fricción sin sentido no se cumple: se saltea con un alias.

**El seed valida contra su propia política.** Una password que venga del entorno pasa por
`passwordSchema` (D-046). Sin eso, `SEED_ADMIN_PASSWORD=abc` crearía un admin que `POST /users`
jamás habría aceptado crear: el seed sería el agujero de la política que el resto de la API cumple.

**Nunca se imprime una password que vino del entorno.** El seed cierra listando credenciales, que es
útil en una terminal y es una fuga en una plataforma, donde los logs se guardan. Los defaults
locales se imprimen porque ya son públicos; lo del entorno se muestra como
`(desde SEED_ADMIN_PASSWORD)`. Está fijado por test, con la aserción escrita al revés —que la salida
**no contenga** el valor— porque es la forma que falla si alguien "mejora" el mensaje.

**Consecuencia para el deploy.** Lo mejor sigue siendo **no correr el seed de demo contra la
instancia pública**. Las variables existen para cuando se lo quiera hacer a propósito —datos de
demo para que los reviewers y los pilotos tengan algo que mirar (criterios 4 y 12)— y ahora eso es
una decisión explícita en vez de un accidente. La lista de lo que el `render.yaml` no puede olvidar
va por tres: `JWT_SECRET` con `generateValue: true` (D-042), `TRUST_PROXY_HOPS=1` (D-045) y estas
dos si el seed corre ahí.

**Trigger de revisión.** (a) Aparece un entorno remoto donde los datos de demo sean lo correcto por
default —una demo pública deliberada, separada de pre-prod— y entonces el eje deja de ser
local/remoto y pasa a ser un `SEED_PROFILE` explícito. (b) El seed deja de publicar credenciales
porque las cuentas se crean por invitación (rebanada 5), y ahí esta decisión se vuelve innecesaria.

**Reversión.** Los helpers están aislados en `prisma/credentials.ts` con sus tests; volver al
comportamiento anterior es usar los literales de nuevo. Lo que no se revierte gratis es el criterio
12: si esto se saca, hay que resolver de otra forma que la URL pública no quede con un admin
conocido.

## D-048 — La migración a Drizzle deja de estar diferida: arranca antes de las rebanadas de M3 — **Aceptada**

**Contexto (2026-08-21).** D-038 ratificó Drizzle como destino de ORM pero difirió la migración
"a cuando haga falta", con el principio 3 como trigger explícito: evidencia concreta, no
conveniencia. Al revisar el stack con el dueño del producto surgió el origen real de Prisma en este
repo: el destino siempre fue Drizzle (era la decisión original, D-004); en el medio, una maqueta que
era más bien un borrador se actualizó y quedó incorporada al repo, Prisma se coló como atajo de esa
maqueta, y esas primeras definiciones se traspapelaron. No es una preferencia técnica nueva — es
retomar el rumbo original que el repo había perdido de vista.

**Decisión.** La migración arranca **ahora**, antes de abrir la rebanada 1 (login de 4 roles) y de
cualquier otro trabajo de M3. Razón: resolver la deuda de infraestructura que se pueda resolver
**antes** de que el código nuevo empiece a acoplarse a Prisma — cuanto más tarde, más superficie hay
que migrar después. Evidencia que satisface el principio 3 para reabrir D-038: el análisis técnico
está más alineado a las preferencias ya declaradas del proyecto (querys más chicas y más explícitas,
más parecidas a SQL que al DSL de Prisma, sin motor de generación de cliente aparte) — no es una
limitación medida de Prisma, es la misma clase de evidencia que ya usó D-039 (postura del dueño del
producto) para cerrar una decisión sin spike.

**Qué NO cambia de D-038.** El destino de hosting (Turso en prod, SQLite en dev) y el driver elegido
para hablar con esa base no dependen del ORM — siguen intactos. Lo único que se adelanta es el
*cuándo* de la migración de ORM, no el *qué*.

**Alcance de esta rebanada.** `packages/api` completo: `schema.prisma` → schema Drizzle,
migraciones, y los 8 archivos de `src/` que importan `@prisma/client` hoy. `apps/web` no usa Prisma
y no se toca. El detalle técnico de la migración (naming de columnas, manejo de IDs, timestamps,
seed) queda en el commit que la implementa, no acá — esta entrada es la decisión de *cuándo y por
qué*, no el diseño del schema.

**Trigger de revisión.** Ninguno — decisión de una sola vez, no recurrente. Si la migración expone
un problema real con Drizzle+libSQL que no estaba previsto, se documenta como una D-0XX nueva que
reabra este párrafo con esa evidencia, siguiendo el mismo principio 3.


## D-049 — ORM: Drizzle → Kysely, un commit después de D-048 — **Aceptada**

**Contexto (2026-08-21).** D-048 migró `packages/api` de Prisma a Drizzle el mismo día. Un commit
después, el dueño del producto pidió migrar de Drizzle a Kysely con el argumento de que "Drizzle no
es completamente type-safe, Kysely sí". Se le pidió evidencia concreta (un caso puntual del repo
donde Drizzle perdiera tipos) antes de reabrir D-048, siguiendo el principio 3. No hay caso puntual:
es una postura del dueño del producto, no un hallazgo técnico — la misma clase de evidencia que ya
cerró D-039 (Render sobre Railway) sin spike. Se registra así, sin dorar la píldora: **esta entrada
no tiene el respaldo técnico que el trigger de revisión de D-048 pedía**; se acepta igual porque el
principio 3 reconoce la postura del dueño del producto como evidencia válida para un default, y
D-048 nunca fue más que eso.

**Decisión.** `packages/api` migra su capa de acceso a datos de Drizzle a **Kysely**, sobre el mismo
`@libsql/client` y el mismo archivo de migraciones SQL (`drizzle/*.sql` se renombra pero su
contenido no cambia: son SQL plano, no DSL de un ORM). El schema pasa de `drizzle-orm/sqlite-core`
a una interfaz `Database` de Kysely con los mismos nombres de tabla/columna. Los patrones ya
resueltos para Drizzle (`projectScope` como `EXISTS` correlacionado, `EVIDENCE_SAFE_COLUMNS` como
lista explícita de columnas seleccionadas) se reimplementan con el query builder de Kysely — no se
pierden, cambian de sintaxis.

**Qué NO cambia.** Turso/SQLite (D-038), `@libsql/client` como driver, el shape de las tablas, y
`drizzle-kit` **como generador de migraciones SQL** (Kysely no trae uno propio; se sigue generando
el diff con `drizzle-kit generate` a partir de un schema espejo mínimo, o escribiendo el SQL a
mano — a decidir en la implementación, no acá).

**Alcance.** `packages/api` completo: `src/db/schema.ts`, `src/lib/db.ts`, `src/db/migrate.ts`,
`src/db/seed.ts`, `src/middlewares/auth.ts` y las cinco rutas que importan Drizzle
(`audit`, `auth`, `evidence`, `milestones`, `projects`, `users`). `apps/web` no se toca.

**Trigger de revisión.** Ninguno adicional al de D-048: si esta migración expone un problema real
con Kysely, se documenta como una D-0XX nueva con esa evidencia. Dado que esta entrada ya se acepta
sin evidencia técnica, una futura reversión tampoco la necesita — alcanza con la misma postura del
dueño del producto.

**Reversión.** Mientras el ORM siga detrás de `packages/api/src/lib/db.ts` (antes `lib/prisma.ts`)
y de los repositorios de cada ruta, volver a Prisma es una migración simétrica a esta, no un
rediseño.

---

# Repaso completo — 2026-07-29

**Por qué.** D-001 a D-017 se redactaron **antes** de que llegara la documentación oficial de M1, M2 y M3. Se revisaron las 25 entradas con los once entregables delante. Esto queda como constancia de que el repaso ocurrió: **una entrada marcada "Intacta" acá no se re-litiga sin evidencia nueva** (principio 3).

| # | Veredicto | Qué pasó |
|---|---|---|
| D-001 | **Reformulada** | El trigger de revisión dependía de una custodia de fondos que D-021 dice que nunca existirá. Reescrito: dispara al congelar validadores para auditoría de cara a mainnet. |
| D-002 | **Reformulada** | La maqueta PropTrust que porta quedó obsoleta; el diseño vigente es PropNexus. La adopción de shadcn/ui se formaliza en D-024. |
| D-003 | Intacta | La separación web/api no la toca ningún entregable. |
| D-004 | Intacta | Ya estaba reemplazada por D-016. |
| D-005 | Intacta | Lucid vs Mesh sigue abierta; la cierra el walking skeleton. |
| D-006 | **Reformulada** | Le faltaba el criterio de qué se ancla (ahora en D-027) y el perfil de carga: anclable escaso y temprano, voluminoso tardío y fuera de la cadena. |
| D-007 | **Reformulada** | "El backend es la fuente de verdad" se leía como que el backend decide el estado de una obra. No decide nada (D-026): es fuente de verdad del **registro**, no del hecho. |
| D-008 | **Reformulada** | Necesitaba responder por qué hace falta un validador si la plataforma no controla nada. Respuesta: no controla el mundo real, **controla al operador**. Sin eso, el comprador tendría que confiar en nosotros — el problema que veníamos a resolver. |
| D-009 | Intacta | Sigue abierta; reencuadrada por D-028 (la firma cae sobre la atestación, no sobre cada archivo). |
| D-010 | Intacta | Deploy no depende de nada que faltara. |
| D-011 | Intacta | S3 sigue siendo el destino. D-027 le suma volumen tardío de assets como carga principal. |
| D-012 | Intacta | Cambios aditivos: sin relación con lo que faltaba. |
| D-013 | **Reformulada** | Se explicitó Preprod (no Preview) y que mainnet queda fuera del alcance de M3. |
| D-014 | Intacta | `AnchorPort` con doble modo se confirma con M2-D4 §8.1. |
| D-015 | Intacta | Versionado por artefacto: sin relación. |
| D-016 | Intacta | El backend adoptado sigue siendo la base. El rol `notary` y el rename de D-023 son cambios de modelo, no de esta decisión. |
| D-017 | Intacta | La consolidación `milestone.ak`/`milestone2.ak` seguía Abierta *(se cerró después: D-054 — compilaban al mismo hash)*. |
| D-018..D-025 | — | Nacidas ya con la documentación completa. |

**Lo que el repaso cambió de fondo:** las tres decisiones on-chain (D-006, D-007, D-008) tenían fundamentos escritos para un producto que retenía valor y hacía cumplir reglas. El producto no es eso. La implementación de las tres sobrevive casi sin cambios — lo que se reescribió es **por qué**, que es lo que evita derivar mal en las próximas cincuenta decisiones.

**Lo que el repaso no cubre:** el modelo de datos y las specs. Las entradas siguen siendo válidas, pero `specs/` entero precede a la documentación oficial y se reescribe aparte.

## D-050 — El `502` en `POST`+`401` no era de h3: era el spec de fetch. Se cierra con `credentials: "omit"` — **Aceptada**

**Contexto (2026-08-23).** Auditoría de stack previa al primer deploy. D-037 dejó el `502` como
deuda con la atribución "bug de h3 que abarca al menos rc.22 y rc.25, no se resuelve eligiendo
versión". La primera mitad de esa frase es falsa; la segunda es cierta por una razón distinta a la
que se creía.

**Lo que se midió.** El `502` **sobrevive al build de producción**, no es un artefacto de `vite dev`:
un login con password incorrecta contra `apps/web/.output/server/index.mjs` devolvía
`{"error":true,"status":502,"message":"fetch failed"}` en vez del `401` de la API. O sea que se
habría desplegado a la URL pública del criterio 12 con el camino de error más común de la app
respondiendo mal.

Matriz por el proxy, contra la API directa como control:

| Request | Directo a la API | Por el proxy (antes) |
|---|---|---|
| `POST /auth/login` password incorrecta | 401 | **502** |
| `POST /projects` sin token | 401 | **502** |
| `POST /auth/login` body inválido | 400 | 400 |
| `GET /auth/me` sin token | 401 | 401 |
| `POST /auth/login` correcto | 200 | 200 |

**Causa raíz.** No es h3 y no es la API. Es **`undici`, el `fetch` de Node, cumpliendo el spec de
WHATWG**. `proxyRequest` de h3 reenvía el body como `ReadableStream` con `duplex: "half"`; el paso
*HTTP-network-or-cache fetch* del spec dice que ante un `401` hay que reintentar la request con
credenciales, y que si el body no es reproducible (`body.source == null`, que es exactamente el caso
de un stream) el resultado es un **network error**. En el `undici` embebido en Node 24.14.1 (v7.24.4):

```js
if (response.status === 401 && httpRequest.responseTainting !== "cors" && includeCredentials && …) {
  if (request.body != null) {
    if (request.body.source == null) {
      return makeNetworkError("expected non-null body source");
```

h3 envuelve ese network error en `HTTPError({ status: 502 })` y de ahí sale el `502`.

Aislado con un upstream de 15 líneas, fuera de todo el stack: `401` explota, `400` y `200` pasan, y
el mismo `401` con body **bufferizado** (string en vez de stream) pasa perfecto. Con eso queda claro
que la variable nunca fue la versión de h3 ni la de Nitro, sino **la versión de Node** — y que
esperar a "Nitro 3 estable" (el trigger de revisión de D-037) no iba a arreglar nada, porque no hay
nada roto que arreglar: es comportamiento especificado.

**Decisión.** Las `routeRules` de proxy en `apps/web/vite.config.ts` pasan
`fetchOptions: { credentials: "omit" }`. Es la única de las cuatro condiciones del `if` que se puede
apagar desde afuera (`mode: "cors"`, `redirect: "manual"` y `credentials: "include"` se probaron y
no la evitan), y **es lo semánticamente correcto para un proxy**: un proxy no debe adjuntar
credenciales ambientes propias — reenvía el `Authorization` del cliente explícitamente, que es lo
que `getProxyRequestHeaders` ya hacía y sigue haciendo.

Nitro spread-ea las opciones de la route rule dentro de `proxyRequest(event, target, {...m.options})`,
así que `fetchOptions` llega sin necesidad de parchear nada de h3.

**Verificado, no supuesto.** Los cinco casos de la tabla dan el status correcto por el proxy, en el
**build de producción** y en `pnpm dev`; `GET /auth/me` con token válido sigue dando 200, o sea que
el `Authorization` se sigue reenviando. **D-037 queda cerrada** y su trigger de revisión ("volver a
probar el 502 cuando salga Nitro 3 estable") se retira: ya no hay nada que reprobar.

**Alternativas descartadas.** (a) *Orígenes separados + CORS* — el front tomaría la URL de la API de
una env var y la API sumaría allowlist de orígenes: correcto, estándar, y cuesta un cambio en
`port.ts`, CORS nuevo en la API y una URL de API en el bundle. Se descarta porque el arreglo real
son dos líneas y no toca superficie de auth. (b) *Handler de proxy propio que bufferice el body* —
mismo efecto, pero pone código nuestro atado a la API de h3 en una beta.

**La lección, por tercera vez.** Es la **tercera** atribución falsa que cae por medición: Multer por
el warning de `url.parse()` (D-036), h3 por el `502` (D-037) y ahora h3 otra vez acá. Las tres
estaban escritas en el repo como hechos verificados. **D-037 no se equivocó por descuido — se
equivocó por parar de bisecar un nivel antes de llegar al fondo**: probó dos versiones de h3, vio
que el bug sobrevivía, y concluyó "es h3 en varias versiones" cuando el dato compatible era "no es
h3". Corolario operativo: cuando cambiar la versión del sospechoso no mueve el síntoma, la hipótesis
correcta es que el sospechoso está mal elegido, no que el bug es viejo.

**Trigger de revisión.** Si una versión futura de Node cambia el manejo de `credentials: "omit"` en
ese paso del spec, o si el proxy alguna vez necesita reenviar cookies del navegador (hoy la sesión
va por `Authorization`, no por cookie — `apps/web/src/auth/session.ts`), se reabre.


## D-051 — El primer deploy sale con evidencia efímera y marcada, en vez de esperar a R2 — **Aceptada**

**Contexto (2026-08-23).** D-040 declaró R2 **prerequisito** del primer deploy: el free tier no tiene
disco persistente, así que un archivo subido se pierde en el primer spin-down mientras su
`sha256Hash` sobrevive en la base — y una app que muestra un hash cuyo archivo no existe está
mostrando prueba que no puede sustanciar (regla 17).

**Decisión.** Se despliega igual, **hoy**, con `UPLOAD_DIR=/tmp/uploads` declarado efímero en
`render.yaml`, y el adaptador S3/R2 sale en su propia rebanada. Postura del dueño del producto.

**Por qué no rompe la regla 17.** La regla prohíbe *mostrar* una señal de prueba insustanciable, y
hoy no hay ninguna que mostrar: `packages/cardano` está vacío, no hay `AnchorPort`, no hay anclaje y
por lo tanto no hay ningún estado "Verificado" que la app pueda emitir (D-014). Lo que se pierde al
reiniciar es un archivo con un hash local, no una cadena de prueba anclada. **La ventana en que esto
es aceptable se cierra exactamente el día que exista el primer anclaje**, y ese día R2 pasa a ser
bloqueante de verdad.

**Lo que se gana.** URL pública, login, navegación y base persistente andando ahora — criterios 12,
13 y 8 del SOM — sin esperar una rebanada 🔴 (mover el SHA-256 para que cubra los bytes que terminan
en el object storage, no un temporal).

**Lo que se acepta a cambio, explícito.** Subir evidencia a la instancia desplegada y esperar
encontrarla después **no funciona**, y eso hay que decirlo antes de cualquier demo. Está anotado en
el `render.yaml`, en `specs/RUNBOOK-deploy.md` §Limitaciones y en `specs/stack.md` §6.

**Trigger de revisión.** Se vuelve bloqueante con el primero de: (a) el primer anclaje real (D-014),
(b) un piloto o reviewer subiendo evidencia que espere conservar, (c) cualquier pantalla que muestre
un `HashChip` sobre un archivo subido en la instancia desplegada.

## D-052 — Saneamiento: se borra el rastro de Prisma y Drizzle, y cada cosa queda en un solo lugar — **Aceptada**

**Contexto (2026-08-23).** La auditoría de stack encontró que D-048 y D-049 habían migrado el
código pero **no habían barrido lo que dejaron atrás**. El repo decía "Prisma ya no está" mientras
`pnpm install` lo seguía instalando, y tres cosas que deberían existir una sola vez existían dos.

**Qué se saneó, y por qué cada una importa.**

**1 · `auto-install-peers=false` en `.npmrc`.** Con `true`, pnpm instala también los peers
**opcionales**: `db0` (viene con Nitro, nada de este repo lo usa) declara `drizzle-orm` opcional, y
`drizzle-orm` arrastra Prisma entero con sus engines. Medido con instalación limpia de los dos
lados: **559 MB → 334 MB** (−40 %), 566 → 541 paquetes distintos en el lockfile. `prisma`,
`@prisma/*` y `drizzle-orm` ya no aparecen. Se paga en cada build de Render, donde el
`pnpm install --frozen-lockfile` es la parte larga y el free tier es lento.

**2 · `packages/api/drizzle/` → `packages/api/migrations/`.** El directorio se llamaba como un ORM
que ya no está. Se fue también `meta/` (`_journal.json` + `0000_snapshot.json`: metadata de
`drizzle-kit`, que nada lee desde D-049) y el archivo pasó de `0000_kind_vulcan.sql` —nombre
autogenerado— a `0000_init.sql`.

> **Renombrar una migración aplicada normalmente está prohibido**, y con razón: el tracking es por
> nombre de archivo, así que renombrarla la vuelve "pendiente" y revienta contra una base que ya la
> tiene. Acá es legítimo por una ventana que se cierra sola: **no hay ninguna base desplegada**
> (D-041: el deploy todavía no se ejecutó), y las locales se regeneran con dos comandos. **Este es
> el último momento en que el rename es gratis.** Después del primer deploy, no se hace más.
>
> Consecuencia para quien tenga un árbol viejo: `rm packages/api/dev.db && pnpm db:migrate && pnpm db:seed`.
> `test.db` no necesita nada — la suite lo borra y lo recrea en cada corrida.

**3 · Un solo runner de migraciones.** `test/global-setup.ts` tenía su **propia copia** del
aplicador: leía el directorio, partía por `--> statement-breakpoint` y escribía `_migrations`, todo
duplicado de `src/db/migrate.ts`. Eso vaciaba de sentido lo único que justifica aplicar las
migraciones reales en la suite —verificar lo mismo que corre en producción—, porque la garantía
dependía de que dos copias no divergieran. Ahora `migrate.ts` exporta `applyPendingMigrations()` y
la suite la importa (−43 líneas). El script quedó detrás de `require.main === module`: sin ese
guardia, importarlo desde los tests migraba `dev.db` como efecto secundario del import.

**4 · Un `.env.example` por servicio, y ninguno en la raíz.** El de la raíz no lo leía nadie:
mandaba a otro archivo y describía Postgres y MinIO, que no son el stack. Sus variables útiles
—Cardano y S3— se mudaron a `packages/api/.env.example`, que es el proceso que las va a leer,
**comentadas**: una variable activa que ningún código consulta parece configuración y no lo es. Se
suma `apps/web/.env.example`, que faltaba, con la advertencia de que sus dos variables son de
**build time**. El README dejó de copiar la lista y ahora linkea: una lista duplicada se
desactualiza en la copia, no en el original.

**5 · Rastros de texto.** `db:generate` seguía documentado en tres lugares y **encadenado con `&&`
en `scripts/worktree.sh`**, así que desde D-049 ningún árbol nuevo quedaba con base sembrada — el
comando no existe y cortaba la cadena. Además: `tsconfig.typecheck.json` incluía `drizzle.config.ts`
(borrado), `CLAUDE.md` y `README.md` decían "Express + Prisma", y comentarios de código explicaban
el presente con analogías a un ORM ausente. Las menciones que **quedan** en `DECISIONS.md` y en las
trampas de `packages/api/CLAUDE.md` son registro histórico y no se tocan: explican por qué el código
es como es.

**Lo que NO cambia.** Ninguna de las cinco toca comportamiento: mismo esquema, mismo SQL, mismos
endpoints. Las 108 pruebas y los dos builds pasan igual antes y después, y la puerta abre.

**Trigger de revisión.** `auto-install-peers=false` se revisa si algún día falta un peer **no**
opcional y el síntoma es un import que no resuelve — el arreglo entonces es declararlo como
dependencia directa, que es lo correcto, no volver a `true`.

## D-053 — El harness de agentes se borra entero. Vuelve el CI declarativo — **Aceptada** · revierte D-032

**Contexto (2026-08-23).** Pregunta del dueño del producto: *"me resulta raro que haya tantos
scripts y tantos hooks; son una adición relativamente nueva que creo que complica todo"*. Se midió
antes de responder, porque D-032 está Aceptada y reabrirla exige evidencia, no preferencia
(principio 3). La evidencia apareció completa.

**Lo que se midió.**

| | |
|---|---|
| Repo iniciado | 2026-07-15 |
| Harness incorporado | **2026-08-20**, casi todo en un commit (`a2c654f`), el nº 46 de 61 |
| Vida útil al momento de borrarlo | **3 días** |
| Peso | **1099 líneas**, contra 5512 de código de producto — **20 %** |
| Commits de arreglo *a sí mismo* en esos 3 días | **5** |
| Bugs reales del período que detectó | **0** |

Los cinco arreglos: `ae7b3a9` el lockfile desactualizado que no detectaba · `955c8c6` `docs/` que
nunca verificaba en CI · `82879f7` el hook de orientación que no encontraba las specs · `e433185`
el CI que quedaba rojo para siempre · `7300add` la puerta detectándose a sí misma buscando mainnet.
Más tres trampas registradas, **todas autoinfligidas**: el guardia de Bash bloqueándose al
escribirse, el escáner de mainnet matcheando su propio mensaje de error, y `GATE_ALLOW_DOCS=1`
desactivando en silencio la suite que verifica los guardias.

**El dato que decidió.** Los cuatro bugs reales encontrados en la auditoría del 2026-08-23 —el 502
del proxy (D-050), las migraciones que no se resolvían desde `dist/` y habrían roto el primer
arranque en Render, el `db:generate` encadenado con `&&` que dejó **dos días sin sembrar ningún
árbol nuevo**, y los 225 MB de ORMs muertos (D-052)— **no los detectó ningún guardia**. Salieron de
leer y de medir. Los guardias, mayormente, se encontraron a sí mismos.

**Y el argumento que lo cerró: el CI ya existía desde el día 1.** `a3b7051` (2026-07-15) traía un
workflow declarativo con `typecheck` + `test` + `build` y el job entero de Aiken. **`gate.sh` no
trajo CI: reemplazó 40 líneas de YAML por 285 de bash.** El detalle que lo delata es que el job de
Aiken quedó declarativo y **nunca necesitó un arreglo** — los cinco fueron todos a la parte nueva.

**Decisión.** Se borra el harness **entero**, sin excepciones: `gate.sh`, `worktree.sh`,
`check-lockfile.py`, `check-project-access.py`, los cinco hooks, el bloque `hooks` de
`settings.json`, los tres subagentes, las dos skills y `permissions.deny`. **2155 líneas.**

Lo reemplaza lo que ya era declarativo y no necesitó mantenimiento:

```bash
pnpm verify        # typecheck + tests + build — lo mismo que corre el CI
```

`pnpm install --frozen-lockfile` cubre solo el caso de `check-lockfile.py` que importaba — de hecho
**así se descubrió el bug original: lo atrapó el CI**, no un script. En `.claude/` queda únicamente
la lista de comandos preaprobados, que es comodidad de sesión y no una regla.

**Lo que se pierde, dicho sin maquillar.**

1. **La segunda capa de autorización (regla 5) queda sin enforcement automático.** Es la única
   pérdida real: falla en silencio, no la ve el compilador ni un test ni el CI. Los 27 endpoints
   actuales están auditados y correctos; el riesgo es el 28 sobre un backlog de ~80. El arreglo
   propuesto **no es otro escáner** —era un parche de 147 líneas sobre un problema de forma— sino
   `requireProjectAccess(...)`, hermano de `requireRole`, que se ve en la firma de la ruta. Queda
   abierto y con dueño humano: es 🔴.
2. **Fallar más tarde.** Lo que antes moría antes de pushear ahora muere en el CI. Se acepta: son
   minutos, y `pnpm verify` está a un comando de distancia.
3. **La conveniencia de `worktree.sh`.** Nula en la práctica: **nunca se usó** — no existió jamás
   una rama `track/*`, verificado en el historial completo.

**Lo que NO cambia.** Las reglas siguen escritas y siguen valiendo: no editar una migración
aplicada, no commitear secretos, no editar `docs/` a la ligera. Pasan de bloqueo a criterio, que es
donde D-032 mismo ponía todo lo que requiere juicio.

**La lección, que es más general que este repo.** El harness se construyó para hacer cumplir reglas
que ya estaban escritas, y terminó siendo una segunda base de código con sus propios bugs, su propia
suite de tests y su propio mantenimiento — para un repo de un solo desarrollador. **Antes de agregar
un verificador, preguntá si el problema no se arregla mejor cambiando la forma de lo verificado**:
`check-project-access.py` son 147 líneas detectando un olvido que un middleware de 15 no permite
cometer.

**Trigger de revisión.** Vuelve a discutirse si (a) se suma una segunda persona al repo —el
argumento cambia cuando el criterio compartido deja de estar en una sola cabeza, y es el mismo
trigger que D-030 define para volver a PRs—, o (b) un bug real llega a `main` por algo que un
chequeo automático barato habría atajado. En ese caso se agrega **ese** chequeo, no un harness.

**Reversión.** `git revert` del commit, o `git show <commit>^:scripts/gate.sh`. Nada se pierde: está
todo en el historial.

## D-054 — Reseteo de estándar antes del deploy: Express 5, errores que no mienten, Biome, un validador, y TS separado de Aiken — **Aceptada**

**Contexto (2026-08-23).** Postura del dueño tras la poda del harness: *"varias decisiones quedaron
viejas u obsoletas; hay que resetear el repo a un estándar digno antes de deployar, y para eso hay
que mirar el código y no creerle a las decisiones"*. El caso que lo disparó: el repo hablaba de una
puerta, hooks y subagentes, y **no tenía linter ni formateador** — algo que ninguna decisión
mencionaba porque nadie había mirado.

Esta entrada registra lo que apareció al auditar **el código**, no los documentos.

### 1 · Express 4 → 5: un error en cualquier ruta mataba el proceso

**Medido, no supuesto.** En Express 4 un handler `async` que rechaza **no llega al `errorHandler`**:

| | Express 4 | Express 5 |
|---|---|---|
| `throw` síncrono | → errorHandler | → errorHandler |
| `throw` en handler `async` | **request colgada + `unhandledRejection` → proceso con exit 1** | → errorHandler |

Las **25 rutas de la API son `async`** y ninguna tiene try/catch. O sea que cualquier fallo
inesperado —Turso lento, una columna que no existe, un null— colgaba la request y **mataba el
proceso**; en Render free eso es ~1 minuto de arranque en frío para el siguiente visitante.

Se migró a `express@5.2.1` + `@types/express@5.0.6`. La superficie era chica y se verificó antes:
ninguna API removida en uso, todas las rutas con paths simples (path-to-regexp v8 no las toca), y
`req.query` leyendo dos strings. **Las 88 pruebas pasaron sin editar una sola.**

**Deriva de la migración.** `req.params[x]` pasa a ser `string | string[]` (v8 admite params
repetidos). Los 8 sitios afectados se tipan con `Request<{ id: string }>`; en
`requireProjectAccess`, donde la clave es dinámica, se narrowea en runtime y **un array es un 500**:
elegir el primer id en silencio sería el bug exacto que no se quiere en la capa de autorización.

**Esto deroga la prohibición de `CLAUDE.md`** *"no subir `@types/express` a v5 mientras `express` sea
v4"*: era conditional y la condición dejó de valer. Se agrega `pnpm.overrides` para
`@types/express`, porque `@types/multer` arrastraba una resolución vieja a v4 y tener dos copias de
esos tipos ya había costado una sesión antes.

### 2 · El `errorHandler` mentía en las dos direcciones

Devolvía **400 con `err.message`** para cualquier `Error`. Es decir: un fallo interno se reportaba
como culpa del cliente —**el monitoreo nunca veía un 5xx**, y un servicio que jamás reporta errores
de servidor no es sano, es ciego— y de paso le mandaba al cliente el mensaje crudo, que en un error
de Kysely/libSQL trae SQL, nombres de tabla y rutas del servidor (regla 2).

Ahora la pregunta es explícita: **¿este mensaje lo escribimos para que lo lea quien usa la API?**
Para eso está `HttpError` (status + mensaje seguro). `MulterError` se mapea a 400 porque sus
mensajes son genéricos. **Todo lo demás es 500 genérico**, con el detalle en el log del servidor —
único lugar donde se puede mirar en Render, que no da shell (D-040).

### 3 · Hardening que faltaba entero

`helmet` (cero dependencias transitivas), `x-powered-by` desactivado, y **handler 404 en JSON**:
antes una ruta inexistente devolvía la página HTML de Express, desde una API que solo habla JSON.

**`GET /health` ahora consulta la base.** Antes devolvía `{ok:true}` sin tocar nada, así que Render
daba el servicio por sano mientras cada request fallaba por una `DATABASE_URL` mal cargada — que es
**el modo de falla más probable del primer deploy** y exactamente lo que un healthcheck existe para
detectar. Verificado: con la base inalcanzable ahora responde 503.

**Cierre ordenado con `SIGTERM`/`SIGINT`**, que Render manda en cada deploy: antes las requests en
vuelo se cortaban a la mitad y la conexión a la base quedaba abierta.

### 4 · No había linter ni formateador — y `pnpm lint` no hacía nada

`pnpm lint` era `pnpm -r lint` y **ningún package declaraba `lint`**: corría, no hacía nada, y no
avisaba. El mismo modo de falla que D-032 había diagnosticado para `pnpm test`, sobreviviendo al
harness que se creó para arreglarlo.

Entra **Biome 2.5.10** (uno solo: formateador + linter), corriendo en `pnpm verify` y en el CI. La
primera pasada encontró, entre otras cosas, la deuda que `packages/api/CLAUDE.md` ya tenía anotada
—`GET /projects` leyendo la query sin Zod, con un `as any` que le mentía al compilador— y **9 bugs
reales de accesibilidad**: `<span role="button">` y `<div onClick>` sin foco ni teclado. Todos
arreglados con elementos semánticos.

**Tres archivos quedan fuera de Biome**, y no por conveniencia: su parser rechaza
`import type … with { "resolution-mode": "require" }`, que es **TypeScript 5.3+ válido** y el patrón
sin el cual este package CJS no typechequea contra dependencias ESM puras (D-049). Es una limitación
de Biome; los diagnósticos de categoría `syntax/` no se pueden suprimir inline, así que se acota a
`db/id.ts`, `lib/kysely.ts` y `lib/libsql-client.ts`.

### 5 · Había dos validadores Aiken, y son el mismo script

D-017 dejó la consolidación de `milestone.ak` y `milestone2.ak` **abierta, con un spike de ≤1 día**.
No hacía falta ningún spike: **los dos compilan al mismo hash** — `06534cfa08c481a9fa2e3995`. No son
"casi idénticos": son idénticos, y la diferencia es de estilo (`when` contra destructuring). El
blueprint commiteado publicaba los dos.

Se borra `milestone2.ak`. **El hash del script no cambió**, o sea que no hay nada que redesplegar.
Y de paso se cierra D-015 en contratos: `j/milestone-fsm` `0.0.0` (scaffold) pasa a
`propnexus/stage-fsm` versión `1`.

**Lo que NO se tocó:** los contratos siguen con **0 tests** contra un criterio 2 del SOM que pide
≥95% de coverage. Es la deuda más grande que queda y no entra acá.

### 6 · TypeScript y Aiken se verifican por separado

Postura del dueño: **son dos cosas distintas y no tienen por qué compartir cadena**. Distinto
toolchain, distintos artefactos, distintos modos de falla — que un validador no compile no dice
nada sobre la app, y al revés tampoco.

```bash
pnpm verify             # app TS: lint + typecheck + tests + build
pnpm contracts:verify   # Aiken: fmt --check + check + build
pnpm verify:all         # las dos, encadenadas cuando hace falta
```

Consecuencia concreta: **Biome deja de mirar `contracts/` entero**. Estaba intentando reformatear
`contracts/plutus.json`, que lo genera `aiken build` — y eso habría dejado el CI en rojo permanente
por "blueprint desactualizado" contra un archivo que el linter reescribía por su cuenta. Un
formateador de TypeScript no tiene nada que opinar sobre un artefacto de Aiken.

El CI ya los tenía como **dos jobs en paralelo** y así se quedan, ahora con los nombres diciéndolo
(`App TS` y `Contratos Aiken`). El chequeo de "blueprint al día" (`git diff --exit-code`) vive solo
en CI a propósito: compara contra lo commiteado, así que en local, con cambios en curso, daría rojo
siempre.

### 7 · `engines` declaraba soporte que no existe

Decía `>=20`. Nitro exige `^20.19.0 || >=22.12.0` y el `require(esm)` de `lib/libsql-client.ts`
necesita Node ≥22.12: con Node 20.5 esto no arranca y el `package.json` decía que sí. Pasa a
`>=22.12`, y se agrega `.nvmrc`.

**Trigger de revisión.** Nada de esto es una preferencia de estilo: cada punto salió de un
comportamiento medido. Se reabre con la misma vara — evidencia de que el comportamiento cambió.

## D-055 — Estructura de carpetas cerrada: `apps/` es lo desplegable, `packages/` es librería — **Aceptada**

**Contexto (2026-08-23).** Pregunta del dueño al cerrar el reseteo: *"¿debería ser `apps/api` en vez
de `packages/api`? Quiero cerrar la estructura de carpetas de todo el proyecto"*. Se auditó el árbol
entero, directorio por directorio, en vez de razonar sobre lo que los documentos decían que había.

**La convención, explícita.** `apps/*` = **se despliega**. `packages/*` = **librería que alguien
importa**. `contracts/` = otro toolchain, fuera del workspace pnpm.

```
apps/api        Express 5      → servicio en Render
apps/web        TanStack Start → servicio en Render
packages/shared contrato Zod   → lo importan los dos
contracts/      Aiken          → no se hostea; su propio lockfile y caché
```

**1 · `packages/api` → `apps/api`.** Era un servicio desplegable viviendo entre las librerías, con
lo cual la convención no decía nada: si `packages/` contiene tanto una librería como un servicio,
mirar la carpeta no informa. Ahora sí. El nombre del paquete (`@plataforma/api`) **no cambia**, así
que todos los `--filter` siguen igual.

**2 · `packages/cardano` se borra.** Era un directorio con un `.gitkeep`, sin `package.json`:
invisible para pnpm, o sea que **no era un package** aunque tres documentos lo llamaran así. Vuelve
como package real el día que exista el `AnchorPort` (D-014) — crear el `package.json` hoy sería
declarar una dependencia que nada tiene.

**3 · `apps/web/.gitignore` se borra.** Scaffold de TanStack: duplicaba lo que ya ignora la raíz y
además listaba `.wrangler`, `.vinxi`, `__unconfig*` y `todos.json` — herramientas que este proyecto
no usa. Un `.gitignore` que menciona Cloudflare Workers en un repo que despliega en Render es ruido
que hace dudar de lo que se está leyendo.

**4 · Un `uploads/` suelto en la raíz, y por qué apareció.** `UPLOAD_DIR` caía por default en
`"./uploads"`, **relativo al cwd**: arrancar la API desde la raíz del repo creaba el directorio ahí.
No afecta al deploy —`render.yaml` setea la variable explícita— pero en local decide dónde van los
archivos según desde dónde se invoque el comando. Ahora el default se ancla al package
(`path.resolve(__dirname, …)`), y la raíz tiene su propia entrada en `.gitignore` por las dudas.

**El mismo bug estaba en la suite de tests, y el rename lo destapó.** `vitest.config.mts` resolvía
`@plataforma/shared` con `path.resolve(process.cwd(), "../shared/src/index.ts")`. Al mover el
package, `../shared` dejó de existir y **las 9 suites fallaron con "Cannot find package"**. Anclado
también a `import.meta.dirname`.

> **Corolario que vale más que las cuatro mudanzas:** *un path relativo al `cwd` es una dependencia
> oculta de desde dónde se invoca el comando.* Aparecieron dos en el mismo día, en archivos sin
> relación, y los dos habrían fallado distinto en el deploy que en local. Al escribir una ruta,
> anclala al archivo (`__dirname` / `import.meta.dirname`), no al proceso.

**Lo que NO se movió, y por qué.** `packages/shared` se queda donde está: es una librería de verdad
y es lo único que vuelve **imposible** —no prohibido— el drift entre el front y el back. `contracts/`
tampoco entra al workspace pnpm: es otro toolchain (D-054 §6).

**Nota sobre las rutas en `DECISIONS.md`.** Las entradas anteriores a ésta dicen `packages/api`
porque eso era cierto cuando se escribieron. **No se reescriben**: son registro histórico, y
falsificarlo para que quede prolijo es peor que la incomodidad de leer una ruta vieja. Desde acá,
`apps/api`.

**Trigger de revisión.** Si aparece un tercer servicio desplegable, entra en `apps/`. Si
`packages/` vuelve a tener algo que se despliega, esta decisión se rompió.

## D-056 — `contracts/reference/` se borra: describía otra máquina de estados que la que corre — **Aceptada** · enmienda D-017

**Contexto (2026-08-23).** Al abrir el track de contratos para cerrar el criterio 2 del SOM (≥95%
de coverage, el único criterio duro sin plan B), la primera lectura completa del subárbol encontró
que **de las 468 líneas de Aiken del repo, 353 —el 75%— viven en `contracts/reference/`, que
`aiken` no mira**: el compilador solo lee `validators/` y `lib/`. Los únicos 10 tests escritos del
proyecto están ahí adentro, y por eso `aiken check` reporta `"total": 0`.

**El hallazgo que decide.** No es material inerte: es material **contradictorio**.

| | validador activo (`validators/milestone.ak`) | `reference/` |
|---|---|---|
| estado final | `Completed` | `Certified` |
| ¿se sale del final? | no, terminal | sí: `Certified → Observed` |
| firmantes | un único `admin` | `developer` / `certifier` por acción |

`Certified` vs `Completed` es **exactamente** la inconsistencia que D-020 ya resolvió a favor de
`Completed` —porque la plataforma no certifica (D-026)— y está listada como desvío vigente. Salir
de un estado que el canon declara terminal contradice la regla 9 de `CLAUDE.md`. Los 10 tests son
tests **de esa otra FSM**: promoverlos tal cual pondría el proyecto en verde sobre la máquina
equivocada, que es el peor resultado posible —peor que 0 tests, porque 0 tests no miente.

**Decisión.** Se borra `contracts/reference/` entera. La FSM canónica es la de D-020, ya
implementada en `validators/milestone.ak`, y el trabajo de tests se escribe contra ésa.

**Por qué borrar y no dejarlo "por las dudas".** Es el caso puro del principio 1: dos fuentes de
verdad para la misma cosa (la tabla de transiciones), divergiendo en silencio. Y de la trampa del
2026-07-29 —*"un artefacto derivado contradijo al entregable y nos hizo decidir mal"*—, con el
agravante de que este artefacto no está marcado como derivado: es código plausible, formateado,
con tests que pasan, en un directorio del proyecto. La próxima sesión que abra `contracts/` sin
leer esta entrada tiene 75% de probabilidad de aterrizar en el archivo equivocado. **Un directorio
que el compilador no lee no es código: es documentación disfrazada de código, y la peor clase,
porque tiene la autoridad visual del código.**

**Qué se conserva, y dónde.** Nada de valor se pierde: lo que `reference/` aportaba eran tres ideas
de diseño, y las tres ya están escritas en prosa donde corresponde —**el thread token** en D-008
(el argumento entero de "ni nosotros podemos falsificarla después"), **los actores por rol** en
D-009 (co-firma CIP-30), **el commit de certificación** en M2-D5 (`M3-SC-05`). El código queda en
el historial de git, recuperable con
`git log --diff-filter=D --name-only -- 'contracts/reference/*'`, que da el commit que lo borró; el
anterior lo contiene. Una idea de diseño se registra como decisión, no como un `.ak` que no compila.

**Lo que este borrado NO decide.** Sigue abierto, y hay que decidirlo por separado porque **tocar
cualquiera de estas tres cambia el hash del script**:

1. **No hay thread token.** El activo exige 1 input y 1 output en la dirección del script, pero
   nada ata *cuál* UTxO es el hilo legítimo: se pueden abrir hilos paralelos en la misma dirección
   con datums inventados y la cadena acepta los dos. Hoy se mitiga off-chain guardando el
   `OutputReference` del hilo real. La propiedad on-chain que D-008 promete **no está**.
2. **Un solo `admin` firma todo**, contra los cuatro roles del dominio y la co-firma de D-009.
3. **El datum lleva `project_name` legible** (contra la regla 2: solo hashes y refs opacas) y
   `milestone_id: Int` sin mapeo definido al id de la base, que es cuid2 (contra la regla 1: UUID).

**Enmienda a D-017.** Aquella entrada metió `reference/` al repo como "material de diseño de Fase
B". El error no fue guardarlo: fue guardarlo **en el árbol del proyecto y en el mismo lenguaje que
el código activo**, sin que nada ejecutable distinguiera uno de otro. El `README.md` de la carpeta
avisaba, y no alcanzó — un README es opt-in y el archivo `.ak` es lo que se abre primero.

**Trigger de revisión.** Si Fase B entra en sprint, el state-thread se escribe de cero contra la
FSM de D-020 y con la regla 2 aplicada al datum, leyendo D-008 —no recuperando el archivo del
historial, que trae la FSM equivocada adentro.
