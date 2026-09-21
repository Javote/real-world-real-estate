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
ejecuta al menos un test automático (unit o integración, ver abajo). No es la proporción de tests en verde, que ya es 100% en las cinco
partes (1.845 pasan, 3 omitidos a propósito, 0 fallan — `specs/evidencia-m3/1-repo-ci-tests/`).

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
