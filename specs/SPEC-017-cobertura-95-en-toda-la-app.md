# SPEC-017 — 95% de cobertura con unit tests, en toda la app

> Nace el 2026-09-21. El criterio 2 del SOM dice *"unit tests ≥95% coverage"*, sin acotar a qué parte
> del código. Hasta hoy se leía como "los contratos": `specs/README.md` lo daba ✅ con la tabla de
> puntos de rechazo de Aiken. **El dueño lo releyó el 2026-09-21: el 95% es de toda la app, y separar
> una parte es artificial.** Esta spec cierra esa distancia.
>
> Nivel 🟢 (tests). Toca configuración de CI (🟡) solo en el paso 7.

> **Cerrada el 2026-09-22 y partida en dos.** La spec quedó demasiado grande para releerla antes de
> cada tanda, y lo que falta ya no es uniforme: la API tiene un techo estructural y la web no. Estado
> de cada paso al cerrar:
>
> | Paso | Estado |
> |---|---|
> | 1. Medir honesto (`coverage.include`) | ✅ en las cuatro partes TypeScript |
> | 2. shared | ✅ las cuatro métricas ≥95% |
> | 3. cardano | ✅ las cuatro métricas ≥95% |
> | 4. API | ✅ en líneas (el criterio de esta spec): 97,45%. **La vara más estricta que pidió el dueño —branches ≥95%, el resto ≥98%— sigue en [`SPEC-018`](SPEC-018-cobertura-de-apps-api.md)** |
> | 5. Web | ➡️ [`SPEC-019`](SPEC-019-cobertura-de-apps-web.md) — cerradas acá solo las tandas notary y certifier |
> | 6. Contratos | ✅ 51/51 mutantes muertos, 18/18 `expect` con test |
> | 7. CI | ➡️ SPEC-019 §Consolidación (la mitad de shared y cardano se puede adelantar) |
> | 8. Evidencia | ➡️ SPEC-019 §Consolidación |
>
> Lo que sigue es el historial tal como se escribió. **Las tablas por archivo de abajo quedaron
> reemplazadas** por las de SPEC-018 y SPEC-019, que se regeneraron del último reporte de cobertura.

## Qué se mide

**Cobertura de líneas** (`v8`, la que ya usa la API): qué porcentaje de las líneas del código fuente
ejecuta al menos un test automático (unit o integración, ver abajo). No es la proporción de tests
en verde, que ya es 100% en las cinco partes (1.845 pasan, 3 omitidos a propósito, 0 fallan —
`specs/evidencia-m3/1-repo-ci-tests/`).

**La vara: ≥95% de líneas en cada una de las cinco partes, medida sobre todo su código fuente.** Una
parte al 99% no compensa otra al 60%.

## Las tres clases de test, y cuáles suman

Con un mismo ejemplo, **"el certificador completa una etapa"**:

**1. Unit (unitario): prueba una pieza sola.** La función de `packages/shared` que decide si
`InProgress → Completed` es una transición válida: se le pasan dos estados y se verifica que
devuelva sí o no. Sin base de datos, sin servidor, sin pantalla. Es probar un engranaje suelto.
*Dónde hay:* shared, cardano, contratos (los 85 de Aiken) y la web (los tests de componentes, como
`HashChip`).

**2. Integración: prueba varias piezas conectadas, sin navegador.** Se levanta la API dentro del
propio test, con una base de datos de prueba, y se le manda `PATCH /stages/:id/state` como lo haría
un cliente. Se verifica el recorrido entero: que chequee el rol, que aplique la regla de transición,
que guarde en la base y que escriba el audit log. Es probar la máquina armada, sin nadie usándola.
*Dónde hay:* casi todos los 544 de la API.

**3. E2E (end-to-end, punta a punta): prueba la app como la usa una persona.** Playwright abre un
navegador de verdad, entra con el usuario certificador, hace clic en la etapa y en "Completar", y
verifica que la pantalla muestre el cambio. Recorre web + API + base, todo junto. Es poner a alguien
a usar la máquina. *Dónde hay:* los 90 de `apps/web/e2e/`.

| Clase | ¿Suma al %? | Por qué |
|---|---|---|
| Unit | ✅ Sí | Corre dentro de Vitest, que va marcando cada línea que se ejecuta |
| Integración | ✅ Sí | También corre dentro de Vitest: la API se levanta en el mismo proceso del test, así que sus líneas quedan marcadas |
| E2E | ❌ No | Playwright maneja un navegador que le habla a un servidor aparte. Vitest no ve ese proceso, así que no puede marcar nada |

Por eso la web da 29% aunque sus pantallas estén bien probadas: las prueban los e2e, que no suman.
Y por eso la API da 89%: sus tests de integración sí suman.

**La cobertura se mide con unit + integración (todo lo que corre en Vitest); los e2e no suman.**

## El hallazgo que cambia la medición

**Vitest, por default, solo cuenta los archivos que algún test importa.** Un archivo que ningún test
toca no aparece en el denominador, y la cobertura sale inflada. Medido hoy:

| Parte | Sin `include` (default) | Con `include: ["src/**"]` (todo el código) |
|---|---|---|
| `apps/web` | 84,8% de 601 líneas | **29,1% de 1.755 líneas** |
| `packages/shared` | 100% de 142 líneas | **61,2% de 232 líneas** |

La API ya declara `include: ["src/**/*.ts"]`. **`apps/web` y `packages/shared` no tienen config de
coverage**, así que cualquier número que salga de ellos sin `include` es falso. El reporte de tests
del 2026-09-21 ya usó la medición honesta (27,6% y 61,2%); esta spec la vuelve la única posible.

## Cuánto falta, y cómo agregarlo

Medido el 2026-09-21 contra `main` (`1882a0a`), con `include` sobre todo `src/`.

| Parte | Hoy | Líneas cubiertas / total | Faltan para 95% | Dónde está el hueco | Cómo agregarlo |
|---|---|---|---|---|---|
| **Contratos** (`contracts/`, Aiken) | sin métrica de líneas | — | **0 esperado — a medir** | Aiken no mide cobertura de líneas (`aiken check` solo tiene `--property-coverage`) | La tabla *punto de rechazo → test* de `contracts/CLAUDE.md` §Coverage (85 tests) se **mide** con dos scripts ya escritos (2026-09-21), pendientes de correr: `contracts/scripts/rechazos-mutantes.mjs` saca cada uno de los **51 chequeos** mutables de a uno y exige que algún test se ponga rojo; `contracts/scripts/rechazos-trazas.mjs` verifica que cada `expect` —incluidos los **7** que desarman o castean y no se pueden mutar— tenga un test de rechazo que aborte exactamente ahí. Con los dos en verde, el 100% queda medido. Si algún chequeo queda sin test, se escribe el test |
| **API** (`apps/api`) | **89,4%** | 1.860 / 2.081 | **~116** | `routes/certifier.routes.ts` (22), `routes/investor.routes.ts` (20), `routes/developer-comercial.routes.ts` (19): ramas de error y de permisos sin test · `lib/storage.ts` (22): el driver S3, que solo se prueba contra MinIO en `test:s3` · scripts de arranque: `db/fixtures.ts` (26), `db/seed.ts` (19), `instrumentation.ts` (16), `db/migrate.ts` (13) | Tests de integración con supertest para las ramas de error de las tres rutas (401/403/404/409 que hoy nadie pide). `storage.ts`: unit tests del driver S3 con el cliente mockeado (`@aws-sdk/client-s3`), además del test contra MinIO que ya existe. Scripts: exportar su lógica como funciones y testearlas contra la SQLite de test — `seed` con passwords de entorno y sin ellas, `migrate` idempotente, `instrumentation` con y sin DSN |
| **cardano** (`packages/cardano`) | **90,1%** | 247 / 274 | **~14** | `factory.ts` (10): la selección de adaptador y sus errores de configuración · `real.ts` (11): ramas de error de Blockfrost | `factory.ts`: un test por combinación de `ANCHOR_MODE`/variables faltantes (el comportamiento lo fija D-075). `real.ts`: las respuestas de error del proveedor, con el mismo mock que usan los tests existentes |
| **shared** (`packages/shared`) | **61,2%** | 142 / 232 | **~79** | Módulos de schemas Zod que ningún test importa: `project.ts` (19), `unit.ts` (10), `dossier.ts` (10), `contract.ts` (9), y 12 más de 4–6 líneas | Un test por módulo que parsee un caso válido y uno inválido de cada schema exportado (el que rechaza es el que importa: es el contrato que la API aplica). Es trabajo chico y mecánico |
| **Web** (`apps/web`) | **29,1%** | 510 / 1.755 | **~1.158** | **Las pantallas**: de 44 archivos de ruta, solo `login` tiene unit test — `routes/` concentra 1.028 de las líneas sin cubrir. Las más grandes: `investor.unit.$unitId.index.tsx` (79), `project.$projectId.stage.$stageId.tsx` (75), `investor.buy.tsx` (68), `project.$projectId.index.tsx` (60), `developer.project.$projectId.upload.tsx` (57). Además `components/` (151, sobre todo `LocationMapModal.tsx` con 73) y `lib/` (42) | Un test por pantalla con el patrón de `routes/-login.test.tsx`: router de memoria, `fetch` mockeado a nivel de `ApiPort`, y los estados que la pantalla declara (carga, vacío, error, con datos, y cada acción del usuario). Las pantallas ya tienen e2e (90 tests), pero los e2e no cuentan para esta métrica. **Es el grueso de la spec**: se hace por tandas, rol por rol, commit por tanda |

**Total a cubrir: ~1.370 líneas**, de las que ~1.160 son de la web.

## Qué no se hace

- **No se excluyen archivos para llegar al número.** Solo quedan fuera del denominador los archivos
  que no emiten código en runtime o que son generados: `apps/api/src/db/types.ts` (solo tipos) y
  `apps/web/src/routeTree.gen.ts` (lo genera TanStack Router). `apps/api/src/server.ts`, que hoy
  está excluido, **vuelve a contar**: su lógica se extrae a una función testeable y queda afuera
  solo la línea que la invoca.
