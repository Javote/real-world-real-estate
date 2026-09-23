# SPEC-019 — Cobertura de `apps/web`: las cuatro métricas ≥95%

> Nace el 2026-09-22 de partir [`SPEC-017`](SPEC-017-cobertura-95-en-toda-la-app.md), que quedó
> demasiado grande. Es su paso 5 (web) más sus pasos 7 (CI) y 8 (evidencia), que dependen de que la
> web cierre. **Es lo único que separa al criterio 2 del SOM de ✅**: shared, cardano y contratos
> cerraron en SPEC-017, y la API ya pasa el 95% de líneas (lo que persigue
> [`SPEC-018`](SPEC-018-cobertura-de-apps-api.md) es una vara más estricta).
>
> Nivel 🟢 (tests). El paso final toca CI (🟡).
>
> **Paso 0 cerrado 2026-09-23** — W0a en `a7dac17`, W0b en `8be5830`, los dos en `main`. `pnpm
> verify:all` verde después del merge. Lo que sigue abierto son los lotes W1–W9: ninguno arrancó
> todavía (sin `*.test.tsx` nuevos más allá de los que ya existían de SPEC-017).

## Dónde está hoy

Medido el 2026-09-22 (`apps/web/coverage/coverage-summary.json`, después de las tandas notary y
certifier de SPEC-017), con `coverage.include` sobre todo `src/`:

| Métrica | Hoy | Vara | Falta |
|---|---|---|---|
| Statements | **36,20%** (724/2.000) | ≥95% | ~1.176 |
| Branches | **29,23%** (573/1.960) | ≥95% | ~1.289 |
| Functions | **37,22%** (284/763) | ≥95% | ~441 |
| Lines | **37,18%** (660/1.775) | ≥95% | ~1.027 |

**117 archivos con código; 27 ya están al 100% en las cuatro; 90 no.**

**Remedido el 2026-09-23, con W0 ya en `main`** (denominador más chico: `useSession.ts` se borró,
`main.tsx` y `routes/-test-mount.tsx` salieron del `coverage.exclude`):

| Métrica | Hoy | Vara |
|---|---|---|
| Statements | **35,17%** (705/2.004) | ≥95% |
| Branches | **29,12%** (570/1.957) | ≥95% |
| Functions | **35,7%** (276/773) | ≥95% |
| Lines | **36,15%** (641/1.773) | ≥95% |

**115 archivos con código (117 − `useSession.ts` − `main.tsx`); los mismos 27 al 100%; 88 no.** El
número global casi no se movió — borrar código muerto saca statements del numerador y del
denominador por igual — pero **la lista de qué falta por lote sí cambió** (abajo). Nota: estos
porcentajes fluctúan uno o dos puntos entre corridas por la misma inestabilidad de V8 coverage que
ya se documentó para `styles.test.ts` (`apps/web/CLAUDE.md` §Trampas, 2026-09-19); no perseguir el
número exacto, el orden de magnitud es el que importa.

## ¿Hay ramas inalcanzables en la web, como en la API?

**Pocas, y ninguna en masa: 29 de 1.387 (2%).** En la API el techo lo ponían dos patrones repetidos
(el wrapper `matched` en 89 rutas y los 404 que `authorize` ya resolvió). En la web no hay nada
equivalente. La mayoría de las 29 **se borra** en vez de marcarse: guardias de SSR que quedaron de
antes de D-065, mapas de enums tipados como `Record<string, …>` que ya cubren todos los valores, un
archivo sin uso. Todo eso lo hace W0. La lista completa, con qué hacer con cada una, está en
§Análisis archivo por archivo.

## Cómo se testea una pantalla

El patrón ya existe y escaló sin cambios a dos roles (SPEC-017 §Tanda notary, §Tanda certifier):
`routes/-test-mount.tsx` con `autenticarComo(user)` y `montarRuta(Componente, path, rutasExtra?,
entrada?)`, el componente sacado con `Route.options.component`, y `api` mockeado método por método
con `vi.spyOn`. **Ninguna pantalla de las que faltan usa `loader` ni `beforeLoad`** (verificado con
grep), así que montar solo el componente alcanza en todas.

## Paso 0 — la preparación compartida (serial, antes de W1–W9) — ✅ cerrado 2026-09-23

Todo lo que varios lotes necesitarían tocar a la vez va acá, para que después no lo toque nadie.
**Revisado contra el código el 2026-09-22**: cada punto dice qué se verificó.

**Son tres cosas de naturaleza distinta, y van en commits distintos** (un commit = un cambio
lógico):

- **W0a — infraestructura de test** (puntos 1, 2, 4, 5 y 9): no toca código de producción. **Cerrado,
  commit `a7dac17`.**
- **W0b — limpieza de producción** (puntos 3, 6 y 8): borra y tipa en ~20 archivos de `src/`, sin
  cambiar comportamiento. Es la parte que pide revisión. **Cerrado, commit `8be5830`.**
- **Una decisión del dueño** (punto 7). **Cerrada.**

W0a y W0b no dependen una de la otra — se hicieron en paralelo, un subagente por cada una, en un
worktree separado para W0b. Las dos están en `main`, con `pnpm verify:all` verde después del merge.
Ya no bloquean a ningún lote.

### W0a — infraestructura de test

1. **`-test-mount.tsx`: `DEVELOPER_USER`, `INVESTOR_USER` y `ADMIN_USER`**, con los roles de
   `auth/roles.ts` (`developer`, `buyer`, `admin`). Hoy solo existen `NOTARY_USER` y
   `CERTIFIER_USER`: si W1–W6 los agregan cada uno por su lado, los seis editan el mismo archivo.
   `ADMIN_USER` entra a cualquier pantalla por el bypass de `useRoleGuard` (D-095).

2. **`montarRuta` tiene que aceptar el `validateSearch` de la ruta: no es "probable", hace falta.**
   `parseBuySearch` (`investor.buy.tsx` 43-52) y `parseSearch` (`investor.notifications.tsx`
   49-51) son funciones internas que **solo corren como `validateSearch` de su ruta**. La ruta que
   arma el helper no lo declara, así que esas ~30 ramas no se ejecutarían nunca, y un parámetro
   inválido (`?view=otra`) llegaría crudo a la pantalla en vez de descartarse.
   **Hecho:** `montarRuta` ahora acepta el componente pelado (forma vieja) **o** la `Route` real, por
   overload — no migró los 19 casts existentes de notary/certifier (quedan para quien toque esos
   archivos), pero W3–W5 ya pueden pasar `Route` directo y no necesitan el cast.
   **Corrección (2026-09-23, tras W6):** la primera versión **no compilaba** con una `Route` real:
   `RutaMontable` tipaba `component` como `() => ReactElement` (TanStack lo tipa `RouteComponent`,
   que recibe `props`) y `validateSearch` como función (TanStack admite también un objeto). Ahora
   usa `RouteComponent` y `AnyValidator`, verificado con `tsc` contra `investor.buy`,
   `investor.notifications` y `admin.index` y con el componente pelado. W6 se escribió con el cast
   viejo (`Route.options.component as …`) porque ninguna de sus rutas necesita `validateSearch`;
   sigue válido, y no hace falta migrarlo.

