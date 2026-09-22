# SPEC-018 — Cobertura de `apps/api`: branches ≥95%, el resto ≥98%

> Nace el 2026-09-22 de partir [`SPEC-017`](SPEC-017-cobertura-95-en-toda-la-app.md), que quedó
> demasiado grande para leerla antes de cada tanda. SPEC-017 cerró con la API en **96,26% de
> líneas** (el criterio 2 del SOM, cumplido); esta spec persigue la vara más estricta que el dueño
> pidió después: **branches ≥95%, y statements, functions y lines ≥98%**. El historial de cómo se
> llegó hasta acá (tandas 1-3, los scripts de arranque, las rutas ya agotadas) vive en SPEC-017 y no
> se repite.
>
> Nivel 🟢 (tests). El paso 0 toca código de producción de las 17 rutas (🟡, revisión línea por
> línea). Su gemela para el front es [`SPEC-019`](SPEC-019-cobertura-de-apps-web.md).

## Dónde está hoy

Medido el 2026-09-22 contra `main` más el test de este commit (`vitest run --coverage`, 625 tests +
1 nuevo):

| Métrica | Hoy | Vara | Falta |
|---|---|---|---|
| Statements | **91,65%** (2.176/2.374) | ≥98% | ~151 |
| Branches | **81,81%** (918/1.122) | ≥95% | ~148 |
| Functions | **96,89%** (499/515) | ≥98% | 6 |
| Lines | **97,45%** (2.030/2.083) | ≥98% | 12 |

Lines y functions están a un puñado de tests. **Statements y branches no se pueden cerrar con
tests solos: el techo está en el código, no en la suite.** Eso es lo que decide el paso 0.

## El hallazgo: el techo de branches con el código de hoy es ~88%

Las **204 branches sin cubrir** se separan en tres grupos, contados línea por línea contra
`coverage-final.json`:

| Grupo | Branches | Qué son | ¿Un test lo cierra? |
|---|---|---|---|
| **`if (!matched) next()`** | **89** | El mismo wrapper de 3 líneas copiado en cada ruta montada sobre oRPC (17 archivos). `matched` es siempre `true`: Express ya matcheó el mismo path antes de delegar. **Cada copia también deja 1 statement sin cubrir** (el `next()`), así que pesa lo mismo en statements | ❌ No — inalcanzable por HTTP |
| **Documentadas inalcanzables** | **42** | 404 que `authorize()` ya resolvió en el middleware (`evaluarProyecto`/`evaluarDueño`), `??` sobre columnas `NOT NULL`, FK que impiden la fila huérfana, y los dos guardias `require.main === module` de `migrate.ts`/`seed.ts`. Cada una ya tiene su razón escrita en SPEC-017 o en `vitest.config.mts` | ❌ No — por construcción |
| **Candidatas** | **73** | Ramas que nadie leyó todavía con la pregunta "¿`authorize` ya lo resuelve?". Casi todas alcanzables; alguna va a pasar al grupo de arriba al leerla | ✅ Sí |

Con el código como está, el máximo es (918 + 73) / 1.122 = **88,3% de branches**, y statements topa
en ~93%. **El 95% de branches no existe sin cambiar el denominador.**

## Paso 0 — decisión del dueño (bloquea la vara, no bloquea los lotes)

**Opción 1 — un helper para el wrapper oRPC (recomendada).** Las 89 copias de

```ts
async (req, res, next) => {
  const { matched } = await handler.handle(req, res, { prefix: PREFIJO_ABSOLUTO, context: … });
  if (!matched) next();
}
```

pasan a ser `delegarAOrpc(handler, PREFIJO_ABSOLUTO, { conUsuario })` en `routes/_shared.ts`, con un
unit test que le pasa un handler falso con `matched: false` y verifica que llama a `next()`. **Es una
deduplicación real** (89 copias de lo mismo, dos formas: con y sin `context.user`), no un truco de
medición: la rama existe una vez y se prueba una vez. El denominador baja a ~946 branches, y con eso:

- **branches:** techo ~95,6% si se cierran las 73 candidatas; **el 95% pide 68 de las 73** — posible,
  pero sin margen.
