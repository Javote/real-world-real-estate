# apps/web — el frente

> Se carga solo al tocar este subárbol. **El flujo de trabajo está en el `CLAUDE.md` de la raíz** y
> no se repite acá: abrir la captura, abrir su fila de M2-D5, transcribir.

TanStack **Router** sobre Vite — **SPA, sin SSR** (D-065) · React 19 · Tailwind v4 · Lucide ·
Vitest+jsdom · Playwright.

## Estado: reconstrucción en curso, por verticales

El front se demolió por baja conformidad (D-064) y se reconstruye superficie por superficie desde
`SPEC-014`. **El número de estado vive en `specs/README.md` y solo ahí** (regla del `README.md`
raíz) — no lo copies acá, se desactualiza. Lo que sí es estable y no rota con cada commit:

| Existe | Qué es |
|---|---|
| `api/port.ts` | Único lugar que hace `fetch`. Cuerpos y filtros se tipan con los `*Input`/`*Query` de `packages/shared`, y `api/port.contract.test.ts` cruza cada método contra `specs/evidencia-m3/2-api/openapi/propnexus.openapi.json` (`SPEC-111`). **Agregar un método a `api` exige su caso en ese test** |
| `auth/*` | `useRoleGuard` implementa los AuthGuard role groups de M2-D1 §7.2 |
| `i18n/*` | Diccionario propio, sin librería. Crece con cada pantalla |
| `routes/` | Rutas reales por rol (`investor.*`, `developer.*`, `notary.*`, `certifier.*`), no stubs — el backlog de `SPEC-014` se cierra vertical por vertical, en el orden `evidencia → certificar → liberar` |
| `styles.css` | **Los tokens de M2-D3** en `@theme` — colores normativos, escala tipográfica, espaciado de 4px, radios, elevación, tamaños de ícono |
| `lib/cn.ts` · `components.json` | Base de shadcn/ui. Los primitivos se agregan **de a uno**, cuando su componente de dominio los necesita |
| `components/domain/` | Los componentes transversales de M2-D3 + los patrones de prueba de M2-D4 (P1–P5, P7, P9, P10 como componentes reutilizables; P6 audit log y P8 dossier llegan con su propia vertical, son superficies enteras) |
| `components/ui/dialog.tsx` | Primitivo de Radix vía shadcn. Adaptado del todo (`SPEC-102`): su botón de cierre usa el `SecondaryButton` de M2-D3 y traduce su texto (`common.close`), y toda la escala es la de M2-D3 (fondo, radio, sombra, espaciado) — ningún consumidor pasa `bg-card` a mano |
| `i18n/format.ts` | `Intl` con el locale activo: moneda, fecha, relativos (regla 14) |

Antes de asumir que una superficie sigue siendo un stub, mirá `routes/` — puede que ya se haya
transcrito. Ver [`specs/SPEC-014`](../../specs/SPEC-014-reconstruccion-del-front.md) para el plan y
`specs/README.md` para qué falta hoy.

## La jerarquía de profundidad, que es lo que hace coherente a la app

M2-D4 §6.1: *"patterns compose, never overlap"*. Cada patrón contesta **una** pregunta y a una
profundidad distinta. Antes de agregar una señal de prueba a una pantalla, ubicá a qué profundidad
va — dos patrones compitiendo por la misma respuesta es redundancia, no rigor.

| Profundidad | Pregunta | Patrón |
|---|---|---|
| 1 | ¿está anclado? | `VerificationBadge` (P1) |
| 2 | ¿cuál hash? (6+4) | `HashChip` (P2) · `StageChips` (P9) |
| 3 | el hash completo, el explorador, la metadata | `TxidModal` (P3) · `AnchoringSuccessModal` (P4) · `MerkleRootProof` (P5) |
| 4 | la historia entera o el artefacto compilado | audit log (P6, `developer.audit-log.tsx`) · dossier (P8, `investor.unit.$unitId.dossier.tsx`) |

**Un solo modal se abre solo:** `AnchoringSuccessModal`, porque el sistema lo emite tras un anclaje
exitoso. Todos los demás los inicia el usuario (M2-D4 §6.3).

## Dos componentes llevan una regla dura adentro

`VerificationBadge` **no acepta un booleano**: recibe el TXID. La regla 17 —nunca mostrar una señal
de prueba que no puedas sustanciar— deja de ser algo que hay que acordarse y pasa a ser la firma del
componente: sin TXID no hay forma de pedirle que diga "Verificado".

