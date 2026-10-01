# AUDITORIA-2026-10-01 — Arquitectura de `apps/api` y `apps/web`, y el plan de migración

> **Origen:** pedido del dueño el 2026-10-01: revisar las specs abiertas y lo postergado, auditar el
> frente y el backend con el objetivo de una arquitectura con menos slop, contestar *qué todavía no
> estamos viendo* y, después de charlarlo, dejar escrito cómo serían la API y la web ideales y cómo
> se llega. Leí el código y no las decisiones. Cada bug de §1 lo reproduje con un test descartable
> (borrado después; el árbol quedó limpio) o lo leí en el código de la dependencia.
>
> **Nada de esto toca los 16 criterios del SOM ni frena la entrega de M3.**

## Veredicto

1. **El código no es slop de copiar y pegar.** `jscpd` mide **0,57 %** de duplicación (210 de 36.800
   líneas). Los tipos están bien, el contrato Zod existe y la matriz de permisos se audita desde un
   test.
2. **El slop es de forma.** En la API **no hay capa de casos de uso**: cada handler mezcla HTTP,
   reglas, SQL, la cadena, el audit y la notificación, sin límite de transacción. En la web **el
   router se usa como un mapa de URL a componente**: cada pantalla resuelve sola la sesión, los datos,
   la carga y los errores. En los dos, **el código lleva su historia en comentarios** (30–54 % de las
   líneas, 746 referencias a `D-`/`SPEC-`, 153 fechas).
3. **Hay tres clases de bug, no bugs sueltos** (§1). Las auditorías del 2026-09-11 arreglaron casos
   (`SPEC-201`, `SPEC-202`, `SPEC-206`); la clase sigue.
4. **Zod y oRPC están instalados pero no son la columna vertebral**: 95 procedimientos aislados, cada
   uno con su handler, su ruta de Express y su path escrito dos veces (§2.1).
5. **Los dos lados se pueden rearmar sin tirar lo bueno.** Sobreviven `packages/shared`,
   `packages/cardano`, `contracts/`, el esquema, los componentes de dominio de la web y un arnés de
   tests de caja negra que ya existe (§7). El rewrite es, en la práctica, **reescribir los routers de
   la API y los 44 archivos de ruta de la web**.

## Decisiones del dueño (2026-10-01)

| Qué | Decisión |
|---|---|
| Los 79 `v8 ignore` | **quedan**: cada uno se discutió en `SPEC-018`/`SPEC-019` |
| Comentarios | **se borra la mayoría, y todo comentario con fecha**: el código más las specs ya documentan |
| El plan | **dos fases**: emprolijar la app como está (specs abiertas, postergadas y bugs de §1), y después migrar `apps/api` y `apps/web` (§9) |
| Piloto de la migración | **`dossier`** (§8) |
| Dossier rechazado | **vuelve a `compiled` cuando su `masterHash` cambia** (el developer agregó lo que faltaba), y **`sign` solo acepta `compiled`** (§8, punto 2) |
| Effect-ts | **no, por ahora** (§2.4) |
| SSR, BFF como servicio aparte, login estático | **no** (§3.4) |

---

## 1. Tres clases de bug que ninguna auditoría nombró como clase

### 1.1 "Leo, decido y escribo" alrededor de una llamada a la cadena ✅ reproducido

`POST /notary/dossiers/:id/sign` lee el dossier, chequea `status === "signed"`, compila
(`compileDossier`: varios viajes a la base), hace `UPDATE … WHERE id = ?` **sin condición sobre el
estado** y ancla. Nada impide que una segunda request haga lo mismo en el medio.

**Reproducción** (test descartable, `compileDossier` con 300 ms de latencia agregada, lo que cuestan
unos pocos viajes a Turso a ~100 ms medidos):

```
dos POST /sign simultáneos → status [201, 201]
OnChainEvent DOSSIER_SIGNATURE: 2, commitments distintos (d0d4a49db9…, 9e5350e3c0…), 2 TXID
AuditLog: SIGN_DOSSIER ×2 · Notification "dossier firmado" ×2
```

Sin latencia (SQLite local) no se reproduce. **El daño es permanente:** dos anclajes con `signedAt`
distintos, y la fila guarda solo el segundo, así que el primer commitment anclado **ya no se puede
recomputar desde el registro**. Rompe la regla dura 8.

**Mismo patrón:** `POST /evidence/:id/anchor` y `POST /developer/documents/:id/anchor` chequean
`txid IS NOT NULL` y después anclan; un evento en vuelo no tiene txid, y la ventana dura lo que tarda
Blockfrost en construir y enviar (segundos). `rejectDossier` tiene la misma forma.

**El contraste:** `transitionStage` hace un compare-and-set (`UPDATE Stage … WHERE state = <el
leído>`) y devuelve 409 si pierde. El repo ya conoce la solución y la aplica en un solo lugar.

**La regla: reclamá antes de anclar.** Una escritura condicional gana el derecho a anclar
(`UPDATE … WHERE status = 'compiled' RETURNING`, o el `INSERT` del `OnChainEvent` contra un índice
único parcial `(referenceId, eventType) WHERE status <> 'Failed'`). Quien no gana devuelve lo que ya
existe. Se escribe una vez, en el helper de anclaje.

### 1.2 La confirmación del bloque se espera adentro de la request, sin timeout ✅ leído en Lucid

`anchorEvent` (`domain/stage-transition.ts:362`) llama a `anchorPort().verify(txid)`, que en el
adaptador real empieza con `lucid.awaitTx(txid)`. En `@lucid-evolution/provider` (Blockfrost):

