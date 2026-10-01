# Auditoría — Calidad del frente: accesibilidad, responsive y mantenibilidad (2026-09-11)

> Revisión transversal de `apps/web` pedida por el dueño: *"darle un sutil salto de calidad, un
> pulido, que se note que le prestamos atención a los detalles"*. **No propone ninguna pantalla,
> ruta ni componente nuevo** — todo lo de acá se resuelve dentro de las superficies que M2-D2 y
> M2-D5 ya aprobaron, y ninguna recomendación toca la jerarquía de precedencia de `CLAUDE.md`.
>
> No es un criterio del SOM ni bloquea la entrega del Milestone 3. Es deuda de pulido con
> evidencia, para hacerse cuando el milestone deje aire.

## Cómo se hizo

Las 42 rutas se recorrieron **contra `pnpm dev` local**, no leyendo prosa:

- **Medición en el navegador** (Claude en Chrome) a **390px** —el viewport de referencia de
  M2-D3— y a **1534px**, con las cuatro cuentas demo. El ancho de 390 se logró montando cada ruta
  en un `iframe` de 390×844 dentro de la pestaña ya autenticada (`sessionStorage` se comparte
  entre el documento y sus iframes del mismo origen): `resize_window` no cambia el viewport de
  render y habría dado un falso "todo entra".
- **Sondas por ruta**: `scrollWidth − clientWidth` (overflow horizontal), `getBoundingClientRect()`
  de cada control (área táctil), ancho del pill contra el ancho real de su texto vía `Range`,
  orden de encabezados, `<img>` sin `alt`, cantidad de live regions.
- **Árbol de accesibilidad real** (`read_page`) para los nombres accesibles, no deducidos del DOM.
- **Verificación cruzada de tokens**: se compiló `pnpm --filter web build` y se comparó el conjunto
  de clases usadas en `src/**/*.tsx` contra las clases realmente presentes en el CSS emitido. Es
  lo que destapó F-01.

Baseline al momento de la auditoría: `biome check` limpio sobre 131 archivos, `tsc --noEmit`
limpio, **153 tests en 21 archivos, todos en verde**.

---

## Resumen

**No es spaghetti, y está por encima del promedio.** El `ApiPort` único, los helpers puros
extraídos a `lib/` con sus tests, `navTabs.ts` como tabla normativa en vez de cuatro copias,
`VerificationBadge` recibiendo el TXID en vez de un booleano, `KpiValue` distinguiendo `null` de
`0`: nada de eso se escribe apurado. Los comentarios explican *por qué* y varios documentan una
trampa ya pagada. En 42 rutas hay solo **3** sub-componentes definidos dentro de una ruta; el resto
compone.

**El patrón de lo que falta es uno solo: las reglas están escritas y no tienen guardia.** Donde
hay un test que las sostiene —los 20 colores normativos de `styles.test.ts`— no hay drift. Donde no
lo hay, se filtró en silencio, y el caso más caro (F-01) lleva 52 usos sin que nadie lo note.

| # | Hallazgo | Dónde | Nivel |
|---|---|---|---|
| **F-01** | 3 tokens de la escala de íconos **no existen**: 52 clases muertas | `styles.css` + 16 archivos | 🟢 |
| **F-02** | `ui/dialog.tsx` es shadcn sin adaptar: sin fondo, sin tokens propios, 2 strings hardcodeados | `components/ui/dialog.tsx` | 🟢 |
| **F-03** | Cero `aria-live` / `role="alert"` en los 131 archivos | toda la app | 🟢 |
| **F-04** | `<html lang>` no cambia con el idioma | `index.html:2` | 🟢 |
| **F-05** | `document.title` es "PropNexus" en las 42 rutas | `index.html:7` | 🟢 |
| **F-06** | Sin `aria-current="page"` en la navegación | `BottomNav.tsx`, `Sidebar.tsx` | 🟢 |
| **F-07** | `NotificationBell` dibuja el contador y no lo anuncia | `NotificationBell.tsx:22` | 🟢 |
| **F-08** | `<a>` conteniendo `<button>` (interactivo anidado) | las dos colas compartidas | 🟢 |
| **F-09** | Áreas táctiles por debajo del mínimo AA (24×24) en dos controles | `ProgressTimeline`, `HashChip` | 🟢 |
| **F-10** | `StatusPill` estirada a ancho completo en 5 superficies | `ProjectCard.tsx`, `ProfileScreen.tsx` | 🟢 |
| **F-11** | `/notary/dossiers` usa `bg-surface-alt` donde el resto usa `bg-card` | `PendingDossiersQueue.tsx:31` | 🟢 |
| **F-12** | Dos controles enfocables y anunciados que no hacen nada sin datos | `investor.unit.$unitId.index.tsx` | 🟢 |
| **F-13** | 20 de 31 tipos de `api/types.ts` ya tienen schema en `packages/shared` | `api/types.ts` | 🟡 |
| **F-14** | 23 `as never` apagan el chequeo del diccionario tipado | 14 archivos | 🟢 |
| **F-15** | 65 repeticiones del mismo shell de card | 30 archivos | 🟢 |
| **F-16** | `KpiValue()` es un hook con nombre de componente | `components/KpiValue.tsx` | 🟢 |
| **F-17** | `SecondaryButton` / `DangerButton` aceptan `loading` y lo ignoran | `PrimaryButton.tsx` | 🟢 |
| **F-18** | 30 de 42 rutas no manejan estado de carga | `routes/` | 🟢 |

