# SPEC-218 — La subida de evidencia por lote, validada en los dos lados

> **Origen:** el cierre de [`SPEC-212`](SPEC-212-contrato-en-la-firma-de-la-ruta.md) — la única ruta de
> las 46 que quedó con Multer (`POST /developer/projects/:id/stages/:stageId/evidence`, M2-D5 filas
> 38 y 44c) — más el análisis del 2026-09-20 sobre cómo mejorarla. Nivel 🟡: archivos/storage,
> contrato de una fila de M2-D5 y un handler con efectos en cadena. **Se revisa línea por línea.**
> Desarrollada 2026-09-20. Estado: **cerrada 2026-09-20** — ver §Implementado, con lo que la implementación
> cambió respecto del diseño.

## Los hallazgos, verificados leyendo el código

1. **Bug en el front: se pierden archivos sin aviso.** `FileDropzone` acepta varios (`multiple`, y M2-D3
   lo pide en plural: *"Drag files or tap to select"*), pero `upload.tsx` sube solo `archivos[0]` y
   `onSuccess` hace `setArchivos([])`. Se sueltan tres, se sube uno, se ve "éxito" y dos desaparecen.
2. **El tipo de archivo se valida por el header que manda el cliente.** `fileFilter` mira
   `file.mimetype`; un ejecutable con `Content-Type: application/pdf` pasa la regla 10.
3. **El rechazo llega tarde.** El 404 (stage ajeno) y el 409 (`Completed`) se deciden después de
   recibir el archivo entero, hasta 50 MB.
4. **Fugas.** Si `storage.put` lanza, el temporal queda en `UPLOAD_DIR`. Si algo falla después del
   `put`, el objeto queda huérfano en R2.
5. **La clave del objeto lleva el nombre original saneado** (`evidence/<projectId>/<ts>-<rnd>-<nombre>`):
   la regla 2 pide refs opacas.
6. **Un archivo = un bundle = un anclaje.** Los N-1 primeros roots quedan reemplazados por el último:
   costo on-chain que no prueba nada. M2-D4 §P5 describe el patrón como *"Anchor multiple files with a
   single hash that proves the integrity of the entire bundle"*, y M2-D5 fila 38 no fija un archivo por
   request — **esto no desvía de `docs/`, se acerca a él**.
7. **Las reglas del archivo están escritas dos veces y ya divergen.** Tipos: `TIPOS_ACEPTADOS`
   (`FileDropzone.tsx`) vs `allowedMimeTypes` (`upload.ts`). Tamaño: `MAX_FILE_SIZE_MB` (env del
   backend) vs un `50` a mano en el front, dos veces, con un comentario que dice *"tiene que
   coincidir"*.

Nota de precisión: el argumento de RAM que `CLAUDE.md` raíz y `SPEC-212` §D dan para el multipart no se
sostiene para **Multer**: usa `diskStorage` y el hash se calcula con `createReadStream`, así que el body
no pasa por memoria. El "buferea en memoria" es del parser multipart de oRPC. Lo que pesa acá es disco
efímero y latencia. Se corrige en la documentación (§Documentación).

## Decisiones del dueño (2026-09-20)

| | Decisión |
|---|---|
| Tope de archivos por lote | **10** |
| Dónde vive el tamaño máximo | **En un solo lugar**: una constante en `packages/shared`. La variable `MAX_FILE_SIZE_MB` **se borra** |
| Archivo repetido | **Se rechaza en los dos lados, pero el lote NO falla**: el front no deja enviarlo dos veces en un lote; el back rechaza **ese archivo** (si ya se envió antes) y procesa los demás. Viabilidad verificada — ver abajo |
| Notificaciones | **Una por lote** a cada investor del proyecto, sin importar cuántos archivos se acepten. Un lote sin ningún aceptado no notifica |

### El archivo repetido — decidido, con su viabilidad