- **No se bajan ni se relajan tests existentes**, y no se escriben tests que ejecuten código sin
  afirmar nada. Un test que solo sube la cobertura sin verificar un comportamiento no cuenta.
- **No se cambia código de producción para facilitar un test**, salvo extraer a funciones la lógica
  de los scripts de arranque (paso 3), que no cambia su comportamiento.

## Pasos

Cada paso es un commit (o varios, en la web) con `pnpm verify:all` en verde.

1. **Medir honesto en todas las partes.** `vitest.config` con `coverage.include: ["src/**"]` en
   `apps/web`, `packages/shared` y `packages/cardano`, y las mismas exclusiones justificadas de
   arriba. Script `test:coverage` en cada package. Umbrales en el valor medido hoy (el trinquete de
   la API: suben con cada paso, no bajan).
2. **shared** → 95%.
3. **cardano** → 95%.
4. **API** → 95%: primero las tres rutas, después `storage.ts`, después los scripts de arranque.
5. **Web** → 95%, por tandas: investor → developer → certifier → notary → admin y compartidas →
   `components/` y `lib/`. Cada tanda sube el umbral de la web a lo que midió.
6. **Contratos** — **los scripts ya están escritos** (2026-09-21), falta correrlos:
   `node contracts/scripts/rechazos-mutantes.mjs --salida <archivo>` y
   `node contracts/scripts/rechazos-trazas.mjs --salida <archivo>`. Los dos reportes (en inglés, o
   traducidos) van a `specs/evidencia-m3/1-repo-ci-tests/` como evidencia del 100% de los contratos,
   y `contracts/CLAUDE.md` §Coverage cita el resultado. Un mutante vivo o un `expect` sin test se
   cierra escribiendo el test que falta. Se puede hacer antes que los pasos 2–5: no depende de
   ellos.
7. **CI** (🟡): el job `app` corre `test:coverage` de las cuatro partes TypeScript con umbral 95%
   (hoy solo corre el de la API).
8. **La evidencia**: una corrida nueva de CI, y con ella se actualizan
   `specs/EVIDENCIA-2026-09-21-reporte-de-tests.md`, su versión en inglés
   `specs/evidencia-m3/1-repo-ci-tests/test-report.md`, el log de CI copiado y el PDF
   (`bash scripts/evidencia-pdf/generar.sh`). El criterio 2 de `specs/README.md` vuelve a ✅.

## Criterio de cierre

- Las cuatro partes TypeScript con **≥95% de líneas**, medidas con `include` sobre todo `src/`, y CI
  que rompe si alguna baja de 95%.
- La tabla de los contratos verificada contra el código, sin puntos de rechazo sin test.
- El reporte de tests de la evidencia de M3 actualizado con la corrida nueva.

## El triage del paso 6 — 2026-09-22

Los dos scripts corrieron (`specs/evidencia-m3/1-repo-ci-tests/mutation-report.md` y
`expect-trace-report.md`): **51 mutantes → 37 muertos, 14 vivos**; **18 `expect` → 13 con test, 5
sin test**. No es el 100% que la tabla de `contracts/CLAUDE.md` §Coverage da a entender. El triage
caso por caso —leyendo `stage.ak` y `fsm.ak` completos contra cada punto vivo— separó lo que es
redundancia genuina (otro chequeo ya lo garantiza, con la cadena lógica completa) de lo que es un
gap real.

**Equivalente — se documenta, no se fuerza un test:**

| Línea | Por qué es equivalente |
|---|---|
| `stage.ak:91` (`own_input` tiene qty==1 del token) | `carrying_thread` sobre el output (línea 104, con el `stage_ref` viejo) ya exige que el único output en la dirección del script tenga exactamente 1 unidad, y la igualdad de valor (línea 125) fuerza `own_input.value == continuing_output.value`. Cualquier cantidad mal formada en el input se transmite idéntica al output vía 125, y ahí la agarra 104 |

**Gap real — necesita test nuevo:**

| Línea | Qué expone | Test propuesto | Orden sugerido |
|---|---|---|---|
| `fsm.ak:143` | Nada impide `Advance{to: InProgress, completion: Some(...)}` — una transición que no completa pero trae payload de evidencia igual | transición no-terminal con `Completion` adjunto → debe rechazar | 1 |
| `fsm.ak:144` | El redeemer podría declarar un `evidence_root` de 32 bytes (pasa el chequeo de longitud si el stage es crítico) mientras el datum en verdad guarda uno distinto — evade en sustancia la regla de evidencia obligatoria | `evidence_root` del redeemer ≠ el escrito en `new.evidence_root` → debe rechazar | 1 |
| `fsm.ak:145` | El validador de ventana de tiempo en `stage.ak` chequea el `now` del redeemer, no `completed_at`. Sin esta línea, el datum podría persistir una fecha distinta a la verificada contra la ventana — rompe la garantía anti-backdating que es la razón de ser del anclaje | `completed_at` escrito ≠ `now` del redeemer → debe rechazar | 1 |
| `stage.ak:37` | Filtro de outputs por dirección nunca se ejercita con un output extra en otra dirección | tx con `continuing_output` legítimo + un output decoy en `wallet_address()`, camino feliz debe seguir aceptando | 2 |
| `stage.ak:60` | Mismo problema con inputs — ningún test mezcla el input del script con un input de wallet (fee) | tx con `script_input` + un input extra en `wallet_address()`, debe seguir aceptando | 2 |
| `stage.ak:52` | `carrying_thread` en `mint` no tiene la red de seguridad que sí tiene `spend` (ahí no hay "own_input" con qué comparar) | mint donde el output ya trae 2 unidades del token (una "donada" por un input externo) mientras `tx.mint` solo declara +1 → debe rechazar | 2 |
| `stage.ak:69` | Único test con ambas puntas infinitas — nunca aísla la punta inferior | rango semiabierto: inferior infinito, superior finito | 2 |
| `stage.ak:70` | Mismo, nunca aísla la punta superior (coincide con el `expect` sin test) | rango semiabierto: superior infinito, inferior finito | 2 |
| `stage.ak:87` | Ningún test arma un `own_input` en una dirección de wallet | `own_input` con `payment_credential` de tipo `VerificationKey` en vez de `Script` | 2 |
| `stage.ak:101` + `stage.ak:104` | Comparten la falla que ya señala el comentario de SPEC-303: `carrying_thread` filtra por *payment credential*, no por dirección completa. El ataque real: dos outputs con el mismo payment credential del script pero distinto staking credential, cada uno con una unidad del mismo token (asumiendo la reutilización de `stage_ref` que ya documenta el gap conocido de C-01/SPEC-301) | un solo test que arma ese split y confirma rechazo — cierra las dos líneas y deja probado en código lo que hoy solo argumenta el comentario | 2 |
| `stage.ak:110` | Cast de tipo del datum nuevo nunca falla en ningún test | `continuing_output.datum` = `InlineDatum(Init)` (otro tipo, mismo mecanismo `Data`) en vez de un `StageDatum` | 2 |
| `stage.ak:125` | El único test que toca esta línea (`spend_rejects_value_drain`) además rompe la cantidad de token, así que en realidad lo agarra la línea 104, no esta | drenar solo el ADA (2M→1M) manteniendo la unidad del thread token intacta — la única forma de aislar esta garantía de D-021 | 2 |
| `stage.ak:150` (arity, no cantidad) | `mint_rejects_two_threads_in_one_tx` de hecho no mata esta mutación — el mismatch entre `asset_name` extraído y `stage_ref` del datum lo salva por otro lado | mint con 2 asset names distintos donde ambos están también en el output y el datum coincide con el que gana el orden lexicográfico — aísla el chequeo de cardinalidad puro | 2 |
| `stage.ak:153` | Análogo a 104 pero en `mint`, sin la red de `own_input`/125 | dos outputs en la dirección del script, cada uno con 1 unidad del mismo asset (mismo truco del token "donado") → debe rechazar por encontrar 2, no 1 | 2 |
| `stage.ak:155` | Igual que 110, en `mint` | `thread_output.datum` = `InlineDatum(Init)` en vez de `StageDatum` | 2 |

Los tres de `fsm.ak` van primero: son función pura (sin armar transacción completa), más baratos de
escribir, y son los de mayor impacto real — anti-backdating y evidencia obligatoria son las dos
promesas centrales del producto (D-026). Los de `stage.ak` van después, uno por commit.

**Al cerrar los 15, correr los dos scripts de nuevo** y actualizar
`specs/evidencia-m3/1-repo-ci-tests/mutation-report.md` y `expect-trace-report.md` con la corrida
que da 51/51 y 18/18 — recién ahí la tabla de `contracts/CLAUDE.md` §Coverage queda verificada de
verdad, no solo argumentada.

**Cerrado 2026-09-22.** Los 15 tests del triage están escritos, uno por commit, y dan **51
mutantes: 50 muertos, 1 vivo** (`stage.ak:91`) y **18 `expect`: 18 con test**. La equivalencia que
la tabla de arriba proponía para `stage.ak:91` resultó incompleta: asumía que `carrying_thread`
(línea 104) termina mirando al output de continuación, pero filtra por payment credential sobre
**todos** los outputs, así que un decoy en una dirección con el mismo payment credential y otro
staking credential (el mismo hueco de C-01/SPEC-301 que ya explota el test de la línea 104) puede
absorber ese match en su lugar. Un test más —`spend_rejects_own_input_with_two_units_when_a_decoy_
absorbs_carrying_thread`— cierra el gap real: **51 mutantes: 51 muertos, 18/18 `expect` con test**.
`contracts/CLAUDE.md` §Coverage cita el resultado final. El paso 6 de esta spec queda cerrado; los
pasos 1-5 y 7 (las cuatro partes TypeScript y CI) siguen abiertos.

## El paso 2 (shared) — cerrado 2026-09-22

