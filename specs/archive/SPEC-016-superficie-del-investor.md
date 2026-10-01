# SPEC-016 — La superficie del investor

> Handoff. El rol investor es lo último que queda del backlog de UI de M2-D5. **Esta rebanada es
> UI/UX y nada más**: el backend que necesita ya existe, endpoint por endpoint, y no se toca.

## Propósito

Cerrar las 19 filas de M2-D5 §4 que faltan del rol investor: 31 test IDs, de los 32 que `pnpm testids`
reporta pendientes. El único otro pendiente es `DEV-RELEASE-EXECUTE-002`, que no es deuda sino
alcance retirado por D-070 — **no lo implementes**.

Estado medido al 2026-08-28 con `pnpm testids`: **43 / 75 (57,3%)**, piso 42. Notary 6/6,
Certifier 6/6, Developer 22/23, **Investor 5/36**.

## Alcance / NO-alcance

- **Cubre:** rutas nuevas del front, modales, wiring de `ApiPort`, claves de diccionario, y los
  `data-testid` de M2-D5 §4.
- **NO cubre — y no se toca:**
  - `apps/api/**` — todos los endpoints existen. Si creés que falta uno, **frená y preguntá**: es
    más probable que estés mirando el handler equivocado.
  - `packages/shared/**` — no hace falta ningún schema nuevo.
  - `contracts/**`, migraciones, seeds.
  - Las superficies de developer, notary y certifier, que están cerradas.
  - `styles.css` — los 51 tokens están y `styles.test.ts` los verifica contra el entregable.
  - Componentes de `components/domain/**`: **los 36 de M2-D3 ya existen**. Si una captura no entra
    en uno, se le agrega un `variant`/prop (precedente: `ProjectCard variant="developer"`), nunca
    una pantalla que reinventa su layout.

### Los archivos existentes que SÍ hay que tocar, y por qué

Todo aditivo. Nada de reescribir lo que ya está conforme.

| Archivo | Qué se le agrega | Por qué es inevitable |
|---|---|---|
| `apps/web/src/api/port.ts` | ~13 métodos nuevos | Prohibición de `CLAUDE.md`: no hay `fetch` fuera del puerto |
| `apps/web/src/api/types.ts` | interfaces de las respuestas nuevas | Espejo manual del contrato; los métodos nuevos necesitan su tipo |
| `apps/web/src/i18n/dictionary.ts` | claves nuevas en **las dos** tablas (`esAR` y `enUS`) | Regla 14: cero strings hardcodeados |
| `apps/web/src/routes/investor.buy.tsx` | search params `?view=` | Las filas 03-05 **son** modos de la fila 02 en el entregable, no pantallas aparte |
| `apps/web/src/components/ProfileScreen.tsx` | edición de nombre + `data-testid` de prefs | La pantalla existe; le faltan 2 de sus 3 test IDs |
| `apps/web/src/routes/investor.notifications.tsx` | `InvitationCard` pineada + su modal | Fila 63: M2-D1 la ubica dentro del inbox |
| `scripts/check-testids.mjs` | subir `COBERTURA_MINIMA` | Trinquete: el piso sube al cerrar cada rebanada |
| `specs/README.md` | fila en el registro de specs y estado medido | Convención del repo |

## El loop no cambia

Está en `CLAUDE.md` y es obligatorio: **abrir la captura → abrir su fila de M2-D5 → transcribir**.
Las capturas son PNG y se leen con la herramienta de lectura. No se adivinan espaciados ni colores.

Las cinco reglas siguen aplicando; las dos que más van a doler en este rol:

- **Regla 1 — gana la captura.** Con la excepción de D-074: el `GradientHeader` autenticado es
  siempre logo + campana + perfil + idioma. Si la captura del investor omite algo del header, no se
  transcribe esa omisión. **No reintroducir `hideBrand`.**
- **Regla 3 — ningún estado que M2-D3 no liste.** *"Never invent new statuses; choose the closest
  semantic mapping."*

## Las 19 filas

Rutas nuevas en `apps/web/src/routes/`, con el naming plano de TanStack Router (precedente:
`developer.project.$projectId.contracts.tsx`). Todas las capturas viven en
`docs/milestone-2-diseno/M2-D2-Screenshots-catalog/`.

Los endpoints están **todos implementados**; la columna apunta al handler para que derives la forma
de la respuesta del código y no de esta tabla.

