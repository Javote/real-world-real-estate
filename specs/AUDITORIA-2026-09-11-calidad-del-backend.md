# Auditoría — Calidad del backend: corrección, atomicidad y mantenibilidad (2026-09-11)

> Revisión transversal de `apps/api` pedida por el dueño, con el mismo encargo que la del frente:
> *"darle un sutil salto de calidad, un pulido, que se note que le prestamos atención a los
> detalles"*, y la pregunta explícita de si el código *"es claro, es mantenible y adaptable, o es
> todo spaghetti del demonio"*. **No propone ningún endpoint, tabla ni superficie nueva** — todo lo
> de acá se resuelve dentro de las 85 rutas que M2-D5 ya fija.
>
> **A diferencia de la del frente, dos hallazgos no son deuda de pulido: son bugs de corrupción de
> datos, reproducidos ejecutándolos** (B-01 y B-02). El resto sí es pulido y no bloquea la entrega
> del Milestone 3 — ninguno de los 15 toca los 16 criterios del SOM.

## Cómo se hizo

Se leyeron **los 51 archivos de `src` completos**, las 6 migraciones y los 3 scripts. Nada se
dedujo de la prosa de `CLAUDE.md` ni de `DECISIONS.md`: los documentos se usaron para entender la
intención, y la afirmación siempre se verificó contra el código (memoria del dueño,
*"verificar contra el código, no contra las decisiones"*).

- **Lo que se pudo ejecutar, se ejecutó.** B-01, B-02 y B-12 no son lectura: se escribieron archivos
  de test descartables en `apps/api/test/`, se corrieron con `vitest`, se copió la salida real a
  este documento y se borraron. El árbol quedó limpio (`git status` sin cambios) antes de escribir
  esta auditoría.
- **Sondas sobre el esquema real**: se comprobó contra `@libsql/client` que SQLite acepta
  `IN ()` — un candidato a bug que quedó descartado y por eso no figura en la lista.
- **Medición de la config de tipos**: se compiló `apps/api/src` con `noUncheckedIndexedAccess`
  prendido en un `tsconfig` temporal y se revisaron los 21 errores uno por uno (B-12).
- **Introspección del documento publicado**: los 70 paths y las 85 operaciones de
  `specs/evidencia-m3/2-api/openapi/propnexus.openapi.json` se contaron sobre el JSON commiteado, no sobre el
  generador. Es lo que destapó B-04.

Baseline al momento de la auditoría, medido en la máquina:

```
pnpm --filter @plataforma/api test        →  41 archivos · 356 tests · 3 skipped · 56.6s
pnpm --filter @plataforma/api typecheck   →  limpio
npx biome check apps/api                  →  103 archivos, sin hallazgos
```

> **Nota de saneamiento:** `specs/README.md` dice **335 tests** de API (corregido en la Tanda 3.5,
> 2026-09-11). Hoy son **356**. El número se mueve con cada rebanada; lo que conviene es que la
> afirmación diga cómo se obtiene, no un número congelado.

---

## Resumen

**No es spaghetti, y no está cerca.** Es de los backends más disciplinados que se pueden leer a
este tamaño. Tres cosas que la mayoría de los proyectos tiene abiertas acá están resueltas, y
resueltas por la razón correcta:

- **La autorización es un dato, no una cadena de llamadas.** `authorize({ roles, acceso })` con los
  dos campos obligatorios convierte una *ausencia* —olvidarse el guard— en una *afirmación* que se
  lee en el diff. Un símbolo no enumerable cuelga la regla del middleware y
  `test/route-guards.test.ts` reconstruye la matriz de las 85 rutas **interrogando al router que
  Express armó de verdad**, no grepeando el fuente.
- **"Qué proyectos puede ver este usuario" tiene una sola definición.** `projectScope` es una
  condición de Kysely, así que la misma regla sirve para un id puntual y para un listado completo,
  con el bypass de `admin` en un solo lugar (D-043).
- **La asimetría registro/prueba se sostiene sin una sola excepción** (D-059). En los tres caminos
  de anclaje el recibo se guarda apenas existe y la confirmación es best-effort: un proceso que
  muere nunca se lleva puesto un TXID real.

**La deuda que queda no es estructural: está en las costuras.** Y la costura principal se resume en
un número: **hay una sola `db.transaction()` en todo `src`**, en un código que encadena escrituras
todo el tiempo. Los dos bugs reproducidos salen de ahí.

