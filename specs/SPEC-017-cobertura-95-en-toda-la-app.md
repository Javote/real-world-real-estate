# SPEC-017 — 95% de cobertura con unit tests, en toda la app

> Nace el 2026-09-21. El criterio 2 del SOM dice *"unit tests ≥95% coverage"*, sin acotar a qué parte
> del código. Hasta hoy se leía como "los contratos": `specs/README.md` lo daba ✅ con la tabla de
> puntos de rechazo de Aiken. **El dueño lo releyó el 2026-09-21: el 95% es de toda la app, y separar
> una parte es artificial.** Esta spec cierra esa distancia.
>
> Nivel 🟢 (tests). Toca configuración de CI (🟡) solo en el paso 7. **Es la única spec abierta del
> repo**: las demás están cerradas o postergadas a propósito (ver `specs/README.md`).

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

## Branches, además de líneas — 2026-09-22

**No es el paso 5 ni un paso nuevo: es una vara más estricta que el dueño pidió sumar sobre lo que
esta spec ya mide.** §Qué se mide fija líneas como el criterio de cierre, y con eso las cuatro
partes TypeScript están cerradas o encaminadas. Pero **branches** (v8 mide las cuatro métricas
igual: statements, branches, functions, lines) es más exigente — para cubrir una rama hay que
ejercitar **cada** salida de cada `if`/`? :`/`??`/`&&`/`switch`, no solo pasar una vez por la línea
que la contiene. Un archivo con 100% de líneas puede tener la mitad de sus branches sin tocar. Esta
sección registra el trabajo sobre esa métrica, en paralelo al paso 5 — no lo reemplaza ni lo
bloquea, y no es parte del criterio de cierre de §Criterio de cierre.

Medido el 2026-09-22, las tres métricas por parte (`lines` ya es la que mide §Qué se mide; se repite
acá al lado de las otras dos para tener las tres juntas):

| Parte | Branches | Functions | Lines |
|---|---|---|---|
| `packages/cardano` | **96,81%** (152/157) — cerrado hoy | 100% (90/90) | 99,63% (273/274) |
| `packages/shared` | 96,55% (56/58) — ya venía así del cierre del paso 2 | 100% (19/19) | 100% (232/232) |
| `apps/api` | **78,25%** (878/1.122) — trabajado hoy, falta la mayoría | 95,92% (494/515) | 96,63% (2.013/2.083) |
| `apps/web` | ~29% — sin tocar esta sesión | ~37% | ~37% |
| `contracts/` (Aiken) | 100% por la vara del repo — 51/51 mutantes muertos, 18/18 `expect` con test (§El triage del paso 6, cerrado) | — | sin métrica de líneas (Aiken no la mide) |

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

### `apps/api` — empezado, 78,25% (commit `7bbf971`), falta la mayor parte

De 873/1.124 (77,67%) a 878/1.122. Dos piezas:

**`lib/params.ts` se borró en vez de testearse.** `paramSeguro()` no lo importaba nada en `src/` ni
en `test/` — código muerto, confirmado con grep antes de tocarlo. La garantía que decía centralizar
ya está duplicada a mano en `leerParam()` de `middlewares/auth.ts`. Sus 2 branches sin cobertura
eran del tipo correcto de hallazgo: no "falta un test", sino "esto no debería existir".

**`arrays.ts`, `upload.ts`, `pdf.ts` y `db.ts` a 100%.** Cuatro tests unitarios chicos y aislados
(`test/lib-arrays.test.ts`, `test/lib-upload.test.ts`, `test/utils-pdf.test.ts`,
`test/lib-db.test.ts`): el out-of-bounds de `en()`, el fallback de `UPLOAD_DIR` sin la env var
(aislado con `vi.resetModules()`, mismo patrón para los dos defaults de `lib/db.ts` sin
`DATABASE_URL`/con `DATABASE_AUTH_TOKEN`), y el wrap de una línea más larga que `ANCHO_LINEA` en el
PDF del dossier.

