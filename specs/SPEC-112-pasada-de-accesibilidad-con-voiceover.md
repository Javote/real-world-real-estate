# SPEC-112 — Accesibilidad: las tres capas automatizadas + la pasada manual con VoiceOver

> **Origen:** se separa de [`SPEC-104`](SPEC-104-live-regions.md) el 2026-09-22 — esa spec cerró con
> su código y tests automatizados hechos, pero la verificación manual que le quedaba pendiente no
> era solo suya: `SPEC-104` construyó las live regions, no auditó accesibilidad en general. Ampliada
> el mismo día para cubrir también el tooling automatizado que hoy no existe en el repo.
> Nivel 🟢. **Independiente.** No toca ningún criterio del SOM.

## Estado — 2026-09-28

| Capa | Estado |
|---|---|
| 1 · Biome `a11y` | ✅ desde el 2026-09-22 |
| 2 · Vitest + `axe-core` | ✅ `pnpm --filter web test:a11y`: axe después de cada uno de los 1596 tests. Verde, y probada en rojo con una mutación (§2 §El barrido) |
| 3 · Playwright + `axe-core` | ✅ `e2e/a11y.spec.ts`: 12 superficies × mobile/desktop, 10/10 verde, y probada en rojo con una mutación |
| 4 · VoiceOver automatizado (Guidepup) | ❌ **no se hace — limitación de esta máquina**, decisión del dueño el 2026-09-28: macOS 15 exige Acceso total al disco para que Guidepup escriba las preferencias de VoiceOver, y no compensa darlo. Lo medido y cómo retomarla, en §Interfaz §4 |
| 5 · Pasada manual con VoiceOver | ⬜ **lo único que queda de esta spec.** La hace una persona, con el checklist de §Interfaz §5 (que ahora incluye lo que iba a cubrir la 4) |

**Lo que encontraron las capas 2 y 3 salió a dos specs nuevas**, como pide §Alcance, y **las dos
cerraron el mismo 2026-09-28**: [`SPEC-113`](SPEC-113-el-contraste-de-los-tokens-de-m2-d3.md)
(contraste de los tokens normativos de M2-D3, resuelto por el dueño como D-098) y
[`SPEC-114`](SPEC-114-nombres-encabezados-y-landmarks.md) (seis defectos de nombres, encabezados y
landmarks, más un séptimo que apareció al borrar su fila). **`apps/web/a11y/hallazgos.ts` quedó
vacío** y las dos capas siguen en verde: hoy axe no encuentra ninguna violación de WCAG 2.1 AA ni
de best-practice en las 12 superficies recorridas ni en los ~1600 estados de la suite.

**Lo que axe no pudo medir, y queda para la pasada manual (§5):** el texto blanco translúcido sobre el
gradiente del header (axe no calcula contraste sobre gradientes), y todo lo que no es marca: si lo
anunciado se entiende, el orden, el foco en los modales.

## Propósito

`M2-D3` exige WCAG 2.1 AA (regla de diseño, no opcional) y hoy el repo no tiene ninguna capa
automatizada de accesibilidad — ni estática (Biome), ni de componente (Vitest), ni de página real
(Playwright, que **ya está instalado**: `apps/web/e2e/*.spec.ts`, 10 specs, D-015 lo corre como job
no bloqueante de CI). Solo hay `grep` puntual (F-03, que dio `SPEC-104`) y nadie corrió nunca una
pasada real con un lector de pantalla. Las tres capas automatizadas y la pasada manual **no se
solapan**: cada una encuentra una clase de defecto que las otras no ven.