`packages/shared` no tenía `vitest.config`, así que su 100% medido era falso — solo contaba las 142
líneas que algún test tocaba. Con `coverage.include: ["src/**"]` (`packages/shared/vitest.config.mts`,
nuevo), la medición honesta era 61,2% de 232 líneas, como decía la tabla de arriba.

Los 14 módulos sin ningún test eran todos schemas Zod puros (`audit.ts`, `capital.ts`,
`certifier.ts`, `contract.ts`, `dossier.ts`, `invitation.ts`, `notifications.ts`, `pagination.ts`,
`panels.ts`, `params.ts`, `project.ts`, `telemetry.ts`, `unit.ts`, `user.ts`) — sin lógica propia
que ramificar, así que un test por schema que parsea un caso válido y uno inválido (el que rechaza
es el que importa: es el contrato que la API aplica) alcanzó el objetivo en un solo commit, sin
tocar producción.

**Resultado: 100% de líneas (232/232), 100% de statements y funciones, 96,55% de branches** (las
dos ramas de `auth.ts:36-37` que el `.refine()` de `passwordSchema` deja sin ejercitar juntas en un
mismo test no importan para esta spec, que mide líneas). Umbral del `vitest.config` puesto en 95%
en las cuatro métricas — sube con cada parte, no baja. `pnpm --filter @plataforma/shared
test:coverage` lo corre a mano; el paso 7 lo suma a CI junto con las otras tres partes TypeScript.

El paso 2 queda cerrado. Quedan abiertos: paso 1 para `apps/web` (medir honesto ahí también), el
paso 4 (API), el paso 5 (web) y el paso 7 (CI).

## El paso 3 (cardano) — cerrado 2026-09-22

`packages/cardano` ya tenía `vitest.config.mts` (por el `resolve.alias` de `@plataforma/shared`),
pero sin `coverage.include`. Con `["src/**"]`, la medición honesta era 90,14% de 274 líneas —27
líneas de las 95% que pide la spec, casi todas en `factory.ts` (la selección del adaptador real y
sus errores de configuración) y `real.ts` (ramas de error de Blockfrost, `awaitConfirmation`, y el
default de `now`).

`factory.ts` necesitó mockear Lucid por primera vez en el package (`factory-real.test.ts`): el
camino feliz de `crearAdaptadorReal` antes solo se probaba contra un nodo real en `yaci.test.ts`
(manual, no en CI). El resto —`real.ts`, `simulated.ts`, `blueprint.ts`, `codec.ts`— eran casos
borde que el `Emulator` ya deja probar contra el validador de verdad, más un archivo nuevo
(`ledger.test.ts`) para `InMemoryLedgerStore`, que no tenía ninguno.

**Resultado: 99,63% de líneas (273/274), 94,9% de branches.** Quedan dos líneas sin cubrir, y las
dos documentadas en el propio código como irreductibles: el caso de igualdad de
`ordenarPorClave` (`simulated.ts`) —las claves de un objeto JS son siempre únicas, así que el
`a === b` del comparador no tiene forma de ocurrir— y la guarda de `publishReferenceScript`
(`real.ts:468`) contra una transacción que Lucid reporta exitosa sin dejar el output prometido, que
solo se podría forzar mockeando internals de la librería de firma. Umbral del `vitest.config` en
95% en las cuatro métricas.

El paso 3 queda cerrado. Quedan abiertos: paso 1 para `apps/web`, el paso 4 (API), el paso 5 (web)
y el paso 7 (CI).

## El paso 4 (API) — parcial, tandas 1-2, 2026-09-22

La spec ordena el paso 4 en tres tandas: las tres rutas con ramas de error sin test, `lib/storage.ts`,
y los scripts de arranque. Este cierre es de las dos primeras — la tercera (`db/fixtures.ts`,
`db/seed.ts`, `db/migrate.ts`, `instrumentation.ts`) queda para otra sesión, a propósito.

`apps/api` ya tenía `coverage.include: ["src/**/*.ts"]` desde SPEC-015 §3, así que no hizo falta el
paso 1 acá — medido: 89,4% de líneas (1.860/2.081).

**`certifier.routes.ts` (68,14%→100%) y `investor.routes.ts` (75,8%→100%).** El hallazgo que explica
la mayoría del hueco en las dos: `authorize({ acceso: { dueño: ... } })` y `{ proyecto: { via: ... } }`
ya resuelven la entidad para chequear pertenencia, y devuelven 404 **antes** de que la request llegue
al handler — así que el `if (!x) throw NOT_FOUND` que el propio handler repite por las dudas es, en
varios casos, código inalcanzable por HTTP (confirmado leyendo `middlewares/auth.ts`, no supuesto).
El hueco real no eran esos `throw`: eran rutas y ramas que **nadie llamaba nunca** —
`certifier.routes.ts` documentaba en su propio comentario que ningún test llamaba a
`/stages/:id/certify` ni `/observe` por HTTP, y `investor.routes.ts` no tenía ningún test para
favoritos, para el detalle de unidad, ni para el flujo completo de `decline` de una invitación.

**`developer-comercial.routes.ts` (74,26%→94,82%).** Mismo patrón: el listado de unidades de un
proyecto nunca se había llamado por HTTP, y de la liberación de pagos faltaban la etapa inexistente,
la etapa sin certificar y la idempotencia (repetir la misma liberación da 200, no un segundo
anclaje) — `spec-205-tope-de-liberacion.test.ts` solo cubría el tope del monto. Quedan dos ramas sin
cubrir, documentadas como de bajo valor en el `vitest.config`: el desempate de
`contractsOfProjectProcedure` para un investor que compró la misma unidad dos veces (necesita dos
`OnChainEvent` de `INVITATION_ACCEPTED` sobre el mismo par unidad+investor, un estado que solo se
arma con inserts directos a mano, no con el flujo real), y un `catch` puramente defensivo que
relanza cualquier error que no sea el de negocio esperado.

**`lib/storage.ts` (53,7%→100%).** El driver S3 (`S3Storage`) solo se probaba contra un MinIO real
en `test:s3` (necesita Docker, no corre en CI) — la clase entera quedaba sin ejercitar en la
medición normal. `storage-mocked.test.ts` mockea `@aws-sdk/client-s3` (con `vi.hoisted`, porque
`vi.mock` se hoistea por encima de cualquier `class` declarada más abajo) y cubre `put`, `read`,
`exists`, `remove` y las dos ramas de `ensureBucket`, sin tocar `storage-s3.test.ts` ni el driver.
`DiskStorage.remove` tampoco tenía ningún test — se sumó uno chico.

**Resultado total de la API: 93,08% de líneas (1.937/2.081), 87,01% de statements, 75,24% de
branches, 92,39% de funciones** — medido con las tandas 1-2 solas, sin el trabajo de la tanda 3.
Umbral del `vitest.config` subido de 70/67/56/65 a 92/86/74/92 (líneas/statements/branches/
funciones) — sube con esta tanda, no llega a 95% porque la tercera queda pendiente.

El paso 4 queda parcial: falta la tanda 3 (scripts de arranque). Quedan abiertos también: paso 5
(web) y paso 7 (CI). El paso 1 de `apps/web` ya se había cerrado por separado (medición honesta con
`coverage.include`, commit `b606dc1`).

## El paso 4, tanda 3 (scripts de arranque) — plan y avance parcial, 2026-09-22

Los cuatro scripts, con qué falta en cada uno y por qué:

| Script | Estado | Qué hacía falta | Riesgo |
|---|---|---|---|
| **`db/migrate.ts`** | ✅ Cerrado (commit `8bcfacb`) | `applyPendingMigrations`/`conTecho` ya estaban exportadas y bien testeadas; lo que faltaba era `main()` (conectar, aplicar con techo, loguear, cerrar) — vivía detrás de `require.main === module` y ningún test la invocaba. Se extrajo a `migrar(url?)`, exportada, mismo cuerpo; `main()` queda de wrapper. Test contra una base temporal real (`test/migrate-cli.test.ts`): aplica las migraciones del repo desde cero, crea el directorio que falta, y confirma la idempotencia de la segunda corrida | Bajo — no cambia comportamiento, solo lo hace invocable |
| **`db/fixtures.ts`** | ✅ Cerrado (commit `8bcfacb`) | Sorpresa: no hacía falta ningún cambio de producción. `sembrarOrganizacion()` y `sembrarStages()` ya estaban exportadas y tipadas — el hueco era que `test/global-setup.ts` nunca las llama (solo usa `sembrarUsuarios`/`sembrarProyecto`/`sembrarMembresias`/`sembrarUnidadVendida`). Se cerró con un test aislado (`test/fixtures-seed.test.ts`) que las llama directo contra la base de test, sin tocar `global-setup.ts` — cero riesgo de alterar la plantilla que usa el resto de la suite | Ninguno — no se tocó producción |
| **`db/seed.ts`** | ⬜ Pendiente | Dos cosas, en orden: **(1)** falta el guardia `if (require.main === module)` que sí tiene `migrate.ts` — hoy `main()` se invoca sin condición al final del archivo, así que solo *importarlo* desde un test dispararía el seed completo (bcrypt de 9 usuarios, proyecto, stages, unidad vendida, compilar el dossier) como efecto secundario. Es un fix real, no cosmético: el mismo patrón que ya mordió en otro lado del repo (un import con efecto secundario oculto). **(2)** con el guardia puesto, extraer `main()` a una función exportada (p.ej. `sembrarDemo()`) para poder invocarla desde un test contra la base de test, con `SEED_ADMIN_PASSWORD`/`SEED_DEMO_PASSWORD` presentes y ausentes (las dos ramas de `passwordDeDemo`, en `db/credentials.ts`) | Medio — el guardia hay que agregarlo con cuidado: `seed.ts` no tiene ningún test hoy, así que el primer test que lo importe es también la primera vez que alguien confirma que el guardia no rompió `pnpm db:seed` como CLI |
| **`instrumentation.ts`** | ⬜ Pendiente | El más invasivo de los cuatro: hoy es código de nivel de módulo con efectos reales al importar (`Sentry.init(...)`, `new NodeSDK(...).start()`), sin ninguna función exportada. Hace falta envolver los dos bloques (Sentry, OpenTelemetry) en funciones exportadas (`initSentry()`, `initOpenTelemetry()`) que el archivo sigue llamando incondicionalmente al cargar —no cambia el comportamiento de producción, D-042/D-075 exigen que esto siga siendo automático al `--require`—, y en el test mockear `@sentry/node` y los `@opentelemetry/*` (`vi.mock`, mismo patrón que usó el fork de esta sesión para `@aws-sdk/client-s3` en `storage-mocked.test.ts`) para probar las cuatro combinaciones con/sin `SENTRY_DSN` y con/sin `OTEL_EXPORTER_OTLP_ENDPOINT` sin tocar una red ni un proceso real | Medio-alto — son dos SDKs con estado global (un `NodeSDK` real seguiría vivo entre tests si el mock no lo evita) |