- **statements:** ~95,0% sin escribir ningún test más; el 98% pide ~65 de las ~62 alcanzables que
  quedan — **no llega** sin la opción 2.

**Opción 2 — además, `/* v8 ignore next */` con el motivo en la misma línea** para las 42
documentadas. Mueve la justificación de `vitest.config.mts` (donde hoy es un párrafo largo que nadie
cruza con el código) a la línea exacta. Con 1 + 2: branches al 95% pide ~28 de las 73 candidatas, y
statements al 98% pide ~19. **Es la única combinación en la que la vara que se pidió es alcanzable
con margen.** Ojo con §Qué no se hace de SPEC-017: prohibía excluir **archivos** para llegar al
número; ignorar una **línea** con su razón al lado es otra cosa, pero es decisión del dueño, no de
quien escribe el test.

**Opción 3 — aceptar el techo** y fijar la vara de branches en lo que dé (~88%), documentado.

**Quien haga el paso 0 no tiene que esperar a los lotes, ni los lotes a él** (ver §Paralelismo): el
paso 0 toca `src/routes/*`, los lotes solo escriben en `test/`.

## Los lotes — archivo por archivo

Columnas: las cuatro métricas de v8; **sin cubrir** = branches sin cubrir; **`matched`** = de esas,
cuántas son el wrapper del paso 0; **doc.** = documentadas inalcanzables; **cand.** = candidatas, el
trabajo real; **lote** = quién lo toma (`—` = nada que hacer con tests: todo lo que queda es
`matched` o documentado).

Solo los archivos que no están al 100% en las cuatro métricas (38 de 54).