| Capa | Qué encuentra | Qué NO encuentra |
|---|---|---|
| Biome (estático) | `alt` faltante, `lang` del documento, uso de `aria-*` mal formado — en el momento de escribir el JSX | Contraste de color, foco dinámico, nada que dependa de render |
| Vitest + `axe-core` (componente aislado) | Estructura accesible de un componente en sus distintos estados (deshabilitado, error, cargando) | Flujos entre páginas, layout real, contraste calculado por CSS final |
| Playwright + `axe-core` (e2e) | DOM final completo: contraste real, ids duplicados entre layout y contenido, foco atrapado en modales, navegación por teclado en flujos reales | Nada que el propio `axe-core` no sepa evaluar — nunca reemplaza escuchar la app |
| ~~VoiceOver automatizado (Guidepup)~~ — **descartada, ver §4** | Lo que VoiceOver **realmente anuncia**, registrado como texto: nombre y rol de cada control al recorrerlo, los anuncios de las live regions, el orden de lectura, que el foco quede dentro de un modal. Corre antes que la pasada humana y le deja el terreno limpio | Si ese texto **tiene sentido** para una persona — el log dice qué se dijo, no si se entiende |
| VoiceOver manual | Si lo que se anuncia **tiene sentido** — orden narrativo, foco que "se siente" perdido, algo técnicamente válido pero confuso | Nada automatizable — es la única capa que valida experiencia, no marca |

## Alcance / NO-alcance

- **Cubre:**
  1. **Biome** — habilitar el dominio `a11y` en `biome.json`.
  2. **Vitest** — un matcher `toHaveNoViolations` sobre `axe-core` **crudo**, sin wrapper de terceros
     (ver §Interfaz — por qué, verificado en vivo, no supuesto).
  3. **Playwright** — `@axe-core/playwright` sobre los specs de `apps/web/e2e/` existentes y los que
     hagan falta. Hereda el carácter **no bloqueante** de CI que ya tiene toda la suite `e2e`
     (`playwright.config.ts`, comentario de D-015 §5) — esta spec no cambia eso.
  4. ~~**VoiceOver automatizado**~~ con Guidepup, antes de la pasada humana (pedido del dueño,
     2026-09-28) — **intentado y descartado el mismo día como limitación de la máquina**: macOS 15
     pide Acceso total al disco para el último paso. Ver §Interfaz §4.
  5. La **pasada manual con VoiceOver** (macOS) sobre las superficies más usadas de cada rol — no
     las 42 rutas completas, un recorrido representativo (login, alta de proyecto, subir evidencia,
     certificar, dossier, audit log): foco visible y su orden al tabular, `label`/`alt` en controles
     e imágenes, jerarquía de `h1`-`h3`, asociación `label`↔`input`, landmarks (`nav`, `main`,
     `header`) y los anuncios de las tres live regions que ya construyó `SPEC-104`.
- **NO cubre:** parchear cada hallazgo en el momento — automatizado o manual, un defecto real se
  convierte en su propia spec `1xx`, mismo patrón que usó la auditoría original del frente.
- **NO cubre:** decidir que la capa automatizada bloquee CI. Nace no bloqueante, como el resto de
  `e2e`; volverla gate es una decisión aparte, con su propio costo (falsos positivos de `axe-core`
  sobre componentes de terceros, tiempo de suite) que esta spec no evalúa.

## Interfaz

### 1 · Biome — el dominio correcto es `a11y`, no `accessibility`

**Verificado corriendo Biome 2.5.10 real, no leído de documentación de otra versión:**
`{"accessibility": {"all": true}}` (la forma que suele circular) da
`Found an unknown key 'accessibility'` — Biome 2.x agrupa esto bajo `a11y`, y ese grupo no tiene
`"all"`, solo `"recommended"`, `"preset"` o reglas individuales:

```json
// biome.json
{
  "linter": {
    "rules": {
      "a11y": { "recommended": true }
    }
  }
}
```

### 2 · Vitest — `axe-core` crudo, no `vitest-axe`

**Decisión, verificada en vivo el 2026-09-22, no supuesta:** se probó `vitest-axe@0.1.0` (última
estable, hace más de un año) contra Vitest 4.1.10 + React 19 de este repo. Su entry point publicado
`dist/extend-expect.js` —el que su propio README indica importar— **está vacío, 0 bytes**: el
paquete está roto tal como se publicó, no es un problema de compatibilidad de versiones. Existe un
workaround (`import { toHaveNoViolations } from 'vitest-axe/matchers'` + `expect.extend` a mano) que
sí funciona, pero agrega una dependencia de un solo mantenedor sin ganar nada sobre escribir el
matcher nosotros mismos. **Se decidió ir con `axe-core` crudo.**