**Con `migrate.ts` y `fixtures.ts` cerrados, quedan `seed.ts` (~19 líneas) e `instrumentation.ts`
(~16 líneas) para terminar la tanda 3** y con ella el paso 4 completo — el número exacto de líneas
restantes hay que remedirlo, porque cambió con el trabajo del fork en la tanda 1-2.

## El paso 4, tanda 3 (scripts de arranque) — cerrado, 2026-09-22

Los dos que quedaban:

**`db/seed.ts`.** `main()` no tenía guardia — importarlo desde un test habría disparado el seed
completo como efecto secundario del import. Se agregó `if (require.main === module)` (mismo patrón
que `migrate.ts`) y se exportó `sembrarDemo()` (antes `main()` sin exportar). `test/seed-demo.test.ts`
la invoca contra la base de test dos veces: una sin `SEED_ADMIN_PASSWORD`/`SEED_DEMO_PASSWORD` (usa
los defaults locales) y otra con las dos seteadas, corrida dos veces para confirmar que el segundo
seed no duplica al admin (upsert por email, D-046). `passwordDeDemo` ya tenía su propia suite
completa (`seed-credentials.test.ts`); lo que faltaba cubrir era lo que `sembrarDemo` arma encima —
el elenco completo, la organización, el proyecto, el template de stages (primera etapa `InProgress`,
el resto `Pending`, M3 §2.5), la unidad vendida y el dossier compilado.

**`instrumentation.ts`.** Los dos bloques (Sentry, OpenTelemetry) vivían como código de nivel de
módulo, sin ninguna función exportada. Se envolvieron en `initSentry()`/`initOpenTelemetry()`, que
el archivo sigue llamando incondicionalmente al final (mismo comportamiento de producción,
automático al `--require`, D-042/D-075). `initSentry` se prueba mockeando `@sentry/node` con
`vi.mock` — es un `import` estático, así que el mock lo intercepta sin problema.
**`initOpenTelemetry` no**: sus `require()` de los ocho paquetes `@opentelemetry/*` son tardíos y
literales a propósito (para no pagar el costo si `OTEL_EXPORTER_OTLP_ENDPOINT` no está seteado), y
un `require()` corre por el `require` real de Node, no por el grafo de módulos que Vitest
intercepta — se probó primero con `vi.mock` y el resultado fue `NodeSDK.start()` corriendo de
verdad, registrando globals reales de `@opentelemetry/api` (`Attempted duplicate registration of
API`). La solución fue inyección de dependencias: `initOpenTelemetry(deps?)` recibe un objeto
opcional con los ocho símbolos, y solo si falta llama a `cargarDependenciasOtel()` (los requires
reales) — así la laziness no cambia (nada se importa hasta que hace falta) y un test le pasa un
objeto armado a mano (`vi.fn()` por cada constructor/función) sin tocar una red ni un proceso real.
`test/instrumentation.test.ts` cubre las cuatro combinaciones: con/sin `SENTRY_DSN`, con/sin
`OTEL_EXPORTER_OTLP_ENDPOINT` (incluido que el flush de `sdk.shutdown()` se registra en `SIGTERM`).

**Resultado: la API queda en 96,26% de líneas (2008/2086) — sobre el 95% que pide la aceptación de
M3.** Statements (89,94%) y branches (77,66%) quedan por debajo; la spec mide líneas (§Qué se mide),
así que no bloquean el cierre. Umbral del `vitest.config` subido a 95/95 en líneas/funciones y al
piso medido (89/77) en statements/branches — sube con esta tanda, no baja.

**El paso 4 (API) queda cerrado.** Quedan abiertos: paso 5 (web) y paso 7 (CI).

## El paso 5 (web) — plan de tandas, 2026-09-22

El paso 5 es el grueso de la spec (~1.158 líneas, contra ~14–116 de las partes ya cerradas), así
que necesita su propio orden dentro del orden. La spec ya fija la secuencia por rol —investor →
developer → certifier → notary → admin y compartidas → `components/` → `lib/`— pero no el tamaño de
cada tanda. Medido el 2026-09-22 con `coverage.reporter=json-summary`, líneas sin cubrir por rol
(`src/routes/`, sin contar `components/`/`lib/`):

| Tanda | Archivos | Líneas sin cubrir |
|---|---|---|
| **notary** | 5 | 50 |
| certifier | 5 | 63 |
| admin (solo `admin.index.tsx`; "y compartidas" es más) | 1 | 44 |
| developer | 14 | ~330 |
| investor | 10 | ~330 |
| `project.$projectId.*` (compartidas entre developer/investor) | 4 | ~185 |
| `components/` | — | 151 |
| `lib/` | — | 42 |

El patrón que ya usa `-login.test.tsx` y `queues.test.tsx` alcanza: router de memoria +
`QueryClientProvider` + `LocaleProvider`, `api` mockeado con `vi.spyOn`, sesión puesta con
`setSession`. Se extrajo a `-test-mount.tsx` (prefijo `-`: TanStack Router lo ignora por convención,
igual que `-login.test.tsx`) para no repetir el armado en cada archivo — `autenticarComo(user)` deja
`api.me()` y `api.getUnreadCount()` resueltos (lo que piden `useRoleGuard` y `PanelLayout` en toda
pantalla protegida) y `montarRuta(Componente, path, rutasExtra?, entrada?)` arma router + render. El
componente de cada ruta no está exportado — solo `Route` —, así que el test lo saca con
`Route.options.component as () => React.ReactElement` en vez de tocar producción para exportarlo.

**Empezada por la tanda más chica y autocontenida: notary** (50 líneas, 5 archivos, sin las
dependencias cruzadas de `project.$projectId.*` que investor/developer comparten). Certifier es la
siguiente candidata por tamaño; admin es más chica en su único archivo pero la spec la agrupa con
"compartidas", que es un alcance mayor y ambiguo hasta no mirarlo de cerca.

### Tanda notary — cerrada, 2026-09-22

Los 5 archivos, con `montarRuta`/`autenticarComo` y `api` mockeado método por método:

- **`notary.profile.tsx`** (100%): renderiza `ProfileScreen` con `api.getProfile` mockeado — cubre
  la ruta y, de paso, buena parte de `ProfileScreen.tsx` (compartida, de la tanda `components/`).
- **`notary.dossiers.tsx`** (100%): la cola de pendientes con un ítem.
- **`notary.index.tsx`** (100%): dos casos — KPIs en `null` (día 1, ningún guión debe leerse como
  `"null"` literal) y KPIs con datos, verificando los cuatro valores en el DOM.
- **`notary.signed.tsx`** (100%): vacío, firmado (dos `HashChip`: `masterHash` + `signatureTxid`,
  regla del comentario del archivo) y sin firmar (`signatureTxid: null`, un solo chip).
- **`notary.dossier.$dossierId.tsx`** (96,15%, 25/26): vista con evidencia, estado firmado (las
  acciones desaparecen, D-026), `signDossier`/`rejectDossier` invocados con los argumentos correctos
  y navegación de vuelta, y el estado sin artifacts. La línea que falta no se persiguió — no cambia
  el resultado de la tanda.

**Encontrado en el camino, no en el código:** `montarRuta` inicialmente reusaba el mismo `path` para
definir la ruta dinámica (`/notary/dossier/$dossierId`) y para la entrada de la historia — así el
router matcheaba `$dossierId` como el valor **literal** del parámetro, y los mocks se llamaban con
`'$dossierId'` en vez de un id real. Se agregó un cuarto argumento opcional (`entrada`) para separar
el patrón de ruta de la URL con la que arranca el test.

**Resultado del front tras la tanda: 33,59% de líneas (596/1.774)**, contra 29,05% antes. Umbral del
`vitest.config` subido de 28/21/30/29 a 32/25/34/33 (statements/branches/functions/lines) — sube con
esta tanda, no baja. Quedan abiertas las tandas certifier, admin, developer, investor,
`project.$projectId.*`, `components/` y `lib/`, y con ellas el paso 5.

### Tanda certifier — cerrada, 2026-09-22

Mismo patrón que notary, con `CERTIFIER_USER` agregado a `-test-mount.tsx` (rol interno `verifier`,
`CERTIFIER_ROLES`). Los 5 archivos:

- **`certifier.profile.tsx`** (100%): igual que `notary.profile.tsx`, `ProfileScreen` con
  `api.getProfile` mockeado.
- **`certifier.assigned.tsx`** (100%): la cola de asignados (`AssignedStagesQueue`) con un ítem —
  mismo componente que ya prueba `queues.test.tsx`, acá solo la ruta que lo monta.
- **`certifier.issued.tsx`** (100%): vacío, con TXID (dos `HashChip`: `commitmentHash` + `txid`,
  `StatusPill` "Certified") y sin TXID — **el caso que el comentario del archivo señala**: el estado
  sale del TXID, no de `certifiedAt`, así que un certificado con fecha pero sin TXID sigue
  "Pendiente" (regla 17).
