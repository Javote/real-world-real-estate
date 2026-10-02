# SPEC-103 — El armazón no anuncia dónde estás: `lang`, `title`, `aria-current`, el contador

> **Origen:** [`AUDITORIA-2026-09-11-calidad-del-frente.md`](AUDITORIA-2026-09-11-calidad-del-frente.md)
> §F-04, §F-05, §F-06, §F-07. Nivel 🟢. **Independiente.** No toca ningún criterio del SOM.
>
> Van juntos porque son **el mismo cambio cuatro veces**: un dato que la app ya tiene en memoria y
> no publica en el DOM. Los cuatro viven en el armazón compartido, así que arreglan las 42 rutas de
> una. Partirlos en cuatro specs sería contar cuatro veces la misma frase.

## Los cuatro, con su evidencia

| | Qué | Evidencia medida | Dónde |
|---|---|---|---|
| **F-04** | `<html lang>` no cambia con el idioma | toggle a EN en vivo: el `h1` pasó a "Developer panel", `localStorage` a `en-US`, `document.documentElement.lang` siguió en `"es"` | `index.html:2` + `LocaleProvider` |
| **F-05** | `document.title` es "PropNexus" en las 42 rutas | `document.title === 'PropNexus'` en todas | `index.html:7` + cada ruta |
| **F-06** | Sin `aria-current="page"` en la navegación | `[...document.querySelectorAll('nav a')].map(a => a.getAttribute('aria-current'))` → todos `null` | `BottomNav.tsx:55`, `Sidebar.tsx:40` |
| **F-07** | La campana dibuja "9+" y no lo anuncia | su `aria-label` dice solo "Notificaciones"; el dato ya está en el prop `unread` | `NotificationBell.tsx` |

**La casa ya sabe hacer tres de los cuatro.** `aria-current` se usa bien en `ProgressTimeline`,
`StageChips` y `BuildingSchematic`; lo que falta es que llegue a la navegación, donde el tab activo
hoy se distingue **solo por color y peso**. Y `activeProps` ya existe en los dos componentes: es
agregarle el atributo.

## Qué se cambia

1. **`lang`** — un `useEffect` en `LocaleProvider` que escribe `document.documentElement.lang` con
   el locale vigente. Se monta una vez y cubre todo.
2. **`title`** — cada ruta publica su título por la clave de diccionario que su `h1` ya usa, con el
   sufijo de marca. La forma la decide el implementador entre las dos que TanStack Router ofrece
   (`head` por ruta, o un efecto en el layout que lea el match activo); **el requisito es que el
   texto salga del diccionario**, no que se elija una API.
3. **`aria-current="page"`** — dentro del `activeProps` de `BottomNav` y `Sidebar`.
4. **La campana** — el `aria-label` pasa a interpolar `unread` con una clave nueva
   (`notifications.bellWithCount`), y queda la clave sin contador para `unread === 0`.

## Invariantes

1. **`document.documentElement.lang` es igual al locale vigente, siempre** — no solo al arrancar.
2. **Ninguna de las 42 rutas deja el título en la marca sola.** Es lo primero que un lector anuncia
   al navegar en una SPA, y lo que vuelve útil el historial del navegador.
3. **Exactamente un `aria-current="page"` por navegación**, y coincide con el tab resaltado.
4. **Cero strings hardcodeados** (regla 14): el título y el label de la campana salen del
   diccionario, en los dos idiomas.

## Casos borde

| Caso | Esperado |
|---|---|
| Toggle de idioma sin recargar | `lang` cambia en el mismo tick que el copy |
| Ruta con parámetro (`/project/$id/stage/$id`) | título con la clave de la pantalla; **nunca** con el nombre del proyecto si eso filtrara algo que la ruta no muestra |
| `unread === 0` | el label no dice "0 notificaciones": usa la clave sin contador |
| `unread > 9` | el pill dibuja "9+" y el label dice el número real |
| Ruta 404 / sin match | título genérico, no la marca pelada |

## Verificación

En el navegador: el árbol de accesibilidad de un tab activo (`read_page`) tiene que traer *current*,
y el toggle de idioma tiene que mover `lang` y `title` en vivo.
