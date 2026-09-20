# SPEC-111 — Migrar los call sites de `apps/web` al cliente oRPC generado

> **Origen:** [`SPEC-212`](SPEC-212-contrato-en-la-firma-de-la-ruta.md) §Alcance, explícitamente fuera
> de esa spec: *"NO cubre: migrar los call sites de `apps/web` para que usen el cliente nuevo. Eso es
> un cambio del front (`apps/web/CLAUDE.md`), y meterlo en el mismo commit sería el big-bang que D-066
> prohíbe. El cliente existe y tipa; cuándo el front lo adopta es una spec propia."* Nivel a
> confirmar cuando se desarrolle (probablemente 🟢, transcripción mecánica de un `fetch` vía
> `ApiPort` a una llamada del cliente oRPC tipado).

**Sin desarrollar todavía — esta entrada solo registra que la spec falta y por qué, para que no se
pierda como pendiente suelto.**

## El problema que deja abierto no hacerla

`SPEC-212` migra cada ruta de backend a un procedimiento oRPC cuyo input/output es el Zod schema de
`packages/shared`, y de ese mismo contrato genera un cliente tipado con `@orpc/client`. Pero si
`apps/web` no lo adopta, `apps/web/src/api/types.ts` sigue siendo un espejo escrito a mano de las
respuestas del backend — exactamente el mismo problema de drift que motivó D-066 y que `SPEC-109` ya
cerró una vez del lado de los tipos de respuesta. Backend migrado sin front migrado es media garantía:
la mitad que oRPC resuelve (documentación + validación) queda hecha, la mitad que more importa a
runtime (que el cliente hable el contrato real, no una copia) no.

## Por qué es una spec aparte, y no parte de SPEC-212

`SPEC-212` ya lo decide: hacerlo en el mismo commit que el backend sería el big-bang que D-066
prohíbe (*"los endpoints se re-scopean por rol, vertical por vertical, nunca en un big-bang"*). El
cliente oRPC de una vertical existe y tipa apenas esa sub-parte del backend cierra — adoptarlo del
lado del front es un trabajo separado, con su propio ritmo.

## Forma esperada (a confirmar cuando se desarrolle)

- Una entrada por vertical migrada en el backend (§A notary, §B certifier, §C investor, §D developer
  de `SPEC-212`), no una migración de una sola vez de las 46 rutas.
- Cada call site de `ApiPort` que hoy pega contra una ruta ya migrada pasa a usar el cliente oRPC
  tipado de esa vertical, en vez de `fetch` + el tipo a mano de `apps/web/src/api/types.ts`.
- **No cubre** ningún cambio de contrato: la ruta ya migrada en el backend no cambia lo que acepta o
  devuelve — esto es solo cambiar el lado que llama.
- Queda pendiente decidir, al desarrollarla, si conviene una spec por vertical (simetría con
  `SPEC-212`) o una sola que recorra las cuatro a medida que el backend las va cerrando.

## Orden

Depende de que cada sub-parte de `SPEC-212` (§A–§D) esté cerrada del lado del backend antes de migrar
sus call sites — no tiene sentido adoptar un cliente que todavía no existe.
