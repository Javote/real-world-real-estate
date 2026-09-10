# CLAUDE.md

> **Documento de trabajo activo:** [`specs/ESTADO-2026-09-10-catalyst-milestone-3.md`](specs/ESTADO-2026-09-10-catalyst-milestone-3.md)
> — el cruce contra los 5 Outputs oficiales del Milestone 3 tal como los publica Catalyst, con lo
> que falta consolidado en una tabla. Es el punto de partida de la próxima sesión.

Lo transversal. Lo de cada frente vive en `apps/web/CLAUDE.md`, `apps/api/CLAUDE.md`,
`packages/cardano/CLAUDE.md` y `contracts/CLAUDE.md`, y se carga solo cuando tocás ese subárbol.

**Acá solo hay información vigente.** El porqué de cada decisión está en `DECISIONS.md`; el
argumento largo, en `specs/archive/`.

---

# El plan de entrega del Milestone 3 — acordado 2026-09-09

**Esta es la lista completa de lo que falta, y manda sobre cualquier otra lista del repo.** Sale de
leer los 16 criterios del SOM en `specs/README.md` contra el código, más lo que se encontró
auditando la FSM del stage. Mientras el milestone no se entregue, lo que no esté acá no se hace.

Dos aclaraciones de vocabulario, porque las dos se habían perdido:

- **"Darle contenido a `Pending`"**: hoy una etapa `Pending` se ve como un chip gris vacío. Pero su
  mint ya está anclado y prueba algo real —*este proyecto declaró estas 10 etapas, en este orden, a
  esta hora*, la garantía anti-backdating—. Era mostrar esa fecha y su TXID en vez del vacío.
- **"Signers configurables"**: la otra mitad del criterio 3. D-021 lo relee como *qué rol puede
  autorizar cada transición de cada stage* (autorización de estado, no de gasto). Hoy
  `PATCH /stages/:id/state` tiene los roles fijos para todos los stages por igual.

**Y eso cambia el plan:** la investigación del 2026-09-07 ya había concluido que "signers
configurables" **no existe en ningún entregable** — solo en el texto del SOM. Es exactamente el
mismo caso que `progressPercentage`, y con la regla de precedencia del dueño (**entregables M2/M3
sobre el SOM**, 2026-09-09) se resuelve igual: **no se construye, se explica.** La captura 34C
tampoco tiene campo de signer. El criterio 3 queda sin código pendiente.

## Tanda 1 — esquema 🟡 · ✔ cerrada 2026-09-10

| | Qué |
|---|---|
| 1.1 | ✔ `migrations/0003_drop_stage_progress.sql` + sacarlo de `db/types.ts`, `stageSchema`, el insert de `developer.routes.ts`, `fixtures.ts` y `test/helpers/stages.ts` — commit `7130c94` |

Es todo. **Ningún call site cambia**: al no existir la columna, `selectAll()` deja de devolverla y
los ~9 `stageSchema.parse` siguen andando. Sin la migración habría que pasar esos 9 a listas
explícitas de columnas — la migración es el camino con *menos* código tocado, no más.

## Tanda 2 — código

**Alineación con las capturas**

| | Qué | Criterio |
|---|---|---|
| 2.1 | ✔ `developerProgressItemSchema` suma `certifiedAt` y `estimatedDelivery`; el handler los selecciona — commit `111f1f6` | 8 |
| 2.2 | ✔ `/developer/progress`: barra + "Overall Progress: N%" (dibujada por la pantalla, no por `ProgressTimeline`), `finalizationLabel` al timeline, bloque "Stage Detail" sin miniatura — commit `a4743fa`, verificado con Claude en Chrome contra `pnpm dev` local | 8 |

**Cierres de criterios**

