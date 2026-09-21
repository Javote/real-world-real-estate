# SPEC-401 — Dos campos del contrato declarados más flojos que la realidad

> **Origen:** [`AUDITORIA-2026-09-11-calidad-de-packages.md`](AUDITORIA-2026-09-11-calidad-de-packages.md)
> §P-01 y §P-02. Nivel 🟢. **Independiente.** No toca ningún criterio del SOM.
>
> Van juntas porque son el mismo error en el mismo archivo: un schema de respuesta que acepta más
> de lo que la API puede producir. **Cero cambio de comportamiento**: no se mueve un byte del JSON.

## El problema, en una frase

Dos campos de `packages/shared` están declarados tan anchos que **no pueden fallar nunca**, en un
package cuya única defensa es que los schemas fallen.

## P-01 · `anchorStatus`

Sale siempre del mismo lugar —`"OnChainEvent.status as anchorStatus"`, en los cuatro handlers que lo
seleccionan— o sea que su dominio real es `ONCHAIN_EVENT_STATUSES`: `Pending | Confirmed | Failed`.

| Dónde | Hoy | Debe ser |
|---|---|---|
| `contract.ts` · `contractReleaseSchema` | `onChainEventStatusSchema.nullable()` | ya está ✔ |
| `documents.ts` · `projectDocumentSchema` | `z.string()` | `onChainEventStatusSchema` |
| `documents.ts` · `developerDocumentSchema` | `z.string().nullable()` | `onChainEventStatusSchema.nullable()` |
| `certifier.ts` · `certifierCertificateSchema` | `z.string().nullable()` | `onChainEventStatusSchema.nullable()` |

**Importa más que un tipo flojo cualquiera:** `anchorStatus` es el campo de la regla 17 — lo que
decide si una pantalla dice "Verificado" o "Pendiente". Con `z.string()` el front no puede hacer un
`switch` exhaustivo y nadie se entera si aparece un cuarto estado.

**Ojo con `projectDocumentSchema`**, que es el único no-nullable: el handler
(`projects.routes.ts:408`) resuelve `f.txid ? (f.anchorStatus ?? "Confirmed") : "Pending"`, así que
nunca manda `null`. El schema tiene razón en exigirlo; lo que le falta es el enum.

## P-02 · `authoritative` en `developerDocumentSchema`

Está declarado `z.coerce.boolean()`, que es `Boolean(v)`: `"false"` → `true`, `"0"` → `true`, `{}` →
`true`. **Ese campo no puede fallar.** Debe ser `z.boolean()`, como en los otros cuatro schemas que
lo declaran.

Y la coerción no hace falta: `authoritative` está en `BOOLEAN_COLUMNS` del
`SqliteTypeCoercionPlugin` y `developer.routes.ts:323` la selecciona sin renombrar
(`"Evidence.authoritative as authoritative"`), así que el plugin la matchea por nombre y llega
`boolean`. **Antes de cambiarla, confirmar eso corriendo el handler** — si por alguna razón llegara
`0`/`1`, la respuesta correcta es arreglar el `select`, no ensanchar el schema.

## Alcance / NO-alcance

- **Cubre:** las cuatro declaraciones de arriba, en `documents.ts` y `certifier.ts`.
- **NO cubre:** `apps/api`. Ningún handler cambia; si alguno dejara de compilar, es que mandaba algo
  fuera del enum y **eso es el hallazgo**, no un obstáculo.
- **NO cubre:** `apps/web`, que hoy tiene su propio espejo (`SPEC-109`). Cuando esa spec se tome,
  hereda el enum sin trabajo extra.

## Invariantes

1. **Ningún campo de un schema de respuesta acepta valores que la API no puede producir.**
2. `anchorStatus` se declara con `onChainEventStatusSchema` en los cuatro lugares; la nulabilidad de
   cada uno sigue la del `leftJoin` que lo produce, no se uniforma de arrastre.
3. **Ninguna coerción en un schema de respuesta.** `z.coerce.*` es para lo que *entra* (params,
   query, multipart); una respuesta que necesita coerción es un `select` mal hecho.

## Casos borde (definen los tests)

| Caso | Esperado |
|---|---|
| `anchorStatus: "Cualquiera"` | **falla** (hoy pasa) |
| `anchorStatus: null` en `projectDocumentSchema` | falla — el handler nunca lo manda |
| `anchorStatus: null` en los otros dos | pasa |
| `authoritative: "false"` | **falla** (hoy da `true`) |
| `authoritative: 1` | falla — el plugin ya lo convirtió; si llega un número, el `select` está mal |
| Una respuesta real de cada uno de los 4 handlers | pasa, sin tocar el handler |

## Verificación

`pnpm verify`. Los tests de `apps/api` que ejercitan esos cuatro endpoints tienen que seguir verdes
**sin cambiarlos**: si alguno se pone rojo, encontró un valor que la API manda y no debería.

## Cerrada — 2026-09-20

Las cuatro declaraciones, en `packages/shared`:

- `documents.ts` · `projectDocumentSchema.anchorStatus` → `onChainEventStatusSchema` (no-nullable,
  como ya estaba).
- `documents.ts` · `developerDocumentSchema.anchorStatus` → `onChainEventStatusSchema.nullable()`.
- `documents.ts` · `developerDocumentSchema.authoritative` → `z.boolean()` (era
  `z.coerce.boolean()`).
- `certifier.ts` · `certifierCertificateSchema.anchorStatus` → `onChainEventStatusSchema.nullable()`.

**Confirmado antes de tocar `authoritative`, no asumido** (la spec lo pedía explícito): `pnpm
--filter @plataforma/api typecheck` quedó limpio y los 428 tests de `apps/api` pasaron **sin tocar
ninguno**, incluidos los cuatro endpoints — `developer.routes.ts:323` selecciona la columna sin
renombrar y el `SqliteTypeCoercionPlugin` ya la matchea por nombre, así que llega `boolean` de
verdad; la coerción no hacía nada.

**Cero cambio de comportamiento, en el sentido estricto:** el único efecto visible fue
`specs/evidencia-m3/2-api/openapi/propnexus.openapi.json` y `specs/evidencia-m3/2-api/postman/propnexus.postman_collection.json`
—regenerados con `pnpm docs:openapi`/`docs:api`, que `openapi-freshness.test.ts` exige— pasando a
documentar el enum en vez de `string` para `anchorStatus`. Ni un byte del JSON que la API sirve se
movió.

`pnpm verify` completo, verde.
