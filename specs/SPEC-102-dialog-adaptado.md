# SPEC-102 — `ui/dialog.tsx`: adaptar de verdad el primitivo de los 11 modales

> **Origen:** [`AUDITORIA-2026-09-11-calidad-del-frente.md`](AUDITORIA-2026-09-11-calidad-del-frente.md) §F-02.
> Nivel 🟢. **Independiente**, aunque conviene después de
> [`SPEC-101`](SPEC-101-escala-de-iconos-y-su-guardia.md): su guardia marca 4 de las clases que esta
> spec borra. No toca ningún criterio del SOM.

## El problema, en una frase

Es shadcn pegado sin adaptar, y es el primitivo de **los 11 modales de la app**: usa la escala default
de Tailwind en vez de la de M2-D3, su token de fondo no existe, y por eso **10 de los 12
`<DialogContent>` pasan `bg-card` a mano** — el síntoma clásico de primitivo roto, cada consumidor
parchea en vez de arreglarse el primitivo.

## Alcance

- **Cubre:** `apps/web/src/components/ui/dialog.tsx` y la eliminación del parche `bg-card` en sus
  call sites.
- **NO cubre:** la anatomía de los modales, que M2-D3 ya fija y no cambia. Ningún modal se agrega,
  se saca ni se rediseña.

## Qué se cambia

| Hoy | Qué pasa | Va a |
|---|---|---|
| `bg-background` (línea 61) | **no existe** ⇒ el modal no tiene fondo propio; `LocationMapModal.tsx:241` es el que no parchea y queda transparente sobre el backdrop | `bg-card` **adentro del primitivo** |
| `rounded-lg` | radio de card estándar (12px) | `rounded-xl` — M2-D3 declara `r-xl` (16px) *"stat tiles, modal sheets…"* |
| `shadow-lg` | sombra default de Tailwind | `shadow-modal` — el token existe **específicamente para esto** y no se usa |
| `gap-4 p-6 top-4 right-4 size-4 text-lg text-sm` | escala default de Tailwind | la escala de M2-D3 (`gap-s4`, `p-s5`/`p-s6`, `top-s4`, `right-s4`, `size-icon-inline`, `text-h3`, `text-body-sm`) |
| `border` sin color | en Tailwind v4 el default pasó a `currentColor`: **el borde del modal es del color del texto** | el token de borde de M2-D3, o sin borde si el diseño no lo pide |
| `ring-offset-background`, `focus:ring-ring`, `text-muted-foreground` | tokens de shadcn que no existen: no emiten nada | tokens propios (`text-text-muted`) o se borran |
| `<span className="sr-only">Close</span>` | string hardcodeado (regla 14) | `t('common.close')` — **la clave ya existe** |
| `<SecondaryButton>Close</SecondaryButton>` | ídem | `t('common.close')` |

Y en los call sites: se borra `className="bg-card"` de los 10 `<DialogContent>` que lo pasan.

## Invariantes

1. **El fondo del modal se decide una sola vez, en el primitivo.** Ningún call site vuelve a pasar
   un `bg-*`.
2. **Ningún valor literal de escala** en `dialog.tsx`: ni radio, ni sombra, ni padding, ni tipografía
   (`apps/web/CLAUDE.md`: *"ningún componente escribe un color, tamaño, radio o sombra literal"*).
3. **Cero strings en el archivo** (regla 14 / D-025).
4. El comportamiento de Radix no se toca: foco atrapado, `Escape`, click en el backdrop y
   `aria-describedby` quedan como están.

## Casos borde (definen la verificación)

| Caso | Esperado |
|---|---|
| `LocationMapModal` (el que no parchea) | fondo sólido, sin transparencia sobre el backdrop |
| Los otros 10, ya sin su `bg-card` | idénticos a hoy en pantalla |
| Modal más alto que el viewport a 390px | scrollea adentro, sin overflow horizontal |
| Idioma en EN | el botón y el `sr-only` dicen "Close" por diccionario, no por literal |

## Verificación

Los 11 modales abiertos a 390px y a 1534px, en los dos idiomas. `AnchoringSuccessModal` es el único
que se abre solo (M2-D4 §6.3) y el que más se ve: va primero.
