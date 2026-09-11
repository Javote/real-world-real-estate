# SPEC-108 — Higiene: el shell de card repetido, el hook disfrazado, la prop que se ignora

> **Origen:** [`AUDITORIA-2026-09-11-calidad-del-frente.md`](AUDITORIA-2026-09-11-calidad-del-frente.md)
> §F-15, §F-16, §F-17 y el anexo del warning de `login.test.tsx`. Nivel 🟢. **Independiente.**
> No toca ningún criterio del SOM.
>
> Cuatro cambios mecánicos, cero cambio visual, cero componente nuevo.

## F-15 · 65 repeticiones del mismo shell de card

| Veces | Clase |
|---:|---|
| 44 | `rounded-xl bg-card p-s4 shadow-e1` |
| 16 | `rounded-xl bg-card p-s4 text-body-sm text-text-muted shadow-e1` (el empty-state) |
| 5 | `rounded-lg bg-card p-s3 shadow-e1` |

**Sin componente nuevo** —no hay nada que proponerle a M2-D3—: **dos constantes exportadas** cubren
las 65 y vuelven imposible que la próxima card salga con el radio o el padding de otra. La tercera
fila de la tabla es exactamente esa deriva, ya ocurrida: alguien escribió `rounded-lg p-s3` donde el
resto usa `rounded-xl p-s4`.

Al consolidar hay que **decidir esas 5**: o son un caso legítimo (una card densa que M2-D3 contempla)
y se nombran como tercera constante, o son deriva y se alinean. Se decide mirando las capturas, no
por mayoría.

## F-16 · `KpiValue()` es un hook con nombre de componente

`components/KpiValue.tsx:11` llama `useTranslation()` adentro y se invoca como `const kpi = KpiValue()`
en `developer.index.tsx:41`, `certifier.index.tsx:29` y `notary.index.tsx:34`. Funciona, pero
**ninguna regla de lint puede verlo**: en PascalCase, `react-hooks/rules-of-hooks` lo trata como
componente y no revisa nada. Se llama `useKpiValue` y se mueve a donde vivan los hooks.

## F-17 · Prop aceptada y descartada en silencio

`ButtonProps` en `components/domain/PrimaryButton.tsx:17` declara `loading?: boolean`, pero **solo
`PrimaryButton` lo desestructura**: `<SecondaryButton loading>` y `<DangerButton loading>`
type-checkean y no hacen nada. O los tres lo implementan —el spinner ya está escrito, son tres
líneas— o el tipo deja de ofrecerlo. **Preferible lo primero**: un botón secundario que dispara una
mutación es exactamente donde se quiere el estado de carga (ver [`SPEC-110`](SPEC-110-estado-de-carga.md)).

## Anexo · el warning de cada `pnpm dev`

`routes/login.test.tsx` escupe un warning del generador de rutas en cada arranque (*"does not export
a Route"*). Se resuelve renombrándolo `-login.test.tsx`, **como ya está hecho con `-slugify.test.ts`**
y como la propia trampa de `apps/web/CLAUDE.md` indica. Una línea, y saca ruido de todos los
arranques.

## Invariantes

1. **Ninguna card escribe su shell a mano.** Un `rounded-* bg-card p-s* shadow-*` suelto en una ruta
   es el síntoma que esta spec elimina.
2. **Todo lo que llama hooks se llama `use*`.**
3. **Ninguna prop declarada se ignora**: o la implementan los tres, o no está en el tipo.
4. **Cero cambio visual**: las 65 cards se ven exactamente igual, salvo las 5 que se decidan alinear
   — y esas se listan en el commit.

## Verificación

`pnpm verify` en verde, y una pasada por el navegador en las 3 superficies de KPI y en 5 de las cards
consolidadas, a 390px.