```js
awaitTx(txHash, checkInterval = 3e3) {
  return new Promise((res) => {
    const confirmation = setInterval(async () => { /* GET /txs/{hash}/cbor */ … }, checkInterval);
  });
}
```

**Polling cada 3 s, sin timeout, hasta que la tx entra en un bloque** (~20 s de promedio en Preprod).
Si la tx se cae del mempool, la promesa no resuelve nunca.

- **Crear un proyecto son 10 mints en serie, y cada uno espera su bloque.** Es la causa de los ~6
  minutos que `CLAUDE.md` raíz lista como *"La espera al crear un proyecto — sin diseño"*.
- **Cada transición y cada certificación espera un bloque.**
- **Una tx caída cuelga la request para siempre**, y como `writeAuditLog` va después, la transición
  queda hecha **sin su audit**.

`anchorCommitmentEvent` ya usa `confirmedAt` (un GET con timeout de 10 s) y deja que la
reconciliación por lectura confirme (D-077). **El hilo es el único que espera.** Sacar la espera no
necesita el outbox de `SPEC-605` y no contradice D-077: lo aplica. M2-D5 §2.2 pide el TXID en la
respuesta, y el TXID existe desde el `submit`.

**Antes de tocarlo (🟡, `packages/cardano`):** medir con `test:yaci` que la vista local del adaptador
(`caducarVistaLocal`, `enCola`) encadena una transición sobre una salida sin confirmar. Si no, el
`awaitTx` está pagando un orden que nadie escribió.

### 1.3 El audit log no es atómico con lo que audita

`writeAuditLog` y `notify` usan el `db` global y **no pueden entrar en una transacción**. De 24
handlers que escriben dos cosas o más, 3 abren transacción, y en ninguno el audit queda adentro. Si
el proceso muere (Render lo duerme a los 15 minutos) o el insert falla, la mutación queda sin
registro. La regla dura 7 se cumple solo en el camino feliz.

**Arreglo:** `audit(trx, …)` y `notify(trx, …)` reciben el ejecutor. Mutación, audit, notificación y
reclamo del anclaje entran en la misma transacción; la cadena va después del commit (D-059).

---

## 2. `apps/api`

### 2.1 Cómo está hoy

| | |
|---|---|
| Routers | 20 archivos, el más grande de **855 líneas** (`investor.routes.ts`: 14 endpoints, 42 llamadas a la base, 6 conceptos) |
| Casos de uso | 7 archivos en `domain/`; **casi todo vive en el handler** |
| Acceso a datos | ~300 llamadas a Kysely en los routers, **7 transacciones** en total |
| Declaración | **cada endpoint dos veces**: ruta de Express con `authorize` + procedimiento oRPC con su path. **92 `OpenAPIHandler`**, uno por procedimiento, y ningún router único |
| Pipeline | autenticación y autorización en Express; oRPC recibe solo `{ user }`. `authorize` lee la entidad para saber su proyecto y el handler la vuelve a leer |
| Zod | **42 de 95 inputs y 32 de 94 outputs** inline en la API, no en `shared`. **0 tipos con marca** (`unitId` y `stageId` son el mismo `string`). 30 `.parse()` manuales que el `.output()` ya hace. El entorno sin schema |
| Errores | 59 `new ORPCError(...)` sin declarar contra 31 `.errors()`. Tres formas llegan al cliente: `{message}` (Express), `{code,status,message,defined}` (oRPC), `TransitionFailure` (dominio). En `shared` no hay `ErrorCode` |
| Módulos | **CommonJS** con paquetes ESM puros: `require()` + `resolution-mode` en `orpc.ts`, `libsql-client.ts`, `libsql-dialect.ts`, `kysely.ts`. Causa tres trampas documentadas |
| Configuración | `process.env` leído en 8 archivos, cada uno con su parseo |
| Esquema | tres fuentes (SQL, `db/types.ts` a mano, Zod). **Ningún enum tiene `CHECK`**, y no hay test de drift entre el SQL y `types.ts` |

`SPEC-607` (guards como `meta`) y `608` (archivos por concepto) no alcanzan: parten los routers en
archivos chicos que siguen mezclando todo. El problema no es el largo: **no hay un lugar donde viva
el límite de la transacción**.

### 2.2 La API ideal

**oRPC contract-first como columna vertebral:**

1. **El contrato vive en `shared`, una vez por endpoint:** `oc.route({ method, path })`, `.input`,
   `.output`, `.errors` y `.meta({ roles, acceso })`. La API hace `implement(contract)`; la web arma
   su cliente desde el mismo contrato. Hoy cada endpoint se escribe tres veces (path de Express, path
   de oRPC, función de `port.ts`).
2. **Un router, un handler**, montado en `/api/v1`. Los paths REST de M2-D5 no cambian. Express queda
   como carcasa de transporte (helmet, CORS, rate limit, Multer, Sentry).
3. **Middlewares de oRPC**: `base.use(authenticate).use(requireRole).use(loadProject)`. Cada uno
   agrega al contexto; `loadProject` deja la entidad y su proyecto en `context`, y se terminan las
   lecturas dobles. La matriz sale de la `meta` y `route-guards.test.ts` la sigue leyendo (`SPEC-607`
   ya lo probó).
4. **El contexto es la inyección de dependencias**: `{ db, anchor, storage, clock, config }`. Un test
   llama `call(proc, input, { context })` sin supertest ni `vi.mock`.