---

## F-01 · El 25% de la escala de íconos no existe

`--size-icon-sm`, `--size-icon-md` y `--size-icon-lg` **no están declarados en `styles.css`**. Se
usan **52 veces**: `size-icon-sm` ×43, `size-icon-md` ×8, `size-icon-lg` ×1.

Tailwind v4 no genera una utilidad cuyo token no existe, **no emite ningún error**, y el ícono cae
al default de Lucide. Medido en vivo en `/investor/buy`:

```
class="lucide lucide-map-pin mr-s1 size-icon-sm"  →  24×24px
getComputedStyle(body).getPropertyValue('--size-icon-sm')  →  (vacío)
```

Los que sí existen son `--size-icon-inline` (16px), `--size-icon-pill`, `--size-icon-stat` (20px),
`--size-icon-nav` y `--size-icon-empty`.

Es la regla de `apps/web/CLAUDE.md` —*"ningún componente escribe un color, tamaño, radio o sombra
literal"*— rota en 16 archivos, y **pasó porque `styles.test.ts` verifica los colores y no los
tamaños**. Agregar los tres tokens es de una línea; lo que cierra la puerta es extender ese test al
resto de la escala de M2-D3, que es el mismo patrón del valor dorado de `contracts/`.

Mismo mecanismo, otras 5 clases muertas detectadas por la comparación contra el CSS emitido:

| Clase | Dónde | Qué es |
|---|---|---|
| `top-s16` | `investor.buy.tsx:301` | la escala de espaciado llega a `s12` |
| `bg-background` | `ui/dialog.tsx:61` | resto de shadcn — ver F-02 |
| `ring-offset-background` | `ui/dialog.tsx:70` | ídem |
| `focus:ring-ring` | `ui/dialog.tsx:70` | ídem |
| `text-muted-foreground` | `ui/dialog.tsx:70,132` | ídem |

## F-02 · `ui/dialog.tsx` es el peor archivo del frente

Es shadcn sin adaptar, y es el primitivo de **los 11 modales de la app**:

- **`bg-background` no existe ⇒ el modal no tiene fondo propio.** Por eso **9 de los 11 call sites
  pasan `className="bg-card"` a mano**. Es el síntoma clásico de primitivo roto: cada consumidor
  parchea en vez de arreglarse el primitivo. `LocationMapModal.tsx:241` no lo parchea y queda
  transparente sobre el backdrop.
- **`gap-4 p-6 rounded-lg shadow-lg text-lg text-sm top-4 right-4 size-4`** — la escala default de
  Tailwind, no la de M2-D3. Hay `--shadow-modal` y `--radius-xl` declarados *específicamente para
  modales* y no se usan.
- **`border` sin color**: en Tailwind v4 el default pasó a ser `currentColor`, así que el borde del
  modal es del color del texto.
- **Dos strings hardcodeados** (regla 14): `<span className="sr-only">Close</span>` y
  `<SecondaryButton>Close</SecondaryButton>`. La clave `common.close` ya existe en el diccionario.

El archivo ya está declarado como "editado en un punto" (el botón de cierre usa `SecondaryButton`).
La adaptación quedó a medias.

## F-03 a F-07 · Accesibilidad: lo estructural está bien, falta la capa de estado

Lo que **ya está bien** y conviene no romper: landmarks correctos (`header` / `nav` / `main`),
`aria-label` en todos los controles de utilidad, `<dl>/<dt>/<dd>` en las fichas de datos,
`role="switch"` con `aria-checked` en las preferencias. Se verificó contra el árbol de
accesibilidad real: los 5 toggles del perfil **sí** anuncian su nombre (Chrome resuelve
`<label for>` sobre un `<button>`, que era la duda).