| # | Hallazgo | Dónde | Evidencia | Nivel |
|---|---|---|---|---|
| **B-01** | Dos invitaciones sobre la misma unidad le sacan la unidad a quien ya la compró | `investor.routes.ts:441`, `developer-comercial.routes.ts:179` | **reproducido** | 🟢 |
| **B-02** | Una unidad puede terminar con **dos** dossiers; la firma queda en el que no se muestra | `domain/dossier.ts:153` + migración | **reproducido** | 🟡 |
| **B-03** | Una migración que se corta a la mitad deja la base sin forma de volver | `db/migrate.ts:69` | leído | 🟡 |
| **B-04** | El OpenAPI publicado apunta a una URL que no existe (doble `/api/v1`, puerto 3001) | `scripts/generate-openapi.ts:430` | verificado sobre el JSON | 🟢 |
| **B-05** | La FSM del stage se valida sobre un estado que ya puede haber cambiado | `domain/stage-transition.ts:427` | leído | 🟢 |
| **B-06** | El generador de OpenAPI resolvió brillantemente la mitad del problema | `scripts/generate-openapi.ts:153` | leído | 🟡 |
| **B-07** | Se puede liberar más de lo que el contrato dice, y el anclaje lo deja escrito | `developer-comercial.routes.ts:412` | leído | 🟢 |
| **B-08** | El anclaje por commitment está escrito dos veces, y las dos copias ya divergieron | `evidence.routes.ts:229` vs. `domain/anchoring.ts:29` | leído | 🟡 |
| **B-09** | El audit log se escribe con strings sueltos y se filtra con un mapeo cerrado | `utils/audit.ts:4`, `middlewares/auth.ts:auditScope` | leído | 🟢 |
| **B-10** | Cinco columnas dicen `Date` y devuelven `number` | `db/sqlite-type-plugin.ts:30` | declarado en el propio archivo | 🟢 |
| **B-11** | La única ruta pública además del login no tiene límite de tasa | `public.routes.ts:32` | leído | 🟡 |
| **B-12** | `apps/api` es el paquete con la config de tipos más floja de los tres | `apps/api/tsconfig.json:8` | **medido** | 🟢 |
| **B-13** | El aviso a los investors es un N+1 adentro de una subida de archivo | `developer-evidencia.routes.ts:193` | leído | 🟢 |
| **B-14** | Tres rutas de 85 pueden paginar; una filtra en memoria lo que puede filtrar en SQL | `developer.routes.ts:317` | leído | 🟢 |
| **B-15** | Borrar evidencia anclada corta el vínculo y devuelve el error equivocado | `evidence.routes.ts:369` | leído | 🟢 |

---

## B-01 · Dos invitaciones sobre la misma unidad le sacan la unidad a quien ya la compró

**Reproducido.** `POST /developer/projects/:id/invitations` (`developer-comercial.routes.ts:179`)
valida que la unidad pertenezca al proyecto y **no mira `Unit.status`**: se puede emitir una
invitación a B por una unidad que ya está `sold` a A.

Cuando B acepta, `POST /investor/invitations/:id/accept` (`investor.routes.ts:441`) hace cuatro
escrituras **sin transacción**, y la que puede fallar es la última:

```
1. UPDATE Invitation  SET status='accepted'
2. UPDATE Unit        SET status='sold', investorId = B    ← la unidad cambia de dueño
3. INSERT ProjectMember (B, buyer)
4. INSERT Contract                                          ← choca Contract_unitId_key
```

Salida real de la reproducción (dos invitaciones `pending` sobre la misma unidad, aceptadas en
orden):

```
accept A → 201
accept B → 409 {"message":"Resource already exists","code":"RESOURCE_ALREADY_EXISTS"}

Unit.investorId  = B            ← la unidad es de B
Unit.status      = sold
Contratos        = [ 'A' ]      ← el contrato es de A
ProjectMember    = [ 'A', 'B' ] ← B quedó con membresía de lectura
```

**Las consecuencias son las que el producto promete que no pasan:**

- **A pierde su unidad en silencio.** `GET /investor/units` filtra `Unit.investorId = usuario`, así
  que la unidad desaparece de su portfolio; `GET /investor/units/:id` le devuelve **403**, porque el
  guard `{ dueño: { via: "Unit" } }` lee esa misma columna.
- **B se lleva lectura del proyecto.** La membresía `buyer` quedó escrita: stages, evidencia y
  pruebas de Merkle del proyecto entero. Es exactamente el aislamiento cross-rol de
  M2-D1 §Cross-role data isolation.
- **La invitación de B queda `accepted`** sobre una aceptación que falló.
- El cliente recibe un 409 genérico (`RESOURCE_ALREADY_EXISTS`) que no describe nada de esto.

**El arreglo.** Las cuatro escrituras adentro de `db.transaction()` — la forma ya existe y está bien
usada en `POST /developer/projects`, donde el comentario explica por qué proyecto + membresía + las
10 etapas nacen atómicos. Más dos guardas chicas:

- al emitir la invitación, rechazar con 409 si `Unit.status !== "available"`;
- `.where("status", "=", "pending")` en el `UPDATE Invitation` y chequear `numUpdatedRows`, que
  cierra además el doble click concurrente sobre **una sola** invitación — hoy los dos requests
  pasan el `if (invitacion.status !== "pending")` porque leen antes de que el otro escriba.

> El anclaje (`anchorCommitmentEvent`) **tiene que quedar afuera** de la transacción: es una
> transacción de Cardano, no puede ser atómica con la base, y D-059 dice que el registro nunca
> depende de ella. Se ancla después del `commit`, como hoy.

