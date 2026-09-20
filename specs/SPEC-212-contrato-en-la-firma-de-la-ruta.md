# SPEC-212 — El contrato en la firma de la ruta, con oRPC (D-066), no con un middleware propio

> **Origen:** [`AUDITORIA-2026-09-11-calidad-del-backend.md`](AUDITORIA-2026-09-11-calidad-del-backend.md) §B-06.
> Nivel 🟡. **Independiente**, pero es **la deuda de diseño más grande de la serie 2xx y la que más
> rinde a futuro**: merece su propia sesión. No toca ningún criterio del SOM — aunque sí protege la
> evidencia del criterio 5 (el OpenAPI).
>
> **Revisada 2026-09-20.** La primera versión de esta spec proponía un `contrato()` casero —un
> middleware propio que pone el schema en la firma de la ruta, al lado de `authorize`. Ese diseño
> resuelve el síntoma pero reinventa lo que **D-066 ya decidió construir con una librería**: Zod en
> `packages/shared` + oRPC sobre REST, con `@orpc/openapi` generando el documento desde el propio
> contrato. Escribir `contrato()` ahora es trabajo que se tira apenas una vertical migra a oRPC — la
> reescritura la cambia de "casero primero, oRPC después" a "oRPC directo", en las cuatro verticales
> que D-066 ya nombra.
>
> **§A (`notary`, 6 rutas) cerrada 2026-09-20** — el piloto. Migradas las 6, `pnpm verify:all`
> completo en verde, cliente oRPC tipado probado end-to-end contra el servidor real. Encontró y
> corrigió cuatro trampas nuevas del diseño original (§Probado el 2026-09-20, cerrando §A, más
> abajo) — la más importante: el `prefix` de `.handle()` tiene que ser el path absoluto, no el
> fragmento relativo que mostraba el primer ejemplo de esta spec. Quedan §B (`certifier`), §C
> (`investor`) y §D (`developer`).

## La mitad que está bien, y hay que no romper

`lib/route-inventory.ts` **interroga al router que Express armó de verdad**, y tres consumidores leen
de ahí: `test/route-guards.test.ts`, `scripts/generate-api-docs.ts` y `scripts/generate-openapi.ts`.
Nadie mantiene un mapa de rutas a mano, y `codigoDeExito` llega a regexear el `res.status(2xx)` real
del handler en vez de adivinar por verbo HTTP. **Es de las mejores piezas del repo**, y esta spec no
la toca: una ruta oRPC sigue siendo una ruta Express montada con método y path reales, así que
`route-inventory.ts` la sigue viendo igual que a cualquier otra.

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

## Por qué oRPC y no un middleware propio

D-066 ya resolvió esta pregunta, y esta spec no reabre esa discusión — **la aplica**:

- El schema vive una sola vez en `packages/shared` como Zod, y de ahí se derivan **el handler y el
  cliente**, no solo la documentación. Un `contrato()` casero solo resuelve la documentación —
  `apps/web/src/api/types.ts` seguiría siendo un espejo escrito a mano.
- `@orpc/openapi` reemplaza `REQUEST_SCHEMAS`/`RESPONSE_SCHEMAS` generándolos del contrato mismo, en
  vez de que alguien mantenga una tercera fuente de verdad con la forma de un middleware.
- **El framework no cambia: Express 5 se queda** (D-054). Los middlewares que hoy hacen el trabajo
  pesado —`authorize`, rate limit, `errorHandler`, Multer— siguen siendo middlewares Express antes
  del handler oRPC. oRPC solo reemplaza el body del handler y el `safeParse` manual, no la cadena de
  autorización.
- **Los endpoints se re-scopean por rol, vertical por vertical, nunca en un big-bang** — la frase es
  textual de D-066, y es la razón por la que esta spec se divide en cuatro partes independientes en
  vez de migrar las ~46 rutas de una.

## Las cuatro sub-partes

Cada una es su propio corte, cerrable sola, sin depender de que las otras tres existan. **Fuera de
alcance de las cuatro:** los routers que D-066 no nombra — `auth`, `users`, `projects`,
`projects-obra`, `stages`, `evidence`, `contracts`, `notifications`, `profile`, `audit-logs`,
`public` (11 archivos, cross-cutting o admin, no scopeados por rol). Esos se quedan con
`REQUEST_SCHEMAS`/`RESPONSE_SCHEMAS` tal como están hoy — extender D-066 a ellos es una decisión
nueva, no algo que esta spec pueda asumir.

