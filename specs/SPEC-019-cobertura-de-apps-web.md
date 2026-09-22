# SPEC-019 — Cobertura de `apps/web`: las cuatro métricas ≥95%

> Nace el 2026-09-22 de partir [`SPEC-017`](SPEC-017-cobertura-95-en-toda-la-app.md), que quedó
> demasiado grande. Es su paso 5 (web) más sus pasos 7 (CI) y 8 (evidencia), que dependen de que la
> web cierre. **Es lo único que separa al criterio 2 del SOM de ✅**: shared, cardano y contratos
> cerraron en SPEC-017, y la API ya pasa el 95% de líneas (lo que persigue
> [`SPEC-018`](SPEC-018-cobertura-de-apps-api.md) es una vara más estricta).
>
> Nivel 🟢 (tests). El paso final toca CI (🟡).

## Dónde está hoy

Medido el 2026-09-22 (`apps/web/coverage/coverage-summary.json`, después de las tandas notary y
certifier de SPEC-017), con `coverage.include` sobre todo `src/`:

| Métrica | Hoy | Vara | Falta |
|---|---|---|---|
| Statements | **36,20%** (724/2.000) | ≥95% | ~1.176 |
| Branches | **29,23%** (573/1.960) | ≥95% | ~1.289 |
| Functions | **37,22%** (284/763) | ≥95% | ~441 |
| Lines | **37,18%** (660/1.775) | ≥95% | ~1.027 |

**117 archivos con código; 27 ya están al 100% en las cuatro; 90 no.** A diferencia de la API, acá
no se encontró ningún techo estructural: las pantallas no tienen el wrapper `matched` ni guardias
`require.main`, así que el 95% (y probablemente el 100%) es alcanzable con tests solos.

## Cómo se testea una pantalla

El patrón ya existe y escaló sin cambios a dos roles (SPEC-017 §Tanda notary, §Tanda certifier):
`routes/-test-mount.tsx` con `autenticarComo(user)` y `montarRuta(Componente, path, rutasExtra?,
entrada?)`, el componente sacado con `Route.options.component`, y `api` mockeado método por método
con `vi.spyOn`. **Ninguna pantalla de las que faltan usa `loader` ni `beforeLoad`** (verificado con
grep), así que montar solo el componente alcanza en todas.

## Paso 0 — la preparación compartida (serial, antes de W1–W6)

Todo lo que varios lotes necesitarían tocar a la vez va acá, en un commit, para que después no lo
toque nadie:

1. **`-test-mount.tsx`: `DEVELOPER_USER`, `INVESTOR_USER` y `ADMIN_USER`**, con los roles de
   `auth/roles.ts` (`developer`, `buyer`, `admin`). Hoy solo están `NOTARY_USER` y `CERTIFIER_USER`:
   si W1–W6 los agregan cada uno por su lado, los seis editan el mismo archivo.
2. **`montarRuta` con `validateSearch` opcional.** `investor.buy.tsx` e `investor.notifications.tsx`
   leen `Route.useSearch()` sobre un `validateSearch` propio (`parseBuySearch`, `parseSearch`). La
   ruta que arma el helper no lo declara, así que la pantalla recibiría el search crudo, sin los
   defaults del parser. Es probable que haga falta pasarlo; se confirma al escribirlo.
3. **Código muerto, se borra en vez de testearse** (el mismo criterio que `lib/params.ts` en la API,
   SPEC-017 §`apps/api`): `auth/useSession.ts` (`useRequireSession`, 10 statements) no lo importa
   nadie, solo lo menciona un comentario de `i18n/useTranslation.tsx`; y `formatCompact` de
   `i18n/format.ts` no tiene ningún uso. Confirmar con grep antes de borrar.
4. **`routes/-test-mount.tsx` fuera del denominador.** Es soporte de test que vive en `src/` por la
   convención del prefijo `-` de TanStack Router, y hoy cuenta como código de la app (95%, un
   statement sin cubrir). Sacarlo del `include` no esconde código de producción.
