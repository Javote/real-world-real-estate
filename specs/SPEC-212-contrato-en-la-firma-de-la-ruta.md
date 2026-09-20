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
> fragmento relativo que mostraba el primer ejemplo de esta spec.
>
> **§B (`certifier`, 6 rutas) cerrada el mismo día**, mismo patrón que §A ya probado, sin trampas
> nuevas. La única decisión propia: ninguna de las 6 rutas tiene un test que ejercite `/certify` u
> `/observe` por HTTP (las 16 transiciones de la FSM se prueban contra `PATCH /stages/:id/state`
> con token admin, no contra esta superficie), así que los 404/409 de `transitionStage` usan
> `ORPCError` liso — no hizo falta el `.errors({NOMBRE:...})` con nombre que sí necesitó el 409
> `DOSSIER_SIGNED` de §A.
>
> **§C (`investor`, las 14 rutas) cerrada el mismo día.** Dos decisiones propias, las dos
> documentadas en `investor.routes.ts`. La primera, revisada dos veces:
> `GET .../dossier/export.pdf` se creyó primero que no podía migrar —`OpenAPIHandler` serializa
> cualquier `Buffer` del body como JSON (`{"type":"Buffer","data":[...]}`), probado antes de
> escribir código— pero el adaptador Node de oRPC (`@orpc/standard-server-node`) sí tiene un caso
> especial para `body instanceof Blob`/`File`: manda los bytes crudos por stream, con
> `content-type` tomado del propio Blob. Devolver un `File` en vez de un `Buffer`, con
> `outputStructure: "detailed"` para fijar el `Content-Disposition` exacto, migra la ruta sin tocar
> el contrato — verificado con el mismo test que ya comparaba bytes (`%PDF-`…`%%EOF`) contra el
> servidor real. La segunda: `accept` tenía una clase `InvitationAcceptError` que existía solo para
> viajar por el `catch` de Express hasta el 409/404 con el código de negocio correcto (SPEC-201,
> `res.body.code` fijado por test para `UNIT_NOT_AVAILABLE` e `INVITATION_NOT_PENDING`) — con oRPC
> esa clase se borró: `.errors({NOMBRE:...})` la reemplaza, y un `throw` dentro de
> `db.transaction().execute(...)` sigue revirtiendo la transacción igual, porque Kysely no
> distingue el tipo del error al decidir si hace rollback.
>
> **§D (`developer`) cerrada 2026-09-20 — 19 de las 20 rutas, y una excepción real.** Antes de
> tocar código: `OpenAPIHandler` SÍ sabe parsear `multipart/form-data` (probado con un smoke test
> que subió un `File` + campos de texto contra un procedimiento con `z.file()` en el input, borrado
> después de confirmarlo) — pero lo hace con el `Response(stream).formData()` nativo de Node, que
> bufferea el archivo ENTERO en memoria **sin ningún límite configurable**, a diferencia de Multer,
> que hoy aplica `limits.fileSize` y `fileFilter` en streaming (regla 10, y la deuda de RAM que
> `CLAUDE.md` raíz ya declara sobre `MAX_FILE_SIZE_MB`). Migrar la única ruta multipart de esta
> sub-parte (`POST .../stages/:stageId/evidence`, `developer-evidencia.routes.ts`) empeoraría esa
> deuda en vez de resolverla, así que **se queda afuera a propósito** — con Multer y
> `REQUEST_SCHEMAS`/`RESPONSE_SCHEMAS` tal como estaba. Las otras 19 (`developer.routes.ts` 8,
> `developer-comercial.routes.ts` 7, `capital.routes.ts` 4) migraron con el mismo patrón que §A/§B/§C.
>
> **Una trampa nueva, no vista en las sub-partes anteriores porque ninguna insertaba contra un
> índice único sin haberlo chequeado antes en la misma transacción: `OpenAPIHandler` nunca llama a
> `next(err)`.** Un `throw` que no sea un `ORPCError`/error con nombre lo captura oRPC mismo y
> responde su propio 500 genérico — el `errorHandler` de Express (y con él,
> `codigoDeRestriccion`/`CONSTRAINT_ERRORS`, que mapean un `SQLITE_CONSTRAINT_UNIQUE` a 409
> `RESOURCE_ALREADY_EXISTS`) nunca llega a verlo. Se encontró con un smoke test dedicado, no
> leyendo código: `POST /developer/projects` (slug repetido) y `POST /developer/projects/:id/units`
> (unitReference repetido dentro del proyecto) SÍ insertan contra restricciones únicas, y
> `test/constraint-errors.test.ts` fija 409 — sin capturarlo, la migración volvía a la regresión
> exacta que esa suite existe para impedir (2026-08-24, "un duplicado es 409, no 500"). Cerrado con
> `relanzarRestriccionComoOrpc` (`_shared.ts`): cada procedimiento que inserta contra una
> restricción declara `.errors({RESOURCE_ALREADY_EXISTS, RELATED_RESOURCE_NOT_FOUND})` y envuelve
> el insert en un `.catch()` que reusa el MISMO mapeo de `errorHandler.ts` — nunca una copia.
>
> **Deuda declarada, no cerrada:** el hallazgo de arriba es genérico a las cuatro sub-partes, no
> específico de §D — cualquier excepción no clasificada dentro de un handler oRPC de `notary`,
> `certifier` o `investor` también se convierte en el 500 genérico de oRPC en vez de pasar por
> `errorHandler`/Sentry (`Sentry.setupExpressErrorHandler` depende de `next(err)`, que oRPC nunca
> llama). No tenía consecuencia observable en las tres primeras sub-partes porque ninguna de sus
> rutas tiene un test que ejercite esa restricción por HTTP; acá sí.
>
> **Dos investigaciones quedaron pendientes, pedidas por el dueño el 2026-09-20 — ver las dos
> secciones "Pendiente" que siguen, antes de "La mitad que está bien":** (1) si `OpenAPIHandler`
> tiene un gancho (`interceptors`) para que un error no clasificado sí llegue a
> `errorHandler`/Sentry, y (2) si `Multer + call()` (probado con un smoke test descartable, `call()`
> SÍ deja que el error llegue a `next(err)`) es una vía real para migrar la única ruta multipart que
> quedó afuera.

