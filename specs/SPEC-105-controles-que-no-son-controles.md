# SPEC-105 — Tres cosas que son controles y no se comportan como tales

> **Origen:** [`AUDITORIA-2026-09-11-calidad-del-frente.md`](AUDITORIA-2026-09-11-calidad-del-frente.md)
> §F-08, §F-09, §F-12. Nivel 🟢. **Independiente.** No toca ningún criterio del SOM.
>
> Van juntos porque el defecto es el mismo visto de tres lados: **un elemento que el usuario puede
> enfocar y activar, que no cumple el contrato de ser activable** — o está anidado dentro de otro, o
> no se puede tocar, o no hace nada. **Ninguno pide cambiar el diseño.**

## F-08 · Interactivo anidado

`components/PendingDossiersQueue.tsx:37` y `components/AssignedStagesQueue.tsx:47` envuelven un
`SecondaryButton` dentro de un `<Link>`. Confirmado en el DOM renderizado de `/notary/dossiers`:

```
A > BUTTON "Revisar"
```

HTML inválido (`<a>` no admite contenido interactivo) y violación `nested-interactive` de axe. Afecta
**4 superficies**, porque las dos colas se montan en el panel y en su solapa.

**El arreglo:** el `Link` toma la apariencia del botón (es lo que ya hace el resto de la app con
`activeProps`/`className`), o el botón navega con `useNavigate`. Un solo elemento interactivo.

## F-09 · Áreas táctiles por debajo del mínimo

La app es mobile-first por M2-D3 §Principio 4 y los blancos no lo son. Medido en el navegador:

| Control | Medido | Dónde | Mínimo |
|---|---|---|---|
| Nodos del `ProgressTimeline` | **16×16**, ×10, adyacentes | `ProgressTimeline.tsx:60` (`size-4`) | **falla AA** (WCAG 2.5.8 · 24×24) |
| Botón "copiar" del `HashChip` | **14×14** | todas las superficies de prueba | **falla AA** |
| Flecha "Volver" del header | 21px de alto | todas las pantallas con padre | pasa AA, lejos de 44 |
| Chips de filtro | 32px | audit-log, notificaciones, upload | ídem |
| `ToggleSwitch` | 44×24 | los 4 perfiles | ídem |

Los dos primeros son los que hay que arreglar, y el primero es **la vía principal del investor al
detalle de etapa**.

**El arreglo:** el área táctil crece sin que crezca el píxel dibujado — `p-s3 -m-s3` o un
pseudo-elemento. El nodo sigue midiendo 16px visuales. Los tres restantes se anotan y no se tocan:
subirlos a 44 sí movería el diseño.

## F-12 · Controles vivos que no hacen nada

`routes/investor.unit.$unitId.index.tsx:173` y `:192`: las dos tiles superiores son `<button>` con
`aria-label` ("Abrir galería", "Abrir mapa") y el handler cortocircuitado —
`onClick={() => imagenes.length && setGaleria(true)}`. Sin fotos y sin coordenadas quedan
**enfocables, anunciadas y muertas**: el usuario no tiene forma de distinguir "no hay nada que abrir"
de "no anduvo".

**El arreglo:** `disabled` cuando no hay dato. El estado deshabilitado ya está definido en M2-D3 y el
token `text-disabled` ya se usa.

## Invariantes

1. **Ningún elemento interactivo dentro de otro elemento interactivo**, en ninguna de las 42 rutas.
2. **Todo control con handler mide al menos 24×24 de área táctil**, aunque dibuje menos.
3. **Un control sin acción posible está `disabled`**, no silenciosamente inerte.
4. **El diseño no cambia**: ningún ícono, nodo ni tile cambia de tamaño visual.

## Casos borde

| Caso | Esperado |
|---|---|
| Timeline de 10 etapas a 390px | las 10 áreas táctiles llegan a 24 sin superponerse ni desbordar la card |
| `HashChip` dentro de un pill apretado | el área crece hacia afuera, el pill no cambia de alto |
| Unidad con fotos pero sin coordenadas | galería activa, mapa `disabled` |
| Fila de cola navegada con teclado | un solo `Tab` por fila, no dos |