| | Vertical | Archivo(s) | Rutas | Riesgo propio |
|---|---|---|---|---|
| **§A** | `notary` | `notary.routes.ts` | 6 | **cerrada 2026-09-20** — ninguno, era un solo archivo, un solo prefijo |
| **§B** | `certifier` | `certifier.routes.ts` | 6 | ninguno — un solo archivo, un solo prefijo |
| **§C** | `investor` | `investor.routes.ts` | 14 | ninguno de composición — la pertenencia de fila (`dueño: { via, param }`) ya está plegada **adentro** de `authorize()` desde D-088, no es un middleware aparte. El único riesgo es de volumen: 9 de las 14 rutas usan esa variante, más que cualquier otro archivo |
| **§D** | `developer` | `developer.routes.ts` + `developer-comercial.routes.ts` + `developer-evidencia.routes.ts` + `capital.routes.ts` | 20 | **cuatro archivos comparten el prefijo `/api/v1/developer`**, cada uno con su propio `router.use(authenticate)` (los cuatro idénticos hoy) — el incidente del 2026-08-24 (`CLAUDE.md` de este paquete) fue justo eso desalineándose. Con el diseño verificado (un `OpenAPIHandler` por procedimiento, montado en la ruta exacta — §El diseño), migrar una ruta **no toca** ese `router.use`, así que los cuatro archivos **no necesitan migrar juntos**: es simplemente la sub-parte con más superficie (20 rutas en 4 archivos) para revisar línea por línea, no una atomicidad real |

**Orden sugerido: `§A` → `§B` → `§C` → `§D`.** Las dos primeras son el piloto — 6 rutas, un archivo,
sin varios routers compartiendo prefijo — y es donde se descubren los errores de integración de
oRPC+Express+`authorize` baratos (el de montaje de §El diseño se encontró justo así, antes de tocar
ninguna ruta real). `§C` y `§D` son más grandes, no más difíciles: el patrón es el mismo repetido más
veces.

## El diseño, por sub-parte

Cada ruta pasa de:

```ts
router.post(
  "/documents",
  authorize({ roles: ["admin", "developer"], acceso: { … } }),
  async (req, res) => {
    const parsed = anchorDocumentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    // …
    res.status(201).json(evento);
  }
);
```

a un procedimiento oRPC cuyo input/output son los **mismos schemas Zod que ya existen en
`packages/shared`** (no se reescribe ninguno — regla 6 ya los puso ahí), con `authorize` corriendo
antes, sin cambiar de capa.

**El patrón de montaje exacto importa, y está verificado (no es el primer borrador de esta spec —
ver §Probado el 2026-09-20 más abajo).** `OpenAPIHandler` no matchea contra el path completo: el
`prefix` que se le pasa a `.handle()` es el punto de montaje, y el `path` que declara el
procedimiento matchea contra lo que **sobra** después de sacarle el prefix a la URL. La forma que sí
preserva `authorize` **por ruta**, exactamente como hoy (14 rutas de `investor` con 14
configuraciones de `acceso` distintas, no una regla de router):

```ts
const anchorDocumentProcedure = os
  .route({ method: "POST", path: "/documents" })
  .input(anchorDocumentSchema)
  .output(onChainEventSchema)
  .handler(async ({ input, errors }) => { /* … */ });

const anchorDocumentHandler = new OpenAPIHandler({ anchorDocumentProcedure });

// PREFIJO_ABSOLUTO = el prefijo completo con el que `MONTAJE` (app.ts) monta
// ESTE router — no el fragmento relativo del `router.post` de abajo. Ver la
// trampa del prefix, más abajo: oRPC lee `req.originalUrl`, que Express NUNCA
// reescribe al entrar a un sub-router (solo reescribe `req.url`).
router.post(
  "/documents",
  authorize({ roles: ["admin", "developer"], acceso: { … } }),
  async (req, res, next) => {
    const { matched } = await anchorDocumentHandler.handle(req, res, { prefix: PREFIJO_ABSOLUTO });
    if (!matched) next();
  }
);
```