## Pendiente — investigar más a fondo: `OpenAPIHandler` nunca llama a `next(err)`

**Sin cerrar. Pedido textual del dueño, 2026-09-20, para que quede registrado tal cual:**

> Si queres edita el spec para que quede pendiente investigar mas a fondo esto (con el mayor nivel
> de detalle posible) (este ultimo mensaje textual estaria bien.)

Contexto de la pregunta que lo generó: se le preguntó al dueño si quería que se arreglara la trampa
de arriba (§D, "Deuda declarada, no cerrada") de forma genérica para las cuatro sub-partes, o si se
dejaba como estaba. Eligió dejarla pendiente de investigar, no arreglarla ahora ni dejarla sin más
registro que la mención breve de arriba.

**El estado exacto, para que quien retome no tenga que releer todo el hilo:**

- **Lo que SÍ está cerrado:** los dos únicos call sites que un test iba a agarrar —
  `POST /developer/projects` (slug repetido) y `POST /developer/projects/:id/units` (unitReference
  repetido) — capturan la excepción con `relanzarRestriccionComoOrpc` (`src/routes/_shared.ts`) y
  responden el mismo 409 `RESOURCE_ALREADY_EXISTS` de siempre. `test/constraint-errors.test.ts`
  sigue verde.
- **Lo que NO está cerrado:** cualquier OTRA excepción sin capturar, dentro de CUALQUIER
  procedimiento de las cuatro sub-partes (`notary`, `certifier`, `investor`, `developer`), se
  convierte en el 500 genérico de oRPC (`{"code":"INTERNAL_SERVER_ERROR","status":500,"message":
  "Internal server error"}`) en vez de pasar por `errorHandler.ts`. Confirmado con un smoke test
  dedicado (no leyendo código): un handler que hace `throw new Error(...)` responde ese sobre
  directamente, y un middleware de error puesto DESPUÉS del montaje de `OpenAPIHandler` nunca corre
  — ni siquiera se ejecuta.
- **La consecuencia con más superficie, no solo la de constraint:** `Sentry.setupExpressErrorHandler`
  también depende de que Express llegue a ver el error vía `next(err)` (`app.ts`, montado junto con
  `errorHandler`). Un 500 real disparado desde adentro de un handler oRPC — no solo un
  `SQLITE_CONSTRAINT_*`, cualquier fallo interno no anticipado — **no llega a Sentry**. Hoy nadie lo
  puede ver en producción salvo leyendo el log crudo del proceso (y ni eso: no se verificó todavía
  si oRPC loguea algo a `console.error` cuando responde su 500, o si es completamente silencioso —
  **ese es justo el tipo de pregunta que esta investigación tiene que responder**).

**Lo que la investigación más a fondo tiene que responder, concretamente:**