| Fila | Path | Archivo de ruta | Captura(s) | Endpoint (handler) | Test IDs | Pat |
|---|---|---|---|---|---|---|
| 03 | `/investor/buy?view=map` | *(en `investor.buy.tsx`)* | `3-INVESTOR-HOME-MAP` | `projects.routes.ts:52` (`?bbox=`) | `INV-BUY-MAP-001` | — |
| 04 | `/investor/buy?view=search` | *(idem)* | `4-INVESTOR-HOME-SEARCH` | `projects.routes.ts:52` (`?q=`) | `INV-BUY-SEARCH-001` | — |
| 05 | `/investor/buy?view=filter` | *(idem)* | `5-INVESTOR-HOME-FILTER` | `projects.routes.ts:52` (`?status=&sort=`) | `INV-BUY-FILTER-001` | — |
| 06-07 | `/project/:projectId` | `project.$projectId.index.tsx` | `6-…-PAGE-A`, `7-…-PAGE-B` | `projects.routes.ts:185` · `:375` | `INV-PROJECT-DETAIL-001`, `INV-PROJECT-DOCS-002` | P1, P2 |
| 08 | `/project/:projectId/progress` | `project.$projectId.progress.tsx` | `8-…-PROGRESS&STAGES-A` | `projects-obra.routes.ts:35` | `INV-PROJECT-STAGES-001` | — |
| 09-12 | `/project/:projectId/stage/:stageId` | `project.$projectId.stage.$stageId.tsx` | `9`,`10`,`11`,`12-…-PROGRESS-SPECIFIC-A..D` | `projects-obra.routes.ts:117` · `evidence.routes.ts:23` | `INV-STAGE-DETAIL-001`, `INV-STAGE-DOCVIEW-002` | P1, P2, P7 |
| 13 | `/investor/favorites` | `investor.favorites.tsx` | `13-INVESTOR-FAVORITES` | `investor.routes.ts:46` · `:58` · `:81` | `INV-FAV-LIST-001`, `INV-FAV-TOGGLE-002` | — |
| 15-18 | `/investor/unit/:unitId` | `investor.unit.$unitId.index.tsx` | `15`,`16`,`17`,`18-…-ACQUIRED-UNIT-A..D` | `investor.routes.ts:122` · `:182` | `INV-UNIT-DETAIL-001`, `INV-UNIT-NEWS-002` | P9 |
| 19 | modal galería | *(dentro de la fila 15-18)* | `19-…-GALLERY` | `projects.routes.ts:375` + `evidence.routes.ts:52` | `INV-UNIT-GALLERY-001` | — |
| 20 | modal ubicación | *(idem)* | `20-…-LOCATION` | `projects.routes.ts:185` (geo) | `INV-UNIT-LOC-001` | — |
| 21 | modal esquema del edificio | *(idem)* | `21-…-MY-UNIT` | `projects.routes.ts:414` | `INV-UNIT-BUILDING-001` | — |
| 22 | `/investor/unit/:unitId/notifications` | `investor.unit.$unitId.notifications.tsx` | `22-…-NOTIFICATIONS` | `investor.routes.ts:333` (`?unitId=`) · `notifications.routes.ts:44` | `INV-NOTIF-UNIT-001`, `INV-NOTIF-READ-002` | — |
| 23-24 | `/investor/unit/:unitId/contract` | `investor.unit.$unitId.contract.tsx` | `23`,`24-…-PAYMENTS-A/B` | `investor.routes.ts:515` · `contracts.routes.ts:17` | `INV-CONTRACT-VIEW-001`, `INV-RELEASES-LIST-002` | P2, P10 |
| 25v | modal TXID | *(dentro de 23-24)* | `25-…-VERIFICATION` | cliente: `$EXPLORER_BASE/tx/:txid` | `INV-TXID-MODAL-001` | P3 |
| 25m | modal hito de etapa | *(dentro de 09-12)* | `25-…-STAGE-MILESTONE` | `evidence.routes.ts:321` · `:288` | `INV-STAGE-MILESTONE-001`, `INV-MERKLE-PROOF-002` | P5 |
| 26-29 | `/investor/unit/:unitId/dossier` | `investor.unit.$unitId.dossier.tsx` | `26`,`27`,`28-…-DOSSIER-A/B/C`, `29-…-DOSSIER-D` | `investor.routes.ts:219` · `:235` | `INV-DOSSIER-VIEW-001`, `INV-DOSSIER-EXPORT-002` | P8 |
| 28s | modal compartir dossier | *(dentro de 26-29)* | `28-…-DOSSIER-SHARE` | `investor.routes.ts:291` · `public.routes.ts:28` | `INV-DOSSIER-SHARE-001`, `INV-DOSSIER-PUBLIC-002` | P8 |
| 30 | `/investor/profile` *(existe)* | `components/ProfileScreen.tsx` | `30-INVESTOR-PROFILE` | `profile.routes.ts:40` · `:65` | `INV-PROFILE-EDIT-002`, `INV-NOTIF-PREFS-003` | — |
| 63 | modal aceptar invitación | *(dentro de `investor.notifications.tsx`)* | `63-INVESTOR-PROJECT-INVITATION` | `investor.routes.ts:361` · `:394` · `:471` | `INV-INVITE-VIEW-001`, `INV-INVITE-ACCEPT-002`, `INV-INVITE-DECLINE-003` | — |

