# SPEC-212 — `contrato()`: el schema en la firma de la ruta, no en una tabla

> **Origen:** [`AUDITORIA-2026-09-11-calidad-del-backend.md`](AUDITORIA-2026-09-11-calidad-del-backend.md) §B-06.
> Nivel 🟡. **Independiente**, pero es **la deuda de diseño más grande de la serie 2xx y la que más
> rinde a futuro**: merece su propia sesión. No toca ningún criterio del SOM — aunque sí protege la
> evidencia del criterio 5 (el OpenAPI).

## La mitad que está bien, y hay que no romper

`lib/route-inventory.ts` **interroga al router que Express armó de verdad**, y tres consumidores leen
de ahí: `test/route-guards.test.ts`, `scripts/generate-api-docs.ts` y `scripts/generate-openapi.ts`.
Nadie mantiene un mapa de rutas a mano, y `codigoDeExito` llega a regexear el `res.status(2xx)` real
del handler en vez de adivinar por verbo HTTP. **Es de las mejores piezas del repo.**

## La mitad que falta

`REQUEST_SCHEMAS` (`scripts/generate-openapi.ts:153`) y `RESPONSE_SCHEMAS` (línea 194) **sí** son mapas
a mano, indexados por string de ruta: **dos tablas de ~110 entradas cada una, con el path repetido
como string en las dos**. El propio archivo lo declara sin vueltas:

> *"`test/openapi-freshness.test.ts` prueba que el JSON commiteado sea el que este archivo generaría
> hoy — **pero no prueba que esta lista esté completa**: si un `safeParse` nuevo no se agrega acá, el
> documento generado simplemente no cambia y el test sigue verde. La única defensa real es […] se
> edita el mismo día que se agrega el `safeParse`."*

**[`SPEC-204`](SPEC-204-openapi-url-y-descripcion.md) es esa deriva ya ocurrida**, en la única parte
del documento que ningún test cubre.

## El diseño

Es el mismo problema que `GUARD` resolvió para la autorización: **una propiedad del middleware que
deja leer la ruta desde afuera**. Un `contrato({ body, query, respuesta })` que devuelva un middleware
marcado con un símbolo no enumerable pone el schema **en la firma de la ruta**, al lado de
`authorize`, y las dos tablas desaparecen:

```ts
router.post(
  "/documents",
  authorize({ roles: ["admin", "developer"], acceso: { … } }),
  contrato({ body: anchorDocumentSchema, respuesta: onChainEventSchema }),
  async (req, res) => { … }
);
```

Alineado con D-053 —*antes de agregar un verificador, preguntá si el problema no se arregla mejor
cambiando la forma de lo verificado*— y con el mismo argumento que justificó `authorize`: **la
ausencia de una entrada en una tabla no es un tipo; la ausencia de un argumento en una firma sí.**

## Alcance

- **Cubre:** el middleware `contrato()`, su lectura desde `route-inventory`, la migración de las ~220
  entradas de las dos tablas a las firmas, y el borrado de las tablas.
- **Cubre:** que `contrato()` **valide** el body/query, reemplazando el `safeParse` manual del handler
  donde lo haya — es lo que hace que el schema declarado y el schema aplicado no puedan divergir.
- **NO cubre:** cambiar un solo contrato de API. Ninguna ruta acepta ni devuelve algo distinto.
- **NO cubre:** las 9 rutas sin cuerpo JSON (`204` o binario): declaran `respuesta: null` explícito,
  no se omiten.
- **NO cubre:** `authorize` ni la matriz de `route-guards.test.ts`, que **no se tocan**.

## Invariantes

1. **El schema de una ruta se lee en su firma.** Después de esta spec, `generate-openapi.ts` no tiene
   ninguna tabla indexada por string de ruta.
2. **El schema que documenta es el schema que valida.** Una sola declaración por ruta.
3. **Una ruta sin `contrato()` es visible**: el generador la lista como faltante y el test puede
   exigir el conjunto completo — que es lo que hoy es imposible.
4. **El JSON generado es equivalente al de hoy**, ruta por ruta, salvo lo que hoy falta y que esta
   spec hace aparecer (esas diferencias se revisan una por una, no se aceptan en bloque).
5. **El shape del error de validación no cambia**: hoy es `parsed.error.flatten()` con 400.

## Casos borde (definen los tests)

| Caso | Esperado |
|---|---|
| Ruta nueva sin `contrato()` | el test de completitud la marca; hoy pasaría en silencio |
| Body inválido | 400 con el mismo cuerpo que hoy (`flatten()`) |
| `strictObject` con campo de más | mismo rechazo que hoy |
| Ruta con `query` y sin `body` | se declara solo lo que tiene |
| Las 9 rutas sin cuerpo | `respuesta: null`, y el documento las muestra como `204`/binario |
| `pnpm docs:openapi` | JSON commiteado equivalente; `openapi-freshness` verde |

## Orden

**Después de [`SPEC-204`](SPEC-204-openapi-url-y-descripcion.md)**, que es de 15 minutos y arregla el
síntoma visible para quien recibe el entregable. Esta spec arregla la causa.