| | Qué | Criterio |
|---|---|---|
| 2.3 | ✔ **Auditar los 10 patrones P1–P10 test por test.** Los 10 ya tenían test cubriendo "sin TXID no hay señal de prueba" — 8 en tests dedicados (`VerificationBadge.test.tsx`, `HashChip.test.tsx`, `patterns.test.tsx` ×6, `AuditEventCard` en `cards.test.tsx`), P8 (Dossier) por composición de P1+P2, verificado leyendo el código de las dos rutas de dossier. No hizo falta código nuevo, solo cerrar el `◐` con la evidencia — `specs/README.md` criterio 6 | 6 ✅ |
| 2.4 | ✔ Las 20 claves i18n de `AuditLog` que faltaban — verificado con Claude en Chrome (`CREATE_UNIT` real, vía `pnpm dev`): antes mostraba el literal, ahora "Creó una unidad" | 10 |

**Saneamiento de la demo** (no es un criterio, pero se demuestra sobre esto)

| | Qué |
|---|---|
| 2.5 | ✔ `Cimentación` de `torre-a` ya no está fabricada — `UPDATE Stage SET state='InProgress'` corrido a mano contra Turso producción (autorizado y verificado con `turso db shell`, 0 evidencia/0 eventos confirmados antes de tocarla), y `seed.ts` ya no pre-marca ninguna etapa nueva `Completed`. Destapó un bug real de UI, cerrado en el mismo commit: "Etapa N/total" usaba `sequenceOrder` crudo en vez de la posición en la lista — con huecos (como los de `torre-a`) el numerador podía superar al total. Afectaba `developer.progress.tsx` (2.2) y `project.$projectId.progress.tsx` (investor); las dos verificadas con Claude en Chrome reproduciendo el hueco a propósito en local |

## Tanda 3 — documentación, decisiones y evidencia

**Decisiones nuevas**

| | Qué |
|---|---|
| 3.1 | ✔ `DECISIONS.md`: el techo de precedencia — **entregables M2/M3 sobre el SOM** (D-090), con `progressPercentage` como el caso que lo estableció |
| 3.2 | ✔ `DECISIONS.md`: el avance es **derivado por proyecto** (`completadas/total`, D-091), según captura 45. No hay peso por etapa |
| 3.3 | ✔ `DECISIONS.md`: **"signers configurables" no existe en el diseño** (D-092) — misma resolución que 3.1, y cierra el criterio 3 |

**Saneamiento de `specs/README.md`** — hoy tiene cinco afirmaciones falsas

| | Qué |
|---|---|
| 3.4 | ✔ Criterio 3 reescrito con D-090/D-091/D-092: catálogo real de 10 (no 8), sin ruta que acepte el campo, "signers" resuelto por la tabla fija de D-020 |
| 3.5 | ✔ Números corregidos: **335 tests** de API (eran "235"), **82** de Aiken (eran "73"), superficies **53/53** (eran "46") |
| 3.6 | ✔ `SPEC-013 §C` — gana "hecho" (D-077 lo sostiene); corregido el registro de specs para que diga lo mismo que el orden de trabajo |

**Documentación de frente**

| | Qué |
|---|---|
| 3.7 | ✔ Ficha de `DEFAULT_STAGE_CATALOG`: motivo del "sin `progressPercentage`" ahora cita D-090/D-091 |
| 3.8 | ✔ `apps/web/CLAUDE.md`: deuda declarada de la miniatura de "Stage Detail" en la tabla de "Lo que la captura pide y el contrato no da" |
| 3.9 | ✔ `CLAUDE.md` raíz: tabla de pendientes de §Estado reescrita — solo quedan la prueba de volumen y mainnet (fuera de alcance) |

**Evidencia de entrega** (no es código ni prosa nuestra)

| | Qué | Criterio |
|---|---|---|
| 3.10 | Publicar la **lista formal de TXIDs** resolubles en explorador | 15 ◐ |
| 3.11 | **Screenshot de monitoring** (Sentry / Grafana), ya encendidos y verificados | 14 |
| 3.12 | **Video walkthrough** | 13 ⬜ |
| 3.13 | **3 pilotos** — recontactar; `M1-D3-PilotPlan.pdf` ya trae cartas de M1 y probablemente cubre parte | 4 ⬜ externo |

## La prueba de volumen (ex-pendiente #0) — ✔ cerrada 2026-09-10