1. **¿oRPC loguea el error que captura, en algún lado, antes de responder su 500?** Si no lo hace,
   un 500 real de una ruta oRPC no solo no llega a Sentry — no deja ningún rastro en absoluto,
   salvo lo que el propio proceso de Render capture en stdout/stderr (y Render free no da shell,
   D-040). Verificarlo leyendo el código fuente de `@orpc/openapi`/`@orpc/server` (no adivinando),
   con la misma metodología que ya se usó para las trampas de esta spec (`node_modules/.pnpm/...`).
2. **¿`OpenAPIHandler` acepta una opción `interceptors` (o `rootInterceptors`) que permita
   engancharse antes de que el error se convierta en respuesta?** Se encontró, sin verificar a
   fondo, que `StandardHandlerOptions<T>` (`@orpc/server`, tipo del que hereda
   `StandardOpenAPIHandlerOptions`) declara:
   ```ts
   interceptors?: Interceptor<StandardHandlerInterceptorOptions<TContext>, Promise<StandardHandleResult>>[];
   rootInterceptors?: Interceptor<StandardHandlerInterceptorOptions<TContext>, Promise<StandardHandleResult>>[];
   ```
   con el comentario del propio tipo: *"Interceptors at the request level, helpful when you want
   catch errors"*. Esto sugiere que existe un mecanismo genérico — un solo lugar, en la construcción
   de CADA `OpenAPIHandler` (o mejor, centralizado si se pudiera compartir entre los ~20
   `OpenAPIHandler` que hoy existen, uno por procedimiento) — para interceptar el error ANTES de que
   se escriba la respuesta, mapear restricciones de la base igual que `errorHandler.ts`, y loguear
   a Sentry a mano (ya que `next(err)` nunca va a llegar). **No se probó todavía si el interceptor
   ve la excepción CRUDA (para poder inspeccionar `codigoDeRestriccion`) o si para cuando el
   interceptor corre el error ya se convirtió en `StandardHandleResult`** (una respuesta ya armada,
   sin la excepción original) — eso decide si esta vía sirve para lo que hace falta o no.
3. **Si `interceptors` no alcanza, ¿hay una forma de que `OpenAPIHandler.handle()` delegue a
   `next(err)` en vez de escribir su propia respuesta, para un error que no reconoce?** Puede que
   la respuesta sea "no, por diseño" (la librería asume que ES la última palabra sobre el error) —
   en ese caso la alternativa realista es que cada handler capture y mapee explícitamente (como ya
   se hizo para los dos casos de §D), y se acepte que es trabajo por ruta, no una solución de una
   vez. Esa conclusión también es un resultado válido de la investigación, no un fracaso.
