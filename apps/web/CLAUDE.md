# apps/web — el frente

> Se carga solo al tocar este subárbol. **El flujo de trabajo está en el `CLAUDE.md` de la raíz** y
> no se repite acá: abrir la captura, abrir su fila de M2-D5, transcribir.

TanStack **Router** sobre Vite — **SPA, sin SSR** (D-065) · React 19 · Tailwind v4 · Lucide ·
Vitest+jsdom · Playwright.

## Estado: se está reconstruyendo

El front tenía 2% de conformidad y se demolió (D-064). Hoy queda **el esqueleto correcto y nada
más**: no hay pantallas transcritas todavía.

| Existe | Qué es |
|---|---|
| `api/port.ts` | Único lugar que hace `fetch`. Su cliente pasa a derivarse del contrato (D-066) |
| `auth/*` | `useRoleGuard` implementa los AuthGuard role groups de M2-D1 §7.2 |
| `i18n/*` | Diccionario propio, sin librería. Crece con cada pantalla |
| `routes/login.tsx` | Único path correcto de M2-D5 (fila 01). Falta rehacerle la piel |
| `routes/{investor.buy,developer,notary,certifier}.tsx` | **Stubs deliberados**: el path y el guard son reales, la superficie no existe |
| `styles.css` | **Los 51 tokens de M2-D3** en `@theme` — 20 colores normativos, escala tipográfica, espaciado de 4px, radios, elevación, tamaños de ícono |
| `lib/cn.ts` · `components.json` | Base de shadcn/ui. Los primitivos se agregan **de a uno**, cuando su componente de dominio los necesita |

**No hay** todavía ninguno de los 33 componentes de M2-D3 ni los patrones P1–P10. Ver
[`specs/SPEC-014`](../../specs/SPEC-014-reconstruccion-del-front.md).

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
  otro lado — ver `specs/RUNBOOK-deploy.md`.

## Trampas verificadas

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

## Comandos

```bash
pnpm --filter web dev             # SPA en :3000, con proxy a la API
pnpm --filter web test            # vitest
pnpm --filter web build           # dist/ — lo que se publica como static site
pnpm --filter web e2e:ui          # playwright interactivo
pnpm --filter web e2e:report      # reporte HTML de la última corrida
```