Tres criterios dependían de ella, y ya corrió: `specs/REPORTE-2026-09-10-prueba-de-volumen.md`
(30/30 etapas `Completed`, 180/180 eventos on-chain `Confirmed`, en 3 proyectos nuevos).

| Criterio | Qué le dio la prueba |
|---|---|
| **8** ✅ | *"Flujos de UI end-to-end en pre-prod"* — la prueba **es** la evidencia |
| **9** ◐ | Sigue sin la muestra real de reserva→escrow: es un flujo distinto (compra del investor), la prueba ejercitó la FSM del stage. Falta correrlo una vez |
| **15** ◐ | Los 180 TXIDs ya existen y están en el apéndice del reporte; falta publicar la **lista formal** (3.10) |

Costo real medido: **~99.8 ADA total** (39.83 de fees + 60 bloqueadas, D-057), levemente por debajo
de lo presupuestado (~105 ADA). Con esto cerrado, 3.10/3.12/3.13 ya pueden avanzar — ver
`specs/ESTADO-2026-09-10-catalyst-milestone-3.md` para el detalle de qué falta de cada uno.

## Fuera de alcance de este milestone

| Qué | Por qué |
|---|---|
| **Mainnet** | Decisión del dueño, 2026-09-09. D-013 lo hace imposible por configuración y `specs/README.md` ya lo declara fuera |
| **Fusionar anclaje + transición** | Ahorra ~5% del costo on-chain; es 🟡 sobre el core de anclaje. Después de la prueba de volumen, que da la distribución real. Detalle en `specs/PROPUESTA-2026-09-09-fusionar-anclaje-evidencia-transicion.md` |
| **`TOPE_POR_LECTURA`** | Medir una carga real antes de tocar el número. El disparador por lectura ya se arregló (2026-09-09) |
| **"Contenido en `Pending`"** | Mejora de UX, ningún criterio la pide. Necesita que el listado de stages devuelva el anclaje y reconcilie |
| **Columna `AuditLog.projectId`** | Sacaría el mapeo fail-closed de `auditScope`. Pide backfill que para filas viejas no tiene respuesta |
| **`validationCritical` siempre `true`** | Config muerta con rama viva y testeada en el validador. No molesta |
| **Las 2 ADA bloqueadas por etapa** | Sin burn (D-057), son permanentes: 20 por proyecto de 10 etapas. Es el número para la decisión de mainnet, no para este milestone |
| **Upload directo del navegador a R2 (sin pasar por Render)** | Hoy el archivo hace escala en `UPLOAD_DIR` (Multer disco → `storage.put()` → R2 → se borra, `apps/api/src/lib/storage.ts`) antes de llegar al bucket — es lo que hace que `MAX_FILE_SIZE_MB` (2026-09-10: 10→50) le pese a la RAM del proceso, no solo al límite de R2 (5 GiB por PUT simple). Un presigned URL lo evitaría, pero es un cambio de forma real: CORS nuevo en el bucket, el front pasa de un POST a un flujo de 3 pasos, y el hash sigue teniendo que calcularse releyendo el objeto desde R2 después (D-027) — no se simplifica esa parte. **Después de mainnet**, cuando el volumen de uploads reales lo justifique frente al costo de tocar `storage.ts` (🟡) y el único endpoint que hoy usa `uploadSingleEvidence` |

## Sin confirmar todavía

1. **El criterio 3 se cierra por documentación** (3.1–3.4), sin construir signers ni percentages. Es
   la consecuencia directa de la regla de precedencia, pero es un criterio de Catalyst.

---

## Contexto

**PropNexus** (Catalyst 1400106) — plataforma de ventas inmobiliarias en pozo: estructura el ciclo
de obra en **stages**, organiza **evidencia** (planos, permisos, actas, certificados) y ancla
**huellas criptográficas** (SHA-256/Merkle) en **Cardano** con timestamps. Off-chain: documentos,
PII y lógica de negocio. On-chain: solo commitments y TXIDs — **nunca valor**. Cuatro roles con
superficie propia: investor (INV), developer (DEV), notary (NOT), certifier (CER).

