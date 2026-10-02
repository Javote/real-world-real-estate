# SPEC-610 — Menos viajes a la base por request

> Fase 1, ítem 10 de [`specs/README.md`](../README.md), que lleva su estado. Nivel 🟡: toca
> `authenticate`/`authorize` y la capa de base. **No cambia la API:** paths, bodies, respuestas y
> códigos de estado quedan idénticos.

## Lo que hay hoy, medido el 2026-10-02

**Kysely serializa todas las consultas del proceso.** `@libsql/kysely-libsql` 0.4.1 usa el
`SqliteAdapter` de Kysely, que declara `supportsMultipleConnections = false`, y Kysely 0.29 responde
con un mutex global de conexión (`RuntimeDriver`). Un `Promise.all` de tres consultas paga tres
viajes; dos requests simultáneas se turnan consulta por consulta; una transacción abierta frena a
toda la API hasta su `COMMIT`. Contra Turso el mutex no protege nada: cada `LibsqlConnection` es
independiente y cada transacción abre su propio stream HTTP. En local, el cliente `file:` le cede su
conexión a la transacción y abre otra para lo que sigue.

Encima, el middleware encadena sus propias lecturas. `GET /stages/:id`:

| # | Consulta | Dónde |
|---|---|---|
| 1 | `User` (¿sigue activo?, ¿qué rol?) | `authenticate`, `src/middlewares/auth.ts` |
| 2 | `Stage.projectId` | `proyectoDeLaEntidad`, mismo archivo |
| 3 | `Project` con `EXISTS(ProjectMember …)` | `canAccessProject`, mismo archivo |
| 4 | `Stage` otra vez, completo | el handler, `src/routes/stages.routes.ts` |
| 5–7 | `Evidence` + `Project` otra vez + `cabezaDelHilo`, en un `Promise.all` que el mutex serializa | el handler |

Viajes en serie medidos con `test/viajes-por-request.test.ts` (paso 0):

| Request | Antes | Paso 1 | Paso 2 | Paso 3 | Paso 4 | Paso 5 | Paso 6 | Paso 7 |
|---|---|---|---|---|---|---|---|---|
| `GET /auth/me` | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
| `GET /projects` | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| `GET /projects/:id` | 5 | 5 | 5 | 4 | 4 | 4 | 2 | 2 |
| `GET /projects/:id/stages` | 5 | 5 | 5 | 3 | 3 | 3 | 3 | 2 |
| `GET /stages/:id` | 7 | 5 | 4 | 3 | 3 | 3 | 2 | 2 |
| `PATCH /stages/:id` | 6 | 6 | 5 | 4 | 4 | 3 | 3 | 2 |
| `GET /investor/units` | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| `GET /notifications/unread-count` | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
| `GET /contracts/:id/releases` (regla `alguna`) | — | — | — | 5 | 4 | 4 | 4 | 4 |
| Dos `GET /auth/me` simultáneos | 4 | 2 | 2 | 2 | 2 | 2 | 2 | 2 |

En las mutaciones, `writeAuditLog` es otro viaje después de la escritura. Las 6 rutas con
`db.transaction()` usan transacciones interactivas. Las consultas de Kysely no van por el
`@libsql/client` 0.17 de la API sino por el 0.8.1 que trae `@libsql/kysely-libsql`; los dos, con una
URL `libsql://` en Node, hablan HTTPS (`expandConfig(config, true)` → `preferHttp`), el `BEGIN` viaja con la primera sentencia
y cada sentencia y el `COMMIT` son un viaje cada uno. `client.batch([...], "write")` manda todo en
uno y es atómico.

Las 91 rutas con sesión pasan todas por `authorize` (lo garantiza la `MATRIZ` de
`test/route-guards.test.ts`); 31 resuelven el proyecto desde una entidad (`via`).

`SPEC-603` baja el costo de cada viaje (~100 ms → pocos ms); esta spec baja la cantidad. Las dos
valen por separado.

## Invariantes

1. **El contrato no se mueve.** Ningún test de `orpc-client-*`, `route-guards`, `project-access` ni
   `authorize-alguna` cambia de expectativa. Las precedencias de hoy se conservan: 401 antes que 403,
   y 404 antes que 403 donde la regla resuelve una entidad.
2. **La revocación sigue siendo inmediata.** Toda request con sesión sigue leyendo `User.isActive` y
   `User.role` de la base. No se confía solo en el JWT (dura 7 días).
3. **`req.user` solo existe después de verificar el usuario contra la base.** Un handler nunca lo ve
   antes.
4. **Lo que toca el audit, lo deja atómico** con la mutación que audita (§1.3 de la
   [auditoría](../AUDITORIA-2026-10-01-arquitectura-api-y-web.md)).

## Pasos, en este orden

**0. Medir.** `test/helpers/viajes.ts` espía `LibsqlConnection.prototype.executeQuery` y
`commitTransaction`, les agrega una demora fija y registra inicio y fin. Los viajes en serie de una
request son la cadena más larga de consultas donde cada una empieza después de que terminó la
anterior. `test/viajes-por-request.test.ts` fija el número de cada ruta: si sube o baja, el test lo
dice.

**1. Sin mutex.** `src/lib/libsql-dialect.ts` arma el dialecto con un adaptador que declara
`supportsMultipleConnections = true`. Los `Promise.all` que ya existen pasan a ser paralelos, y las
requests dejan de turnarse. El riesgo: en local, dos escrituras concurrentes contra el mismo archivo
pueden dar `SQLITE_BUSY`; la suite completa y `pnpm e2e` lo dirían. **Hecho el 2026-10-02:** la
suite de la API (764) y `pnpm e2e` 100/100 con la API levantada sin `watch`. Con `tsx watch` fallaron
11 logins sueltos, y las mismas 11 pasaron con el mutex puesto: la trampa de `tsx watch` de
`apps/web/CLAUDE.md`, no este cambio.