Lo que falta es todo lo que **cambia**:

| | Evidencia | Fix |
|---|---|---|
| **F-03 · Cero live regions** | `grep -rn "aria-live\|role=\"alert\"" src/` → 0 resultados en 131 archivos | En una app cuyo núcleo es *"esperá a que confirme la cadena"*, ningún error, confirmación de anclaje ni cambio de estado async se anuncia. `login.tsx` muestra "Credenciales inválidas" y un lector de pantalla no se entera |
| **F-04 · `lang` congelado** | Toggle a EN en vivo: el `h1` pasó a "Developer panel", `localStorage` a `en-US`, `document.documentElement.lang` siguió en `"es"` | Un `useEffect` en `LocaleProvider` |
| **F-05 · `title` congelado** | `document.title === 'PropNexus'` en las 42 rutas | Es lo primero que un lector anuncia al navegar en una SPA, y además vuelve inútil el historial del navegador |
| **F-06 · Sin `aria-current`** | `[...document.querySelectorAll('nav a')].map(a => a.getAttribute('aria-current'))` → todos `null` | El tab activo se distingue **solo** por color y peso. `activeProps` ya existe en los dos componentes: es agregarle el atributo |
| **F-07 · Contador mudo** | `NotificationBell` dibuja "9+" y su `aria-label` dice solo "Notificaciones" | El dato ya está en el prop `unread` |

**Sobre el foco — se verificó antes de opinar, y no es lo que parecía.** El anillo default de
Chrome es de dos tonos (blanco interior + azul exterior) y **sí se ve** sobre el gradiente morado;
la hipótesis de "1.17:1 de contraste, invisible" era falsa. El problema real es otro: solo **3**
componentes (`Chips`, `ProgressTimeline`, `ToggleSwitch`) definen `focus-visible` propio, y los
~50 restantes heredan un azul `#005FCC` que no es ninguno de los 20 tokens normativos. El detalle
no está mal, está **delegado al navegador** — y variará entre Chrome, Safari y Firefox. Peor: donde
sí se definió uno, `focus-visible:ring-primary` es morado sobre morado, o sea **menos visible que
el default**.

## F-08 · Interactivo anidado

`PendingDossiersQueue.tsx:37` y `AssignedStagesQueue.tsx:47` envuelven un `SecondaryButton` dentro
de un `<Link>`. Confirmado en el DOM renderizado de `/notary/dossiers`:

```
A > BUTTON "Revisar"
```

Es HTML inválido (`<a>` no admite contenido interactivo) y la violación `nested-interactive` de
axe. Afecta 4 superficies, porque las dos colas se montan en el panel y en su solapa.

## F-09 · Áreas táctiles por debajo del mínimo

La app es mobile-first por M2-D3 §Principio 4 y los blancos no lo son:

| Control | Tamaño medido | Dónde |
|---|---|---|
| Nodos del `ProgressTimeline` | **16×16**, ×10, adyacentes | `ProgressTimeline.tsx:60` (`size-4`) — es la vía principal del investor al detalle de etapa |
| Botón "copiar" del `HashChip` | **14×14** | todas las superficies de prueba |
| Flecha "Volver" del header | 21px de alto | todas las pantallas con padre |
| Chips de filtro | 32px de alto | audit-log, notificaciones, upload |
| `ToggleSwitch` | 44×24 | los 4 perfiles |

Los dos primeros **no llegan al mínimo 24×24 de WCAG 2.5.8 (nivel AA)**; el resto queda lejos de
los 44 de cualquier guía móvil. **Ninguno pide cambiar el diseño**: el nodo puede seguir midiendo
16px visuales con un área táctil de 44 (`p-s3 -m-s3`, o un pseudo-elemento).

## F-10 · `StatusPill` estirada a ancho completo

`inline-flex shrink-0` **no alcanza** cuando el pill es hijo directo de un contenedor
`flex flex-col`: los flex items se blockifican y `align-items: stretch` los lleva al ancho del eje
cruzado. `shrink-0` gobierna el eje **principal**, no el cruzado.

Medido en `/investor/buy` a 1534px: **608px de pill para 56px de texto**, dentro de una card de
640. A 390px: 326px para 56px de texto.

Superficies afectadas: `/investor/buy`, `/investor/profile`, `/notary/profile`,
`/certifier/profile` y `/investor/unit/:id/dossier`. Se resuelve con `self-start` donde el pill es
hijo de una columna. La variante `developer` de `ProjectCard` no lo sufre porque ahí el pill vive
dentro de una fila `flex items-start justify-between`.