`apps/web/src/test/a11y.ts` (setup, cargado desde `vitest.config.ts` → `test.setupFiles`):

```ts
import { run, type AxeResults } from 'axe-core'
import { expect } from 'vitest'

expect.extend({
  toHaveNoViolations(results: AxeResults) {
    const violations = results.violations ?? []
    if (violations.length === 0) return { pass: true, message: () => '' }
    const message = violations
      .map((v) => `[${v.id}] ${v.help}\nHTML afectado: ${v.nodes.map((n) => n.html).join(', ')}`)
      .join('\n\n')
    return { pass: false, message: () => `Violaciones de accesibilidad:\n\n${message}` }
  }
})

export async function axe(container: Element) {
  return run(container) as unknown as AxeResults
}
```

Uso en un test de componente:

```tsx
const { container } = render(<InputField label="Correo electrónico" name="email" />)
expect(await axe(container)).toHaveNoViolations()
```

**Verificado con los dos casos de control** (2026-09-22, contra Vitest 4.1.10 real): un `<img>` sin
`alt` falla con el mensaje `[image-alt] Images must have alternative text`; un
`<button aria-label="Cerrar">` pasa limpio. `axe-core` resuelve a la 4.13.0 actual sin pin viejo.

#### El barrido: axe después de cada test, no fixtures nuevos (2026-09-28)

El matcher sigue disponible para un test puntual. Pero **la forma principal de la capa es otra**,
elegida después de medir: la suite de `apps/web` ya renderiza cada componente de M2-D3 y cada ruta
en sus estados reales (vacío, cargando, error, deshabilitado, con modal abierto) — 1596 tests.
Escribir fixtures aparte para axe duplicaría esas props y cubriría menos estados. Así que:

```
apps/web/a11y/hallazgos.ts       el registro de hallazgos abiertos (regla + patrón de HTML + spec)
apps/web/a11y/vitest-setup.ts    afterEach: axe sobre document.body, falla solo con lo no registrado
apps/web/vitest.a11y.config.ts   la config base + ese setup; excluye el smoke test del matcher
pnpm --filter web test:a11y      la corrida
```

- **No está en `pnpm test` ni en `pnpm verify`** (§Invariantes: ninguna capa bloquea hoy). Medido
  en esta Mac: ~3 min la suite entera con axe.
- **Tres reglas apagadas en jsdom, con la razón escrita en el setup**, porque jsdom no puede
  evaluarlas con verdad: `color-contrast` (no calcula estilos), `region` (los tests montan
  componentes sin `<main>`) y `landmark-unique` (no aplica `hidden md:flex`, así que ve el
  `Sidebar` y el `BottomNav` a la vez: 333 falsos positivos). **Las tres se miden en la capa 3**,
  donde `landmark-unique` no aparece en ninguna corrida. Apagarlas acá no las saca de la vara.
- **El hook desmonta antes de fallar.** Un `afterEach` que tira corta el `cleanup` de Testing
  Library y el DOM contamina los tests siguientes del archivo. Medido: sin eso, una sola violación
  en `NumberInput` ponía rojos los 53 tests de `controls.test.tsx`; con eso, exactamente los 13 que
  lo renderizan.
- **Probada en rojo, no solo en verde:** sacarle el `aria-label` a un botón del stepper de
  `NumberInput` → 13 tests rojos con `[button-name]`, y el mensaje nombra el archivo del registro.
- `a11y/` vive **fuera de `src/`**: la vara de cobertura de `apps/web` es 100% sobre `src/**`, y
  esto es soporte de test, igual que `-test-mount.tsx`.

#### El registro de hallazgos — la vía de excepción de §Casos borde