**El problema real.** Hoy es imposible verificar el estado de los procesos de aprobación de una obra
en pozo: la evidencia está dispersa en canales informales y nada garantiza que lo que se muestra hoy
sea lo que existía ayer. Esa opacidad ya causó daño económico real a compradores.

**Lo que NO hace.** No certifica, no valida y no decide nada. Solo puede sostener cuatro
afirmaciones: *este archivo tiene este hash* · *se registró en este momento* · *declara provenir de
esta autoridad externa* · *esta persona atestiguó haberlo revisado*. Si escribís copy, modelo o
validador que afirme algo más, está mal (D-026).

---

# Estado, y lo próximo

> **La lista completa de lo que falta está en §El plan de entrega, arriba, y en
> [`specs/ESTADO-2026-09-10-catalyst-milestone-3.md`](specs/ESTADO-2026-09-10-catalyst-milestone-3.md)**
> (el cruce contra los 5 Outputs oficiales de Catalyst). Esta tabla es solo el resumen de los dos
> ítems que no encajaban en ninguna Tanda. **El historial completo de lo ya cerrado —narración
> día a día hasta el 2026-09-08— se movió a
> [`specs/archive/CLAUDE-historial-hasta-2026-09-10.md`](specs/archive/CLAUDE-historial-hasta-2026-09-10.md)
> el 2026-09-10**, para que esta raíz vuelva a cargar solo lo vigente. Sigue siendo válido tal cual,
> solo que ya no es "lo próximo".

| # | Qué | Estado |
|---|---|---|
| 0 | ~~Prueba end-to-end de volumen, en preprod, antes de mainnet~~ | **Cerrada el 2026-09-10** — 30/30 etapas `Completed` en 3 proyectos nuevos, 180/180 eventos on-chain `Confirmed`, las 4 aristas de la FSM ejercitadas por click real en el navegador. Detalle completo, el hallazgo real que dejó (dos etapas con anclaje perdido, causa raíz confirmada) y las 3 capas de autocura que salieron de ahí: `specs/REPORTE-2026-09-10-prueba-de-volumen.md`. Alimentó los criterios 8 y 15 del SOM; el 9 (reserva→escrow) sigue abierto, es un flujo distinto — ver `specs/ESTADO-2026-09-10-catalyst-milestone-3.md` |
| 1 | **Mainnet** — runbook, habilitar la red, custodia de la clave. **Fuera de alcance de este milestone** (decisión del dueño, 2026-09-09 — ver §El plan de entrega) | D-013 la hace **imposible por configuración**: es código, no solo procedimiento. 🔴 |

**El diseño ya está decidido. El trabajo es transcribirlo, no inventarlo.**

`docs/` tiene 70 capturas y un backlog de 53 superficies donde cada una ya trae su path, sus
componentes, sus endpoints y sus test IDs. No hay nada que diseñar y no hay reunión que tener.

## El loop, por pantalla

```
1. abrir la captura           docs/milestone-2-diseno/M2-D2-Screenshots-catalog/<N>-*.png
2. abrir su fila              docs/milestone-3-implementacion/UI-implementation-plan.md  (M2-D5)
3. transcribir                los componentes que la fila nombra, ninguno más
4. endpoints                  los de la fila; si no existen, se crean con la forma que la fila pide
5. test IDs                   los de la fila, literales
6. pnpm verify
7. commit                     con el ID de M2-D5 entre corchetes
```

**Las capturas se leen.** Son PNG y se abren con la herramienta de lectura: no hay que adivinar
espaciados ni colores mirando prosa.

## Las cinco reglas del loop

1. **Cuando la prosa y la captura difieren, gana la captura.** M2-D3 describe; M2-D2 muestra.
   **Excepción (D-074):** el `GradientHeader` autenticado es siempre logo + campana + perfil +
   idioma. Si la captura omite el logo o las utilidades, no se transcribe esa omisión.
2. **Ningún componente que M2-D3 no defina.** Si hace falta uno nuevo, es una decisión nueva, no un
   archivo nuevo.
3. **Ningún estado que M2-D3 no liste.** *"Never invent new statuses; choose the closest semantic
   mapping."*