Los componentes de cada fila los nombra M2-D5 §4 y no se repiten acá: **abrí la fila**, no esta
tabla. Todos existen ya en `apps/web/src/components/domain/`, incluidos `BuildingSchematic`,
`ImageGalleryModal`, `LocationMapModal`, `InvitationAcceptModal`, `ShareDossierModal`,
`DocumentViewerModal`, `MerkleRootProof`, `TxidModal` y `VerifiedWatermark`.

## Los métodos que le faltan al `ApiPort`

Se agregan al objeto `api` de `apps/web/src/api/port.ts`, en su sección con el comentario de fila,
como los que ya están. Ninguno modifica un método existente.

| Método | Request | Fila |
|---|---|---|
| `listProjects(params?)` | `GET /api/v1/projects?status=&q=&bbox=&sort=&city=` | 03-05 — **el actual no acepta params**, se le agregan opcionales |
| `listProjectDocuments(id)` | `GET /api/v1/projects/:id/documents` | 06-07, 19 |
| `listProjectStages(id)` | `GET /api/v1/projects/:id/stages` | 08 |
| `getProjectStage(id, stageId)` | `GET /api/v1/projects/:id/stages/:stageId` | 09-12 |
| `getBuildingSchematic(id)` | `GET /api/v1/projects/:id/building-schematic` | 21 |
| `listFavorites()` / `addFavorite(id)` / `removeFavorite(id)` | `GET`/`POST`/`DELETE /api/v1/investor/favorites[/:projectId]` | 13 |
| `getInvestorUnit(id)` | `GET /api/v1/investor/units/:id` | 15-18 |
| `getInvestorUnitNews(id)` | `GET /api/v1/investor/units/:id/news` | 15-18 |
| `getInvestorContract(unitId)` | `GET /api/v1/investor/contracts/:unitId` | 23-24 |
| `listContractReleases(contractId)` | `GET /api/v1/contracts/:contractId/releases` | 23-24 |
| `getUnitDossier(id)` | `GET /api/v1/investor/units/:id/dossier` | 26-29 |
| `exportUnitDossier(id)` | `GET /api/v1/investor/units/:id/dossier/export.pdf` → `Blob` | 26-29 |
| `shareUnitDossier(id)` | `POST /api/v1/investor/units/:id/dossier/share` | 28s |
| `getBundleFiles(bundleId)` / `getMerkleProof(bundleId, fileHash)` | `GET /api/v1/evidence/:bundleId/files` · `/proof/:fileHash` | 25m |
| `getInvitation(id)` / `acceptInvitation(id)` / `declineInvitation(id)` | `GET`/`POST /api/v1/investor/invitations/:id[/accept|/decline]` | 63 |

`getProfile`, `updateProfile`, `updateNotificationPrefs`, `listNotifications`,
`markNotificationRead`, `getUnreadCount`, `listInvestorUnits` y `downloadEvidence` **ya existen**.

## Lo que la captura pide y el contrato no da

Se verificó contra el esquema, no contra una impresión. **El criterio no se negocia: sin dato, no se
dibuja** (`apps/web/CLAUDE.md`). Nada de placeholders ni de derivar un valor parecido.

