# specs/ — el mapa del desarrollo

Qué hay que entregar, en qué estado está, y en qué orden se construye. **Estado medido, no
estimado**: cada número de acá salió de un `grep` o de una suite, no de una impresión.

- Las **obligaciones** están en `docs/` (inmutable) y mapeadas en [`entregables.md`](entregables.md).
- Las **restricciones vigentes**, en [`../DECISIONS.md`](../DECISIONS.md).
- El **cómo se trabaja**, en [`../CLAUDE.md`](../CLAUDE.md).
- El **argumento largo** de decisiones pasadas, en [`archive/`](archive/).

## Mandato

Entregar **Milestone 3 — Core Backend, Smart-Contract Development & Integration**: el backlog
completo de `M2-D5`, corriendo de punta a punta en pre-producción pública, con anclaje real en
Preprod y verificable por cualquier tercero vía TXID.

## Alcance

| | |
|---|---|
| Red | **Preprod**, en todos los entornos (D-013) |
| Entorno | Pre-producción pública |
| Datos | Semilla + piloto con 3 participantes |
| Contratos | Escritos, testeados, desplegados en testnet |
| Custodia de valor | **Ninguna** (D-021) |

Mainnet y producción quedan fuera y no se planifican acá: requieren entorno nuevo, wallet nueva y
aprobación explícita.

## Qué controlamos y qué no

- **Controlamos:** el código, el deploy, la red Preprod (faucet libre), el alcance de cada rebanada.
- **No controlamos:** disponibilidad de Blockfrost, tiempos de confirmación, adopción de wallets
  CIP-30 por profesionales, y la **disponibilidad de los 3 pilotos** que el SOM exige.
- **Consecuencia (principio 8):** "listo" es *listo para activar* — lo que depende de terceros queda
  detrás de configuración, activable en días.
- **La relación con los pilotos ya existe desde M1:** `M1-D3-PilotPlan.pdf` trae cartas de
  conformidad de un notario y dos developers, con timeline y métricas. Hay que releerlo antes de
  planificar la validación; probablemente ya conteste parte del criterio 4. Lo nuestro es
  **recontactarlos temprano**, no en la última rebanada.

## "Listo" — los 16 criterios del SOM

