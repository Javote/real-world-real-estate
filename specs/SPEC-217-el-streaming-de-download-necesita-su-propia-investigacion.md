# SPEC-217 — `GET /evidence/:id/download`: streaming real con oRPC, investigado y verificado

> **Origen:** desprendida de [`SPEC-216`](SPEC-216-orpc-en-los-11-routers-restantes.md) el
> 2026-09-20, en la misma auditoría ruta por ruta que esa spec — es la única de las 39 rutas de los
> 11 routers cross-cutting/admin que no repite un patrón ya probado en `SPEC-212`. Nivel 🟡, mismo
> criterio que las demás sub-partes de oRPC.
>
> **El título original de esta entrada, cuando se abrió, era "necesita su propia investigación" —
> ya se hizo, en la misma sesión, antes de escribir el resto de esta spec.** El resultado cambia el
> tono de "bloqueada hasta decidir algo" a "diseño verificado, falta implementar": oRPC 1.15.2 SÍ
> puede servir un stream real sin bufferearlo, y no es un rincón sin documentar de la librería — es
> un caso de primera clase que tanto `@orpc/openapi` como `@orpc/standard-server-node` manejan
> explícito. Se deja el nombre del archivo tal cual para no perder el rastro de por qué esta ruta se
> separó de `SPEC-216` en primer lugar.

## El problema tal como se veía al abrir esta spec

`GET /evidence/:id/download` (`evidence.routes.ts`) es la única ruta de los 39 candidatos de
`SPEC-216` que responde con el contenido de un archivo, no con JSON:

