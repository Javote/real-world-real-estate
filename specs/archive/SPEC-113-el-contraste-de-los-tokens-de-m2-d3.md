# SPEC-113 — El contraste de los tokens de M2-D3 no llega a la vara que M2-D3 mismo fija

> **Origen:** [`SPEC-112`](../SPEC-112-pasada-de-accesibilidad-con-voiceover.md) §3, la capa de
> Playwright + `axe-core`, medida en el navegador real el 2026-09-28 (mobile y desktop, 12
> superficies). Nivel 🟡 — **pide una decisión del dueño antes que código**: toca tokens normativos.
> No toca ningún criterio del SOM.

## Cerrada — 2026-09-28

**El dueño eligió que gane §Accessibility** (*"si los colores normativos de los pills no llegan,
está bien cambiarlos por un tema de accesibilidad"*) y quedó escrito como **D-098**. Se implementó
una variante de la opción 1: en vez de agregar tokens de texto aparte, se oscureció el **color
fuerte** de cada token de estado, que es el que se usa como texto, ícono y fondo de botón. Los
rellenos `-light` son los de M2-D3. Así también se corrigen usos que axe no llegó a ver, como el
texto blanco sobre un botón `bg-pending` (antes 2.80:1).

- **Seis tokens, no tres:** `verified`, `pending` e `info` (los pills), `text-muted`, y además
  `people` (3.00:1) y `danger` (3.34:1), que ninguna pantalla recorrida mostró pero fallaban igual
  por cálculo. Los valores y los contrastes, en D-098.
- **El blanco al 80% sobre `primary`** (`ActionCard` destacada y `StatCard` resaltada, 3.88:1) pasa
  a blanco pleno (5.15:1). Los `text-white/80` sobre el gradiente del header **no se tocaron**: axe
  no puede medir texto sobre gradiente (lo deja como "incompleto") y no se cambia lo que no se midió.
  Quedan para la pasada de VoiceOver/humana de `SPEC-112`.
- **`/login` sin colores literales** en el fondo, el texto de ayuda y el error (ahora `bg-app-bg`,
  `text-text-muted`, `text-danger`). Las solapas de rol siguen con hex inline que coinciden con
  tokens y pasan contraste: es deuda de forma, no de accesibilidad.
- **Cómo se sostiene:** `styles.test.ts` exige los seis valores nuevos, exige que el valor viejo ya
  no esté, y **recalcula el contraste** de cada uno contra sus fondos reales.
- **Verificado:** `e2e/a11y.spec.ts` 10/10 y `test:a11y` en verde **con el registro de hallazgos
  vacío**: cero violaciones de WCAG 2.1 AA + best-practice en las 12 superficies, contraste
  incluido.

## El hallazgo

M2-D3 §Accessibility se contradice con su propia tabla de colores:

> *"The platform targets WCAG 2.1 AA conformance. Live audit against contrast ratios […] occurs in
> Milestone 3 once the implementation is complete."*
> *"Body text and labels meet WCAG 2.1 AA contrast (4.5:1 against background)."*

y en §Status pills fija, como normativos, pares que no dan 4.5:1. Esta es exactamente la *live
audit* que el entregable promete para M3, y encontró esto:

| Par (texto sobre fondo) | Dónde se ve | Ratio | Medido por |
|---|---|---|---|
| `#14B8A6` sobre `#D4F4EE` — pill verified | pill Verificado/Vendida, encabezado "Certificación criptográfica" del dossier | **2.13:1** | axe (navegador) y cálculo |
| `#F97316` sobre `#FFE8D6` — pill pending | pill Pendiente/En obra en listados, dossier y cola del notario | **2.37:1** | axe y cálculo |
| `#F97316` sobre `#FFFFFF` | botón secundario naranja (Observar) en `/certifier` | **2.80:1** | axe |
| `#3B82F6` sobre `#DBEAFE` — pill info | pill Pre-construcción | **3.01:1** | cálculo (ninguna pantalla recorrida lo mostró) |
| `#6B7280` sobre `#F4F1ED` — `text-muted` sobre el fondo | `h2` de sección del panel, "Hash del dossier" (sobre `#D4F4EE`: 4.13:1) | **4.29:1** | axe y cálculo |
| blanco al 80% sobre `#6D4AFF` | subtítulo de la `ActionCard` destacada ("Crear un desarrollo") | **3.88:1** | axe |
| `rgb(107,114,128)` **inline** en `/login` | "Seleccioná tu rol para continuar" | **4.29:1** | axe — y además es un color literal fuera de los tokens (regla de `apps/web/CLAUDE.md`) |

El pill neutral (`#374151` sobre `#F3F4F6`, 9.37:1) y `text-muted` sobre blanco (4.83:1) pasan.

**El texto de los pills es de 16px normal, no "large text"**: la vara relajada de 3:1 no aplica.
Aunque aplicara, verified y pending tampoco la pasan.

## Por qué no se arregla directo

Regla 5 del loop: *"Los tokens no se eligen, se transcriben. El hex de M2-D3 es normativo."* Y
`apps/web/src/styles.test.ts` verifica los 20 colores contra el entregable, uno por uno. **Cambiar
un hex rompe ese test a propósito.** `docs/` es inmutable (D-022).

Pero esto es un desvío legítimo según §Jerarquía de precedencia, caso **(a): el entregable se
contradice internamente**. §Accessibility y §Status pills no pueden cumplirse a la vez. Hay que
elegir cuál gana y escribirlo en `DECISIONS.md`.

## Las opciones, para que decida el dueño

1. **Gana §Accessibility: oscurecer solo el color del texto de cada pill** y dejar el relleno
   intacto. El pill se sigue viendo como en la captura, porque el relleno es lo que más pesa
   visualmente. Hace falta un token de texto nuevo por tono (p. ej. `--color-pending-text`), que
   sale de oscurecer el hex de M2-D3 hasta 4.5:1 sobre su relleno. `styles.test.ts` sigue
   verificando los 20 originales; el test de los tokens nuevos es su ratio, calculado.
   **Recomendada:** cumple el WCAG 2.1 AA que el entregable declara como objetivo y no toca ningún
   hex normativo, solo agrega.
2. **Gana §Status pills: se documenta el incumplimiento.** Una decisión dice que los pills quedan
   por debajo de AA a sabiendas, con el argumento de §Accessibility de que *"status colour is never
   the sole carrier of meaning"*. Es un argumento sobre daltonismo, no sobre contraste: el texto
   del pill sigue siendo difícil de leer.
3. **Mixta:** la opción 1 para los pills; `text-muted` (4.29) y el blanco al 80% (3.88) se corrigen
   aparte, porque no son colores de estado.

**Lo que no está en discusión:** el color inline de `/login` se reemplaza por un token, gane la
opción que gane. Es un literal que la regla de uso de `apps/web/CLAUDE.md` ya prohíbe.

## Cómo se cierra

- La decisión en `DECISIONS.md`, con número.
- Las filas `SPEC-113` de `apps/web/a11y/hallazgos.ts` **se borran**. Si la decisión es la opción 2,
  quedan, pero con el número de la decisión en el `motivo`.
- `pnpm --filter web e2e a11y` en verde sin esas filas.
