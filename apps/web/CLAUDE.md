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
| `components/domain/` | **12 componentes transversales** de M2-D3 + **6 patrones de prueba** de M2-D4 |
| `components/ui/dialog.tsx` | Primitivo de Radix vía shadcn. Editado en un punto: su botón de cierre usa el `SecondaryButton` de M2-D3, no el de shadcn — un solo sistema de botones |
| `i18n/format.ts` | `Intl` con el locale activo: moneda, fecha, relativos (regla 14) |

**Los 10 patrones de M2-D4 están**, salvo dos que son superficies y no componentes: P6 (audit log)
y P8 (dossier) llegan con su vertical. Faltan 21 componentes de M2-D3 —las cards, los modales de
dominio, los inputs que no son texto—. Ver
[`specs/SPEC-014`](../../specs/SPEC-014-reconstruccion-del-front.md).

## La jerarquía de profundidad, que es lo que hace coherente a la app

M2-D4 §6.1: *"patterns compose, never overlap"*. Cada patrón contesta **una** pregunta y a una
profundidad distinta. Antes de agregar una señal de prueba a una pantalla, ubicá a qué profundidad
va — dos patrones compitiendo por la misma respuesta es redundancia, no rigor.

| Profundidad | Pregunta | Patrón |
|---|---|---|
| 1 | ¿está anclado? | `VerificationBadge` (P1) |
| 2 | ¿cuál hash? (6+4) | `HashChip` (P2) · `StageChips` (P9) |
| 3 | el hash completo, el explorador, la metadata | `TxidModal` (P3) · `AnchoringSuccessModal` (P4) · `MerkleRootProof` (P5) |
| 4 | la historia entera o el artefacto compilado | audit log (P6) · dossier (P8) — **pendientes** |

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
| Nombre de la organización ("Grupo Alpine") | `ProjectCard` prop `developerName` | 🟡 Migración: no hay entidad de organización. `User.fullName` es una persona |
| "Price from" en el listado del investor | `ProjectCard` prop `priceLabel` | Endpoint: `GET /projects` no agrega el mínimo de las unidades. `GET /developer/projects` **ya lo hace** — es copiar esa agregación |

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
