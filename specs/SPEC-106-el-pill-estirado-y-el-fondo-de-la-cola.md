# SPEC-106 — El pill estirado y el fondo de la cola del escribano

> **Origen:** [`AUDITORIA-2026-09-11-calidad-del-frente.md`](AUDITORIA-2026-09-11-calidad-del-frente.md)
> §F-10, §F-11. Nivel 🟢. **Independiente.** No toca ningún criterio del SOM.
>
> Dos inconsistencias visuales **medidas en el navegador**, las dos en la capa de cards, las dos de
> una línea. Van juntas porque separarlas daría dos specs de diez renglones que se leen igual.

## F-10 · `StatusPill` a ancho completo en 5 superficies

`inline-flex shrink-0` **no alcanza** cuando el pill es hijo directo de un contenedor
`flex flex-col`: los flex items se blockifican y `align-items: stretch` los lleva al ancho del eje
cruzado. **`shrink-0` gobierna el eje principal, no el cruzado.**

Medido en `/investor/buy`: a 1534px, **608px de pill para 56px de texto**, dentro de una card de 640.
A 390px, 326px para 56px.

| Superficie | Archivo |
|---|---|
| `/investor/buy` | `components/domain/ProjectCard.tsx` |
| `/investor/profile`, `/notary/profile`, `/certifier/profile` | `components/ProfileScreen.tsx` |
| `/investor/unit/:id/dossier` | su ruta |

**El arreglo:** `self-start` donde el pill es hijo de una columna. La variante `developer` de
`ProjectCard` **no lo sufre** —ahí el pill vive dentro de una fila `flex items-start
justify-between`— y no se toca.

> El comentario de `StatusPill` razona largo y bien sobre la geometría del pill (`whitespace-nowrap`
> y `shrink-0` contra el crecimiento del español) **y erra el eje**. Vale como recordatorio de que un
> comentario detallado no es evidencia de que el caso esté cubierto: el comentario se corrige en el
> mismo commit.

## F-11 · Fondo inconsistente en la cola del escribano

`components/PendingDossiersQueue.tsx:31` usa `bg-surface-alt`; medido: `rgb(243, 244, 246)`. **Todas
las demás listas de la app usan `bg-card`** (`#ffffff`). Contra el `--color-app-bg` off-white, la card
del escribano se ve gris y las otras blancas.

**El arreglo:** `bg-card`. Si aparece una captura de M2-D2 que pida el gris, gana la captura (regla 1
del loop) y esta parte de la spec se cierra sin cambio, anotando cuál.

## Invariantes

1. **Un `StatusPill` mide lo que mide su texto**, sea cual sea el contenedor que lo hospeda.
2. **Todas las listas de la app comparten fondo.** Una lista con fondo propio es una decisión escrita,
   no un token distinto.

## Casos borde

| Caso | Esperado |
|---|---|
| Pill con el texto más largo del diccionario en `es-AR`, a 390px | no desborda ni parte la palabra; el texto manda el ancho |
| Pill dentro de la variante `developer` de `ProjectCard` | idéntico a hoy |
| Cola del escribano vacía | el empty-state usa el mismo fondo que el resto |

## Verificación

La sonda de la auditoría, repetida: ancho del pill contra el ancho real de su texto vía `Range`, a
390px y a 1534px, en las 5 superficies.