`HashChip` recibe el hash **completo** y trunca al mostrar. Pre-truncarlo en la capa de datos rompe
la copia y vuelve inverificable el anclaje (regla 16). Trunca 6+4 **contando el prefijo `0x`**, que
es una contradicción del entregable resuelta en D-069.

## Lo que la captura pide y el contrato no da

Sección viva, **igual que las Trampas**: cuando una captura muestre un dato que no podés sustanciar,
agregalo acá el mismo día.

El criterio no se negocia y es la regla 17 llevada a los datos: **sin dato, no se dibuja**. Nada de
placeholders, nada de derivar un valor parecido para que la pantalla "se vea como la captura". Una
pantalla a la que le falta un campo se nota y se arregla; una que muestra un campo inventado parece
terminada y nadie la vuelve a mirar.

**La deuda se declara en el prop que no se puede llenar**, no en un documento aparte: ahí es donde
la va a leer quien intente usarlo. Esta tabla solo dice dónde está cada una.

| Qué falta | Dónde está declarada | Qué costaría |
|---|---|---|
| Pill de estado del investor (Active / Pending / Completed) | `InvestorCard` prop `status` | Contrato: `investorDirectoryEntrySchema` no expone `status`, y el endpoint hace `innerJoin Contract` |
| Fila de StatCards Active / Pending / Completed en `/developer/investors` | misma deuda: no hay `status` por investor del que agregar | Contrato: sin el campo no hay conteo que no sea inventado |
| ~~Nombre de la organización ("Grupo Alpine")~~ | — | **Cerrado 2026-09-21 (SPEC-220)**: migración `0010` creó `Organization` + `Project.organizationId`. El perfil del desarrollador lo pasa; el listado y el detalle de obra todavía no (no traen la organización en su contrato) |
| "Price from" en el listado del investor | `ProjectCard` prop `priceLabel` | Endpoint: `GET /projects` no agrega el mínimo de las unidades. `GET /developer/projects` **ya lo hace** — es copiar esa agregación |
| Rating / reputación del developer (capturas 6-7, 59-60) | detalle `/project/:id` y `/project/:id/developer` — no hay estrellas | **No se construye, es una decisión (D-094)**: un rating es una afirmación sobre la calidad de un tercero y D-026 limita la plataforma a cuatro afirmaciones sobre documentos y atestaciones. La pantalla de las capturas 59-60 **sí** se construyó (SPEC-220), sin el pill |
| KPI "Active investors" y "Verified events" del panel (capturas 33/34) | `developer.index.tsx` — no hay tile | Contrato: `developerKpisSchema` no los expone |
| `DocumentCard` completo (nombre, fecha, formato) en los artefactos del dossier (investor y notary) | `investor.unit.$unitId.dossier.tsx` y `notary.dossier.$dossierId.tsx` — la lista de artefactos solo tiene label + hash + `VerificationBadge` | Contrato: `dossierArtifactSchema` solo tiene `kind`, `referenceId`, `label`, `sha256`, `txid` — sin `filename`/`uploadedAt`/`format` no hay nada real que ponerle a `DocumentCard` |
| Miniatura por etapa en "Stage Detail" (captura 45: una foto de obra junto a cada fila) | `developer.progress.tsx`, bloque "Stage Detail" (`M3 §2.2`) — la fila es texto + `StatusPill`, sin imagen | Endpoint: `developerProgressItemSchema` no trae ninguna referencia a evidencia; haría falta un `join` a la primera `Evidence` `photo` del stage (mismo patrón que `fotosPorStage` en `project.$projectId.progress.tsx`, que hoy solo cuenta, no expone URL) |

**Fijate si el dato existe antes de declararlo ausente.** El "Price from" se declaró ausente y no lo
estaba: el precio existe en `UnitTable.priceMinorUnits`, solo que a nivel unidad. Eso convirtió una
supuesta migración en un `min()` en la query, y se resolvió el mismo día para el listado del
developer. Son deudas MUY distintas y la diferencia solo aparece si mirás el esquema.

## Los tokens no se tocan a mano

`src/styles.test.ts` lee **el entregable** —no una copia— y verifica que los 20 colores normativos
de M2-D3 §Visual Language estén en `styles.css`, uno por uno. Es el mismo patrón que el valor dorado
de `contracts/`: si alguien ajusta un tono "para que quede mejor", el test se pone rojo.

**Regla de uso:** ningún componente escribe un color, tamaño, radio o sombra literal. Si hace falta
algo que no está en los tokens, no se inventa — se busca en M2-D3, y si tampoco está, es una decisión.