| Archivo | Statements | Branches | Functions | Lines | Sin cubrir | `matched` | Doc. | Cand. | Lote |
|---|---|---|---|---|---|---|---|---|---|
| `routes/investor.routes.ts` | 87,6% (163/186) | 65,3% (47/72) | 100,0% (37/37) | 100,0% (157/157) | 25 | 14 | 11 | **0** | — |
| `routes/developer-comercial.routes.ts` | 88,2% (120/136) | 71,0% (44/62) | 96,6% (28/29) | 94,8% (110/116) | 18 | 7 | 2 | **9** | A1 |
| `routes/projects.routes.ts` | 91,9% (181/197) | 79,5% (66/83) | 97,9% (47/48) | 99,4% (169/170) | 17 | 12 | 5 | **0** | — |
| `routes/developer.routes.ts` | 91,9% (125/136) | 76,7% (46/60) | 100,0% (33/33) | 99,2% (120/121) | 14 | 8 | 6 | **0** | — |
| `routes/evidence.routes.ts` | 88,4% (114/129) | 75,9% (41/54) | 95,0% (19/20) | 98,2% (111/113) | 13 | 8 | 3 | **2** | A2 |
| `routes/notary.routes.ts` | 91,0% (91/100) | 72,1% (31/43) | 94,7% (18/19) | 98,9% (86/87) | 12 | 6 | 6 | **0** | — |
| `routes/certifier.routes.ts` | 90,3% (102/113) | 75,0% (33/44) | 100,0% (27/27) | 100,0% (98/98) | 11 | 8 | 3 | **0** | — |
| `middlewares/auth.ts` | 95,8% (114/119) | 92,6% (88/95) | 100,0% (25/25) | 98,1% (102/104) | 7 | 0 | 0 | **7** | A4 |
| `routes/capital.routes.ts` | 86,9% (86/99) | 70,8% (17/24) | 86,7% (26/30) | 92,8% (77/83) | 7 | 4 | 0 | **3** | A3 |
| `routes/developer-evidencia.routes.ts` | 94,2% (113/120) | 87,0% (47/54) | 94,7% (18/19) | 97,1% (102/105) | 7 | 0 | 0 | **7** | A2 |
| `domain/reconcile.ts` | 87,3% (48/55) | 82,9% (29/35) | 100,0% (6/6) | 93,0% (40/43) | 6 | 0 | 0 | **6** | A5 |
| `domain/stage-transition.ts` | 96,3% (78/81) | 90,6% (58/64) | 100,0% (14/14) | 100,0% (74/74) | 6 | 0 | 0 | **6** | A5 |
| `routes/stages.routes.ts` | 88,5% (46/52) | 78,6% (22/28) | 100,0% (6/6) | 97,9% (46/47) | 6 | 3 | 0 | **3** | A5 |
| `db/migrate.ts` | 90,7% (39/43) | 70,6% (12/17) | 91,7% (11/12) | 90,0% (36/40) | 5 | 0 | 1 | **4** | A6 |
| `routes/users.routes.ts` | 90,9% (60/66) | 75,0% (15/20) | 92,3% (12/13) | 98,2% (55/56) | 5 | 5 | 0 | **0** | — |
| `routes/projects-obra.routes.ts` | 91,8% (45/49) | 75,0% (12/16) | 100,0% (10/10) | 97,7% (43/44) | 4 | 3 | 1 | **0** | — |
| `domain/notify.ts` | 76,9% (10/13) | 75,0% (9/12) | 100,0% (4/4) | 81,8% (9/11) | 3 | 0 | 0 | **3** | A5 |
| `lib/anchor.ts` | 96,8% (30/31) | 85,0% (17/20) | 100,0% (12/12) | 96,8% (30/31) | 3 | 0 | 0 | **3** | A6 |
| `lib/storage.ts` | 98,1% (53/54) | 87,0% (20/23) | 100,0% (18/18) | 100,0% (48/48) | 3 | 0 | 0 | **3** | A6 |
| `routes/_shared.ts` | 90,0% (18/20) | 70,0% (7/10) | 100,0% (6/6) | 94,1% (16/17) | 3 | 0 | 1 | **2** | A5 |
| `routes/audit.routes.ts` | 94,7% (36/38) | 81,3% (13/16) | 100,0% (6/6) | 100,0% (33/33) | 3 | 2 | 0 | **1** | A5 |
| `routes/auth.routes.ts` | 89,3% (25/28) | 75,0% (9/12) | 100,0% (4/4) | 96,2% (25/26) | 3 | 2 | 0 | **1** | A4 |
| `routes/profile.routes.ts` | 91,2% (31/34) | 62,5% (5/8) | 100,0% (6/6) | 100,0% (31/31) | 3 | 3 | 0 | **0** | — |
| `domain/dossier.ts` | 93,9% (31/33) | 90,9% (20/22) | 100,0% (11/11) | 96,7% (29/30) | 2 | 0 | 0 | **2** | A5 |
| `domain/project-aggregates.ts` | 95,5% (21/22) | 87,5% (14/16) | 100,0% (9/9) | 100,0% (14/14) | 2 | 0 | 0 | **2** | A5 |
| `lib/route-inventory.ts` | 100,0% (55/55) | 95,0% (38/40) | 100,0% (12/12) | 100,0% (48/48) | 2 | 0 | 0 | **2** | A6 |
| `middlewares/errorHandler.ts` | 83,3% (20/24) | 90,0% (18/20) | 100,0% (3/3) | 81,0% (17/21) | 2 | 0 | 0 | **2** | A4 |
| `routes/contracts.routes.ts` | 88,9% (16/18) | 50,0% (2/4) | 100,0% (3/3) | 100,0% (16/16) | 2 | 1 | 1 | **0** | — |
| `routes/notifications.routes.ts` | 92,3% (24/26) | 75,0% (6/8) | 100,0% (5/5) | 100,0% (23/23) | 2 | 2 | 0 | **0** | — |
| `routes/public.routes.ts` | 88,2% (15/17) | 66,7% (4/6) | 100,0% (2/2) | 100,0% (14/14) | 2 | 1 | 1 | **0** | — |
| `instrumentation.ts` | 96,0% (24/25) | 87,5% (7/8) | 80,0% (4/5) | 100,0% (24/24) | 1 | 0 | 0 | **1** | A6 |
| `db/fixtures.ts` | 97,1% (34/35) | 94,4% (17/18) | 100,0% (14/14) | 100,0% (34/34) | 1 | 0 | 0 | **1** | A6 |
| `db/local-db.ts` | 87,5% (7/8) | 75,0% (3/4) | 100,0% (1/1) | 100,0% (6/6) | 1 | 0 | 0 | **1** | A6 |
| `db/seed.ts` | 81,8% (18/22) | 75,0% (3/4) | 66,7% (4/6) | 80,0% (16/20) | 1 | 0 | 1 | **0** | — |
| `middlewares/rateLimit.ts` | 100,0% (11/11) | 96,0% (24/25) | 100,0% (5/5) | 100,0% (11/11) | 1 | 0 | 0 | **1** | A4 |
| `utils/audit.ts` | 100,0% (1/1) | 75,0% (3/4) | 100,0% (1/1) | 100,0% (1/1) | 1 | 0 | 0 | **1** | A6 |
| `app.ts` | 81,3% (26/32) | 100,0% (8/8) | 60,0% (3/5) | 80,6% (25/31) | 0 | 0 | 0 | **0** | A6 |
| `domain/anchoring.ts` | 94,1% (16/17) | 100,0% (10/10) | 100,0% (2/2) | 94,1% (16/17) | 0 | 0 | 0 | **0** | A5 |

