# SPEC-610 — Menos viajes a la base por request

> Fase 1, ítem 10 de [`specs/README.md`](README.md), que lleva su estado. Nivel 🟡: toca
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

| Request | Antes | Paso 1 |
|---|---|---|
| `GET /auth/me` | 2 | 2 |
| `GET /projects` | 3 | 3 |
| `GET /projects/:id` | 5 | 5 |
| `GET /projects/:id/stages` | 5 | 5 |
| `GET /stages/:id` | 7 | 5 |
| `PATCH /stages/:id` | 6 | 6 |
| `GET /investor/units` | 3 | 3 |
| `GET /notifications/unread-count` | 2 | 2 |
| Dos `GET /auth/me` simultáneos | 4 | 2 |

En las mutaciones, `writeAuditLog` es otro viaje después de la escritura. Las 6 rutas con
`db.transaction()` usan transacciones interactivas: con una URL `libsql://` el cliente 0.17 de Node
habla HTTPS (`expandConfig(config, true)` → `preferHttp`), el `BEGIN` viaja con la primera sentencia
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
   [auditoría](AUDITORIA-2026-10-01-arquitectura-api-y-web.md)).

## Pasos, en este orden

**0. Medir.** `test/helpers/viajes.ts` espía `LibsqlConnection.prototype.executeQuery` y
`commitTransaction`, les agrega una demora fija y registra inicio y fin. Los viajes en serie de una
request son la cadena más larga de consultas donde cada una empieza después de que terminó la
anterior. `test/viajes-por-request.test.ts` fija el número de cada ruta: si sube o baja, el test lo
dice.

**1. Sin mutex.** `src/lib/db.ts` arma el dialecto con un adaptador que declara
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
lectura de `User` sin esperarla y llama a `next()`. `authorize` corre la regla con el `id` y el `role`
del JWT y espera las dos cosas juntas. Después decide en el orden de hoy: usuario inexistente,
inactivo o con un rol distinto del del token → 401; rol no permitido → 403; veredicto de la regla. Recién
entonces escribe `req.user`. **−1 viaje** en las 91 rutas. La lectura lanzada **nunca rechaza**
(devuelve un resultado): si `paramValidator` corta con 400 antes de `authorize`, nadie la espera, y
una promesa rechazada sin manejar tira el proceso en Node 24. Si una ruta futura usara `authenticate`
sin `authorize`, no tendría `req.user`: falla cerrada, y la `MATRIZ` ya no la deja montar.

**4. Las ramas de `alguna` en paralelo.** Hoy van con `for … await`. Mismo veredicto, sin esperar.

**5. Batch de libSQL para la mutación y su audit.** Un `ejecutarEnLote([...consultas compiladas])` en
`src/lib/db.ts`: compila con Kysely y manda con `client.batch(…, "write")`. Para eso `db.ts` crea el
cliente y se lo pasa al dialecto como `{ client }`. Se usa donde las escrituras no dependen de una
lectura intermedia. **−1 viaje** por mutación, y el audit queda atómico.

**6. Los handlers que releen lo que ya se sabe.** Solo en las rutas que el paso 0 mida por encima de
su presupuesto: lanzar juntas las lecturas que no dependen entre sí (`GET /stages/:id`: `Stage`,
`Evidence`, `Project` y `cabezaDelHilo` en un solo `Promise.all`). El resto lo hace la migración
(`SPEC-604` se disuelve en A3/A4).

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