**Biome necesita `css.parser.tailwindDirectives`** para parsear `@theme`: Tailwind v4 declara los
tokens dentro del CSS y no hay `tailwind.config.js`. Sin esa opción aborta el formateo del archivo
entero, con un error que no menciona `@theme`.

**Un stub no es una pantalla a medias.** Se ve como lo que es y no compite con la captura: una
pantalla inventada parece terminada y nadie la vuelve a mirar.

## El header es uno (D-074)

`PanelLayout` pinta **siempre** el `GradientHeader` completo. La pantalla no elige piezas:

- Logo PropNexus a la izquierda. No se oculta.
- Campana, perfil e idioma a la derecha. No se opt-in por ruta.
- Si la pantalla tiene padre, pasa `back`. La flecha queda **entre** el logo y el título.

Login no usa `PanelLayout`: ahí solo va el toggle de idioma (M2-D3 §LanguageToggle).

Si una captura del developer omite el logo (46, 48, 35) o las utilidades (casi todas), gana D-074,
no la captura. No reintroducir un `hideBrand`.

## Específico de este frente

- **Mobile-first de verdad**: la captura es un teléfono de ~380px. El desktop es la adaptación, no
  al revés (M2-D3 §Principio 4).
- **Los strings en español son 20-30% más largos que en inglés** (M2-D3 §Text growth):
  dimensioná al contenido, nada de anchos fijos salvo FAB e íconos.
- **La clave de `localStorage` del idioma es `propnexus.lang`**, literal (M2-D3 §Localization).
- **Los puertos salen de `ports.ts`**, que los lee de `apps/web/.env` y por defecto da 3000/8787.
- **En dev, `/api` va por el proxy de Vite** a `API_ORIGIN`. En producción el web es estático y vive
  en otro origen: la URL absoluta sale de `VITE_API_ORIGIN` y la API la acepta por su lista blanca
  de CORS (D-065). Si en producción no responde nada y la consola dice CORS, falta `WEB_ORIGIN` del
  otro lado — ver `specs/evidencia-m3/5-ops/RUNBOOK-deploy.md`.

## Trampas verificadas

- **2026-09-20 · el front no puede importar VALORES de `@plataforma/shared` por el índice, y por qué se
  ve tarde.** `shared` se compila a **CommonJS** (`dist/`) y el front solo había importado *tipos* de
  ahí. El día que `SPEC-218` necesitó valores (tipos permitidos, topes, detección por magic bytes) el
  typecheck y **los tests de vitest pasaron**, pero el navegador tiró *"The requested module
  '…/packages/shared/dist/evidence-rules.js' does not provide an export named …"* — Vite dev sirve el
  archivo crudo y un `exports.X =` de CJS no es un módulo ES. Lo cazó el e2e, no los unitarios. Además el
  índice arrastraría **Zod y los 30 archivos de schemas** al bundle (CJS no se tree-shakea).
  **La regla:** lo que el front necesite como valor va en un módulo de `shared` **sin ninguna
  dependencia** y se importa por su propia entrada, que apunta al **fuente `.ts`** (que Vite sí
  transforma), no a `dist`: hoy `@plataforma/shared/evidence-rules` (`packages/shared/package.json`
  `exports`). El resto de `shared` sigue siendo solo tipos (`import type`).

- **2026-09-19 · `styles.test.ts` no tiene un número de tests estable, y no es una regresión de
  ningún commit.** Corriéndolo solo (`pnpm --filter web test -- styles.test`) da un número; corriendo
  la suite completa da otro; y varía entre corridas del mismo comando sin tocar nada. Confirmado
  contra el código **sin modificar** con `git stash` — la inestabilidad ya estaba ahí, no la causó
  SPEC-108 (que fue cuando se notó, al comparar el total de la suite entre dos commits). El archivo
  genera sus tests con `it.each` sobre listas que arma parseando `docs/M2-D3-...md` en tiempo de
  colección (`coloresNormativos()` y análogas para tamaños de ícono y espaciado) — la sospecha es
  alguna dependencia de orden de ejecución entre archivos de test en el mismo worker de Vitest
  (un regex con estado global, o algo similar), pero no se investigó a fondo: **cero tests fallan
  en ninguna corrida**, solo cambia cuántos se coleccionan, así que no bloqueó nada y quedó fuera de
  alcance de la spec que lo encontró. Si alguna vez este archivo empieza a fallar de verdad (no solo
  a variar en cantidad), esto es el primer lugar donde mirar.