5. **`main.tsx`: tratarlo como `server.ts` de la API.** Es el bootstrap (`createRoot(...).render`),
   el equivalente exacto de `apps/api/src/server.ts`, que la API excluye. SPEC-017 decía que
   `server.ts` "vuelve a contar" y **nunca se hizo** (`apps/api/vitest.config.mts` lo sigue
   excluyendo). Decisión del dueño: o se excluyen los dos, o los dos cuentan con su lógica
   extraída. Lo que no puede quedar es un criterio distinto para cada lado.

## Los lotes — archivo por archivo

Solo los 90 archivos que no están al 100% en las cuatro métricas, agrupados por lote y ordenados por
lo que les falta (statements + branches sin cubrir).

| Lote | Qué | Archivos | Statements sin cubrir | Branches sin cubrir | Depende de |
|---|---|---|---|---|---|
| **W0** | La preparación compartida (arriba) | 1 | 1 | 0 | — |
| **W1** | Pantallas del developer, panel (`developer.*` sin `$projectId`) | 10 | 223 | 201 | W0 |
| **W2** | Pantallas del developer, por proyecto (`developer.project.$projectId.*`) | 5 | 199 | 182 | W0 |
| **W3** | Pantallas del investor, panel (`investor.*` sin `unit`) | 6 | 165 | 158 | W0 (`validateSearch`) |
| **W4** | Pantallas del investor, por unidad (`investor.unit.$unitId.*`) | 4 | 174 | 199 | W0 |
| **W5** | `project.$projectId.*` — **son del investor** (`INVESTOR_ROLES`, verificado), no "compartidas" como decía SPEC-017 | 4 | 209 | 275 | W0 |
| **W6** | Admin, públicas e infraestructura: `admin.index`, `public.dossier.$shareToken`, `index`, `__root`, `main`, `router`, `useSession`, `lib/observability` | 8 | 90 | 66 | W0 (puntos 3 y 5) |
| **W7** | Modales y `components/ui/dialog.tsx` | 9 | 102 | 79 | — |
| **W8** | El resto de `components/` (cards, controles, `PanelLayout`, `ProfileScreen`, `ProjectCard`, `ActionCard`) | 24 | 52 | 172 | — |
| **W9** | `lib/`, `auth/`, `i18n/`, `api/port.ts`, y las ramas sueltas de `notary.*`/`certifier.*`/`login` | 19 | 61 | 55 | — |

**W8 es casi todo branches** (52 statements, 172 branches): los componentes ya se renderizan, pero
solo con una combinación de props. `StatCard` (9/19), `ProjectCard` (0/39) y `ActionCard` (0/16) son
variantes (`tone`, `size`, con o sin ícono) que un test de pantalla nunca va a recorrer todas: el
lugar para cubrirlas es el test del componente.