Un `OpenAPIHandler` por procedimiento, montado en el path exacto de esa ruta — no un handler por
vertical montado una sola vez en el prefix del router. Es más verboso que la idea original de esta
spec, pero es lo que hace que **cada ruta siga declarando su propio `acceso`** sin tener que
reescribir `authorize` como middleware de oRPC (que sería un cambio de capa que D-066 no pide).

**Cada procedimiento de la vertical declara su PROPIO `path`, relativo al mismo `PREFIJO_ABSOLUTO`
— nunca `"/"` para más de uno.** Si dos procedimientos de la misma vertical usan `path: "/"` (uno
para `/kpis`, otro para `/signatures`, digamos), el runtime los distingue igual porque cada uno
tiene su propio `OpenAPIHandler` con su propio `prefix` completo — pero el documento de OpenAPI
(§El fragmento de OpenAPI, abajo) los arma con `os.prefix(PREFIJO_ABSOLUTO).router({ ...todos los
procedimientos de la vertical })`, UN SOLO prefijo para los seis, y ahí dos `path: "/"` colapsan al
mismo path del documento (`/api/v1/notary`), pisándose entre sí. Encontrado cerrando §A, antes de
que se commiteara: cada procedimiento pasó a declarar su tramo real (`/kpis`, `/dossiers/pending`,
`/dossiers/{id}`, `/dossiers/{id}/sign`, `/dossiers/{id}/reject`, `/signatures`).

`@orpc/openapi` sigue generando el fragmento del OpenAPI desde un router **combinado** —
`{ anchorDocumentProcedure, ...el resto de la vertical }`, pasado a `OpenAPIGenerator.generate(...)`
aparte de los handlers de Express— así que esa entrada sale de `REQUEST_SCHEMAS`/`RESPONSE_SCHEMAS`
en el mismo commit que migra la ruta: las tablas se **encogen** ruta por ruta en vez de vaciarse de
una.

## Alcance (por sub-parte, se repite igual en las cuatro)

- **Cubre:** migrar cada ruta de esa vertical a un procedimiento oRPC que reusa el Zod schema ya
  existente en `packages/shared`; sacar sus entradas de `REQUEST_SCHEMAS`/`RESPONSE_SCHEMAS`; que
  `@orpc/openapi` genere ese fragmento del documento.
- **Cubre:** generar el cliente oRPC tipado para esa vertical (`@orpc/client`), como prueba de que el
  contrato es real de los dos lados — es lo que D-066 pide matar del lado de `apps/web`.
- **NO cubre:** migrar los call sites de `apps/web` para que usen el cliente nuevo. Eso es un cambio
  del front (`apps/web/CLAUDE.md`), y meterlo en el mismo commit sería el big-bang que D-066 prohíbe.
  El cliente existe y tipa; cuándo el front lo adopta es una spec propia.
- **NO cubre:** cambiar un solo contrato de API. Ninguna ruta acepta ni devuelve algo distinto de lo
  que acepta y devuelve hoy.
- **NO cubre:** `authorize` ni la matriz de `route-guards.test.ts`, que **no se tocan** — siguen
  siendo middleware Express delante del handler oRPC, en la misma firma.
- **NO cubre (ninguna de las cuatro):** los 11 routers fuera de las cuatro verticales (ver tabla de
  arriba).

## Invariantes (las cinco valen para cada sub-parte por separado)

1. **El schema de una ruta se lee en su firma** — ahora como input/output de un procedimiento oRPC,
   no como argumento de un middleware casero. Después de cada sub-parte, `generate-openapi.ts` no
   tiene tabla indexada por string de ruta para esas rutas.
2. **El schema que documenta es el schema que valida y el que tipa el cliente.** Una sola
   declaración por ruta, en `packages/shared`.
3. **`authorize` sigue corriendo primero, sin cambios en su firma ni en su comportamiento, ruta por
   ruta** — no una regla de router para toda la vertical. Se logra con un `OpenAPIHandler` por
   procedimiento (§El diseño), no con un handler compartido montado una sola vez en el prefix. oRPC
   nunca ve una request que `authorize` habría rechazado.
4. **`route-guards.test.ts` sigue viendo la matriz exacta** (método, path, guards) para toda ruta
   migrada — el test no distingue una ruta oRPC de una Express llana, y no tiene por qué.