4. **Ninguna superficie sin sus test IDs.** Una pantalla sin `data-testid` no está terminada — es
   evidencia que pide el SOM, no un lujo.
5. **Los tokens no se eligen, se transcriben.** El hex de M2-D3 es normativo.

## Antes de empezar una superficie

| Vas a tocar | Leé primero |
|---|---|
| Cualquier pantalla | su captura + su fila de M2-D5 + `M2-D1` (permisos del rol) |
| Algo que muestre hash, TXID o Merkle root | `M2-D4` — los 10 patrones son **normativos** |
| Un componente | su ficha en `M2-D3 §Component Library` |
| Un endpoint | `M2-D5` §4-6 (path, test IDs, work stream) + `M2-D6` §9 |
| Un validador | `M1-D1` §Workflow + D-020 (FSM) + D-021 (nunca valor) |
| El modelo de datos | `M1-D2` + `M2-D1` §4 (matriz de permisos) + D-029 |

No leas los cuatro entregables por costumbre: son ~25k tokens. Abrí lo que la fila pide.

---

## Jerarquía de precedencia

- **Obligaciones (el *qué*): manda `docs/`.** Ninguna decisión puede reducir lo que debemos.
  **`docs/` es inmutable** — ni para corregir un error evidente (D-022).
- **Implementación (el *cómo*): `DECISIONS.md` > `CLAUDE.md` > `specs/`.**

Un desvío solo es legítimo si (a) el entregable se contradice internamente, (b) es un error de
redacción, o (c) seguirlo al pie contradiría una verdad del producto declarada por el dueño.
**Nunca por conveniencia ni por preferencia técnica.** Los desvíos vigentes están listados en
`DECISIONS.md`.

Ante contradicción entre documentos: gana el de mayor precedencia y el otro se corrige **en el mismo
commit**. Si la contradicción es con código, avisá antes de "arreglar" nada.

**Y antes de declarar que un entregable está mal: verificá que estás mirando el entregable.** Ya nos
pasó decidir contra una transcripción errónea (ver Trampas).

---

# Reglas duras (innegociables)

1. **Datos primero:** dinero jamás en float — montos en unidades enteras mínimas (lovelace como
   `bigint`; fiat en centavos). Timestamps en UTC. IDs opacos.
2. **Cero PII on-chain o en logs:** ni nombres, ni emails, ni URLs internas, ni nombres de archivo en
   metadata, datums o logs. Solo hashes y refs opacas. Strings de metadata ≤ 64 bytes.
3. **El hash es el ticket de entrada a la cadena de prueba** (D-027). Si un archivo tiene
   `sha256Hash`, termina anclado — o se muestra "Pendiente", **nunca** "Verificado".
4. **Passwords solo con bcrypt** (cost 10, D-046). Jamás loguear ni devolver `passwordHash`.
5. **Autorización en dos capas, siempre:** rol global (`requireRole`) + membresía por proyecto
   (`requireProjectAccess`). La matriz completa está en M2-D1 §4.
6. **Todo body se valida con Zod**, y el schema vive en `packages/shared` **antes** que el endpoint.
7. **Toda mutación relevante escribe `AuditLog`** (append-only) con actor, entidad, acción, timestamp.
8. **Idempotencia en todo lo que toca chain:** re-ejecutar un anclaje o una migración no duplica
   efectos.
9. **La FSM del stage es una sola** (D-020), en `packages/shared` y espejada en Aiken. Si cambia una,
   cambian las dos en el mismo commit.
10. **Uploads:** solo `application/pdf`, `image/jpeg`, `image/png`; máximo `MAX_FILE_SIZE_MB`. Si un
    upload falla la validación después de escribirse, **borrar el archivo huérfano**.
11. **`contracts/plutus.json` se commitea** tras cada `aiken build`; direcciones derivadas del
    blueprint, jamás hardcodeadas.
12. **Secrets solo por env.** Si ves una seed o una key commiteada: frená y avisá.
13. **Ningún validador custodia ni transfiere valor** (D-021).
14. **Cero strings hardcodeados en la UI** (D-025). Todo texto sale del diccionario; moneda, fecha y
    decimales con `Intl.*`. Default `es-AR` con voseo.