**Lo que falta es el grueso: ~190 branches, casi todo en las rutas grandes.** A diferencia de los
archivos de arriba, no es mecánico — cada uno tiene su propia lógica de permisos, rechazos y casos
borde que hay que leer para saber qué test falta, no solo "llamar la función con otro input". Las
tres métricas por archivo, ordenado por peor % de branches (`functions` y `lines` ya están cerca o
en 100% en casi todos — es branches lo que arrastra):

| Archivo | Branches | Functions | Lines |
|---|---|---|---|
| `notary.routes.ts` | 48,83% (21/43) | 78,94% (15/19) | 93,10% (81/87) |
| `contracts.routes.ts` | 50,00% (2/4) | 100% (3/3) | 100% (16/16) |
| `users.routes.ts` | 50,00% (10/20) | 92,30% (12/13) | 96,42% (54/56) |
| `profile.routes.ts` | 62,50% (5/8) | 100% (6/6) | 100% (31/31) |
| `developer.routes.ts` | 63,33% (38/60) | 96,96% (32/33) | 96,69% (117/121) |
| `investor.routes.ts` | 65,27% (47/72) | 100% (37/37) | 100% (157/157) |
| `public.routes.ts` | 66,66% (4/6) | 100% (2/2) | 100% (14/14) |
| `evidence.routes.ts` | 66,66% (36/54) | 95,00% (19/20) | 94,69% (107/113) |
| `certifier.routes.ts` | 68,18% (30/44) | 100% (27/27) | 100% (98/98) |
| `projects-obra.routes.ts` | 68,75% (11/16) | 100% (10/10) | 97,72% (43/44) |
| `projects.routes.ts` | 69,87% (58/83) | 95,83% (46/48) | 97,05% (165/170) |
| `_shared.ts` | 70,00% (7/10) | 100% (6/6) | 94,11% (16/17) |
| `migrate.ts` | 70,58% (12/17) | 91,66% (11/12) | 90,00% (36/40) |
| `capital.routes.ts` | 70,83% (17/24) | 86,66% (26/30) | 92,77% (77/83) |
| `developer-comercial.routes.ts` | 70,96% (44/62) | 96,55% (28/29) | 94,82% (110/116) |
| resto de `src/lib`, `src/domain`, `src/middlewares` | 82–94% | ya cerca | ya cerca |

**La brecha es casi toda de branches, no de functions/lines.** La mayoría de estos archivos ya está
en 90-100% de `lines` y `functions` — el trabajo pendiente es la segunda pasada que ya describe
§Por qué son métricas distintas de la conversación: ejercitar el `else`/la rama de rechazo, no una
función nueva sin llamar. Las tres excepciones donde `functions` también queda bajo son
`notary.routes.ts` (78,94%, 4 funciones sin llamar) y `capital.routes.ts` (86,66%, 4 sin llamar) —
ahí hace falta además cubrir un handler entero, no solo una rama suya.

**Siguiente, cuando se retome: `notary.routes.ts`** (peor %), después bajando por la tabla. Mismo
patrón que `cardano`: leer el archivo, identificar la rama de error/permiso sin ejercitar, un test
por rama, `pnpm verify:all`, commit y push por archivo (o por tanda chica), no todo junto.

**`packages/shared` no se tocó esta sesión para branches** — ya está en 96,55% desde el cierre del
paso 2 (dos ramas de `auth.ts:36-37` sin cubrir juntas en el mismo test, documentadas ahí como fuera
de alcance de la spec).

### `apps/web` — sin empezar, detalle por archivo (medido 2026-09-22, no trabajado esta sesión)

