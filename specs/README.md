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
| 2 | Unit tests **≥95% coverage** | Cobertura de líneas ≥95% en **toda la app** (relectura del dueño, 2026-09-21: separar una parte es artificial) | ✅ Las cuatro partes TypeScript en 100% en las cuatro métricas: `shared` y `cardano` desde [`SPEC-017`](archive/SPEC-017-cobertura-95-en-toda-la-app.md), `apps/api` desde [`SPEC-018`](archive/SPEC-018-cobertura-de-apps-api.md) (2026-09-23), `apps/web` desde [`SPEC-019`](archive/SPEC-019-cobertura-de-apps-web.md) (2026-09-24, con CI corriendo `test:coverage` con umbral en las cuatro). Antes esta fila daba ✅ leyendo el criterio solo sobre los contratos — esta vez es sobre toda la app |
| 3 | **≥8 stages** con signers/percentages configurables | `DEFAULT_STAGE_CATALOG` (10 etapas, `packages/shared`, captura 34C) | ✅ Sin código pendiente ([`DECISIONS.md` D-090/D-091/D-092](../DECISIONS.md)): "percentages" es el avance derivado (`completadas/total`, D-091) — ningún entregable de M2/M3 pide un peso por stage, y `progressPercentage` (que sí lo era) se borró en `M3-1.1`. "Signers" ya existe con otra forma: D-020 fija determinísticamente qué rol autoriza cada transición (D-092) — ningún entregable pide que sea configurable por proyecto. `torre-a` tiene 10 stages reales, no 8; la ruta que hubiera aceptado un campo suelto (`POST /projects/:id/stages`) se borró el 2026-09-08 (CRUD genérico sin caller, ver `apps/api/CLAUDE.md`) |
| 4 | **3 pilotos** confirman | Carta firmada | ✅ Confirmado por el dueño el 2026-09-22 (recontacto de los 3 pilotos) |
| 5 | Endpoints documentados | OpenAPI | ✅ [`specs/evidencia-m3/2-api/openapi/propnexus.openapi.json`](evidencia-m3/2-api/openapi/propnexus.openapi.json) (OpenAPI 3.1, `pnpm --filter @plataforma/api docs:openapi`) — 85 operaciones, 26 con su schema Zod real de body/query (los 23 que hasta el 2026-09-08 vivían inline se movieron a `packages/shared` para poder introspectarlos); el resto queda con método+path+auth. `test/openapi-freshness.test.ts` lo mantiene sincronizado. **Cerrado del todo el 2026-09-09** ([`PLAN-2026-09-08-documentar-api-completa.md`](archive/PLAN-2026-09-08-documentar-api-completa.md)): las respuestas también tienen su schema — 76/85 rutas (las 9 restantes son legítimamente sin cuerpo JSON: `204 No Content` o archivo binario). También sigue existiendo [`specs/evidencia-m3/2-api/postman/propnexus.postman_collection.json`](evidencia-m3/2-api/postman/propnexus.postman_collection.json) (85 rutas, con 7 bodies de ejemplo del camino feliz), que no reemplaza esto sino que sirve para probar a mano contra una instancia corriendo |
| 6 | Proof objects validados | El SOM pide literal "hash + timestamp + signer": `GET /evidence/:bundleId/proof/:fileHash` ahora devuelve `signerUserId`/`txid`/`timestamp` (regla 17: null hasta `Confirmed`), `test/evidence-anchor.test.ts`. Los patrones P1–P10 de M2-D4 §8.1 (UI), auditados test por test el 2026-09-10: P1 `VerificationBadge.test.tsx`, P2 `HashChip.test.tsx`, P3/P4/P5/P7/P9/P10 en `components/domain/patterns.test.tsx` (cada uno con el caso "sin TXID no hay señal de prueba"), P6 `AuditEventCard` en `components/domain/cards.test.tsx`. P8 (Dossier) no tiene componente propio para testear: compone P1+P2 a nivel dossier y por artefacto en `investor.unit.$unitId.dossier.tsx` y `notary.dossier.$dossierId.tsx` — verificado leyendo las dos rutas, ninguna dibuja el chip fuera del guard de su prop. 10/10 | ✅ |
| 7 | **Rechaza evidencia sin firmar** | Test de rechazo. Definido en D-028/D-084/D-086 | ✅ `STAGE_EVIDENCE_UNATTRIBUTED` — evidencia declarada `authoritative` sin `issuingAuthority` no completa el stage; `test/stage-transitions.test.ts` (`PATCH /stages/:id/state · evidencia en stages críticos`), con la relectura explícita del criterio 2 del SOM en el comentario del describe |
| 8 | Flujos de UI end-to-end en pre-prod | Test IDs de M2-D5 verdes + walkthrough | ✅ Cerrado el 2026-09-10 con la prueba de volumen (`specs/REPORTE-2026-09-10-prueba-de-volumen.md`): 30/30 etapas `Completed`, 180/180 eventos on-chain `Confirmed`, las 4 aristas de la FSM ejercitadas por click real en el navegador en 3 proyectos nuevos. La prueba **es** la evidencia — esta fila estaba desactualizada, no el código. El "walkthrough" grabado (video) es el criterio 13, distinto, y sigue abierto |
| 9 | Mediana **reserva → escrow < 12 min** | Telemetría + capturas | ✅ **0.33 min sobre 6 compras reales en Preprod** (2026-09-28: las 5 de [`PLAN-2026-09-21-muestras-reserva-escrow.md`](archive/PLAN-2026-09-21-muestras-reserva-escrow.md) + la del 2026-09-11), cada TXID verificado por Koios — evidencia en [`evidencia-m3/3-preprod/reservation-to-escrow-report.md`](evidencia-m3/3-preprod/reservation-to-escrow-report.md). Esa muestra del 2026-09-11 hoy mide **0.44 min** con la fórmula de SPEC-214; el 2.76 de abajo es la fórmula vieja. Historia: muestra real corrida el 2026-09-11 contra Preprod: developer invita → investor acepta (`POST /investor/invitations/:id/accept`) desde el navegador, TXID verificado independiente por Koios (`tx_status`, 9 confirmaciones). `GET /audit-logs/telemetry/reservation-to-escrow` (tras reconciliar) dio **2.76 min**, sampleSize 1, contra el `< 12 min` pedido. Hallazgo del ejercicio, cerrado el mismo día: el estado quedó `Pending` en la base varios minutos después de confirmar on-chain porque nada disparó `reconciliarAnclajes()` — ni un poll en background (a propósito, D-077) ni la UI del investor lo hicieron solos; hubo que pegarle al endpoint a mano para que reconciliara. `investor.unit.$unitId.index.tsx` ahora pollea `GET /units/:id/news` cada 10s mientras quede algo `Pending` (incluso con la pestaña en background), verificado en vivo local: 9 pedidos en 35s en `Pending`, 0 en los 65s siguientes a `Confirmed`. **[`SPEC-214`](archive/SPEC-214-telemetria-con-blocktimestamp.md) (2026-09-18) hizo defendible ese número sin republicarlo**: el endpoint medía `updatedAt - createdAt`, que suma la latencia de cadena real MÁS el tiempo de lectura de arriba — exactamente el hueco que este mismo criterio encontró. Ahora mide `blockTimestamp - createdAt` (con `updatedAt` como respaldo declarado para filas viejas sin `blockTimestamp`, y `withBlockTimestampCount` para que `sampleSize` siga siendo interpretable). La muestra real de 2.76 min sigue siendo la evidencia citada arriba, con su fórmula vieja — no se re-corrió contra producción; **las dos lecturas miden cosas distintas y ninguna reemplaza a la otra en silencio** |
| 10 | Audit logs persistidos | Ledger append-only paginable (M2-D4 P6) | ✅ tabla append-only + superficie `apps/web/src/routes/developer.audit-log.tsx` (M2-D5 filas 49-50, test IDs `DEV-AUDIT-LIST-001`/`DEV-AUDIT-FILTER-002`/`DEV-AUDIT-VERIFY-001`) — esta fila estaba desactualizada, no el código |
| 11 | **Sin hallazgos P1** de seguridad | Reporte de security review | ✅ [`SECURITY-REVIEW-2026-09.md`](SECURITY-REVIEW-2026-09.md) — 3 P1 cerrados, análisis estático (Semgrep) en CI, `pnpm audit` en CI en cada corrida (job `app`, gate en crítico + reporte completo no bloqueante), 0 P1 abiertos |
| 12 | Pre-prod en **URL pública** | La URL, viva | ✅ `propnexus-web.onrender.com` + `propnexus-api.onrender.com`, las dos vivas |
| 13 | **Video walkthrough** | El video | ✅ Cerrado el 2026-10-01: [`evidencia-m3/3-preprod/walkthrough-video.mp4`](evidencia-m3/3-preprod/walkthrough-video.mp4), ~16 min narrado en inglés, con su `.srt` — guion en [`GUION-2026-09-21-video-walkthrough.md`](archive/GUION-2026-09-21-video-walkthrough.md) |
| 14 | **Runbook** deploy / rollback | [`RUNBOOK-deploy.md`](RUNBOOK-deploy.md) | ✅ Runbook cerrado. La evidencia de M5 también pide "monitoring screenshots": Sentry (errores) + OTel→Grafana Cloud (traces/métricas) + PostHog (web vitals, sin PII) instrumentados en código (`apps/api/src/instrumentation.ts`, `apps/web/src/lib/observability.ts`), **encendidas y verificadas en producción el 2026-09-08**: traces reales de `propnexus-api` confirmados en Tempo (datasource `grafanacloud-giantmountain1601-traces`), cuenta y token de Grafana Cloud creados. **Screenshot formal capturado el 2026-09-11**, en vivo contra los tres tableros de producción: [`specs/EVIDENCIA-2026-09-11-monitoring-screenshots.md`](EVIDENCIA-2026-09-11-monitoring-screenshots.md) |
| 15 | Lista de **TXIDs** de prueba | Publicada y resoluble en un explorador | ✅ **Lista formal publicada el 2026-09-11**: [`specs/EVIDENCIA-2026-09-11-lista-formal-de-txids.md`](EVIDENCIA-2026-09-11-lista-formal-de-txids.md) + [CSV](evidencia-m3/3-preprod/txids-volume-test-2026-09-10.csv), las 180 TXIDs de la prueba de volumen, cada una re-verificada contra Koios el mismo día de la publicación (180/180 confirmadas, 3065–3761 confirmaciones). Antecedentes previos, ya cubiertos por esa muestra más completa: anclaje desde la instancia desplegada el 2026-09-03 (metadata `52a2aa42…f2f7aaf406`, state-thread `21bae8cb…c294970`/`b28eb6cf…36a0dbe`) y evidencia real subida vía Chrome el 2026-09-08 (`ae521653fd9ba003160a9f48a2dfc9a799ee5b3936cbe5fcb8ba6654a793bb8d`) |
| 16 | README marca carpetas públicas vs privadas | En `README.md` | ✅ |

