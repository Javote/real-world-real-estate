# SPEC-110 — 30 de 42 rutas muestran el empty-state mientras cargan

> **Origen:** [`AUDITORIA-2026-09-11-calidad-del-frente.md`](AUDITORIA-2026-09-11-calidad-del-frente.md) §F-18.
> Nivel 🟢. **Independiente.** No toca ningún criterio del SOM.

## El problema, en una frase

30 de las 42 rutas renderizan `data ?? []` o `data?.campo`: **durante todo el fetch muestran el
empty-state completo** —"No hay proyectos"— y después parpadean a contenido. Se nota en cada entrada
fría, que es exactamente la primera impresión de una demo contra el free tier de Render.

Y dice lo contrario de lo que pasa: *"no hay proyectos"* es una afirmación sobre el mundo, no sobre
la red.

## Alcance

- **Cubre:** las 30 rutas que hoy colapsan "cargando" y "vacío" en el mismo render.
- **NO cubre:** un skeleton nuevo por pantalla si M2-D3 no lo define. **Lo que se usa es lo que el
  entregable ya tiene**; si una pantalla no tiene estado de carga definido, se usa el patrón genérico
  que se decida una vez, no uno por ruta.
- **NO cubre:** el estado de error, que es otra cosa y hoy tampoco está. Se anota como deuda con su
  nombre en vez de mezclarse acá.

## Diseño

Tres estados, no dos, en todas las rutas:

| Estado | Hoy | Después |
|---|---|---|
| cargando | empty-state | indicador de carga |
| cargado y vacío | empty-state | empty-state |
| cargado con datos | contenido | contenido |

La forma concreta —`isPending` de TanStack Query en cada ruta, o un componente `<Cargando>` envolvente—
la elige el implementador. **El requisito es que la distinción exista y sea una sola forma repetida 30
veces, no 30 formas.**

## Lo que no hay que tocar

**Ninguna de las 42 rutas tiene test unitario** (6819 líneas), y eso es una **decisión declarada** en
`apps/web/CLAUDE.md`, con su mitigación bien hecha: la lógica sale a `lib/` con tests propios
(`anclajeVigenteDelStage`, `unicosPorStageId`). **Esta spec no la revierte** ni abre una suite de
rutas.

Sí deja escrito el costo: esa decisión es la razón por la que el estado de carga no lo vio nadie
durante 42 rutas. Si el patrón queda en un componente compartido, **ese componente sí lleva test**, y
con eso la red existe donde puede existir.

## Invariantes

1. **Ninguna ruta afirma "no hay X" mientras no sabe si hay X.**
2. **Un solo patrón de carga en toda la app**, con su token y su copy del diccionario (regla 14).
3. **Cero cambio en el empty-state** de una ruta ya cargada: lo que hoy se ve cuando de verdad no hay
   nada, se sigue viendo igual.
4. El componente compartido **tiene test**, aunque las rutas no.

## Casos borde

| Caso | Esperado |
|---|---|
| Respuesta en 30 ms (caché) | no parpadea un spinner; el patrón tolera la carga instantánea |
| Ruta con dos queries (detalle + noticias) | un solo estado de carga coherente, no dos indicadores peleando |
| `investor.unit.$unitId.index` polleando `news` cada 10s | el refetch **no** vuelve a mostrar carga: solo la primera |
| Query que falla | no se queda cargando para siempre; cae al estado que se decida, y se anota |
| API fría de Render (varios segundos) | el caso que motiva la spec: hay que verlo con el servicio dormido |
