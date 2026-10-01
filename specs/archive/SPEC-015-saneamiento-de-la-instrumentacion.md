# SPEC-015 — Saneamiento de la instrumentación

> Auditoría del 2026-08-24 sobre estructura, tests, base, CI y artefactos. Siete cambios acotados;
> **ninguno toca el dominio**. El orden de ejecución no es el de gravedad, y la diferencia está
> explicada abajo.

> **Cerrada el 2026-09-11.** Los siete cambios están hechos. El 6 se cerró **reformulado**, no
> ejecutado como estaba escrito: ver §El ítem 6 al final. Los otros seis se cerraron tal cual.

## Propósito

La gobernanza del proyecto (docs inmutables, `DECISIONS.md`, `CLAUDE.md` por frente) está muy por
encima del promedio; la **instrumentación de verificación** está por debajo. Esta spec cierra esa
brecha: hace medible el criterio de aceptación de M3, saca al suite de tests de una base compartida
acumulativa, y elimina dos clases de bug —no dos instancias— que ya mordieron.

## Alcance / NO-alcance

- **Cubre:** aislamiento de la base de test, unificación de fixtures, trazabilidad de test IDs y
  coverage, montaje de routers, e2e en CI, partición de `evidence.routes.ts`, ubicación de las
  bases locales.
- **NO cubre:** nada del dominio. Ni un endpoint nuevo, ni un cambio de contrato de API, ni de
  esquema. Si un cambio de acá obliga a tocar una respuesta, está mal hecho.
- **NO cubre** tampoco subir el coverage a ≥95%: esta spec lo vuelve **medible**. Llegar al número
  es trabajo de las verticales, no de acá.

## Los siete cambios

| # | Cambio | Gravedad | Cierra |
|---|---|---|---|
| 1 | Base por archivo de test (template + copia por archivo) | 2ª | Estado acumulado entre archivos |
| 2 | Fixtures unificados entre `seed.ts` y `global-setup.ts` | 3ª | Dos definiciones del mismo dominio |
| 3 | Trazabilidad de los 75 test IDs de M2-D5 + coverage | **1ª** | El criterio de aceptación no es medible |
| 4 | Un prefijo por router en `app.ts` | 4ª | El orden de montaje como carga estructural |
| 5 | e2e de Playwright en CI | 5ª | Red de seguridad que no se ejecuta |
| 6 | Partir un router **cuando mezcla concerns** (no por conteo de líneas) | 6ª | Un archivo por prefijo esconde las costuras |
| 7 | Bases locales a `apps/api/.data/` | 7ª | Artefactos mezclados con el código fuente |

**Por qué el orden no es el de gravedad.** El más grave es el 3 —M2-D5 §8 declara que los test IDs
son la unidad de medida del ≥95% de aceptación de M3, y al abrir la spec había 6 de 75 en el repo,
sin ninguna herramienta de coverage—. Pero se escribe mucho mejor sobre una suite que no arrastra estado, así
que 1 y 2 van primero. Además 1 y 2 son el mismo territorio: los fixtures.

## Estado medido al abrir la spec

Medido con `grep` y con la suite, no estimado (principio de `specs/README.md`).

| Métrica | Valor |
|---|---|
| Test IDs declarados en M2-D5 | 75 |
| Test IDs presentes en el repo | 6 |
| Herramienta de coverage | ninguna |
| Archivos de test en `apps/api` | 21 |
| `fileParallelism` | `false` |
| Specs de Playwright | 2, con 0 referencias en `ci.yml` |
| Router más grande | 671 líneas (`evidence.routes.ts`) |
| Líneas de `.gitignore` para bases locales | 8 |

## Invariantes

1. **Ningún archivo de test depende del estado que dejó otro.** Un archivo corrido solo y corrido
   dentro de la suite dan el mismo resultado.
2. **Ningún archivo de test coordina valores con otro a mano.** Repartir `sequenceOrder` por archivo
   para no chocar contra un índice único es señal de que el invariante 1 está roto.
3. **Un test ID de M2-D5 o está reclamado por un test, o está declarado pendiente explícitamente.**
   No hay tercera categoría, y la lista de pendientes vive en el repo, no en la cabeza de nadie.
4. **Ningún router recibe una request que no le pertenece.** El orden de montaje en `app.ts` puede
   cambiar sin romper nada.
5. **Ningún artefacto generado —bases, uploads, dist— vive entre el código fuente.**
6. Las asserts vuelven a poder ser exactas. Una assert debilitada a invariante tiene que serlo por
   una razón del dominio, nunca por una limitación de la infraestructura de test.

## Casos borde (definen los tests)

- Dos archivos de test que insertan la misma clave única **no se ven entre sí**.
- Un archivo corrido aislado (`vitest run test/x.test.ts`) pasa igual que dentro de la suite.
- La suite corre con `fileParallelism` activo sin fallas de bloqueo de SQLite.
- El chequeo de trazabilidad **falla** si se agrega un test ID a M2-D5 y nadie lo reclama.
- El chequeo de trazabilidad **falla** si un test reclama un ID que M2-D5 no declara (typo).
- Montar los routers en orden inverso no cambia ninguna respuesta.
- `pnpm verify` sigue verde y **ninguna respuesta de la API cambia** — es la vara de que esto fue
  refactor y no rediseño.