## Lo que sigue

**M3: el plan está cerrado entero; falta entregar y que Catalyst acepte.** Una sola cosa depende de
esa aceptación: **el criterio 3 se cierra por documentación** (D-090, D-091 y D-092), sin construir
signers ni percentages, por la regla de precedencia del dueño (entregables M2/M3 sobre el SOM,
2026-09-09). "Signers configurables" no existe en ningún entregable, igual que `progressPercentage`.

### Fase 1 — emprolijar la app como está

El diseño de cada ítem está en
[`AUDITORIA-2026-10-01`](AUDITORIA-2026-10-01-arquitectura-api-y-web.md) §9; el estado, acá.

| # | Qué | Estado |
|---|---|---|
| 1 | Reclamar antes de anclar (firma, rechazo y los dos anclajes de evidencia) | ✅ 2026-10-01 — `apps/api/test/reclamar-antes-de-anclar.test.ts`; en producción, dos firmas simultáneas dejaron una sola |
| 2 | El ciclo del dossier rechazado | ✅ 2026-10-01 |
| 3 | Sacar `awaitTx` de la request | ✅ 2026-10-01 — en Preprod, alta de proyecto 18,5 s y transición 4,2 s. Límite medido en `yaci.test.ts`: una instancia recién arrancada no avanza un hilo antes del bloque |
| 4 | La pasada de prosa | ✅ — §4 comentarios en `packages/` y `apps/`; `contracts/` queda como está (dueño, 2026-10-01: es mucho más simple). §6 documentación ✅ 2026-10-01: el estado en esta tabla, lo cerrado en `archive/` y cada `CLAUDE.md` recortado a trampas vigentes (2.457 → 743 líneas; la narración, en `archive/CLAUDE-subarboles-hasta-2026-10-01.md`) |
| 5 | W0: observabilidad diferida, un diccionario por idioma, decidir PostHog | ✅ 2026-10-02 — JS inicial de **249,1 → 125,8 kB gz** (build con DSN y key, como en Render). Sentry (28,6 kB) y PostHog (90,6 kB) bajan con `import()` después del render y solo si su variable existe; en-US (7,8 kB) baja solo si es el idioma guardado, y `main.tsx` lo espera antes del primer paint (visto en Chromium: ningún frame en castellano). PostHog se decide después de M3 (abajo) |
| 6 | `SPEC-603` misma región | en curso — opción B: la base copiada a Oregon (`propnexus-west`), idéntica byte a byte a producción el 2026-10-01. Falta el corte en Render; el detalle, en la spec |
| 7 | W1 = `SPEC-601` con armazón en el layout | en revisión — mergeada a `main` el 2026-10-02; falta la revisión línea por línea (🟡). `pnpm verify:all` en verde, `pnpm e2e` 100/100 y la pasada manual de §Verificación hecha en Chrome (2026-10-02): login de buyer → buy → units → favorites con un solo `/auth/me`, y en 3.599 frames el mismo header y ningún `<main>` vacío |
| 8 | `SPEC-402`, `SPEC-407`, `SPEC-408` | `402` ✅ 2026-10-02 — producción medida: cero filas fuera de forma, sin migración. `407` ✅ 2026-10-02 — el `outputRef` sale de la salida con el token. `408` ✅ 2026-10-02 — el datum pasa por `stageDatumSchema` y `verify` exige el thread token |
| 9 | `SPEC-222` PWA (rama `spec-222-pwa`) y la pasada manual de `SPEC-112` | sin empezar — después de 5 y 7, y la rama se mergea recién después de entregar M3 (dueño, 2026-09-30: revertir el commit no desinstala un service worker) |
| 10 | [`SPEC-610`](SPEC-610-menos-viajes-a-la-base-por-request.md) menos viajes a la base por request, sin cambiar la API: `GET /stages/:id` hace 7 en serie y un `PATCH` 6, porque Kysely serializa todas las consultas del proceso | en revisión — pasos 0–7 ✅ 2026-10-02: `GET /stages/:id` 7 → 2, `PATCH /stages/:id` 6 → 2, `GET /projects/:id` 5 → 2, `GET /projects/:id/stages` 5 → 2, y dos requests simultáneas ya no se turnan. `pnpm verify:all` y `pnpm e2e` 100/100. Falta la revisión línea por línea (🟡) y medir en producción (§Verificación) · 🟡 |

