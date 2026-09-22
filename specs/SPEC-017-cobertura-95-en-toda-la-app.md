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

**Cerrado 2026-09-22.** Los 15 tests del triage están escritos, uno por commit. La corrida nueva da
**51 mutantes: 50 muertos, 1 vivo** (`stage.ak:91`, la equivalencia genuina de la tabla de arriba,
documentada y no forzada) y **18 `expect`: 18 con test**. `contracts/CLAUDE.md` §Coverage cita el
resultado. El paso 6 de esta spec queda cerrado; los pasos 1-5 y 7 (las cuatro partes TypeScript y
CI) siguen abiertos.