4. **`routes/-test-mount.tsx` fuera del denominador.** Es soporte de test que vive en `src/` por la
   convención del prefijo `-` de TanStack Router, y hoy cuenta como código de la app (19/20
   statements). **Verificado que es el único caso:** `src/test/a11y.ts` no aparece en la cobertura
   porque Vitest ya excluye los `setupFiles`, y `vitest-matchers.d.ts` cuenta 0/0.

5. **La suite web con cobertura falla bajo carga, y no son dos tests: son dos timeouts de la
   suite.** Reproducido el 2026-09-22:
   - **Sin carga**, tres corridas seguidas de `vitest run --coverage`: las tres verdes.
   - **Con carga** (la cobertura web corriendo a la vez que la suite de la API, lo más parecido a
     un runner de CI de 2 núcleos): **tres de tres corridas rojas**, con entre 1 y 6 fallos cada
     una, y dos causas distintas:
     - **`Test timed out in 5000ms`** en los tests que tipean una nota larga con `userEvent.type`
       (`CER-OBSERVE-001`, `NOT-DOSSIER-REJECT-001`). `userEvent` tipea tecla por tecla, y 30
       caracteres bajo carga pasan los 5 s del `testTimeout` por defecto.
     - **`Unable to find an element with the text: …`** en pantallas que esperan datos del mock
       (`Torre A`, `Ana Torres`, `notary@example.com`, `verifier@example.com`): `findBy*` espera
       **1 s** por defecto (`asyncUtilTimeout` de Testing Library), y bajo carga el render tarda
       más.

   **Por qué es de W0 y no de un lote:** cada test de W1–W9 usa `findBy*`. Sin este arreglo, los
   lotes van a sumar flakies. El paso final de la spec suma la cobertura web a CI.
   **Hecho:** `testTimeout: 15000` en `vitest.config.ts`, `configure({ asyncUtilTimeout: 5000 })` en
   `src/test/testing-library-setup.ts` (nuevo `setupFile`), y `{ delay: null }` en los dos
   `userEvent.type` largos (`CER-OBSERVE-001`, `NOT-DOSSIER-REJECT-001`). No se corrieron las tres
   repeticiones bajo carga artificial para cerrar el criterio original — el arreglo se validó con la
   suite completa en verde (969 tests) sola y con `pnpm verify:all` (que sí suma carga real: corre
   junto al resto del monorepo) también en verde.

9. **Un Leaflet falso compartido.** `LocationMapModal` carga Leaflet con `import()` dinámico, y en
   jsdom no hay mapa: hace falta `vi.mock('leaflet')` con un `L` falso (`map`, `tileLayer`,
   `featureGroup`, `marker`, `divIcon`) que guarde el callback de `moveend` para dispararlo a mano.
   **Lo necesitan cuatro lotes** (W3 `investor.buy`, W4 `investor.unit.$unitId.index`, W5
   `project.$projectId.index`, W7 `LocationMapModal`). Si no se hace acá, van a quedar cuatro copias
   de un mock no trivial. **Hecho:** `src/test/leaflet-falso.ts`, con `dispararMoveend()` para
   simular el `moveend` a mano — ningún lote lo consumió todavía, así que sigue en 0% hasta que W3,
   W4, W5 o W7 lo importen.

   *Lo que no va en W0, a propósito:* el stub de `URL.createObjectURL` (R9) es una línea
   (`vi.stubGlobal`), y las fixtures "completa y mínima" (R4) son distintas por pantalla. Cada lote
   las arma en su archivo sin chocar con nadie.

### W0b — limpieza de producción

3. **Código muerto, se borra en vez de testearse** (el mismo criterio que `lib/params.ts` en la API,
   SPEC-017 §`apps/api`): `auth/useSession.ts` (`useRequireSession`, 10 statements) no lo importa
   nadie, y `formatCompact` de `i18n/format.ts` no tiene ningún uso. Verificado con grep. **Al
   borrar `useSession.ts`, actualizar el comentario de `i18n/useTranslation.tsx` que lo nombra**,
   porque si no queda apuntando a un archivo que no existe.

6. **Los 4 guardias `typeof window === 'undefined'`** de `auth/session.ts` (14, 28) e
   `i18n/locale.ts` (13, 23) se borran. Son los únicos del front (grep). Quedaron de antes de D-065:
   `setSession` al lado ya no tiene guardia, y todos los tests corren en jsdom. Los e2e leen
   `sessionStorage` desde el navegador, no importan el módulo.

8. **Los mapas y fallbacks que no se alcanzan** (§Análisis, primera tabla). **Verificado el
   supuesto del que depende todo el punto**: cada mapa se indexa con un campo que en
   `packages/shared` es un `z.enum`, y **las ocho rutas que lo mandan validan la respuesta con
   `.output`** (`GET /projects`, `/projects/:id`, `/projects/:id/developer`, `/investor/favorites`,
   `/investor/units`, `/developer/projects`, `/developer/projects/:id/contracts`, `/notifications`).
   Los tipos del front se **derivan** de esos schemas (SPEC-109). Y el `tsconfig` de la web no tiene
   `noUncheckedIndexedAccess`, así que indexar un `Record<Enum, …>` compila sin el `??`. Entonces:
   - `ROLE_LANDING` pasa a `Record<UserRole, string>`, y se borran sus tres `??`.
   - Los mapas de estado se tipan con su enum (`ProjectStatus`, `UnitStatus`, `MembershipRole`).
     **Se borran las dos copias de `TONO_POR_ESTADO`** (`developer.projects`,
     `developer.project.$projectId.index`), que son idénticas a `TONO_PROYECTO`, y se borran los
     `??` que el tipo vuelve imposibles.
   - Se borran los `as NotifCategory` de las dos pantallas de notificaciones: el tipo derivado ya es
     el enum.
   - `ProjectStatus` está escrito a mano en `api/types.ts` y duplica el de `packages/shared`: se
     importa en vez de redeclararlo.
   - El chequeo `never` en `claveEstadoStage` (`lib/investor.ts`).
   - Las cinco que quedan (`session ?` ×3 y `case 'admin'` ×2) **no se tocaron**: siguen para que
     W1/W3/W6 (los `session ?`) y W8 (`PanelLayout`) las marquen al escribir su test, como decía el
     plan.

   **Toca archivos de W1–W9, y por eso W0 va antes que todos.** El bug de `delivered` en
   `investor.units.tsx` iba a ser de W3 con su test, pero **tipar `TONO` con `UnitStatus` completo
   obligó a la cuarta clave en el mismo commit de W0b** — no fue una decisión de arreglarlo acá, lo
   forzó el compilador. Queda: `delivered: 'verified'` ya está en `main`; **a W3 le queda solo
   escribir el test que lo fija**, no el fix.