**No se ignora en silencio**: descartar un archivo sin decirlo es exactamente el bug 1, con otra forma.
Dos hojas con el mismo hash tampoco agregan información al root (solo lo cambian y pagan un anclaje).
La regla es una sola: **un stage no tiene dos evidencias con el mismo SHA-256**, y se hace cumplir en
los dos lados:

- **Front — repetido dentro del lote: no se puede enviar.** El dropzone calcula el SHA-256 real
  (`crypto.subtle.digest`, **de a un archivo por vez**: el peor caso es un archivo de 50 MB en memoria a la
  vez, no 500) y rechaza al agregar el segundo, nombrando cuál repite a cuál. Es un control de
  experiencia de usuario: el backend no confía en él.
- **Back — repetido dentro del lote:** la primera aparición se acepta y las siguientes se rechazan con
  `DUPLICATE_FILE_IN_BATCH`. Solo puede llegar de un cliente que no sea la UI.
- **Back — ya enviado en un lote anterior de ese stage:** se rechaza **ese archivo** con
  `EVIDENCE_ALREADY_IN_STAGE`. **El lote no falla**: los archivos nuevos que viajan con él se aceptan,
  se anclan y quedan como cualquier otra subida. **El front no tiene los hashes de los lotes anteriores**
  (`DeveloperProjectDetail` no los trae), así que este rechazo lo decide el backend y la UI lo muestra
  archivo por archivo. Traerlos al front para avisar antes sería un endpoint nuevo: fuera de alcance.
- **Un rechazo nunca es silencioso**: cada archivo rechazado vuelve en la respuesta con su código (ver
  §Contrato de la respuesta). No se descarta nada sin decirlo.
- **Si el mismo archivo necesita otra declaración** (otra `category`, otra autoridad emisora), eso es
  editar la evidencia (`updateEvidenceSchema` ya existe), no subirla otra vez.
- **Cambia comportamiento actual**: hoy subir dos veces el mismo archivo al mismo stage se acepta y ancla
  un root nuevo.

**Viabilidad en el backend — y un detalle de orden que cambia el diseño.** El hash oficial de una
evidencia lo calcula `storage.put()` **releyendo el objeto desde R2 después de subirlo** (D-027), o sea
que recién existe cuando el archivo ya está guardado. Detectar un repetido **antes** de guardar (que es lo
que pide el todo-o-nada) exige un hash previo. Se resuelve así:

1. Se calcula el SHA-256 del **temporal** (una lectura local en streaming, barata) antes de cualquier `put`.
2. Con esos hashes se detectan los repetidos del lote y los que ya están en el stage
   (`SELECT sha256Hash FROM Evidence WHERE stageId = ? AND sha256Hash IN (…)`).
3. Después del `put`, el hash que devuelve `storage.put()` **tiene que coincidir** con el del temporal;
   si no, el lote falla con compensación. Esto agrega una verificación de integridad de la subida que hoy
   no existe (hoy se confía en el rehash sin compararlo con nada).

**Límite conocido, a propósito:** el chequeo es de aplicación, no una restricción. Dos requests
simultáneos con el mismo archivo podrían pasar los dos. Lo cierra un `UNIQUE (stageId, sha256Hash)`, que
es una migración con Turso vivo y exige medir duplicados en producción antes: es
[`SPEC-219`](SPEC-219-evidence-hash-unico-por-stage.md), **aparte a propósito** — el commit de esta spec
es reversible y esa migración no.

## Diseño

### `packages/shared` — las reglas, una vez

Un módulo nuevo (`evidence-files.ts`), exportado por `index.ts`:

- `EVIDENCE_ALLOWED_MIME` (`application/pdf`, `image/jpeg`, `image/png`), `EVIDENCE_MAX_FILES = 10`,
  `EVIDENCE_MAX_FILE_MB = 50`.
- `detectarTipoDeEvidencia(bytes)`: **función pura** sobre los primeros bytes (`%PDF-`, `FF D8 FF`,
  `89 50 4E 47 0D 0A 1A 0A`). Devuelve el MIME real o `null`. **Una implementación, dos usos**: el
  front avisa en el momento; el backend decide.