### Fuera de alcance de M3

| Qué | Por qué |
|---|---|
| **Mainnet** | Decisión del dueño, 2026-09-09. D-013 lo hace imposible por configuración y `specs/README.md` ya lo declara fuera |
| **Fusionar anclaje + transición** | Ahorra ~5% del costo on-chain; es 🟡 sobre el core de anclaje. Después de la prueba de volumen, que da la distribución real. Detalle en `specs/PROPUESTA-2026-09-09-fusionar-anclaje-evidencia-transicion.md` |
| **`TOPE_POR_LECTURA`** | Medir una carga real antes de tocar el número. El disparador por lectura ya se arregló (2026-09-09) |
| **"Contenido en `Pending`"** | Mejora de UX, ningún criterio la pide. Necesita que el listado de stages devuelva el anclaje y reconcilie |
| **Columna `AuditLog.projectId`** | Sacaría el mapeo fail-closed de `auditScope`. Pide backfill que para filas viejas no tiene respuesta |
| **`validationCritical` siempre `true`** | Config muerta con rama viva y testeada en el validador. No molesta |
| **Upload directo del navegador a R2 (sin pasar por Render)** | Hoy el archivo hace escala en `UPLOAD_DIR` (Multer a disco, en streaming) antes de llegar al bucket. **Ojo: el argumento de RAM que figuraba acá no aplica a Multer** — con `diskStorage` el body no pasa por memoria (`SPEC-218` §Los hallazgos); lo que pesa es disco efímero y latencia. Un presigned URL lo evitaría, pero es un cambio de forma real (CORS, flujo de 3 pasos en el front) y el hash sigue teniendo que releerse desde R2 igual (D-027). **Después de mainnet** — el diseño y el costo, en [`specs/archive/CLAUDE-argumentos-de-las-reglas-2026-09-20.md`](archive/CLAUDE-argumentos-de-las-reglas-2026-09-20.md) §Anexo |
| **Si PostHog sigue** | Hoy solo mide web vitals, que Sentry también mide, y pesa 90,6 kB gz (ya diferido, fuera del JS inicial). No se saca antes de que Catalyst acepte M3: la evidencia del criterio 14 lo muestra en vivo (dueño, 2026-10-02) |
| **La espera al crear un proyecto** | Medido el 2026-10-01 en Preprod, ya sin `awaitTx`: 18,5 s para los 10 mints. Decidir si hace falta UI de espera |
| **"Evidence by stage" del investor no abre una etapa en curso** | El chip solo se activa con el `txid` de la transición a `Completed` (`StageChips.tsx:34`, `investor.routes.ts:271`): una etapa `InProgress` con su paquete de evidencia ya anclado queda deshabilitada. Visto grabando T17, que salió del video (2026-10-01). Hay que decidir si el chip se activa con el anclaje de la evidencia |
| **El "Certify" de la cola del certifier solo abre la etapa** | En "Assigned" y en el panel, el botón de cada etapa dice "Certify" pero navega a `/certifier/stage/:id` (`AssignedStagesQueue.tsx:60`); el que certifica de verdad está abajo de esa pantalla, al lado de "Observe". Confunde justo antes de una acción irrepetible. Visto grabando T18 (2026-10-01) |

### Antes de mainnet

**Ninguna de estas bloquea la entrega de M3 — ninguna toca los 16 criterios del SOM, y por eso están
acá y no en la lista de trabajo.** Pero tampoco son "para siempre después": son las decisiones que
hay que tomar (con plata, tiempo o riesgo de por medio) antes de habilitar `CARDANO_NETWORK=Mainnet`,
y hoy vivían dispersas entre `DECISIONS.md`, `specs/README.md` y los `CLAUDE.md` de cada subárbol.
Esta tabla es el punto de partida cuando llegue el momento — no hay que releer las cuatro auditorías
del 2026-09-11 de nuevo.

| # | Qué | Por qué espera | Detalle |
|---|---|---|---|
| 1 | Habilitar la red: runbook + `CARDANO_NETWORK=Mainnet` | D-013 lo hace imposible **por configuración** hoy — no es solo procedimiento, es código | D-013 |
| 2 | Custodia y rotabilidad de la clave del `admin` | Es un parámetro del script Aiken, así que es irreemplazable por construcción: perderla o comprometerla congela todos los hilos vivos para siempre. Elegir entre dejarlo así, un multisig M-de-N o un segundo VKH de recuperación — las dos últimas cambian el script hash | D-093, `specs/SPEC-304-la-clave-del-admin-no-se-puede-rotar.md` |
| 3 | Unicidad del hilo on-chain + tope de `evidence_root` | El validador solo garantiza un token **por transacción**, no por stage (`SPEC-301` ya cerró el camino alcanzable desde el backend; esto es cerrarlo en el validador mismo), y acepta un `evidence_root` de largo arbitrario en stages no críticos. Cambia dirección y policy id de los 180 eventos ya anclados en Preprod — es la única de esta tabla que cambia el script hash | `specs/SPEC-305-el-proximo-cambio-de-script-hash.md` |
| 7 | Las 2 ADA bloqueadas por etapa (20 por proyecto de 10 etapas) | Sin burn (D-057) son permanentes — no es un bug, es el número real con el que hay que decidir si el costo por proyecto es aceptable en mainnet | D-057, `specs/REPORTE-2026-09-10-prueba-de-volumen.md` |
| 8 | **Idea:** Koios en vez de Blockfrost, o como segunda fuente | Hoy dependemos de una sola empresa (D-005). Koios es comunitario, no pide key, y cualquiera puede verificar un TXID contra la misma fuente que usamos (el 2026-10-01 confirmó dos tx de Preprod que Blockfrost ya había confirmado). Lucid ya trae el provider; Blockfrost está atado solo en `factory.ts` y en el `fetch` de `confirmedAt`. **Sin medir:** que el provider de Koios evalúe bien Plutus V3. Primer paso: `yaci.test.ts` con ese provider. Paso intermedio más barato: Koios solo como respaldo de `confirmedAt` | D-005 |

Los ítems 4–6 de esta lista (`SPEC-402`, `SPEC-407`, `SPEC-408`) se adelantaron a la Fase 1, ítem 8.

**Por qué junta specs de auditorías distintas.** Los ítems 2 y 3 salen de
`AUDITORIA-2026-09-11-calidad-de-contracts.md`; los ítems 4, 5 y 6, de
`AUDITORIA-2026-09-11-calidad-de-packages.md`. No comparten numeración porque nacieron de auditorías
separadas, pero comparten la misma restricción: todas piden una decisión del dueño que no tiene
sentido apurar para cerrar M3. El resto de las dos series (`SPEC-301`–`SPEC-303`, `SPEC-306`, y todo
lo que no está en esta tabla de `SPEC-401`…`SPEC-412`) ya está resuelto o es pulido sin fecha —
`specs/README.md` lleva el estado real de cada una.

## Orden de trabajo