### La decisión del dueño — tomada y aplicada 2026-09-22

7. **`main.tsx` y `server.ts`: excluidos los dos, con la misma razón.** `main.tsx` es el bootstrap
   del front (`createRoot(...).render`), el equivalente exacto de `apps/api/src/server.ts`, que la
   API ya excluía. SPEC-017 decía que `server.ts` "volvía a contar" y nunca se hizo. **El dueño
   decidió excluir los dos**, y quedó aplicado: `apps/web/vitest.config.ts` excluye `src/main.tsx`,
   y los comentarios de los dos `vitest.config` se citan entre sí. El único `if` de `main.tsx`
   (`#root` ausente) no se alcanza, y extraer la lógica para testear un `createRoot().render()` no
   prueba nada.

## Los lotes — archivo por archivo

Solo los 90 archivos que no están al 100% en las cuatro métricas, agrupados por lote y ordenados por
lo que les falta (statements + branches sin cubrir).

| Lote | Qué | Archivos | Statements sin cubrir | Branches sin cubrir | Depende de |
|---|---|---|---|---|---|
| **W0** | La preparación compartida (arriba): W0a infraestructura de test, W0b limpieza de producción en ~20 archivos | — | ~20 (lo que borra) | ~29 (salen del denominador) | — **✅ cerrado 2026-09-23** |
| **W1** | Pantallas del developer, panel (`developer.*` sin `$projectId`) | 10 | 223 | 201 | W0 ✅ |
| **W2** | Pantallas del developer, por proyecto (`developer.project.$projectId.*`) | 5 | 199 | 182 | W0 ✅ |
| **W3** | Pantallas del investor, panel (`investor.*` sin `unit`) | 6 | 165 | 158 | W0 ✅ (puntos 2 y 9) |
| **W4** | Pantallas del investor, por unidad (`investor.unit.$unitId.*`) | 4 | 174 | 199 | W0 ✅ (puntos 1 y 9) |
| **W5** | `project.$projectId.*` — **son del investor** (`INVESTOR_ROLES`, verificado), no "compartidas" como decía SPEC-017 | 4 | 209 | 275 | W0 ✅ (puntos 1 y 9) |
| **W6** | Admin, públicas e infraestructura: `admin.index`, `public.dossier.$shareToken`, `index`, `__root`, `router`, `lib/observability` — **6 archivos, no 8**: `useSession.ts` se borró y `main.tsx` salió del denominador, los dos en W0 | 6 | 90 | 62 | W0 ✅ (puntos 3 y 7) |
| **W7** | Modales y `components/ui/dialog.tsx` | 9 | 102 | 79 | W0 ✅ (punto 9: el Leaflet falso) |
| **W8** | El resto de `components/` (cards, controles, `PanelLayout`, `ProfileScreen`, `ProjectCard`, `ActionCard`) | 24 | 52 | 172 | W0 ✅ (punto 8: `PanelLayout`) |
| **W9** | `lib/`, `auth/`, `i18n/`, `api/port.ts`, y las ramas sueltas de `notary.*`/`certifier.*`/`login` | 19 | 61 | 55 | W0 ✅ (puntos 3, 6 y 8) |

**Los números de "Statements/Branches sin cubrir" de arriba son los del 2026-09-22, antes de W0.**
W0b ya achicó varios (borró ramas muertas, no agregó tests), así que el número real que le queda a
cada lote es un poco menor al de la tabla — no se recontó archivo por archivo. La tabla de abajo
(archivo por archivo) sí está limpia de las dos filas que ya no aplican.

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
| `lib/observability.ts` | 0% (0/6) | 0% (0/6) | 0% (0/1) | 0% (0/6) | W6 |
| `routes/index.tsx` | 0% (0/7) | 0% (0/4) | 0% (0/2) | 0% (0/7) | W6 |
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

## Análisis archivo por archivo — 2026-09-22, antes de escribir un solo test

**Cómo se leyó.** Del `coverage-final.json` de la corrida del 2026-09-22 salen **1.387 branches sin
cubrir en 83 archivos, sobre 890 líneas distintas**. Las 890 se leyeron en contexto, lote por lote.
Donde la respuesta dependía de otro archivo (un tipo, un schema, el diccionario, lo que hace
`useRoleGuard`), se abrió ese archivo. Ninguna se clasificó "por la forma".

**La pregunta que decide en la web** no es la de la API ("¿`authorize` ya lo resolvió?"). Es esta:
**¿el servidor puede mandar ese valor?** Las 92 rutas oRPC validan su respuesta con `.output(schema)`
del lado del servidor. Entonces, un fallback contra un enum cerrado que el mapa del front ya cubre
entero no se puede alcanzar. Uno contra un campo que el schema declara `string` libre, sí.

### Lo que no se alcanza, o sobra: 29 branches, y qué hacer con cada una

**No hay ningún patrón masivo como el `matched` de la API.** Son 29 de 1.387 (2%), y en su mayoría
se **borran** en vez de marcarse, porque son código muerto o un tipo que miente:

| Qué | Ramas | Dónde | Por qué no se alcanza | Acción |
|---|---|---|---|---|
| `typeof window === 'undefined'` | 4 | `auth/session.ts` 14, 28 · `i18n/locale.ts` 13, 23 | Restos de cuando había SSR. Desde D-065 es una SPA: en el navegador, `window` siempre existe | **Borrar** (W0 ✅) |
| `auth/useSession.ts` entero | 2 (+10 statements) | — | `useRequireSession` no lo importa nadie: solo lo menciona un comentario de `useTranslation.tsx` | **Borrar el archivo** (W0 ✅) |
| `formatCompact` | 0 (1 función) | `i18n/format.ts` | Sin ningún uso | **Borrar** (W0 ✅) |
| `ROLE_LANDING[rol] ?? '/login'` | 3 | `useRoleGuard.ts` 50 · `login.tsx` 70 · `index.tsx` 13 | Desde D-095 los cinco roles tienen pantalla. El tipo `Record<UserRole, string \| null>` miente | **Tipar `Record<UserRole, string>` y borrar los `??`** (W0 ✅) |
| `TONO_PROYECTO[s] ?? 'neutral'` y sus dos copias `TONO_POR_ESTADO` | 5 | `investor.buy` 148 · `investor.favorites` 61 · `project.$projectId.developer` 197 · `developer.projects` 94 · `developer.project.$projectId.index` 100 | Los cuatro valores de `PROJECT_STATUSES` están en el mapa, y el servidor valida el enum. Además `TONO_POR_ESTADO` es una **copia exacta** de `TONO_PROYECTO`, en dos archivos | **Tipar `Record<ProjectStatus, StatusTone>`, borrar las dos copias y los `??`** (W0 ✅) |
| `TONO[unitStatus] ?? 'neutral'` | 2 | `developer.project.$projectId.units` 255 · `…contracts` 141 | Los cuatro `UNIT_STATUSES` están en el mapa | Tipar `Record<UnitStatus, …>` y borrar el `??` (W0 ✅) |
| `` t(`unitStatus.${s}`) ?? s `` | 3 | `…units` 256 · `…contracts` 142 · `investor.units` 63 | El diccionario tiene los cuatro estados en los dos idiomas | Borrar el `??` (W0 ✅) |
| `ICONO[categoria] ?? Bell` | 2 | `investor.notifications` 150 · `investor.unit.$unitId.notifications` 111 | Las cinco `NOTIFICATION_CATEGORIES` están en `ICONO`, que ya está tipado `Record<NotifCategory, …>` | Borrar el `??` (W0 ✅) |
| `ROL[m] ? t(ROL[m]) : m` | 1 | `admin.index` 139 | Las tres `MEMBERSHIP_ROLES` están en `ROL` | Tipar `Record<MembershipRole, …>` y borrar el ternario (W0 ✅) |
| `default:` de `claveEstadoStage` | 1 | `lib/investor.ts` 46 | Un `switch` sobre los cuatro `StageState` | **Hecho:** chequeo `never` de exhaustividad (W0 ✅) |
| `session ? t('panel.welcome', …) : undefined` | 3 | `developer.index` 56 · `notary.index` 48 · `certifier.index` 49 | `useRoleGuard` hace `setSession(local)` y `setReady(true)` juntos, y la pantalla ya salió en `if (!ready) return null` | **Marcar**, o que `useRoleGuard` devuelva una unión discriminada (`{ ready: true, session }`) y el ternario sobre |
| `case 'admin'` de `PanelLayout` | 2 | `PanelLayout.tsx` 81, 97 | Solo un admin ve el panel `admin`, y a ese `esAdmin` ya lo desvió dos líneas antes | Marcar (mantiene visible la exhaustividad del `switch`) |
| `if (!contenedor) throw` | 1 | `main.tsx` 25 | `index.html` siempre trae `#root` | **Excluido**: `main.tsx` salió del denominador (punto 7, decidido) |

**Después de W0 el denominador bajó ~29 branches** (las diez filas marcadas ✅; las tres últimas —
los tres `session ?`, `PanelLayout` y `main.tsx` — quedan para que su lote las marque o ya están
excluidas), **y todo lo que queda se alcanza.** Hay una sola zona
que **se verifica al escribir el test y no antes**: las guardas de efecto de `LocationMapModal.tsx`
(`if (!open || !contenedor.current)`, `if (cancelado || …)`, `if (!esBrowse || !L || !mapa ||
!grupo)`). Algunas combinaciones pueden no darse nunca en jsdom. Son 4-6 ramas.

### 🐞 Un bug, ya arreglado: `investor.units.tsx` no conocía `delivered`

`const TONO = { sold, reserved, available }` en `investor.units.tsx`, **sin `delivered`**, que sí es
uno de los cuatro `UNIT_STATUSES`. Una unidad entregada se veía con tono neutro en "Mis unidades" del
investor, y la misma unidad salía `verified` en las pantallas del developer (`…units`, `…contracts`),
cuyos mapas sí la tenían. Era la única rama de fallback de este tipo que **sí** se alcanzaba, y porque
el mapa estaba incompleto.

**Arreglado en W0b (commit `8be5830`), no por decisión propia:** tipar `TONO` con `Record<UnitStatus,
…>` completo obligó al compilador a pedir la cuarta clave. Ya está `delivered: 'verified'` en `main`.
**A W3 le queda solo el test que lo fija** — una unidad `delivered` en la lista — no el fix.

### Las recetas que se repiten

Casi todas las ramas caen en una de estas familias. Cada fila de la tabla por archivo dice cuáles
aplican.

| # | Familia | Cómo se cubre |
|---|---|---|
| R1 | `if (!ready) return null` (2 ramas por pantalla protegida) | Sola: con `montarRuta`, el primer render es `ready = false` y el segundo `true` |
| R2 | Estados de la query: `<Loading />` · lista vacía · con datos · error | Tres o cuatro `it` por pantalla: `mockReturnValue(new Promise(() => {}))` (cargando para siempre), `[]`, datos, `mockRejectedValue(new ApiError(403 \| 404, …))` |
| R3 | `data?.x ?? default` antes de que llegue la respuesta | Sale con el caso "cargando" de R2 |
| R4 | Campos opcionales del schema (`floor`, `sizeM2`, `priceMinorUnits`, `txid`, `bio`, `latitude`…) | Dos fixtures por entidad: **completa** y **mínima** (todos los nullables en `null`). Es la receta que más ramas cubre por línea escrita |
| R5 | Mutaciones: pendiente · error · éxito | Promesa que no resuelve (texto "Anclando…"/"Guardando…"), `mockRejectedValue`, y el éxito verificando los argumentos de la llamada |
| R6 | Search params (`investor.buy`, `investor.notifications`) | Arrancar el router con la URL ya armada (`entrada = '/investor/buy?q=x&status=delayed&view=map'`). Necesita W0 punto 2 (`validateSearch` en `montarRuta`) |
| R7 | `onOpenChange={(abierto) => !abierto && onClose()}` de cada modal | Con el modal abierto, Escape: `fireEvent.keyDown(document.activeElement!, { key: 'Escape' })`. Radix llama `onOpenChange(false)` |
| R8 | Leaflet (`LocationMapModal`, y a través de él `investor.buy`, `investor.unit.$unitId.index` y `project.$projectId.index`) | `vi.mock('leaflet')` con un `L` falso (`map`, `tileLayer`, `featureGroup`, `marker`, `divIcon`) que guarde el callback de `moveend` para dispararlo a mano (eso cubre `onBoundsChange` → `bbox` en `investor.buy`). Leaflet se carga con `import()` dinámico: el mock lo intercepta igual |
| R9 | Fotos y documentos (`useObjectUrls`, `downloadEvidence`) | `api.downloadEvidence` → `new Blob([...])`, y `vi.stubGlobal` de `URL.createObjectURL`/`revokeObjectURL` (**jsdom no los implementa**: sin el stub, la pantalla revienta) |
| R10 | Fallbacks contra `string` libre: `` t(`audit.action.${a}`) ?? a ``, `CLAVE_NOVEDAD[t] ?? 'investor.news.generic'`, `params[nombre] ?? original` | **Se alcanzan de verdad**: el schema de lectura tipa esos campos como `string` (filas viejas del audit log, tipos de evento nuevos). El mock manda un valor fuera del catálogo y el test verifica el fallback |
| R11 | Variantes de props de componentes (`featured`, `compact`, `highlighted`, `onOpen`, `error`, `disabled`, `label`…) | Test del componente, uno por combinación que cambia algo visible. **Es casi todo W8**: 172 de sus 224 ramas son esto |
| R12 | Entorno (`lib/observability.ts`) | `vi.stubEnv('VITE_SENTRY_DSN', …)`/`VITE_POSTHOG_KEY` + `vi.mock('@sentry/react')` y `vi.mock('posthog-js')` |