15. **El backend devuelve claves de traducción, nunca copy** (M2-D4 §8.2).
16. **Los hashes viajan completos al cliente.** La truncación 6+4 es de presentación y la hace
    `HashChip`. Los TXID son case-sensitive y viajan verbatim.
17. **Nunca mostrar una señal de prueba que no puedas sustanciar** (M2-D4 §6.2). Sin TXID, el estado
    es "Pendiente".

# Prohibiciones

- No inventar componentes, estados, endpoints ni superficies fuera de `docs/` — proponer, no improvisar.
- **Nunca "milestone" para una etapa de obra: es `stage`** (D-067). El riesgo sigue vivo porque los
  entregables usan la palabra y el código ya no. **Excepción:** los test IDs de M2-D5 se transcriben
  literales, incluso `INV-STAGE-MILESTONE-001`.
- No abrir un modal de verificación automáticamente (M2-D4 §6.3). Toda superficie de prueba es
  iniciada por el usuario; la única excepción es `AnchoringSuccessModal`.
- En el front, no hacer `fetch` fuera de `ApiPort`.
- No importar Lucid/Blockfrost fuera de `packages/cardano` (D-014).
- No migrar lógica de negocio on-chain: el backend es fuente de verdad del **registro** (D-007).
- No tocar mainnet: `CARDANO_NETWORK=Preprod` siempre (D-013).
- **No editar migraciones aplicadas** — con la condición de D-063: mientras la única base sea local,
  el esquema se corrige editando el archivo y borrando la base. Con Turso vivo, se termina.
- No tocar `contracts/build/` ni editar `aiken.lock` a mano.
- No commitear `.env`, `apps/api/.data/` (las bases locales), `uploads/` ni artefactos de build.
- No "arreglar" tests cambiando contratos de API o esquema de DB para que pasen.
- **No editar nada dentro de `docs/`** (D-022).

---

# Estructura

```
apps/api          Express 5 + Kysely      → servicio en Render
apps/web          TanStack Router + Vite  → static site en Render (SPA + PWA)
packages/shared   contrato Zod (oRPC)     → lo importan los dos
packages/cardano  AnchorPort              → lo importa la API
contracts/        Aiken · Plutus V3       → no se hostea, toolchain aparte
```

`packages/shared` es lo único que vuelve el drift **imposible** en vez de prohibido. `contracts/` no
está en el workspace pnpm a propósito: otro toolchain, otro lockfile, otra caché.

Tres `.md` en la raíz: **`README.md`** (entrada humana), **`CLAUDE.md`** (este) y **`DECISIONS.md`**
(las restricciones). El mapa de desarrollo en `specs/README.md`; los entregables en `docs/`, mapeados
en `specs/entregables.md`.

| Qué | Dónde |
|---|---|
| Obligaciones, la vara de aceptación | `docs/` (inmutable) |
| Qué archivo de `docs/` es qué entregable | `specs/entregables.md` |
| Qué obliga una decisión | `DECISIONS.md` |
| Por qué se decidió (argumento largo) | `specs/archive/` |
| Reglas y trampas de un frente | `<frente>/CLAUDE.md` |
| Invariantes de una rebanada | `specs/SPEC-NNN` |
| Stack, versiones e infraestructura | `specs/stack.md` |
| Deploy, rollback e incidentes | `specs/RUNBOOK-deploy.md` |

# Stack

| Frente | Con qué | Decisión |
|---|---|---|
| **web** | TanStack Router + Vite (SPA, sin SSR) · React 19 · Tailwind v4 · shadcn/ui · Lucide · PWA | D-065, D-024 |
| **api** | Express 5 + oRPC + Zod + JWT + bcrypt(10) + Multer + helmet, base `/api/v1` | D-066, D-054 |
| **shared** | Zod — el contrato único. El schema va acá **antes** que el endpoint | D-012, D-066 |
| **db** | Kysely · SQLite en dev · Turso en prod · una sola migración | D-038, D-063 |
| **cardano** | `AnchorPort` con adaptadores `simulated` y real (Lucid Evolution) | D-014, D-060 |
| **contracts** | Aiken v1.1.21 · Plutus V3 · stdlib v3.0.0 · blueprint commiteado | D-019, D-058 |
| red | **Preprod siempre**; mainnet fuera de alcance | D-013 |

