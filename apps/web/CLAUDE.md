# apps/web — el frente

> Se carga solo al tocar este subárbol. **El flujo de trabajo está en el `CLAUDE.md` de la raíz**:
> abrir la captura, abrir su fila de M2-D5, transcribir.

TanStack **Router** sobre Vite — **SPA, sin SSR** (D-065) · React 19 · Tailwind v4 · Lucide ·
Vitest+jsdom · Playwright. El estado vive en `specs/README.md`.

| Dónde | Qué |
|---|---|
| `api/port.ts` | Único lugar que hace `fetch`. **Un método nuevo exige su caso en `api/port.contract.test.ts`**, que lo cruza contra el OpenAPI (`SPEC-111`) |
| `auth/*` | `requireRole`: los AuthGuard role groups de M2-D1 §7.2, en el `beforeLoad` de los seis layouts por prefijo (`investor`, `project`, `developer`, `notary`, `certifier`, `admin`). La pantalla lee la sesión con `Route.useRouteContext()` (SPEC-601) |
| `i18n/*` · `i18n/format.ts` | Diccionario propio; moneda y fecha con `Intl` (regla 14). La clave de idioma en `localStorage` es `propnexus.lang`. `dictionary.ts` es es-AR y va en el JS inicial; `en-US.ts` baja con `cargarDiccionario`, y `main.tsx` lo espera antes de montar |
| `lib/observability.ts` | Sentry y PostHog con `import()`, solo si hay DSN o key: un `import` estático de cualquiera de los dos los vuelve a meter en el JS inicial. `programarObservabilidad` los inicia con `requestIdleCallback` después del `first-contentful-paint` (o a los 5 s, si la pestaña no pinta): bajados junto con el render, el LCP del login en un celular simulado pasaba de ~1,7 s a 2,4–3,4 s. Montar o el `onRendered` del router no alcanzan: el navegador queda ocioso antes de pintar. **Los web vitals los mide Sentry** (`tanstackRouterBrowserTracingIntegration`, `tracesSampleRate: 1`): cargas y navegaciones se agrupan por ruta (`/project/$projectId`), y la API continúa la traza por `traceparent`. **Sentry ve a todos los roles** con `setUser({ id })` y el tag `role`, en el mismo `onResolved` que PostHog. **Los errores que atrapa el router llegan por `erroresDeReact`** (`onCaughtError`/`onUncaughtError` de `createRoot` en `main.tsx`): la pantalla de error de TanStack es un error boundary y sin esto Sentry no se entera; redirect y not-found no cuentan. Lo que falla antes de que Sentry baje espera en una cola de 20 (`programarObservabilidad` escucha `error` y `unhandledrejection` hasta entonces). **PostHog es `posthog-js/dist/module.slim` sin extensiones** (en 1.428–1.438 las extensiones vienen todas en un archivo de 49 kB y no se pueden importar sueltas) y **decide por el rol en un solo lugar**: en cada `onResolved` del router lee la sesión; sin sesión, página vista anónima; `buyer` o `developer`, `identify` con el ID opaco y el rol; el resto, nada (`before_send` descarta hasta el `$pageleave`). La identidad se lee de PostHog (`$user_state`, `get_distinct_id()`), no de memoria: sobrevive a una recarga |
| `styles.css` | Los tokens de M2-D3 en `@theme`. `styles.test.ts` los compara contra el entregable: ningún componente escribe un color, tamaño, radio o sombra literal |
| `components/domain/` | Los componentes de M2-D3 y los patrones de prueba de M2-D4 |
| `components/ui/` | Primitivos de shadcn, de a uno y adaptados a M2-D3 |

**Profundidad de prueba** (M2-D4 §6.1, *"patterns compose, never overlap"*): 1 `VerificationBadge`
· 2 `HashChip`/`StageChips` · 3 `TxidModal`/`AnchoringSuccessModal`/`MerkleRootProof` · 4 audit log
y dossier. Una señal nueva va a una sola profundidad; la historia entera es solo Depth 4. El único
modal que se abre solo es `AnchoringSuccessModal`.