> El comentario de `StatusPill` razona largo y bien sobre la geometría del pill (`whitespace-nowrap`
> y `shrink-0` contra el crecimiento del español) y erra el eje. Vale como recordatorio de que un
> comentario detallado no es evidencia de que el caso esté cubierto.

## F-11 · Fondo inconsistente en la cola del escribano

`PendingDossiersQueue.tsx:31` usa `bg-surface-alt`; medido: `rgb(243, 244, 246)`. Todas las demás
listas de la app usan `bg-card` (`#ffffff`). Contra el `--color-app-bg` off-white, la card del
escribano se ve gris y las otras blancas.

## F-12 · Controles vivos que no hacen nada

`investor.unit.$unitId.index.tsx:173` y `:192`: las dos tiles superiores son `<button>` con
`aria-label` ("Abrir galería", "Abrir mapa") y el handler cortocircuitado —
`onClick={() => imagenes.length && setGaleria(true)}`. Sin fotos y sin coordenadas quedan
enfocables, anunciadas y muertas. Sin `disabled`, el usuario no tiene forma de distinguir "no hay
nada que abrir" de "no anduvo".

## F-13 · La garantía de "drift imposible" está a medias

**Es lo que más pesa a mediano plazo.** `apps/web/src/api/types.ts` son **414 líneas de espejo
manual**, y **20 de sus 31 tipos ya tienen schema Zod en `packages/shared`**:

```
ProjectStatus · EvidenceType · Stage · Project · ProjectDetail · Evidence · DeveloperProject
DeveloperProjectDetail · Invitation · DeveloperContract · InvestorUnit · ProjectDocument
BuildingSchematicFloor · InvestorUnitStage · InvestorUnitDetail · InvestorContract
ContractRelease · BundleFiles · InvestorInvitation · PublicDossier
```

El comentario del archivo dice *"cada uno migra a packages/shared cuando su rebanada lo toque"*.
Las rebanadas ya pasaron y el espejo sigue. Según `CLAUDE.md` §Estructura, `packages/shared` es
*"lo único que vuelve el drift **imposible** en vez de prohibido"* — hoy lo es para 11 tipos de 31.

**El bloqueo real, y por eso no es solo desidia:** los schemas usan `z.coerce.date()`, así que
`StageResponse.createdAt` es `Date` mientras el cable manda `string`. Reusar el tipo inferido tal
cual rompe. La salida es un tipo de **respuesta serializada** derivado del schema, no un archivo
paralelo escrito a mano.

Sin equivalente hoy (11): `ProjectCreated`, `ProjectMemberUser`, `StageEvidenceAnchor`,
`AuditEvent`, `DeveloperUnit`, `DeveloperProjectUnit`, `ProjectStageDetail`, `InvestorUnitNews`,
`MerkleProof`, `InvitationAcceptResult`, `ProgressRow`.

## F-14 · 23 `as never` sobre `t()`

Todos sobre claves dinámicas: `t(\`audit.action.${e.action}\` as never)`,
`t(\`unitStatus.${u.status}\` as never)`, `t(\`project.status.${p.status}\` as never)`…

Es el escape que **apaga el chequeo del diccionario tipado**, y es la causa raíz exacta de las ~20
claves faltantes de `AuditLog` que cerró el ítem 2.4 del plan de entrega. `t()` está tipado como
`string` pero en runtime devuelve `undefined` para una clave ausente, y el `?? fallback` está en
unos call sites y no en otros — `investor.buy.tsx:146` no lo tiene y renderiza un pill vacío.

Con las uniones de estados ya cerradas en `packages/shared`, casi todas se pueden tipar de verdad
con un template literal type.

**El diccionario en sí está impecable**: 538 claves en `es-AR` y 538 en `en-US`, ninguna faltante y
ninguna de más, verificado parseando el archivo. Los 33 strings idénticos entre idiomas son todos
legítimos (marcas, símbolos, interpolaciones puras) salvo uno: `schematic.floorPrefix` vale `'P'`
—de "Piso"— también en inglés.

## F-15 · 65 repeticiones del mismo shell de card

| Veces | Clase |
|---|---|
| 44 | `rounded-xl bg-card p-s4 shadow-e1` |
| 16 | `rounded-xl bg-card p-s4 text-body-sm text-text-muted shadow-e1` (el empty-state) |
| 5 | `rounded-lg bg-card p-s3 shadow-e1` |

**Sin componente nuevo** (nada que proponerle a M2-D3): dos constantes exportadas cubren las 65 y
vuelven imposible que la próxima card salga con el radio o el padding de otra — que es exactamente
la deriva que muestra la tercera fila.