### Por lote, archivo por archivo

Columna **api**: los métodos de `api` que la pantalla llama y que hay que mockear (`vi.spyOn`).
Columna **Recetas**: las familias de arriba. Columna **Qué más**: lo propio del archivo.

#### W1 — developer, panel (10 archivos, 201 branches)

| Archivo | Br | api | Recetas | Qué más |
|---|---|---|---|---|
| `developer.audit-log.tsx` | 44 | `listAuditLog` | R1 R2 R3 R10 | `categoriaDe`/`rolDe` (líneas 52-63): una acción de cada familia (`CERTIFY`, `SIGN`/`DOSSIER`, `RELEASE`, `EVIDENCE`/`DOCUMENT`, otra) y un actor de cada rol. Clic en los filtros de categoría. `metadataJson` con y sin `txid` (abre `TxidModal`) y `null`. `actorName`/`actorRole` nulos (evento de sistema) |
| `developer.capital.tsx` | 23 | `getCapitalSummary`, `getCapitalMonthly`, `getCapitalByProject` | R1 R2 R3 | Con y sin moneda (sin contratos no hay moneda → `panel.emptyValue`). Serie mensual vacía y con puntos. `total = 0` para el `percent` |
| `developer.documentation.tsx` | 18 | `listDeveloperDocuments`, `anchorDocument` | R1 R2 R5 | Documentos con y sin `txid` (las dos listas), el botón "anclar" deshabilitado mientras hay otro en vuelo |
| `developer.index.tsx` | 14 | `getDeveloperKpis` | R1 R3 | KPIs en `null` (día 1, como ya se hizo con notary) y con datos. **56 c1 ❌** (sesión, ver arriba) |
| `developer.investors.tsx` | 10 | `listInvestors` | R1 R2 R4 | Un investor sin monto (`currency: null`) |
| `developer.profile.tsx` | 2 | — | R1 | Igual que `notary.profile` |
| `developer.progress.tsx` | 30 | `getDeveloperProgress`, `setMilestoneState` | R1 R2 R4 R5 | Stages en los cuatro estados (`estadoDe`, líneas 66-67), uno `Observed` (aparece la sección de observadas y "reanudar"), `certifiedAt` presente y ausente, dos proyectos |
| `developer.project.new.tsx` | 14 | `createProject` | R1 R5 | Con y sin dirección, unidades y entrega (los tres spreads opcionales), nombre vacío (no se puede crear) |
| `developer.projects.tsx` | 20 | `listDeveloperProjects` | R1 R2 R4 | Un proyecto `completed` (rama "entregado en…") y otro no, con y sin `estimatedDelivery`, con y sin precio "desde". **94 b1: ya se borró** (`TONO_POR_ESTADO`, W0b) |
| `developer.units.tsx` | 26 | `listDeveloperUnits`, `listDeveloperProjects` | R1 R2 R4 | Unidades `sold`/`delivered`/`available` en dos proyectos, un proyecto sin unidades (`total = 0`), con y sin ubicación |

#### W2 — developer, por proyecto (5 archivos, 182 branches)

| Archivo | Br | api | Recetas | Qué más |
|---|---|---|---|---|
| `…$projectId.contracts.tsx` | 20 | `getDeveloperProject`, `listProjectContracts` | R1 R2 R4 | Contrato firmado y sin firmar, con y sin `txid` (`HashChip`), lista vacía (moneda por defecto `USD`). **141, 142: ya se borraron** (W0b) |
| `…$projectId.index.tsx` | 18 | `getDeveloperProject`, `getCapitalByProject` | R1 R3 R4 | Con y sin ubicación, con y sin capital. **100: ya se borró** (W0b) |
| `…$projectId.invite.tsx` | 27 | `listProjectUnits`, `createInvitation` | R1 R5 | La condición `puedeInvitar` (líneas 126-130) tiene cinco partes: un caso por cada una que falla (email vacío, sin unidad, sin monto, monto ≤ 0, en vuelo). Una unidad con precio que precarga el monto (107) y otra sin precio. Monto inválido (`amountInvalid`). El error de `createInvitation` |
| `…$projectId.units.tsx` | 63 | `getDeveloperProject`, `listProjectUnits`, `createProjectUnit`, `updateUnit` | R1 R2 R4 R5 | **El archivo más ramificado del lote**: el formulario tiene dos modos (crear o editar la unidad elegida). Crear con y sin piso/superficie, editar solo el piso o solo la superficie (`puedeGuardar`, 140-142), cancelar la edición, los errores de las dos mutaciones. Unidades con y sin investor y con y sin precio. **255, 256: ya se borraron** (W0b) |
| `…$projectId.upload.tsx` | 54 | `getDeveloperProject`, `uploadStageEvidence` | R1 R5 | `rechazosDelServidor` (58-71) es una función de parseo: un `ApiError` con `NO_FILES_ACCEPTED` y `rejected`, con otro `code`, sin body y un error que no es `ApiError`. Resultado **parcial** (algunos rechazados) y **total**. Con y sin notas (`category`). Un rechazo del cliente por tamaño y otro por cantidad. El anclaje que vuelve sin `txid` (aviso pendiente, 269) y con él (`AnchoringSuccessModal`). Los archivos se agregan por `FileDropzone` (`fireEvent.change` del input) |

