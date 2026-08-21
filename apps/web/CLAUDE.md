# apps/web — el frente

> Se carga solo al tocar este subárbol. Las reglas duras, las prohibiciones y la deuda
> transversal están en el `CLAUDE.md` de la raíz y **no se repiten acá**.

TanStack Start + Router + Query · React 19 · Tailwind v4 · Lucide · Vite · Vitest+jsdom (D-002).

**Esto es una semilla, no la app.** Sin `GradientHeader`, sin `BottomNav`, paleta equivocada,
textos hardcodeados, "Milestones" donde va "Stages". **Es lo esperado, no un bug que arreglar de
paso.** Lo único que se conserva es el patrón `ApiPort`; el resto de la superficie se reemplaza.
Falta shadcn/ui, y reemplazar `styles.css` (~1000 líneas de CSS de la maqueta vieja) por los
tokens de M2-D3 (D-024). Tailwind v4 y `lucide-react` **ya están instalados**: no los agregues.

## Antes de tocar una pantalla

`M2-D1` (árbol de pantallas y permisos del rol) + `M2-D3` (componentes). Si la pantalla muestra un
hash, TXID o Merkle root, además `M2-D4` — sus 10 patrones son normativos. Qué endpoint consume lo
dice `M2-D5` §4-6.

## Específico de este frente (lo que no está en la raíz)

- **Mobile-first**: todo flujo funciona en una columna de ~380px (M2-D3 §Principio 4). En desktop
  el `BottomNav` se reemplaza por sidebar y el contenido pasa a grillas multi-columna.
- **Los strings en español son 20-30% más largos que en inglés** (M2-D3 §Text growth):
  dimensioná al contenido, nada de anchos fijos salvo FAB e íconos.
- **La clave de `localStorage` del idioma es `propnexus.lang`, literal** (M2-D3 §Localization).
- **Los puertos salen de `ports.ts`**, que los lee de `apps/web/.env` (lo escribe
  `scripts/worktree.sh`) y por defecto da 3000/8787. Si agregás config que necesite el puerto,
  importalo de ahí — hardcodearlo rompe los árboles paralelos (D-031).

## Trampas verificadas

- **2026-08-21 · `styles.css` (legado, D-024) define `.hidden { display: none !important; }`,
  y choca con la clase utilitaria `.hidden` de Tailwind.** El `!important` gana siempre, sin
  importar qué variante responsive se agregue (`md:flex`, `lg:flex`, etc.): un elemento con clase
  `hidden md:flex` queda `display: none` en **todos** los viewports, porque Tailwind emite
  `.hidden { display: none }` (sin `!important`) y el legado — que aparece más abajo en el mismo
  archivo compilado, porque `@import "tailwindcss"` se expande in-place al principio de
  `styles.css` y el resto del archivo (incluido este `.hidden`) queda después — lo pisa. Se
  detectó armando el sidebar de `BottomNav` (`apps/web/src/components/domain/BottomNav.tsx`): el
  `<aside>` nunca aparecía en desktop pese a que `window.matchMedia` confirmaba que la media query
  matcheaba. **La clase `.container` y `.truncate` del legado tienen el mismo riesgo de colisión de
  nombre** (sin `!important`, así que ahí es "gana el que está después en el archivo", más sutil
  todavía) — evitalas o verificá con la extensión de un dev tools que el estilo final sea el
  esperado. **Fix para "hidden por default, visible desde cierto breakpoint":** no uses la clase
  bare `hidden`; escribí la base visible (`flex`) y ocultá con el prefijo invertido
  (`max-md:hidden` en vez de `hidden md:flex`) — compila a `.max-md\:hidden`, un selector distinto
  que no colisiona. Desaparece solo cuando `styles.css` se reemplace entero por los tokens de
  M2-D3 (D-024): hasta entonces, cualquier clase Tailwind cuyo nombre bare coincida con una regla
  del legado es sospechosa.
- **El proxy de nitro en dev convierte `POST` + `401` en `502`.** Reproducible al 100% y solo esa
  combinación (`GET 401`, `POST 400` y `POST 200` pasan bien). Vive en el dev-worker de Vite; en
  producción la API es otro origen y no hay proxy. **Consecuencia: el error de credenciales
  inválidas muestra "No se pudo conectar con la API" en desarrollo.** Antes de debuggear un error
  de auth, comparate contra la API directo.
  **No es una regresión de `h3@2.0.1-rc.25`**, como decía este archivo: al pasar a
  `nitro@3.0.260610-beta`, que trae `h3@2.0.1-rc.22`, el 502 sobrevivió idéntico (D-037). Abarca
  al menos rc.22 y rc.25, así que no se arregla eligiendo versión.
  **2026-08-21 · el 429 del rate limiter NO cae en la trampa**: medido a través del proxy de dev
  con `LOGIN_RATE_LIMIT_MAX=1`, el 401 dio 502 y los 429 siguientes pasaron intactos (D-045). O
  sea que sigue siendo específico del 401, y el mensaje de "demasiados intentos" se ve bien también
  en desarrollo. Es el tipo de cosa que conviene medir y no deducir: el patrón "POST de error se
  rompe" habría predicho lo contrario.
- **Los tests E2E esperan la hidratación, no el DOM.** La app llega por SSR con formularios
  controlados por React: un click antes de que React monte hace submit nativo, nunca corre el
  `preventDefault` y la página recarga sin llamar a la API. Falla intermitente que parece de
  backend. Ver `waitForHydration` en `e2e/walkthrough.spec.ts`.
- **`test.fail()` a nivel `describe` aplica a todos los tests que siguen.** Para marcar uno suelto
  va **dentro** del cuerpo. Puesto afuera hizo fallar los 16.
- **Usá selectores accesibles** (`getByLabel`, `getByRole`): fallan cuando la accesibilidad está
  mal, que es justo lo que querés. Así se descubrió que los `<label>` del login no tenían `htmlFor`.
- **Un `*.test.tsx` dentro de `src/routes/`** lo escanea el router y avisa "does not export a
  Route": prefijalo con `-` o configurá `routeFileIgnorePattern`. Y `vitest` excluye `e2e/`
  explícitamente porque su `include` por defecto matchea `spec` además de `test`.
- **El badge flotante de TanStack Devtools sale en las capturas.** El helper `shot()` lo esconde
  con `addStyleTag`; para capturas nuevas usá ese helper, no `page.screenshot` pelado.

## Comandos

```bash
pnpm --filter web test            # vitest
pnpm --filter web e2e:ui          # playwright interactivo
pnpm --filter web e2e:report      # reporte HTML de la última corrida
pnpm --filter web exec playwright test --project=desktop -g "AUTH-LOGIN-001"
```