```ts
router.get("/:id/download", authorize({ ... }), async (req, res) => {
  // ... buscar la evidencia, chequear que exista en el storage ...
  res.setHeader("Content-Type", evidence.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${...}"`);
  const contenido = await storage.read(evidence.storagePath);
  return contenido.pipe(res);
});
```

`storage.read()` (`lib/storage.ts`) devuelve un `Readable` de Node — con el driver `disk`, un
`fs.createReadStream()` perezoso; con `s3` (R2 en prod), el `Body` que ya entrega
`@aws-sdk/client-s3` como stream, sin bajarlo entero a memoria antes. El `.pipe(res)` de hoy nunca
junta el archivo completo en un buffer — es justo lo que `CLAUDE.md` raíz pide para
`MAX_FILE_SIZE_MB` (regla 10, y la deuda de RAM que ese archivo ya declara).

**Lo que hacía dudar de que oRPC sirviera para esto** era el precedente inmediato de `SPEC-212`:
`OpenAPIHandler.handle()` parsea un `multipart/form-data` de ENTRADA con
`Response(stream).formData()`, que bufferea el archivo entero sin límite — la razón por la que la
única ruta multipart de la API (`developer-evidencia.routes.ts`) se quedó afuera de esa migración.
Era razonable sospechar que la SALIDA tuviera la misma limitación. **No la tiene, y está verificado,
no supuesto.**

## Lo investigado, leyendo el código fuente real (no los `.d.ts`, no la documentación)

Tres archivos, la cadena completa desde que el `.handler()` de un procedimiento devuelve algo hasta
que los bytes salen por el socket:

1. **`@orpc/openapi/dist/shared/openapi.DPiCV5hl.mjs`, `StandardOpenAPICodec.encode()`:**

   ```js
   if (output.body instanceof ReadableStream) {
     return { status: output.status ?? successStatus, headers: output.headers ?? {}, body: output.body };
   }
   return { ..., body: this.serializer.serialize(output.body) };
   ```

   Con `outputStructure: "detailed"` y un `output.body` que sea un **`ReadableStream` estándar de la
   Web API** (no `node:stream.Readable` — la distinción importa, ver abajo), el codec deja pasar el
   stream tal cual. No lo serializa, no lo toca. Mismo mecanismo, por lo demás, que ya usa el caso
   `instanceof Blob`/`File` de `SPEC-212` §C (`dossierExportProcedure`) — un `File` extiende `Blob`,
   no `ReadableStream`, así que es una rama de código hermana, no la misma, y hay que declarar la de
   `ReadableStream` explícitamente.

2. **`@orpc/standard-server-node/dist/index.mjs`, `toNodeHttpBody()`:**

   ```js
   function toNodeHttpBody(body, headers, options = {}) {
     if (body instanceof ReadableStream) {
       return Readable.fromWeb(body);
     }
     // ... los casos de Blob, FormData, etc. debajo, sin llegar acá ...
   }
   ```

   Esto es lo que corre del lado Node antes de responder: convierte el `ReadableStream` web de vuelta
   a un `Readable` de Node con `Readable.fromWeb()` — una envoltura, no una lectura.

3. **La misma función, `sendStandardResponse()`:**

   ```js
   res.writeHead(standardResponse.status, toNodeHttpHeaders(resHeaders));
   // ...
   resBody.once("error", (error) => res.destroy(error));
   resBody.pipe(res);
   ```

   Un `.pipe(res)` de toda la vida — igual que el `contenido.pipe(res)` de hoy. **En ningún punto de
   la cadena hay un `for await` que junte chunks, ni un `Buffer.concat`, ni un límite de tamaño
   implícito.** Los tres archivos se leyeron completos para confirmar esto, no solo la función que
   parecía relevante.

**Verificado además con un smoke test descartable** (`test/zzz-download-stream-smoke.test.ts`,
corrido y borrado): un procedimiento mínimo que devuelve
`{ status: 200, headers: {...}, body: Readable.toWeb(fs.createReadStream(archivo5MB)) }`, montado con
`new OpenAPIHandler({...})` (el de `lib/orpc.ts`, con el interceptor de Sentry ya encima — no
interfiere: el interceptor envuelve `opts.next()` dentro de `StandardHandler.handle()`, que devuelve
`{matched, response}` con el `body` todavía como referencia al stream sin consumir), pedido por HTTP
real contra un servidor Express real. El archivo de 5MB llegó completo, byte a byte, con los headers
exactos que el handler puso (`content-type`, `content-disposition`) — no los que oRPC hubiera
inferido solo. `.output()` con `z.instanceof(ReadableStream)` valida el `ReadableStream` real sin
problema (confirmado aparte, un `safeParse` directo con `Readable.toWeb(...)` como valor).

**El punto que hay que tener presente al implementar:** es `Readable.toWeb(nodeStream)`, no el
`Readable` crudo. `storage.read()` devuelve un `node:stream.Readable` (la interfaz `StoragePort` lo
declara así); el `.handler()` tiene que convertirlo con `Readable.toWeb()` (de `node:stream`, stdlib,
sin dependencia nueva) antes de devolverlo — devolver el `Readable` de Node tal cual no matchea
ninguna de las ramas de `encode()`/`toNodeHttpBody()` de arriba (ninguna de las dos comprueba
`instanceof Readable`, solo `instanceof ReadableStream`/`Blob`/`File`) y terminaría serializado como
JSON vacío o tirando un error de "detailed output structure inválido".

## Lo que la migración mejora, sin buscarlo

`sendStandardResponse()` hace `resBody.once("error", (error) => res.destroy(error))` antes de
pipear. **El código de hoy no tiene ningún manejador de error en `contenido.pipe(res)`** — si el
`Readable` que devuelve `storage.read()` emite `'error'` a mitad de la respuesta (una conexión a R2
que se corta, un disco que falla), Node no propaga automáticamente ese evento al destino del pipe, y
un `EventEmitter` que emite `'error'` sin nadie escuchando **tira una excepción no capturada** — en
el peor caso, tumba el proceso. No es una regresión que esta spec introduzca: es un defecto latente
del código actual, que la migración cierra de pasada porque `sendStandardResponse()` ya lo maneja.
No se abre una spec aparte para esto porque el arreglo es un efecto colateral correcto de migrar, no
trabajo adicional.

## Lo que sigue igual, y lo que hay que decidir al escribir el código real

- **Los tres chequeos previos (evidencia existe, archivo existe en el storage) siguen antes de tocar
  el stream**, exactamente como hoy — la ruta solo arma la respuesta de streaming después de que las
  dos búsquedas confirmaron que hay algo que servir. Ningún `res.writeHead` se dispara antes de esos
  chequeos, ni con el código de hoy ni con el de oRPC.
- **`CompressionPlugin` no está en el camino, y hay que dejarlo así a propósito.** `OpenAPIHandler`
  (`@orpc/openapi/node`) no incluye ningún plugin por default — los que existen en
  `@orpc/server/node` (`CompressionPlugin`, `BodyLimitPlugin`) solo entran si se los pasa
  explícitamente en `options.plugins`, y ninguna de las 45 rutas migradas de `SPEC-212` lo hace. Si
  algún día alguien agrega compresión a nivel de handler, esta ruta necesita quedar excluida —
  comprimir un stream ya de por sí grande cambia el perfil de memoria que esta spec entera existe
  para proteger.
- **El driver (`disk` en dev, `s3`/R2 en prod) no cambia nada del diseño.** Los dos devuelven un
  `Readable` perezoso desde `StoragePort.read()`; `Readable.toWeb()` envuelve cualquiera de los dos
  igual. No hace falta una rama por driver.
- **El `Content-Type` sale de `evidence.mimeType` (el que se declaró al subir), no de lo que
  `Readable.toWeb()` pudiera inferir** — mismo criterio que hoy, `outputStructure: "detailed"` con
  `headers` explícitos es lo que lo fija, igual que en `dossierExportProcedure` (`SPEC-212` §C).
- **El `.output()` del procedimiento** es
  `z.object({ headers: z.record(z.string(), z.string()).optional(), body: z.instanceof(ReadableStream) })`
  — mismo shape que `dossierExportProcedure`, cambiando `z.instanceof(File)` por
  `z.instanceof(ReadableStream)`. `successStatus` queda en 200 (default), no hace falta la unión
  discriminada de `SPEC-212` §A porque esta ruta no tiene un caso idempotente con dos códigos de
  éxito distintos, a diferencia de `POST /evidence/:id/anchor`.
- **Los dos 404 (`Evidence not found`, `Stored file not found`) siguen siendo `ORPCError("NOT_FOUND",
  {...})` lisos** — ningún test de esta ruta fija un `body.code` exacto sobre ninguno de los dos
  (confirmado: `grep -rn "Stored file not found\|Evidence not found" test/` no encuentra una
  aserción sobre `.code`, solo sobre el mensaje o el status), así que no hace falta `.errors({...})`
  con nombre — mismo criterio que los 404 sin nombre de §B (`SPEC-212`).

## Alcance

- **Cubre:** migrar `GET /evidence/:id/download` (`evidence.routes.ts`) al mismo patrón de las demás
  rutas de esa vertical (§E7 en `SPEC-216`) — un `OpenAPIHandler` propio, montado en su path exacto,
  `authorize` sin tocar delante, reusando el diseño verificado arriba.
- **Cubre:** un test que compare bytes reales de un archivo servido por esta ruta (no un mock de
  `storage`), mismo criterio que ya usa `test/orpc-client-investor.test.ts` para
  `export.pdf` (`%PDF-`…`%%EOF`) — acá contra un archivo de evidencia subido de verdad en el test.
- **Cubre:** sacar la entrada de esta ruta de `REQUEST_SCHEMAS`/`RESPONSE_SCHEMAS`.
- **NO cubre:** cambiar `StoragePort`, `lib/storage.ts`, ni el driver `s3`/`disk` — el diseño reusa
  `storage.read()` tal cual, solo envuelto con `Readable.toWeb()` en el `.handler()`.
- **NO cubre:** las otras 7 rutas de `evidence.routes.ts` — esas son `SPEC-216` §E7.
- **NO cubre:** ningún cambio de contrato HTTP — mismo `Content-Type`, mismo `Content-Disposition`,
  mismos bytes, mismo 404 en los mismos dos casos.

## Invariantes

1. **El archivo se sirve en streaming, sin bufferear su contenido completo en memoria en ningún
   punto del camino** — la garantía que esta spec existe para proteger. Se verifica con un test que
   sirva un archivo de varios MB y compare bytes, no con una inspección de memoria (que sería flaky
   en CI); la garantía real la da la lectura de código de arriba, el test es la evidencia de
   comportamiento (D-053: comportamiento, no inspección de fuente, pero acá la lectura de fuente ya
   se hizo y quedó documentada para quien dude).
2. **`Content-Type` y `Content-Disposition` salen del registro (`evidence.mimeType`,
   `evidence.originalFilename`), nunca de lo que la librería infiera.**
3. **Los dos 404 existentes no cambian de mensaje ni de forma.**
4. **`authorize` sigue corriendo primero, sin cambios en su firma** — misma regla `{ proyecto: { via:
   "Evidence", param: "id" }, membresias: ANY_MEMBERSHIP }` de hoy.

## Casos borde

| Caso | Esperado |
|---|---|
| Evidencia inexistente | 404, sin tocar el storage |
| Evidencia existe pero el archivo no está en el storage | 404, sin intentar leer |
| Descarga exitosa, archivo chico (unos KB) | 200, bytes idénticos, headers correctos |
| Descarga exitosa, archivo grande (varios MB, el test que fija la invariante 1) | 200, bytes idénticos, sin que el test tenga que esperar a que el archivo entero se junte antes del primer byte de respuesta (se puede observar con un stream de lectura del lado del test, no hace falta medir memoria) |
| Un usuario sin membresía en el proyecto de la evidencia | 403 de `authorize`, oRPC nunca corre — mismo test que ya existe hoy |
| El storage falla a mitad de la descarga (simulado con un `Readable` que emite `'error'` después de algunos chunks) | la respuesta se corta (`res.destroy`), no hay excepción no capturada — el caso que la migración mejora de pasada, ver §Lo que la migración mejora |

## Orden

Independiente de `SPEC-216` — el diseño ya no depende de resolver nada ahí, y `SPEC-216` §E7
(`evidence.routes.ts`, las otras 7 rutas) puede migrar antes, después o en el mismo commit que esta.
Si se hacen juntas, mejor: es una sola revisión 🟡 del archivo completo en vez de dos.