5. **Errores declarados en el contrato.** El cliente recibe una unión tipada.

**Zod en serio:** IDs con marca (`ProjectId`, `StageId`, `DossierId`…), `Sha256Hex` y `TxId` con
forma (`SPEC-402`), el entorno parseado una vez al arrancar, y todo input/output en `shared`.

**Núcleo funcional, cáscara imperativa.** Las reglas son funciones puras (datos que entran, decisión
que sale); la cáscara hace el I/O. El modelo ya existe en el repo: `canTransition` y la FSM en
`shared`, puras, testeadas sin base y espejadas en Aiken.

| Incumbencia | Dónde vive |
|---|---|
| Forma, errores posibles, quién puede llamar | contrato en `shared` |
| Autenticación, rol, membresía | middleware de oRPC, leído de la `meta` |
| Reglas del negocio | funciones puras (`puedeFirmar`, `commitmentDeFirma`, la FSM) |
| Orquestación: transacción, reclamo, audit, notificación, cadena | el caso de uso |
| SQL | `queries`, reciben un ejecutor (`db` o `trx`) |
| Cadena, storage, reloj, config | `platform`, entran por contexto |
| HTTP: de `Result` a error tipado | el router, una línea |

```
apps/api/src/
  http/        carcasa Express
  modules/
    dossier/   router.ts · sign.ts, reject.ts, share.ts (casos de uso) · rules.ts (puro) · queries.ts
    stage/  evidence/  invitation/  unit/  payment/  project/  notification/  audit/  user/
  platform/    db.ts  anchor.ts  storage.ts  config.ts  audit.ts  notify.ts
```

**Cuatro reglas que Biome puede hacer cumplir (`noRestrictedImports`):** un router no importa `db`;
un caso de uso no importa Express ni oRPC; toda mutación es una transacción con su audit, y lo que
toca la cadena reclama antes y ancla después del commit; los errores de dominio son un `Result` con
un `ErrorCode` de `shared`.

### 2.3 Cómo se ve un caso de uso

```ts
// modules/dossier/sign.ts
export async function firmarDossier(deps: Deps, input: { dossierId: DossierId; notaryId: UserId }) {
  const firma = await deps.db.transaction().execute(async (trx) => {
    const dossier = await q.dossierPorId(trx, input.dossierId);
    if (!dossier) return err("DOSSIER_NOT_FOUND");
    if (dossier.status === "signed") return ok({ yaFirmado: true, dossier });
    if (!puedeFirmar(dossier)) return err("DOSSIER_NOT_SIGNABLE");

    const compilado = compilar(await q.insumosDelDossier(trx, dossier.unitId));
    const ahora = deps.clock.now();
    const gano = await q.marcarFirmado(trx, dossier.id, { desde: dossier.status, ahora, notaryId: input.notaryId, masterHash: compilado.masterHash });
    if (!gano) return err("DOSSIER_CHANGED");

    const evento = await q.anclajePendiente(trx, { referencia: dossier.id, commitment: commitmentDeFirma(compilado, ahora) });
    await audit(trx, { action: "SIGN_DOSSIER", entityId: dossier.id, actor: input.notaryId });
    await notificar(trx, { unitId: dossier.unitId, key: "notifications.dossier.signed" });
    return ok({ yaFirmado: false, dossier, evento });
  });
  if (firma.ok && !firma.value.yaFirmado) await anclar(deps, firma.value.evento); // después del commit, sin esperar el bloque
  return firma;
}

// modules/dossier/router.ts
export const sign = impl.notary.signDossier.handler(async ({ input, context, errors }) =>
  aRespuesta(await firmarDossier(context.deps, { dossierId: input.id, notaryId: context.user.id }), errors));
```

Las tres clases de §1 quedan cerradas por la forma, no por disciplina.

**Una consecuencia:** el audit se escribe antes de que exista el TXID, así que la pantalla de audit
deja de leerlo de `AuditLog.metadata.txid` y lo busca en el `OnChainEvent` de la misma referencia.
Ese join ya existe para las transiciones viejas (`conTxidDeLaTransicion`, `apps/api/CLAUDE.md`
2026-10-01); pasa a ser el único camino.

### 2.4 Effect-ts: no, por ahora

**A favor:** errores en la firma, `Layer` como inyección de dependencias, timeouts y reintentos de
primera, y ya está en el árbol (`effect@3.22`, dependencia de Lucid). El `awaitTx` sin timeout es
justo lo que Effect vuelve difícil de olvidar.

**En contra, y pesa más acá:** contagia (cada función que toca un Effect se vuelve Effect); empuja
hacia Effect Schema y el contrato es Zod, compartido con la web; el desarrollo lo hace mayormente un
LLM, que escribe Effect peor que TypeScript plano, sobre código que el dueño revisa línea por línea.
Y **el 80 % del valor se consigue sin Effect**: `Result<T, ErrorCode>`, dependencias por parámetro,
`AbortSignal.timeout` y un `withRetry` de diez líneas. Con Effect encima del código de hoy habría el
mismo espagueti, tipado.

**La puerta que queda abierta:** si después de la migración la orquestación de la cadena (reclamar,
commitear, enviar, confirmar, reintentar) sigue siendo lo que duele, ese módulo es el candidato: es
el único con timeouts, reintentos y cola, y ya habla el idioma de Lucid.

### 2.5 Transversal

- **ESM** (`"type": "module"`, `module: nodenext`): se van los cuatro shims y sus tres trampas.
  Antes que el contrato, porque oRPC es ESM puro.