---

## B-02 · Una unidad puede terminar con dos dossiers, y la firma queda en el que no se muestra

**Reproducido.** `compileDossier` (`domain/dossier.ts:153`) hace *leer, y si no está, insertar*
sobre `Dossier`. La tabla tiene `Dossier_unitId_idx` — un índice **común**, no único
(`migrations/0000_init.sql:413`). Dos compilaciones concurrentes de la misma unidad crean dos filas:

```
await Promise.all([compileDossier(u), compileDossier(u)])

ids devueltos : kpccox25uy3h1870bnznmzs5   tnm4xd97fg53ddirthecijtv   (DISTINTOS)
filas Dossier : 2
```

El dossier es justamente la entidad cuyo trabajo es tener **una** identidad estable: el
`shareToken` del link público, el `masterHash` congelado al firmar y el `signedById` del escribano
cuelgan de esa fila, y `OnChainEvent.referenceId` apunta a ese id. Con dos filas,
`executeTakeFirst` elige cualquiera:

- `POST /investor/units/:id/dossier/share` puede escribir el token en una fila y
  `GET /public/dossier/:shareToken` resolver por `unitId` a la otra;
- `POST /notary/dossiers/:id/sign` puede firmar y congelar una fila mientras `compileDossier` sigue
  recompilando la otra, que nunca se entera de que hay una firma — y la regla 17 dice que sin TXID
  el estado es "Pendiente". Acá habría un TXID real apuntando a una fila que la pantalla no lee.

No hace falta concurrencia adversarial para llegar: una pantalla que pide el detalle y el export en
paralelo, un doble click en "Compartir", o un reintento del cliente alcanzan.

**El arreglo.** `CREATE UNIQUE INDEX Dossier_unitId_key ON Dossier (unitId)` más
`onConflict().doNothing()` y releer. Es el mismo argumento que **ya está escrito** en
`middlewares/errorHandler.ts`:

> *"Un chequeo previo por ruta además no cierra la ventana de carrera —dos requests simultáneos
> pasan los dos el `select` y uno choca igual—, así que la restricción de la base es la única
> respuesta verdadera."*

La conclusión ya estaba en la casa; falta aplicarla acá. **Es una migración sobre una base
desplegada** (la segunda desde que Turso está vivo, D-063), así que antes hay que verificar que
producción no tenga ya un duplicado: `SELECT unitId, count(*) FROM Dossier GROUP BY unitId HAVING
count(*) > 1`.

---

## B-03 · Una migración que se corta a la mitad deja la base sin forma de volver

`applyPendingMigrations` (`db/migrate.ts:69`) aplica los statements de cada archivo **uno por uno** y
escribe la fila en `_migrations` recién cuando terminaron todos:

```ts
for (const statement of statements) {
  await client.execute(statement);
}
await client.execute({ sql: "INSERT INTO _migrations …" });
```

`0000_init.sql` tiene **43 statements**. Si el número 20 falla —un corte contra Turso, un timeout,
un deploy que se reinicia— los 19 anteriores ya están aplicados y el archivo sigue figurando como
pendiente. El próximo arranque vuelve a empezar por `CREATE TABLE User` y muere con *table already
exists*. Para siempre, sin intervención manual.

Importa más que en otros repos por dónde corre: el `startCommand` de Render, en un free tier que
**no da shell** (D-040) — que es la razón declarada de media docena de decisiones de este código,
incluida la línea `[arranque] migraciones listas` que existe justamente para distinguir estos dos
casos desde los logs.

El docstring dice *"Idempotente: re-ejecutarla no duplica efectos (regla 8)"*. Lo es **por archivo**,
no por statement, y la diferencia sólo se nota el día que falla.

**El arreglo.** `await client.batch(statements, "write")` — `@libsql/client` lo corre transaccional,
SQLite soporta DDL transaccional, y reemplaza el `for` por una línea. Las migraciones de datos
(0004, 0005) son de un solo statement y ya están cubiertas por sus propias guardas de idempotencia.

---

## B-04 · El OpenAPI publicado apunta a una URL que no existe

`specs/evidencia-m3/2-api/openapi/propnexus.openapi.json` declara:

```json
"servers": [{ "url": "http://localhost:3001/api/v1", "description": "Local (pnpm dev)" }]
```

y sus 70 paths **ya empiezan con `/api/v1`** — salen de `MONTAJE`, donde el prefijo es parte de la
clave. Un cliente generado desde este documento, o el botón *Try it* de cualquier Swagger UI, arma:

```
http://localhost:3001/api/v1/api/v1/auth/login
```

Doble prefijo, y encima el puerto equivocado: la API en dev escucha en **8787**, lo dice
`apps/api/.env.example:14` (*"8787 es el puerto de la API en dev"*) y lo confirma
`apps/web/.env.example:12` (`API_ORIGIN=http://localhost:8787`). El 3001 no aparece en ninguna otra
parte del repo.

