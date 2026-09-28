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
| 4 · VoiceOver automatizado (Guidepup) | ⬜ espera el **Paso 0**, que es del dueño: habilitar el control por AppleScript y dar dos permisos de TCC en esta Mac |
| 5 · Pasada manual con VoiceOver | ⬜ después de la 4 |

**Lo que encontraron las capas 2 y 3 salió a dos specs nuevas**, como pide §Alcance:
[`SPEC-113`](SPEC-113-el-contraste-de-los-tokens-de-m2-d3.md) (contraste de los tokens normativos
de M2-D3, **pide una decisión del dueño**) y
[`SPEC-114`](SPEC-114-nombres-encabezados-y-landmarks.md) (seis defectos de nombres, encabezados y
landmarks, implementable directo). Mientras estén abiertas, sus violaciones viven en
`apps/web/a11y/hallazgos.ts` y no ponen en rojo ninguna capa. Cualquier violación **nueva** sí.

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
| VoiceOver automatizado (Guidepup, esta Mac) | Lo que VoiceOver **realmente anuncia**, registrado como texto: nombre y rol de cada control al recorrerlo, los anuncios de las live regions, el orden de lectura, que el foco quede dentro de un modal. Corre antes que la pasada humana y le deja el terreno limpio | Si ese texto **tiene sentido** para una persona — el log dice qué se dijo, no si se entiende |
| VoiceOver manual | Si lo que se anuncia **tiene sentido** — orden narrativo, foco que "se siente" perdido, algo técnicamente válido pero confuso | Nada automatizable — es la única capa que valida experiencia, no marca |

## Alcance / NO-alcance

- **Cubre:**
  1. **Biome** — habilitar el dominio `a11y` en `biome.json`.
  2. **Vitest** — un matcher `toHaveNoViolations` sobre `axe-core` **crudo**, sin wrapper de terceros
     (ver §Interfaz — por qué, verificado en vivo, no supuesto).
  3. **Playwright** — `@axe-core/playwright` sobre los specs de `apps/web/e2e/` existentes y los que
     hagan falta. Hereda el carácter **no bloqueante** de CI que ya tiene toda la suite `e2e`
     (`playwright.config.ts`, comentario de D-015 §5) — esta spec no cambia eso.
  4. **VoiceOver automatizado**, en la Mac del dueño (macOS 15, Intel x86_64): el VoiceOver real
     manejado por código con Guidepup, sobre el mismo recorrido del punto 5, **antes** de la pasada
     humana (pedido del dueño, 2026-09-28). Todo lo que se pueda afirmar leyendo el log de lo
     anunciado se afirma acá, así la pasada humana solo juzga lo que ningún log puede juzgar. Ver
     §Interfaz §4.
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

### 4 · VoiceOver automatizado — Guidepup, en esta Mac, antes de la pasada humana

**Por qué Guidepup, verificado en el registro el 2026-09-28:** es la única librería mantenida que
maneja el **VoiceOver real** de macOS (no un emulador del árbol de accesibilidad) y devuelve lo que
anunció como texto. `@guidepup/guidepup@0.34.0` (publicada 2026-08-31) y `@guidepup/playwright@0.19.1`
(peer `@playwright/test ^1.57`; el repo tiene 1.62). Con eso el recorrido corre como un spec de
Playwright más, con un fixture `voiceOver` que tiene `next()`, `perform()`, `lastSpokenPhrase()` y
`spokenPhraseLog()`.

**Paso 0 — preparar la máquina (una vez, lo hace el dueño, no se automatiza).** Medido en esta
Mac el 2026-09-28: macOS 15.7.5, `x86_64`, y el control por AppleScript de VoiceOver **no está
habilitado** (`defaults read com.apple.VoiceOver4/default SCREnableAppleScript` → no existe).
`npx @guidepup/setup` lo habilita; macOS pide además permiso de **Accesibilidad** y
**Automatización** para la terminal que corre los tests (Ajustes del Sistema → Privacidad y
seguridad). Son permisos de TCC: los da una persona con un click, no un script. Lo que `setup`
toque en esta versión de macOS se anota acá cuando se corra, no se supone.

**Forma:**

```
apps/web/e2e-voiceover/                       carpeta propia, fuera de e2e/ (no la levanta la suite normal)
apps/web/playwright.voiceover.config.ts       workers 1, headed, un solo proyecto desktop
apps/web/package.json  →  "a11y:voiceover"    playwright test -c playwright.voiceover.config.ts
```

**No corre en CI ni en `pnpm verify`**, mismo criterio que `test:s3` y `test:yaci`: necesita una
sesión gráfica de macOS con VoiceOver encendido, y **toma el control de la pantalla y el audio**
mientras corre (no se usa la máquina en paralelo). Se corre a mano, con `pnpm dev` levantado y la
base sembrada, y **se apaga VoiceOver al terminar** (`voiceOver.stop()` en el teardown, aunque el
test falle).

**Qué afirma cada test** — solo cosas que el log puede probar, sobre el recorrido de §Alcance 5:

| Superficie | Qué se afirma sobre lo anunciado |
|---|---|
| Login | cada campo se anuncia con su label ("Usuario", "Contraseña"); un login fallido anuncia el error (live region de `SPEC-104`) sin mover el foco |
| Panel de cada rol | recorriendo por landmarks (rotor, `VO+U`) aparecen header, navegación y `main`, **una sola** navegación principal |
| Alta de proyecto (formulario largo) | el orden de lo anunciado al tabular sigue el orden visual; los campos inválidos anuncian su mensaje de error |
| Modal (`ObserveStageModal`) | al abrirse, lo siguiente que se anuncia está dentro del diálogo; al recorrer, nunca sale de él; al cerrar, el foco vuelve al botón que lo abrió |
| Anclaje / poll (`SPEC-104`) | el cambio de `Pendiente` a `Verificado` se anuncia sin interacción |
| Dossier y audit log | el recorrido por encabezados (`VO+Cmd+H`) da una jerarquía sin saltos |

**El log completo de cada test se guarda como artefacto** (`e2e-voiceover/.artifacts/<test>.txt`,
gitignoreado) — es lo que lee quien hace la pasada humana antes de empezar, para saber qué ya se
probó y escuchar solo lo que falta.

**Lo que esta capa no puede afirmar** y por eso queda para §5: si una frase anunciada se entiende,
si el orden "se siente" natural, si algo técnicamente correcto confunde. Un test que intente
afirmar eso con un `toContain` es un falso verde.

### 5 · La pasada manual — sin interfaz de código, es QA

Con VoiceOver (`Cmd+F5`) sobre `pnpm dev` o la URL pública, recorriendo el checklist de §Alcance.
**Arranca leyendo los logs de §4**: todo lo que §4 ya afirmó no se repite, se escucha solo lo que
el log no puede juzgar.

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
