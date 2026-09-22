# SPEC-104 — Anunciar lo que cambia: las live regions que la app no tiene

> **Origen:** [`AUDITORIA-2026-09-11-calidad-del-frente.md`](AUDITORIA-2026-09-11-calidad-del-frente.md) §F-03.
> Nivel 🟢. **Independiente.** No toca ningún criterio del SOM.
>
> **Cerrada 2026-09-22, por lo que sí es código: las dos regiones, `useAnnounce()` y su cableado en
> las tres clases de evento (§Diseño/§Invariantes) están implementados y con tests automatizados
> (cerrado 2026-09-19).** Lo único que quedaba —la pasada manual con VoiceOver de §Verificación— se
> separó a [`SPEC-112`](SPEC-112-pasada-de-accesibilidad-con-voiceover.md): no es una condición para
> que esta spec esté "hecha", es una verificación manual más amplia que esta spec sola no agotaba
> (confirma lo que ya se construyó, y de paso cubre accesibilidad que esta spec nunca prometió —
> foco, labels, jerarquía de headings). Separarla evita que una tarea de QA sin fecha mantenga
> "abierto" un código que ya está completo y probado.

## El problema, en una frase

```
grep -rn 'aria-live|role="alert"' apps/web/src  →  0 resultados en 131 archivos
```

En una app cuyo núcleo es *"esperá a que confirme la cadena"*, **ningún error, ninguna confirmación
de anclaje y ningún cambio de estado asíncrono se anuncia**: `login.tsx` muestra "Credenciales
inválidas" y un lector de pantalla no se entera.

## Alcance

- **Cubre:** una región viva compartida y su cableado en las tres clases de evento que hoy son
  mudas: **error de formulario**, **resultado de una mutación** (anclaje enviado / confirmado /
  fallido) y **transición de estado que llega por poll** (`GET /units/:id/news`, que ya pollea cada
  10s mientras quede algo `Pending`).
- **NO cubre:** rediseñar el feedback visual. Lo que se ve hoy se sigue viendo igual; lo único que
  se agrega es que además se diga.
- **NO cubre:** un sistema de toasts. No hay componente de toast en M2-D3 y esta spec no inventa uno.

## Diseño

Un solo punto de anuncio, montado en el layout autenticado y en el público:

```tsx
// dos regiones vacías y permanentes: el nodo tiene que existir ANTES del
// mensaje, o varios lectores no lo leen.
<div aria-live="polite"    aria-atomic="true" className="sr-only">{cortés}</div>
<div aria-live="assertive" aria-atomic="true" className="sr-only">{urgente}</div>
```

y un hook `useAnnounce()` que escribe en una de las dos. **Dos regiones, no una**, y el criterio de
reparto es el único que importa: `assertive` interrumpe al usuario, así que se reserva para lo que
invalida lo que está haciendo (un error de submit); todo lo demás —"anclaje enviado", "confirmado en
la cadena", "3 etapas actualizadas"— es `polite`.

## Invariantes

1. **Las regiones se montan vacías y no se desmontan.** Inyectar el nodo junto con el texto es el
   modo de falla clásico: el lector no anuncia lo que ya estaba ahí cuando llegó.
2. **Todo texto anunciado sale del diccionario** (regla 14), y es el mismo que se ve en pantalla —
   no una segunda redacción para lectores.
3. **Nada que la pantalla no muestre se anuncia.** La región es un eco, no un canal paralelo; y
   regla 17: si no hay TXID, lo que se anuncia es "pendiente".
4. **`assertive` solo para errores que bloquean la acción en curso.** Como máximo uno por interacción.

## Casos borde

| Caso | Esperado |
|---|---|
| Login con credenciales inválidas | se anuncia el mismo texto del error visible, en `assertive` |
| Dos errores de campo en el mismo submit | un solo anuncio con el resumen, no dos regiones peleando |
| `AnchoringSuccessModal` se abre | se anuncia "enviado" con el TXID truncado como lo muestra `HashChip`, no el hash entero letra por letra |
| El poll pasa un evento de `Pending` a `Confirmed` con la pestaña en background | se anuncia cuando vuelve el foco; no se acumulan 9 anuncios |
| El mismo mensaje dos veces seguidas | se vuelve a anunciar (hay que forzar el cambio de nodo), porque "falló otra vez" es información |

## Verificación

Con VoiceOver sobre `pnpm dev` en los tres caminos: login fallido, subida de evidencia con anclaje, y
una transición que llegue por poll. Un `grep` no alcanza para esto: el atributo presente no prueba
que se haya anunciado. **Estos tres caminos son el primer paso de la pasada de
[`SPEC-112`](SPEC-112-pasada-de-accesibilidad-con-voiceover.md)**, que los hereda y los amplía al
resto de la app.