5. **El JSON de OpenAPI generado es equivalente al de hoy**, ruta por ruta, para las rutas de esa
   sub-parte (salvo lo que hoy falta y que migrar hace aparecer — esas diferencias se revisan una por
   una, no se aceptan en bloque). El shape de un error de validación no cambia donde hay tests que lo
   verifican hoy (`error.flatten()` con 400): la adaptación de errores de oRPC a esa forma es parte
   del trabajo de cada sub-parte, no un detalle que se resuelve solo.

## Casos borde (definen los tests, por sub-parte)

| Caso | Esperado |
|---|---|
| Ruta de la vertical sin migrar todavía | sigue en `REQUEST_SCHEMAS`/`RESPONSE_SCHEMAS`, el generador la sigue documentando igual que hoy |
| Body inválido en una ruta migrada | 400 con el mismo cuerpo que hoy (`flatten()` o su equivalente adaptado) |
| `strictObject` con campo de más | mismo rechazo que hoy |
| Una request que `authorize` ya habría rechazado | 401/403 de `authorize`, oRPC nunca corre |
| Una ruta cuyo procedimiento declara mal el `prefix`/`path` (el error de montaje de más arriba) | `matched: false`, 404 silencioso — el test de esa ruta lo detecta antes que cualquier lectura de código |
| **Solo §D:** una ruta de `developer.routes.ts` migra y sus hermanas de los otros tres archivos no | `router.use(authenticate)` de los cuatro archivos sigue idéntico — el test de "mismos guards a nivel de router" (`route-guards.test.ts`) sigue verde, porque esa capa no se tocó |
| `pnpm docs:openapi` tras cada sub-parte | JSON commiteado equivalente; `openapi-freshness` verde |

## Lo que hay que instalar, y quién lo revisa

`@orpc/server`, `@orpc/openapi` y `@orpc/zod` son dependencias nuevas de `apps/api` (runtime:
`dependencies`). `@orpc/client` y `@orpc/openapi-client` son **`devDependencies`** de `apps/api` —
cierran el "Cubre: generar el cliente oRPC tipado" de esta spec como prueba end-to-end en
`test/orpc-client-notary.test.ts`, sin caller real todavía; pasan a `dependencies` (de `apps/api` y
de `apps/web`) recién cuando el front los consuma de verdad, que es `SPEC-111`. Van al `package.json`
correspondiente **y** se corre `pnpm install` en el mismo commit — un `package.json` editado sin
instalar es el verde falso que ya está documentado en `CLAUDE.md` raíz §Trampas transversales. Por
ser una dependencia nueva que toca el framework de la API, cada sub-parte se revisa línea por línea
(nivel 🟡, igual que hoy).

**Probado el 2026-09-20 (`test/orpc-smoke.test.ts`, fuera de `MONTAJE`, sin tocar ninguna ruta
real):** la versión estable es `1.15.2` (la `2.0.0` solo existe en beta, no se usa). `@orpc/openapi`
con su adaptador `/node` monta sin problema detrás de un middleware Express cualquiera —el
equivalente de `authorize`— y una ruta que oRPC no matchea le pasa la request a `next()` en vez de
tragársela, así que convive con el resto de `MONTAJE` sin reordenar nada.

**Segunda trampa, sobre el montaje:** el primer borrador de "El diseño" (arriba) asumía que se podía
montar un solo `OpenAPIHandler` en el prefix de la ruta completa con el procedimiento declarando ese
mismo path — probado y **no matchea** (`matched: false`, 404). `prefix` es el punto de montaje;
`path` matchea contra lo que sobra después. Corregido a un handler por procedimiento con
`path: "/"`, montado exacto en cada ruta — ver el código ya corregido arriba. Sin este ajuste,
`authorize` seguiría funcionando pero **ninguna request llegaría nunca al handler de oRPC**: el 404
saldría silencioso y cada sub-parte se vería "migrada" con los tests igual en rojo.

**Trampa encontrada, para no volver a pisarla en ninguna de las cuatro sub-partes:** `@orpc/zod` a
secas es para **Zod v3** — su `ZodToJsonSchemaConverter` descarta en silencio cualquier schema con
`_zod` adentro (la forma interna de Zod v4, que es la que usa este repo, D-035) y `OpenAPIGenerator`
devuelve un schema vacío (`anyOf: [{}, {not: {}}]`) sin ningún error. El subpath correcto es
**`@orpc/zod/zod4`** — mismo nombre de export (`ZodToJsonSchemaConverter`), forma distinta por
dentro. Si el documento generado para una ruta migrada sale con un schema vacío, es este import.