- **2026-09-09 · el `VerificationBadge` del detalle de etapa mostraba el TXID de la transición
  equivocada.** `stage.events.find(e => e.eventType === 'STAGE_TRANSITION' && e.txid)` devuelve la
  **primera**, y `GET /projects/:id/stages/:stageId` ordena por `eventIndex asc`. En un stage que
  recorrió la FSM entera —`Pending → InProgress → Observed → InProgress → Completed`— eso es el
  arranque, no el cierre: la píldora "Verificado" quedaba al lado de `certifiedAt` sustentada por
  el TXID de una transición a **otro estado**.
  **Verificado contra producción, no deducido:** "Terminaciones" de `torre-a` tiene `1` =
  `Pending → InProgress` (`b28eb6cf…`) y `5` = `InProgress → Completed` (`e842c8ac…`); la pantalla
  mostraba el primero. Es M2-D4 §6.2 en su forma más literal —*"the system never displays a proof
  signal that cannot be substantiated"*— porque Depth 1 contesta "¿esto está anclado?" sobre el
  estado **actual**.
  **Fix:** `anclajeVigenteDelStage` en `lib/investor.ts` (la última transición anclada, no la
  primera), con tests en `lib/investor.test.ts`. Vive como helper puro y no inline en la ruta
  porque las rutas de TanStack no se testean unitariamente acá — mismo criterio que
  `unicosPorStageId`, que nació del mismo tipo de rareza en la forma de los datos.
  **La lección:** `.find()` sobre una lista ordenada ascendente devuelve lo más **viejo**. Cada vez
  que un componente elija "el evento" de una entidad que tiene historia, preguntá si quiere el
  primero o el último — y si la respuesta es "el que corresponde al estado actual", nunca es el
  primero.

- **2026-09-09 · dos acciones del hilo de estados no tenían clave de traducción, así que el audit
  log las mostraba en crudo.** `CHANGE_STAGE_STATE` y `STAGE_WORK_INITIATED` no estaban en
  `dictionary.ts`; `t()` devuelve `undefined` para una clave ausente y el `?? e.action` de
  `developer.audit-log.tsx` caía al literal en mayúsculas. Justo las **dos transiciones que entran
  a `InProgress`** (D-020: el auto-avance al subir la primera evidencia y el "Reanudar etapa"),
  o sea la mitad del hilo, ilegible en la superficie que M2-D4 §Pattern 6 designa como su casa
  —*"if a stage is re-anchored (e.g. after a remediation), the original anchor event remains; a new
  event is appended"*—. Confirmado en producción: `AuditLog` tiene 2 filas `CHANGE_STAGE_STATE` y
  1 `STAGE_WORK_INITIATED`, todas con `entityType = Stage`, que `auditScope` sí mapea.
  **Quedan ~20 acciones más sin clave** (`ACCEPT_INVITATION`, `RELEASE_PAYMENT`, `CREATE_UNIT`, …).
  No se agregaron acá a propósito: son otra tarea y no son el hilo. Las de `entityType = User`
  (`LOGIN`, `CREATE_USER`, `UPDATE_PROFILE`) **nunca** se ven, porque `auditScope` deja `User`
  afuera por diseño.
  **Nada que agregar en la pantalla de la etapa, y esto es lo importante:** M2-D4 §6.1 dice que los
  patrones no se superponen y que la **historia entera es Depth 4** (P6/P8). El detalle de etapa es
  Depth 1/2/3. Poner ahí un historial de eventos sería mostrar el mismo material de prueba dos
  veces en la misma pantalla, que es exactamente lo que §6.1 prohíbe. **Si el hilo no se lee, se
  arregla el audit log, no la pantalla de la etapa.**