| # | Criterio | Evidencia | Estado |
|---|---|---|---|
| 1 | Los contratos compilan | `aiken check` verde en CI; `plutus.json` al día | ✅ |
| — | Output 1: state machine "with... timeouts, and fallback branches" | Ninguno de los dos existe en el validador ni lo pide `docs/` (D-089): se releen como robustez del pipeline de anclaje —`Pending`/`Failed`/reconciliación/retry-anchor, todo ya construido y testeado— en vez de agregar deadline o estado de cancelación a un contrato ya hasheado | ✅ [`DECISIONS.md` D-089](../DECISIONS.md) |
| 2 | Unit tests **≥95% coverage** | **82 tests**; `aiken` no mide coverage de líneas, así que la evidencia es la tabla punto de rechazo → test de `contracts/CLAUDE.md` | ✅ |
| 3 | **≥8 stages** con signers/percentages configurables | `DEFAULT_STAGE_CATALOG` (10 etapas, `packages/shared`, captura 34C) | ✅ Sin código pendiente ([`DECISIONS.md` D-090/D-091/D-092](../DECISIONS.md)): "percentages" es el avance derivado (`completadas/total`, D-091) — ningún entregable de M2/M3 pide un peso por stage, y `progressPercentage` (que sí lo era) se borró en `M3-1.1`. "Signers" ya existe con otra forma: D-020 fija determinísticamente qué rol autoriza cada transición (D-092) — ningún entregable pide que sea configurable por proyecto. `torre-a` tiene 10 stages reales, no 8; la ruta que hubiera aceptado un campo suelto (`POST /projects/:id/stages`) se borró el 2026-09-08 (CRUD genérico sin caller, ver `apps/api/CLAUDE.md`) |
| 4 | **3 pilotos** confirman | Carta firmada | ⬜ externo |
| 5 | Endpoints documentados | OpenAPI | ✅ [`specs/openapi/propnexus.openapi.json`](openapi/propnexus.openapi.json) (OpenAPI 3.1, `pnpm --filter @plataforma/api docs:openapi`) — 85 operaciones, 26 con su schema Zod real de body/query (los 23 que hasta el 2026-09-08 vivían inline se movieron a `packages/shared` para poder introspectarlos); el resto queda con método+path+auth. `test/openapi-freshness.test.ts` lo mantiene sincronizado. **Cerrado del todo el 2026-09-09** ([`PLAN-2026-09-08-documentar-api-completa.md`](PLAN-2026-09-08-documentar-api-completa.md)): las respuestas también tienen su schema — 76/85 rutas (las 9 restantes son legítimamente sin cuerpo JSON: `204 No Content` o archivo binario). También sigue existiendo [`specs/postman/propnexus.postman_collection.json`](postman/propnexus.postman_collection.json) (85 rutas, con 7 bodies de ejemplo del camino feliz), que no reemplaza esto sino que sirve para probar a mano contra una instancia corriendo |
| 6 | Proof objects validados | El SOM pide literal "hash + timestamp + signer": `GET /evidence/:bundleId/proof/:fileHash` ahora devuelve `signerUserId`/`txid`/`timestamp` (regla 17: null hasta `Confirmed`), `test/evidence-anchor.test.ts`. Los patrones P1–P10 de M2-D4 §8.1 (UI), auditados test por test el 2026-09-10: P1 `VerificationBadge.test.tsx`, P2 `HashChip.test.tsx`, P3/P4/P5/P7/P9/P10 en `components/domain/patterns.test.tsx` (cada uno con el caso "sin TXID no hay señal de prueba"), P6 `AuditEventCard` en `components/domain/cards.test.tsx`. P8 (Dossier) no tiene componente propio para testear: compone P1+P2 a nivel dossier y por artefacto en `investor.unit.$unitId.dossier.tsx` y `notary.dossier.$dossierId.tsx` — verificado leyendo las dos rutas, ninguna dibuja el chip fuera del guard de su prop. 10/10 | ✅ |
| 7 | **Rechaza evidencia sin firmar** | Test de rechazo. Definido en D-028/D-084/D-086 | ✅ `STAGE_EVIDENCE_UNATTRIBUTED` — evidencia declarada `authoritative` sin `issuingAuthority` no completa el stage; `test/stage-transitions.test.ts` (`PATCH /stages/:id/state · evidencia en stages críticos`), con la relectura explícita del criterio 2 del SOM en el comentario del describe |
| 8 | Flujos de UI end-to-end en pre-prod | Test IDs de M2-D5 verdes + walkthrough | ✅ Cerrado el 2026-09-10 con la prueba de volumen (`specs/REPORTE-2026-09-10-prueba-de-volumen.md`): 30/30 etapas `Completed`, 180/180 eventos on-chain `Confirmed`, las 4 aristas de la FSM ejercitadas por click real en el navegador en 3 proyectos nuevos. La prueba **es** la evidencia — esta fila estaba desactualizada, no el código. El "walkthrough" grabado (video) es el criterio 13, distinto, y sigue abierto |
| 9 | Mediana **reserva → escrow < 12 min** | Telemetría + capturas | ✅ Muestra real corrida el 2026-09-11 contra Preprod: developer invita → investor acepta (`POST /investor/invitations/:id/accept`) desde el navegador, TXID verificado independiente por Koios (`tx_status`, 9 confirmaciones). `GET /audit-logs/telemetry/reservation-to-escrow` (tras reconciliar) dio **2.76 min**, sampleSize 1, contra el `< 12 min` pedido. Hallazgo del ejercicio, cerrado el mismo día: el estado quedó `Pending` en la base varios minutos después de confirmar on-chain porque nada disparó `reconciliarAnclajes()` — ni un poll en background (a propósito, D-077) ni la UI del investor lo hicieron solos; hubo que pegarle al endpoint a mano para que reconciliara. `investor.unit.$unitId.index.tsx` ahora pollea `GET /units/:id/news` cada 10s mientras quede algo `Pending` (incluso con la pestaña en background), verificado en vivo local: 9 pedidos en 35s en `Pending`, 0 en los 65s siguientes a `Confirmed` |
| 10 | Audit logs persistidos | Ledger append-only paginable (M2-D4 P6) | ✅ tabla append-only + superficie `apps/web/src/routes/developer.audit-log.tsx` (M2-D5 filas 49-50, test IDs `DEV-AUDIT-LIST-001`/`DEV-AUDIT-FILTER-002`/`DEV-AUDIT-VERIFY-001`) — esta fila estaba desactualizada, no el código |
| 11 | **Sin hallazgos P1** de seguridad | Reporte de security review | ✅ [`SECURITY-REVIEW-2026-09.md`](SECURITY-REVIEW-2026-09.md) — 3 P1 cerrados, análisis estático (Semgrep) en CI, `pnpm audit` en CI en cada corrida (job `app`, gate en crítico + reporte completo no bloqueante), 0 P1 abiertos |
| 12 | Pre-prod en **URL pública** | La URL, viva | ✅ `propnexus-web.onrender.com` + `propnexus-api.onrender.com`, las dos vivas |
| 13 | **Video walkthrough** | El video | ⬜ |
| 14 | **Runbook** deploy / rollback | [`RUNBOOK-deploy.md`](RUNBOOK-deploy.md) | ✅ Runbook cerrado. La evidencia de M5 también pide "monitoring screenshots": Sentry (errores) + OTel→Grafana Cloud (traces/métricas) + PostHog (web vitals, sin PII) instrumentados en código (`apps/api/src/instrumentation.ts`, `apps/web/src/lib/observability.ts`), **encendidas y verificadas en producción el 2026-09-08**: traces reales de `propnexus-api` confirmados en Tempo (datasource `grafanacloud-giantmountain1601-traces`), cuenta y token de Grafana Cloud creados. **Screenshot formal capturado el 2026-09-11**, en vivo contra los tres tableros de producción: [`specs/EVIDENCIA-2026-09-11-monitoring-screenshots.md`](EVIDENCIA-2026-09-11-monitoring-screenshots.md) |
| 15 | Lista de **TXIDs** de prueba | Publicada y resoluble en un explorador | ✅ **Lista formal publicada el 2026-09-11**: [`specs/EVIDENCIA-2026-09-11-lista-formal-de-txids.md`](EVIDENCIA-2026-09-11-lista-formal-de-txids.md) + [CSV](evidence/txids-prueba-de-volumen-2026-09-10.csv), las 180 TXIDs de la prueba de volumen, cada una re-verificada contra Koios el mismo día de la publicación (180/180 confirmadas, 3065–3761 confirmaciones). Antecedentes previos, ya cubiertos por esa muestra más completa: anclaje desde la instancia desplegada el 2026-09-03 (metadata `52a2aa42…f2f7aaf406`, state-thread `21bae8cb…c294970`/`b28eb6cf…36a0dbe`) y evidencia real subida vía Chrome el 2026-09-08 (`ae521653fd9ba003160a9f48a2dfc9a799ee5b3936cbe5fcb8ba6654a793bb8d`) |
| 16 | README marca carpetas públicas vs privadas | En `README.md` | ✅ |