## Corrección al conteo inicial

La primera medición dio **62 test IDs y era un subconteo**. El regex exigía exactamente tres
segmentos —`ROLE-AREA-ACTION-NNN`, que es como M2-D5 §2.3 *describe* el esquema— y descartó en
silencio 13 IDs que el entregable *usa* con dos: `CER-CERTIFY-001`, `INV-MENU-001`,
`NOT-PANEL-001`, `DEV-PROGRESS-001`… El total real es **75**.

Vale como caso de estudio de lo que esta spec arregla: un conteo hecho a ojo con un `grep` de
ocasión falla en silencio, y ahí es donde vive la deuda. Ahora el número sale de
`scripts/check-testids.mjs`, que corre en CI y no puede desalinearse.

**Y el chequeo encontró algo en su primera corrida:** `AUTH-LOGIN-002/003/004` en
`walkthrough.spec.ts` eran IDs **inventados** —M2-D5 solo declara `AUTH-LOGIN-001` y `AUTH-ME-001`—.
Los cuatro casos ejercitan la misma superficie (fila 01), así que los cuatro la referencian y se
distinguen por su descripción: **un ID identifica una superficie del backlog, no una aserción.**

## Preguntas abiertas

- **El umbral de coverage arranca en el piso medido, no en 95%.** Poner el número final antes de
  tenerlo deja el CI rojo por deuda conocida, que enseña a ignorar el rojo. Sube por rebanada.
- Los e2e en CI necesitan la app levantada. Arrancan como job propio y **no bloqueante** hasta que
  se demuestren estables; volverlos bloqueantes es una decisión aparte. Al activarlos aparecieron
  tres cosas, las tres reales: el limiter de login cortaba el segundo proyecto con 429, la aserción
  del `BottomNav` corría también en desktop —donde M2-D1 lo reemplaza por un sidebar que todavía no
  existe—, y el `test.fail` del proxy de nitro avisó que su bug se había arreglado con D-065.
  Quedan 22 de 22 en verde.

## El ítem 6, cerrado por reformulación — 2026-09-11

Estaba escrito como un umbral de conteo: *"partir los routers que pasan las ~500 líneas"*. Se cierra
cambiando la regla, y hay que decir por qué, porque **el umbral no estaba mal elegido**.

**Medido el 2026-09-11** con `wc -l apps/api/src/routes/*.routes.ts`:

| Router | Líneas | Rutas |
|---|---:|---:|
| `investor.routes.ts` | 612 | 14 |
| `developer.routes.ts` | 546 | 8 |
| `evidence.routes.ts` | 516 | 8 |
| — *umbral de ~500* — | | |
| `developer-comercial.routes.ts` | 449 | — |
| `projects.routes.ts` | 448 | — |
| `notary.routes.ts` | 374 | — |

Los otros 13 quedan por debajo. **El cuarto router marca el acantilado**: los saltos en la cola alta
son 66 (612→546), 30 (546→516) y **67** (516→449), el más ancho de los tres. El umbral de ~500 cae
justo ahí y separa exactamente tres archivos — como *descriptor* de la distribución estaba bien
puesto, no era un número de ocasión.

**Lo que no es, es un predictor de daño.** Tres mediciones, en orden de peso:

1. **La [auditoría del backend del 2026-09-11](AUDITORIA-2026-09-11-calidad-del-backend.md) leyó los
   51 archivos de `src` completos y produjo 15 hallazgos. Ninguno es el largo de un router.** Los dos
   graves —B-01 y B-02, corrupción de datos, reproducidos ejecutándolos— salen de otro lado: hay una
   sola `db.transaction()` en todo `src`. Si el largo escondiera costuras, ese era exactamente el
   ejercicio que las encontraba, y no las encontró.
2. **El ítem con dientes de esta zona era el 4, y está cerrado.** Un `router.use(guard)` corre para
   toda request que entra al router, matcheen o no sus paths: eso contestaba 403 a
   `/investor/favorites` y 401 al dossier público. Lo cerró el prefijo propio (`MONTAJE` en
   `app.ts`), no el tamaño del archivo.
3. **El corte que sí hubo fue por concern, y ya pasó.** `evidence.routes.ts` era 671 al abrir la spec
   —era *el* disparador de este ítem— y hoy es 516. La diferencia salió de `developer-comercial`,
   `developer-evidencia`, `projects-obra` y `capital`, que existen porque son conceptos distintos;
   ninguno nació de contar líneas.

**Y partir los tres restantes por línea agregaría riesgo real.** El comentario de `MONTAJE` asienta
el precio: los routers que comparten prefijo tienen que declarar **los mismos guards a nivel de
router**, y `/api/v1/developer` ya tiene cuatro. Cada archivo nuevo es un invariante más que
sostener. Cortar `evidence.routes.ts` en dos para bajar 16 líneas compra nada y paga eso.

**La regla queda:** un router se parte cuando mezcla concerns, y el nombre del archivo nuevo tiene
que poder decir cuál. El conteo de líneas es señal para mirar, nunca motivo para cortar.

**Lo que esto NO autoriza.** No es permiso para que un router crezca sin techo. Si `investor.routes.ts`
—el más grande, 14 rutas— llega a mezclar dos conceptos, se parte por eso, no por haber pasado un
número. La señal es el nombre que no alcanza, no el `wc -l`.