**Probado el 2026-09-20, cerrando §A (`notary`, 6 rutas) — cuatro trampas más, las cuatro
confirmadas con un router real y anidado, no con el smoke test:**

1. **El `prefix` de `.handle()` tiene que ser el path ABSOLUTO, no el relativo dentro del router.**
   oRPC lee `req.originalUrl` (nunca `req.url`), y Express solo reescribe `req.url`/`req.baseUrl` al
   entrar a un sub-router montado con `app.use(prefijo, subRouter)` — `req.originalUrl` se mantiene
   absoluto siempre. Un `prefix` relativo como `"/kpis"` contra un router que `MONTAJE` cuelga de
   `/api/v1/notary` da `matched: false` sobre una request real a `/api/v1/notary/kpis` — probado con
   un router `express.Router()` anidado bajo `app.use("/api/v1/notary", ...)` de verdad, no con el
   smoke test (que monta al top level y por eso nunca lo iba a mostrar). Con el prefix absoluto,
   matchea. Todas las llamadas a `.handle()` de una vertical usan el MISMO `PREFIJO_ABSOLUTO`.
2. **`outputStructure: "detailed"` (para un status de éxito que varía, como el 200/201 idempotente de
   `firmar`) exige un schema de output que sea la UNIÓN discriminada completa, con `status` como
   literal en cada rama — no un solo objeto con `status: z.union([...])` adentro.**
   `z.object({ status: z.union([z.literal(200), z.literal(201)]), body: X })` falla en
   `OpenAPIGenerator.generate()` (`"must be a literal number"`, aun siendo `const` de verdad). La
   forma que sí pasa: `z.union([z.strictObject({status: z.literal(200), body: X}),
   z.strictObject({status: z.literal(201), body: X})])`.
3. **Un error de negocio (no de validación de input) que un test fija por su código exacto
   (`body.code`) necesita `.errors({ NOMBRE: { status, message } })` en el procedimiento, no
   `ORPCError("CONFLICT", { data: { code: "..." } })`.** El segundo anida el código de dominio en
   `body.data.code` y deja `body.code` como el código propio de oRPC (`"CONFLICT"`, `"NOT_FOUND"`) —
   cambiar eso sería un cambio de contrato de error, fuera de alcance. `.errors({DOSSIER_SIGNED:
   {status: 409, message: "..."}})` + `throw errors.DOSSIER_SIGNED({message: "..."})` deja
   `body.code === "DOSSIER_SIGNED"` al nivel que el test ya esperaba, **y conserva el orden**: la
   validación de `.input()` sigue corriendo antes que el handler, así que un body inválido sobre un
   recurso que además dispara ese error de negocio sigue devolviendo el 400 de input, no el error de
   negocio — probado a propósito, es el caso donde `dossier.test.ts` fallaba en el primer intento.
   Donde ningún test fija el código exacto (los demás 404 de esta vertical), un `ORPCError("NOT_FOUND",
   {message})` liso alcanza: es la adaptación sin costo que ya preveía la invariante 5.
4. **`createORPCClient<typeof miRouter>(link)` no tipa** — `typeof miRouter` es el tipo *servidor* (un
   mapa de `DecoratedProcedure`, no de funciones invocables) y no satisface `NestedClient`. Hay que
   pasarle `RouterClient<typeof miRouter>` (de `@orpc/server`), que sí mapea cada procedimiento a su
   forma de función cliente. `test/orpc-client-notary.test.ts` es la prueba end-to-end: arma el
   cliente desde el mismo `notaryOrpcRouter` que exporta `notary.routes.ts`, habla HTTP de verdad
   contra el servidor completo (`authorize` incluido) en un puerto efímero, y verifica un 200 con
   forma, un 404 de negocio y un 401 de `authorize` — sin mockear nada de los dos lados.

## Orden

**Después de [`SPEC-204`](SPEC-204-openapi-url-y-descripcion.md)**, que es de 15 minutos y arregla el
síntoma visible para quien recibe el entregable. Esta spec arregla la causa — ahora con la
herramienta que D-066 ya eligió, no con una nueva.