| Dato | Verdad medida | Qué hacer |
|---|---|---|
| Galería de la unidad (fila 19) | `GET /investor/units/:id` **no devuelve imágenes**, y no hay entidad de imagen en el esquema | Hay salida sin backend: `GET /projects/:id/documents` trae la evidencia con `evidenceType: 'photo'`, y `downloadEvidence` baja los bytes. Es la fuente real de fotos de obra |
| Ubicación de la unidad (fila 20) | `GET /investor/units/:id` no selecciona `latitude`/`longitude` | Existen en `Project` y `GET /projects/:id` **sí** las devuelve. Segunda query, cero backend |
| Nombre de la organización ("by Grupo Alpine") | No hay entidad de organización; `User.fullName` es una persona | Deuda ya declarada en `ProjectCard` prop `developerName`. Se dibuja como ausencia |
| "Price from" en el listado del investor | `GET /projects` no agrega el mínimo de las unidades (`GET /developer/projects` sí) | Deuda ya declarada en `ProjectCard` prop `priceLabel`. **No la resuelvas tocando la API** en esta rebanada |
| Rating / reputación del developer (capturas 6-7) | No hay modelo de rating | Se dibuja como ausencia y se agrega a la tabla de `apps/web/CLAUDE.md` |

**Antes de declarar un dato ausente, buscalo en otro nivel del modelo.** El "Price from" se declaró
ausente y no lo estaba: estaba a nivel unidad. Esa diferencia convierte una migración en un `min()`.

Cada deuda nueva se declara **en el prop que no se puede llenar** y se indexa en
`apps/web/CLAUDE.md` §"Lo que la captura pide y el contrato no da", el mismo día.

## Invariantes

1. Ningún `fetch` fuera de `ApiPort`.
2. Ningún string visible fuera del diccionario, en las dos tablas de locale (regla 14). Moneda,
   fecha y decimales por `i18n/format.ts`, nunca a mano.
3. Los hashes y TXID viajan **completos** al cliente; trunca `HashChip` (6+4, contando `0x`).
   `VerificationBadge` recibe el TXID, no un booleano — sin TXID el estado es "Pendiente" (reglas
   16 y 17).
4. **Ningún modal se abre solo.** La única excepción es `AnchoringSuccessModal`, que no aparece en
   este rol (M2-D4 §6.3). El TxidModal de la fila 25v y el de hito de la 25m los inicia el usuario.
5. Los patrones **componen, nunca se superponen** (M2-D4 §6.1). Una pantalla no muestra P1 y P3
   contestando la misma pregunta: P1 = ¿está anclado?, P2/P9 = ¿cuál hash?, P3/P5 = el hash
   completo. La tabla de profundidades está en `apps/web/CLAUDE.md`.
6. Montos en unidades mínimas enteras. `amountMinorUnits` / `totalMinorUnits` se formatean al
   mostrar; jamás se hace aritmética de dinero en float.
7. Cada superficie termina con **sus** `data-testid`, literales de M2-D5. Un ID con una letra
   cambiada se ve implementado y no cuenta.
8. `pnpm verify` verde antes de cada commit.

## Trampas verificadas — te van a morder en este rol

- **`GET /projects` y `GET /projects/:id` están scopeados por membresía**
  (`projectScope`, `auth.ts:244`): un `buyer` solo ve los proyectos donde es `ProjectMember`. La
  fila 06-07 devuelve **403** para un proyecto en el que el investor no es miembro. Es el
  comportamiento existente y **no se cambia** en esta rebanada: la pantalla tiene que manejar el 403,
  no evitarlo. Si el producto quiere browse público, es una decisión nueva.
- **Cambiar de rol en un e2e no funciona solo.** `loginConSolapa` vuelve en el primer intento si
  `sessionStorage.proptrust.session` ya existe, y la falla aparece varios pasos después como un 403
  que parece de permisos. Usá el patrón `cambiarDeRol` de `e2e/developer-contracts.spec.ts`
  (`goto('/login')` → `sessionStorage.clear()` → login).
- **`Link` de TanStack pinta activo por prefijo.** El investor no lo padece hoy porque su primer tab
  es `/investor/menu` — pero al agregar `/investor/unit/...` bajo `/investor/units`, revisá
  `tabNeedsExactMatch` en `BottomNav.tsx`.
- **El tab Favorites del `BottomNav` ya apunta a `/investor/favorites`** (`navTabs.ts`), una ruta que
  todavía no existe. La fila 13 lo resuelve; hasta entonces el tab está roto.