- **`platform/config.ts`**: el entorno con Zod, parseado al arrancar; `render-config.test.ts` compara
  contra ese schema.
- **`CHECK` en los enums** (migración aditiva, D-063) y `kysely-codegen`, o un test que compare
  `PRAGMA table_info` con `types.ts`.
- **Notary sin scope de proyecto** y **`/notary/dossiers/pending` con N+1**: ver §8.

---

## 3. `apps/web`

### 3.1 Cómo está hoy: el flash blanco y el resto

**El flash, leído en el código.** Tres cosas que se suman:

1. **40 pantallas hacen `if (!ready) return null`** hasta que vuelve un `GET /auth/me` fuera de React
   Query (`useRoleGuard`). Cada navegación renderiza nada durante un viaje navegador → API → Turso
   (~0,3–0,4 s en caliente).
2. **No hay rutas de layout.** `__root.tsx` es `<Outlet />`. Cada pantalla monta su `PanelLayout`, así
   que **el header se desmonta en cada click**, y cuando la pantalla devuelve `null` desaparece todo.
3. **Recién con `ready` arrancan las queries** (63 `enabled: ready`): chunk → `/auth/me` → datos, en
   cascada, en cada cambio de ruta.

`SPEC-601` ve 1 y 3; le falta 2: sus layouts renderizan solo `<Outlet />`.

**El resto:**

- **La caché tiene llaves por rol, no por entidad.** 59 `queryKey` escritas a mano; las mutaciones
  invalidan `['developer']`, `['certifier']`, `['notary']`. Cambiar una etapa en `developer.progress`
  deja vieja `['developer','project',id]`. Hoy no se nota porque `staleTime` es 0; `SPEC-602` lo sube
  a ~30 s y su inv. 3 supone que las invalidaciones ya son correctas. No lo son.
- **Las pantallas son orquestadores de red.** El detalle de unidad del investor hace 7 queries en dos
  olas (la segunda espera el `projectId` de la primera). `unicosPorStageId` deduplica un join que
  `SPEC-213` ya arregló en la API.
- **Cada pantalla interpreta el `ApiError` sola** (`status === 403`, `body as Record<…>`), y los
  mensajes de error vuelven en inglés.
- **El JS inicial** (build de hoy, gzip):

  | Chunk | gz | |
  |---|---|---|
  | `vendor-observability` (Sentry + PostHog) | **91,6 kB** | más que React. Precargado, y se carga **aunque no haya DSN** |
  | `vendor-react` | 59,6 kB | |
  | `vendor-tanstack` | 37,7 kB | |
  | `LanguageToggle` (el diccionario) | 26,4 kB | **los dos idiomas siempre** |

  **~40 % del JS inicial es observabilidad.** Arreglo: `import()` diferido y solo si hay DSN; un
  diccionario por idioma, bajo demanda.

### 3.2 La web ideal con TanStack Router

**El árbol de rutas es la arquitectura**: decide quién entra, qué datos se piden, qué se muestra
mientras cargan y qué pasa si fallan.

1. **Un layout por rol que no se desmonta**: `beforeLoad` valida la sesión (`me` cacheado en el
   contexto del router) y el layout renderiza header y navegación con el `<Outlet />` adentro. Cada
   pantalla pasa título y `back` por el contexto de la ruta o por `staticData`.
2. **Los datos arrancan con la navegación**: un `loader` por ruta con `ensureQueryData`/
   `prefetchQuery`. Con `defaultPreload: 'intent'` (ya activo) bajan con el hover, antes del click.
   El componente lee con `useSuspenseQuery`: sin `enabled`, sin `data?.`, sin `!`.
3. **Tres estados por ruta, declarados una vez**: `pendingComponent` (adentro del armazón, con
   `pendingMs` ~150 ms), `errorComponent` y `notFoundComponent` (el loader hace `throw notFound()`).
4. **Llaves de caché desde una fábrica por entidad** (`dossierQueries.detail(id)`), usadas por loader,
   componente e invalidación. Una mutación invalida la entidad que tocó.
5. **El estado de la URL en la URL**: `validateSearch` con Zod para filtros, pestañas y paginación.
6. **Cliente tipado desde el contrato** (`OpenAPILink`, con `port.ts` como fachada para no tirar los
   324 `spyOn` de los tests) y una sola `claveDeError(err) → TranslationKey`.
7. **El archivo de ruta solo compone**: loader + componentes de dominio.

### 3.3 Qué tan lejos estamos

| | Hoy | Ideal |
|---|---|---|
| Rutas por archivo, code splitting, React Query | ✅ | ✅ |
| Un solo `fetch`, tipos desde `shared`, claves i18n tipadas, test IDs | ✅ | ✅ |
| Componentes de dominio | ✅ sirven tal cual | ✅ |
| Layouts por rol | 0 | 6, con armazón |
| `loader` / `beforeLoad` | **0 / 0** | en todas las rutas |
| Guard | 40 `useRoleGuard` + `return null` | 6 `beforeLoad` |
| `useSuspenseQuery` / `errorComponent` / `notFound()` | **0 / 0 / 0** | la norma |
| Llaves de caché | 59 a mano, invalidación por rol | fábrica por entidad |
| `validateSearch` | 5 rutas | toda ruta con estado de URL |

El front son ~15.500 líneas: **7.700 en archivos de ruta y 7.800 en componentes, lib, i18n y api.**
Migrar es reescribir los 44 archivos de ruta (que deberían bajar a la mitad: hoy cargan guard,
`enabled`, chequeos de `undefined` y manejo de errores repetidos 40 veces) y dejar casi intacta la
otra mitad. **Es recablear, no tirar.**

