# DECISIONS.md

> **Jerarquía de precedencia — dos capas:**
>
> - **Obligaciones (el *qué*): `docs/` es ley.** Son los entregables aprobados por reviewers de Catalyst 1400106. Nada de este archivo puede reducir lo que debemos.
> - **Implementación (el *cómo*): DECISIONS.md > CLAUDE.md > specs/.**
>
> Ante contradicción, gana el de mayor precedencia y el documento en conflicto se corrige en el mismo PR en que se detecta. Reabrir una decisión **Aceptada** requiere evidencia (spike, incidente, medición), no preferencia. La numeración nunca se recicla.
>
> **`docs/` no se edita nunca.** Un error o una ambigüedad en un entregable se resuelve con una decisión acá que cite el documento y el párrafo. **Un desvío solo es legítimo si** (a) el entregable se contradice internamente, (b) es un error de redacción, o (c) seguirlo al pie contradiría una verdad del producto declarada por el dueño — **nunca por conveniencia**. Los desvíos vigentes están listados en `docs/README.md` y se comunican en la entrega. Ver D-022.
>
> **Historia:** este repo consolida la guía de implementación con el backend PoC (`cardano-real-estate-backend`). Los ADR-001..009 de ese repo quedan absorbidos acá (los vigentes, como D-016/D-017; el resto como contexto). El registro original y los snapshots del material fuente se eliminaron del árbol de trabajo en la consolidación documental de 2026-07-29; siguen disponibles en el historial de git: `git log --oneline --diff-filter=D --name-only -- 'docs/context/*'` da el commit que los borró, y el anterior los contiene.

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
| D-018 | El producto se llama **PropNexus** | Aceptada |
| D-019 | Plutus **V3**, no V2 — desvío documentado del SOM de M3 | Aceptada |
| D-020 | FSM canónica del stage — confirma el entregable original | Aceptada |
| D-021 | **La plataforma nunca custodia ni transfiere valor**, en ninguna fase | Aceptada |
| D-022 | `docs/` inmutable (entregables oficiales); el stack canónico vive en `CLAUDE.md` | Aceptada |
| D-023 | `Milestone` → `ConstructionStage` en el dominio; "milestone" reservado a Catalyst | Aceptada |
| D-024 | Sistema de diseño: Tailwind v4 + shadcn/ui con los tokens normativos de M2-D3 | Aceptada |
| D-025 | i18n es-AR/en-US: diccionarios propios, cero strings hardcodeados | Aceptada |
| D-026 | **La plataforma no certifica, no valida y no decide** — solo registra, ancla y refleja | Aceptada |
| D-027 | Taxonomía de archivos: el hash es el ticket de entrada a la cadena de prueba | Aceptada |
| D-028 | Qué significa "evidencia sin firmar" (criterio 7 del SOM) | Aceptada |
| D-029 | Alcance del dominio: stages del proyecto; la unidad es lo comercial | Aceptada |
| D-030 | Trunk-based: una sola rama `main`, sin PRs | Aceptada (enmendada por D-031) |
| D-031 | Ramas cortas por track para árboles de trabajo paralelos | Aceptada (trigger de revisión definido) |
| D-032 | El harness de agentes: la puerta es ejecutable y lo irreversible se bloquea por hook | Aceptada |

> **Repaso completo con la documentación oficial: ver §Repaso al final del archivo.** D-001..D-017 se
> escribieron sin los entregables delante; las 25 entradas se revisaron el 2026-07-29 y cada una
> tiene veredicto registrado.

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
**Reemplazo (2026-07-15).** Existe un backend funcionando con Prisma + SQLite (dev); reescribirlo costaría días sin agregar valor a la demo. Ver D-016. PostgreSQL sigue siendo el destino al desplegar (cambiar `provider` del datasource + regenerar migraciones).

## D-005 — Lucid Evolution + Blockfrost — **Default → spike**

**Contexto.** Dos libs TS maduras: Lucid Evolution y Mesh SDK. Lucid integra natural con blueprints CIP-57 de Aiken.
**Default.** Lucid Evolution + Blockfrost Preprod.
**Spike que lo refuta o confirma (≤2 días).** El walking skeleton (Sprint 1) se implementa con el default; si aparece bloqueo real (API rota, incompatibilidad de blueprint, docs muertas), se repite el skeleton con Mesh y se decide con evidencia. Al cierre del Sprint 1, esta entrada pasa a Aceptada o se reemplaza.

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
**Trigger de revisión.** Antes del primer deploy real: migrar el datasource a PostgreSQL (obligatorio, el schema ya lo prevé) y evaluar S3 (D-011). La migración de framework Express→Hono solo se reabre con evidencia (bloqueo técnico o costo de mantenimiento medido), no por preferencia.
**Reversión.** Las rutas están aisladas por recurso y la auth encapsulada en `src/lib/jwt.ts` + `src/middlewares/auth.ts`; migrar framework u ORM es incremental por recurso.

## D-017 — Contratos: adoptar el proyecto Aiken del backend en `contracts/`

