# SPEC-204 — El OpenAPI publicado apunta a una URL que no existe

> **Origen:** [`AUDITORIA-2026-09-11-calidad-del-backend.md`](AUDITORIA-2026-09-11-calidad-del-backend.md) §B-04.
> Nivel 🟢. **Independiente.** ~15 minutos, y es **lo primero que toca quien recibe el entregable** —
> el OpenAPI es la evidencia del criterio 5 del SOM.

## El problema, en dos renglones

`specs/openapi/propnexus.openapi.json` declara:

```json
"servers": [{ "url": "http://localhost:3001/api/v1", "description": "Local (pnpm dev)" }]
```

y sus 70 paths **ya empiezan con `/api/v1`** — salen de `MONTAJE`, donde el prefijo es parte de la
clave. Un cliente generado desde este documento, o el botón *Try it* de cualquier Swagger UI, arma:

```
http://localhost:3001/api/v1/api/v1/auth/login
```

**Doble prefijo, y encima el puerto equivocado:** la API en dev escucha en **8787**, lo dice
`apps/api/.env.example:14` (*"8787 es el puerto de la API en dev"*) y lo confirma
`apps/web/.env.example:12` (`API_ORIGIN=http://localhost:8787`). El 3001 no aparece en ninguna otra
parte del repo.

## El segundo síntoma, en el mismo archivo

`info.description` afirma:

> *"Body, query y **~24 respuestas de éxito** son el schema Zod real […] el resto de las respuestas
> **sigue sin schema** (Tanda 2 de `specs/PLAN-2026-09-08-documentar-api-completa.md`)"*

Contadas sobre el JSON commiteado: **76 de las 85 operaciones tienen schema de respuesta 2xx** — las
9 restantes son legítimamente sin cuerpo (`204` o binario). Y el comentario de `RESPONSE_SCHEMAS`,
150 líneas más arriba **en el mismo generador**, dice que las dos tandas están **cerradas**. Los dos
textos viven en el mismo archivo y se contradicen.

## Qué se cambia

| Dónde | Qué |
|---|---|
| `apps/api/scripts/generate-openapi.ts:430` | `url: "http://localhost:8787"` **a secas** — sin `/api/v1`, que ya viene en cada path |
| mismo archivo, `info.description` | reescribir: 76/85 con schema de respuesta, las 9 sin cuerpo JSON explicadas, sin la referencia a una tanda cerrada |
| `specs/openapi/propnexus.openapi.json` | regenerar con `pnpm --filter @plataforma/api docs:openapi` y commitear |

`test/openapi-freshness.test.ts` hace el resto: prueba que el JSON commiteado sea el que el generador
produce hoy.

## Sobre agregar el server de producción

Se puede sumar una segunda entrada apuntando a `propnexus-api.onrender.com`. **Que sea una decisión,
no un descuido**: un *Try it* que pega contra producción desde la documentación pública es
exactamente lo que [`SPEC-211`](SPEC-211-limite-de-tasa-en-la-ruta-publica.md) está mirando por otro
lado. Si se agrega, va después de la local y con su `description` diciendo qué es.

## Invariantes

1. **`servers[].url` + un `path` del documento forman una URL que responde.** Se verifica pegándole,
   no leyéndolo.
2. **El `description` del documento coincide con el JSON commiteado**, contado sobre el JSON.
3. El puerto de dev sale de una sola fuente: si `.env.example` cambia, esto cambia.

## Casos borde

| Caso | Esperado |
|---|---|
| *Try it* de Swagger UI sobre `/auth/login` con la API local corriendo | responde (401 o 200), no 404 |
| `pnpm docs:openapi` sin cambios | JSON idéntico; `openapi-freshness` verde |
| Alguien mueve el prefijo `/api/v1` a `servers` | los 70 paths tienen que perderlo **en el mismo commit**, o vuelve el doble prefijo |
