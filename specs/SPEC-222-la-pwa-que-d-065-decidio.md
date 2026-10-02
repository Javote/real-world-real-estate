# SPEC-222 — La PWA que D-065 decidió y nunca se hizo

> **Estado: hecha el 2026-09-30 en la rama `spec-222-pwa`, sin mergear.** Se mergea a `main`
> después de entregar M3 (decisión del dueño). Lo que queda después del merge es la pasada manual
> de §Verificación contra producción. Abajo, §Cómo quedó registra lo que la implementación cambió
> respecto del plan.

> Nace revisando el guion del video (2026-09-30). Su Anexo B reportaba que no hay PWA instalable,
> mientras que `CLAUDE.md` describía el front como "SPA + PWA". **Postergada a después de grabar
> el video.** Si entra antes o después de la entrega de M3 lo decide el dueño: ningún criterio del
> SOM la pide y ningún archivo de `docs/` la menciona. La obligación sale de **D-065** ("PWA desde el
> arranque: manifest, service worker y shell offline").

## Lo que hay hoy, medido el 2026-09-30

| Pieza | Estado |
|---|---|
| `apps/web/public/manifest.json` | Existe y producción lo sirve (`200`, `application/json`), pero es el boilerplate de Create TanStack App: `"name": "Create TanStack App Sample"`, `theme_color` `#000000` |
| `logo192.png` / `logo512.png` | Los del boilerplate, no la marca de PropNexus |
| `index.html` | Tiene `theme-color` `#6D4AFF`, pero **no linkea el manifest** ni tiene `apple-touch-icon` |
| Service worker | No hay: `/sw.js` da `404` en producción y nada lo registra |
| Cabeceras de Render | Los estáticos salen con `Cache-Control: public, max-age=0, s-maxage=300`. Sirve para un `sw.js`: el navegador siempre lo revalida |
| `specs/stack.md` | Ya lo lista como ○ (decidido, no corre). Lo que no cuadraba era `CLAUDE.md` |

## Alcance

1. **El manifest de verdad.** `name` "PropNexus", `short_name` "PropNexus", `start_url` `/`,
   `scope` `/`, `display` `standalone`, `theme_color` `#6D4AFF` (el mismo de `index.html`, que es
   el token de M2-D3), `background_color` el del fondo de la app según su token. Los nombres son
   marca y no pasan por el diccionario (D-018).
2. **Los íconos, a partir de `PropNexusMark`** (las tres barras): 192, 512 y 512 `maskable` con
   margen de seguridad, más `apple-touch-icon` 180. Se generan una vez desde el SVG y se commitean
   como PNG. Los del boilerplate se borran.
3. **`index.html`:** `<link rel="manifest">` y `<link rel="apple-touch-icon">`.
4. **Un service worker escrito a mano, sin dependencias** (`apps/web/public/sw.js`, unas 40 líneas),
   con tres reglas y ninguna más:
   - **Navegaciones:** primero la red. Si no hay red, el `index.html` cacheado. Ese es el shell
     offline de D-065.
   - **`/assets/*`:** primero la caché. Vite les pone hash al nombre, así que nunca cambian.
   - **Todo lo demás pasa sin tocarse.** En particular `/api/*` y cualquier otro origen.
   - El caché lleva versión en el nombre, y `activate` borra los de versiones anteriores.
5. **El registro, en un módulo testeable** (`src/lib/pwa.ts`) y no en `main.tsx`, que está fuera
   de la cobertura. Registra solo si `import.meta.env.PROD` y si existe `navigator.serviceWorker`.
   El umbral de `apps/web` es 100/100/100/100 (SPEC-019), así que el módulo llega con su test.

**¿Por qué no `vite-plugin-pwa`?** Resuelve el precache de todo el build, y eso acá no hace falta:
las tres reglas de arriba entran en un archivo que se lee entero en un minuto. Sumarlo sería una
dependencia más, con Workbox adentro, para una política más difícil de auditar.

## Invariantes

- **Ninguna respuesta de la API se cachea, nunca.** Una respuesta vieja puede mostrar un stage
  `Pending` que ya está `Confirmed`, o al revés. Eso contradice la regla dura 17 (no mostrar una
  señal de prueba que no se pueda sustanciar) y la reconciliación de lectura de D-077. Un test lo
  fija: el handler de `fetch` no llama a `respondWith` para una URL bajo `/api/`.
- **Offline no se inventa estado.** El shell carga y las pantallas muestran el error de red que ya
  tienen. No hay datos "de la última vez".
- **El service worker no hace `skipWaiting` a ciegas.** La versión nueva toma control en la próxima
  navegación. Nunca a mitad de una sesión con un modal de anclaje abierto.

## El rollback, antes de deployar

Un service worker vive en los navegadores que lo instalaron: **revertir el commit no lo borra.**
Por eso esta spec deja escrito, antes del primer deploy, el `sw.js` de baja: un worker que en
`activate` borra sus cachés y se desregistra (`self.registration.unregister()`). Deployarlo en el
mismo path es el rollback. Va en `specs/RUNBOOK-deploy.md`, en el mismo commit que el worker.

## Verificación

- `pnpm verify:all` en verde, con el test de `src/lib/pwa.ts` y el del handler de `fetch`.
- **A mano, contra producción, después del deploy:** en Chrome, DevTools → Application → Manifest,
  sin errores y con los íconos. En Service Workers, uno activo. Con Network en *Offline*, recargar
  `/investor/buy` muestra el shell y el error de red, no el dinosaurio. Y Chrome ofrece instalar.
- `curl -I https://propnexus-web.onrender.com/sw.js` → `200`, `Content-Type` de JavaScript y
  `max-age=0`.

## Qué se toca en el mismo commit

- `specs/stack.md`: la fila PWA pasa de ○ a ●.
- `CLAUDE.md` §Estructura y §Stack: se saca la aclaración "sin hacer".
- `specs/archive/GUION-2026-09-21-video-walkthrough.md` Anexo B: el ítem "No hay PWA instalable" se
  actualiza. Si el video ya se grabó, queda como nota histórica.
- `specs/RUNBOOK-deploy.md`: el rollback de arriba.

## Nivel

🟡: toca el deploy y deja estado persistente en los navegadores de los usuarios. Se revisa línea
por línea, con más cuidado en `sw.js`.

## Tamaño

Una sesión corta, entre 1 y 2 horas. Lo que más tiempo lleva son los tests del worker y la pasada
manual contra producción, no el código.

## Cómo quedó

| Pieza | Dónde |
|---|---|
| Manifest | `apps/web/public/manifest.json` — `background_color` es `--color-app-bg` (`#f4f1ed`) |
| Íconos | `apps/web/public/icons/`: `icon.svg` (también es el favicon), `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`. Se generan con `node apps/web/scripts/iconos.mjs`, que rasteriza el SVG con el Chromium de Playwright (sin dependencias nuevas). El `favicon.ico` y los `logo*.png` del boilerplate se borraron |
| Worker | `apps/web/public/sw.js` |
| Rollback | `apps/web/sw-baja.js`, **fuera de `public/`** para que no se publique. `RUNBOOK-deploy.md` §3 (y su versión en inglés en `specs/evidencia-m3/5-ops/runbook.md`) |
| Registro | `apps/web/src/lib/pwa.ts`, llamado desde `main.tsx` con `import.meta.env.PROD` y `navigator.serviceWorker` como argumentos, así el módulo se testea sin tocar el entorno. Un registro que falla va a Sentry |
| Tests | `src/lib/pwa.test.ts` (el registro, y que manifest, íconos e `index.html` se correspondan, con los tamaños leídos de la cabecera de cada PNG) y `src/lib/sw.test.ts` (los dos workers corridos tal cual sobre un scope falso: cada regla de arriba tiene su caso) |

**Dos correcciones al plan:**

- **Sin `skipWaiting`, la versión nueva no toma el control "en la próxima navegación"** como decía
  §Invariantes: espera a que se cierren **todas** las pestañas de la app. Es más conservador todavía,
  y es lo que se quería: nunca cambia debajo de una sesión abierta.
- **El worker de baja no recarga las pestañas.** El primer borrador lo hacía, y con la app todavía
  registrando `/sw.js` en cada carga eso era un bucle: instalar, desregistrarse, recargar, instalar.
  Como no tiene handler de `fetch`, no hace falta recargar nada.

Se probó que los tests muerden: sacar la regla de `/api/` de `sw.js` pone rojo el caso "una
navegación a la API pasa de largo".