| Archivo | Statements | Branches | Functions | Lines | Lote |
|---|---|---|---|---|---|
| `routes/-test-mount.tsx` | 95% (19/20) | 100% (3/3) | 88,88% (8/9) | 95% (19/20) | W0 |
| `routes/developer.audit-log.tsx` | 0% (0/40) | 0% (0/44) | 0% (0/13) | 0% (0/31) | W1 |
| `routes/developer.progress.tsx` | 0% (0/43) | 0% (0/30) | 0% (0/16) | 0% (0/33) | W1 |
| `routes/developer.units.tsx` | 0% (0/32) | 0% (0/26) | 0% (0/10) | 0% (0/27) | W1 |
| `routes/developer.capital.tsx` | 0% (0/21) | 0% (0/23) | 0% (0/7) | 0% (0/19) | W1 |
| `routes/developer.documentation.tsx` | 0% (0/22) | 0% (0/18) | 0% (0/10) | 0% (0/19) | W1 |
| `routes/developer.projects.tsx` | 0% (0/15) | 0% (0/20) | 0% (0/5) | 0% (0/14) | W1 |
| `routes/developer.project.new.tsx` | 13,63% (3/22) | 0% (0/14) | 12,5% (1/8) | 15% (3/20) | W1 |
| `routes/developer.index.tsx` | 0% (0/13) | 0% (0/14) | 0% (0/5) | 0% (0/12) | W1 |
| `routes/developer.investors.tsx` | 0% (0/10) | 0% (0/10) | 0% (0/3) | 0% (0/9) | W1 |
| `routes/developer.profile.tsx` | 0% (0/8) | 0% (0/2) | 0% (0/2) | 0% (0/7) | W1 |
| `routes/developer.project.$projectId.upload.tsx` | 0% (0/67) | 0% (0/54) | 0% (0/19) | 0% (0/57) | W2 |
| `routes/developer.project.$projectId.units.tsx` | 0% (0/55) | 0% (0/63) | 0% (0/15) | 0% (0/50) | W2 |
| `routes/developer.project.$projectId.invite.tsx` | 0% (0/36) | 0% (0/27) | 0% (0/10) | 0% (0/31) | W2 |
| `routes/developer.project.$projectId.contracts.tsx` | 0% (0/21) | 0% (0/20) | 0% (0/7) | 0% (0/18) | W2 |
| `routes/developer.project.$projectId.index.tsx` | 0% (0/20) | 0% (0/18) | 0% (0/8) | 0% (0/18) | W2 |
| `routes/investor.buy.tsx` | 0% (0/78) | 0% (0/100) | 0% (0/41) | 0% (0/68) | W3 |
| `routes/investor.notifications.tsx` | 0% (0/44) | 0% (0/28) | 0% (0/20) | 0% (0/42) | W3 |
| `routes/investor.favorites.tsx` | 0% (0/17) | 0% (0/16) | 0% (0/6) | 0% (0/16) | W3 |
| `routes/investor.units.tsx` | 0% (0/11) | 0% (0/10) | 0% (0/3) | 0% (0/10) | W3 |
| `routes/investor.menu.tsx` | 0% (0/10) | 0% (0/2) | 0% (0/3) | 0% (0/9) | W3 |
| `routes/investor.profile.tsx` | 0% (0/5) | 0% (0/2) | 0% (0/1) | 0% (0/4) | W3 |
| `routes/investor.unit.$unitId.index.tsx` | 0% (0/87) | 0% (0/124) | 0% (0/38) | 0% (0/79) | W4 |
| `routes/investor.unit.$unitId.dossier.tsx` | 0% (0/30) | 0% (0/29) | 0% (0/13) | 0% (0/29) | W4 |
| `routes/investor.unit.$unitId.contract.tsx` | 0% (0/28) | 0% (0/28) | 0% (0/12) | 0% (0/26) | W4 |
| `routes/investor.unit.$unitId.notifications.tsx` | 0% (0/29) | 0% (0/18) | 0% (0/12) | 0% (0/26) | W4 |
| `routes/project.$projectId.stage.$stageId.tsx` | 0% (0/83) | 0% (0/109) | 0% (0/40) | 0% (0/75) | W5 |
| `routes/project.$projectId.index.tsx` | 0% (0/68) | 0% (0/88) | 0% (0/32) | 0% (0/60) | W5 |
| `routes/project.$projectId.progress.tsx` | 0% (0/34) | 0% (0/37) | 0% (0/10) | 0% (0/30) | W5 |
| `routes/project.$projectId.developer.tsx` | 0% (0/24) | 0% (0/41) | 0% (0/9) | 0% (0/20) | W5 |
| `routes/admin.index.tsx` | 0% (0/49) | 0% (0/44) | 0% (0/19) | 0% (0/44) | W6 |
| `routes/public.dossier.$shareToken.tsx` | 0% (0/7) | 0% (0/8) | 0% (0/3) | 0% (0/7) | W6 |
| `auth/useSession.ts` | 0% (0/10) | 0% (0/2) | 0% (0/2) | 0% (0/10) | W6 |
| `lib/observability.ts` | 0% (0/6) | 0% (0/6) | 0% (0/1) | 0% (0/6) | W6 |
| `routes/index.tsx` | 0% (0/7) | 0% (0/4) | 0% (0/2) | 0% (0/7) | W6 |
| `main.tsx` | 0% (0/7) | 0% (0/2) | 100% (0/0) | 0% (0/6) | W6 |
| `router.tsx` | 0% (0/2) | 100% (0/0) | 0% (0/1) | 0% (0/2) | W6 |
| `routes/__root.tsx` | 0% (0/2) | 100% (0/0) | 0% (0/1) | 0% (0/1) | W6 |
| `components/domain/LocationMapModal.tsx` | 0% (0/82) | 0% (0/48) | 0% (0/16) | 0% (0/73) | W7 |
| `components/domain/InvitationAcceptModal.tsx` | 60% (3/5) | 50% (9/18) | 50% (2/4) | 60% (3/5) | W7 |
| `components/domain/AnchoringSuccessModal.tsx` | 72,72% (8/11) | 50% (4/8) | 50% (2/4) | 80% (8/10) | W7 |
| `components/domain/ImageGalleryModal.tsx` | 81,25% (13/16) | 63,63% (7/11) | 71,42% (5/7) | 81,81% (9/11) | W7 |
| `components/ui/dialog.tsx` | 66,66% (8/12) | 50% (3/6) | 70% (7/10) | 66,66% (8/12) | W7 |
| `components/domain/DocumentViewerModal.tsx` | 66,66% (2/3) | 58,33% (7/12) | 50% (1/2) | 66,66% (2/3) | W7 |
| `components/domain/ObserveStageModal.tsx` | 62,5% (5/8) | 71,42% (5/7) | 50% (2/4) | 62,5% (5/8) | W7 |
| `components/domain/ShareDossierModal.tsx` | 33,33% (1/3) | 0% (0/2) | 33,33% (1/3) | 33,33% (1/3) | W7 |
| `components/domain/TxidModal.tsx` | 33,33% (1/3) | 0% (0/2) | 33,33% (1/3) | 33,33% (1/3) | W7 |
| `components/domain/ProjectCard.tsx` | 0% (0/6) | 0% (0/39) | 0% (0/3) | 0% (0/6) | W8 |
| `components/PanelLayout.tsx` | 36% (9/25) | 37,5% (9/24) | 50% (2/4) | 36,36% (8/22) | W8 |
| `components/ProfileScreen.tsx` | 46,15% (12/26) | 50% (13/26) | 20% (2/10) | 48% (12/25) | W8 |
| `components/domain/ActionCard.tsx` | 0% (0/1) | 0% (0/16) | 0% (0/1) | 0% (0/1) | W8 |
| `components/domain/FileDropzone.tsx` | 75% (21/28) | 61,53% (16/26) | 60% (6/10) | 81,81% (18/22) | W8 |
| `components/domain/NumberInput.tsx` | 76,92% (10/13) | 70% (21/30) | 83,33% (5/6) | 90% (9/10) | W8 |
| `components/domain/StatCard.tsx` | 100% (3/3) | 47,36% (9/19) | 100% (1/1) | 100% (3/3) | W8 |
| `components/domain/ProgressTimeline.tsx` | 75% (3/4) | 55,55% (10/18) | 66,66% (2/3) | 75% (3/4) | W8 |
| `components/domain/MerkleRootProof.tsx` | 66,66% (2/3) | 58,33% (7/12) | 66,66% (2/3) | 66,66% (2/3) | W8 |
| `components/domain/SelectDropdown.tsx` | 66,66% (2/3) | 58,33% (7/12) | 66,66% (2/3) | 66,66% (2/3) | W8 |
| `components/domain/TextInput.tsx` | 100% (4/4) | 53,84% (7/13) | 100% (2/2) | 100% (4/4) | W8 |
| `components/domain/UnitCard.tsx` | 100% (5/5) | 57,14% (8/14) | 100% (1/1) | 100% (5/5) | W8 |
| `components/domain/Chips.tsx` | 100% (6/6) | 61,53% (8/13) | 100% (3/3) | 100% (6/6) | W8 |
| `components/domain/InvestorCard.tsx` | 100% (4/4) | 50% (5/10) | 100% (3/3) | 100% (4/4) | W8 |
| `components/domain/DocumentCard.tsx` | 100% (2/2) | 80% (16/20) | 100% (1/1) | 100% (2/2) | W8 |
| `components/domain/NotificationCard.tsx` | 100% (3/3) | 71,42% (10/14) | 100% (1/1) | 100% (3/3) | W8 |
| `components/domain/BottomNav.tsx` | 100% (4/4) | 66,66% (4/6) | 100% (4/4) | 100% (3/3) | W8 |
| `components/domain/BuildingSchematic.tsx` | 100% (13/13) | 75% (6/8) | 100% (9/9) | 100% (10/10) | W8 |
| `components/domain/GradientHeader.tsx` | 100% (4/4) | 87,5% (14/16) | 100% (2/2) | 100% (4/4) | W8 |
| `components/domain/HashChip.tsx` | 92,85% (13/14) | 94,44% (17/18) | 75% (3/4) | 100% (12/12) | W8 |
| `components/domain/ReleaseProofList.tsx` | 66,66% (2/3) | 75% (3/4) | 66,66% (2/3) | 66,66% (2/3) | W8 |
| `components/domain/ToggleSwitch.tsx` | 100% (2/2) | 75% (6/8) | 100% (2/2) | 100% (2/2) | W8 |
| `components/domain/LanguageToggle.tsx` | 100% (7/7) | 75% (3/4) | 100% (3/3) | 100% (6/6) | W8 |
| `components/domain/ProgressBar.tsx` | 100% (2/2) | 50% (1/2) | 100% (1/1) | 100% (2/2) | W8 |
| `lib/investor.ts` | 48,57% (17/35) | 35,29% (12/34) | 61,53% (8/13) | 44% (11/25) | W9 |
| `lib/blobUrls.ts` | 0% (0/10) | 100% (0/0) | 0% (0/3) | 0% (0/8) | W9 |
| `lib/evidenceFiles.ts` | 91,83% (45/49) | 81,81% (27/33) | 100% (4/4) | 97,67% (42/43) | W9 |
| `lib/stageProgress.ts` | 54,54% (12/22) | 100% (10/10) | 75% (6/8) | 43,75% (7/16) | W9 |
| `api/port.ts` | 97,61% (123/126) | 89,79% (44/49) | 100% (75/75) | 100% (112/112) | W9 |
| `auth/session.ts` | 72,72% (8/11) | 66,66% (4/6) | 100% (3/3) | 88,88% (8/9) | W9 |
| `auth/useRoleGuard.ts` | 96,42% (27/28) | 75% (12/16) | 100% (4/4) | 100% (26/26) | W9 |
| `i18n/locale.ts` | 76,92% (10/13) | 75% (6/8) | 100% (3/3) | 90,9% (10/11) | W9 |
| `i18n/format.ts` | 77,77% (14/18) | 100% (7/7) | 62,5% (5/8) | 75% (12/16) | W9 |
| `i18n/useTranslation.tsx` | 96% (24/25) | 75% (6/8) | 100% (9/9) | 100% (22/22) | W9 |
| `routes/certifier.issued.tsx` | 100% (10/10) | 81,25% (13/16) | 100% (3/3) | 100% (9/9) | W9 |
| `routes/notary.dossier.$dossierId.tsx` | 96,29% (26/27) | 90,9% (20/22) | 90,9% (10/11) | 96,15% (25/26) | W9 |
| `lib/money.ts` | 90,9% (10/11) | 92,85% (13/14) | 100% (2/2) | 100% (8/8) | W9 |
| `routes/certifier.stage.$stageId.tsx` | 96,42% (27/28) | 95,83% (23/24) | 90,9% (10/11) | 96,29% (26/27) | W9 |
| `routes/login.tsx` | 100% (36/36) | 88,88% (16/18) | 100% (6/6) | 100% (34/34) | W9 |
| `lib/explorer.ts` | 50% (1/2) | 100% (2/2) | 0% (0/1) | 50% (1/2) | W9 |
| `routes/certifier.index.tsx` | 100% (20/20) | 95% (19/20) | 100% (7/7) | 100% (18/18) | W9 |
| `routes/notary.index.tsx` | 100% (8/8) | 91,66% (11/12) | 100% (1/1) | 100% (7/7) | W9 |
| `routes/notary.signed.tsx` | 100% (9/9) | 92,85% (13/14) | 100% (3/3) | 100% (8/8) | W9 |