| # | Qué | Estado |
|---|---|---|
| 1 | **Reset documental**: memoria partida, `CLAUDE.md` con el flujo, `SPEC-014` | hecho |
| 2 | **Borrado + tokens + shadcn/ui + rename D-067** | hecho |
| 3 | **Los ~12 componentes transversales** de M2-D3 | hecho — 36/36 (ver tabla de arriba) |
| 4 | **Los patrones P1–P10** de M2-D4 | **hecho** — 10/10, auditado contra el código el 2026-09-03 |
| 5+ | **Verticales**, en el orden del flujo cross-rol de M2-D1 §6: `evidencia → certificar → liberar` | **hecho** — 53/53 superficies, auditado el 2026-09-03: los 68 endpoints únicos del backlog existen en `apps/api/src/routes`, 74/74 test IDs (`DEV-RELEASE-EXECUTE-002` excluido del conteo por D-070, no deuda) |
| — | `AnchorPort` §C: reconciliación y `verify()` público ([`SPEC-013`](archive/SPEC-013-anchorport.md)) | **hecho** — `reconciliarParaLectura` cableada en cinco routers (D-077) |
| — | **Encender el anclaje real** en la instancia desplegada ([`PLAN-2026-08-31`](archive/PLAN-2026-08-31-anclaje-real.md)) | **hecho 2026-09-03** — primer anclaje real por metadata y por state-thread, los dos confirmados en Preprod. Ver la tabla de `CLAUDE.md` |
| — | Preprod: cuenta Blockfrost + wallet de servicio 🔴 | **hecho 2026-08-31** — wallet fondeada, clave cargada en el dashboard |

Cada vertical trae sus endpoints (con paths scopeados por rol, D-066) y sus test IDs. **El criterio
de corte de una rebanada es que la app quede corriendo y demostrable.**

## Registro de specs

Las specs cerradas viven en [`archive/`](archive/); su fila queda acá como índice. En `specs/` quedan solo las abiertas, las postergadas y los documentos de trabajo de los que sale la evidencia.

| Spec | Título | Estado |
|---|---|---|
| [`SPEC-010`](archive/SPEC-010-superficie-roja.md) | Endurecer la superficie 🔴 | cerrada 2026-08-21 |
| [`SPEC-012`](archive/SPEC-012-segunda-capa-como-middleware.md) | `requireProjectAccess`: la segunda capa como middleware | cerrada 2026-08-23 · **superada por D-088** el 2026-09-04 |
| [`SPEC-013`](archive/SPEC-013-anchorport.md) | `AnchorPort`: conectar el registro con la cadena | **cerrada** — §A, §B y §C. §C (`reconcile()` en lectura, `verify()` público, estados de la UI) cerró con D-077 (`reconciliarParaLectura` cableada en cinco routers) — este archivo lo tenía desactualizado contra §Orden de trabajo, más arriba |
| [`SPEC-014`](archive/SPEC-014-reconstruccion-del-front.md) | Reconstrucción del front desde los entregables | **cerrada 2026-09-11** |
| [`SPEC-015`](archive/SPEC-015-saneamiento-de-la-instrumentacion.md) | Saneamiento de la instrumentación: tests, fixtures, coverage, CI | **cerrada 2026-09-11** — los 7 cambios. El 6 cerró **reformulado**: se parte por concern, no por conteo de líneas (§El ítem 6) |
| [`SPEC-016`](archive/SPEC-016-superficie-del-investor.md) | Superficie del investor (M2-D5 §4) | **cerrada 2026-08-28** |
| [`SPEC-017`](archive/SPEC-017-cobertura-95-en-toda-la-app.md) | 95% de cobertura con unit tests, en toda la app (criterio 2) | **cerrada 2026-09-22, partida en SPEC-018 y SPEC-019** — shared, cardano y contratos cerrados; la API, sobre el 95% de líneas |
| [`SPEC-018`](archive/SPEC-018-cobertura-de-apps-api.md) | Cobertura de `apps/api`: branches ≥95%, el resto ≥98% | **cerrada 2026-09-23** — vara más estricta que el criterio 2, pedida por el dueño. Los seis lotes (A1-A6) más tres `catch` de logging que ninguna tabla de lote traía: las cuatro métricas quedaron en **100%** (branches 839/839). Umbrales de `vitest.config.mts` subidos a 99/99/99/99 |
| [`SPEC-019`](archive/SPEC-019-cobertura-de-apps-web.md) | Cobertura de `apps/web`: las cuatro métricas ≥95%, más CI y evidencia | **cerrada 2026-09-24** — las cuatro métricas en 100% (W1–W9), umbrales del `vitest.config.ts` en 100/100/100/100, `test:coverage` de la raíz corre las cuatro partes TypeScript y CI también. El criterio 2 del SOM cierra ✅ |

**Las specs de Milestone 4 se numeran aparte, en `5xx`, y no cuentan entre las abiertas de
arriba porque todavía no son mandato — M3 no está entregado.** Nacen de leer el SOM de M4 contra el
código (`ESTADO-2026-09-22-catalyst-milestone-4.md`), no de una auditoría del código existente:
`SPEC-501` (panel de métricas del piloto), `SPEC-502` (registro de disputas), `SPEC-503` (encuesta
NPS) y `SPEC-504` (completitud de documentación) — las cuatro **sin empezar**, escritas para tener
el terreno mapeado antes de que M4 se vuelva el mandato activo.

**La serie `6xx` es el refactor estructural post-M3**, y por la misma razón tampoco cuenta entre las
abiertas. Nace de una revisión de arquitectura de `apps/web` y `apps/api` hecha el 2026-09-30,
medida contra producción:
[`PROPUESTA-2026-09-30-refactor-post-m3.md`](PROPUESTA-2026-09-30-refactor-post-m3.md). **A pedido
del dueño, reabre tres decisiones que resultaron ser una sola** (§Decisiones reabiertas de la
propuesta): la invariante 3 de `SPEC-212` (guards en Express) → `607`; partir los routers grandes
por concepto, que `SPEC-015` §6 ya pedía y el costo de Express frenaba → `608`; y el cliente oRPC que
`SPEC-111` descartó → `609`. Las tres se apoyan en experimentos descartables sobre oRPC 1.15.2,
hechos el mismo día.