## F-16 · `KpiValue()` es un hook con nombre de componente

`components/KpiValue.tsx` llama `useTranslation()` adentro y se invoca como `const kpi = KpiValue()`
en `developer.index.tsx:41`, `certifier.index.tsx:29` y `notary.index.tsx:34`. Funciona, pero
**ninguna regla de lint puede verlo** porque el nombre es PascalCase: `react-hooks/rules-of-hooks`
lo trata como componente. Se llama `useKpiValue`.

## F-17 · Prop aceptada y descartada en silencio

`ButtonProps` en `PrimaryButton.tsx` declara `loading?: boolean`, pero solo `PrimaryButton` lo
desestructura. `<SecondaryButton loading>` y `<DangerButton loading>` type-checkean y no hacen nada.

## F-18 · 30 de 42 rutas no manejan estado de carga

Renderizan `data ?? []` o `data?.campo`: durante todo el fetch muestran el **empty-state completo**
("No hay proyectos") y después parpadean a contenido. No lo ve ningún test y se nota en cada
entrada fría.

Relacionado: **ninguna de las 42 rutas tiene test unitario** (6819 líneas). Es una decisión
declarada en `apps/web/CLAUDE.md` y la mitigación —sacar la lógica a `lib/` con tests propios,
como `anclajeVigenteDelStage` y `unicosPorStageId`— está bien hecha y hay que sostenerla. Pero deja
al estado de carga sin ninguna red.

---

## Lo que NO hay que tocar

| Qué | Por qué |
|---|---|
| **La estructura de `components/domain/`** | Los patrones P1–P10 no se pisan, y la disciplina de "sin dato no se dibuja" con la deuda declarada en el prop que no se puede llenar es mejor que la práctica habitual |
| **Los comentarios largos** | Explican el porqué y varios documentan una trampa ya pagada. Valen lo que ocupan |
| **El layout de desktop** | Hoy es la columna mobile estirada más el `Sidebar`. M2-D3 §Principio 4 pide además columnas, pero **la única captura de desktop del catálogo es la 61** y es del panel del investor: sin referencia para developer / notary / certifier, diseñarlo sería inventar (prohibición de `CLAUDE.md`) |
| **`ProjectCard` con variante `developer`** | La excepción a la anatomía de M2-D3 está justificada por las capturas 35/36 y documentada en el componente. Es la regla 1 aplicada bien |

## Orden sugerido

Ordenado por superficie limpiada sobre línea tocada, no por severidad:

1. **F-01** — los 3 tokens + extender `styles.test.ts` a la escala completa. Arregla 52 usos y
   cierra la puerta para siempre. Es el único ítem que además **agrega una guardia**.
2. **F-02** — `dialog.tsx` adaptado de verdad (tokens propios, `bg-card` adentro, las dos claves
   i18n). Borra de paso el parche repetido en 9 archivos.
3. **F-04, F-05, F-06, F-03** — `lang`, `title`, `aria-current` y una live region en el error de
   login. Cuatro cambios chicos, todos en el armazón compartido, todos visibles para cualquier
   revisión de accesibilidad de Catalyst.
4. **F-09, F-10, F-11, F-12** — el pulido visible: áreas táctiles, el pill estirado, el fondo de la
   cola del escribano, los dos botones muertos. Cero cambio de diseño.
5. **F-08, F-16, F-17, F-14, F-15** — higiene de código.
6. **F-13, F-18** — los dos estructurales. Merecen su propia sesión y probablemente su propio
   `SPEC`.

---

## Anexo — dos cosas de fuera del frente que aparecieron en el camino

No son parte del alcance de esta auditoría; se anotan porque se toparon al levantar el entorno.

- **`pnpm db:seed` revienta sobre una base ya sembrada.** `apps/api/src/db/fixtures.ts:196`
  (`sembrarUnidadVendida`) hace `.onConflict(...).doNothing().executeTakeFirstOrThrow()`, que por
  definición no devuelve fila cuando la fila ya existe: tira `NoResultError`. Los usuarios sí
  quedan resembrados porque `sembrarUsuarios` corre antes de la falla, con lo cual el script deja
  la base a medio aplicar. Es la regla 8 (idempotencia) en un lugar donde no estaba escrita.
- **`routes/login.test.tsx` escupe un warning del generador de rutas en cada `pnpm dev`**
  (*"does not export a Route"*). Se resuelve renombrándolo `-login.test.tsx`, como ya está hecho
  con `-slugify.test.ts` y como la propia trampa de `apps/web/CLAUDE.md` indica.