Es un renglón, pero es **el renglón que toca primero quien recibe el entregable**, y el entregable
es evidencia del Milestone 3.

El mismo archivo tiene el otro síntoma del mismo problema, que es B-06 ya ocurrido. Su
`info.description` afirma:

> *"Body, query y **~24 respuestas de éxito** son el schema Zod real […] el resto de las respuestas
> **sigue sin schema** (Tanda 2 de `specs/PLAN-2026-09-08-documentar-api-completa.md`)"*

Contadas sobre el JSON commiteado: **76 de las 85 operaciones tienen schema de respuesta 2xx**. Y el
comentario de `RESPONSE_SCHEMAS`, 150 líneas más arriba en el mismo generador, dice que las dos
tandas están **cerradas**. Los dos textos viven en el mismo archivo y se contradicen.

**El arreglo.** `url: "http://localhost:8787"` a secas, reescribir el `description`, regenerar con
`pnpm --filter @plataforma/api docs:openapi` y commitear — `test/openapi-freshness.test.ts` hace el
resto.

---

## B-05 · La FSM del stage se valida sobre un estado que ya puede haber cambiado

`transitionStage` (`domain/stage-transition.ts`) lee el stage, pregunta `canTransition(existing.state,
to)` y escribe:

```ts
const stage = await db
  .updateTable("Stage")
  .set(data)
  .where("id", "=", input.stageId)      // ← sin condición sobre el estado que acaba de leer
  .returningAll()
  .executeTakeFirstOrThrow();
```

Dos `PATCH /stages/:id/state` simultáneos leen los dos `InProgress`, pasan los dos la tabla de
transiciones, y escriben los dos. El índice único `(stageId, eventIndex)` salva el `OnChainEvent`
duplicado —y es la idempotencia que la regla 8 promete— pero el `UPDATE` de `Stage` ya corrió dos
veces, y en el medio hay una llamada a la cadena que dura segundos.

Lo notable es que **la técnica correcta ya está en el repo, en el archivo de al lado**.
`domain/reconcile.ts:150` escribe así:

```ts
.where("id", "=", evento.id)
// Solo si sigue `Pending`: entre la consulta y el update pudo haber pasado
// otra tanda. Sin esto, dos disparos concurrentes se pisan.
.where("status", "=", "Pending")
```

Es la misma pregunta, contestada bien en un lugar y no en el otro.

**El arreglo.** Sumar `.where("state", "=", existing.state)`, cambiar a `executeTakeFirst()` y, si no
hubo fila, devolver el mismo `STAGE_TRANSITION_INVALID` que ya existe. El tipo `TransitionFailure`
no necesita un caso nuevo.

---

## B-06 · El generador de OpenAPI resolvió brillantemente la mitad del problema

La mitad resuelta es de las mejores piezas del repo: `lib/route-inventory.ts` interroga al router
que Express armó de verdad, y **tres consumidores leen de ahí** — `test/route-guards.test.ts`,
`scripts/generate-api-docs.ts` y `scripts/generate-openapi.ts`. Nadie mantiene un mapa de rutas a
mano, y `codigoDeExito` llega a regexear el `res.status(2xx)` real del handler en vez de adivinar
por verbo HTTP.

La mitad que falta es que `REQUEST_SCHEMAS` (línea 153) y `RESPONSE_SCHEMAS` (línea 194) **sí** son
mapas a mano, indexados por string de ruta. El propio archivo lo declara sin vueltas:

> *"`test/openapi-freshness.test.ts` prueba que el JSON commiteado sea el que este archivo
> generaría hoy — **pero no prueba que esta lista esté completa**: si un `safeParse` nuevo no se
> agrega acá, el documento generado simplemente no cambia y el test sigue verde. La única defensa
> real es […] se edita el mismo día que se agrega el `safeParse`."*

B-04 es esa deriva, ya ocurrida, en la única parte del documento que ningún test cubre. Y son
**dos** tablas de ~110 entradas cada una, con el path repetido como string en las dos.

**El arreglo, y por qué esta casa ya sabe cuál es.** Es el mismo problema que `GUARD` resolvió para
la autorización: una propiedad del middleware que deja leer la ruta desde afuera. Un
`contrato({ body, query, respuesta })` que devuelva un middleware marcado con un símbolo pone el
schema **en la firma de la ruta**, al lado de `authorize`, y las dos tablas desaparecen:

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

Es la deuda de diseño más grande de la lista y la que más rinde: hoy son ~220 renglones de tabla que
nadie puede verificar.

---

## B-07 · Se puede liberar más de lo que el contrato dice, y el anclaje lo deja escrito

`releasePaymentSchema` es `z.strictObject({ amountMinorUnits: z.number().int().positive() })` y nada
más. `POST /developer/contracts/:id/releases/:stageNum` valida que la etapa esté `Completed` y que
no haya un release previo para ese `stageNumber`, pero **nada compara la suma de
`PaymentAttestation` contra `Contract.totalMinorUnits`**. Un release de 999.999.999 sobre un
contrato de 100.000 entra, se registra y **se ancla su commitment en Cardano**.