- **`certifier.index.tsx`** (100%): el panel tiene una superficie más que el de notary —
  `InvitacionesACertificar` (SPEC-221, D-095), una mutación con dos acciones sobre la misma
  invitación. Cuatro casos: KPIs con datos y sin invitaciones pendientes (`CER-INVITATIONS-003` no
  se dibuja — el componente devuelve `null` si la lista viene vacía), aceptar invocando
  `api.acceptCertifierInvitation`, rechazar invocando `api.declineCertifierInvitation`, y el error de
  cualquiera de las dos mostrando el `role="alert"` de la pantalla.
- **`certifier.stage.$stageId.tsx`** (96,29%, 26/27): la pantalla más grande de la tanda — vista con
  evidencia (`DocumentCard`), vista sin evidencia (`Certify` deshabilitado por `disabled`, no
  escondido — el comentario del archivo lo pide así a propósito), stage ya `Completed` (la barra de
  acciones entera desaparece), certificar (llama a `api.certifyStage` con el id y navega), el error
  de certificar, y observar (abre `ObserveStageModal`, escribe la nota, llama a `api.observeStage`
  con `(stageId, note)`). La línea que falta no se persiguió.

**No hizo falta ningún ajuste a `-test-mount.tsx` ni al patrón `montarRuta`/`autenticarComo` de la
tanda notary** — el helper compartido escaló sin cambios a una pantalla con una mutación de dos
acciones (`InvitacionesACertificar`) y a los estados `disabled`/ausente de una barra de acciones.
Único detalle nuevo: sin `@testing-library/jest-dom` instalado, `toBeDisabled()` no existe —
se verifica `.disabled` del elemento castndo a `HTMLButtonElement`, como ya hacía el resto de la
suite con `.className`/`.textContent`.

**Resultado del front tras la tanda: 37,18% de líneas (660/1.775)**, contra 33,59% antes. Umbral del
`vitest.config` subido de 32/25/34/33 a 36/29/37/37 (statements/branches/functions/lines) — sube con
esta tanda, no baja. Quedan abiertas las tandas admin, developer, investor, `project.$projectId.*`,
`components/` y `lib/`, y con ellas el paso 5. Siguiente candidata por tamaño: **admin**
(`admin.index.tsx`, 44 líneas, un solo archivo) — con la salvedad de que la spec la agrupa con
"compartidas", así que conviene mirar de cerca qué entra en esa tanda antes de arrancarla.

## Statements y branches, además de líneas — 2026-09-22

**No es el paso 5 ni un paso nuevo: es una vara más estricta que el dueño pidió sumar sobre lo que
esta spec ya mide.** §Qué se mide fija líneas como el criterio de cierre, y con eso las cuatro
partes TypeScript están cerradas o encaminadas. Pero v8 mide **cuatro** métricas, no una —
statements, branches, functions, lines— y las otras tres son más exigentes que líneas:

- **Branches:** para cubrir una rama hay que ejercitar **cada** salida de cada
  `if`/`? :`/`??`/`&&`/`switch`, no solo pasar una vez por la línea que la contiene. Un archivo con
  100% de líneas puede tener la mitad de sus branches sin tocar.
- **Statements:** una línea puede contener más de un statement (`a(); b();`, o un operador corto que
  no cuenta como branch pero sí como statement aparte); 100% de líneas no implica 100% de
  statements, y por eso el número de statements de la API (90,81%) queda seis puntos por debajo del
  de líneas (96,92%) aun con las tandas ya cerradas.

**2026-09-22 — se suma statements al mismo trato que branches.** Mismo argumento que ya valía para
branches: si igual vamos a perseguir tres de las cuatro métricas de v8 con la misma vara (95%), no
hay razón para dejar afuera la cuarta. Ni branches ni statements ni functions reemplazan ni bloquean
el criterio de cierre de §Criterio de cierre, que sigue siendo líneas — pero las tres se persiguen
en paralelo al paso 5, con el mismo trinquete que ya usa `vitest.config` (sube con cada tanda, no
baja).

Medido el 2026-09-22 (con `packages/shared` y `packages/cardano` reinstalados tras un `axe-core`
que estaba en el lockfile pero no en `node_modules` — `pnpm install --frozen-lockfile` lo resolvió;
no es un bug del repo, fue un `node_modules` desincronizado en esta sesión):

| Parte | Statements | Branches | Functions | Lines | Estado |
|---|---|---|---|---|---|
| `packages/shared` | **100%** (248/248) | 96,55% (56/58) | 100% (19/19) | 100% (232/232) | ✅ Cerrado — las 4 métricas ≥95% |
| `packages/cardano` | **99,66%** (295/296) | 96,81% (152/157) | 100% (90/90) | 99,63% (273/274) | ✅ Cerrado — las 4 métricas ≥95% |
| `apps/api` | **90,81%** (2.156/2.374) | 79,59% (893/1.122) | 96,50% (497/515) | 96,92% (2.019/2.083) | ⬜ Statements y branches por debajo de 95% |
| `apps/web` | **36,20%** (724/2.000) | 29,23% (573/1.960) | 37,22% (284/763) | 37,18% (660/1.775) | ⬜ Las 4 métricas por debajo — es el paso 5 |
| `contracts/` (Aiken) | — | 100% por la vara del repo — 51/51 mutantes muertos, 18/18 `expect` con test (§El triage del paso 6, cerrado) | — | sin métrica de líneas/statements (Aiken no las mide) | ✅ Cerrado, con su propia vara |

**`packages/shared` y `packages/cardano` quedan cerrados en las cuatro métricas** — no hace falta
volver a tocarlos para esta sección. Lo que queda es `apps/api` (statements y branches; functions y
lines ya están ≥95%) y `apps/web` (las cuatro, es literalmente el paso 5 con una vara más estricta:
cuando un archivo de `apps/web` llegue a 95% de líneas por el trabajo del paso 5, sus statements y
functions van a estar cerca o ya arriba de 95% también, porque en un archivo sin ninguna rama
compleja las cuatro métricas suben juntas — branches es la que se despega cuando el archivo sí tiene
lógica condicional, por eso las tablas de abajo la muestran aparte).

### `packages/cardano` — cerrado, 96,81% (commit `c2a59f2`)

De 149/157 (94,90%) a 152/157. Tres branches reales de `real.ts` sin ejercitar, las tres cubiertas
con tests nuevos en `real.test.ts`:

- **`findLiveThread`** (línea 331): `u.assets[unit] ?? 0n` nunca veía el lado `undefined` — ningún
  test tenía dos stages minteados en la misma dirección con unicidades distintas. Test nuevo: abrir
  un hilo y buscar un `stageRef` que no es el suyo, así el UTxO existe pero no lleva ese unit.
- **`verify()`** (línea 498): `if (!confirmado) return null` nunca corría con `awaitTx` devolviendo
  `false` sin tirar — solo se probaba el camino donde confirma. Test nuevo con
  `vi.spyOn(lucid, "awaitTx").mockResolvedValue(false)`.
- **`confirmedAt()`** (línea 543): el `: null` del `typeof cuerpo.block_time === "number" ? … :
  null` nunca corría con un 200 de Blockfrost sin el campo. Test nuevo con un `fetch` mockeado que
  responde `200` y body `{}`.

**Quedan 2 branches sin cubrir, y se dejan así a propósito:** los dos `assets.lovelace ?? 0n` de
`publishReferenceScript` (líneas 450 y 477). Son defensivos y genuinamente inalcanzables — un UTxO
real en Cardano siempre lleva `lovelace`, así que forzar ese camino exigiría mockear un estado que
no puede existir en la cadena, solo para "pintar verde" sin probar nada real. Mismo criterio que ya
documentan los dos casos irreductibles del paso 3 (`ordenarPorClave`, la guarda de
`publishReferenceScript` original).

### `apps/api` — en curso, 79,59% de branches / 90,81% de statements (medido 2026-09-22)

**Historia de las tandas ya cerradas**, cada una con su commit: `lib/params.ts` se borró en vez de
testearse (código muerto — `paramSeguro()` no lo importaba nadie, confirmado con grep; la garantía
que decía centralizar ya está duplicada a mano en `leerParam()` de `middlewares/auth.ts`);
`arrays.ts`, `upload.ts`, `pdf.ts` y `db.ts` llegaron a 100% con cuatro tests chicos y aislados
(`test/lib-arrays.test.ts`, `test/lib-upload.test.ts`, `test/utils-pdf.test.ts`,
`test/lib-db.test.ts`); `contracts.routes.ts` (50%→50% de branches, pero con la rama disyuntiva de
`GET /contracts/:contractId/releases` probada: dueño, miembro del proyecto, 403 y 404 — el `if
(!contrato)` del handler quedó documentado como inalcanzable, ver abajo), `users.routes.ts`
(50%→75%: `GET /users/:id` 404, `PATCH` con `fullName`/`isActive`/password real) y
`notary.routes.ts` (48,83%→72,09%: la disyunción de `kpis`, los 404 de firmar/rechazar, `signatures`
con la rama admin y paginación por cursor, el caso sin firmas, la cola de revisión con el nombre del
investor).

**Lo que sigue siendo el grueso: ~230 branches y ~220 statements, casi todo en las rutas grandes.**
No es mecánico — cada archivo tiene su propia lógica de permisos, rechazos y casos borde que hay que
leer para saber qué test falta, no solo "llamar la función con otro input". Las cuatro métricas por
archivo, ordenado por peor % de branches (medido 2026-09-22, después de las tandas de arriba):