### 3.4 Lo que no conviene

- **SSR: no.** Ya se tuvo y se sacó (D-065). Todo está detrás de un login con datos por usuario: no
  hay SEO que ganar. La sesión es Bearer hacia otro origen; SSR pide cookies y CORS con credenciales.
  Un servidor Node en el plan free se duerme (el arranque en frío de la API es de ~95 s), y hoy la web
  es estática en el CDN y nunca duerme. La lentitud que se siente es la cascada de §3.1, no el primer
  HTML.
- **Login estático: casi no gana nada.** `index.html` ya sale estático del CDN; lo que tarda es el JS
  inicial, y la mitad del problema es la observabilidad. Achicar el bundle da más que prerenderizar.
- **Prerender que sí aporta, cuando haga falta:** el **dossier público**, para que el link tenga
  preview al compartirlo (los crawlers no corren JS). Un HTML con meta OG que después carga la SPA;
  no justifica TanStack Start.
- **BFF como servicio aparte: no.** Es otro deploy que se duerme, y la API ya es un BFF de hecho
  (paths por rol y por pantalla, M2-D5). **Endpoints de pantalla en la misma API: sí, solo donde hay
  cascada dependiente** (una pantalla que necesita un dato para saber qué más pedir). Si las queries
  son independientes, los loaders las disparan en paralelo.
- **Lo que más baja la latencia no es nada de lo anterior:** `SPEC-603` (API en Oregon, Turso en
  us-east, ~100 ms por viaje), los 3–4 viajes en serie por request (`authenticate` relee el usuario,
  `authorize` relee la entidad) y el `me` cacheado en el front.

---

## 4. Comentarios

| Archivo | Líneas | Comentario |
|---|---|---|
| `apps/api/src/app.ts` | 197 | **54 %** |
| `apps/api/src/middlewares/auth.ts` | 709 | 49 % |
| `packages/cardano/src/real.ts` | 684 | 47 % |
| `apps/api/src/domain/stage-transition.ts` | 562 | 36 % |
| `apps/api/src` · `shared` · `cardano` · `web` | | 30 % · 41 % · 45 % · 15 % |