**Contexto (2026-07-15).** El backend traía un proyecto Aiken real (v1.1.21, Plutus V3, stdlib v3.0.0) con el validador de milestones V1 funcionando (`milestone.ak`, y un duplicado `milestone2.ak` — ex ADR-009 Abierta). La guía traía dos validadores de referencia del diseño Fase B (`certification.ak`, `milestone_state.ak` con thread token) y la lib pura `lib/plataforma/milestone.ak`.
**Decisión.** `contracts/` parte del proyecto Aiken del backend (aiken.toml, lock y validadores V1 vigentes). Los validadores de referencia de la guía entran en `contracts/reference/` como material de diseño de Fase B (D-008), NO como código activo: no compilan necesariamente contra la versión pineada y no se despliegan.
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
**Consecuencia estructural.** `docs/` queda con tres carpetas (una por milestone) y un `README.md` de índice. Todo lo derivado que vivía ahí —guía de arquitectura, backlog, prompts, devops, snapshots de material fuente, reporte de sprint— se eliminó; lo vigente se re-derivó hacia `specs/` y estas decisiones.
**Actualización (2026-07-29, segunda pasada).** La raíz había quedado con ocho `.md`, lo que contradice el principio 1 (una sola fuente de verdad por cosa) por acumulación: dos índices del mismo trabajo, dos lugares con reglas de método. Se consolidó a **tres archivos**: `README.md` (entrada humana, arranque, entorno), `CLAUDE.md` (todo lo que un agente necesita por sesión: principios, stack, reglas, autonomía, commits, comandos, gotchas) y `DECISIONS.md`. `STACK.md`, `GUIA-COMMITS.md` y los diez principios de `PLAYBOOK.md` se absorbieron en `CLAUDE.md`; los pasos vivos de `SETUP.md` en `README.md`; `ROADMAP.md` en `specs/README.md`, que pasa a ser **el mapa de desarrollo** — un solo índice del trabajo en lugar de dos que divergen.
**Qué se perdió a propósito.** Instrucciones de acciones ya ejecutadas una sola vez (el scaffolding de `SETUP.md` contra un stack que no se usó; las fases 1-6 del playbook, ya cumplidas; la guía genérica de escalado). No son conocimiento vivo y siguen en el historial: `git log --diff-filter=D --name-only -- SETUP.md PLAYBOOK.md`.

**Enmienda (2026-07-29, tercera pasada) — precedencia en dos capas.** La formulación "docs/ está fuera de la jerarquía" quedó corta. Los entregables están **aprobados por reviewers** y no podemos decidir en contra de ellos; pero tomados al pie de la letra se contradicen entre sí y con verdades del producto. Se separa en dos autoridades:

- **`docs/` es ley sobre las obligaciones** — el *qué* y la vara de aceptación. Nada en este archivo puede reducir lo que debemos: ni el ≥95% de coverage, ni los pilotos, ni la URL pública, ni el runbook. Absoluto, sin excepción.
- **`DECISIONS.md` manda sobre la implementación** — el *cómo*, incluido dónde la letra de un entregable se interpreta en vez de seguirse literal.

**Un desvío solo es legítimo en tres casos:** (a) el entregable se contradice internamente, (b) es un error de redacción, (c) seguirlo al pie contradiría una verdad del producto declarada por el dueño. **Nunca por conveniencia ni por preferencia técnica.** Todo desvío se registra acá citando el párrafo, se lista en `docs/README.md` y **se comunica en la entrega**.

**Precedencia interna de M1.** `Instructions.txt` especifica el paquete entregado: cuatro `.puml` + un `.csv` + un `README.md`. Los **artefactos especificados** (`.puml`, `.csv`) mandan sobre el `README.md`, que es un resumen de cortesía escrito después para facilitarle la lectura a los reviewers. Resuelve la inconsistencia `Certified`/`Completed` (D-020) y aclara que las dos columnas que el README promete en la taxonomía —"authoritative" y "anchored on-chain"— nunca existieron en el CSV: son un hueco real que llenan D-027 y D-028, no una promesa incumplida que estemos pisando.

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

**El criterio de la puerta: verifica el frente que el cambio tocó, y falla si ese frente no tiene
verificación.** Así la deuda bloquea a quien la usa, no a quien la hereda: hoy tocar
`packages/api` cierra la puerta hasta que exista su script `test`.

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
| D-017 | Intacta | La consolidación `milestone.ak`/`milestone2.ak` sigue Abierta. |
| D-018..D-025 | — | Nacidas ya con la documentación completa. |

**Lo que el repaso cambió de fondo:** las tres decisiones on-chain (D-006, D-007, D-008) tenían fundamentos escritos para un producto que retenía valor y hacía cumplir reglas. El producto no es eso. La implementación de las tres sobrevive casi sin cambios — lo que se reescribió es **por qué**, que es lo que evita derivar mal en las próximas cincuenta decisiones.

**Lo que el repaso no cubre:** el modelo de datos y las specs. Las entradas siguen siendo válidas, pero `specs/` entero precede a la documentación oficial y se reescribe aparte.