**Sumas:** 89 `matched` + 42 documentadas + 73 candidatas = 204. Las candidatas por lote:

| Lote | Archivos | Cand. | Además | Notas |
|---|---|---|---|---|
| **A1** | `routes/developer-comercial.routes.ts` | 9 | 1 función | El archivo más grande que queda. Sus 2 ramas de bajo valor ya están documentadas (el desempate de `contractsOfProjectProcedure` y un `catch` defensivo) |
| **A2** | `routes/developer-evidencia.routes.ts`, `routes/evidence.routes.ts` | 9 | 2 funciones | `evidence.routes.ts` tiene 2 que SPEC-017 contaba como `matched` y el grep dice que no: releer |
| **A3** | `routes/capital.routes.ts` | 3 | **4 funciones**, ~9 statements | Los callbacks (`.reduce`/`.sort`) que nunca corrieron porque ningún test armó un proyecto con contratos **y** liberaciones reales. Es el único archivo donde falta un handler entero, no solo una rama |
| **A4** | `middlewares/auth.ts`, `middlewares/errorHandler.ts`, `middlewares/rateLimit.ts`, `routes/auth.routes.ts` | 11 | 4 statements de `errorHandler` | `auth.ts` es 🟡 (permisos): los tests no cambian nada, pero conviene que quien lo tome lea `evaluarProyecto`/`evaluarDueño` entero antes |
| **A5** | `domain/*` (reconcile, stage-transition, notify, dossier, project-aggregates, anchoring), `routes/stages.routes.ts`, `routes/audit.routes.ts`, `routes/_shared.ts` | 25 | — | Funciones puras o casi: el lote más mecánico. `_shared.ts` tiene el `?? 0` de `avancePorProyecto`, ya documentado |
| **A6** | `lib/*` (anchor, storage, route-inventory), `db/*` (migrate, fixtures, local-db), `instrumentation.ts`, `utils/audit.ts`, `app.ts` | 16 | 4 funciones (2 de `app.ts`) y 6 statements de `app.ts` | `app.ts`: `GET /health` (con su `try/catch` contra la base) y el 404 del final — dos tests y el archivo queda en 100% |

**Los archivos con `—` ya están en su techo real.** `investor`, `developer`, `certifier`, `notary`,
`users`, `notifications`, `profile`, `contracts` y `public` (SPEC-017 los agotó uno por uno), más
`projects.routes.ts` y `projects-obra.routes.ts`, cerrados en este commit:

- **`projects-obra.routes.ts:161` era alcanzable y se cerró** (`stage-transitions.test.ts`, *"404 si
  el stage existe pero es de otro proyecto — sin mint"*): `authorize` valida el proyecto de la URL,
  no que el stage le pertenezca, así que un stage real pedido bajo otro proyecto sí llega al handler.
- **Las otras 6 no se alcanzan:** `projects.routes.ts:234` y `:718` (`authorize({proyecto})` ya cargó
  el proyecto); `:630` (`anchorStatus ?? "Confirmed"`: `OnChainEvent.status` es `NOT NULL`, así que
  si el `LEFT JOIN` trajo `txid` trajo `status`); `:729` (la FK `Project.organizationId →
  Organization` no deja una organización huérfana); `:751` (`ids` siempre incluye al proyecto que se
  está mirando); `projects-obra.routes.ts:165` (`STAGE_NOT_FOUND` de `retryStageMint`, sobre un stage
  que el handler acaba de confirmar tres líneas antes).
- Los tests a medio hacer de la sesión anterior (`developer-profile.test.ts`: `yearsInBusiness` en
  `null` y no en 0 cuando la organización no declaró `foundedYear`; `orpc-client-projects.test.ts`:
  alta de miembro, slug duplicado, invitación duplicada, filtros del listado, `estimatedDelivery`,
  documento sin TXID en `Pending`) se completaron y entran en el mismo commit.

## Paralelismo — qué se puede hacer a la vez, medido contra el código

**Los seis lotes son independientes entre sí, y ninguno depende del paso 0.** Se verificó, no se
supuso:

- **Aislamiento en runtime.** Cada archivo de test corre contra su propia copia de la base
  (`setup-db.ts` copia la plantilla antes de cada archivo, SPEC-015 §1) con `fileParallelism: true`.
  Dos lotes que escriben archivos de test distintos no se ven entre sí.
- **Aislamiento en git.** Los lotes solo escriben en `test/`, y cada uno en archivos propios. El
  paso 0 solo escribe en `src/routes/`. No hay archivo que dos agentes toquen.

**Pero hay cuatro archivos que todas las tandas de SPEC-017 editaron, y que en paralelo chocan
seguro.** La regla para los lotes es no tocarlos:

| Archivo | Por qué chocaría | Regla |
|---|---|---|
| `apps/api/vitest.config.mts` | Cada tanda subía los umbrales **y** sumaba un párrafo al comentario | Ningún lote lo toca. El umbral se sube una vez, en §Consolidación |
| `specs/SPEC-018-…` (esta) | Cada tanda escribía su sección | Ningún lote la edita: cada agente devuelve su resultado (qué cerró, qué pasó a documentado y por qué) y lo transcribe quien consolida |
| `test/global-setup.ts` (`FIXTURES`) | Es la plantilla de todos los archivos | Los datos que un lote necesita se crean en el `beforeAll` de su propio archivo, como hace `developer-profile.test.ts` |
| Archivos de test existentes compartidos (`stage-transitions.test.ts`, `route-guards.test.ts`, `orpc-client-*.test.ts`) | Dos lotes pueden querer sumar un `it` al mismo | Cada lote crea `test/<modulo>-coverage.test.ts` nuevo (el patrón que ya usan `certifier-routes-coverage.test.ts` y compañía) |

**Si un lote encuentra una rama que no se alcanza, no la anota en `src/`**: la reporta con su
razón (y la cadena que lo demuestra: qué middleware o qué constraint la cierra). La anotación, si el
dueño eligió la opción 2, la pone quien consolida — así ningún lote toca `src/` y el paso 0 sigue sin
conflictos.

**El orden importa en un solo lugar:** los números. El paso 0 cambia el denominador, así que el %
que mida un lote antes y después del paso 0 no es comparable. Cada lote reporta **ramas cerradas
(conteo)**, no porcentajes.

**En la práctica:** seis agentes en worktrees separados son ~4,5 GB (`CLAUDE.md` §Worktrees: ~750 MB
cada uno). El 2026-09-22 hay 33 GB libres — alcanza, pero se borran apenas se mergean.

## Consolidación (serial, al final)

1. Con el paso 0 y los seis lotes en `main`: una corrida de `pnpm --filter @plataforma/api
   test:coverage` y la tabla de arriba regenerada.
2. Si la opción 2 se eligió: los `/* v8 ignore next */` con motivo, en un commit propio.
3. Umbrales de `vitest.config.mts` al valor medido (trinquete: suben, no bajan), y el comentario
   largo de ese archivo reemplazado por un puntero a esta spec — hoy repite, desactualizado, lo que
   SPEC-017 ya cuenta.
4. Si algún número quedó bajo la vara: la lista de lo que falta, con su razón, acá.

## Criterio de cierre

- Branches ≥95% y statements, functions y lines ≥98% en `apps/api` — o, si el dueño elige la opción
  3, el techo medido y documentado, con cada rama sin cubrir justificada.
- Umbrales de `vitest.config.mts` en el valor final. La API ya corre `test:coverage` en CI con esos
  umbrales, así que no hay paso de CI propio.