| Spec | Título | Estado |
|---|---|---|
| [`SPEC-601`](SPEC-601-el-guard-de-rol-vive-en-el-router.md) | El guard de rol vive en el router: `beforeLoad` por prefijo y `me` cacheado. Se van 40 `useRoleGuard` y 63 `enabled: ready` | en revisión (ver Fase 1, ítem 7) · 🟡 |
| [`SPEC-602`](SPEC-602-los-datos-arrancan-con-la-ruta.md) | Loaders que precargan (`prefetchQuery`, sin `await`) y `staleTime` por defecto, sin tocar los estados de carga de `SPEC-110` | sin empezar · 🟢 · depende de `601` |
| [`SPEC-603`](SPEC-603-la-api-y-la-base-en-la-misma-region.md) | La API (Oregon) y Turso (us-east-1) en la misma región: cada viaje a la base cuesta ~90–120 ms medidos | en curso · 🟡 · opción B, falta el corte |
| [`SPEC-604`](SPEC-604-la-capa-de-datos-sale-de-los-routers.md) | Las lecturas repetidas salen de los routers (`Stage`: 20 queries en 10 routers) | sin empezar · 🟢 · con la primera feature que las necesite |
| [`SPEC-605`](SPEC-605-la-cadena-fuera-del-camino-de-la-request.md) | Anclar y reconciliar fuera de la request (outbox + worker) | **condicional**: contradice D-077; tiene disparadores escritos |
| [`SPEC-606`](SPEC-606-la-sesion-por-pestana.md) | La sesión: por pestaña, legible por JS, y un logout que el servidor no se entera | **condicional**: decisión del dueño |
| [`SPEC-607`](SPEC-607-una-sola-capa-de-api.md) | Una sola capa de API: el contrato en `shared` y los guards como `meta` del procedimiento, con la `MATRIZ` de `route-guards.test.ts` intacta. Express queda como carcasa | sin empezar · 🟡 · reabre `SPEC-212` inv. 3 · pide D-NNN · Paso 0 con piloto `notary` |
| [`SPEC-608`](SPEC-608-los-archivos-por-concepto.md) | Los archivos de la API por concepto, no por prefijo (`investor.routes.ts` mezcla 6 conceptos) | sin empezar · 🟢 · depende de `607` |
| [`SPEC-609`](SPEC-609-el-cliente-sale-del-contrato.md) | El cliente de la web sale del contrato: `OpenAPILink` + contrato minificado + `Serialized`, con `port.ts` como fachada (324 `spyOn` intactos) | sin empezar · 🟢 · depende de `607` · reabre `SPEC-111` |
| [`SPEC-610`](SPEC-610-menos-viajes-a-la-base-por-request.md) | Menos viajes a la base por request: la autorización en una consulta, `User` en paralelo, `batch` para mutación + audit. Sin cambiar la API | en curso (ver Fase 1, ítem 10) · 🟡 |

**El orden de la serie `6xx` lo reemplaza [`AUDITORIA-2026-10-01-arquitectura-api-y-web.md`](AUDITORIA-2026-10-01-arquitectura-api-y-web.md)
§9** (dueño, 2026-10-01): una Fase 1 que emprolija la app como está (`601` con armazón en el layout,
`603`, `402` adelantada, `407`/`408`, los bugs de su §1 y el ciclo del dossier rechazado) y una Fase 2
que migra `apps/api` y `apps/web` módulo por módulo, con `dossier` de piloto. `602`, `604`, `607`,
`608` y `609` salen de la Fase 1: lo que hacen lo hace la migración. **Deuda anotada para W3/W4**
(dueño, 2026-10-02): 27 de las 33 rutas con datos dibujan una consulta fallida como su estado vacío;
ninguna pantalla termina su migración sin `error`. La lista, en la auditoría §9 Fase 2.

Los planes fechados no llevan número: [`PLAN-2026-08-31-anclaje-real.md`](archive/PLAN-2026-08-31-anclaje-real.md)
fue la secuencia operativa para pasar la instancia desplegada a `ANCHOR_MODE=real` (cerrada el
2026-09-03), y [`PLAN-2026-09-04-guard-unico.md`](archive/PLAN-2026-09-04-guard-unico.md) unificó los tres guards de
autorización en uno de campos obligatorios (**cerrado el 2026-09-04**, D-088: las 87 rutas montadas
declaran su regla con `authorize`).

**La numeración no se recicla.** `SPEC-008`, `SPEC-011` y los planes anteriores están en
[`archive/`](archive/): describen trabajo cerrado o código que se borró.

### Las cuatro series de pulido — abiertas el 2026-09-11

Salen de las cuatro auditorías del 2026-09-11 y **se numeran aparte a propósito**: la serie **1xx** es
[`AUDITORIA-…-calidad-del-frente.md`](archive/AUDITORIA-2026-09-11-calidad-del-frente.md), la **2xx** es
[`AUDITORIA-…-calidad-del-backend.md`](archive/AUDITORIA-2026-09-11-calidad-del-backend.md), la **3xx** es
[`AUDITORIA-…-calidad-de-contracts.md`](archive/AUDITORIA-2026-09-11-calidad-de-contracts.md) y la **4xx** es
[`AUDITORIA-…-calidad-de-packages.md`](archive/AUDITORIA-2026-09-11-calidad-de-packages.md), una spec por
hallazgo salvo donde partirlos habría sido artificial. **Cada una es independiente y se puede tomar
sola**; las dependencias, donde existen, están escritas en la spec.

**Nada de esto bloquea el Milestone 3**: ninguna toca los 16 criterios del SOM. Las excepciones en
importancia fueron tres, y las tres están **cerradas**. `SPEC-201` y `SPEC-202` no eran pulido sino
corrupción de datos reproducida —repararlas después habría sido SQL a mano contra producción, como
las migraciones 0004 y 0005— y `SPEC-301` tampoco: `contracts/CLAUDE.md` afirmaba una garantía que
el validador no daba (un thread token por stage), y el backend tenía un camino construido para
acuñar dos. La parte urgente de `SPEC-301` se cerró sin tocar el script; la de fondo —el validador
mismo— sigue siendo `SPEC-305`, decisión de mainnet.

**Tres estados.** **Cerrada**: hecha y verificada. **Postergada**: decidida a propósito, con su razón escrita en la fila, y todavía no hecha o no del todo verificada — no es trabajo olvidado ni pendiente de la próxima tanda. **Abierta**: lista para tomarse ahora. Hoy hay **una abierta** (`112`, a la que solo le queda la pasada manual con VoiceOver) y **dos postergadas**: `304` y `305` esperan a mainnet (§Antes de mainnet, arriba). `402`, `407` y `408` se adelantaron a la Fase 1, ítem 8. `219` se cerró el 2026-09-21: el Paso 0 midió cero duplicados en producción y no hizo falta postergar nada. `104` se cerró el 2026-09-22: tenía código y tests automatizados hechos desde el 2026-09-19, y lo único pendiente —la pasada manual con VoiceOver— se separó a [`SPEC-112`](SPEC-112-pasada-de-accesibilidad-con-voiceover.md), que la hereda y la amplía a accesibilidad en general. `112` nace **abierta**, sin fecha: no cuenta como postergada porque nunca tuvo una condición previa que esperar, solo disponibilidad, y no está tomada porque nadie la empezó todavía.