- `stageEvidenceUploadResultSchema` pasa a `evidences` (1 a `EVIDENCE_MAX_FILES`) más `rejected`
  (`{ index, code }[]`, con los tres códigos como enum). Cambio incompatible; el único consumidor es `apps/web`, y el typecheck de los dos frentes lo cubre.

### Errores del pedido y rechazos por archivo — dos niveles

- **Del pedido (falla todo, no se procesa nada):** stage inexistente o ajeno (404), stage `Completed`
  (409), más de 10 archivos, un archivo por encima del tope de tamaño (Multer corta el stream: no puede
  seguir parseando), y una falla de infraestructura (R2 caído, error de base) — esta última con limpieza
  de lo ya guardado.
- **Por archivo (se rechaza ese archivo, el resto sigue):** tipo real no permitido (magic bytes),
  repetido en el lote, ya enviado en el stage. Los códigos: `UNSUPPORTED_FILE_TYPE`,
  `DUPLICATE_FILE_IN_BATCH`, `EVIDENCE_ALREADY_IN_STAGE`.
- **Si no se acepta ninguno:** `400 NO_FILES_ACCEPTED` con `rejected`; no hay bundle ni anclaje.

*Extensión que hago sobre lo que pediste:* dijiste que un lote con un archivo ya existente no debe
fallar. Apliqué el mismo criterio al tipo inválido, porque tratar distinto dos rechazos del mismo nivel
(uno por archivo y otro por lote) sería una regla que nadie va a poder explicar. Si preferís que el tipo
inválido siga rechazando el lote entero, se mueve de una lista a la otra.

### Backend — `developer-evidencia.routes.ts`, `upload.ts`, `storage.ts`

1. **Antes de recibir bytes** (después de `authorize`): un middleware con el `stageId` y el `id` de la
   URL resuelve 404 (stage ajeno) y 409 (`Completed`, `STAGE_ALREADY_COMPLETED`). **Riesgo declarado:**
   responder sin consumir el body puede cortar la conexión y el cliente ve un error de red, no el 409.
   Se prueba contra el servidor real; si no se sostiene, el chequeo se deja **después** de recibir y
   **antes** de guardar, y se anota por qué.
2. **Multer** con `.array('file', EVIDENCE_MAX_FILES)`, `limits.fileSize = EVIDENCE_MAX_FILE_MB`,
   `limits.files = EVIDENCE_MAX_FILES`. La clave `MAX_FILE_SIZE_MB` sale de `upload.ts`.
3. **Clasificar cada archivo antes de guardar ninguno:** `detectarTipoDeEvidencia` sobre el temporal;
   hash previo del temporal (§El archivo repetido); detección de repetidos del lote y de los que ya están
   en el stage. Cada uno queda **aceptado** o **rechazado con su código**. Los temporales de los
   rechazados se borran en el acto: no se guardan nunca.
4. **Guardar los aceptados con compensación:** `put` de cada uno y comparación del hash devuelto con el
   previo. Si uno falla o no coincide es una falla de infraestructura: se borran los ya guardados y el
   pedido falla entero (no queda un conjunto a medias). Los temporales se borran **siempre** (`finally`).
   La clave del objeto es opaca: `evidence/<projectId>/<id>` con un id generado, sin el nombre.
5. **Una transacción** para los `Evidence` aceptados. Después: **un** `crearBundle`, **un** anclaje
   (`EVIDENCE_ANCHOR`), **una** transición `Pending → InProgress` si corresponde, **un
   `UPLOAD_STAGE_EVIDENCE` por evidencia** en el audit log (con el `bundleId` en la metadata) y **una
   notificación por lote a cada investor del proyecto** (misma `notifyUnitInvestors` y mismo `INSERT`
   único de SPEC-209, con los mismos `titleKey` y `stageName` de hoy). Se envía solo si se aceptó al menos
   un archivo. **Cambia el comportamiento actual en un caso:** hoy N subidas separadas dan N avisos; con
   un lote de N da uno. El texto no dice cuántos archivos fueron (no se agrega un parámetro `count` acá:
   sería copy nuevo en el diccionario, y es otra decisión).