La prueba de que la invariante no se sostiene está del lado de la lectura, en
`capital.routes.ts:107`:

```ts
// No puede ser negativo: liberar más de lo contratado no es un estado
// alcanzable, pero si lo fuera el piso es cero y no un número absurdo.
pendingMinorUnits: Math.max(raised - released, 0),
```

El comentario dice "no es un estado alcanzable" y el código de al lado se defiende de él. Es una
defensa en el lugar equivocado: la plataforma no custodia plata (D-021), pero **sí vende el
registro**, y este registro admite hoy una afirmación falsa, anclada.

**El arreglo.** Sumar lo ya liberado antes de insertar y devolver 409 con
`RELEASE_EXCEEDS_CONTRACT`, con la misma forma que el `STAGE_NOT_CERTIFIED` que la ruta ya tiene
diez líneas arriba. La clave va a `STAGE_TRANSITION_ERRORS`-style en `packages/shared` (regla 15:
claves, no copy).

---

## B-08 · El anclaje por commitment está escrito dos veces, y las dos copias ya divergieron

`POST /evidence/:id/anchor` (`evidence.routes.ts:229`) reimplementa inline lo que
`anchorCommitmentEvent` (`domain/anchoring.ts:29`) hace: leer el `eventIndex` previo, insertar el
evento `Pending`, llamar al puerto, **guardar el recibo apenas existe**, intentar `confirmedAt`,
marcar `Failed` si explota, loguear a Sentry. Unas 60 líneas gemelas.

**Ya divergieron en un campo:** la versión inline **no escribe `referenceId`**. El docstring de la
función buena dice qué se pierde con eso:

> *"La ref queda persistida, no solo enviada al port: es lo único que permite volver del registro
> off-chain a su TXID sin recomputar un commitment que incluye timestamps."*

O sea: una evidencia anclada por `POST /developer/documents` (que sí usa la función) es
reconciliable por `reconciliarParaLectura({ referenceId })`; una anclada por
`POST /evidence/:id/anchor` no. Dos caminos al mismo hecho con distinta capacidad de reconciliación.

Y el recibo de la duplicación está en los comentarios: **los tres sitios llevan la misma nota con la
misma fecha** —*"mismo fix que `anchorEvent`/`anchorCommitmentEvent` (2026-09-10, ver
`specs/REPORTE-2026-09-10-prueba-de-volumen.md`)"*—. El bug que encontró la prueba de volumen hubo
que arreglarlo tres veces. Esa nota repetida es el síntoma, escrito por quien lo arregló.

**El arreglo.** Que la ruta llame a `anchorCommitmentEvent({ …, reference: evidencia.id })`. Un
`DELETE` de ~60 líneas y una columna que se empieza a poblar. `anchorEvent` (el del hilo) **se
queda como está**: `openThread`/`advanceThread` son otra cosa, con `outputRef` y datum, y fundirlo
sería el error inverso.

---

## B-09 · El audit log se escribe con strings sueltos y se filtra con un mapeo cerrado

`writeAuditLog` (`utils/audit.ts:4`) toma `action: string` y `entityType: string`. Del otro lado,
`auditScope` es **fail-closed** y conoce ocho `entityType`: uno que no esté en la lista **no se
muestra nunca**. Y las **29** `action` tienen que estar espejadas a mano en
`apps/web/src/i18n/dictionary.ts` o la UI muestra el literal — que es el bug que cerró la Tanda 2.4.

Hoy las tres listas coinciden. Las verifiqué una por una:

- 9 `entityType` escritos; los 8 que `auditScope` mapea, más `User`, que está afuera **por diseño** y
  documentado.
- Las 29 `action` están todas en el diccionario del front, incluidas las dos que se pasan por
  `auditAction` y no aparecen en un `grep 'action: "'` ingenuo (`STAGE_WORK_INITIATED`,
  `CHANGE_STAGE_STATE`).
- El diccionario tiene además **dos claves muertas**: `CREATE_EVIDENCE` y `CREATE_STAGE`, de las
  rutas borradas el 2026-09-08.

Coinciden porque alguien se acordó, no porque algo lo obligue. Un `entityType` con un typo no falla:
desaparece del audit log del developer, en silencio, que es el modo de falla que `auditScope` eligió
a propósito para lo desconocido.

**El arreglo, y otra vez la casa ya tiene la técnica.** `AUDIT_ACTIONS` y `AUDIT_ENTITY_TYPES` como
uniones en `packages/shared`, `writeAuditLog` tipado contra ellas, y `auditScope` con
`satisfies Record<AuditEntityType, …>` para las que llevan scope. Es exactamente lo que
`middlewares/auth.ts` hace dos veces —`ALL_MEMBERSHIPS` y `TODOS_LOS_ROLES`— con el argumento
escrito al lado:

> *"Ampliar un permiso tiene que ser un acto deliberado; el trabajo de escribir un renglón es
> exactamente el punto."*

Y de paso, el diccionario del front puede tipar sus claves contra la misma unión, que es lo que
volvería **imposible** el drift en vez de prohibido — el mismo argumento que justifica
`packages/shared` entero.

---

## B-10 · Cinco columnas dicen `Date` y devuelven `number`

`compiledAt`, `readAt`, `releasedAt`, `respondedAt` y `signedAt` están declaradas
`SqliteTimestamp` en `db/types.ts` —o sea `Date` al leer— y **no están** en `TIMESTAMP_COLUMNS` del
plugin de coerción. El typechecker afirma una cosa y el runtime entrega otra.

Está declarado, con un `⚠` y un motivo razonable (`db/sqlite-type-plugin.ts:30`): agregarlas cambia
la forma del JSON de la API —`Date` serializa a string ISO, `number` a número— y las cinco ya tienen
consumidores en el front.

Lo que cuesta no es la deuda, es lo que enseñó. Los call sites aprendieron a desconfiar del tipo:

```ts
compiledAt: new Date(fila.compiledAt),                        // domain/dossier.ts:207
function mesUtc(fecha: Date | number): string                 // capital.routes.ts:84
const ms = (fecha: Date | null) => new Date(fecha).getTime(); // developer-comercial.routes.ts:308
```

Cada uno funciona. Juntos instalan la costumbre de envolver toda fecha en `new Date()` por las
dudas, que es exactamente lo que un tipo existe para evitar.

**El arreglo, mientras la rebanada de verdad no llegue: que el tipo diga la verdad.**
`ColumnType<number, Date | number, Date | number>` para esas cinco. No cambia un byte del runtime ni
del JSON, y el compilador pasa a pedir la conversión **donde hace falta** en vez de dejar que cada
call site la haga por las dudas. Cuando la rebanada llegue, se suman al plugin y el tipo vuelve a
`Date` en el mismo commit.

---

## B-11 · La única ruta pública además del login no tiene límite de tasa

`GET /public/dossier/:shareToken` (`public.routes.ts:32`) no está detrás de ningún limiter, y cada
hit corre `compileDossier`: cuatro queries, **una escritura** si el `masterHash` cambió y, si el
dossier está firmado, una consulta a Blockfrost vía `reconciliarParaLectura`.

El token es de 256 bits, así que enumerar no es el riesgo. El riesgo es que un link compartido es,
por diseño, público: quien lo tiene puede repetirlo, y cada repetición produce escrituras y consumo
de cuota de un proveedor externo desde tráfico sin sesión.

`middlewares/rateLimit.ts` ya razona esto para `/login` —y lo razona bien, incluida la decisión de
limitar por IP y no por email— pero la conclusión no llegó a la otra ruta sin sesión. El detalle que
lo hace incómodo: **es un `GET` que escribe**, cosa que está justificada (M2-D5 §3 pide compilación
on-demand) pero que cambia el cálculo.

**El arreglo.** Un `rateLimit` por IP montado en ese router, con el mismo shape de error
(`{ message }`) que `loginRateLimiter`. La pieza ya está escrita y parametrizada por env.

---

## B-12 · `apps/api` es el paquete con la config de tipos más floja de los tres

`packages/shared` y `packages/cardano` tienen `noUncheckedIndexedAccess: true` y
`exactOptionalPropertyTypes: true`. `apps/api` —el paquete más grande, y el que tiene la
autorización— tiene sólo `strict: true`.

**Medido, no estimado.** Prender `noUncheckedIndexedAccess` sobre `src` da **21 errores en 10
archivos**, y los revisé uno por uno:

| Archivo | Errores | Qué son |
|---|---|---|
| `routes/projects.routes.ts` | 7 | 4 del destructuring de `bbox` (el regex de Zod ya garantiza los 4 números), 3 de `req.params.id` |
| `routes/audit.routes.ts` | 3 | indexación del array de la mediana |
| `middlewares/errorHandler.ts` | 3 | `CONSTRAINT_ERRORS[restriccion]`, ya protegido por el `in` de `codigoDeRestriccion` |
| resto (7 archivos) | 8 | `req.params.x` tipado `string \| string[] \| undefined` en Express 5 |

**Ninguno es un bug latente.** La mayoría es el `string | string[]` de los params de Express 5 — el
mismo problema que `auth.ts` trata con cuidado quirúrgico en `leerParam`, con un comentario de ocho
líneas sobre por qué elegir el primero en silencio sería el peor bug posible en la capa de
autorización. Esa disciplina está en el guard y no llegó a los handlers, que hacen
`req.params.id` directo o se lo declaran con `Request<{ id: string }>` a mano, ruta por ruta.

**El arreglo.** Subir las dos flags y arreglar los 21. Es trabajo mecánico de una tarde, y deja a
los tres paquetes TypeScript bajo la misma vara — que es lo que uno esperaría que fuera cierto ya,
leyendo el resto del repo.