## Estado medido (2026-09-01)

**Backend y cadena: la mitad difícil está hecha.**

| | |
|---|---|
| Contratos | validador con thread token y `mint` validado, datum alineado con M1-D2, **82 tests** |
| Anclaje | `AnchorPort` simulado y real; probado contra el `Emulator`, contra un devnet local y contra Preprod. El validador viaja por referencia (D-083) |
| API | autorización en dos capas, FSM aplicada, bundles con Merkle root, audit log, **335 tests** |
| Storage | port S3 probado contra MinIO real; el hash cubre los bytes guardados |

**Front:** SPEC-016 cierra el backlog de test IDs del investor. `DEV-RELEASE-EXECUTE-002` está
excluido del conteo (D-070, no es deuda ni backlog — nunca se implementa).

| Dimensión | Especificado | Existe | Conforme |
|---|---:|---:|---:|
| Superficies (M2-D5) | 53 | **53** | 53 — una superficie cuenta cuando TODOS sus test IDs están reclamados. Esta tabla es del 2026-09-01; el número vigente (53/53, auditado el 2026-09-03 contra el código) está en §Orden de trabajo, más abajo |
| Componentes (M2-D3) | 36 | **36** | 36 |
| Patrones de prueba (M2-D4) | 10 | 10 | 10 |
| Test IDs | **74** | 74 | 74 (100%) — medido por `pnpm testids`; `DEV-RELEASE-EXECUTE-002` excluido por D-070 |

**API contra M2-D5:** de los **64** endpoints especificados coinciden **5** exactos —
`POST /auth/login`, `GET /auth/me`, `GET /projects`, `GET /projects/:id` y
`GET /projects/:id/stages`, que entró con el rename de D-067—. Contra **M2-D6** —la guía de
arquitectura— el backend **sí** está alineado: sus seis dominios funcionales existen. M2-D6 es prosa
arquitectónica; M2-D5 es el contrato.

*(La medición anterior decía "2 de ~56": el extractor se comía los endpoints con anotaciones. Con el
parser corregido son 5 de 64.)*

## Orden de trabajo