6. **La asimetría de siempre se conserva (D-059):** si el anclaje falla, los archivos y sus hashes
   quedan, `anchor.status` es `Failed`, el TXID es `null` y la UI muestra "Pendiente" — nunca
   "Verificado" (regla 17).

### Contrato de la respuesta

`201` con `{ evidences, rejected, bundleId, merkleRoot, anchor }`:
- `evidences`: las aceptadas (`evidenceSchema[]`, al menos 1).
- `rejected`: `{ index, code }[]`, vacía si no hubo rechazos. **`index` es la posición del archivo en el
  pedido**, no su nombre: el cliente ya sabe cuál era, y así el backend no repite en la respuesta un
  nombre de archivo (regla 2 aplica a logs y metadata; esto lo evita igual). Los códigos son claves, no
  copy (regla 15): el front los traduce.
- Si nada se acepta: `400 NO_FILES_ACCEPTED`, mismo `rejected`.

### Front — `upload.tsx`, `FileDropzone.tsx`, `port.ts`, `AnchoringSuccessModal`

- `FileDropzone` **sigue siendo plural** (M2-D3). Valida cantidad, tipo, tamaño, magic bytes y
  **repetidos del lote (SHA-256 real, de a un archivo)** con lo de `shared`; el `50` a mano desaparece y `maxSizeMb` toma su default de `EVIDENCE_MAX_FILE_MB`.
- `subir` manda **todos** los archivos en un solo request (`file` repetido). Ya no se pierde ninguno.
  **Al volver la respuesta**, el dropzone saca de la lista solo los aceptados; los rechazados **quedan**,
  marcados con el motivo (`rejected[].code` → clave del diccionario, regla 14/15). Nada desaparece sin
  decir por qué.
- `AnchoringSuccessModal` **no cambia**: muestra el root y el TXID **del lote** (un solo anclaje), no una
  lista de hojas — el componente no tiene esa superficie y M2-D3 no la define. Sigue siendo el único modal
  que se abre solo (M2-D4 §6.3).
- `port.ts`: `uploadStageEvidence` recibe el lote y devuelve `StageEvidenceUploadResult`;
  `port.contract.test.ts` sigue cubriéndolo (path, verbo, que la ruta declare cuerpo).
- `generate-openapi.ts`: el cuerpo multipart declara `file` como arreglo (`maxItems 10`) y la
  respuesta `evidences`. `openapi-freshness.test.ts` obliga a regenerar el documento.

## Invariantes

1. **Lo aceptado es todo o nada; lo rechazado no deja rastro.** Un archivo rechazado no deja fila
   `Evidence`, ni objeto en R2, ni temporal en disco. Una falla de infraestructura no deja un lote a medias.
2. **Ningún rechazo es silencioso.** Cada archivo que no se acepta vuelve en `rejected` con su código.
3. **Un lote = un bundle = un anclaje.** Nunca N.
4. **Un lote = una notificación por investor**, y ninguna si no se aceptó nada.
5. **El backend decide.** Ninguna regla del front es la única barrera.
6. **Las reglas del archivo no se escriben dos veces**: tipos, tope de archivos, tamaño y detección
   viven en `packages/shared`.
7. **Ninguna señal de prueba sin TXID** (regla 17): si el anclaje falla, "Pendiente".

## Casos borde (definen los tests)

**Backend** (`evidence-upload.test.ts`, 30 tests hoy — se migran a la forma de lote):
- 3 archivos válidos → 3 `Evidence`, **1** bundle, **1** evento `EVIDENCE_ANCHOR`, **1 notificación por
  investor** (no 3), 3 entradas de audit log.
- 3 archivos con uno de tipo falso (bytes de un ejecutable, `Content-Type: application/pdf`) → `201`,
  2 `Evidence`, `rejected: [{ index, code: UNSUPPORTED_FILE_TYPE }]`, **cero** objetos y **cero**
  temporales del rechazado (el test cuenta archivos en `test-uploads/`), 1 notificación por investor.