| Archivo | Branches | Statements | Functions | Lines |
|---|---|---|---|---|
| `contracts.routes.ts` | 50,00% (2/4) | 88,88% (16/18) | 100% (3/3) | 100% (16/16) |
| `profile.routes.ts` | 62,50% (5/8) | 91,17% (31/34) | 100% (6/6) | 100% (31/31) |
| `developer.routes.ts` | 63,33% (38/60) | 87,50% (119/136) | 96,96% (32/33) | 96,69% (117/121) |
| `investor.routes.ts` | 65,27% (47/72) | 87,63% (163/186) | 100% (37/37) | 100% (157/157) |
| `evidence.routes.ts` | 66,66% (36/54) | 84,49% (109/129) | 95,00% (19/20) | 94,69% (107/113) |
| `public.routes.ts` | 66,66% (4/6) | 88,23% (15/17) | 100% (2/2) | 100% (14/14) |
| `certifier.routes.ts` | 68,18% (30/44) | 89,38% (101/113) | 100% (27/27) | 100% (98/98) |
| `projects-obra.routes.ts` | 68,75% (11/16) | 89,79% (44/49) | 100% (10/10) | 97,72% (43/44) |
| `projects.routes.ts` | 69,87% (58/83) | 88,32% (174/197) | 95,83% (46/48) | 97,05% (165/170) |
| `_shared.ts` | 70,00% (7/10) | 90,00% (18/20) | 100% (6/6) | 94,11% (16/17) |
| `capital.routes.ts` | 70,83% (17/24) | 86,86% (86/99) | 86,66% (26/30) | 92,77% (77/83) |
| `developer-comercial.routes.ts` | 70,96% (44/62) | 88,23% (120/136) | 96,55% (28/29) | 94,82% (110/116) |
| `notary.routes.ts` | 72,09% (31/43) | 91,00% (91/100) | 94,73% (18/19) | 98,85% (86/87) |
| `auth.routes.ts` | 75,00% (9/12) | 89,28% (25/28) | 100% (4/4) | 96,15% (25/26) |
| `notifications.routes.ts` | 75,00% (6/8) | 92,30% (24/26) | 100% (5/5) | 100% (23/23) |
| `users.routes.ts` | 75,00% (15/20) | 90,90% (60/66) | 92,30% (12/13) | 98,21% (55/56) |
| `stages.routes.ts` | 78,57% (22/28) | 88,46% (46/52) | 100% (6/6) | 97,87% (46/47) |
| `audit.routes.ts` | 81,25% (13/16) | 94,73% (36/38) | 100% (6/6) | 100% (33/33) |
| `developer-evidencia.routes.ts` | 87,03% (47/54) | 94,16% (113/120) | 94,73% (18/19) | 97,14% (102/105) |
| resto de `src/lib`, `src/domain`, `src/middlewares`, `src/db` | 70–98% | 80–98% | ya cerca | ya cerca |

**`contracts.routes.ts` no bajó de 50% de branches aunque se le sumaron tests** (commit de esta
sesión) — es el ejemplo a tener presente antes de perseguir un número sin leer el archivo: sus dos
branches sin cubrir (`if (!contrato)` en el handler y el `if (!matched) next()` de todo router
montado sobre oRPC) son **inalcanzables por HTTP**, documentado en el propio `vitest.config.mts` —
`evaluarDueño`/`evaluarProyecto` (`middlewares/auth.ts`) ya resuelven la existencia del contrato en
el `authorize({ alguna: [...] })` antes de que la request llegue al handler. Mismo patrón en
`public.routes.ts` (66,66%, el `if (!dossier)` post-`compileDossier` — la FK `Dossier.unitId →
Unit.id` es `ON DELETE CASCADE`, verificado insertando un huérfano a mano: la base lo rechaza) y en
`profile.routes.ts` (62,50%, las tres son `if (!matched) next()`). **Antes de escribir un test para
subir un número, confirmar que la rama es alcanzable** — un archivo puede quedar bajo el 95% para
siempre sin que sea un hueco real.

**La brecha es sobre todo de branches y statements, no de functions/lines.** La mayoría de estos
archivos ya está en 90–100% de `lines` y `functions` — el trabajo pendiente es la segunda pasada que
ya describe §Por qué son métricas distintas de la conversación: ejercitar el `else`/la rama de
rechazo, no una función nueva sin llamar. La excepción donde `functions` también queda bajo es
`capital.routes.ts` (86,66%, 4 sin llamar) — ahí hace falta además cubrir un handler entero, no solo
una rama suya.

### `developer.routes.ts` — cerrado el trabajo alcanzable, 76,67% (2026-09-22)

De 38/60 a 46/60. Reachable, y ya cerrado: `estimatedDelivery` al crear un proyecto (nunca se probó
con la fecha puesta), el atajo de "sin proyectos visibles" en `progress`/`documents`/`kpis` (un
developer sin ninguna membresía, `FIXTURES.ajeno`), `category`/`cursor` del audit log, y el `?? 0`
sobre `SUM(Contract.totalMinorUnits)` — que a diferencia de los `COUNT` del mismo archivo, si no hay
ningún contrato **da `NULL` de verdad**, y necesitó un developer nuevo sin ninguna otra membresía
(`FIXTURES.activo` ya es miembro de `torre-test`, que trae un contrato de 12.000.000 — sin aislar al
usuario, el `SUM` nunca da `NULL`). Quedan 14 sin cubrir, las 14 documentadas: 8 son `if (!matched)
next()` de cada wrapper oRPC, y 6 son 404/`?? 0` que `authorize`/la unicidad de fila ya resuelven
antes del handler (`GET /projects/:id`, `POST /documents` × 2 —`!documento` y `!sha256Hash`, este
último además imposible porque la columna es `NOT NULL`—, y los tres `COUNT(*) ?? 0`, que nunca dan
`NULL` a diferencia del `SUM`). **76,67% es el techo real de este archivo.**

### `investor.routes.ts` — sin trabajo posible, 65,27% ya es el techo (2026-09-22)

**Hallazgo, no una tanda:** las 36 ramas se leyeron una por una y las 25 sin cubrir están **todas**
justificadas — no hay ningún test legítimo que sumar acá. Catorce son el `if (!matched) next()` de
cada wrapper; nueve son un 404 que `authorize({ dueño: { via: "Unit"|"Invitation"|"ContractOfUnit" }
})` ya resuelve en el middleware antes de que el handler vuelva a preguntar (`unitDetail`,
`unitNews`, `dossier`, `export.pdf`, `share`, `invitationDetail`, `accept`, `decline`, `contract` —
los nueve usan `dueño`, que carga la fila para chequear pertenencia y por eso ya sabe si existe); una
es la misma garantía vista desde `dossierDeLaUnidad` (la función que las tres rutas de dossier
comparten, con 12 llamadas acumuladas y 0 en la rama "no existe"); y la última es el `?? 0` de
`avancePorProyecto` (`_shared.ts`), que por loop **siempre** setea un valor para cada id que recibe —
nunca puede faltar uno. No se tocó el archivo. **65,27% es el techo real.**

### `evidence.routes.ts` — cerrado el trabajo alcanzable, 75,93% (2026-09-22)

De 36/54 a 41/54. Cuatro ramas reales, las cuatro cerradas:

- **`PATCH /evidence/:id` con `stageId`** (nunca se probó): mover la evidencia a otro stage del
  MISMO proyecto (200), y un `stageId` de otro proyecto o inexistente (400 `"Stage does not belong
  to project"`, y la evidencia no se mueve).
- **`GET /:bundleId/proof/:fileHash` con un hash que no es del bundle** (404 `"That hash is not part
  of this bundle"`) — el bundle sí existe (pasa `authorize`), pero ese hash no está entre sus items.
- **Un bundle sin ningún `EvidenceBundleItem`** — el único camino real (`crearBundle`) inserta el
  bundle CON sus items en la misma operación, así que esto no se puede producir por HTTP. Se plantó
  la fila directo (`EvidenceBundle` sin ningún `EvidenceBundleItem`) para ejercitar la guarda igual:
  `authorize` ya confirmó que el `EvidenceBundle` existe —mira esa tabla—, y el 404 de acá depende de
  otra (`EvidenceBundleItem`, vacía) — dos preguntas distintas, y por eso no es el mismo caso
  inalcanzable que ya cerraron `contracts`/`public`/`profile`.

Quedan 13 sin cubrir, documentadas: 10 son `if (!matched) next()`; las otras 3 son 404 que
`authorize({ proyecto: { via: "Evidence"|"EvidenceBundle" } })` ya resuelve antes del handler
(`GET /:id`, `GET /:id/download`, `PATCH /:id`, `POST /:id/anchor`, `GET /:bundleId/files` — cinco
rutas, tres branches porque algunas comparten la misma verificación). **75,93% es el techo real.**

### El total, tras las tres — 2026-09-22

De 78,69%/90,81% a **80,74% de branches (906/1.122) y 91,28% de statements (2.167/2.374)**. Lines
subió a 97,26% y functions a 96,69% de arrastre (regla del apartado de arriba: cerrar una rama
cierra su statement al mismo tiempo). Umbral del `vitest.config` subido a 80/91/96/97
(branches/statements/functions/lines) — sube con esta tanda, no baja. `pnpm verify:all` completo en
verde (87 archivos, 614 tests).

**`packages/shared` y `packages/cardano` no se tocaron en esta tanda** — ya están cerrados en las
cuatro métricas, ver la tabla de arriba.

### `certifier.routes.ts` — cerrado el trabajo alcanzable, 75% (2026-09-22)

De 30/44 a 33/44 (68,18%→75%). Tres ramas reales, las tres cerradas: un verifier sin ningún proyecto
visible en `kpis` (el `ids.length ? ... : []` nunca corría con `ids` vacío — los cuatro contadores
dan 0 sin tocar `Stage`) y en `certificates` (el `if (visibles.length)` que evita reconciliar sin
alcance — `items: []`, sin llamar a `reconciliarParaLectura`), y `observe` sobre un stage que no está
en `InProgress` (409 — `certify` ya tenía su test de rechazo con el mismo patrón, `observe` no lo
tenía).