4. **¿Vale la pena, en cambio, reportar a Sentry a mano DESDE `relanzarRestriccionComoOrpc` (o su
   equivalente genérico) en el caso "no es una restricción conocida"?** Es decir: en vez de intentar
   que oRPC delegue a `errorHandler`, aceptar que no lo hace y llamar a `Sentry.captureException`
   explícitamente antes de re-lanzar. Es menos elegante que una solución a nivel de framework, pero
   no depende de que oRPC exponga el gancho correcto — y es el tipo de compromiso que ya aparece en
   otras partes de este código (ver `apps/api/CLAUDE.md` §Trampas, "Sentry veía el error ANTES que
   `errorHandler`").
5. **¿Esto afecta al criterio 14 del SOM (monitoreo)?** `specs/EVIDENCIA-2026-09-11-monitoring-
   screenshots.md` ya se publicó y el criterio ya cerró — hay que confirmar si esta brecha existe
   desde ANTES de esa evidencia (en cuyo caso no la invalida, las cuatro sub-partes de oRPC son
   posteriores) o si de algún modo la evidencia ya cubría una ruta migrada. Dato a favor de que no
   invalida nada: las capturas son del 2026-09-11 y §A (la primera migración a oRPC) cerró recién el
   2026-09-20.

**Alcance de la investigación, para que no se convierta en otra cosa:** es solo eso, investigar y
decidir el camino — no implementar todavía. Si la conclusión es "hay un gancho genérico y sirve",
esa implementación toca las cuatro sub-partes (`notary.routes.ts`, `certifier.routes.ts`,
`investor.routes.ts`, `developer.routes.ts` + `developer-comercial.routes.ts` + `capital.routes.ts`)
y probablemente amerita su propia spec — no un parche silencioso adentro de esta.

## Pendiente — investigar: Multer como fuente del multipart, oRPC solo para validar/documentar

**También sin cerrar, pedido el mismo día.** La única de las 20 rutas de §D que no migró
(`POST /developer/projects/:id/stages/:stageId/evidence`, `developer-evidencia.routes.ts`) se quedó
afuera porque `OpenAPIHandler.handle()` parsea el multipart él mismo con el `Response(stream).
formData()` nativo de Node, sin límite de tamaño configurable — al revés de Multer, que hoy aplica
`limits.fileSize`/`fileFilter` en streaming (regla 10). La pregunta que quedó abierta:
**¿se puede seguir usando Multer para el parseo (conservando sus límites) y que oRPC entre recién
después, como el punto único donde el schema valida y documenta — sin que `OpenAPIHandler` toque el
stream de la request en absoluto?**

**Investigado (no implementado) el 2026-09-20, con un smoke test descartable
(`test/zzz-call-multer-smoke.test.ts`, borrado tras confirmar) — la respuesta es que SÍ hay una vía,
y es mejor de lo esperado en un aspecto que ni se estaba buscando:**

`@orpc/server` exporta una función `call(procedure, input, options)` que invoca un procedimiento
oRPC **directo, en proceso, sin pasar por HTTP** — corre `.input()` (valida con Zod), las
middlewares del procedimiento y el `.handler()`, y valida `.output()`, todo sin que
`OpenAPIHandler` entre en escena. El diseño que esto habilita:

```ts
// Multer sigue siendo el middleware Express de siempre — streaming, límites,
// fileFilter, disco. NADA de esto cambia.
router.post(
  "/projects/:id/stages/:stageId/evidence",
  authorize({ ... }),
  (req, res, next) => uploadSingleEvidence(req, res, (err) => (err ? next(err) : next())),
  async (req, res, next) => {
    try {
      const resultado = await call(
        uploadEvidenceProcedure,
        { ...camposDelBody, archivo: req.file },
        { context: { user: req.user! } }
      );
      res.status(201).json(resultado);
    } catch (err) {
      next(err); // ← acá está la diferencia real, ver abajo.
    }
  }
);
```

**Lo verificado, con el smoke test:**

1. **Multer parsea normal** (`multer({ dest, limits, fileFilter }).single("file")`), sin ningún
   cambio — sus límites de tamaño y tipo siguen aplicando en streaming, exactamente como hoy. `call()`
   nunca ve el stream de la request, solo el objeto ya armado (`req.body` + `req.file`).
2. **`call()` valida `.input()` con Zod y RECHAZA lanzando una excepción normal de JS** (un
   `ORPCError` con `code: "BAD_REQUEST"`, `status: 400`, y la causa (`cause`) es un
   `ValidationError` con `issues` — forma de JSON Schema, **no** `{formErrors, fieldErrors}` como
   `error.flatten()` de Zod). Confirmado con un campo obligatorio (`archivo`) ausente.
3. **Un error que el propio handler tira (`throw new ORPCError("CONFLICT", ...)`) también llega
   como excepción normal** al `catch` que lo rodea.
4. **Y acá está el hallazgo que no se estaba buscando:** como todo esto pasa dentro de un
   `try/catch` de un handler Express NORMAL, un `next(err)` de ese `catch` **sí llega al
   `errorHandler` real de Express** (y por lo tanto, a Sentry). El smoke test lo comprobó con un
   `app.use((err, req, res, next) => ...)` puesto después: corrió, y contestó su propio 409 —
   exactamente el comportamiento que `OpenAPIHandler.handle()` NUNCA tiene (ver la sección de
   arriba). **Migrar esta única ruta con `call()` en vez de `OpenAPIHandler.handle()` resolvería,
   para ESTA ruta nada más, las dos trampas de §D a la vez:** ni bufferea sin límite, ni oculta sus
   errores de Express/Sentry.

**Lo que NO se investigó todavía, y por qué esto sigue siendo "documentar la posibilidad" y no un
diseño listo para implementar:**

- **La documentación de OpenAPI para el campo del archivo.** Hoy `REQUEST_SCHEMAS` declara esta
  ruta a mano con `bodyContentType: "multipart/form-data"` — el schema (`stageEvidenceUploadSchema`)
  documenta los campos de texto, y el archivo se explica en un comentario, no en el JSON Schema. Si
  el procedimiento oRPC declarara un campo `archivo` con la forma que Multer entrega
  (`{originalname, mimetype, size, path, ...}` — NO un `File`/`Blob` de verdad, porque para cuando
  `call()` corre el archivo YA está escrito a disco), `OpenAPIGenerator.generate()` sobre ese
  procedimiento produciría un objeto JSON con esos campos, **no** la semántica de "subida de
  archivo" (`type: string, format: binary`) que un cliente de OpenAPI esperaría ver. Se puede seguir
  documentando a mano como hoy (`REQUEST_SCHEMAS` + `bodyContentType`), simplemente sin la ganancia
  de "el schema que documenta es el que valida" que sí tienen las otras 19 rutas de §D — o se puede
  investigar si `@orpc/openapi` tiene una forma de anotar un campo del input como
  `contentMediaType`/`format: binary` sin que dejen de ser objetos de Multer. No se miró.
- **El shape del 400 de validación cambia** (`data.issues`, no `error.flatten()`), y aunque
  ningún test de esta ruta fija el body exacto de un 400 (solo el status — verificado leyendo
  `test/evidence-upload.test.ts`/`test/browse-and-documents.test.ts`), sí es una superficie de API
  real que hoy devuelve `error.flatten()` como el resto de la API (regla 6, y el resto de rutas no
  oRPC). Adoptar `call()` acá sin adaptar ese shape dejaría esta ÚNICA ruta con una forma de error
  de validación distinta de las demás ~46 — hay que decidir si se adapta (mapear `ValidationError`
  → `{formErrors, fieldErrors}` a mano en el `catch`) o si se acepta la divergencia.
- **No se comparó contra dejar la ruta tal cual está hoy** (Express + Multer + `safeParse` manual,
  sin oRPC en absoluto) — que es lo que quedó decidido al cerrar §D. La pregunta real que esto
  responde es "¿vale la pena el costo de este diseño más nuevo (`call()`, un patrón que ninguna
  otra ruta de la API usa todavía) contra el beneficio (una sola declaración de schema, más el
  arreglo lateral del `next(err)`)" — y esa decisión no se tomó, solo se probó que es técnicamente
  posible.

