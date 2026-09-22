# SPEC-112 — Accesibilidad: las tres capas automatizadas + la pasada manual con VoiceOver

> **Origen:** se separa de [`SPEC-104`](SPEC-104-live-regions.md) el 2026-09-22 — esa spec cerró con
> su código y tests automatizados hechos, pero la verificación manual que le quedaba pendiente no
> era solo suya: `SPEC-104` construyó las live regions, no auditó accesibilidad en general. Ampliada
> el mismo día para cubrir también el tooling automatizado que hoy no existe en el repo.
> Nivel 🟢. **Independiente.** No toca ningún criterio del SOM.

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
| VoiceOver manual | Si lo que se anuncia **tiene sentido** — orden narrativo, foco que "se siente" perdido, algo técnicamente válido pero confuso | Nada automatizable — es la única capa que valida experiencia, no marca |

## Alcance / NO-alcance

- **Cubre:**
  1. **Biome** — habilitar el dominio `a11y` en `biome.json`.
  2. **Vitest** — un matcher `toHaveNoViolations` sobre `axe-core` **crudo**, sin wrapper de terceros
     (ver §Interfaz — por qué, verificado en vivo, no supuesto).
  3. **Playwright** — `@axe-core/playwright` sobre los specs de `apps/web/e2e/` existentes y los que
     hagan falta. Hereda el carácter **no bloqueante** de CI que ya tiene toda la suite `e2e`
     (`playwright.config.ts`, comentario de D-015 §5) — esta spec no cambia eso.
  4. La **pasada manual con VoiceOver** (macOS) sobre las superficies más usadas de cada rol — no
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

### 4 · La pasada manual — sin interfaz de código, es QA

Con VoiceOver (`Cmd+F5`) sobre `pnpm dev` o la URL pública, recorriendo el checklist de §Alcance.

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
  el primer falso positivo de una librería externa bloquea toda la capa.

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

- **¿Qué componentes/páginas entran primero?** No las 131 componentes ni las 42 rutas de una — se
  propone empezar por lo que `SPEC-101`-`110` ya identificó como tocado (los 36 componentes de
  M2-D3) y las rutas con formularios largos, que es donde más rinde `axe-core` en componente aislado.
- **¿Quién corre la pasada manual y cuándo?** Es trabajo humano sin fecha asignada. No bloquea nada
  del SOM (nivel 🟢, independiente), así que puede tomarse cuando haya disponibilidad.
- **¿Se suma un `pnpm a11y` o similar que corra las dos capas automatizadas juntas?** Azúcar de
  conveniencia, no bloqueante — se decide al implementar, no acá.