| Spec | Título | Hallazgo | Estado |
|---|---|---|---|
| [`SPEC-101`](archive/SPEC-101-escala-de-iconos-y-su-guardia.md) | La escala de íconos vuelve a la de M2-D3, y esta vez con guardia | F-01 | **cerrada 2026-09-18** |
| [`SPEC-102`](archive/SPEC-102-dialog-adaptado.md) | `ui/dialog.tsx`: adaptar el primitivo de los 11 modales | F-02 | **cerrada 2026-09-18** |
| [`SPEC-103`](archive/SPEC-103-el-armazon-que-no-anuncia.md) | El armazón no anuncia dónde estás: `lang`, `title`, `aria-current`, el contador | F-04·05·06·07 | **cerrada 2026-09-18** |
| [`SPEC-104`](archive/SPEC-104-live-regions.md) | Anunciar lo que cambia: las live regions que la app no tiene | F-03 | **cerrada 2026-09-22** — código y tests automatizados hechos desde 2026-09-19; la pasada manual con VoiceOver que le quedaba se separó a `SPEC-112`, que no es la misma spec (accesibilidad en general, no solo live regions) |
| [`SPEC-105`](archive/SPEC-105-controles-que-no-son-controles.md) | Tres cosas que son controles y no se comportan como tales | F-08·09·12 | **cerrada 2026-09-19** |
| [`SPEC-106`](archive/SPEC-106-el-pill-estirado-y-el-fondo-de-la-cola.md) | El pill estirado y el fondo de la cola del escribano | F-10·11 | **cerrada 2026-09-19** — verificado contra las 10 apariciones de `StatusPill`, no solo las 5 nombradas |
| [`SPEC-107`](archive/SPEC-107-claves-de-traduccion-tipadas.md) | Los 23 `as never` que apagan el chequeo del diccionario | F-14 | **cerrada 2026-09-19** — 21 sin cast (unión ya existía), 2 con `tDinamico` explícito |
| [`SPEC-108`](archive/SPEC-108-higiene-de-componentes.md) | Higiene: el shell de card repetido, el hook disfrazado, la prop que se ignora | F-15·16·17 | **cerrada 2026-09-19** |
| [`SPEC-109`](archive/SPEC-109-tipos-de-respuesta-desde-shared.md) | `api/types.ts`: cerrar la garantía de "drift imposible" | F-13 | **cerrada 2026-09-19** 🟡 — encontró un bug real (avance 0% en `/developer/project/:id`) verificado con Claude en Chrome |
| [`SPEC-110`](archive/SPEC-110-estado-de-carga.md) | 30 de 42 rutas muestran el empty-state mientras cargan | F-18 | **cerrada 2026-09-19** — 24 sitios reales (20 rutas + 2 componentes compartidos no nombrados por la auditoría + 2 con isPending mal apuntado), verificado con Claude en Chrome |
| [`SPEC-111`](archive/SPEC-111-callsites-de-apps-web-al-cliente-orpc.md) | `ApiPort` contra el contrato: cuerpos tipados desde `shared` y un test que impide el drift | anexo (nace de `SPEC-212`) | **cerrada 2026-09-20** — reescrita tras medir: cliente oRPC (B) y tipos desde el OpenAPI (C) descartados; el test encontró un bug real (`downloadEvidence` sin `API_BASE`) · **la opción B se reabre en [`SPEC-609`](SPEC-609-el-cliente-sale-del-contrato.md)** (2026-09-30), con las tres objeciones contrastadas |
| [`SPEC-112`](SPEC-112-pasada-de-accesibilidad-con-voiceover.md) | Accesibilidad: las tres capas automatizadas (Biome `a11y`, Vitest+`axe-core`, Playwright+`@axe-core/playwright`) + la pasada manual con VoiceOver | anexo (nace de separar `SPEC-104`) | **abierta** — capas 1-3 **hechas el 2026-09-28** (`test:a11y` + `e2e/a11y.spec.ts`, las dos probadas en rojo con una mutación) y **en verde con el registro de hallazgos vacío**: lo que encontraron salió a `SPEC-113` y `SPEC-114`, que cerraron el mismo día. La capa 4 (VoiceOver automatizado con Guidepup) se intentó el mismo día y **se descartó como limitación de la máquina** (decisión del dueño): macOS 15 pide Acceso total al disco para el último paso. **Queda solo la pasada manual con VoiceOver**, con el checklist de su §5 |
| [`SPEC-113`](archive/SPEC-113-el-contraste-de-los-tokens-de-m2-d3.md) | El contraste de los tokens de M2-D3 no llega a la vara que M2-D3 mismo fija | anexo (nace de `SPEC-112` §3) | **cerrada 2026-09-28** — decisión del dueño, **D-098**: seis tokens de color (los tres de los pills, `text-muted`, `people`, `danger`) oscurecidos lo mínimo para pasar 4.5:1 en todos sus fondos reales; rellenos `-light` intactos. `styles.test.ts` recalcula los contrastes. Verificado con axe en el navegador, 10/10 |
| [`SPEC-114`](archive/SPEC-114-nombres-encabezados-y-landmarks.md) | Lo que un lector de pantalla no puede nombrar ni ubicar | anexo (nace de `SPEC-112` §2-3) | **cerrada 2026-09-28** — los seis, más una séptima barra de progreso sin nombre en `/developer/progress` que apareció al borrar su fila del registro. El favorito sin etiqueta ahora no compila |
| [`SPEC-201`](archive/SPEC-201-aceptar-invitacion-atomico.md) | Aceptar una invitación deja de poder sacarle la unidad a quien ya la compró | B-01 | **cerrada 2026-09-18** |
| [`SPEC-202`](archive/SPEC-202-un-dossier-por-unidad.md) | Una unidad, un dossier: el índice único que falta | B-02 | **cerrada 2026-09-18** 🟡 |
| [`SPEC-203`](archive/SPEC-203-migraciones-atomicas.md) | Una migración que se corta a la mitad tiene que poder volver | B-03 | **cerrada 2026-09-18** 🟡 |
| [`SPEC-204`](archive/SPEC-204-openapi-url-y-descripcion.md) | El OpenAPI publicado apunta a una URL que no existe | B-04 | **cerrada 2026-09-18** |
| [`SPEC-205`](archive/SPEC-205-dos-invariantes-que-hoy-sostiene-el-cliente.md) | Dos invariantes que hoy sostiene la buena fe del cliente | B-05·07 | **cerrada 2026-09-19** — las dos carreras reproducidas en rojo antes del fix |
| [`SPEC-206`](archive/SPEC-206-un-solo-anclaje-por-commitment.md) | El anclaje por commitment está escrito dos veces, y ya divergieron | B-08 | **cerrada 2026-09-18** 🟡 |
| [`SPEC-207`](archive/SPEC-207-audit-log-tipado.md) | El audit log se escribe con strings sueltos y se filtra con un mapeo cerrado | B-09 | **cerrada 2026-09-18** |
| [`SPEC-208`](archive/SPEC-208-tipos-que-dicen-la-verdad.md) | Que los tipos de `apps/api` digan la verdad | B-12·10 | **cerrada 2026-09-19** — de paso, un bug latente en `notary.routes.ts` (cursor comparado contra `Date` sobre columna ahora `number`) |
| [`SPEC-209`](archive/SPEC-209-dos-queries-que-la-base-puede-hacer.md) | Dos cosas que hoy hace el proceso y puede hacer la base | B-13·14 | **cerrada 2026-09-18** |
| [`SPEC-210`](archive/SPEC-210-borrar-evidencia-anclada.md) | Borrar evidencia anclada corta el vínculo y devuelve el error equivocado | B-15 | **cerrada 2026-09-18** |
| [`SPEC-211`](archive/SPEC-211-limite-de-tasa-en-la-ruta-publica.md) | La otra ruta sin sesión no tiene límite de tasa | B-11 | **cerrada 2026-09-18** 🟡 |
| [`SPEC-212`](archive/SPEC-212-contrato-en-la-firma-de-la-ruta.md) | El contrato en la firma de la ruta, con oRPC (D-066) — §A notary, §B certifier, §C investor, §D developer | B-06 | **cerrada 2026-09-20 — las cuatro sub-partes**: 45 de las 46 rutas de D-066 son procedimientos oRPC 1.15.2, con cliente tipado probado contra el servidor real y el interceptor de Sentry implementado. **La 46 (`POST …/stages/:stageId/evidence`, multipart) queda con Multer a propósito y pasa a [`SPEC-218`](archive/SPEC-218-subida-de-evidencia-por-lote.md)**, que la endurece. Su validación de texto ya corre por `call()` de oRPC (mismo 400 que las otras 45) · **su invariante 3 (guards en Express) se reabre en [`SPEC-607`](SPEC-607-una-sola-capa-de-api.md)** (2026-09-30) |
| [`SPEC-213`](archive/SPEC-213-un-bundle-por-stage.md) | `EvidenceBundle` duplicado por stage: medir antes de decidir | anexo | **cerrada 2026-09-19** 🟡 — invariante corregida en el camino: no "máximo un bundle", sino `UNIQUE(stageId, commitmentHash)` + `ultimoBundlePorStage` en los 3 leftJoin |
| [`SPEC-214`](archive/SPEC-214-telemetria-con-blocktimestamp.md) | La telemetría del criterio 9 mide lo que tardó alguien en volver a leer | anexo | **cerrada 2026-09-18** |
| [`SPEC-215`](archive/SPEC-215-seed-idempotente.md) | `pnpm db:seed` revienta sobre una base ya sembrada | anexo | **cerrada 2026-09-18** |
| [`SPEC-216`](archive/SPEC-216-orpc-en-los-11-routers-restantes.md) | Extender oRPC a los routers cross-cutting/admin: 38 rutas mecánicas | anexo (nace de `SPEC-212`) | **cerrada 2026-09-20 — las 38 rutas migradas.** Cuatro commits: §E1 (`profile`+`notifications`) + §E2 (`auth`+`public`); §E3 (`audit`+`contracts`) + §E5 (`stages`); §E6 (`projects`+`projects-obra`) + §E7 (`evidence`, 7 de 8; la 8ª cerró con `SPEC-217`) — agrupadas porque ninguna toca superficie 🔴, sin romper el aislamiento que la spec pide para §E4; y §E4 sola (`users`, 🔴 bcrypt), última y aparte, como pedía la spec. Mismo patrón que `SPEC-212` §A-§D en las seis: cliente tipado probado contra el servidor real (`test/orpc-client-*.test.ts`, uno por archivo migrado), `REQUEST_SCHEMAS`/`RESPONSE_SCHEMAS` sin ninguna de las entradas de los 11 routers. `auth.routes.ts` es el primer router con un contexto mixto (`AuthContext` con `user` opcional) — tipa con un solo `$context`. `stages.routes.ts` concentra cinco `.errors()` con nombre y `contracts.routes.ts` es la primera vez que se migra una ruta con la regla disyuntiva `{ alguna: [...] }` delante — `authorize` la resuelve en Express antes de que oRPC vea la request. `projects.routes.ts` envuelve tres inserciones contra restricciones únicas/FK en `relanzarRestriccionComoOrpc` (dos sin test hoy); `projects-obra.routes.ts` traduce los cuatro códigos de `retryStageMint` a errores con nombre; `evidence.routes.ts` repite el 200/201 idempotente de `POST /:id/anchor` y declara `EVIDENCE_ANCHORED` — `GET /:id/download` se queda con Express llano, es `SPEC-217`. Dos tests de `auth.test.ts` se actualizaron para el nuevo shape de error (`ORPCError.toJSON()`, no `error.flatten()`) — el mismo cambio que ya habían aceptado las 45 rutas de `SPEC-212`. Auditadas las 39 rutas de los 11 routers una por una; 38 repiten patrones ya probados en `SPEC-212` §A-§D sin nada nuevo. La única excepción, `GET /evidence/:id/download`, se separó a `SPEC-217` |
| [`SPEC-217`](archive/SPEC-217-el-streaming-de-download-necesita-su-propia-investigacion.md) | `GET /evidence/:id/download`: streaming real con oRPC | anexo (nace de `SPEC-216`) | **cerrada 2026-09-20 — implementada.** `downloadEvidenceProcedure` (`evidence.routes.ts`) devuelve `Readable.toWeb(storage.read(...))` con `outputStructure: "detailed"` y los headers del registro; `evidence` queda con las 8 rutas en oRPC. Test de bytes contra archivos reales en disco (6 MB, primer chunk antes del fin) y del error a mitad de stream en `test/spec-217-download-streaming.test.ts`. Un `ReadableStream` web como output, con `outputStructure: "detailed"`, pasa sin bufferear por las tres capas de oRPC (codec → adaptador Node → `sendStandardResponse`) — confirmado leyendo el código fuente de las tres y con un smoke test de 5MB, bytes idénticos. De paso cierra un defecto latente: el `.pipe(res)` de hoy no maneja `'error'` a mitad de stream, el de oRPC sí |
| [`SPEC-218`](archive/SPEC-218-subida-de-evidencia-por-lote.md) | La subida de evidencia por lote, validada en los dos lados | anexo (nace del cierre de `SPEC-212`) | **cerrada 2026-09-20** 🟡 — subida por lote (tope 10) validada en front y back con las mismas reglas de `packages/shared`; repetidos y tipos inválidos rechazados por archivo sin fallar el lote; una notificación por lote. Encontró dos cosas que el diseño no veía: el rechazo temprano corta la conexión (`ECONNRESET`) y el front no puede importar valores de `shared` (CJS) — la cazó el e2e |
| [`SPEC-219`](archive/SPEC-219-evidence-hash-unico-por-stage.md) | `UNIQUE (stageId, sha256Hash)` en `Evidence`: la restricción detrás de la regla de `SPEC-218` | anexo (nace de `SPEC-218`) | **cerrada 2026-09-21** 🟡 — Paso 0 midió 0 duplicados sobre las 35 evidencias reales de Turso (`turso db shell propnexus`); migración `0009` aplicada y verificada dos veces contra copias exportadas de la base real (`turso db export`), incluida la idempotencia. `developer-evidencia.routes.ts` captura la carrera específica (`SQLITE_CONSTRAINT_UNIQUE` + el `message` de este índice) y responde `409 EVIDENCE_ALREADY_IN_STAGE` para el pedido entero — no vía `CONSTRAINT_ERRORS`, que mapea por código SQLite genérico y hubiera dado el mismo `RESOURCE_ALREADY_EXISTS` que cualquier otro `UNIQUE`. Test de la carrera real por HTTP (`Promise.all`, dos pedidos concurrentes) en `evidence-upload.test.ts`, más 4 casos a nivel de índice en `test/spec-219-evidence-hash-unico.test.ts` |
| [`SPEC-220`](archive/SPEC-220-el-perfil-del-desarrollador.md) | El perfil de la organización desarrolladora — capturas 59-60, la única superficie que M2-D2 diseña y M2-D5 nunca listó | anexo (nace de auditar el catálogo de capturas contra las rutas) | **cerrada 2026-09-21** 🟡 — migración `0010` (tabla `Organization` + `Project.organizationId`, aditiva y sin backfill), `GET /projects/:id/developer` con las cuatro estadísticas **derivadas** del registro, y la pantalla ensamblada con `StatCard` y `ProjectCard` ya existentes. **Sin rating (D-094)**: la captura lo muestra y la plataforma no puede sostenerlo (D-026), mismo criterio que D-070 con el botón de liberar pagos. `check-testids.mjs` ganó una tercera categoría, `FUERA_DEL_BACKLOG`, porque sus test IDs no pueden salir de un entregable que no la menciona |
| [`SPEC-221`](archive/SPEC-221-el-admin-invita-al-certifier.md) | El admin invita al certifier a un proyecto, y el admin entra a todo desde la web | anexo (nace preparando el video: sumar el certifier a un proyecto nuevo solo se podía por consola) | **cerrada 2026-09-21** 🟡 — **D-095**: el admin es la salvaguarda y pasa por cualquier guard de rol, con landing en `/admin`. Migración `0011` (tabla `CertifierInvitation`, aditiva), 5 endpoints, invitaciones pendientes en el panel del certifier; aceptar crea la membresía `verifier`, igual que el buyer con la suya. Sin anclaje: el registro es el audit log |
| [`SPEC-222`](SPEC-222-la-pwa-que-d-065-decidio.md) | La PWA que D-065 decidió: manifest real, íconos de la marca, service worker escrito a mano que nunca cachea la API | anexo (nace revisando el guion del video: su Anexo B reportaba la contradicción con `CLAUDE.md`) | **postergada** 🟡 — después de grabar el video; si entra antes de entregar M3 lo decide el dueño (ningún criterio del SOM la pide) |
| [`SPEC-301`](archive/SPEC-301-unicidad-del-hilo-no-depende-de-la-base.md) | La unicidad del hilo deja de depender de la base | C-01 (1·2) | **cerrada 2026-09-18** 🟡 · no era pulido |
| [`SPEC-302`](archive/SPEC-302-el-burn-queda-fijado-por-un-test.md) | "No hay burn" pasa de argumento a evidencia | C-03 | **cerrada 2026-09-18** |
| [`SPEC-303`](archive/SPEC-303-que-sostiene-la-igualdad-de-valor.md) | Escribir qué sostiene la igualdad de valor en el `spend` | C-05 | **cerrada 2026-09-18** |
| [`SPEC-304`](SPEC-304-la-clave-del-admin-no-se-puede-rotar.md) | La clave del `admin` es irreemplazable por construcción | C-02 | **postergada** · **antes de mainnet** — decidida y documentada (D-093, cerrada 2026-09-18), pero el riesgo sigue vivo: la clave del `admin` es irreemplazable por construcción hasta que mainnet elija una de sus tres formas |
| [`SPEC-305`](SPEC-305-el-proximo-cambio-de-script-hash.md) | El próximo cambio de script hash: unicidad on-chain y el tope de `evidence_root` | C-01 (3)·C-04 | **postergada** 🔴 · **antes de mainnet** — revisada 2026-09-18 y diferida a propósito: cambia el script hash. Ver §Antes de mainnet, arriba |
| [`SPEC-306`](archive/SPEC-306-property-tests-sobre-la-evolucion-del-datum.md) | Una propiedad sobre `valid_datum_evolution` | C-06 | **cerrada 2026-09-18** |
| [`SPEC-401`](archive/SPEC-401-dos-campos-del-contrato-mas-flojos-que-la-realidad.md) | Dos campos del contrato declarados más flojos que la realidad | P-01·02 | **cerrada 2026-09-20** |
| [`SPEC-402`](archive/SPEC-402-los-hashes-y-txid-tienen-forma.md) | Los 36 hashes y TXID del contrato tienen forma | P-03 | **cerrada 2026-10-02** — eran 41 campos; encontró un `commitment: ""` en la fila del evento al completar una etapa no crítica sin evidencia (ahora `null`). Producción, medida: cero filas fuera de forma |
| [`SPEC-403`](archive/SPEC-403-el-authoritative-del-multipart.md) | El `authoritative` del multipart solo entiende el literal `"true"` | P-04 | **cerrada 2026-09-19** |
| [`SPEC-404`](archive/SPEC-404-las-funciones-puras-validan-las-dos-direcciones.md) | Las funciones puras validan las dos direcciones, y `MerkleStep` se declara una vez | P-05·06 | **cerrada 2026-09-19** |
| [`SPEC-405`](archive/SPEC-405-higiene-de-shared.md) | Higiene de `shared`: el idioma, dos tipos, y un comentario al revés | P-07 | **cerrada 2026-09-19** |
| [`SPEC-406`](archive/SPEC-406-el-simulador-no-olvida-lo-que-confirmo.md) | El simulador deja de olvidar lo que confirmó al reiniciarse | C-01 | **cerrada 2026-09-20** 🟡 |
| [`SPEC-407`](archive/SPEC-407-el-outputref-se-busca-no-se-supone.md) | El `outputRef` del recibo se busca, no se supone | C-02 | **cerrada 2026-10-02** 🟡 — con el hilo fuera del índice 0, el código anterior devolvía el vuelto de la wallet sin que fallara nada; ahora el recibo sale de la salida que lleva el token, o la operación lanza |
| [`SPEC-408`](archive/SPEC-408-lo-que-vuelve-de-la-cadena-se-valida.md) | Lo que vuelve de la cadena se valida, por las dos puertas | C-03 | **cerrada 2026-10-02** 🟡 — `verify()` le daba un `AnchorProof` a cualquier pago al script con un datum armado a mano; ahora exige el token `policyId + stageRef` del datum, sin cambiar la firma del puerto |
| [`SPEC-409`](archive/SPEC-409-verify-devuelve-el-timestamp-del-bloque.md) | `verify()` devuelve el timestamp del bloque, que ya sabe leer | C-04 | **cerrada 2026-09-20** |
| [`SPEC-410`](archive/SPEC-410-tres-asperezas-del-adaptador.md) | Tres asperezas del adaptador: `canonical()`, un `parseInt` y un `fetch` | C-05 | **cerrada 2026-09-20** |
| [`SPEC-411`](archive/SPEC-411-lucid-se-carga-solo-si-hace-falta.md) | Lucid se carga solo si hace falta: 2 s y 121 MB por proceso | T-01 | **cerrada 2026-09-20** — 296s→119s de import en la suite de apps/api, medido |
| [`SPEC-412`](archive/SPEC-412-el-constructor-de-diez-parametros.md) | El constructor de diez parámetros posicionales | T-02 | **cerrada 2026-09-20** |