| # | Qué | Estado |
|---|---|---|
| 1 | **Reset documental**: memoria partida, `CLAUDE.md` con el flujo, `SPEC-014` | hecho |
| 2 | **Borrado + tokens + shadcn/ui + rename D-067** | hecho |
| 3 | **Los ~12 componentes transversales** de M2-D3 | hecho — 36/36 (ver tabla de arriba) |
| 4 | **Los patrones P1–P10** de M2-D4 | **hecho** — 10/10, auditado contra el código el 2026-09-03 |
| 5+ | **Verticales**, en el orden del flujo cross-rol de M2-D1 §6: `evidencia → certificar → liberar` | **hecho** — 53/53 superficies, auditado el 2026-09-03: los 68 endpoints únicos del backlog existen en `apps/api/src/routes`, 74/74 test IDs (`DEV-RELEASE-EXECUTE-002` excluido del conteo por D-070, no deuda) |
| — | `AnchorPort` §C: reconciliación y `verify()` público ([`SPEC-013`](SPEC-013-anchorport.md)) | **hecho** — `reconciliarParaLectura` cableada en cinco routers (D-077) |
| — | **Encender el anclaje real** en la instancia desplegada ([`PLAN-2026-08-31`](PLAN-2026-08-31-anclaje-real.md)) | **hecho 2026-09-03** — primer anclaje real por metadata y por state-thread, los dos confirmados en Preprod. Ver la tabla de `CLAUDE.md` |
| — | Preprod: cuenta Blockfrost + wallet de servicio 🔴 | **hecho 2026-08-31** — wallet fondeada, clave cargada en el dashboard |

Cada vertical trae sus endpoints (con paths scopeados por rol, D-066) y sus test IDs. **El criterio
de corte de una rebanada es que la app quede corriendo y demostrable.**

## Riesgos, señal temprana y plan B

| Riesgo | Señal temprana | Plan B |
|---|---|---|
| **Los 3 pilotos no responden a tiempo** | Sin contacto al cerrar la vertical de evidencia | Escalar a los developers socios; es su compromiso elegirlos |
| **Scope creep de UI**: 53 superficies, 33 componentes | Una vertical no cierra | Cortar superficies secundarias antes que mover la fecha. **Dossier y audit log no son cortables**: son la tesis del producto |
| Blockfrost caído o limitado | 402/429 en el adaptador | El anclaje falla y el estado queda `Pending`; se reconcilia en la próxima lectura (D-077). **Caer a `ANCHOR_MODE=simulated` no es plan B**: produciría TXIDs que no existen, que es el incidente del 2026-08-27, y D-075 lo vuelve imposible por código |
| Confirmaciones lentas rompen la UX | `AnchoringSuccessModal` tarda >30s | Modal en dos tiempos: "enviado" (TXID) → "confirmado" (poll) |
| Fricción CIP-30 con profesionales | Rechazo de los pilotos | Sin alcance en el validador (D-058); si vuelve, es decisión nueva |
| La métrica de 12 minutos se descubre tarde | No hay telemetría al llegar a la vertical de invitación | Instrumentarla cuando nazca ese flujo, no después |
| El free tier duerme el servicio en una demo | Primera demo con la URL fría | El web pasa a static site (D-065) y no duerme; queda la API. Si molesta, el disparador para mirar edge |

## Registro de specs

| Spec | Título | Estado |
|---|---|---|
| [`SPEC-010`](SPEC-010-superficie-roja.md) | Endurecer la superficie 🔴 | cerrada 2026-08-21 |
| [`SPEC-012`](SPEC-012-segunda-capa-como-middleware.md) | `requireProjectAccess`: la segunda capa como middleware | cerrada 2026-08-23 · **superada por D-088** el 2026-09-04 |
| [`SPEC-013`](SPEC-013-anchorport.md) | `AnchorPort`: conectar el registro con la cadena | **cerrada** — §A, §B y §C. §C (`reconcile()` en lectura, `verify()` público, estados de la UI) cerró con D-077 (`reconciliarParaLectura` cableada en cinco routers) — este archivo lo tenía desactualizado contra §Orden de trabajo, más arriba |
| [`SPEC-014`](SPEC-014-reconstruccion-del-front.md) | Reconstrucción del front desde los entregables | **cerrada 2026-09-11** |
| [`SPEC-015`](SPEC-015-saneamiento-de-la-instrumentacion.md) | Saneamiento de la instrumentación: tests, fixtures, coverage, CI | **en curso** |
| [`SPEC-016`](SPEC-016-superficie-del-investor.md) | Superficie del investor (M2-D5 §4) | **cerrada 2026-08-28** |

Los planes fechados no llevan número: [`PLAN-2026-08-31-anclaje-real.md`](PLAN-2026-08-31-anclaje-real.md)
fue la secuencia operativa para pasar la instancia desplegada a `ANCHOR_MODE=real` (cerrada el
2026-09-03), y [`PLAN-2026-09-04-guard-unico.md`](PLAN-2026-09-04-guard-unico.md) unificó los tres guards de
autorización en uno de campos obligatorios (**cerrado el 2026-09-04**, D-088: las 87 rutas montadas
declaran su regla con `authorize`).

**La numeración no se recicla.** `SPEC-008`, `SPEC-011` y los planes anteriores están en
[`archive/`](archive/): describen trabajo cerrado o código que se borró.