---

## B-13 · El aviso a los investors es un N+1 adentro de una subida de archivo

`developer-evidencia.routes.ts:186` consulta las unidades del proyecto con
`.where("investorId", "is not", null)` y selecciona **sólo `id`**. Después, línea 193:

```ts
for (const unidad of unidades) {
  await notifyUnitInvestor({ unitId: unidad.id, … });   // vuelve a SELECT Unit.investorId
}
```

`notifyUnitInvestor` re-consulta `Unit.investorId` — el dato que la query de arriba ya tenía y
descartó — y después inserta. Dos queries por unidad, **secuenciales**, adentro de la request que el
frontend está esperando para abrir el `AnchoringSuccessModal`, que M2-D5 §2.2 obliga a resolver en
la misma respuesta. Un proyecto de 50 unidades vendidas son 100 round-trips.

**El arreglo.** Seleccionar `investorId` en la primera query y llamar a `notify` directo, con un
`insertInto("Notification").values([...])` múltiple. Una query en total.

---

## B-14 · Tres rutas de 85 pueden paginar

Sólo los audit logs y dos listados con cursor aceptan `limit`. `GET /projects`,
`GET /developer/documents`, `GET /investor/units`, `GET /developer/progress` y `GET /users`
devuelven todo lo que haya.

**Con 3 proyectos y 30 stages es irrelevante, y el repo tiene razón en no construir infraestructura
para problemas que todavía no duelen** — es la misma decisión del cron revertido, y está bien
tomada. Se anota por un detalle puntual que sí se puede arreglar hoy sin decidir nada sobre
paginación: `GET /developer/documents` (`developer.routes.ts:317`) trae **toda** la evidencia de
**todos** los proyectos del developer y después filtra por estado de anclaje **en memoria**:

```ts
const filtrados = parsed.data.status === "anchored"
  ? documentos.filter((d) => d.txid !== null)
  : parsed.data.status === "pending" ? documentos.filter((d) => d.txid === null) : documentos;
```

Ese filtro es un `where` sobre `OnChainEvent.txid`. La lista ya viene de un `leftJoin`.

---

## B-15 · Borrar evidencia anclada corta el vínculo y devuelve el error equivocado

`DELETE /evidence/:id` (`evidence.routes.ts:369`, admin-only) borra el archivo del storage y la fila,
**sin preguntar si esa evidencia tiene anclaje**. La FK hace `ON DELETE set null` sobre
`OnChainEvent.evidenceId`: el TXID sobrevive en la cadena y en la tabla, y el vínculo con el archivo
que probaba desaparece. Queda un evento `EVIDENCE_ANCHOR` que ancló el hash de nada.

Y si la evidencia está adentro de un `EvidenceBundle`, `EvidenceBundleItem` tiene la FK con
`ON DELETE no action`: el borrado corta con `SQLITE_CONSTRAINT_FOREIGNKEY`, que `errorHandler`
traduce a **400 "A referenced resource does not exist"** — un mensaje que describe el problema
inverso al real. El cliente lee "el recurso referenciado no existe" cuando lo que pasa es que el
recurso está referenciado.

**El arreglo.** 409 explícito con `EVIDENCE_ANCHORED` antes de intentar el borrado. Es la regla 3
aplicada al otro extremo del ciclo: si el hash es el ticket de entrada a la cadena de prueba, borrar
la fila de atrás tiene que costar más que un `DELETE`.

---

## Lo que NO hay que tocar

| Qué | Por qué |
|---|---|
| **`authorize` y la matriz de `route-guards.test.ts`** | Es la mejor pieza del repo. Convierte una ausencia en una afirmación y verifica contra el router real, no contra el texto del fuente. Cualquier "simplificación" que vuelva a middlewares sueltos reabre los dos agujeros de septiembre |
| **Las cuatro rutas del notario en `"soloRol"`** | Parece un olvido y **está documentado que no lo es**: el notario no tiene membresía por proyecto, la cola de dossiers pendientes es compartida, y el comentario dice qué pasaría a ser (`{ dueño: … }`) el día que un dossier se asigne. Es la partición de D-088 funcionando: el caso raro está visible y explicado |
| **El login de tiempo constante** | El `HASH_DUMMY` por proceso, los tres rechazos en un solo `if` después del `compare`, y el limiter que existe **porque** cerrar el oráculo hizo caro el spray. Los tres razonamientos están escritos y son correctos |
| **`EVIDENCE_SAFE_COLUMNS`** | Una allowlist en un solo lugar, después de un incidente real. Es la dirección correcta de la lista: una columna nueva no se filtra sola |
| **Que no haya cron ni `setInterval`** | D-003 · D-040 · D-077. El disparo por lectura es una decisión, no una carencia, y la invariante ("toda lectura que devuelva estado de anclaje reconcilia su alcance primero") tiene su propio test |
| **`statusDeError` reusando `CONSTRAINT_ERRORS`** | Importar el mapeo en vez de copiarlo es la lección correcta de un bug que otro repo habría arreglado duplicando la tabla |
| **La suite: una base y un `UPLOAD_DIR` por archivo** | 41 archivos en paralelo en 57s, con la plantilla sembrada una vez. Y los umbrales de coverage como trinquete sobre el piso medido, en vez de un número aspiracional que deja el CI rojo por deuda conocida |