**Dos componentes llevan la regla adentro:** `VerificationBadge` recibe el TXID, no un booleano
(regla 17); `HashChip` recibe el hash completo y trunca 6+4 contando el `0x` (D-069).

**El header es uno** (D-074): `PanelShell` pinta siempre logo + campana + perfil + idioma; con
padre, la pantalla pasa `back`. No reintroducir un `hideBrand`. Login solo lleva el toggle de idioma.

**El armazón vive en el layout, no en la pantalla** (SPEC-601): `PanelShell` (sidebar, header,
`<main>` con el `<Outlet />`, bottom nav) lo monta la ruta de layout y no se desmonta al navegar. La
pantalla envuelve su contenido en `PanelLayout`, que solo publica título, `context`, `back` y
`headerAction` al header. Una pantalla nueva no lleva guard ni `enabled: ready`: el `beforeLoad` del
layout ya resolvió la sesión antes de montarla.

**Una pantalla de detalle no dibuja nada antes de su dato** (`SPEC-110`): hasta que llega, `<Loading />`
dentro de su sección con test ID, y el subtítulo del header va como `context={dato ? valor : null}`.
`null` reserva la línea; dibujar las tarjetas vacías o agregar la línea después hacía saltar el
contenido (CLS de 0,27 a 0,84 en cuatro detalles, 2026-10-06; ahora ≤ 0,05 en las 17 pantallas).

**Mobile-first**: la captura es un teléfono de ~380px; los strings en español son 20-30% más largos,
nada de anchos fijos salvo FAB e íconos.

## Lo que la captura pide y el contrato no da

**Sin dato, no se dibuja** (regla 17 llevada a los datos). La deuda se declara en el prop que no se
puede llenar. Antes de declarar un dato ausente, mirá el esquema: el "Price from" existía a nivel
unidad.

| Qué falta | Dónde | Qué costaría |
|---|---|---|
| Pill de estado del investor y StatCards de `/developer/investors` | `InvestorCard` prop `status` | `investorDirectoryEntrySchema` no expone `status` |
| "Price from" en el listado del investor | `ProjectCard` prop `priceLabel` | `GET /projects` no agrega el mínimo de las unidades (`GET /developer/projects` sí) |
| Rating del developer (capturas 6-7, 59-60) | — | **No se construye** (D-094) |
| KPI "Active investors" y "Verified events" (33/34) | `developer.index.tsx` | `developerKpisSchema` no los expone |
| `DocumentCard` completo en los artefactos del dossier | dossier de investor y notary | `dossierArtifactSchema` no trae `filename`/`uploadedAt`/`format` |
| Miniatura por etapa en "Stage Detail" (45) | `developer.progress.tsx` | `developerProgressItemSchema` no referencia evidencia |

## Trampas

- **Leaflet da `z-index` 400–1000 a sus capas**: todo contenedor de mapa lleva `isolate` o tapa los
  diálogos.
- **`dialog.tsx` trae `sm:max-w-lg` y `twMerge` no lo pisa con un `max-w-*` sin variante**: un
  diálogo más ancho lo pide en `sm:`.
- **El ícono por defecto de Leaflet sale roto en producción** (Vite no publica su carpeta): las
  imágenes se importan como assets (`usarIconoPublicado`).
- **Un contenedor dentro del portal de Radix se monta un render tarde**: un efecto que lo necesite
  lo recibe como estado (`ref={setContenedor}`), no con `useRef`.
- **Dos `import()` concurrentes de un módulo con `vi.mock` dan dos instancias**: montá el mapa con un
  solo render en los tests.
- **El front no importa valores de `@plataforma/shared` por el índice** (es CJS): los tests pasan y
  el navegador falla. Ver `packages/shared/CLAUDE.md`.