- **Un `*.test.tsx` dentro de `src/routes/`** lo escanea el generador de rutas: prefijalo con `-`.
- **Los E2E esperan que React monte, no que exista el DOM** — `waitForHydration`.
- **La captura 62 tiene un espacio en el nombre del archivo** (`62-INVESTOR NOTIFICATIONS.png`).
  Citala entre comillas.
- **Los datos de las capturas son mock, no diseño.** Lo normativo es la estructura: layout,
  componentes, jerarquía, estados. Los valores no. La captura 55 casi nos hace modelar stages por
  unidad; el dominio dice que un desarrollo tiene **un solo trámite** (D-029). En la fila 15-18, el
  avance que muestra la unidad es **del proyecto**.

## Orden de trabajo — 5 rebanadas

El criterio de corte es el de siempre: **la app queda corriendo y demostrable**. Un commit por
rebanada como mínimo, con el ID de M2-D5 entre corchetes.

| # | Filas | Test IDs | Por qué en este orden |
|---|---|---|---|
| 1 | 30, 03, 04, 05 | 5 | Los baratos. La API ya filtra y la pantalla de perfil ya existe: es wiring |
| 2 | 06-07, 08, 09-12, 13 | 7 | La rama de exploración pública. Trae P1, P2, P7 y desbloquea el tab Favorites roto |
| 3 | 15-18, 19, 20, 21, 22 | 7 | La unidad adquirida con sus tres modales. Trae P9 |
| 4 | 23-24, 25v, 25m | 5 | Contratos, releases, Merkle. Trae P3, P5, P10 — la densidad de prueba del rol |
| 5 | 26-29, 28s, 63 | 7 | Dossier (P8) e invitación: cierran el ciclo comercial y la tesis del producto |

`SPEC-014` marca dossier y audit log como **no cortables**: son la tesis. Si algo se cae por tiempo,
que no sea la rebanada 5.

Al cerrar cada rebanada: correr `pnpm testids`, **subir `COBERTURA_MINIMA`** al número nuevo, y
actualizar el estado medido de `specs/README.md`.

## Casos borde (definen los tests)

- Proyecto sin coordenadas → no entra al mapa de la fila 03. No se le inventa un punto (la API ya lo
  hace así en el filtro `bbox`).
- Búsqueda con `%` o `_` → la API ya escapa el patrón; la pantalla no pre-procesa el input.
- Unidad de otro investor → 403. La pantalla lo muestra como error, no como vacío.
- Contrato inexistente para la unidad → 404 en la fila 23-24: la unidad puede no tener contrato aún.
- Release sin TXID → "Pendiente". **Nunca** "Verificado" (regla 17).
- Bundle sin Merkle root → la fila 25m muestra los hashes por archivo sin afirmar integridad del
  paquete.
- Dossier incompleto → la barra de completeness lo refleja; no se bloquea la pantalla.
- Invitación ya aceptada o vencida → la fila 63 no ofrece el botón; muestra el estado.
- Lista vacía en 13, 22 y en el inbox → estado vacío del diccionario, no una tarjeta fantasma.

## Preguntas abiertas — no las decidas solo

1. **Los paths difieren entre entregables.** M2-D1 dice `/unit/:unitId`; M2-D5 dice
   `/investor/unit/:unitId`. Esta spec toma **M2-D5**, porque el loop de `CLAUDE.md` manda usar la
   fila. `/project/:projectId` va sin prefijo de rol, como lo escriben los dos.
2. **La superficie pública del dossier compartido** (`INV-DOSSIER-PUBLIC-002`): el endpoint
   `GET /public/dossier/:shareToken` existe y no pide auth, pero M2-D5 no le da una fila de ruta
   propia. Hace falta una ruta del front **fuera del guard**. Confirmá el path antes de crearla.
3. **Las capturas 59/60 (reputación del developer) no tienen fila en M2-D5**, pero M2-D1 las lista
   en el árbol del investor como *"Developer profile (linked from project)"*. Superficie sin
   backlog: hay que decidir si entra.
4. **No hay sidebar de desktop.** `BottomNav` es `md:hidden` y M2-D3 pide sidebar; la captura 61
   (`61-DESKTOP-HOME`) es exactamente eso. No es de ninguna pantalla del investor: es del shell, y
   es una rebanada aparte.
5. **La suite e2e corre contra la base de desarrollo sin aislamiento.** Ningún test puede afirmar
   cantidades. Escribí aserciones de estructura y de presencia, no de conteo.