Las 11 ramas restantes son inalcanzables por HTTP, mismo patrón que ya cerraron
`contracts.routes.ts`/`public.routes.ts`/`profile.routes.ts`: 8 son el `if (!matched) next()` de
cada wrapper oRPC (una por ruta migrada), y 3 son 404 que `authorize()` ya resuelve en el middleware
antes de que el handler los vuelva a preguntar — `stageViewProcedure` (`authorize({ proyecto: { via:
"Stage" } })` ya carga el stage para chequear pertenencia), el `if (resultado.status === 404)`
compartido de `certify`/`observe` (la única forma en que `transitionStage` da 404 es
`STAGE_NOT_FOUND`, y ese stage ya pasó por el mismo chequeo antes de llegar al handler), y el
`if (!fila)` de `responderInvitacion` (`authorize({ dueño: { via: "CertifierInvitation" } })` ya
carga la invitación). Confirmado leyendo `evaluarProyecto`/`evaluarDueño` en `middlewares/auth.ts`,
no supuesto. **75% es el techo real de este archivo.**

**El total, con esta tanda:** de 80,74%/91,28% a **81,01% de branches (909/1.122) y 91,32% de
statements (2.168/2.374)**. Umbral del `vitest.config` subido a 81/91/96/97
(branches/statements/functions/lines) — sube con esta tanda, no baja. `pnpm verify:all` completo en
verde (87 archivos, 617 tests).

**Siguiente, cuando se retome:** de las rutas grandes que quedan, las candidatas reales —no
agotadas como `investor.routes.ts`/`certifier.routes.ts`— son `projects.routes.ts` (69,87%, 83
branches) y `developer-comercial.routes.ts` (70,96%, 62 branches; sus dos ramas de bajo valor ya
están documentadas, ver §El paso 4 (API) arriba). Antes de escribir un test para cualquier rama
nueva: **primero confirmar que `authorize()` no la resuelve ya en el middleware** (el patrón que
vació `investor.routes.ts` y `certifier.routes.ts` de trabajo posible) — leer `middlewares/auth.ts`
§`evaluarProyecto`/`evaluarDueño` si hay dudas, no asumir por la forma del `if`.

### Statements sube con branches, no aparte — 2026-09-22

**No hace falta perseguir statements como un trabajo propio: en la API sube casi 1:1 con branches.**
Cruzando los 218 statements sin cubrir contra sus líneas exactas (`coverage-final.json`, campo `s`)
contra la tabla de branches de arriba, casi todos coinciden — son el **cuerpo** de una rama que ya
está en la tabla: el `if (!matched) next()` de cada router montado sobre oRPC, los `if (!x) throw
NOT_FOUND` que `contracts.routes.ts`/`public.routes.ts` ya documentan como inalcanzables, y las
ramas de error/permiso que van cayendo archivo por archivo. Branches cuenta la *decisión*; statements
cuenta el *statement de adentro* — dos contadores sobre la misma falla, no dos huecos distintos.

**Las excepciones, y son pocas — vale la pena mirarlas aparte cuando se llegue a esos archivos:**

- **`app.ts` (6 statements, líneas 107-112 y 206) no está en ninguna tabla de branches** porque
  nunca se llamó por HTTP: `GET /health` (con su `try/catch` contra la base) y el fallback 404 al
  final del middleware chain. Dos tests chicos y directos —`GET /health` en verde, y una ruta
  inexistente devolviendo `{message:"Not found"}`— cierran las cuatro métricas del archivo entero.
- **`db/migrate.ts:195` y `db/seed.ts:171-177`** son el cuerpo de `if (require.main === module)` —
  el guardia que existe **a propósito** para que importar el módulo desde un test no dispare una
  migración/seed completa como efecto secundario (documentado en el propio comentario del archivo,
  ver §El paso 4, tanda 3). Correrlos de verdad exigiría invocar el script como proceso hijo
  (`node dist/db/migrate.js`), y ahí la cobertura de V8 no cuenta nada: el instrumentado vive en el
  proceso de Vitest, no en el hijo. Quedan sin cubrir **por diseño**, no por falta de test.
- **El resto de la lista** (`notary.routes.ts:149`, `users.routes.ts:179`, `capital.routes.ts`
  ×4, `developer.routes.ts:619`, `evidence.routes.ts:518`, `developer-evidencia.routes.ts:518`,
  `developer-comercial.routes.ts:432`, `projects.routes.ts:311,527`, `instrumentation.ts:162`) sí son
  alcanzables — son callbacks (`.reduce`/`.sort`/`.filter`) que ningún test llegó a ejercitar porque
  la data de prueba nunca tuvo el caso que los dispara (p. ej. `capital.routes.ts` necesita un
  proyecto con contratos y releases reales, no un array vacío). Se cierran solos cuando se ataque la
  rama de branches del mismo archivo — no hace falta una pasada aparte.

**La misma relación vale para `packages/cardano`: su único statement sin cubrir (`real.ts:468`) es
el mismo que su única branch documentada como irreducible** (§El paso 3, arriba) — la guarda de
`publishReferenceScript` contra una transacción que Lucid reporta exitosa sin dejar el output
prometido. `packages/shared` ya está en 100% de statements/lines/functions; sus dos branches sin
cubrir (`auth.ts:36-37`) no arrastran ningún statement propio porque son las dos ramas de un mismo
`.refine()` de una sola línea.

### ¿Se puede llegar a 100% literal en lines/functions/statements? — 2026-09-22

**Casi, pero no del todo, y no conviene forzarlo.** Con branches aparte (esa sí tiene huecos reales
y grandes, ver la tabla de `apps/api` arriba), lo que falta en lines/functions/statements se separa
en dos grupos:

1. **Alcanzable, y vale la pena cerrarlo** — el `GET /health`/404 de `app.ts` de arriba, y los
   callbacks de `capital.routes.ts` y compañía que solo necesitan datos de prueba más completos. Es
   trabajo chico, y cae solo al hacer el paso de branches archivo por archivo.
2. **Genuinamente inalcanzable dentro del proceso de test, por diseño:** los guardias
   `if (require.main === module)` de `migrate.ts`/`seed.ts` (existen **para impedir** que el import
   dispare el efecto secundario — la garantía que los sostiene es exactamente la misma razón por la
   que un test no puede cruzarlos) y la guarda irreducible de `real.ts:468` en `cardano` (documentada
   desde el paso 3, requiere mockear internals de la librería de firma para simular algo que Lucid no
   puede reportar de verdad). Ninguno se cierra escribiendo un test mejor — se cierra debilitando la
   protección que el propio código pone a propósito, que es peor que dejarlo sin cubrir.

**Por eso el techo realista no es 100,00% sino algo como 99,7-99,9%** una vez que el grupo 1 esté
cerrado — y eso es correcto, no una deuda. La spec ya tiene el criterio para esto, aplicado antes a
branches (`contracts.routes.ts`, `public.routes.ts`, `profile.routes.ts`): un archivo con una rama
inalcanzable **documentada** cuenta como cerrado igual, porque el 95% (o el 100% que este apartado
discute) es una vara para encontrar huecos reales, no un número a perseguir a cualquier costo — regla
que ya fija §Qué no se hace: *"no se escriben tests que ejecuten código sin afirmar nada"*. Forzar
estos tres puntos específicos (los dos guardias + la guarda de Lucid) violaría esa regla o D-042 (no
debilitar una protección para que un test la cruce). El techo práctico de cada parte, con eso:

| Parte | Techo realista (statements/lines/functions) | Por qué no es 100% |
|---|---|---|
| `packages/shared` | **100%** — ya está | — |
| `packages/cardano` | ~99,7% | 1 statement (`real.ts:468`, guarda irreducible) |
| `apps/api` | ~99,8-99,9% tras cerrar el grupo 1 | 4 statements (los dos guardias `require.main`) |
| `apps/web` | 100% es plausible una vez cerrado el paso 5 | sin guardias de este tipo detectados hoy — a confirmar cuando se llegue ahí |

### `apps/web` — detalle completo por archivo (medido 2026-09-22)

**117 archivos con código propio en `src/`; 27 ya están al 100% en las cuatro métricas** (sobre todo
`routes/notary.*`/`certifier.*` de las tandas cerradas, y utilidades chicas). Los otros **90** están
acá, para que la próxima sesión implemente tests directo desde esta tabla sin tener que remedir
nada. Dos grupos, porque el trabajo que piden es distinto.

**Grupo A — 40 archivos en 0% en las cuatro métricas: ningún test los toca todavía.** Son las
tandas del paso 5 que faltan (`developer.*`, `investor.*`, `project.$projectId.*`, `admin.index.tsx`)
más un puñado de archivos de infraestructura (`main.tsx`, `router.tsx`, `useSession.ts`, `__root.tsx`,
`blobUrls.ts`, `observability.ts`, `ProjectCard.tsx`, `ActionCard.tsx`) que **no** son parte de
ninguna tanda por rol y conviene tratar aparte. Ordenados por tamaño (statements totales, la mejor
proxy de esfuerzo — más statements no siempre es más branches, pero correlaciona):

| Archivo | Statements | Archivo | Statements |
|---|---|---|---|
| `routes/investor.unit.$unitId.index.tsx` | 87 | `routes/investor.unit.$unitId.notifications.tsx` | 29 |
| `routes/project.$projectId.stage.$stageId.tsx` | 83 | `routes/investor.unit.$unitId.dossier.tsx` | 30 |
| `routes/investor.buy.tsx` | 78 | `routes/developer.units.tsx` | 32 |
| `components/domain/LocationMapModal.tsx` | 82 | `routes/developer.progress.tsx` | 43 |
| `routes/project.$projectId.index.tsx` | 68 | `routes/investor.notifications.tsx` | 44 |
| `routes/developer.project.$projectId.upload.tsx` | 67 | `routes/admin.index.tsx` | 49 |
| `routes/developer.project.$projectId.units.tsx` | 55 | `routes/developer.audit-log.tsx` | 40 |
| `routes/developer.capital.tsx` | 21 | `routes/developer.project.$projectId.invite.tsx` | 36 |
| `routes/developer.documentation.tsx` | 22 | `routes/project.$projectId.progress.tsx` | 34 |
| `routes/developer.project.$projectId.contracts.tsx` | 21 | `routes/investor.unit.$unitId.contract.tsx` | 28 |
| `routes/developer.project.$projectId.index.tsx` | 20 | `routes/project.$projectId.developer.tsx` | 24 |
| `routes/investor.favorites.tsx` | 17 | `routes/developer.projects.tsx` | 15 |
| `auth/useSession.ts` | 10 | `routes/developer.index.tsx` | 13 |
| `routes/investor.units.tsx` | 11 | `routes/developer.investors.tsx` | 10 |
| `routes/investor.menu.tsx` | 10 | `lib/blobUrls.ts` | 10 |
| `routes/developer.profile.tsx` | 8 | `routes/index.tsx` | 7 |
| `routes/public.dossier.$shareToken.tsx` | 7 | `main.tsx` | 7 |
| `components/domain/ProjectCard.tsx` | 6 | `lib/observability.ts` | 6 |
| `routes/investor.profile.tsx` | 5 | `router.tsx` | 2 |
| `components/domain/ActionCard.tsx` | 1 | `routes/__root.tsx` | 2 |