- **`styles.test.ts` colecciona una cantidad de tests que varía entre corridas**, sin fallar nunca.
  Si un día falla de verdad, empezá por ahí.
- **`.find()` sobre eventos en orden ascendente devuelve el más viejo**: para el estado actual, el
  último (`anclajeVigenteDelStage`).
- **Una acción de audit sin clave en el diccionario se muestra en crudo**: una acción nueva de
  `writeAuditLog` lleva su `audit.action.*` en los dos idiomas.
- **Un `*.test.tsx` en `src/routes/` lleva prefijo `-`**, o el generador de rutas lo trata como ruta.
- **Los E2E esperan a que React monte** (`waitForHydration`): un click antes hace submit nativo y
  parece un fallo de backend.
- **`test.fail()` a nivel `describe` marca todos los tests que siguen**: va dentro del cuerpo.
- **Selectores accesibles** (`getByLabel`, `getByRole`): fallan cuando la accesibilidad está mal.
- **Lo que tiene que cambiar junto con el render no va en un `useEffect`**: el efecto corre después
  de pintar, y un test que lee el DOM apenas aparece el texto falla de vez en cuando (pasó con
  `document.documentElement.lang`). Se escribe donde cambia el estado (`vigenteCon`).
- **Una regla CSS con nombre de utilidad de Tailwind pelea con el orden del archivo.**
- **`Link` de TanStack pinta activo por prefijo**: el tab índice pide `activeOptions.exact`.
- **Biome necesita `css.parser.tailwindDirectives`** para parsear `@theme`.
- **En dev `/api` va por el proxy de Vite; en producción por `VITE_API_ORIGIN`**: si la consola dice
  CORS, falta `WEB_ORIGIN` en la API (`specs/RUNBOOK-deploy.md`).
- **Los E2E entran con la password del seed** (`e2e/_credenciales.ts`), nunca con un literal.
- **Si los E2E locales fallan en masa y en CI pasan, es la `dev.db`**: `pnpm db:seed`.
- **Si fallan sueltos en el login con "No se pudo conectar con la API", es `tsx watch`**: reinicia
  la API ante un *change* en `node_modules/.pnpm` que la suite no causa (visto el 2026-10-02).
  Levantá la API sin `watch` y la web aparte; Playwright reusa los dos.
- **`montarRuta` cuelga la pantalla del layout de su prefijo**, con el `requireRole` real: un test
  que la monta en un path inventado (`/perfil`) se queda sin header.
- **El TBT de Lighthouse en modo simulado no es el de la CPU limitada de verdad**: en el login daba
  90–140 ms y con `Emulation.setCPUThrottlingRate` 4× da 0. Para comparar pantallas con sesión, Playwright
  con CDP (CPU 4×, 150 ms de latencia, 1,6 Mbps) y `PerformanceObserver` de `longtask` y `layout-shift`.
- **PostHog descarta los eventos de un navegador automatizado sin avisar**: headless, o con
  `navigator.webdriver`. Para ver qué manda, Playwright con `headless: false`,
  `--disable-blink-features=AutomationControlled`, `localStorage.ph_debug = 'true'` y los `POST` a
  `posthog.com` abortados con `page.route`, para no ensuciar los datos reales.
- **`parentRoute` de TanStack no está resuelto antes de `addChildren`**: para armar un árbol a mano,
  separá los hijos vos.

## Comandos

```bash
pnpm --filter web dev             # SPA en :3000 (puertos en ports.ts), con proxy a la API
pnpm --filter web test            # vitest
pnpm --filter web build           # dist/ — lo que se publica como static site
pnpm --filter web e2e:ui          # playwright interactivo
pnpm --filter web test:a11y       # vitest con axe después de cada test (SPEC-112)
pnpm --filter web e2e a11y        # axe en el navegador real
```

**Una violación de accesibilidad conocida se registra en `a11y/hallazgos.ts`, no se silencia**, con
la spec que la cierra; al arreglarla, se borra su fila en el mismo commit. `test:a11y` no bloquea.