**2. La autorización por proyecto en una consulta.** `proyectoDeLaEntidad` + `canAccessProject` pasan
a ser un solo `SELECT` desde la entidad con `LEFT JOIN Project` y el `EXISTS` de `projectScope` como
columna: sin fila → 404; fila con el flag en falso → 403. **−1 viaje** en las 31 rutas con `via`.

**3. El usuario en paralelo con la autorización.** `authenticate` verifica el JWT, **lanza** la
lectura de `User` sin esperarla, la guarda en `req.sesion` junto con lo que dice el token y llama a
`next()`. `authorize` corre la regla con el `id`, el `role` y el `email` del token mientras espera esa
lectura. Usuario inexistente o inactivo → 401 `User not active`; la lectura falla → 401 `Invalid
token`, los dos mensajes de antes. Si el `role` o el `email` de la base no son los del token, la regla
se vuelve a evaluar con los de la base (un viaje más, solo en ese caso): el veredicto es siempre el
de la base, como antes. Recién entonces escribe `req.user`. La lectura lanzada **nunca rechaza**: si
`paramValidator` corta con 400 antes de `authorize`, nadie la espera, y una promesa rechazada sin
manejar tira el proceso en Node 24. Por lo mismo, la regla anticipada lleva su `catch` cuando el 401
corta antes de esperarla. Una ruta con `authenticate` y sin `authorize` no tendría `req.user`: falla
cerrada, y la `MATRIZ` no la deja montar. Si `req.user` ya existe (los tests unitarios de
`authorize`), se usa tal cual. Lo fija `test/sesion-en-paralelo.test.ts`, con las dos ramas
verificadas por mutación: sin la reevaluación caen los dos tests de rol, y sin el `catch` Vitest
marca la promesa sin manejar.

**4. Las ramas de `alguna` en paralelo.** Hoy van con `for … await`. Mismo veredicto, sin esperar.

**5. Batch de libSQL para la mutación y su audit.** `enLote(...consultas)` en `src/lib/db.ts`:
compila con Kysely y manda todo con `client.batch(…, "write")`, un viaje y atómico, y pasa las filas
por `coerceRow` para devolverlas con los tipos de Kysely. El cliente es el del driver que Kysely ya
creó (`LibsqlDialect.cliente`): misma versión, sin un segundo pool, y `db.destroy()` lo sigue
cerrando. `writeAuditLog` se parte en `insertAuditLog` (la consulta sin ejecutar) para poder ir en el
lote. **Alcance:** `PATCH /stages/:id`, la mutación que mide la tabla. Las otras escrituras con audit
son el `audit(trx)` de A1, que hereda `enLote` en vez de una transacción interactiva. `enLote` es lo
único de la API que no pasa por `LibsqlConnection.executeQuery` (contra 238 llamadas de Kysely): el
driver no tiene camino para `batch`, y `db.transaction()` costaría un viaje por sentencia más el
COMMIT. El helper de viajes espía `batch` en el prototipo del cliente para contarlo. Lo fija
`test/en-lote.test.ts`: tipos coercionados, y un audit que falla deja la mutación sin aplicar.

**6. Los handlers que releen lo que ya se sabe.** Las lecturas que solo dependen del id del path
van juntas en un `Promise.all`: `GET /stages/:id` (`Stage`, `Evidence`, `Project` por join y
`cabezaDelHilo`) y `GET /projects/:id` (`Project`, sus `Stage` y sus miembros). `GET
/contracts/:id/releases` queda como está: espera a `reconciliarParaLectura` antes de leer, y esa
espera es la regla de D-077, no una relectura. El resto lo hace la migración (`SPEC-604` se disuelve
en A3/A4).

**7. Las dos rutas de stages que quedaban en 3.** `PATCH /stages/:id` ya no relee el `Stage` antes
de escribir: esa lectura solo servía para un 404 que `authorize` ya descartó. Si el body toca
`sequenceOrder` o `validationCritical`, sigue consultando `cabezaDelHilo` antes del lote y paga 3:
meter esa condición en el `UPDATE` obligaría a impedir que el audit del mismo lote se escriba cuando
el update no cambió nada, y ese caso casi siempre termina en 409. `GET /projects/:id/stages` busca
los hilos on-chain con una subconsulta por `projectId` en vez de esperar los ids de la primera
consulta, y las dos van en un `Promise.all`. **2 es el piso con este diseño:** un viaje para
autorizar (con `User` en paralelo) y uno para los datos; bajar a 1 pide meter la autorización en la
consulta de cada handler, y eso es A2.

**Lo que no se hace:** confiar en el rol del JWT sin consultar la base, cachear usuarios en memoria
(una sola instancia hoy, pero la invalidación es un problema nuevo) y tocar `transitionStage`, donde
pesan las llamadas a Cardano y no Turso.

## Qué sobrevive a la migración

El paso 1 vive en `db.ts` y no lo toca la migración. Los pasos 2–4 viven en funciones de `auth.ts` que no dependen de Express: el middleware de oRPC de A2
las reusa. El paso 5 es el `audit(trx)` de A1 hecho sobre `batch` en vez de sobre una transacción
interactiva. **A1 lo hereda:** sobre Turso, una transacción interactiva cuesta un viaje por sentencia.

## Verificación

- `test/viajes-por-request.test.ts`, con el antes y el después en la tabla de arriba.
- `pnpm verify:all` y `pnpm e2e` completo (toca auth).
- En producción, después del deploy: la duración de `GET /api/v1/stages/:id` en Tempo, antes y
  después.