- 3 archivos, ninguno aceptable → `400 NO_FILES_ACCEPTED`, sin bundle ni anclaje ni notificaciones.
- 11 archivos → error de tope, nada guardado.
- Un archivo repetido en el lote (dos nuevos e idénticos, enviados directo al backend) → el primero, por
  orden en el pedido, se acepta; el segundo vuelve en `rejected` con `DUPLICATE_FILE_IN_BATCH`. Cuenta el
  contenido: distinto nombre o distinto `Content-Type` declarado, mismo hash, es repetido.
- Dos archivos idénticos que **además** ya están en el stage → ambos vuelven con
  `EVIDENCE_ALREADY_IN_STAGE` (se compara primero contra el stage y después dentro del lote, así el
  segundo lleva el motivo de fondo); sin aceptados → `400 NO_FILES_ACCEPTED`.
- **Dos archivos, uno ya enviado en un lote anterior del mismo stage → el lote NO falla:** `201`, el nuevo
  se acepta y se ancla, el otro vuelve en `rejected` con `EVIDENCE_ALREADY_IN_STAGE`, y el root solo
  incluye una hoja nueva. El mismo archivo en **otro** stage sí se acepta.
- Un `put` que devuelve un hash distinto del del temporal → el pedido falla y se limpia todo.
- `storage.put` que falla en el segundo de tres → el primero se borra.
- Stage `Completed` y stage de otro proyecto → 409 / 404 **sin** haber guardado nada.
- El anclaje falla → `201`, `anchor.status = Failed`, archivos conservados.
- El límite de tamaño: **un test sube 51 MB de verdad** (antes usaba `MAX_FILE_SIZE_MB=1` para no mover
  10 MB; con la constante única ese atajo desaparece). Costo aceptado: un test, segundos.
- La clave en el storage no contiene el nombre original.

**`packages/shared`:** `detectarTipoDeEvidencia` con los tres formatos válidos, un `.exe` (`MZ`), un
archivo vacío y uno de menos de 8 bytes.

**Front:** si `crypto.subtle` no existe (contexto no seguro) o el cálculo del hash falla, el dropzone
**no bloquea**: omite el aviso de repetidos y deja que el backend responda con `rejected`. Además, el
dropzone rechaza un archivo con magic bytes falsos aunque el `type` diga PDF; rechaza el
segundo de dos archivos con el mismo contenido y distinto nombre; `subir` manda todos los archivos; el
modal muestra las hojas de los **aceptados**; los rechazados quedan en la lista con su motivo traducido y
los aceptados salen.

**Verificación en el navegador** (Claude en Chrome, como `SPEC-109`/`110`): soltar 3 archivos en
`/developer/project/:id/upload` contra el backend real, y ver 1 modal, 1 root, 3 hojas.

## Alcance

**Cubre:** el handler, `upload.ts`, `storage.ts` (la clave), el schema de respuesta, `FileDropzone`,
`upload.tsx`, `port.ts`, el modal, el generador de OpenAPI y la documentación.

**No cubre:**
- **Migrar el parseo multipart a oRPC** (queda con Multer; la ruta sigue siendo la única de las 46 que
  no es un procedimiento oRPC, y ahora es una decisión documentada, no una deuda).
- **Upload directo a R2 con presigned URL**: sigue **postergado a después de mainnet**. Esta spec no lo
  bloquea ni lo condiciona; solo deja `storage.ts` con la clave opaca, que ese diseño también necesita.
- **El `UNIQUE (stageId, sha256Hash)`**: es `SPEC-219`, después de esta y con una medición previa en producción.
- Ningún cambio en la FSM del stage, en el datum ni en el validador.

## Documentación que viaja en el mismo commit

- `render.yaml`, `apps/api/.env.example` y `apps/api/vitest.config.mts`: se borra `MAX_FILE_SIZE_MB`
  (`test/render-config.test.ts` se pone rojo si `render.yaml` declara una variable que el código ya no lee).
