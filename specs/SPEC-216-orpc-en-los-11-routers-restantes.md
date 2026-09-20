# SPEC-216 — Extender oRPC a los 11 routers que D-066 no nombra

> **Origen:** [`SPEC-212`](SPEC-212-contrato-en-la-firma-de-la-ruta.md) §Las cuatro sub-partes,
> explícitamente fuera de esa spec: *"Fuera de alcance de las cuatro: los routers que D-066 no
> nombra — `auth`, `users`, `projects`, `projects-obra`, `stages`, `evidence`, `contracts`,
> `notifications`, `profile`, `audit-logs`, `public` (11 archivos, cross-cutting o admin, no
> scopeados por rol). Esos se quedan con `REQUEST_SCHEMAS`/`RESPONSE_SCHEMAS` tal como están hoy —
> extender D-066 a ellos es una decisión nueva, no algo que esta spec pueda asumir."* Nivel a
> confirmar cuando se desarrolle (🟡, como las cuatro sub-partes de `SPEC-212`, por tocar el
> framework de la API).

**Sin desarrollar todavía — esta entrada solo registra que la spec falta y por qué, para que no se
pierda como pendiente suelto.**

## El problema que deja abierto no hacerla

Si las cuatro sub-partes de `SPEC-212` cierran, ~35 de las ~46 rutas de la API dejan de depender de
`REQUEST_SCHEMAS`/`RESPONSE_SCHEMAS` (las tablas a mano de `scripts/generate-openapi.ts`, sin garantía
de completitud — el hallazgo que originó `SPEC-212`). Los 11 routers restantes (`auth`, `users`,
`projects`, `projects-obra`, `stages`, `evidence`, `contracts`, `notifications`, `profile`,
`audit-logs`, `public`) seguirían con el problema original sin resolver: dos patrones de contrato
conviviendo en el mismo backend, uno con la garantía y otro sin ella.

## Por qué es una decisión nueva, no una continuación automática

D-066 nombra explícitamente cuatro verticales *scopeadas por rol* (notary, certifier, investor,
developer) — el diseño de `SPEC-212` (un `OpenAPIHandler` por procedimiento, montado en la ruta
exacta, con `authorize` sin tocar) está probado para ese shape. Los 11 routers restantes no son
verticales por rol: son cross-cutting (`audit-logs`, `notifications`, `public`) o administrativos
(`users`, `projects`), con su propia composición de guards. Extender D-066 a ellos es ampliar el
alcance de una decisión del dueño, no aplicar la que ya existe — por eso `SPEC-212` la deja
explícitamente afuera en vez de asumirla.

## Forma esperada (a confirmar cuando se desarrolle)

- Empieza por confirmar con el dueño si D-066 se extiende a estos 11 routers o si el diseño
  documentado se considera solo para verticales por rol.
- Si se extiende: probablemente una sub-parte por router o por grupo afín (p. ej. `projects` +
  `projects-obra` juntos, `notifications` + `audit-logs` cross-cutting aparte), siguiendo el mismo
  patrón de montaje ya verificado en `SPEC-212` (`@orpc/zod/zod4`, `OpenAPIHandler` por procedimiento
  con `path: "/"`), no uno nuevo.
- **No cubre** ningún cambio de contrato ni de `authorize` — mismas invariantes que `SPEC-212`.

## Orden

Después de que las cuatro sub-partes de `SPEC-212` (§A–§D) estén cerradas y el patrón haya probado su
costo real en código de producción, no solo en el smoke test. Mismo criterio que "no agregar infra
para lo que todavía no duele" (`CLAUDE.md` raíz §Trampas transversales): primero las cuatro
verticales que D-066 ya decidió, después preguntar si conviene extenderlo.