`a11y/hallazgos.ts` lo importan las dos capas (Vitest y Playwright), así que una violación conocida
se escribe una vez. Cada fila es `{ regla, html, spec, motivo }`: la regla de axe, un patrón sobre
el HTML del nodo (lo único que axe devuelve igual en jsdom y en el navegador) y **la spec que lo
cierra, obligatoria por tipo** (`` `SPEC-${number}` ``). No es un silenciador general: el patrón
identifica al componente, no a la regla, y una regla con un nodo conocido y otro nuevo sigue
fallando por el nuevo.

**Límite medido:** axe guarda solo la etiqueta de apertura del nodo, no su contenido. Un patrón no
puede distinguir el mismo botón con o sin imagen adentro, y por eso cada fila anota qué otra cosa
cubre lo que el patrón no ve.

**Cerrar un hallazgo es borrar su fila.** Si queda, deja de proteger contra una regresión de lo
que se arregló.

### 3 · Playwright — `@axe-core/playwright`, no inyección manual del script

**Verificado en el registro, no solo elegido por preferencia:** `@axe-core/playwright@4.13.0`, del
mismo equipo que `axe-core` (Deque), misma versión que el `axe-core` de arriba, publicado con
cientos de releases — activamente mantenido, a diferencia de `vitest-axe`.

```ts
// e2e/algun-flujo.spec.ts
import AxeBuilder from '@axe-core/playwright'
import { test, expect } from '@playwright/test'

test('el dashboard del developer no tiene violaciones de accesibilidad', async ({ page }) => {
  await page.goto('/developer')
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})
```

#### Lo implementado (2026-09-28): `e2e/a11y.spec.ts`

Recorre el camino de §Alcance 5 con los usuarios del seed: `/login`; developer (panel, obras, alta
de proyecto, audit log, subir evidencia); certifier (panel, etapa y el `ObserveStageModal`
abierto); investor (comprar, mis unidades, dossier); notary (panel, revisión de dossier). Son 12
superficies, cada una en `mobile` y `desktop`.

- Tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` (M2-D3 pide WCAG 2.1 AA) **más `best-practice`**,
  que es donde axe pone landmarks y orden de encabezados, lo que un lector de pantalla usa para
  moverse.
- Afirma `violacionesNuevas(...)` vacío, contra el mismo registro de la capa 2. El resultado
  completo de axe (incluidas las registradas) queda **adjunto a cada test** en el reporte HTML.
- **Probada en rojo:** sin el `aria-label` de la campana, `/notary` falla con `[button-name]`.
- Se corre como el resto: `pnpm --filter web e2e a11y`. Hereda el job no bloqueante de CI.

### 4 · VoiceOver automatizado — **no se hace: limitación de esta máquina** (2026-09-28)

**Decisión del dueño, 2026-09-28:** se documenta como limitación y la pasada con VoiceOver queda
manual (§5). Se intentó en serio, con el VoiceOver real de la Mac del dueño (macOS 15.7.5, Intel
`x86_64`, sistema en `es-AR`), y el último paso pide un permiso que no vale lo que cuesta.

**Por qué Guidepup era la herramienta:** es la única librería mantenida que maneja el **VoiceOver
real** (no un emulador del árbol de accesibilidad) y devuelve lo que anunció como texto.
`@guidepup/guidepup@0.34.0` (2026-08-31) y `@guidepup/playwright@0.19.1` (peer `@playwright/test
^1.57`; el repo tiene 1.62).

**Lo medido, paso por paso — para no repetir el camino:**

1. **`npx @guidepup/setup`** (el dueño, una vez): habilita el control de VoiceOver por AppleScript.
   Verificado después: `defaults read com.apple.VoiceOver4/default SCREnableAppleScript` → `1`, y
   existe `/private/var/db/Accessibility/.VoiceOverAppleScriptEnabled`. ✅
2. **`npx @guidepup/setup install`** — un paso que la documentación de la librería lista aparte y
   que esta spec no anticipaba: baja a `~/Library/Caches/guidepup/` un DMG con las preferencias de
   VoiceOver que Guidepup monta al arrancar (`guidepup-voiceover-preferences-macos-15.dmg` para
   Darwin 24). Sin él, `voiceOver.start()` falla con *"Failed to mount Guidepup preferences"* sin
   decir que falta un archivo. Su SHA-256 coincidió con el del `manifest.json` del paquete
   (`ef5a533e…6580799`). ✅
3. **El bloqueo:** con el DMG montado, Guidepup crea symlinks dentro de
   `~/Library/Group Containers/group.com.apple.VoiceOver/`, y macOS 15 lo niega: `EPERM`. No es
   un sandbox de la terminal — **ni un `ls` de esa carpeta está permitido**: es la protección de
   datos de apps de macOS (TCC), que los permisos de Accesibilidad y Automatización no cubren. Lo
   único que la levanta es darle **Acceso total al disco** al proceso responsable (acá,
   `ClaudeCode.app`; si se corre desde una terminal, la terminal), probablemente reiniciándolo. ❌
   **Por qué no se dio:** Acceso total al disco deja a ese proceso leer todo lo protegido del
   usuario (Mail, Mensajes, datos de otras apps), no solo lo de VoiceOver. Para esta capa, que
   solo automatiza parte de lo que igual hace la pasada humana, no compensa.

**Una trampa que se encontró en el camino y hay que saber si esto se retoma:** el fixture oficial,
`voiceOverTest` de `@guidepup/playwright`, llama a `navigateToWebContent()`, que busca en lo que
VoiceOver *dice* las frases en inglés `"item chooser"` y `"web content"` dentro de un
`while (true)` sin salida. **Con el sistema en castellano no termina nunca**: VoiceOver queda
prendido y con la pantalla tomada. Hay que usar la API base (`voiceOver.start/press/
spokenPhraseLog/stop`, con `stop()` en un `finally`) y afirmar solo textos propios (los labels del
diccionario), nunca palabras de rol ("botón", "campo de texto"), que dependen del idioma del lector.

**Qué quedó en el repo: nada.** Las dos dependencias, la config y el fixture que se escribieron para
esto se sacaron en el mismo commit que documenta la limitación — no se deja infraestructura que no
corre. Quedan fuera del repo, en la Mac: el DMG en `~/Library/Caches/guidepup/` (caché
reconstruible, se puede borrar) y el control por AppleScript de VoiceOver habilitado (se revierte
en Utilidad VoiceOver → General).

**Para retomarla** (otra máquina, un runner de CI con macOS, o si el dueño decide dar el permiso):
los pasos 1-3 de arriba; `apps/web/playwright.voiceover.config.ts` con `workers: 1`, `headless:
false` y `testDir` propio fuera de `e2e/`; un script `a11y:voiceover` que **no** entre en
`pnpm verify` ni en CI (toma la pantalla y el audio); y la tabla de §5 como lista de lo que cada
test afirma.

### 5 · La pasada manual — sin interfaz de código, es QA

Con VoiceOver (`Cmd+F5`) sobre `pnpm dev` o la URL pública. **Ahora cubre también lo que iba a
afirmar §4**, porque §4 no se hace. Checklist, sobre el recorrido de §Alcance 5:

| Superficie | Qué escuchar |
|---|---|
| Login | cada campo se anuncia con su label ("Usuario", "Contraseña"); un login fallido anuncia el error (live region de `SPEC-104`) sin mover el foco |
| Panel de cada rol | recorriendo por landmarks (rotor, `VO+U`) aparecen header, navegación y `main`, **una sola** navegación principal |
| Alta de proyecto (formulario largo) | el orden de lo anunciado al tabular sigue el orden visual; los campos inválidos anuncian su mensaje de error (`SPEC-114` §4 los pasó a `aria-describedby`) |
| Modal (`ObserveStageModal`) | al abrirse, lo siguiente que se anuncia está dentro del diálogo; al recorrer, nunca sale de él; al cerrar, el foco vuelve al botón que lo abrió |
| Anclaje / poll (`SPEC-104`) | el cambio de `Pendiente` a `Verificado` se anuncia sin interacción |
| Dossier y audit log | el recorrido por encabezados (`VO+Cmd+H`) da una jerarquía sin saltos (`SPEC-114` §5 agregó el `h2` del audit log) |
| Header de cualquier panel | el texto blanco translúcido sobre el gradiente se lee — es lo único de contraste que axe no pudo medir (`SPEC-113`) |

Y encima de eso, lo que ningún log hubiera podido afirmar: si lo anunciado **se entiende**, si el
orden se siente natural, si algo técnicamente correcto confunde. Cada superficie se anota con su
resultado (§Invariantes).

## Invariantes

- **El matcher de Vitest importa `axe-core` directo, nunca `vitest-axe`** — la razón está en
  §Interfaz §2, verificada, no es una preferencia de estilo.
- **Biome usa la clave `a11y`**, nunca `accessibility` — la forma vieja no compila contra Biome 2.x.
- **Ninguna de las tres capas automatizadas es bloqueante hoy.** Si algún día se decide que alguna
  lo sea, es una decisión nueva con su propio costo medido, no algo que esta spec implique.
- La pasada corre sobre la **app desplegada o `pnpm dev`**, nunca sobre el código leído: el punto es
  escuchar lo que un lector de pantalla realmente anuncia, no inferirlo de la marca.
- Cada superficie recorrida en la pasada manual se registra con su resultado (bien / hallazgo) — no
  queda solo en la cabeza de quien la corrió.
- Un hallazgo nuevo, automatizado o manual, no bloquea el resto de la verificación — se anota y se
  sigue, igual que hicieron las cuatro auditorías del 2026-09-11.

## Casos borde (definen los tests y la pasada)

**Automatizados:**
- Un `<img>` sin `alt` — el matcher de Vitest falla con `image-alt` (caso de control ya verificado).
- Un control con `aria-label` correcto — pasa limpio (caso de control ya verificado).
- Un componente de terceros (`shadcn/ui`) con una violación conocida y aceptada — necesita una vía
  de excepción explícita (`axe-core` soporta `exclude`/reglas deshabilitadas por selector); sin esto
  el primer falso positivo de una librería externa bloquea toda la capa. **Resuelto con
  `a11y/hallazgos.ts`** (§2 §El registro), que sirve igual para terceros y para código propio. En
  la medición del 2026-09-28 **ninguna violación vino de `shadcn/ui` ni de Radix**: las trece filas
  del registro son código propio.

**Manuales (heredados de `SPEC-104`, sin re-diseñar):**
- Los tres caminos que ya cubría `SPEC-104` (login fallido, anclaje, poll) — confirmar que siguen
  anunciando correctamente.
- Un modal (`AnchoringSuccessModal`, cualquiera de los 11 de `SPEC-102`) — el foco tiene que quedar
  atrapado adentro y volver al disparador al cerrar.
- Un formulario largo (alta de proyecto, invitación) — el orden de tabulación sigue el orden visual,
  no el orden del DOM si difieren.
- La navegación responsive (`SPEC-106`/D-074, sidebar → bottom nav en mobile) — confirmar que
  también es navegable sin mouse en ese layout.

## Preguntas abiertas

- ~~**¿Qué componentes/páginas entran primero?**~~ **Respondida 2026-09-28: todos a la vez.** El
  barrido de §2 corre axe sobre todo lo que la suite ya renderiza, así que no hubo que elegir.
- **¿Quién corre la pasada manual y cuándo?** Es trabajo humano sin fecha asignada. No bloquea nada
  del SOM (nivel 🟢, independiente), así que puede tomarse cuando haya disponibilidad.
- ~~**¿Se suma un `pnpm a11y` que corra las dos capas automatizadas juntas?**~~ **Respondida
  2026-09-28: no.** Las dos piden cosas distintas (la de Playwright necesita la base sembrada y los
  servidores arriba) y juntarlas escondería por qué falla cada una. Quedan `test:a11y` y
  `e2e a11y`.