- **2026-09-04 · `PanelLayout` no tenía `max-width`, y en desktop el `aspect-video` de `ProjectCard`
  escalaba con el viewport.** Sin límite de ancho, cada card medía más de 1000px de alto —
  `1502×1034px` medido en un viewport de 1534px— y una lista con proyectos reales (`/developer/projects`
  con 2 proyectos) se veía vacía sin scrollear una enormidad: solo entraba en pantalla el ícono
  "sin imagen" de la primera card. **No lo encontró un test** — la suite no verifica layout en
  viewports anchos — sino probar el flujo real contra producción con Claude en Chrome: crear un
  proyecto nuevo y volver a `/developer/projects`. `get_page_text` (que prioriza un solo `<article>`)
  hizo parecer al principio que faltaba un proyecto entero; la causa real apareció recién midiendo
  `getBoundingClientRect()` de los dos `<article>` — ambos estaban en el DOM, ambos con texto
  correcto, solo que gigantes.
  **Fix (commit `0428f13`):** `max-w-2xl mx-auto` en el `<main>` de `PanelLayout` y en el contenido
  interno de `GradientHeader` (que antes también se estiraba a todo el ancho) — mismo patrón que ya
  usaban `login.tsx` (`max-w-md`) y `public.dossier.$shareToken.tsx` (`max-w-lg`), que nunca se
  llevó a `PanelLayout`.
  **Lo que destapó y sigue sin cerrar:** `BottomNav` tiene `md:hidden` (se oculta a partir de
  768px) pero no existe ningún componente que lo reemplace en desktop — verificado a mano en el
  navegador (`getComputedStyle(nav).display === "none"` a 1534px) y buscando `Sidebar`/`SideNav`/
  `DesktopNav` bajo cualquier nombre en `components/domain/`: no hay ninguno, no es un componente
  desconectado. M2-D3 Principio 4 ("desktop swaps BottomNav for a left sidebar and adds columns")
  lo pide, y `M2-D2` captura 61 (`61-DESKTOP-HOME.png`) lo muestra — pero es la única captura de
  desktop en todo el catálogo y es del panel de investor, sin equivalente para developer/notary/
  certifier. Queda en la tabla de pendientes de `CLAUDE.md` raíz (#1) para una sesión aparte: toca
  las 4 superficies de rol porque `PanelLayout` es compartido.
- **Un `*.test.tsx` dentro de `src/routes/`** lo escanea el generador de rutas y avisa "does not
  export a Route": prefijalo con `-` o configurá `routeFileIgnorePattern`. Y `vitest` excluye `e2e/`
  explícitamente porque su `include` por defecto matchea `spec` además de `test`.
- **Los tests E2E esperan que React monte, no que exista el DOM.** Con formularios controlados, un
  click antes del montaje hace submit nativo, nunca corre el `preventDefault` y la página recarga
  sin llamar a la API. Falla intermitente que parece de backend. Ver `waitForHydration` en
  `e2e/walkthrough.spec.ts` — sigue aplicando como SPA: cambió *cuándo* monta React, no *que* haya
  que esperarlo.
- **`test.fail()` a nivel `describe` aplica a todos los tests que siguen.** Para marcar uno suelto va
  **dentro** del cuerpo. Puesto afuera hizo fallar los 16.
- **Usá selectores accesibles** (`getByLabel`, `getByRole`): fallan cuando la accesibilidad está mal,
  que es justo lo que querés. Así se descubrió que los `<label>` del login no tenían `htmlFor`.
- **2026-08-21 · Cuidado con clases utilitarias que colisionen con CSS propio.** El `styles.css`
  legado definía `.hidden { display: none !important }` y ganaba siempre sobre la variante
  responsive de Tailwind: `hidden md:flex` quedaba oculto en **todos** los viewports. Se fue con el
  archivo, pero la lección queda para cuando entren los tokens: **si escribís una regla con el
  nombre de una utilidad de Tailwind, vas a pelear con el orden del archivo.**
- **2026-08-28 · `Link` de TanStack Router pinta activo por prefijo.** `activeOptions.exact`
  vale `false` por defecto: un tab a `/developer` queda activo en `/developer/capital`. En el
  BottomNav, el tab índice pide `exact` si algún hermano cuelga de su path. No es CSS ni estado
  local. El investor no lo padece: su primer tab es `/investor/menu`.

## Comandos

```bash
pnpm --filter web dev             # SPA en :3000, con proxy a la API
pnpm --filter web test            # vitest
pnpm --filter web build           # dist/ — lo que se publica como static site
pnpm --filter web e2e:ui          # playwright interactivo
pnpm --filter web e2e:report      # reporte HTML de la última corrida
```

**Los E2E entran con la password del seed, no con la del prefill.** `e2e/_credenciales.ts` la resuelve
igual que `passwordDeDemo` del seed: `SEED_DEMO_PASSWORD` / `SEED_ADMIN_PASSWORD` del entorno o de
`apps/api/.env`, y si no están, los defaults locales. Con un `.env` que las define, el prefill de
`/login` (`ROLE_PRESETS`) no coincide con la base local, así que nunca escribas una password literal en
un spec.
