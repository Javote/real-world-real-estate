# SPEC-101 — La escala de íconos vuelve a la de M2-D3, y esta vez con guardia

> **Origen:** [`AUDITORIA-2026-09-11-calidad-del-frente.md`](AUDITORIA-2026-09-11-calidad-del-frente.md) §F-01.
> Nivel 🟢. **Independiente.** No toca ningún criterio del SOM.
>
> **Corrección sobre la auditoría.** El hallazgo dice *"agregar los tres tokens es de una línea"*.
> No se puede: **M2-D3 §Iconography → Sizes define la escala por contexto, y sus cinco nombres son
> los cinco que ya existen** (`inline` 16, `pill` 14, `stat` 20 en badge de 40, `nav` 24,
> `empty` 48+). `sm` / `md` / `lg` no están en el entregable. Declararlos sería elegir tokens en vez
> de transcribirlos (regla 5 del loop) e inventar fuera de `docs/`. El arreglo es el inverso:
> **los 52 usos se mueven a los nombres normativos y las tres clases fantasma desaparecen.**

## El problema, en una frase

`--size-icon-sm`, `--size-icon-md` y `--size-icon-lg` no están declarados en `styles.css`; Tailwind v4
no genera la utilidad de un token que no existe y **no emite ningún error**, así que las 52 clases
son texto muerto y los 52 íconos caen al default de Lucide (24px) sin que nadie lo note.

```
class="lucide lucide-map-pin mr-s1 size-icon-sm"           →  24×24px
getComputedStyle(body).getPropertyValue('--size-icon-sm')  →  (vacío)
```

## Alcance

- **Cubre:** los 52 usos de `size-icon-sm|md|lg` en 16 archivos, la clase muerta `top-s16`, y la
  extensión de `styles.test.ts` a la escala de tamaños, espaciado y radios de M2-D3.
- **NO cubre:** `ui/dialog.tsx`, que tiene otras 4 clases muertas de la misma familia — son resto de
  shadcn y se van con la adaptación del primitivo en [`SPEC-102`](SPEC-102-dialog-adaptado.md). La
  guardia de esta spec **las va a marcar**: si 102 no entró todavía, se listan en el `expect` como
  deuda conocida con el número de spec al lado, no se silencian por archivo.

## Qué se cambia

| Clase de hoy | Usos | Va a | Qué dice M2-D3 |
|---|---:|---|---|
| `size-icon-sm` | 43 | `size-icon-inline` | *"Inline (alongside body) · 16px"* — es el contexto de los 43: ícono pegado a un label |
| `size-icon-md` | 8 | `size-icon-stat` | *"StatCard icon badge · 20px in 40px badge"* — los 8 viven dentro de un badge o una tile |
| `size-icon-lg` | 1 | `size-icon-empty` | `FileDropzone.tsx:93` es la ilustración de empty-state: *"48px+"* |
| `top-s16` | 1 | `top-s12` | `investor.buy.tsx:301`. La escala de espaciado de M2-D3 termina en `s-12` (48px) |

**Cada uno de los 52 se clasifica mirando su contexto, no su nombre viejo.** La tabla de arriba es
el mapeo por defecto medido sobre los call sites, no una regla ciega: un `size-icon-md` que resulte
ser un control de navegación va a `size-icon-nav`, y se anota por qué en el diff.

## Esto cambia píxeles, y hay que mirarlo

Hoy los 52 renderizan a 24px (el default de Lucide). Después renderizan al tamaño que M2-D3 pide:
**43 bajan de 24 a 16, 8 bajan de 24 a 20, 1 sube de 24 a 48.** Es el cambio correcto —el entregable
es normativo— pero es visible, así que la verificación es en el navegador a **390px**, no solo el
test.

## La guardia

`styles.test.ts` ya sostiene los 20 colores normativos leyendo M2-D3 desde `docs/`, y por eso en
color no hay drift. Se extiende con el mismo patrón a lo que hoy no mira:

1. **Todo token de M2-D3 está declarado en `styles.css`**: los 5 tamaños de ícono, los 8 de
   espaciado (`s-1`…`s-12`) y los 3 radios, leídos de las tablas del entregable.
2. **Toda clase de `src/**/*.tsx` derivada de un token existe**: se escanean los `className` en busca
   de `size-icon-*`, `p-s*`, `m-s*`, `gap-s*`, `top-s*`, `rounded-*` y se exige que el token
   correspondiente esté en `styles.css`. **Esta es la mitad que faltaba** — la que convierte una
   clase fantasma en test rojo en vez de un ícono del tamaño equivocado.

## Invariantes

1. **Ninguna clase de utilidad en `src` referencia un token que `styles.css` no declara.**
2. **Ningún token de ícono fuera de los cinco de M2-D3.** Agregar uno es una decisión, no un archivo.
3. `styles.test.ts` lee `docs/` directo, nunca una copia (es el patrón ya establecido para color).

## Casos borde

| Caso | Esperado |
|---|---|
| Alguien agrega `size-icon-xl` sin declararlo | test rojo por la invariante 2 |
| Alguien declara `--size-icon-xl` en `styles.css` | test rojo: no está en la tabla de M2-D3 |
| Una clase dentro de un template string (`cn(\`size-icon-${x}\`)`) | el escáner no la ve; se prohíbe interpolar el token, y el caso se anota en el test |
| `docs/` cambia de formato y el parser deja de encontrar la tabla | el `expect(...).toBeGreaterThanOrEqual(n)` de cabecera se pone rojo, igual que hoy con color |