#### W3 — investor, panel (6 archivos, 158 branches)

| Archivo | Br | api | Recetas | Qué más |
|---|---|---|---|---|
| `investor.buy.tsx` | 100 | `listProjects`, `listFavorites`, `addFavorite`, `removeFavorite` | R1 R2 R4 R6 R8 | **El más grande del lote, y casi todo es R6.** `parseBuySearch` (43-52): una URL por parámetro, válido e inválido (`view=otra`, `status=otro`, `sort=otro`, `q=''`). Las tres vistas (`map`, `search`, `filter`) y volver a tocarlas para cerrarlas. El chip de filtro activo y "limpiar". Búsqueda con y sin resultados (`buy.noResults` contra `panel.investor.empty`). Tipear en la búsqueda (el `useEffect` que sincroniza `qLocal`). Favorito sí y no (las dos mutaciones). Proyectos con y sin coordenadas (los pines). El mapa con R8, disparando `moveend` para que aparezca `bbox` en la query. **148: ya se borró** (W0b). Punto 2 de W0 ya está hecho |
| `investor.favorites.tsx` | 16 | `listFavorites`, `removeFavorite` | R1 R2 R4 | Dos favoritos (el test ID `INV-FAV-TOGGLE-002` va solo en el primero). **61: ya se borró** (W0b) |
| `investor.menu.tsx` | 2 | — | R1 | — |
| `investor.notifications.tsx` | 28 | `listNotifications`, `getInvitation`, `markNotificationRead`, `acceptInvitation`, `declineInvitation` | R1 R2 R5 R6 | `?invitation=<id>` en la URL: aparece `InvitationCard`, se abre el modal, aceptar y rechazar. Sin invitación y sin notificaciones → vacío. Con invitación y sin notificaciones → nada (162). El filtro por categoría. Una notificación leída y otra no (solo la no leída marca al abrir). **150: ya se borró** (W0b). Punto 2 de W0 ya está hecho |
| `investor.profile.tsx` | 2 | — | R1 | — |
| `investor.units.tsx` | 10 | `listInvestorUnits` | R1 R2 | **62: el bug de `delivered` ya está arreglado (W0b) — solo falta el test** (§🐞). El `?? s` de la línea 63 ya se borró |

#### W4 — investor, por unidad (4 archivos, 199 branches)

| Archivo | Br | api | Recetas | Qué más |
|---|---|---|---|---|
| `investor.unit.$unitId.index.tsx` | 124 | `getInvestorUnit`, `getInvestorUnitNews`, `getProject`, `listProjectDocuments`, `getInvestorContract`, `getBuildingSchematic`, `getBundleFiles`, `downloadEvidence`, `getMerkleProof` | R1 R2 R4 R8 R9 | **La pantalla con más ramas de la web.** Tres superficies iniciadas por el usuario (M2-D4 §6.3): el esquema del edificio (botón → `Dialog` con `BuildingSchematic`, con pisos y sin pisos, unidad propia/disponible/ocupada), la galería (R9) y el Merkle proof de un stage (clic en un chip de stage con y sin `bundleId`). Novedades: vacías, con tres o más, con `stageName`/`toState` nulos, y el `announce` cuando llegan confirmaciones nuevas (85-87: dos respuestas seguidas de `getInvestorUnitNews`). Unidad completa y mínima (R4: piso, superficie, precio, entrega). 403 y 404 |
| `…$unitId.contract.tsx` | 28 | `getInvestorUnit`, `getInvestorContract`, `listContractReleases` | R1 R2 R4 | Contrato 404 (sin contrato todavía) y 403. Firmado y sin firmar. Liberaciones vacías y con una (`ReleaseProofList` → abrir su TXID) |
| `…$unitId.dossier.tsx` | 29 | `getUnitDossier`, `getInvestorUnit`, `getProject`, `exportUnitDossier`, `shareUnitDossier` | R1 R2 R4 R5 | 403 y 404. Exportar (pendiente y hecho), compartir (el modal con `shareUrl`). Dossier con y sin `masterHash` firmado (`HashChip`), proyecto con y sin entrega |
| `…$unitId.notifications.tsx` | 18 | `getInvestorUnit`, `listNotifications`, `markNotificationRead` | R1 R2 | Igual que `investor.notifications` sin la invitación: filtro, leída y no leída, la primera no leída lleva el test ID `INV-NOTIF-READ-002`. **111: ya se borró** (W0b) |

#### W5 — `project.$projectId.*`, del investor (4 archivos, 275 branches)

| Archivo | Br | api | Recetas | Qué más |
|---|---|---|---|---|
| `project.$projectId.stage.$stageId.tsx` | 109 | `listProjectStages`, `getProjectStage`, `getBundleFiles`, `listProjectDocuments`, `downloadEvidence`, `getMerkleProof` | R1 R2 R4 R7 R9 | Stage con fotos y sin fotos, con documentos y sin ellos, con bundle y sin bundle. El `commitmentHash` del bundle **con y sin** un evento que lo ancle (143): esa es la regla 17, "Pendiente" si no hay TXID. Abrir un documento (visor con y sin `txid`), abrir el proof del stage, archivos del bundle con y sin `filename`. 403 y 404 |
| `project.$projectId.index.tsx` | 88 | `getProject`, `listProjectDocuments`, `listFavorites`, `downloadEvidence`, `addFavorite`, `removeFavorite` | R1 R2 R4 R8 R9 | Favorito sí y no, con y sin coordenadas (el botón del mapa), fotos y documentos separados por `esFoto`, abrir un documento anclado y otro sin anclar, clic en un stage del timeline. 403 |
| `project.$projectId.progress.tsx` | 37 | `getProject`, `listProjectStages`, `listProjectDocuments` | R1 R2 R4 | 403 del proyecto **o** de los stages (64-66, dos fuentes). Fotos contadas por stage (82-83: `evidenceType: 'photo'` y `mimeType: image/*`, más un documento sin `stageId`) |
| `project.$projectId.developer.tsx` | 41 | `getProjectDeveloper` | R1 R2 R4 | Organización ausente → pantalla de error (60). Bio corta y bio larga (el "ver más/ver menos" de 157-167). Obras con y sin precio y medidas, lista vacía. **197: ya se borró** (W0b) |