A diferencia de `api`, acá **branches y líneas son casi el mismo número** todavía: las tandas de
paso 5 que faltan (`developer`, `investor`, `project.$projectId.*`, `admin`) están en **0% en las
tres métricas a la vez** — no hay ninguna rama parcialmente cubierta que perseguir ahí, porque
ningún test toca esos archivos todavía. Por eso el detalle útil hoy es agregado por tanda, no
archivo por archivo — archivo por archivo ya lo da la tabla de §El paso 5 (líneas), y branches ahí
va a subir junto con líneas cuando se escriban esos tests, con el patrón de `-test-mount.tsx` que ya
usan `notary`/`certifier`.

| Grupo | Archivos | Lines | Branches | Functions |
|---|---|---|---|---|
| `developer.*` | 15 | 0,8% (3/365) | 0,0% (0/383) | 0,7% (1/138) |
| `investor.*` | 10 | 0,0% (0/309) | 0,0% (0/357) | 0,0% (0/149) |
| `project.$projectId.*` (compartidas) | 4 | 0,0% (0/185) | 0,0% (0/275) | 0,0% (0/91) |
| `admin.index.tsx` | 1 | 0,0% (0/44) | 0,0% (0/44) | 0,0% (0/19) |
| `components/` | 48 | 60,7% (207/341) | 54,1% (296/547) | 65,2% (105/161) |
| `lib/` | 11 | 69,0% (87/126) | 67,3% (72/107) | 69,2% (27/39) |
| `auth/` + `i18n/` + `api/` | 10 | 92,6% (199/215) | 82,3% (79/96) | 95,2% (99/104) |
| otras rutas (`login`, `public.dossier`, `index`, `__root`) | 5 | 76,8% (53/69) | 57,6% (19/33) | 66,7% (14/21) |
| `certifier.*` (tanda cerrada) | 5 | 98,4% (62/63) | 92,2% (59/64) | 95,7% (22/23) |
| `notary.*` (tanda cerrada) | 5 | 98,0% (49/50) | 92,3% (48/52) | 94,1% (16/17) |

**`components/` y `lib/` sí tienen cobertura parcial hoy, y ahí branches sí vale la pena archivo por
archivo** — son componentes compartidos que ya usan varias pantallas, así que cerrarlos ahora no
espera a ninguna tanda de rutas:

| Archivo | Branches | Lines | Functions |
|---|---|---|---|
| `components/domain/ActionCard.tsx` | 0% (0/16) | 0% (0/1) | 0% (0/1) |
| `components/domain/LocationMapModal.tsx` | 0% (0/48) | 0% (0/73) | 0% (0/16) |
| `components/domain/ProjectCard.tsx` | 0% (0/39) | 0% (0/6) | 0% (0/3) |
| `components/domain/ShareDossierModal.tsx` | 0% (0/2) | 33,3% (1/3) | 33,3% (1/3) |
| `components/domain/TxidModal.tsx` | 0% (0/2) | 33,3% (1/3) | 33,3% (1/3) |
| `lib/observability.ts` | 0% (0/6) | 0% (0/6) | 0% (0/1) |
| `lib/investor.ts` | 35,3% (12/34) | 44,0% (11/25) | 61,5% (8/13) |
| `components/PanelLayout.tsx` | 37,5% (9/24) | 36,4% (8/22) | 50,0% (2/4) |
| `components/domain/StatCard.tsx` | 47,4% (9/19) | 100% (3/3) | 100% (1/1) |
| `components/ProfileScreen.tsx` | 50,0% (13/26) | 48,0% (12/25) | 20,0% (2/10) |
| `components/domain/AnchoringSuccessModal.tsx` | 50,0% (4/8) | 80,0% (8/10) | 50,0% (2/4) |
| `components/domain/InvestorCard.tsx` | 50,0% (5/10) | 100% (4/4) | 100% (3/3) |
| `components/domain/InvitationAcceptModal.tsx` | 50,0% (9/18) | 60,0% (3/5) | 50,0% (2/4) |
| `components/ui/dialog.tsx` | 50,0% (3/6) | 66,7% (8/12) | 70,0% (7/10) |
| `components/domain/TextInput.tsx` | 53,8% (7/13) | 100% (4/4) | 100% (2/2) |
| `components/domain/ProgressTimeline.tsx` | 55,5% (10/18) | 75,0% (3/4) | 66,7% (2/3) |
| `components/domain/UnitCard.tsx` | 57,1% (8/14) | 100% (5/5) | 100% (1/1) |
| `components/domain/DocumentViewerModal.tsx` | 58,3% (7/12) | 66,7% (2/3) | 50,0% (1/2) |
| `components/domain/MerkleRootProof.tsx` | 58,3% (7/12) | 66,7% (2/3) | 66,7% (2/3) |
| `components/domain/SelectDropdown.tsx` | 58,3% (7/12) | 66,7% (2/3) | 66,7% (2/3) |
| `components/domain/Chips.tsx` | 61,5% (8/13) | 100% (6/6) | 100% (3/3) |
| `components/domain/FileDropzone.tsx` | 61,5% (16/26) | 81,8% (18/22) | 60,0% (6/10) |
| `components/domain/ImageGalleryModal.tsx` | 63,6% (7/11) | 81,8% (9/11) | 71,4% (5/7) |
| `components/domain/BottomNav.tsx` | 66,7% (4/6) | 100% (3/3) | 100% (4/4) |
| `components/domain/NumberInput.tsx` | 70,0% (21/30) | 90,0% (9/10) | 83,3% (5/6) |
| `components/domain/NotificationCard.tsx` | 71,4% (10/14) | 100% (3/3) | 100% (1/1) |
| `components/domain/ObserveStageModal.tsx` | 71,4% (5/7) | 62,5% (5/8) | 50,0% (2/4) |
| `components/domain/BuildingSchematic.tsx` | 75,0% (6/8) | 100% (10/10) | 100% (9/9) |
| `components/domain/LanguageToggle.tsx` | 75,0% (3/4) | 100% (6/6) | 100% (3/3) |
| `components/domain/ReleaseProofList.tsx` | 75,0% (3/4) | 66,7% (2/3) | 66,7% (2/3) |
| `components/domain/ToggleSwitch.tsx` | 75,0% (6/8) | 100% (2/2) | 100% (2/2) |
| `components/domain/DocumentCard.tsx` | 80,0% (16/20) | 100% (2/2) | 100% (1/1) |
| `lib/evidenceFiles.ts` | 81,8% (27/33) | 97,7% (42/43) | 100% (4/4) |
| `components/domain/GradientHeader.tsx` | 87,5% (14/16) | 100% (4/4) | 100% (2/2) |
| `lib/money.ts` | 92,8% (13/14) | 100% (8/8) | 100% (2/2) |
| `components/domain/HashChip.tsx` | 94,4% (17/18) | 100% (12/12) | 75,0% (3/4) |

**`lib/stageProgress.ts` es un caso raro, a propósito: 100% de branches con solo 43,8% de líneas
(7/16).** No es un error de medición — el archivo tiene ramas cortas (`? :`, `??`) que un único
camino ya ejercita en las dos direcciones, pero le sobran líneas (funciones enteras) que nadie
llama. Ahí lo que falta no es una rama, es un test que invoque la función completa — mismo patrón
que `notary.routes.ts`/`capital.routes.ts` en `api`.

**`developer.project.new.tsx` (15,0% líneas, 20 líneas) es la única ruta con algo de cobertura
fuera de las tandas cerradas** — no está en 0% como sus 14 hermanas de `developer.*`, así que si se
arranca la tanda `developer` conviene empezar por ahí.

**Siguiente, cuando se retome `apps/web` (paso 5):** seguir el orden que la spec ya fija —
`developer` → `investor` → `project.$projectId.*` → `admin` — con el mismo patrón
`-test-mount.tsx`/`montarRuta`/`autenticarComo` que cerró `notary` y `certifier`. Branches sube solo
con eso, sin trabajo aparte, salvo en `components/`/`lib/` (arriba), que se puede adelantar en
paralelo porque no depende de ninguna tanda de rutas.