Una parte grande es historia (*"D-050 ya nos costó una tarde"*, *"hasta el 2026-09-30 era solo
`e.defined`"*) que ya vive en `git log`, `DECISIONS.md` y las specs, y que en el código envejece.

**Decisión: se borra la mayoría, y todo comentario con fecha.** Queda un comentario solo cuando, sin
él, el código parece un error y alguien lo "arreglaría".

- **Tamaño:** ~10.700 líneas (api 3.573 · web 2.717 · shared 1.019 · cardano 1.014 · contracts 280 ·
  tests de api 1.774 · e2e 327); ~960 citan una fecha o un `D-`/`SPEC-`.
- **Se quedan las directivas:** los 79 `v8 ignore … @preserve` (se acorta el texto, no la directiva),
  3 `@ts-expect-error`, 1 `biome-ignore`, 3 `nosemgrep`.
- **Ningún script lee comentarios:** el OpenAPI sale de los schemas (verificado en
  `scripts/generate-openapi.ts` y `generate-api-docs.ts`).
- **Orden:** `packages/` y `contracts/` primero (sobreviven seguro), después `apps/`. En `cardano` y
  `auth.ts` (🟡) se revisa que el diff sea solo comentarios.

## 5. Tests

Los `v8 ignore` quedan. Lo que importa para migrar es **qué tests sobreviven a un cambio de forma**:

- **56 de los 112 archivos de test de la API pegan contra HTTP con supertest, sin mocks**: prueban el
  contrato y corren igual contra una API nueva con los mismos paths. Otros 13 usan supertest con algún
  spy; 7 mockean módulos de `src`.
- **26 archivos `*-coverage.test.ts`** llevan el nombre del lote de cobertura que los creó, no del
  comportamiento que protegen. Al migrar un módulo, los suyos se reescriben o se funden en el test de
  HTTP del módulo.
- **La vara para el código nuevo:** tests de los casos de uso con dependencias falsas y de las reglas
  como funciones puras, y mutation testing (Stryker) sobre esa capa, la misma vara que el validador
  tiene con `rechazos-mutantes.mjs`.

## 6. Documentación

28.500 líneas de `.md` fuera de `docs/`, 101 specs, `DECISIONS.md` de 1.401 líneas,
`apps/api/CLAUDE.md` de 1.225. El estado está repetido y ya se contradice:

- `specs/README.md` criterio 4: **"⬜ externo"**; `CLAUDE.md` raíz: cerrado el 2026-09-22.
- `ESTADO-2026-09-22-catalyst-milestone-4.md`: *"faltan 3.12, 3.14, 3.15"*; las tres cerraron.

**Regla:** el estado vive en una sola tabla (`specs/README.md`) y los demás documentos la enlazan.
Las specs cerradas pasan a `archive/`. Cada `CLAUDE.md` queda con las trampas vigentes, una línea cada
una, y la narración va al commit que la arregló.

---

## 7. Lo que sobrevive a la migración

- **`packages/shared`**: schemas, FSM (D-020), Merkle, datum. Con el contrato oRPC adentro es la
  especificación ejecutable de los dos lados.
- **`packages/cardano` y `contracts/`**, con sus tests y mutantes.
- **El esquema y las migraciones** (datos en Turso, 180 eventos en Preprod que apuntan a esas filas).
- **Los componentes de dominio de la web y el diccionario.**
- **El arnés:** los 56 archivos de test de HTTP sin mocks, las **11 specs de Playwright con 66 test
  IDs** de M2-D5 y `route-guards.test.ts` (la matriz de permisos como dato).

---

## 8. El piloto: `dossier`

**Por qué este:** es chico (9 endpoints, 6 pantallas), cruza tres roles (notary, investor, público),
toca la cadena, y tiene el bug confirmado de §1.1. Si la forma de §2 y §3 funciona acá, funciona en el
resto.

### La superficie

| Lado | Qué |
|---|---|
| API | `notary.routes.ts`: `GET /kpis`, `GET /dossiers/pending`, `GET /dossiers/{id}`, `POST /dossiers/{id}/sign`, `POST /dossiers/{id}/reject`, `GET /signatures` · `investor.routes.ts`: `GET /units/{id}/dossier`, `GET …/dossier/export.pdf`, `POST …/dossier/share` · `public.routes.ts`: `GET /dossier/{shareToken}` · `domain/dossier.ts` (`compileDossier`, `masterHashOf`) |
| Web | `notary.index`, `notary.dossiers`, `notary.signed`, `notary.dossier.$dossierId`, `investor.unit.$unitId.dossier`, `public.dossier.$shareToken` · `PendingDossiersQueue`, `ShareDossierModal` |
| Arnés | `dossier.test.ts` (396 líneas, supertest), `dossier-unico-por-unidad`, `spec-211-limite-dossier-publico`, `orpc-client-notary`, `orpc-client-public`, `notary-coverage`, `dossier-recompile-coverage` · e2e `notary-certifier.spec.ts`, `investor-surface.spec.ts`, `walkthrough.spec.ts` |

### Lo que encontré al mirarlo de cerca

1. **La carrera de la firma** (§1.1), y la misma forma en `reject`.
2. **El dossier no tiene FSM, y `rejected` es un estado sin salida.** Los estados son `compiled`,
   `signed` y `rejected` (`shared/dossier.ts`), pero no hay tabla de transiciones como la de la
   etapa. Leído en el código: **nada devuelve un dossier `rejected` a `compiled`**, y la cola del
   escribano filtra por `compiled`. Un dossier rechazado no vuelve a la cola aunque el developer
   corrija lo que faltaba. Y **`sign` acepta un dossier `rejected`** si se entra por URL (solo chequea
   `signed`).

   **Decidido (dueño, 2026-10-01):** `compiled → signed`, `compiled → rejected` y
   `rejected → compiled` cuando el `masterHash` actual difiere del que se rechazó. `signed` es
   terminal, y **`sign` y `reject` solo parten de `compiled`**. Se escribe como `DOSSIER_TRANSITIONS`
   en `shared`, igual que la FSM de la etapa. La `rejectionNote` se conserva hasta la firma (como hoy)
   y el rechazo queda en el audit log.

   - **En la Fase 1** (bug de hoy): `sign` exige `compiled`, y la recompilación de `compileDossier`
     que ya actualiza el `masterHash` cuando cambia pasa también el estado a `compiled`. **Límite:**
     el cambio se detecta en la próxima compilación (cuando el investor o el escribano abren el
     dossier), no en el momento en que el developer sube lo que faltaba.
   - **En la migración:** la cola calcula los hashes vigentes en lote (una pasada, sin N+1, punto 4),
     así que un dossier rechazado con cambios aparece en la cola sin que nadie lo abra.
3. **Los GET escriben.** `compileDossier` inserta o actualiza `Dossier` (`masterHash`, `compiledAt`)
   y reconcilia contra Blockfrost, y lo llaman `GET /investor/units/{id}/dossier`,
   `GET /notary/dossiers/{id}` y la cola. Una lectura con efectos, que además paga la cadena.
4. **N+1 en la cola:** `GET /notary/dossiers/pending` llama a `compileDossier` (4–6 queries) por fila,
   hasta 50. A ~100 ms por viaje, la cola puede tardar segundos.
5. **`GET /notary/kpis` lee toda la tabla `Dossier` y filtra en JS.**
6. **El notary no tiene scope de proyecto** (`acceso: "soloRol"`): ve y firma cualquier dossier. Con un
   escribano da igual; con los pilotos de M4 (dos developers, datos reales) hay que decidirlo.
7. **La pantalla del investor hace tres requests en cascada** (unidad → proyecto, más el dossier) para
   mostrar las etapas y la fecha de entrega, cuando el dossier ya trae proyecto y unidad. Es el caso
   para un endpoint de pantalla.
8. **El clon más grande del repo** (57 líneas) está entre la vista del dossier del investor y la del
   notary.

### El diseño

- **`shared`:** `DOSSIER_TRANSITIONS` (la FSM del punto 2), el contrato de los 9
  endpoints con `meta` y errores (`DOSSIER_NOT_FOUND`, `DOSSIER_NOT_SIGNABLE`, `DOSSIER_CHANGED`,
  `DOSSIER_SIGNED`), y `DossierId` con marca.
- **`modules/dossier/rules.ts` (puro):** `artefactosDe(insumos)`, `completitud(artefactos)`,
  `masterHashDe(artefactos)`, `commitmentDeFirma(...)`, `puedeFirmar(dossier)`. Hoy todo eso está
  mezclado con las queries en `compileDossier`.
- **`modules/dossier/queries.ts`:** los insumos del dossier en una sola pasada (y en lote para la
  cola, sin N+1), con un ejecutor.
- **Casos de uso:** `firmar`, `rechazar`, `compartir`, `exportar`. **Decisión a tomar:** cuándo se
  persiste la compilación. La propuesta: la fila `Dossier` nace cuando la unidad tiene investor
  (aceptar la invitación), **los GET calculan en memoria y no escriben**, y el `masterHash` se fija
  al firmar, que es el único momento en que importa.
- **Web:** layout `notary` con armazón; `dossierQueries` en la fábrica; loaders y `useSuspenseQuery`
  en las 6 pantallas; la del investor contra un endpoint que devuelva lo que la captura necesita; la
  vista del dossier como un componente compartido.

### Cuándo está terminado

- Los tests de HTTP del arnés pasan **sin cambios**, salvo los que fijan el ciclo del rechazo, que
  cambia a propósito en la Fase 1 (punto 2).
- El test de concurrencia de §1.1 es permanente y pasa.
- `modules/dossier/router.ts` no importa `db`; los GET no escriben.
- Las 6 pantallas no tienen `useRoleGuard`, `enabled` ni `return null`.
- Cero comentarios con fecha en lo migrado.

**Criterio de salida del rewrite:** si el piloto muestra que el arnés no alcanza para migrar sin
miedo, o que la forma no simplifica (el módulo no queda claramente más chico y más legible que lo que
reemplaza), se frena acá y se vuelve a la vía incremental de la serie `6xx`.

---

## 9. El plan

**Dónde está la migración:** es la Fase 2 de abajo (pasos A0–A5 y W0–W5). **No es una spec
todavía**, y no tiene nada que ver con `501`–`504`, que son las features de Milestone 4. Antes de A0
se escribe como spec (ver el final de la Fase 2).

### Fase 1: emprolijar la app como está, en este orden (dueño, 2026-10-01)

| # | Qué | Sobrevive a la migración | Nivel |
|---|---|---|---|
| 1 | ✅ §1.1 **reclamar antes de anclar** (firma, rechazo y los dos anclajes de evidencia), con el test de concurrencia permanente — `test/reclamar-antes-de-anclar.test.ts`; la evidencia reclama con un `INSERT` condicional en `anclarEvidenciaUnaVez`, sin migración, y un `Pending` sin TXID de más de 10 minutos no bloquea el reintento | la regla sí | 🟡 |
| 2 | ✅ §8 punto 2 **el ciclo del dossier rechazado**: `sign` y `reject` solo desde `compiled` (409 `DOSSIER_NOT_SIGNABLE` / `DOSSIER_NOT_REJECTABLE`), la recompilación devuelve el rechazado a `compiled` cuando cambia su `masterHash`, y la pantalla del escribano muestra las acciones solo en `compiled` | la regla sí (va a `shared`) | 🟢 |
| 3 | ✅ §1.2 **sacar `awaitTx` de la request**: `anchorEvent` confirma con `confirmedAt` (un GET con timeout) en vez de `verify`, y D-077 termina de confirmar en la lectura. Medido antes con `test:yaci` ("encadena sin esperar el bloque": 5 mints y un hilo de punta a punta, 7 transacciones sin esperar ningún bloque). **Límite:** la vista local vive en memoria, así que una instancia recién arrancada que transiciona un hilo cuya transacción anterior todavía no entró en un bloque (~20 s) ve la salida como inexistente y el evento queda `Failed`, reintentable | **sí** | 🟡 |
| 4 | **La pasada de prosa:** §4 borrar los comentarios (`packages/` → `contracts/` → `apps/`), y §6 el estado en una sola tabla, lo cerrado a `archive/` y los `CLAUDE.md` recortados a trampas vigentes. **§4 hecho en `packages/` y `apps/`** (7.800 comentarios, AST idéntico verificado archivo por archivo, ~40 repuestos de una línea); **`contracts/` espera a la aceptación de M3**, porque `aiken-coverage-report.md` cita 69 líneas de los `.ak`. §6 sin empezar | packages sí | 🟢/🟡 |
| 5 | §3.1 **W0**: observabilidad diferida y un diccionario por idioma, y decidir si PostHog sigue después de M3 (hoy está solo para web vitals, que Sentry también mide) | **sí** | 🟢 |
| 6 | `SPEC-603` misma región | **sí** | 🟡 |
| 7 | §3.1 **W1** = `SPEC-601` con armazón en el layout: **se va el flash** | **sí**: es el primer paso de la migración de la web | 🟡 |
| 8 | `SPEC-402` hashes y TXID con forma (adelantada; es parte de A1), `SPEC-407`, `SPEC-408` | **sí** | 🟢/🟡 |
| 9 | `SPEC-222` PWA (la rama `spec-222-pwa`, un commit, se rebasea) y la pasada manual de `SPEC-112`, las dos después de 5 y 7 | **sí** | 🟡 |

**La pasada de prosa se prueba mecánicamente:** cada archivo impreso con el compilador de TypeScript
y `removeComments`, antes y después, tiene que dar idéntico. Así un diff de miles de líneas en
archivos 🟡/🔴 no necesita revisión línea por línea. Las directivas las protege el pipeline: un
`v8 ignore` borrado baja la cobertura, un `biome-ignore` lo agarra el lint, un `@ts-expect-error` el
typecheck, un `nosemgrep` Semgrep en CI.

### Cada spec abierta, en el plan

| Spec | Dónde queda |
|---|---|
| `601` | Fase 1, ítem 7 (= W1) |
| `602` | se disuelve en W2/W3: los loaders llegan con la fábrica de queries |
| `603` | Fase 1, ítem 6 |
| `604` | se disuelve en A3/A4: los `queries.ts` de cada módulo |
| `605` | condicional, para mainnet: su motivo principal lo resuelve el ítem 3 |
| `606` | condicional; W1 la abarata, porque la sesión pasa a vivir en el contexto del router |
| `607` | A2, con la D-NNN que reemplaza la invariante 3 de `SPEC-212` |
| `608` | A3/A4 |
| `609` | W2 |
| `402` · `407` · `408` | Fase 1, ítem 8 |
| `304` · `305` | antes de mainnet, intactas: la migración no toca `contracts/` |
| `222` · `112` | Fase 1, ítem 9 |
| `501`–`504` (M4) | **después de A0–A2**, para que nazcan como módulos y no haya que migrarlas. El scope del notary (§8 punto 6) se decide antes de los pilotos |
| *Certify* que solo abre la etapa · chip *Evidence by stage* | W4, al migrar la pantalla del certifier y la del investor |

### Fase 2: la migración, módulo por módulo detrás de los mismos paths

**El principio:** en ningún momento hay dos apps a medias. Cada commit deja la API y la web
funcionando, con `pnpm verify:all` en verde y el arnés de §7 sin tocar. Lo nuevo convive con lo viejo
porque `delegarAOrpc` ya hace `next()` cuando no matchea: el router nuevo atiende lo que conoce y
deja pasar el resto a las rutas de Express.

**API**

| Paso | Qué | Notas |
|---|---|---|
| A0 | ESM y `platform/config.ts` | sin cambio de comportamiento; destraba oRPC sin shims |
| A1 | En `shared`: `ErrorCode`, IDs con marca, `Result`; en `platform/`: `audit(trx)`, `notify(trx)` y el helper de anclaje con reclamo | la infraestructura que usan todos los módulos |
| A2 | El router oRPC raíz con la cadena de middlewares y la `meta`, montado antes de las rutas viejas; `route-guards.test.ts` lee las dos fuentes durante la convivencia | sale de lo que `SPEC-607` ya probó |
| A3 | **Piloto `dossier`** (§8): contrato, reglas puras, queries, casos de uso, router. Se borran sus rutas de Express | criterio de salida en §8 |
| A4 | El resto, de lo más simple a lo más acoplado a la cadena: `notification` → `profile`/`user`/`auth` → `unit`/`invitation`/`contract`/`payment` → `evidence` → `stage` → `project` → `audit` | un módulo por commit (o por serie corta de commits) |
| A5 | Se borran `MONTAJE`, `GUARD`, `authorize` de Express, `delegarAOrpc`, `route-inventory`; se activan las reglas de Biome | la API queda con una sola forma |

**Web**

| Paso | Qué | Notas |
|---|---|---|
| W0 | Observabilidad diferida y diccionario por idioma | es el ítem 5 de la Fase 1 |
| W1 | `__root` con contexto (`queryClient`, sesión), 6 layouts con armazón y `beforeLoad` | es el ítem 7 de la Fase 1 (`SPEC-601` extendida) |
| W2 | La fábrica de queries por entidad y el cliente desde el contrato detrás de `port.ts` | depende de A2: el contrato tiene que existir |
| W3 | **Piloto `notary` + pantallas del dossier**, en la misma ventana que A3: loaders, `useSuspenseQuery`, `pending`/`error`/`notFound`, `validateSearch` | |
| W4 | El resto, por rol: `certifier` → `investor` → `developer` → `admin`; endpoints de pantalla donde haya cascada (detalle de unidad del investor primero) | |
| W5 | Se borran `useRoleGuard`, las llaves escritas a mano y `unicosPorStageId` | |

**El acople entre los dos lados:** W0 y W1 no esperan a nadie. W2 espera a A2. A3 y W3 van juntos,
porque el piloto es de punta a punta. A4 y W4 avanzan en paralelo, módulo con su rol. **Las features
de M4 (`501`–`504`) entran después de A2**, en la forma nueva, en paralelo con A4/W4.

**Lo que no se hace:** SSR, un BFF como servicio aparte, Effect-ts, cambiar Express por otro
framework, `RPCLink` (manda a `/rpc/...` y rompe los paths de M2-D5).

**Antes de A0 hay que escribirlo como spec**, con el detalle de A0–A2 y del piloto, y con una
D-NNN que reemplace la invariante 3 de `SPEC-212` (guards en Express) y la objeción de `SPEC-111` al
cliente oRPC.

---

## Lo que no medí

- **El flash blanco, en el navegador.** La causa está en el código; falta grabar la navegación buyer
  `/investor/buy` → `/investor/units` → `/investor/favorites` contra producción antes y después.
- **El tiempo real de crear un proyecto**, con y sin la espera del bloque. La cuenta (10 × un bloque)
  cuadra con los ~6 minutos estimados, pero no está cronometrada.
- **La carrera de §1.1 contra Turso de verdad.** La reproduje en local con latencia inyectada; no la
  voy a disparar contra Preprod, porque deja dos anclajes permanentes.
- **El ciclo del dossier rechazado (§8, punto 2) en el navegador.** El estado sin salida está leído en
  el código, no recorrido por la UI.
- **Cómo maneja oRPC los archivos grandes.** Si puede reemplazar a Multer con streaming a disco
  (`SPEC-218`) no lo verifiqué; Multer puede quedarse en la carcasa.