> **W3, W4 y W5 ✅ 2026-09-23, los tres al 100% en las cuatro métricas** (tests: `568bf20`, `522fc7d`, `65cb958`; cierre: código muerto borrado y bug arreglado, en las ramas `a248421`, `43b8a32` y `04580f7`). `pnpm verify:all` en verde, web 1208/1208 también con `--coverage`. W6 y W0 medidos de nuevo el mismo día: 100%. Sin `v8 ignore`.
>
> **Código muerto borrado** (comportamiento visible igual; el tipo pasa a garantizar lo que el `??`/`if` fingía chequear):
> - W3: `proyecto.stages ?? []` (`investor.buy`, `investor.favorites`) y el `if (!abierto)` del `onOpenChange` del diálogo de filtros. El `onClose` de `LocationMapModal` en `browse` sigue existiendo porque el prop es obligatorio y lo usan otros lotes; se pasa `setView.bind(null, undefined)`.
> - W4: `investor.unit.$unitId.index` agrupa el esquema del edificio en un solo `esquema` (sin `projectName ?? ''` ni `callout` con piso nulo), el diálogo de Merkle sin `if (!abierto)`, `onOpenArchivo` solo si hay `bundleFiles`; `contract` sin `currency ?? 'USD'`.
> - W5: `stage.$stageId` y `index` dejan de bajar un blob de foto que nunca se mostraba (el visor solo abre documentos) y el hito se arma como `hitoDelStage`; `index`/`progress` usan `idPorOrden` en vez de `find` + `if (!stage)`; `developer` pasa `developerName` a `Obras`.
>
> **🐞 Bug de `validateSearch` arreglado.** Reproducía **en producción**, no solo en el harness: el router real no valida el search y router-core hace `match.search = {...parentSearch, ...validado}`, así que una clave que el parser descarta no pisa nada y el valor crudo (`status=otro`) reaparece en `useSearch`. No hay opción de `useSearch`/`strict` que devuelva solo lo validado, y validar en `__root` tampoco sirve. Arreglo: `parseBuySearch` devuelve siempre las cinco claves, con `undefined` cuando el valor es inválido, para que pise el crudo. `investor.notifications` (`invitation`) tenía lo mismo y quedó igual; son las dos únicas rutas con `validateSearch`. El `it.fails` pasó a `it`.
>
> **Notas para otros lotes:** el "Volver" de `PanelLayout` existe también mientras carga (esperar el mensaje antes de clicar); con un `Dialog` de Radix abierto el resto queda `aria-hidden` (no se consulta por rol); bajo `--coverage` la suite completa es más lenta y un test que depende de un debounce puede fallar por carga (`-investor.buy`, ya estabilizado esperando el estado intermedio antes de clicar); en vitest 4 los filtros de archivo van como argumentos posicionales, sin `--` delante.

#### W6 — admin, públicas e infraestructura (6 archivos, no 8 — `useSession.ts` se borró y `main.tsx` salió del denominador en W0, 62 branches)

| Archivo | Br | api | Recetas | Qué más |
|---|---|---|---|---|
| `admin.index.tsx` | 44 | `listProjects`, `getProject`, `listProjectCertifierInvitations`, `listUsers`, `inviteCertifier` | R1 R2 R5 | Sin proyectos (`projectId = ''`, las queries no corren). Elegir otro proyecto en el select. Proyecto sin miembros y con miembros. Usuarios: un verifier invitable, uno inactivo, uno que ya certifica, uno con invitación pendiente (el filtro de 87-88 tiene cuatro condiciones). El error de invitar **con** un código conocido (`ERRORES_CON_NOMBRE`) y con uno desconocido (genérico). **139: ya se borró** (W0b) |
| ↳ **W6 ✅ 2026-09-23** (`e352585`) | 0 | — | — | **`admin.index.tsx:188`, el segundo `(invitaciones ?? [])`, era inalcanzable y se borró** (`invitaciones?.map`): la línea 184 ya tomó la otra rama con `invitaciones === undefined`. Con eso `admin.index.tsx` queda en 40/40 branches (100% en las cuatro métricas) y el lote entero al 100% |
| `public.dossier.$shareToken.tsx` | 8 | `getPublicDossier` | R2 R4 | 404 (token vencido o inválido), con datos, con y sin firma. Sin sesión: **no** usa `autenticarComo` |
| `index.tsx` | 4 | — | — | Sin sesión → `/login`; con sesión → el landing del rol. **13, el `??`: ya se borró** (W0b) |
| `__root.tsx`, `router.tsx` | 0 (4 statements) | — | — | Montar el router real (`getRouter()`) en un test: cubre los dos |
| `lib/observability.ts` | 6 | — | R12 | Con y sin DSN, con y sin PostHog key, con y sin host |

#### W7 — modales y `ui/dialog` (9 archivos, 79 branches)

| Archivo | Br | Recetas | Qué más |
|---|---|---|---|
| `LocationMapModal.tsx` | 48 | R7 R8 | Las dos variantes (`modal` y `browse`), con coordenadas propias o solo con pines (`primerPin`) o sin nada (centro por defecto en Buenos Aires), pines con y sin `label` (`divIcon` o marker simple), abrir y cerrar. Las guardas de efecto se verifican al escribirlo (ver arriba) |
| `InvitationAcceptModal.tsx` | 9 | R7 | Con y sin `handover`, con y sin `termsLines`, con y sin `txid` + labels de copia, el estado `resolved` |
| `DocumentViewerModal.tsx`, `ImageGalleryModal.tsx`, `AnchoringSuccessModal.tsx` | 13 | R7 | Con y sin `paginationLabel`; descarga deshabilitada sin anclar; galería reabierta en otro índice; el anuncio único de `AnchoringSuccessModal` (62-66: abrir, cerrar y volver a abrir) |
| `ObserveStageModal`, `ShareDossierModal`, `TxidModal` | 6 | R7 | Solo el Escape |
| `ui/dialog.tsx` | 3 | — | `DialogContent` con `showCloseButton` y sin pasarlo (el default) |

#### W8 — el resto de `components/` (24 archivos, 172 branches)

**Casi todo es R11.** Los tres que concentran el lote:

| Archivo | Br | Qué más |
|---|---|---|
| `ProjectCard.tsx` | 39 | Las dos variantes (`buy`, `developer`) por cada combinación de `imageUrl`, `priceLabel`, `unitsLabel`, `sizeLabel`, `dateLabel`, `status`, `progress`, `location`, favorito sí/no/ausente |
| `ActionCard.tsx` | 16 | `featured` × `compact` × con y sin ícono × con y sin descripción |
| `PanelLayout.tsx` | 15 | Abrir perfil y campana desde los cinco `rol`, y como admin (`esAdmin` → `/admin`). Con `headerAction`. **81, 97 → marcar** (`case 'admin'`) |