## Paralelismo — qué se puede hacer a la vez, medido contra el código

**W0 va primero, solo. Después, W1 a W9 pueden correr los nueve a la vez.** W7, W8 y W9 ni siquiera
esperan a W0: no montan pantallas protegidas.

Por qué alcanza con eso:

- **Aislamiento en runtime.** Vitest aísla el grafo de módulos por archivo de test (`isolate` por
  default), así que el `vi.spyOn(api, …)` de un archivo no se ve en otro. No hay base ni servidor
  compartido: el `api` es un singleton, pero cada archivo recibe su propia instancia.
- **Aislamiento en git.** Cada lote crea sus propios archivos de test (`routes/-<pantalla>.test.tsx`
  para las pantallas, como ya hacen notary y certifier) y no toca `src/` salvo W0.

**Los archivos que chocan si nadie los reserva**, y a quién le tocan:

| Archivo | Por qué chocaría | Regla |
|---|---|---|
| `routes/-test-mount.tsx` | Cada rol nuevo necesita su usuario, y W3 necesita `validateSearch` | Solo W0. Si un lote descubre que le falta algo más, lo pide; no lo edita |
| `apps/web/vitest.config.ts` | Cada tanda de SPEC-017 subía los umbrales | Solo W0 (exclusiones) y §Consolidación (umbrales) |
| `specs/SPEC-019-…` (esta) | Cada tanda escribía su sección | Ningún lote la edita: cada agente devuelve su resultado y lo transcribe quien consolida |
| `components/domain/modals.test.tsx` | W7 es su dueño natural | Solo W7 |
| `components/domain/cards.test.tsx`, `controls.test.tsx`, `patterns.test.tsx` | W8 es su dueño natural | Solo W8. W7 no suma casos a `patterns.test.tsx` aunque toque un modal: crea un archivo propio |
| `lib/*.test.ts`, `i18n/*.test.ts`, `auth/useRoleGuard.test.tsx`, `api/port.contract.test.ts`, los `-notary.*`/`-certifier.*`/`-login.test.tsx` | W9 es su dueño natural | Solo W9 |