**Orden sugerido, si se toman en tanda.** Cada auditoría trae el suyo y estas specs lo respetan:
`201` → `202` → `203` → `204` → `205` → `206`+`207` → el pulido (`208`…`211`) → `212`; y del frente
`101` → `102` → `103`+`104` → `105`+`106` → `107`+`108` → `109`+`110`. **No es una dependencia**: es
daño evitado sobre línea tocada.

**La serie 3xx está toda revisada: cuatro cerradas y dos postergadas.** `301`, `302`, `303` y `306` no cambian el script hash y ya se tomaron. `304` está **postergada** aunque tenga su decisión escrita (D-093, prosa, no código): el riesgo que describe sigue vivo hasta que mainnet lo resuelva de una de sus tres formas. `305` está **postergada** a propósito: cambia el script hash, invalidaría (o dejaría en un contrato paralelo) los 180 eventos ya anclados en Preprod, y hay que decidirla antes del primer mint en mainnet, junto con `304` (§Antes de mainnet, arriba).

**La serie 4xx se ordena por lo que no se deshace.** Primero `402` → `407` → `408`, los tres que
tocan hashes, `outputRef` y datum: ninguno está roto hoy, los tres son suposiciones no declaradas en
los lugares donde equivocarse deja un hilo irrecuperable o una prueba que nadie validó. Después
`401` → `403` → `406`, que son correcciones con caso reproducido. Y al final `404` → `405` → `409`
→ `410` → `411` → `412`, que es pulido. `412` es además la más barata de todas y no depende de nada.
**El hallazgo más grande de `packages/shared` no está en esta serie: ya es
[`SPEC-109`](archive/SPEC-109-tipos-de-respuesta-desde-shared.md)**, y la auditoría de packages lo confirma
desde el otro lado con el número que faltaba — 63 de los 107 tipos inferidos no tienen consumidor.