El resto (`ProfileScreen`, `StatCard`, `FileDropzone`, `NumberInput`, `ProgressTimeline`,
`TextInput`, `UnitCard`, `Chips`, `SelectDropdown`, `InvestorCard`, `MerkleRootProof`,
`NotificationCard`, `DocumentCard`, `BottomNav`, `BuildingSchematic`, `GradientHeader`,
`ToggleSwitch`, `HashChip`, `LanguageToggle`, `ProgressBar`, `ReleaseProofList`): entre 1 y 13
ramas cada uno, todas de props. `ProfileScreen` además tiene `notificationPrefsJson` presente y
ausente, y guardar el nombre (pendiente, vacío que no guarda). `FileDropzone` necesita
`dragenter`/`drop` con y sin `disabled`. `NumberInput` necesita `min`/`max` y los botones ±.

#### W9 — `lib/`, `auth/`, `i18n/`, `api/` y las ramas sueltas (19 archivos, 55 branches)

| Archivo | Br | Qué más |
|---|---|---|
| `lib/investor.ts` | 22 | `reintentarSiNoEsAusencia` con 403, 404 y otro error. `esFoto` y `formatoArchivo` con PDF, JPEG, JPG, PNG y otro MIME. `claveNovedad` con un tipo desconocido (R10). `claveEstadoStage` con los cuatro estados (el `default` ya es un chequeo `never`, W0b) |
| `api/port.ts` | 5 | `fetch` mockeado: un error con body sin `message`, un `204`, una request sin sesión (sin header), un `401` que borra la sesión, un error en `download` |
| `auth/useRoleGuard.ts` | 4 | `api.me` que rechaza con un error de red (deja pasar); desmontar mientras `api.me` está pendiente (las dos ramas de `cancelled`). **50: ya se borró** (W0b) |
| `lib/evidenceFiles.ts` | 6 | El mismo `File` dos veces (el caché), un objeto sin `slice` y otro sin `arrayBuffer` (navegadores viejos), un archivo cuyo hash falla |
| `i18n/useTranslation.tsx` | 2 | Usar el hook fuera del `LocaleProvider` (tira); una plantilla con un `{param}` que no se pasa (R10) |
| `lib/money.ts` | 1 | Un monto en notación científica (`"1e5"`) → `null` |
| `i18n/format.ts`, `lib/stageProgress.ts`, `lib/explorer.ts`, `lib/blobUrls.ts` | 0 (funciones y statements) | Llamar las funciones que ningún test llama: `formatMonthYear`, `formatDateTime`, `formatRelative`, `formatCurrencyCompact`, `timelineDeStages`, `explorerTxUrl`, y `useObjectUrls` con R9. **`formatCompact`: ya se borró** (W0b) |
| `notary.*`, `certifier.*`, `login` | 11 | El estado vacío de `certifier.issued`/`notary.signed`, el "firmando…"/"certificando…" (R5), las dos ramas `null` de `notary.dossier` y `certifier.issued`. **`certifier.index` 49, `notary.index` 48 → marcar (siguen); `login` 70: ya se borró** (W0b) |
| `auth/session.ts`, `i18n/locale.ts` | 4 | Los 4 `typeof window` ya se borraron (W0b) |

### El resultado, si se hace todo

| | Hoy | Tras W0 (borrar o tipar 23, marcar 5, `main.tsx` 1) | Tras W1-W9 |
|---|---|---|---|
| Branches | 573/1.960 (29,2%) | ~573/~1.931 | **~1.931/1.931 (≈100%)**, salvo lo que aparezca en `LocationMapModal` |

El 95% pide ~1.834 branches cubiertas: casi todo. **A diferencia de la API, acá no hay atajo**, y
el orden de magnitud del trabajo es el de las tablas de arriba: W3, W4 y W5 (632 branches) son la
mitad.

## Paralelismo — qué se puede hacer a la vez, medido contra el código

**W0 va primero, solo. Después, W1 a W9 pueden correr los nueve a la vez.** Antes W7–W9 no
esperaban a W0. Desde el análisis sí: W0 borra y tipa fallbacks en archivos de los nueve lotes
(punto 8), así que un lote que arranque antes edita los mismos archivos que W0.

**W0 ya se hizo así, en la práctica, y sirve de precedente para W1–W9:** W0a corrió en el working
directory principal y W0b en un worktree aparte (subagente), en paralelo, sin overlap de archivos
(W0a tocó infraestructura de test; W0b, código de producción). Se mergearon con `git apply` del
diff de un lado sobre el otro, sin conflictos, `pnpm verify:all` en verde, y el worktree se borró
después. Vale confirmarlo antes de lanzar cada tanda de W1–W9: `git diff --stat` de cada worktree
contra la tabla de "archivos que chocan" de abajo, antes de mergear.

Por qué alcanza con eso:

- **Aislamiento en runtime.** Vitest aísla el grafo de módulos por archivo de test (`isolate` por
  default), así que el `vi.spyOn(api, …)` de un archivo no se ve en otro. No hay base ni servidor
  compartido: el `api` es un singleton, pero cada archivo recibe su propia instancia.
- **Aislamiento en git.** Cada lote crea sus propios archivos de test (`routes/-<pantalla>.test.tsx`
  para las pantallas, como ya hacen notary y certifier). `src/` (código de producción) ya lo tocó
  W0 y nadie más lo debería tocar — el único fix de producción que iba a hacer un lote (el bug de
  `delivered` en `investor.units.tsx`, que iba a ser de W3) ya salió con W0b, forzado por el tipado.

**Los archivos que chocan si nadie los reserva**, y a quién le tocan:

| Archivo | Por qué chocaría | Regla |
|---|---|---|
| `routes/-test-mount.tsx` y el Leaflet falso | Cada rol nuevo necesita su usuario, W3 necesita `validateSearch`, y cuatro lotes necesitan el mapa | **Ya hecho por W0** (commit `a7dac17`). Si un lote descubre que le falta algo más, lo pide; no lo edita |
| `apps/web/vitest.config.ts` | Cada tanda de SPEC-017 subía los umbrales | **Las exclusiones ya están** (W0, `a7dac17`); los umbrales quedan para §Consolidación, al final |
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
worktree apenas su rama está en `main`. Una tanda razonable: W0 → (W3, W4, W5, que son la mitad
del trabajo, en paralelo) → W1, W2 y W6–W9 en los huecos.

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