El inventario completo —versiones reales, qué corre y qué está solo decidido— vive en
`specs/stack.md` y solo ahí (D-034).

---

# Niveles de autonomía

| Nivel | Qué cubre | Cómo se trabaja |
|---|---|---|
| 🟢 Verde | Componentes según M2-D3, superficies según M2-D5, tests, docs, seeds | El LLM implementa directo |
| 🟡 Amarillo | Migraciones, auth/permisos/guards, `packages/cardano`, archivos/S3, CI/deploy, **validadores Aiken** | El LLM propone; revisión humana línea por línea |
| 🔴 Rojo | Claves y firmas, `SERVICE_WALLET_PRIVATE_KEY`, hashing y construcción de commitments | El humano lidera; el revisor debe poder explicar cada línea sin mirar el chat |

Si dudás del nivel, es el más alto de los dos.

# Commits y ramas

`<tipo>(<scope>): <descripción en imperativo, minúscula, sin punto final> [<REF>]`

- **Tipos:** `feat` · `fix` · `refactor` · `test` · `docs` · `chore` · `perf` · `db`
- **Scopes:** `web` · `api` · `db` · `shared` · `cardano` · `contracts` · `ci` · `repo`
- **REF:** el ID de M2-D5 cuando aplique (`[M3-FE-18]`, `[INV-BUY-LIST-001]`) o la decisión (`[D-065]`)

Un commit = un cambio lógico · el cuerpo explica el *por qué* · `BREAKING CHANGE:` si rompe contrato
de API o esquema on-chain. **`main` es la rama de integración y no hay PRs** (D-030).

**Testear, commitear y pushear son una sola unidad de trabajo.** `pnpm verify:all` en verde →
`git commit` → `git push`, siempre juntos y en ese orden. No se junta trabajo local "para pushear al
final", y no se commitea sin el verde.

**Por qué es regla y no gusto:** un commit local no existe para nadie más, y el remoto queda
afirmando un estado que no es el real — el mismo modo de falla que el push contra un servicio
suspendido y que el TXID simulado en producción. **No falla: miente.** Si pushear tiene una
consecuencia que el dueño debería saber —acá el deploy automático de Render, que el `buildFilter`
no filtra—, se pushea igual y se avisa; no se retiene el push por eso.

**La documentación viaja con el código que la causa, en el mismo commit.** Un cambio que altera cómo
se opera, se configura o se despliega algo llega con su documentación adentro — no en un `docs(...)`
posterior. Un `docs(...)` suelto es legítimo solo cuando el cambio **es** documentación: sanear algo
desactualizado, cerrar una decisión, escribir una trampa recién aprendida.

**Por qué es regla y no gusto:** el 2026-08-27 el commit de R2 salió sin cerrar D-051, y durante tres
commits `DECISIONS.md` afirmó que la evidencia era efímera mientras la evidencia ya vivía en R2. La
ventana entre el código y su documentación es una ventana en la que el repo miente, y quien lea en
el medio no tiene forma de saberlo.

# Comandos

```bash
pnpm install                      # bootstrap del workspace
pnpm dev                          # web + api en paralelo
pnpm verify                       # app TS: lint + typecheck + tests + build
pnpm contracts:verify             # Aiken: fmt + check + build
pnpm verify:all                   # las dos, encadenadas
pnpm lint:fix                     # Biome arregla lo mecánico

pnpm --filter @plataforma/api test:s3         # storage contra MinIO real
pnpm --filter @plataforma/cardano test:yaci   # anclaje contra un nodo Cardano real
docker compose -f compose.dev.yml up -d       # solo si querés la infra levantada aparte
```