**Grupo B — 50 archivos con cobertura parcial: ya tienen algún test, falta terminarlos.** Acá sí
vale la pena ir archivo por archivo (branches suele ser la métrica que arrastra, no líneas), sin
esperar a ninguna tanda:

| Archivo | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| `routes/developer.project.new.tsx` | 13,63% (3/22) | 0% (0/14) | 12,5% (1/8) | 15% (3/20) |
| `components/domain/ShareDossierModal.tsx` | 33,33% (1/3) | 0% (0/2) | 33,33% (1/3) | 33,33% (1/3) |
| `components/domain/TxidModal.tsx` | 33,33% (1/3) | 0% (0/2) | 33,33% (1/3) | 33,33% (1/3) |
| `components/PanelLayout.tsx` | 36% (9/25) | 37,5% (9/24) | 50% (2/4) | 36,36% (8/22) |
| `lib/investor.ts` | 48,57% (17/35) | 35,29% (12/34) | 61,53% (8/13) | 44% (11/25) |
| `components/ProfileScreen.tsx` | 46,15% (12/26) | 50% (13/26) | 20% (2/10) | 48% (12/25) |
| `lib/explorer.ts` | 50% (1/2) | 100% (2/2) | 0% (0/1) | 50% (1/2) |
| `lib/stageProgress.ts` | 54,54% (12/22) | **100%** (10/10) | 75% (6/8) | 43,75% (7/16) |
| `components/domain/InvitationAcceptModal.tsx` | 60% (3/5) | 50% (9/18) | 50% (2/4) | 60% (3/5) |
| `components/domain/ObserveStageModal.tsx` | 62,5% (5/8) | 71,42% (5/7) | 50% (2/4) | 62,5% (5/8) |
| `components/domain/DocumentViewerModal.tsx` | 66,66% (2/3) | 58,33% (7/12) | 50% (1/2) | 66,66% (2/3) |
| `components/domain/MerkleRootProof.tsx` | 66,66% (2/3) | 58,33% (7/12) | 66,66% (2/3) | 66,66% (2/3) |
| `components/domain/ReleaseProofList.tsx` | 66,66% (2/3) | 75% (3/4) | 66,66% (2/3) | 66,66% (2/3) |
| `components/domain/SelectDropdown.tsx` | 66,66% (2/3) | 58,33% (7/12) | 66,66% (2/3) | 66,66% (2/3) |
| `components/ui/dialog.tsx` | 66,66% (8/12) | 50% (3/6) | 70% (7/10) | 66,66% (8/12) |
| `components/domain/AnchoringSuccessModal.tsx` | 72,72% (8/11) | 50% (4/8) | 50% (2/4) | 80% (8/10) |
| `auth/session.ts` | 72,72% (8/11) | 66,66% (4/6) | 100% (3/3) | 88,88% (8/9) |
| `components/domain/ProgressTimeline.tsx` | 75% (3/4) | 55,55% (10/18) | 66,66% (2/3) | 75% (3/4) |
| `components/domain/FileDropzone.tsx` | 75% (21/28) | 61,53% (16/26) | 60% (6/10) | 81,81% (18/22) |
| `i18n/locale.ts` | 76,92% (10/13) | 75% (6/8) | 100% (3/3) | 90,9% (10/11) |
| `components/domain/NumberInput.tsx` | 76,92% (10/13) | 70% (21/30) | 83,33% (5/6) | 90% (9/10) |
| `i18n/format.ts` | 77,77% (14/18) | 100% (7/7) | 62,5% (5/8) | 75% (12/16) |
| `components/domain/ImageGalleryModal.tsx` | 81,25% (13/16) | 63,63% (7/11) | 71,42% (5/7) | 81,81% (9/11) |
| `lib/money.ts` | 90,9% (10/11) | 92,85% (13/14) | 100% (2/2) | 100% (8/8) |
| `lib/evidenceFiles.ts` | 91,83% (45/49) | 81,81% (27/33) | 100% (4/4) | 97,67% (42/43) |
| `components/domain/HashChip.tsx` | 92,85% (13/14) | 94,44% (17/18) | 75% (3/4) | 100% (12/12) |
| `routes/-test-mount.tsx` | 95% (19/20) | 100% (3/3) | 88,88% (8/9) | 95% (19/20) |
| `i18n/useTranslation.tsx` | 96% (24/25) | 75% (6/8) | 100% (9/9) | 100% (22/22) |
| `auth/useRoleGuard.ts` | 96,42% (27/28) | 75% (12/16) | 100% (4/4) | 100% (26/26) |
| `routes/notary.dossier.$dossierId.tsx` | 96,29% (26/27) | 90,9% (20/22) | 90,9% (10/11) | 96,15% (25/26) |
| `routes/certifier.stage.$stageId.tsx` | 96,42% (27/28) | 95,83% (23/24) | 90,9% (10/11) | 96,29% (26/27) |
| `api/port.ts` | 97,61% (123/126) | 89,79% (44/49) | 100% (75/75) | 100% (112/112) |
| `routes/login.tsx` | 100% (36/36) | 88,88% (16/18) | 100% (6/6) | 100% (34/34) |
| `routes/certifier.index.tsx` | 100% (20/20) | 95% (19/20) | 100% (7/7) | 100% (18/18) |
| `routes/certifier.issued.tsx` | 100% (10/10) | 81,25% (13/16) | 100% (3/3) | 100% (9/9) |
| `routes/notary.index.tsx` | 100% (8/8) | 91,66% (11/12) | 100% (1/1) | 100% (7/7) |
| `routes/notary.signed.tsx` | 100% (9/9) | 92,85% (13/14) | 100% (3/3) | 100% (8/8) |
| `components/domain/BottomNav.tsx` | 100% (4/4) | 66,66% (4/6) | 100% (4/4) | 100% (3/3) |
| `components/domain/BuildingSchematic.tsx` | 100% (13/13) | 75% (6/8) | 100% (9/9) | 100% (10/10) |
| `components/domain/Chips.tsx` | 100% (6/6) | 61,53% (8/13) | 100% (3/3) | 100% (6/6) |
| `components/domain/DocumentCard.tsx` | 100% (2/2) | 80% (16/20) | 100% (1/1) | 100% (2/2) |
| `components/domain/GradientHeader.tsx` | 100% (4/4) | 87,5% (14/16) | 100% (2/2) | 100% (4/4) |
| `components/domain/InvestorCard.tsx` | 100% (4/4) | 50% (5/10) | 100% (3/3) | 100% (4/4) |
| `components/domain/LanguageToggle.tsx` | 100% (7/7) | 75% (3/4) | 100% (3/3) | 100% (6/6) |
| `components/domain/NotificationCard.tsx` | 100% (3/3) | 71,42% (10/14) | 100% (1/1) | 100% (3/3) |
| `components/domain/ProgressBar.tsx` | 100% (2/2) | 50% (1/2) | 100% (1/1) | 100% (2/2) |
| `components/domain/StatCard.tsx` | 100% (3/3) | 47,36% (9/19) | 100% (1/1) | 100% (3/3) |
| `components/domain/TextInput.tsx` | 100% (4/4) | 53,84% (7/13) | 100% (2/2) | 100% (4/4) |
| `components/domain/ToggleSwitch.tsx` | 100% (2/2) | 75% (6/8) | 100% (2/2) | 100% (2/2) |
| `components/domain/UnitCard.tsx` | 100% (5/5) | 57,14% (8/14) | 100% (1/1) | 100% (5/5) |

**`lib/stageProgress.ts` es un caso raro, a propósito: 100% de branches con solo 43,75% de líneas
(7/16).** No es un error de medición — el archivo tiene ramas cortas (`? :`, `??`) que un único
camino ya ejercita en las dos direcciones, pero le sobran líneas (funciones enteras) que nadie
llama. Ahí lo que falta no es una rama, es un test que invoque la función completa — mismo patrón
que `capital.routes.ts` en `api` (§`apps/api`, arriba).

**`routes/developer.project.new.tsx` es la única ruta con algo de cobertura fuera de las tandas
cerradas** (Grupo B) — no está en 0% como sus 14 hermanas de `developer.*` (Grupo A), así que si se
arranca la tanda `developer` conviene empezar por ahí.

**Siguiente, cuando se retome `apps/web` (paso 5):** seguir el orden que la spec ya fija —
`developer` → `investor` → `project.$projectId.*` → `admin` (Grupo A, 0%, con el patrón
`-test-mount.tsx`/`montarRuta`/`autenticarComo` que cerró `notary` y `certifier`) — y en paralelo,
sin depender de esas tandas, terminar el Grupo B: son componentes y utilidades ya usadas por varias
pantallas, así que cerrarlos ahora no se repite después. Las cuatro métricas de un archivo del Grupo
A van a subir juntas cuando se le escriba su primer test — es branches lo que se despega recién en
un archivo con lógica condicional real (ver Grupo B).