**El orden no cambia el resultado, pero sí cuánto trabajo parece que queda.** Un test de pantalla
recorre de paso los componentes que monta: `ProfileScreen` subió solo con las tandas notary y
certifier. Así que W7 y W8, si corren a la vez que las pantallas, van a ver números que siguen
bajando. No es un problema — las variantes que les tocan (props, tonos, estados vacíos) no las
recorre ninguna pantalla — pero **cada lote reporta qué cubrió (casos), no un porcentaje**, y el
número se mide una sola vez, al consolidar.

**En la práctica:** nueve agentes en worktrees son ~7 GB (`CLAUDE.md` §Worktrees, ~750 MB cada
uno); con 33 GB libres el 2026-09-22 alcanza, pero conviene de a cuatro o cinco y borrar cada
worktree apenas su rama está en `main`. Una tanda razonable: W0 → (W1, W2, W3, W4, W5 en paralelo)
y W6–W9 en cualquier hueco.

## Consolidación, CI y evidencia (serial, al final)

Absorbe los pasos 7 y 8 de SPEC-017, que esperaban a la web:

1. Con los diez lotes en `main`: `pnpm --filter @plataforma/web test:coverage` y la tabla de arriba
   regenerada. Lo que quede bajo 95%, con su razón.
2. Umbrales de `apps/web/vitest.config.ts` al valor medido.
3. **CI (🟡):** hoy `.github/workflows/ci.yml` corre `test:coverage` **solo de la API**; web, shared
   y cardano corren `test` pelado, sin umbral. Pasa a correr `test:coverage` de las cuatro partes
   TypeScript. Shared y cardano ya están ≥95% en las cuatro métricas desde SPEC-017, así que esa
   mitad **se puede adelantar en cualquier momento**, sin esperar a la web.
4. **Evidencia:** una corrida nueva de CI, y con ella `specs/EVIDENCIA-2026-09-21-reporte-de-tests.md`,
   su versión en inglés `specs/evidencia-m3/1-repo-ci-tests/test-report.md`, el log de CI y el PDF
   (`bash scripts/evidencia-pdf/generar.sh`). El criterio 2 de `specs/README.md` pasa a ✅ y el ítem
   3.15 de `CLAUDE.md` se cierra.

## Criterio de cierre

- `apps/web` con las cuatro métricas ≥95%, medidas con `include` sobre todo `src/`.
- CI corriendo `test:coverage` con umbral en las cuatro partes TypeScript.
- El reporte de tests de la evidencia de M3 actualizado con esa corrida.