**Si se retoma:** el smoke test que probó esto se borró a propósito (política de esta spec, ver
"Probado el 2026-09-20" más abajo) — hay que rehacerlo antes de escribir la migración real, no
asumir que lo de arriba sigue siendo cierto sin volver a correrlo contra la versión de oRPC que esté
instalada en ese momento.

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
| **§B** | `certifier` | `certifier.routes.ts` | 6 | **cerrada 2026-09-20** — ninguno, era un solo archivo, un solo prefijo |
| **§C** | `investor` | `investor.routes.ts` | 14 | **cerrada 2026-09-20** (las 14, incluida `export.pdf` con un `File` en vez de un `Buffer` — ver §El diseño) — la pertenencia de fila (`dueño: { via, param }`) ya estaba plegada **adentro** de `authorize()` desde D-088, no era un middleware aparte |
| **§D** | `developer` | `developer.routes.ts` + `developer-comercial.routes.ts` + `developer-evidencia.routes.ts` + `capital.routes.ts` | 20 | **cerrada 2026-09-20 — 19 de las 20** (la subida multipart de `developer-evidencia.routes.ts` se queda con Multer a propósito, ver §El diseño arriba) — **cuatro archivos comparten el prefijo `/api/v1/developer`**, cada uno con su propio `router.use(authenticate)` (los cuatro idénticos hoy). Con el diseño verificado (un `OpenAPIHandler` por procedimiento, montado en la ruta exacta), migrar una ruta no tocó ese `router.use` en ninguno de los tres archivos que sí migraron |

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

**Probado el 2026-09-20, cerrando §C (`investor`) — una quinta trampa, sobre respuestas binarias:**
`OpenAPIHandler` serializa el body como JSON salvo un caso especial, en el adaptador Node
(`@orpc/standard-server-node`): **si el `body` de la respuesta es `instanceof Blob` (`File`
incluida, que extiende `Blob`), manda los bytes crudos por stream**, con `content-type` y
`content-length` tomados del propio `Blob`, y `content-disposition` armado del nombre del archivo si
no se lo pisa a mano. Un `Buffer` no alcanza — sale como `{"type":"Buffer","data":[...]}` — pero
envolverlo en un `File` (`new File([bytes], nombre, {type: "application/pdf"})`) sí. Con
`outputStructure: "detailed"` y un `headers.content-disposition` explícito, el `Content-Disposition`
sale `attachment` en vez del `inline` que pondría solo. **Esto cierra la única excepción que esta
spec había dejado abierta** (`GET .../dossier/export.pdf`, ver §C arriba) — verificado contra el
mismo test que compara bytes reales (`%PDF-`…`%%EOF`) contra el servidor real, sin mockear la
descarga.

## Orden

**Después de [`SPEC-204`](SPEC-204-openapi-url-y-descripcion.md)**, que es de 15 minutos y arregla el
síntoma visible para quien recibe el entregable. Esta spec arregla la causa — ahora con la
herramienta que D-066 ya eligió, no con una nueva.