---

## Una observación de forma — el 26 % de comentarios

Es el rasgo más distintivo de este código y no es ni un defecto ni un adorno, así que va aparte de
la lista.

Una de cada cuatro líneas de `src` es prosa: **2.265 de 8.420**. En `middlewares/auth.ts` son 331 de
670 — el **49 %**; en `domain/reconcile.ts`, el 46 %.

Y casi toda es buena, porque no explica *qué* hace el código sino **qué se rompió el día que no
estaba así**. El comentario de `ALL_MEMBERSHIPS` vale más que el `satisfies` que documenta: el
`satisfies` alguien lo puede borrar en un refactor, el argumento de por qué existe no.

El costo también es real: para cambiar cinco líneas de `auth.ts` hay que leer trescientas, y varias
secciones repiten lo que ya dicen `DECISIONS.md` o `apps/api/CLAUDE.md` — que tiene **88 KB**. No
propongo podar; la historia de decisiones es el activo del proyecto. Sí propongo una regla para lo
que venga:

> **El comentario justifica; el documento narra.** Si un bloque cuenta una sesión de depuración con
> fechas, incidentes y nombres de archivo, va a `specs/` y el código lo cita en dos líneas.

Es la misma economía que ya aplicó el 2026-09-10 al mover el historial del `CLAUDE.md` raíz a
`specs/archive/`.

---

## Orden sugerido

Ordenado por daño evitado sobre línea tocada, no por severidad nominal. **Nada de esto bloquea el
Milestone 3** — los 15 hallazgos son de calidad interna y ninguno toca los 16 criterios del SOM.

1. **B-01 y B-02** — la transacción en `accept` y el índice único en `Dossier.unitId`. Son los dos
   únicos que **corrompen datos en silencio**, y repararlos después es SQL a mano contra producción,
   como ya pasó con las migraciones 0004 y 0005. Valen antes de mainnet. ~medio día.
2. **B-03** — `client.batch` en el runner de migraciones. Una línea, y el modo de falla que evita
   deja la API abajo sin shell para diagnosticar. ~1 hora.
3. **B-04** — `servers` y el `description` del OpenAPI. Es lo primero que toca quien recibe el
   entregable. ~15 minutos.
4. **B-05 y B-07** — la condición optimista en la FSM y el techo del release. Dos invariantes que hoy
   sostiene la buena fe del cliente. ~2 horas.
5. **B-08 y B-09** — unificar el anclaje por commitment y tipar el audit log. Los dos **borran**
   código y cierran caminos de divergencia futura. ~medio día.
6. **B-12, B-13, B-15, B-10, B-11, B-14** — el pulido. Ninguno duele todavía; B-12 es el que más
   rinde por hora porque sube la vara de los tres paquetes a la vez.
7. **B-06** — `contrato()` en la firma de la ruta. La deuda de diseño más grande y la que más rinde
   a futuro. Merece su propia sesión y probablemente su propio `SPEC`, como F-13 del frente.

---

## Anexo — dos cosas que aparecieron en el camino

No son parte del alcance; se anotan porque se toparon leyendo.

- **`EvidenceBundle` no tiene índice único por `stageId`, y producción ya tuvo 4 bundles en un
  stage.** Lo dice el propio comentario de `crearBundle`: *"el stage 'Terminaciones' de `torre-a`
  quedó con 3 evidencias, **4 bundles y 3 roots distintos**"*. La idempotencia por contenido que se
  agregó impide bundles **nuevos** duplicados, pero las filas viejas siguen ahí y **tres queries las
  unen con `leftJoin`**: `certifier.routes.ts:225`, `investor.routes.ts:189` y —la que el comentario
  no menciona— `domain/dossier.ts:59`. En el dossier eso duplica artefactos de tipo `stage`, que
  cambia el `masterHash` y el `completeness`. Vale un `SELECT stageId, count(*) FROM EvidenceBundle
  GROUP BY stageId HAVING count(*) > 1` contra producción antes de decidir si es un hallazgo o una
  fila vieja aislada.
- **La telemetría del criterio 9 mide `updatedAt - createdAt`** (`audit.routes.ts:58`). Hoy es
  correcto —una vez `Confirmed`, la fila sale del `where` de la reconciliación y nadie la vuelve a
  tocar— pero `updatedAt` no promete significar "cuándo confirmó": lo promete `blockTimestamp`, que
  ya se puebla en el mismo `set`. El comentario de la ruta declara con honestidad que la métrica
  incluye "lo que tardó alguien en volver a leer"; si alguna vez se quiere la latencia de cadena
  pura, la columna correcta ya está.