**TypeScript y Aiken no se mezclan:** distinto toolchain, distintos artefactos, distintos modos de
falla. El CI los corre como dos jobs en paralelo. Los dos últimos comandos **no corren en CI** (no
levanta infraestructura): se corren a mano.

Los comandos por frente (`db:migrate`, `db:seed`, `e2e`) están en el `CLAUDE.md` de cada uno.

---

# Trampas transversales

Sección viva: agregá acá el mismo día que te muerda una. Las de cada frente van en su `CLAUDE.md`.

- **Las capturas de M2-D2 tienen datos mock, no datos de diseño.** M2-D1 lo dice: *"the maquette uses
  mock blockchain interactions"*. Lo normativo de una captura es la **estructura** —layout,
  componentes, jerarquía, estados—; los valores no. La captura 55 muestra tres unidades del mismo
  proyecto en tres stages distintos y casi nos hace modelar stages por unidad, cuando el dominio dice
  que un desarrollo tiene un solo trámite (D-029).
- **Antes de concluir que un entregable está mal, verificá que estás mirando el entregable.** Cuatro
  `.puml` regenerados desde los PDF de M1 tenían las flechas de la FSM invertidas, y durante una
  sesión entera creímos que el entregable estaba mal. El paquete canónico es
  `M1-D2-Architecture-and-Data-Models/`, hasheado en la Proof of Achievement.
- **Grepear solo `*.md` esconde entregables.** Una búsqueda con `--include="*.md"` concluyó que algo
  no aparecía en `docs/`; estaba en un `.csv`. Grepeá sin filtro de extensión.
- **Los códigos de entregable se reinician en cada milestone y colisionan**: `M1-D1` es el whitepaper,
  `M2-D1` es el mapa de arquitectura de información. Al citar, usá siempre la forma completa
  (`M2-D1 §4`). Y `M2-D5`/`M2-D6` son entregables de **Milestone 2** aunque vivan en la carpeta de M3.
- **Los PDF de este repo no se leen con la herramienta de lectura** (falta `pdftoppm`). Las capturas
  PNG sí. Para un PDF: `qlmanage -t -s 1800 -o <dir> archivo.pdf`.
- **Un verificador que vive dentro del corpus que verifica se encuentra a sí mismo.** Un guardia que
  matcheaba la mención de `docs/` se bloqueó al escribirse. **Antes de agregar un verificador,
  preguntá si el problema no se arregla mejor cambiando la forma de lo verificado** (D-053).
- **Editar un `package.json` sin correr `pnpm install` produce un verde falso.** Lo atrapa
  `pnpm install --frozen-lockfile` en CI, y alcanza. Un verde sobre el entorno equivocado es peor que
  un rojo.
- **`pnpm.overrides` vive en `package.json` y pnpm 10+ dejó de leerlo.** El pin
  `"packageManager": "pnpm@9.15.0"` es lo único que hoy lo sostiene: un pnpm más nuevo instalado en
  la máquina delega a 9.15.0 y el override se aplica igual —lo prueba la línea 8 de `pnpm-lock.yaml`
  y que `@types/express` resuelva a 5.0.6—, pero avisa `The "pnpm" field in package.json is no longer
  read by pnpm`. **Ese warning no es ruido: es la cuenta regresiva.** El día que se suba el pin a
  pnpm 10+, los overrides se ignoran **en silencio** y sin romper el build; hay que moverlos a
  `pnpm-workspace.yaml` en el mismo commit que sube la versión.
- **`pnpm verify` corre contra el entorno de test, no contra el que declara `render.yaml`.** Entre
  los dos no había nada, y una regresión de configuración solo se veía en los logs del deploy.
  Lo cierra `apps/api/test/render-config.test.ts` (D-076). **Si agregás una lectura de `env.*`
  nueva, declarala en `render.yaml` o el test se pone rojo** — que es el punto.
- **Las capturas del developer no coinciden en el header.** Documentación (46) va sin logo, Audit
  log (49) va con logo, ninguna trae campana ni idioma, y M2-D3 dice *never omit the logo*. No se
  transcribe captura por captura: D-074 unifica. Si una pantalla nueva "sigue la captura" y saca el
  logo, está mal.