- `CLAUDE.md` raíz: la regla 10 (*"máximo `MAX_FILE_SIZE_MB`"* → la constante de `shared`) y la fila de
  §Fuera de alcance sobre el upload directo (corrige el argumento de RAM).
- `apps/api/CLAUDE.md` (mención de `MAX_FILE_SIZE_MB`) y el comentario de `generate-openapi.ts`.
- `SPEC-212` (§D): la ruta ya no es "deuda de RAM" sino "Multer a propósito, ver `SPEC-218`".

## Orden

**Un solo commit.** El schema de respuesta en `shared` cambia de forma, así que backend y front no
compilan por separado: el typecheck es el que obliga a que viajen juntos. Antes de escribir código:
leer los 30 tests de `evidence-upload.test.ts` y decidir cuáles se convierten y cuáles se agregan.

## Implementado 2026-09-20

Tal como se diseñó, salvo cuatro cosas que la implementación obligó a cambiar y que el diseño no veía:

1. **El rechazo temprano del stage NO puede responder de inmediato.** El diseño lo advertía como riesgo y
   se probó: responder el 404/409 con el body a medio subir hace que el servidor cierre la conexión y el
   cliente vea `ECONNRESET` (reproducido, 4 de 4 corridas) en vez del 409. HTTP/1.1 no permite cortar la
   subida de un cliente que ya empezó. Lo que quedó (`rechazarStageAntesDeRecibir`): **descartar el body
   (leerlo y tirarlo, con tope = lo que Multer aceptaría) y recién ahí responder**. Se ahorra escribirlo a
   disco, hashearlo y guardarlo; **no** se ahorra el tráfico de red.
2. **El front no puede importar valores de `@plataforma/shared` por el índice.** `shared` es CommonJS: Vite
   dev lo sirve crudo y el navegador falla (*"does not provide an export named"*), y el índice arrastraría
   Zod entero al bundle. Los tests unitarios **pasaron**; lo cazó el e2e. Las reglas puras se separaron en
   `packages/shared/src/evidence-rules.ts` (**sin ninguna dependencia**) y se importan por su propia entrada
   `@plataforma/shared/evidence-rules`, cuyo `exports` apunta al fuente `.ts`. Los schemas Zod quedaron en
   `evidence-files.ts`. La trampa está en `apps/web/CLAUDE.md`.
3. **`OnChainEvent.evidenceId` de un lote es el de la primera evidencia aceptada.** El evento ancla el root
   del bundle, no un archivo; el campo es solo una referencia.
4. **`Evidence.mimeType` guarda el tipo REAL detectado**, y `storedFilename` es un id opaco (cuid) — el
   nombre original sigue solo en `originalFilename`, que no sale a logs ni a la cadena.

**Verificación.** `pnpm verify:all` en verde; los mutantes muerden (sin el chequeo contra el stage,
3 tests rojos; sin la comparación de hash, 2). El e2e de punta a punta (`evidence-flow`, desktop y mobile):
un lote con dos PDF válidos y un ejecutable disfrazado — el navegador frena el falso con su motivo, los dos
válidos se anclan con **un** modal —, y el mismo contenido en un segundo envío queda en la lista con *"ya se
subió a esta etapa"* y sin modal.

**Cómo correr ese e2e sin pisar el entorno de desarrollo** (la base local tenía hilos minteados fuera del
simulador y el anclaje daba `UNKNOWN_THREAD`): puertos y base propios, base recién sembrada y simulador —
`WEB_PORT=3100 API_ORIGIN=http://localhost:8797 PORT=8797 ANCHOR_MODE=simulated DATABASE_URL=file:<base>
npx playwright test evidence-flow`, con la base creada por `db:migrate` + `db:seed` **con
`SEED_DEMO_PASSWORD=` y `SEED_ADMIN_PASSWORD=` vacíos** (si no, el `.env` local pisa las passwords que
el login del front pre-llena).
