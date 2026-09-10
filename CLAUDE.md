# CLAUDE.md

Lo transversal. Lo de cada frente vive en `apps/web/CLAUDE.md`, `apps/api/CLAUDE.md`,
`packages/cardano/CLAUDE.md` y `contracts/CLAUDE.md`, y se carga solo cuando tocás ese subárbol.

**Acá solo hay información vigente.** El porqué de cada decisión está en `DECISIONS.md`; el
argumento largo, en `specs/archive/`.

---

# El plan de entrega del Milestone 3 — acordado 2026-09-09

**Esta es la lista completa de lo que falta, y manda sobre cualquier otra lista del repo.** Sale de
leer los 16 criterios del SOM en `specs/README.md` contra el código, más lo que se encontró
auditando la FSM del stage. Mientras el milestone no se entregue, lo que no esté acá no se hace.

Dos aclaraciones de vocabulario, porque las dos se habían perdido:

- **"Darle contenido a `Pending`"**: hoy una etapa `Pending` se ve como un chip gris vacío. Pero su
  mint ya está anclado y prueba algo real —*este proyecto declaró estas 10 etapas, en este orden, a
  esta hora*, la garantía anti-backdating—. Era mostrar esa fecha y su TXID en vez del vacío.
- **"Signers configurables"**: la otra mitad del criterio 3. D-021 lo relee como *qué rol puede
  autorizar cada transición de cada stage* (autorización de estado, no de gasto). Hoy
  `PATCH /stages/:id/state` tiene los roles fijos para todos los stages por igual.

**Y eso cambia el plan:** la investigación del 2026-09-07 ya había concluido que "signers
configurables" **no existe en ningún entregable** — solo en el texto del SOM. Es exactamente el
mismo caso que `progressPercentage`, y con la regla de precedencia del dueño (**entregables M2/M3
sobre el SOM**, 2026-09-09) se resuelve igual: **no se construye, se explica.** La captura 34C
tampoco tiene campo de signer. El criterio 3 queda sin código pendiente.

## Tanda 1 — esquema 🟡 · ✔ cerrada 2026-09-10

| | Qué |
|---|---|
| 1.1 | ✔ `migrations/0003_drop_stage_progress.sql` + sacarlo de `db/types.ts`, `stageSchema`, el insert de `developer.routes.ts`, `fixtures.ts` y `test/helpers/stages.ts` — commit `7130c94` |

Es todo. **Ningún call site cambia**: al no existir la columna, `selectAll()` deja de devolverla y
los ~9 `stageSchema.parse` siguen andando. Sin la migración habría que pasar esos 9 a listas
explícitas de columnas — la migración es el camino con *menos* código tocado, no más.

## Tanda 2 — código

**Alineación con las capturas**

| | Qué | Criterio |
|---|---|---|
| 2.1 | ✔ `developerProgressItemSchema` suma `certifiedAt` y `estimatedDelivery`; el handler los selecciona — commit `111f1f6` | 8 |
| 2.2 | ✔ `/developer/progress`: barra + "Overall Progress: N%" (dibujada por la pantalla, no por `ProgressTimeline`), `finalizationLabel` al timeline, bloque "Stage Detail" sin miniatura — commit `a4743fa`, verificado con Claude en Chrome contra `pnpm dev` local | 8 |

**Cierres de criterios**

| | Qué | Criterio |
|---|---|---|
| 2.3 | ✔ **Auditar los 10 patrones P1–P10 test por test.** Los 10 ya tenían test cubriendo "sin TXID no hay señal de prueba" — 8 en tests dedicados (`VerificationBadge.test.tsx`, `HashChip.test.tsx`, `patterns.test.tsx` ×6, `AuditEventCard` en `cards.test.tsx`), P8 (Dossier) por composición de P1+P2, verificado leyendo el código de las dos rutas de dossier. No hizo falta código nuevo, solo cerrar el `◐` con la evidencia — `specs/README.md` criterio 6 | 6 ✅ |
| 2.4 | Las ~20 claves i18n de `AuditLog` que faltan. El audit log muestra `ACCEPT_INVITATION` en crudo — regla 14 sobre una superficie ya entregada | 10 |

**Saneamiento de la demo** (no es un criterio, pero se demuestra sobre esto)

| | Qué |
|---|---|
| 2.5 | `Cimentación` de `torre-a` está `Completed` + `validationCritical` con **0 evidencias, 0 eventos y `certifiedAt` NULL**. Un reviewer que la abra ve exactamente lo que el criterio 7 dice que rechazamos. Lo produjo `sembrarStages`, que escribe `state` directo salteando la FSM |

## Tanda 3 — documentación, decisiones y evidencia

**Decisiones nuevas**

| | Qué |
|---|---|
| 3.1 | `DECISIONS.md`: el techo de precedencia — **entregables M2/M3 sobre el SOM**, con `progressPercentage` como el caso que lo estableció. Es lo que evita que alguien vuelva a crear la columna leyendo el SOM |
| 3.2 | `DECISIONS.md`: el avance es **derivado por proyecto** (`completadas/total`), según captura 45. No hay peso por etapa |
| 3.3 | `DECISIONS.md`: **"signers configurables" no existe en el diseño** — misma resolución que 3.1, y cierra el criterio 3 |

**Saneamiento de `specs/README.md`** — hoy tiene cinco afirmaciones falsas

| | Qué |
|---|---|
| 3.4 | Criterio 3: las cuatro mitades de esa fila son falsas (catálogo de 8→10, `torre-a` con 3 stages, la ruta que aceptaba el campo se borró, no hay forma de configurarlo). Reescribir con 3.1–3.3 |
| 3.5 | Números viejos: "235 tests" (son **334**), "73 tests" de Aiken (son **82**), superficies "46" cuando este archivo afirma 53/53 auditadas — una de las dos miente |
| 3.6 | `SPEC-013 §C` figura "pendiente" en el registro y "hecho" en el orden de trabajo, en el mismo archivo |

**Documentación de frente**

| | Qué |
|---|---|
| 3.7 | Ficha de `DEFAULT_STAGE_CATALOG`: cambia el motivo del "sin `progressPercentage`" |
| 3.8 | `apps/web/CLAUDE.md`: la deuda declarada de las miniaturas del Stage Detail |
| 3.9 | `CLAUDE.md` raíz: reescribir la tabla de pendientes de §Estado con lo que quede |

**Evidencia de entrega** (no es código ni prosa nuestra)

| | Qué | Criterio |
|---|---|---|
| 3.10 | Publicar la **lista formal de TXIDs** resolubles en explorador | 15 ◐ |
| 3.11 | **Screenshot de monitoring** (Sentry / Grafana), ya encendidos y verificados | 14 |
| 3.12 | **Video walkthrough** | 13 ⬜ |
| 3.13 | **3 pilotos** — recontactar; `M1-D3-PilotPlan.pdf` ya trae cartas de M1 y probablemente cubre parte | 4 ⬜ externo |

## Al final — la prueba de volumen (ex-pendiente #0)

Va última, **pero no es independiente**: tres criterios dependen de ella.

| Criterio | Qué le da la prueba |
|---|---|
| **8** ⬜ | Es literalmente *"flujos de UI end-to-end en pre-prod"* — la prueba **es** la evidencia |
| **9** ◐ | Falta la muestra real de reserva→escrow; nadie confirmó una en Preprod |
| **15** ◐ | Los TXIDs que hay que publicar salen de ahí |

Por eso va **antes de 3.10, 3.12 y 3.13**: el video se graba sobre los datos que la prueba deja, y
la lista de TXIDs también. Presupuesto medido: **~35 ADA por proyecto** (≈15 de fee + 20
bloqueadas), ~1% del balance de la wallet de servicio. El costo no la condiciona.

## Fuera de alcance de este milestone

| Qué | Por qué |
|---|---|
| **Mainnet** | Decisión del dueño, 2026-09-09. D-013 lo hace imposible por configuración y `specs/README.md` ya lo declara fuera |
| **Fusionar anclaje + transición** | Ahorra ~5% del costo on-chain; es 🟡 sobre el core de anclaje. Después de la prueba de volumen, que da la distribución real. Detalle en `specs/PROPUESTA-2026-09-09-fusionar-anclaje-evidencia-transicion.md` |
| **`TOPE_POR_LECTURA`** | Medir una carga real antes de tocar el número. El disparador por lectura ya se arregló (2026-09-09) |
| **"Contenido en `Pending`"** | Mejora de UX, ningún criterio la pide. Necesita que el listado de stages devuelva el anclaje y reconcilie |
| **Columna `AuditLog.projectId`** | Sacaría el mapeo fail-closed de `auditScope`. Pide backfill que para filas viejas no tiene respuesta |
| **`validationCritical` siempre `true`** | Config muerta con rama viva y testeada en el validador. No molesta |
| **Las 2 ADA bloqueadas por etapa** | Sin burn (D-057), son permanentes: 20 por proyecto de 10 etapas. Es el número para la decisión de mainnet, no para este milestone |

## Sin confirmar todavía

1. **El criterio 3 se cierra por documentación** (3.1–3.4), sin construir signers ni percentages. Es
   la consecuencia directa de la regla de precedencia, pero es un criterio de Catalyst.
2. **2.5** — si la etapa fabricada de la demo la borra el LLM o la toca el dueño.

---

## Contexto

**PropNexus** (Catalyst 1400106) — plataforma de ventas inmobiliarias en pozo: estructura el ciclo
de obra en **stages**, organiza **evidencia** (planos, permisos, actas, certificados) y ancla
**huellas criptográficas** (SHA-256/Merkle) en **Cardano** con timestamps. Off-chain: documentos,
PII y lógica de negocio. On-chain: solo commitments y TXIDs — **nunca valor**. Cuatro roles con
superficie propia: investor (INV), developer (DEV), notary (NOT), certifier (CER).

**El problema real.** Hoy es imposible verificar el estado de los procesos de aprobación de una obra
en pozo: la evidencia está dispersa en canales informales y nada garantiza que lo que se muestra hoy
sea lo que existía ayer. Esa opacidad ya causó daño económico real a compradores.

**Lo que NO hace.** No certifica, no valida y no decide nada. Solo puede sostener cuatro
afirmaciones: *este archivo tiene este hash* · *se registró en este momento* · *declara provenir de
esta autoridad externa* · *esta persona atestiguó haberlo revisado*. Si escribís copy, modelo o
validador que afirme algo más, está mal (D-026).

---

# Estado, y lo próximo

> **La tabla de abajo quedó vieja el 2026-09-09.** Lo que falta está en §El plan de entrega, arriba;
> reescribir esta tabla es el punto 3.9 de ese plan. Se deja hasta entonces porque el resto de la
> sección —lo ya cerrado— sigue siendo válido.

**La instancia desplegada ancló de verdad por primera vez el 2026-09-03**, contra Cardano Preprod:
`OnChainEvent` tiene su primera fila, `Confirmed`, con TXID real
(`52a2aa42…f2f7aaf406`). Arrancar en real era configuración; esto ya es prueba. Lo que se hizo para
llegar está en `DECISIONS.md` (D-075 → D-087) y en `specs/PLAN-2026-08-31-anclaje-real.md`; los
números medidos, en `specs/README.md`. Acá solo lo que falta.

| # | Qué | Por qué ahí | Nivel |
|---|---|---|---|
| 0 | **Prueba end-to-end de volumen, en preprod, antes de mainnet** (pedido del dueño, 2026-09-09): desde el front, crear varios proyectos nuevos, completar los 10 stages del template con evidencia real cada uno, y llevar cada stage por **todas** las transiciones posibles de la FSM (`Pending → InProgress → Observed → InProgress → Completed`) — no solo un camino feliz por stage, como hasta ahora. **Falta presupuestar el costo real en preprod** (cantidad de transacciones × fee, y si el balance de la wallet de servicio alcanza o hace falta otro drip del faucet) antes de correrla. | Es la validación final de volumen que falta antes de habilitar mainnet: hasta ahora cada arista de la FSM se probó una vez, sobre un stage aislado — nunca las cuatro juntas, en los 10 stages de un proyecto real, repetido en más de un proyecto | 🟡 |
| 1 | **Mainnet** — runbook, habilitar la red, custodia de la clave. **Sin confirmar que sea de este milestone** (2026-09-08, el dueño) | D-013 la hace **imposible por configuración**: es código, no solo procedimiento | 🔴 |

**El "Stage template" (ex-#1) se cerró el 2026-09-08** — las dos decisiones del dueño que lo
bloqueaban (nombrar las 10 etapas, el mecanismo de anclaje) están resueltas y construidas. Detalle
completo más abajo, en el cierre del mismo día.

**Encontrados el 2026-09-04, probando el flujo real end-to-end contra producción** (login con las
credenciales del re-seed, crear un proyecto, subir y anclar evidencia — vía Claude en Chrome, no un
test). Detalle en `apps/web/CLAUDE.md` §Trampas verificadas.

**Cerrados el 2026-09-01:** el reference script (D-083) y su cobertura contra un nodo real; `network`
e `issuingAuthority`, aplicadas en producción **sin dejar de tener un solo archivo de migración**
(D-085); y D-028, acotada por D-084 y D-086.

**Cerrados el 2026-09-03:** el re-seed de producción — 5 cuentas demo sembradas contra Turso
(`admin@`, `developer@`, `buyer@`, `verifier@`, `notary@example.com`), verificado con
`select email from User`; la **publicación operativa** del reference script en Preprod
(`pnpm --filter @plataforma/cardano ref:publish`, txid `3c75280a…0ba2c7f1`, confirmado on-chain,
API reiniciada a las 15:26 UTC); el **primer anclaje real por metadata**: `developer@example.com`
subió evidencia al stage "Estructura" de `torre-a`
(`POST /developer/projects/:id/stages/:stageId/evidence`), root del bundle anclado, `POST
/evidence/reconcile` lo confirmó — TXID `52a2aa4214…f7aaf406`; y el **primer anclaje real de
state-thread**, el otro camino que D-083 existe para abaratar: se creó un stage nuevo
("Terminaciones", `POST /projects/:id/stages`, mint del thread token) y se transicionó
Pending→InProgress (`PATCH /stages/:id/state`, gasta y recrea el hilo). **Las dos transacciones
referenciaron el UTxO publicado en vez de adjuntar el validador** — verificado leyendo los inputs de
cada una en Blockfrost (`reference: true` sobre el UTxO `3c75280a…0ba2c7f1#0`), no solo por
tamaño/fee. D-083 queda confirmado en producción en sus dos caminos.

```
mint     (STAGE_CREATED)     650 bytes · 0.229280 ADA · 21bae8cb…c294970
advance  (STAGE_TRANSITION)  645 bytes · 0.238122 ADA · b28eb6cf…36a0dbe
```

**El security review del criterio 11, corrido.** Auditoría completa de `apps/api`, `packages/cardano`,
`packages/shared` y los validadores Aiken contra las reglas duras de este archivo. Un hallazgo real:
`GET /evidence/:bundleId/proof/:fileHash` y `GET /evidence/:bundleId/files` no tenían la segunda capa
de autorización (regla 5) — cualquier usuario autenticado, sin importar su membresía, podía leer el
Merkle root, los hashes y los nombres de archivo de un bundle de evidencia ajeno conociendo su
`bundleId`. Cerrado en el mismo commit: `ProjectSource` suma `via: "EvidenceBundle"` y ambas rutas
piden `requireProjectAccess`. Detalle y la lección en `apps/api/CLAUDE.md`.

**Trampa encontrada al hacerlo, y dos arreglos que salieron de ahí.** Un stage sembrado directo en
la base (como `Cimentación`/`Estructura` de `torre-a`) **no tiene hilo on-chain** — el mint solo
ocurre en `POST /projects/:id/stages`. Un `PATCH .../state` sobre uno de esos stages no falla la
request (la declaración se escribe igual, D-059) pero el anclaje queda `Failed` en silencio, porque
`advanceThread` no encuentra ningún UTxO que gastar. Por eso el primer anclaje de state-thread se
hizo sobre un stage **nuevo**, no sobre los dos que ya existían. Se agregó
`POST .../stages/:stageId/retry-anchor` para el caso legítimo —un mint que falló de verdad sobre un
stage que sigue en `Pending`— y `hasOnChainThread` (calculado) en las lecturas de stage, para que la
pregunta se conteste mirando la respuesta y no auditando el código. De paso salió un bug de verdad,
ya cerrado: `tieneHiloAnclado` bloqueaba la identidad de un stage con cualquier anclaje, incluida
evidencia por metadata que nunca toca el validador. Los tres, con tests, en `apps/api/CLAUDE.md`.

**Defensa 3, cerrada el 2026-09-03 (D-087).** El simulador devolvía `Confirmed` directo desde
`openThread`/`advanceThread`/`anchorCommitment`; el adaptador real siempre devolvió `Pending`. Ahora
los dos declaran `Pending` siempre, y `Confirmed` sale únicamente de un chequeo aparte
(`verify()`/`confirmedAt()`) que el código de la API ya hacía para el hilo y ahora también hace para
metadata. Ningún test cambió: el chequeo sigue encontrando el anclaje simulado al toque, solo que ya
no es el recibo el que lo afirma. Detalle en `DECISIONS.md` (D-087) y `packages/cardano/CLAUDE.md`.

**Las "7 superficies" no existían — `specs/README.md` estaba desactualizado.** Auditado contra el
código el 2026-09-03: las 53 superficies del backlog (`docs/milestone-3-implementacion/
UI-implementation-plan.md` §4-6) tienen su ruta o modal, sus 68 endpoints únicos existen en
`apps/api/src/routes`, y los 10 patrones M2-D4 están en uso. Test IDs: 74/74 —
`DEV-RELEASE-EXECUTE-002` queda excluido del conteo (D-070: decisión permanente, no backlog). No
verificado fila por fila: que cada patrón esté *bien* aplicado donde corresponde, solo que está
presente y en uso en algún lugar. `specs/README.md` corregido en el mismo commit.

**Cerrado el 2026-09-04 · la matriz de permisos dejó de auditarse a ojo.** El security review del
criterio 11 y el `notary` que no se podía dar de alta son el mismo modo de falla: una ruta que no
declara su guard compila, pasa los tests y sirve el happy path. Con 87 handlers en 18 archivos, la
auditoría a mano no escala ni se repite. `apps/api/test/route-guards.test.ts` recorre los routers
**ya montados** y reconstruye la matriz de las 87 rutas —método, path absoluto y cadena de guards
declarados— contra un literal en el propio test: una ruta nueva o un guard que cambia lo ponen rojo
hasta que alguien actualice el literal, y actualizarlo **es** la revisión. Lo sostienen `GUARD` (un
símbolo global que `requireRole` y `requireProjectAccess` le cuelgan a la closure que devuelven) y
`MONTAJE` (el montaje de `app.ts` como tabla, porque Express 5 compila el path de montaje a un
matcher y tira el string — comprobado leyendo el `Layer`, no supuesto). Más tres invariantes
hermanas: sesión obligatoria salvo las dos rutas públicas declaradas, ninguna lista de roles o
membresías vacía, y **los routers que comparten prefijo declaran los mismos guards de router** —
el bug del 2026-08-24 convertido en invariante, que hasta hoy se sostenía solo por disciplina.
**No es el escáner que borró D-053:** aquel grepeaba el fuente y adivinaba; este interroga el router
que Express armó, con los middlewares que van a correr. Y se verificó rompiéndolo —tres mutaciones,
las tres en rojo, las tres revertidas—, no viéndolo verde. El detalle está en `apps/api/CLAUDE.md`
§La matriz de permisos.

**Lo que eso destapó, y se cerró el mismo día: la tercera capa existe.** La matriz asienta los guards
**declarados**, no que la autorización sea correcta, y dejó a la vista un tercer patrón que vivía sin
forma: autorizar **adentro** del handler. Ninguna de esas rutas estaba abierta —se auditaron una por
una— pero su regla no se leía en la firma, no la protegía el compilador y no la veía el test nuevo.
Ahora hay un `requireOwnership` hermano de los otros dos guards, con tres formas de `OwnerSource`
(`Unit`, `Invitation` —que compara contra el **email**, porque la invitación existe antes que la
cuenta— y `ContractOfUnit`, que resuelve la fila por `unitId` y no por su clave primaria). **Nueve
rutas del investor** pasaron el `if` copiado a la firma, con el bypass de `admin` y la regla de que
un dueño `null` es 403 en un solo lugar cada uno. Verificado neutralizando el guard: 7 de 13 tests
en rojo, todos los de rechazo.

**Y corrige algo que este archivo afirmó de más ayer.** Decía "~20 rutas de `investor` y `notary`":
`notary` **no era candidato**. Sus rutas de dossier no tienen regla de pertenencia y no es un olvido
—el dossier pendiente es una cola de trabajo compartida, cualquier notary firma cualquiera— y lo que
sus listados hacen con `signedById` es acotar la vista, que es scope y no autorización. **Antes de
subir un filtro a la firma, preguntá si es una regla de acceso o un criterio de listado.** Queda una
sola ruta autorizando adentro a propósito: `GET /contracts/:contractId/releases`, cuya regla es
*dueño **o** miembro del proyecto* — una disyunción, y una cadena de middlewares es una conjunción.
El combinador se escribe el día que aparezca la segunda, no antes. Todo en `apps/api/CLAUDE.md`
§La tercera capa.

**Abierto, y es decisión del dueño, no una tarea pendiente.** El JWT dura 7 días y no se puede
revocar de a uno. La revocación que existe es gruesa: `authenticate()` reconsulta la base en cada
request, así que dar de baja una cuenta corta sus sesiones al instante; lo que no hay es invalidar
**un** token sin dar de baja al usuario. Cerrarlo pide refresh tokens con store de revocación —tabla,
endpoint y front—, o sea infraestructura para un problema que todavía no duele. Se dejó afuera a
propósito. Lo que sí se hizo el 2026-09-04: `signToken`/`verifyToken` fijan **HS256 explícito** de
los dos lados. No había agujero —con un secreto de tipo string, jsonwebtoken v9 ya acota la
verificación a la familia HS*—; lo que se cierra es la dependencia de ese default para el día que la
clave deje de ser un string.

**Y cerrado el mismo día: una sola forma de declarar autorización (D-088).** Las tres capas dejaron
de ser tres middlewares encadenados y pasaron a ser `authorize({ roles, acceso })`, con los dos
campos obligatorios; **las 87 rutas montadas lo declaran**, y las únicas dos sin él son las dos sin
sesión que M2-D5 §2.2 declara. El motivo es uno y no conviene inflarlo: no es que las tres hicieran
lo mismo ni que se lea mejor, es que **nada obligaba a declarar la pertenencia** — y esa jugada,
hacer que omitir no compile, es la misma de D-042, que con middlewares sueltos no se podía repetir
porque *la ausencia de una llamada no es un tipo*. De yapa, `{ alguna: [...] }` expresó la
disyunción que una cadena de middlewares no puede, y `GET /contracts/:contractId/releases` dejó de
autorizar adentro del handler: **ya no queda ninguna ruta que lo haga**. `requireRole`,
`requireProjectAccess` y `requireOwnership` se borraron. Ninguna ruta ganó ni perdió acceso, y eso
se probó, no se afirmó: 275 tests en verde y la matriz equivalente ruta por ruta en cada uno de los
seis pasos. Se pudo hacer recién ahora porque `SPEC-012` prohíbe cambiar semántica de seguridad
adentro de un refactor y hasta que existió la matriz no había forma de *probar* que un refactor no
la cambiaba — matriz → `requireOwnership` → unificación, cada paso habilita el siguiente.

**Y la partición que faltaba, hecha el mismo día.** `"soloRol"` quedaba en 45 de 87 rutas y **26
mentían**: los listados se acotan con `where userId = ...` o `projectScope(...)` adentro del query,
así que decir "no hay regla de fila" se leía como una revisión hecha. Esas 26 declaran ahora
`{ scopeEnQuery: "<el filtro>" }`, con un test que exige que el texto no esté vacío — si la etiqueta
pudiera quedar en blanco, sería `"soloRol"` con otro nombre. Reparto final: `"soloRol"` 19 ·
`{ scopeEnQuery }` 26 · `{ proyecto }` 30 · `{ dueño }` 9 · `{ alguna }` 1 · sin sesión 2.

**Etiquetar obliga a leer el handler, y así apareció un agujero real, ya cerrado.**
`GET /developer/audit-log` devolvía el `AuditLog` **entero**, sin acotar por proyecto, con
`actorName` y `actorRole` de cada usuario del sistema: un developer con membresía en un proyecto veía
los eventos de todos los demás. Es la regla 5 sin su segunda capa, misma familia que el agujero de
`GET /evidence/:bundleId/files`, y ninguna herramienta lo iba a marcar. **No era una decisión de
producto abierta —el entregable ya la tenía tomada**: M2-D1 §4 dice *"developer sees project-scoped
events"* y M2-D4 §P6 *"all events scoped to that developer's projects"*. Se cerró con `auditScope`,
una condición de Kysely hermana de `projectScope` que resuelve `entityType`/`entityId` → proyecto y
**es fail-closed**: un `entityType` que nadie mapeó no se muestra, en vez de mostrarse a todos.
`User` queda afuera por diseño. La forma que corresponde de verdad es una columna `projectId` en
`AuditLog` —sin joins y sin mapeo que se pueda olvidar—, y está anotada para el día que se toque el
esquema: hoy pediría la primera migración sobre una base desplegada (D-063) y un backfill que para
varias filas viejas no tiene respuesta.

**Cerrado el 2026-09-08 · observabilidad real en producción (Sentry + OTel → Grafana Cloud).** Las
env vars de `render.yaml` (`SENTRY_DSN`, `OTEL_EXPORTER_OTLP_ENDPOINT`/`_HEADERS`,
`VITE_SENTRY_DSN`, `VITE_POSTHOG_KEY`/`_HOST`) se cargaron a mano en el dashboard y se verificó
traces reales de `propnexus-api` en Tempo, no solo que el proceso arrancara diciendo "activo". En el
camino, dos incidentes de producción real: `@opentelemetry/api` sin declarar como dependencia
directa tumbó el deploy con `MODULE_NOT_FOUND` (un `require()` sin tipar no lo agarra `tsc` ni una
instalación local con `node_modules` viejo), y Sentry (v10) registrando sus propios globals de OTel
antes que el `NodeSDK` propio dejaba los traces cayendo en silencio pese a que el deploy quedaba
`live` — el bug no se hubiera visto sin agregar `diag.setLogger` primero. Los tres fixes, el smoke
test de CI que ahora corre el `startCommand` real contra el build compilado, y el detalle completo
de por qué el asistente de Grafana genera el header OTLP incompleto, están en `apps/api/CLAUDE.md`
§Trampas verificadas y `specs/RUNBOOK-deploy.md` §4. De yapa: un warning de Vite por un chunk de
619kB en el build del web (React + TanStack + Sentry/PostHog + Radix todo junto) se resolvió
separando vendor chunks — sin relación con lo anterior, encontrado en el mismo log que se estaba
revisando.

**Cerrado el 2026-09-08 · sidebar de desktop (pendiente #1 de la tabla).** `components/domain/Sidebar.tsx`
reemplaza a `BottomNav` en desktop (`md:flex` vs `md:hidden`, nunca los dos juntos), reusando
`NAV_TABS` sin duplicar la navegación por rol — mismo `tabNeedsExactMatch` que ya tenía `BottomNav`.
El activo se pinta como píldora sólida `bg-primary`, no solo texto: la captura 61 es la única
referencia de desktop en todo el catálogo y ahí el tratamiento es visualmente más fuerte que el
`BottomNav`, así que gana la captura (regla 1). Verificado con Chrome en 1440px (sidebar visible,
activo cambia de tab al navegar) y en 390px (sidebar ausente, `BottomNav` sin regresión) — las dos
capturas contra la instancia local, no solo `pnpm test`. 144 tests verdes.

**Y de paso, auditado el resto de las 53 superficies contra M2-D5** — no solo el sidebar. Ninguna
falta ni es un stub (la auditoría del 2026-09-03 tenía razón en eso), pero 9 reemplazan un componente
que la fila nombra por otro distinto sin dejar una decisión escrita, mismo patrón silencioso que el
sidebar. De esas 9, una auditoría más profunda separó 6 falsos positivos (ya documentados en el
código) y 1 de forma de **2 reales**, cerrados el mismo día — ver el párrafo siguiente. También se
cruzaron las 70 capturas contra las 51 filas de M2-D5: solo 3 sin fila (59, 60 — gap de contrato ya
documentado, no nuevo — y 61, el sidebar de arriba).

**Cerrado el 2026-09-08 · los dos hallazgos reales de esa auditoría, sin componentes nuevos.**
`/notary/dossier/:dossierId` cambió el ícono de color-solo por `VerificationBadge` (texto + color)
por artefacto — cierra la violación de M2-D3 §Accessibility. `/investor/unit/:unitId/dossier` sumó
un `ProgressTimeline` real (mismos datos que ya usa `getInvestorUnit` en `/investor/unit/:unitId`,
sin query nueva del backend) y `VerificationBadge` por artefacto. **Lo que no se cerró, a propósito:**
`DocumentCard` completo (nombre, fecha, formato) sigue sin poder armarse — `dossierArtifactSchema`
no tiene esos campos y no se inventan (regla 17). Es deuda de contrato declarada, no una tarea
pendiente de UI. Verificado con Chrome logueado como notary e investor contra la instancia local,
144 tests verdes.

**Probado el 2026-09-08 · flujo real de punta a punta contra producción, vía Claude en Chrome —
crear proyecto, subir evidencia, hashear, anclar, verificar.** Crear un proyecto nuevo confirmó en
vivo lo que dice el pendiente #1: sin stages no hay dónde subir evidencia (`/upload` muestra el
selector de etapa vacío). Se usó `torre-a`, etapa "Terminaciones" (la del hilo on-chain real de
D-083), con un PDF de texto real generado con `pandoc`. El anclaje devolvió Merkle root
`8afbf1…4e5e` y **TXID real `ae521653fd9ba003160a9f48a2dfc9a799ee5b3936cbe5fcb8ba6654a793bb8d`**.
Verificado por dos vías independientes: el hash SHA-256 que muestra `/developer/documentation`
(`a10b33…eb5b`) coincide **exacto** con el que se calculó en local antes de subir el archivo — no
se confió en que "dice verificado", se comparó el hash real. La verificación pública en
`preprod.cardanoscan.io` quedó bloqueada por un challenge de Cloudflare que no se resolvió (no
está permitido resolver CAPTCHAs) — el TXID queda anotado arriba para que el dueño lo confirme a
mano cuando quiera. Ver también `specs/README.md` criterio 15.

**Probado el 2026-09-08 · segunda transición real de state-thread — `InProgress → Completed`, vía
la única superficie de UI que existe para eso, con verificación independiente en el explorador.**
Continuación del anclaje del 2026-09-03 (D-083): ese cerró `Pending → InProgress` llamando a la API
directo; esta sesión cerró el siguiente tramo de la FSM (`packages/shared/src/stage.ts`) **desde el
navegador**, con las dos cuentas demo que el flujo real exige.

**Primer hallazgo: no hay pantalla de developer para transicionar un stage.**
`api/port.ts` expone `setMilestoneState` (`PATCH /stages/:id/state`) pero **ningún componente lo
llama** — se verificó con `grep -rln "setMilestoneState" apps/web/src`, un solo resultado, el propio
port. La única superficie real que mueve la FSM hacia adelante es la del **certifier**
(`certifier.stage.$stageId.tsx`, M2-D5 filas 56c/57): "Certificar" (`POST
/certifier/stages/:id/certify` → `Completed`) y "Observar" (`POST /certifier/stages/:id/observe` →
`Observed`), las dos delegando en `transitionStage` del lado del servidor. No es una pantalla
faltante — es la forma en que el dominio modela quién tiene autoridad para cerrar una etapa, y
coincide con lo que documenta `apps/api/CLAUDE.md` sobre esa ruta.

**El flujo, de punta a punta:**

1. **Developer** (`developer@example.com`) sube evidencia real a "Terminaciones" de `torre-a`
   (`POST /developer/projects/:id/stages/:stageId/evidence`, vía `/developer/project/:id/upload`),
   un PDF generado con `pandoc`. Merkle root `c66436…bfe4`, **TXID real
   `9cca08777b9ab8c44792c3afaacdc06d899d7f15ded743306c94483d3c0fa4d6`**, confirmado en
   `preprod.cardanoscan.io` sin bloqueo de Cloudflare esta vez (a diferencia del intento del
   2026-09-08 anterior). Hash local (`shasum -a 256`) coincidió exacto con el que mostró la app antes
   de anclar.
2. **Certifier** (`verifier@example.com`, con membresía `verifier` en `torre-a` desde el seed) entra
   a `/certifier`. El panel mostró **"No tenés etapas asignadas"** en el primer render — no es un
   bug: `GET /certifier/assignments` filtra `Stage.state in (InProgress, Observed)` dentro de los
   proyectos donde el usuario es miembro (`apps/api/CLAUDE.md` §`certifier.routes.ts`: "asignado" es,
   por ahora, cualquier stage en curso de un proyecto propio — no hay tabla de asignación explícita
   todavía), y el `useQuery` de React Query simplemente no había resuelto en la primera screenshot. Un
   refresh la mostró.
3. **"Certificar" estaba deshabilitado** hasta que hubo evidencia (`sinEvidencia` en el componente) —
   la pantalla lo explica en vez de esconder el botón, tal como documenta su comentario de cabecera.
   Con la evidencia del paso 1 puesta, el botón se habilitó y el click disparó `certify`.
4. **TXID real de la transición:
   `e842c8acb07dfd1b551a1a8d2318e12d9915d40aa69ebcf86d3842759571fe22`**, confirmado en
   `preprod.cardanoscan.io` (16 confirmaciones al momento de verificar). La pestaña "Entradas de
   Referencia" de la transacción muestra `3c75280a9205b3d8…735396f0ba2c7f1 #0` — el mismo UTxO del
   reference script publicado en D-083 — confirmando que esta transacción **referencia** el
   validador en vez de adjuntarlo, igual que las dos transacciones del 2026-09-03.

**Verificado también que el stage quedó `Completed` sin abrir la base:** el panel del certifier pasó
de "2 Asignadas" a "1 Asignada" y de "1 Certificada" a "2 Certificadas" apenas terminó el `certify`,
y `/certifier/issued` lista las cuatro evidencias del bundle (incluida la nueva) con el mismo TXID de
certificación repetido — consistente con que el commitment ancla el bundle completo, no archivo por
archivo.

**Trampa nueva, para cuando haga falta el TXID completo desde la UI:** `HashChip` trunca en el
**dato**, no solo en CSS — ni `read_page` ni `get_page_text` ni los atributos `title`/`aria-label`
tienen el hash completo en el DOM, porque el componente nunca lo escribe entero; solo el handler de
"Copiar" lo tiene en un closure y lo manda al portapapeles. `navigator.clipboard.readText()` vía
`javascript_tool` **cuelga indefinidamente** (timeout a los 45s) en este entorno de automatización —
aparentemente el prompt de permiso de lectura del portapapeles de la extensión nunca se resuelve
solo. **Lo que funcionó:** click en "Copiar" y después pegar (`cmd+v`) en el buscador de
`preprod.cardanoscan.io`, que sí acepta foco y pegado normales — de ahí salieron los dos hashes
completos de esta entrada.

**Estado de la FSM, probado en vivo hasta ahora:** `Pending → InProgress` (2026-09-03, por API) e
`InProgress → Completed` (hoy, por la UI real del certifier). Quedan sin probar en vivo
`InProgress → Observed` (mismo botón "Observar" de esta misma pantalla) y el retorno
`Observed → InProgress`; la lógica está cubierta por tests, solo falta ejercitarla contra Preprod.

**Cerrado el mismo día — agujero real, encontrado al chequear si el reparto de roles de esta prueba
era el correcto.** La pregunta fue *"¿el certifier certifica, o certifica el developer?"*; la
matriz de permisos de `M2-D1` es tajante (`Stage certification`/`Stage observation`:
**"Certifier-exclusive action"**) y el código no la cumplía: un developer podía `PATCH
/stages/:id/state` con `{state:"Completed"}` sobre su propio stage y auto-certificarse, sin pasar
por el certifier. Cerrado con un chequeo de rol antes de tocar la FSM (403
`STAGE_TRANSITION_FORBIDDEN` si no es `admin` y el estado pedido no es `InProgress`); admin sin
límite, developer conserva `→ InProgress` (arrancar y reanudar tras una observación). 305 tests
verdes, `pnpm verify:all` completo (incluido Aiken) también verde. Detalle, por qué no es un guard
de `authorize()`, y qué tests se movieron a `admin`: `apps/api/CLAUDE.md` §El endpoint de estado de
stages.

**Y eso destapó una pregunta más profunda, del dueño: "¿no todas las transiciones de la FSM se
pueden hacer desde el frontend?"** Cierto — verificado grepeando `apps/web/src` entero: el literal
`"InProgress"` no aparecía ni una vez, en ningún componente. De las 4 aristas, solo 2 tenían botón
(`InProgress → Completed`/`Observed`, certifier); las dos que **entran** a `InProgress`
(`Pending → InProgress`, `Observed → InProgress`) no tenían ninguna pantalla, para nadie — ni
siquiera existe una superficie en M2-D5 que las mencione. No es un bug de implementación: es que
nadie había definido el mecanismo.

**Cerrado el mismo día, con dos mecanismos distintos** — porque el diagrama canónico
(`M1-D2-Architecture-and-Data-Models/3-milestone-lifecycle.puml`, el único con las flechas
correctas) etiqueta las dos aristas distinto, y esa etiqueta importa:

- **`Pending → InProgress` : "work initiated" → automático.** La primera evidencia que un developer
  sube a un stage `Pending` (`POST /developer/projects/:id/stages/:stageId/evidence`) dispara
  `transitionStage(→ InProgress)` server-side, sin botón: subir el archivo **es** la señal de que
  el trabajo arrancó. No hace falta inventar una pantalla para decir lo que la acción que ya existe
  ya dice.
- **`Observed → InProgress` : "remediation completed" → manual, a propósito.** Acá NO alcanza con
  "subieron algo": el developer tiene que decidir explícitamente que la corrección está lista, no
  que cualquier archivo nuevo reabra el stage solo. Nueva sección "Etapas observadas" en
  `/developer/progress` (`DEV-PROGRESS-RESUME`, fuera del esquema `ROL-ÁREA-NNN` de M2-D5 a
  propósito — `scripts/check-testids.mjs` rechaza cualquier ID con esa forma que el entregable no
  declare, y está bien que lo haga: esto no es una fila de M2-D5, es una decisión nueva y tiene que
  distinguirse) con botón "Reanudar etapa", que llama al mismo `PATCH /stages/:id/state` ya
  restringido del punto anterior — el developer solo puede pedir `→ InProgress`, que es exactamente
  lo único que esta pantalla necesita.

**Por qué ninguna de las dos vive en `/developer/project/:id/upload`, que hubiera sido el lugar
obvio:** esa pantalla es "la estructura sale de la captura" (38-DEVELOPER-SPECIFIC-PROJECT-UPLOAD-
EVIDENCE) — meterle un botón de estado sería la regla 1 al revés (la captura no lo muestra, y acá
no hay excepción D-074 que lo permita). `/developer/progress` no está atada a ninguna captura
pixel-perfect, así que es terreno legítimo para una decisión nueva sin pisar una ya tomada.

Tests nuevos: `evidence-upload.test.ts` prueba las 4 combinaciones (Pending→InProgress dispara,
InProgress no hace nada raro con más evidencia, Observed NO se reabre solo, y un documento sin
`stageId` no toca ningún stage). `pnpm verify` completo en verde, incluido `scripts/
check-testids.mjs` (74/74, el piso no se movió — el ID nuevo no cuenta ahí a propósito).

**La matriz de "quién puede pedir cada transición", confirmada por el dueño el mismo día** — y una
corrección de vocabulario que valía la pena hacer explícita: **la FSM es del *stage*, no del
proyecto.** Un proyecto tiene muchas etapas y cada una su propio estado independiente (ahora mismo,
en `torre-a`: `Cimentación` y `Terminaciones` en `Completed`, `Estructura` en `InProgress` —tres
estados a la vez, mismo proyecto—); `Project.status` (`planning`/`in_progress`/`delayed`/
`completed`) es un campo aparte, no esta FSM.

| Transición | Quién | Mecanismo |
|---|---|---|
| `Pending → InProgress` | developer, automático | primera evidencia subida |
| `Observed → InProgress` | developer, manual | "Reanudar etapa" |
| `InProgress → Completed` | certifier, exclusivo | "Certificar" |
| `InProgress → Observed` | certifier, exclusivo | "Observar" |
| cualquiera | admin | sin restricción |

**Verificado en vivo contra Preprod, con TXID real, las cuatro.** `InProgress → Completed`
(2026-09-08, `e842c8ac…571fe22`), `InProgress → Observed` y `Observed → InProgress` (mismo día,
sobre `torre-a` / `Estructura`, ida y vuelta) se probaron antes de que existiera el Stage template;
`Pending → InProgress` quedó pendiente ese día porque **ningún proyecto tenía una etapa en
`Pending`** — confirmado creando dos proyectos y viendo el selector "Elegí la etapa" vacío en los
dos (era el pendiente #1, con una cara nueva). Resuelto el mismo día que se cerró el Stage template:
creado "Torre Pending Test" (developer, vía `/developer/project/new`, las 10 etapas mintean en
`Pending`), subida evidencia real a "Adquisición del terreno" (`/developer/project/:id/upload`,
PDF generado con `pandoc`). Merkle root `25dc32…3dc4c` — coincide exacto con el hash calculado en
local antes de subir — y **TXID real
`578e40f5072353d609a5df9e978e396d55cf149bada16b361829cee2eb7a5486`**, confirmado en
`preprod.cardanoscan.io` (3 confirmaciones, un solo metadato, sin movimiento de valor más que la
fee). Verificado que el auto-avance ocurrió de verdad **contra la API de producción**, no solo
mirando la UI: `GET /projects/:id/stages` devuelve la etapa 1 en `"state": "InProgress"` con
`"hasOnChainThread": true`, las otras 9 siguen en `Pending`. Las cuatro aristas de la FSM del stage
quedan probadas en vivo, cada una con su TXID.

**Cerrado el mismo día · el pendiente #1 completo: las 10 etapas del template, con nombre y
mecanismo de anclaje decididos por el dueño.**

**Decisión 1 — los 10 nombres.** La captura `34C-DEVELOPER-NEW-PROJECT-B.png` es el único lugar
donde existen (mezclados en inglés y español); el dueño los confirmó traducidos y normalizados como
`DEFAULT_STAGE_CATALOG` (`packages/shared`), **sin `progressPercentage`** — no es obligatorio
(`Stage.progressPercentage` es `number | null`, sin uso en el validador) y el dueño prefirió no
inventar un reparto que nadie pidió.

**Decisión 2 — el costo de crear 10 hilos on-chain de un submit.** Se consideró diferir el mint
hasta que cada etapa arranca de verdad (mismo momento que ya dispara `Pending → InProgress`), pero
eso resultó tener el mismo costo total (mint + advance, siempre, por etapa que arranca) con una
complicación real: el validador exige que un mint nazca con datum `Pending`
(`valid_initial_datum`, `mint_rejects_starting_outside_pending` — confirmado leyendo
`contracts/lib/propnexus/fsm.ak` y `contracts/validators/stage.ak`, no supuesto), así que "mintear
tarde" hubiera sido mint-más-advance encadenados, dos eventos por arranque en vez de uno. Agrupar
los 10 mints en una sola transacción tampoco se puede — `mint_rejects_two_threads_in_one_tx` lo
prohíbe explícito. **Se resolvió simple:** `POST /developer/projects` inserta el proyecto, la
membresía y las 10 filas de `Stage` en una sola transacción de base (atómico a nivel de fila — antes
no existía ningún `db.transaction()` en el código, es el primero) y después mintea cada una en loop,
tolerando que alguna quede `Failed` sin bloquear a las demás (D-059, `retry-anchor` ya existente para
el caso legítimo).

**La pantalla** (`developer.project.new.tsx`) recuperó la card "Stage template" que documentaba como
deuda — `SelectDropdown` con una sola opción (no hay nada que elegir hoy) y la lista de 10, ambos
como claves de i18n porque el front no puede importar `DEFAULT_STAGE_CATALOG` en runtime (traería
Zod al bundle). Duplicar la lista en dos lugares es el costo de esa restricción arquitectónica, no
un descuido — el comentario del archivo dice dónde está la otra copia.

**Y una trampa real, encontrada probando el flujo con Claude en Chrome:** el primer intento de
verificar el auto-avance (`Pending → InProgress` al subir la primera evidencia) fallaba en
silencio — la evidencia se anclaba bien, el stage se quedaba en `Pending`. La lógica se había
escrito en `POST /projects/:id/evidence` (`projects-obra.routes.ts`), pero **la pantalla real llama
a otra ruta**: `POST /developer/projects/:id/stages/:stageId/evidence`
(`developer-evidencia.routes.ts`), la que M2-D5 fila 38 exige porque devuelve Merkle root y TXID en
la misma respuesta para el `AnchoringSuccessModal`. La primera SÍ existe y SÍ funciona — es el CRUD
genérico que `apps/api/CLAUDE.md` ya documenta (*"el CRUD genérico... que la superficie del
entregable no consume pero los tests y el seed sí"*) — pero confirmado con `grep -rn
"api.uploadEvidence" apps/web/src`: cero resultados, ningún componente la llama. No es una
duplicación accidental que haya que resolver; es la distinción de siempre entre CRUD genérico y
superficie del entregable, y el error fue mío por no chequear cuál de las dos usa la pantalla antes
de editar.

**Corrección el mismo día: sí había que resolverla, y más a fondo de lo que pensé al principio.** El
dueño preguntó si hacía falta auditar los 87 endpoints por este mismo motivo — no una auditoría
completa (quedó pendiente, a propósito), pero sí se clasificaron los ~24 que ni M2-D5 ni M2-D6
declaran. La mayoría es CRUD genérico admin-only legítimo (`/users`, `/projects`, `/audit-logs`,
`retry-anchor`) o infraestructura de dominio compartida ya documentada (`/stages/:id`,
`/evidence/:id`). Pero dos resultaron **distintas** del resto: `developer`-accesibles (no
admin-only) y sin ningún caller real en el front.

`GET`/`POST /projects/:id/evidence` era la sombra exacta que ya se había encontrado — confirmado con
`grep -rn "api.uploadEvidence" apps/web/src`, cero resultados. Se borró, con sus tests migrados a la
ruta real (`evidence-upload.test.ts` reescrito completo; `browse-and-documents.test.ts` y
`project-access.test.ts` con un caso cada uno).

**`POST /projects/:id/stages` (crear una etapa suelta) parecía distinta** —sin ninguna gemela,
candidata a "la base para una futura UI de agregar etapa"— hasta que `git log` mostró que es
**anterior** al Stage template de 10 (existía antes de `DEFAULT_STAGE_CATALOG`) y que nadie
repreguntó si seguía haciendo falta una vez que el template llegó. Ni M1, ni M2 ni M3 mencionan
agregar etapas después de crear el proyecto — la racionalización de "es la base de una feature
futura" era mía, no del entregable. Se borró también. Los 12 usos en `stage-transitions.test.ts`
(más algunos en `constraint-errors.test.ts`, `browse-and-documents.test.ts`, `units-contracts.test.ts`
y `evidence-upload.test.ts`) que necesitaban un stage con hilo real para probar transiciones migraron
a `test/helpers/stages.ts` (`crearStageMinteado`): la misma inserción + mint que hacía la ruta, sin
pasar por HTTP. Dos tests se borraron sin reemplazo por probar comportamiento puramente de la ruta
que ya no existe (rechazo de `progressPercentage` fuera de rango, y el duplicado de `sequenceOrder`
en `constraint-errors.test.ts` — el mapeo de restricciones que probaba es genérico y ya lo cubren
tres casos más en el mismo archivo). Detalle completo en `apps/api/CLAUDE.md` §CRUD genérico.

Verificado de punta a punta con Claude en Chrome contra `pnpm dev` local (`ANCHOR_MODE=simulated`):
crear un proyecto nuevo deja las 10 etapas minteadas y seleccionables en "Subir evidencia"; subir un
archivo a una de ellas la mueve a `InProgress`, visible en `/developer/progress`. Tests nuevos en
`project-stage-template.test.ts` (transaccionalidad, 10 hilos independientes, membresía del creador)
y `browse-and-documents.test.ts` (el auto-avance contra la ruta real). `pnpm verify` completo en
verde, colección Postman (`specs/postman/`) regenerada.

**El diseño ya está decidido. El trabajo es transcribirlo, no inventarlo.**

`docs/` tiene 70 capturas y un backlog de 53 superficies donde cada una ya trae su path, sus
componentes, sus endpoints y sus test IDs. No hay nada que diseñar y no hay reunión que tener.

## El loop, por pantalla

```
1. abrir la captura           docs/milestone-2-diseno/M2-D2-Screenshots-catalog/<N>-*.png
2. abrir su fila              docs/milestone-3-implementacion/UI-implementation-plan.md  (M2-D5)
3. transcribir                los componentes que la fila nombra, ninguno más
4. endpoints                  los de la fila; si no existen, se crean con la forma que la fila pide
5. test IDs                   los de la fila, literales
6. pnpm verify
7. commit                     con el ID de M2-D5 entre corchetes
```

**Las capturas se leen.** Son PNG y se abren con la herramienta de lectura: no hay que adivinar
espaciados ni colores mirando prosa.

## Las cinco reglas del loop

1. **Cuando la prosa y la captura difieren, gana la captura.** M2-D3 describe; M2-D2 muestra.
   **Excepción (D-074):** el `GradientHeader` autenticado es siempre logo + campana + perfil +
   idioma. Si la captura omite el logo o las utilidades, no se transcribe esa omisión.
2. **Ningún componente que M2-D3 no defina.** Si hace falta uno nuevo, es una decisión nueva, no un
   archivo nuevo.
3. **Ningún estado que M2-D3 no liste.** *"Never invent new statuses; choose the closest semantic
   mapping."*
4. **Ninguna superficie sin sus test IDs.** Una pantalla sin `data-testid` no está terminada — es
   evidencia que pide el SOM, no un lujo.
5. **Los tokens no se eligen, se transcriben.** El hex de M2-D3 es normativo.

## Antes de empezar una superficie

| Vas a tocar | Leé primero |
|---|---|
| Cualquier pantalla | su captura + su fila de M2-D5 + `M2-D1` (permisos del rol) |
| Algo que muestre hash, TXID o Merkle root | `M2-D4` — los 10 patrones son **normativos** |
| Un componente | su ficha en `M2-D3 §Component Library` |
| Un endpoint | `M2-D5` §4-6 (path, test IDs, work stream) + `M2-D6` §9 |
| Un validador | `M1-D1` §Workflow + D-020 (FSM) + D-021 (nunca valor) |
| El modelo de datos | `M1-D2` + `M2-D1` §4 (matriz de permisos) + D-029 |

No leas los cuatro entregables por costumbre: son ~25k tokens. Abrí lo que la fila pide.

---

## Jerarquía de precedencia

- **Obligaciones (el *qué*): manda `docs/`.** Ninguna decisión puede reducir lo que debemos.
  **`docs/` es inmutable** — ni para corregir un error evidente (D-022).
- **Implementación (el *cómo*): `DECISIONS.md` > `CLAUDE.md` > `specs/`.**

Un desvío solo es legítimo si (a) el entregable se contradice internamente, (b) es un error de
redacción, o (c) seguirlo al pie contradiría una verdad del producto declarada por el dueño.
**Nunca por conveniencia ni por preferencia técnica.** Los desvíos vigentes están listados en
`DECISIONS.md`.

Ante contradicción entre documentos: gana el de mayor precedencia y el otro se corrige **en el mismo
commit**. Si la contradicción es con código, avisá antes de "arreglar" nada.

**Y antes de declarar que un entregable está mal: verificá que estás mirando el entregable.** Ya nos
pasó decidir contra una transcripción errónea (ver Trampas).

---

# Reglas duras (innegociables)

1. **Datos primero:** dinero jamás en float — montos en unidades enteras mínimas (lovelace como
   `bigint`; fiat en centavos). Timestamps en UTC. IDs opacos.
2. **Cero PII on-chain o en logs:** ni nombres, ni emails, ni URLs internas, ni nombres de archivo en
   metadata, datums o logs. Solo hashes y refs opacas. Strings de metadata ≤ 64 bytes.
3. **El hash es el ticket de entrada a la cadena de prueba** (D-027). Si un archivo tiene
   `sha256Hash`, termina anclado — o se muestra "Pendiente", **nunca** "Verificado".
4. **Passwords solo con bcrypt** (cost 10, D-046). Jamás loguear ni devolver `passwordHash`.
5. **Autorización en dos capas, siempre:** rol global (`requireRole`) + membresía por proyecto
   (`requireProjectAccess`). La matriz completa está en M2-D1 §4.
6. **Todo body se valida con Zod**, y el schema vive en `packages/shared` **antes** que el endpoint.
7. **Toda mutación relevante escribe `AuditLog`** (append-only) con actor, entidad, acción, timestamp.
8. **Idempotencia en todo lo que toca chain:** re-ejecutar un anclaje o una migración no duplica
   efectos.
9. **La FSM del stage es una sola** (D-020), en `packages/shared` y espejada en Aiken. Si cambia una,
   cambian las dos en el mismo commit.
10. **Uploads:** solo `application/pdf`, `image/jpeg`, `image/png`; máximo `MAX_FILE_SIZE_MB`. Si un
    upload falla la validación después de escribirse, **borrar el archivo huérfano**.
11. **`contracts/plutus.json` se commitea** tras cada `aiken build`; direcciones derivadas del
    blueprint, jamás hardcodeadas.
12. **Secrets solo por env.** Si ves una seed o una key commiteada: frená y avisá.
13. **Ningún validador custodia ni transfiere valor** (D-021).
14. **Cero strings hardcodeados en la UI** (D-025). Todo texto sale del diccionario; moneda, fecha y
    decimales con `Intl.*`. Default `es-AR` con voseo.
15. **El backend devuelve claves de traducción, nunca copy** (M2-D4 §8.2).
16. **Los hashes viajan completos al cliente.** La truncación 6+4 es de presentación y la hace
    `HashChip`. Los TXID son case-sensitive y viajan verbatim.
17. **Nunca mostrar una señal de prueba que no puedas sustanciar** (M2-D4 §6.2). Sin TXID, el estado
    es "Pendiente".

# Prohibiciones

- No inventar componentes, estados, endpoints ni superficies fuera de `docs/` — proponer, no improvisar.
- **Nunca "milestone" para una etapa de obra: es `stage`** (D-067). El riesgo sigue vivo porque los
  entregables usan la palabra y el código ya no. **Excepción:** los test IDs de M2-D5 se transcriben
  literales, incluso `INV-STAGE-MILESTONE-001`.
- No abrir un modal de verificación automáticamente (M2-D4 §6.3). Toda superficie de prueba es
  iniciada por el usuario; la única excepción es `AnchoringSuccessModal`.
- En el front, no hacer `fetch` fuera de `ApiPort`.
- No importar Lucid/Blockfrost fuera de `packages/cardano` (D-014).
- No migrar lógica de negocio on-chain: el backend es fuente de verdad del **registro** (D-007).
- No tocar mainnet: `CARDANO_NETWORK=Preprod` siempre (D-013).
- **No editar migraciones aplicadas** — con la condición de D-063: mientras la única base sea local,
  el esquema se corrige editando el archivo y borrando la base. Con Turso vivo, se termina.
- No tocar `contracts/build/` ni editar `aiken.lock` a mano.
- No commitear `.env`, `apps/api/.data/` (las bases locales), `uploads/` ni artefactos de build.
- No "arreglar" tests cambiando contratos de API o esquema de DB para que pasen.
- **No editar nada dentro de `docs/`** (D-022).

---

# Estructura

```
apps/api          Express 5 + Kysely      → servicio en Render
apps/web          TanStack Router + Vite  → static site en Render (SPA + PWA)
packages/shared   contrato Zod (oRPC)     → lo importan los dos
packages/cardano  AnchorPort              → lo importa la API
contracts/        Aiken · Plutus V3       → no se hostea, toolchain aparte
```

`packages/shared` es lo único que vuelve el drift **imposible** en vez de prohibido. `contracts/` no
está en el workspace pnpm a propósito: otro toolchain, otro lockfile, otra caché.

Tres `.md` en la raíz: **`README.md`** (entrada humana), **`CLAUDE.md`** (este) y **`DECISIONS.md`**
(las restricciones). El mapa de desarrollo en `specs/README.md`; los entregables en `docs/`, mapeados
en `specs/entregables.md`.

| Qué | Dónde |
|---|---|
| Obligaciones, la vara de aceptación | `docs/` (inmutable) |
| Qué archivo de `docs/` es qué entregable | `specs/entregables.md` |
| Qué obliga una decisión | `DECISIONS.md` |
| Por qué se decidió (argumento largo) | `specs/archive/` |
| Reglas y trampas de un frente | `<frente>/CLAUDE.md` |
| Invariantes de una rebanada | `specs/SPEC-NNN` |
| Stack, versiones e infraestructura | `specs/stack.md` |
| Deploy, rollback e incidentes | `specs/RUNBOOK-deploy.md` |

# Stack

| Frente | Con qué | Decisión |
|---|---|---|
| **web** | TanStack Router + Vite (SPA, sin SSR) · React 19 · Tailwind v4 · shadcn/ui · Lucide · PWA | D-065, D-024 |
| **api** | Express 5 + oRPC + Zod + JWT + bcrypt(10) + Multer + helmet, base `/api/v1` | D-066, D-054 |
| **shared** | Zod — el contrato único. El schema va acá **antes** que el endpoint | D-012, D-066 |
| **db** | Kysely · SQLite en dev · Turso en prod · una sola migración | D-038, D-063 |
| **cardano** | `AnchorPort` con adaptadores `simulated` y real (Lucid Evolution) | D-014, D-060 |
| **contracts** | Aiken v1.1.21 · Plutus V3 · stdlib v3.0.0 · blueprint commiteado | D-019, D-058 |
| red | **Preprod siempre**; mainnet fuera de alcance | D-013 |

El inventario completo —versiones reales, qué corre y qué está solo decidido— vive en
`specs/stack.md` y solo ahí (D-034).

---

# Niveles de autonomía

| Nivel | Qué cubre | Cómo se trabaja |
|---|---|---|
| 🟢 Verde | Componentes según M2-D3, superficies según M2-D5, tests, docs, seeds | El LLM implementa directo |
| 🟡 Amarillo | Migraciones, auth/permisos/guards, `packages/cardano`, archivos/S3, CI/deploy, **validadores Aiken** | El LLM propone; revisión humana línea por línea |
| 🔴 Rojo | Claves y firmas, `SERVICE_WALLET_PRIVATE_KEY`, hashing y construcción de commitments | El humano lidera; el revisor debe poder explicar cada línea sin mirar el chat |

Si dudás del nivel, es el más alto de los dos.

# Commits y ramas

`<tipo>(<scope>): <descripción en imperativo, minúscula, sin punto final> [<REF>]`

- **Tipos:** `feat` · `fix` · `refactor` · `test` · `docs` · `chore` · `perf` · `db`
- **Scopes:** `web` · `api` · `db` · `shared` · `cardano` · `contracts` · `ci` · `repo`
- **REF:** el ID de M2-D5 cuando aplique (`[M3-FE-18]`, `[INV-BUY-LIST-001]`) o la decisión (`[D-065]`)

Un commit = un cambio lógico · el cuerpo explica el *por qué* · `BREAKING CHANGE:` si rompe contrato
de API o esquema on-chain. **`main` es la rama de integración y no hay PRs** (D-030).

**Testear, commitear y pushear son una sola unidad de trabajo.** `pnpm verify:all` en verde →
`git commit` → `git push`, siempre juntos y en ese orden. No se junta trabajo local "para pushear al
final", y no se commitea sin el verde.

**Por qué es regla y no gusto:** un commit local no existe para nadie más, y el remoto queda
afirmando un estado que no es el real — el mismo modo de falla que el push contra un servicio
suspendido y que el TXID simulado en producción. **No falla: miente.** Si pushear tiene una
consecuencia que el dueño debería saber —acá el deploy automático de Render, que el `buildFilter`
no filtra—, se pushea igual y se avisa; no se retiene el push por eso.

**La documentación viaja con el código que la causa, en el mismo commit.** Un cambio que altera cómo
se opera, se configura o se despliega algo llega con su documentación adentro — no en un `docs(...)`
posterior. Un `docs(...)` suelto es legítimo solo cuando el cambio **es** documentación: sanear algo
desactualizado, cerrar una decisión, escribir una trampa recién aprendida.

**Por qué es regla y no gusto:** el 2026-08-27 el commit de R2 salió sin cerrar D-051, y durante tres
commits `DECISIONS.md` afirmó que la evidencia era efímera mientras la evidencia ya vivía en R2. La
ventana entre el código y su documentación es una ventana en la que el repo miente, y quien lea en
el medio no tiene forma de saberlo.

# Comandos

```bash
pnpm install                      # bootstrap del workspace
pnpm dev                          # web + api en paralelo
pnpm verify                       # app TS: lint + typecheck + tests + build
pnpm contracts:verify             # Aiken: fmt + check + build
pnpm verify:all                   # las dos, encadenadas
pnpm lint:fix                     # Biome arregla lo mecánico

pnpm --filter @plataforma/api test:s3         # storage contra MinIO real
pnpm --filter @plataforma/cardano test:yaci   # anclaje contra un nodo Cardano real
docker compose -f compose.dev.yml up -d       # solo si querés la infra levantada aparte
```

**TypeScript y Aiken no se mezclan:** distinto toolchain, distintos artefactos, distintos modos de
falla. El CI los corre como dos jobs en paralelo. Los dos últimos comandos **no corren en CI** (no
levanta infraestructura): se corren a mano.

Los comandos por frente (`db:migrate`, `db:seed`, `e2e`) están en el `CLAUDE.md` de cada uno.

---

# Trampas transversales

Sección viva: agregá acá el mismo día que te muerda una. Las de cada frente van en su `CLAUDE.md`.

- **Las capturas de M2-D2 tienen datos mock, no datos de diseño.** M2-D1 lo dice: *"the maquette uses
  mock blockchain interactions"*. Lo normativo de una captura es la **estructura** —layout,
  componentes, jerarquía, estados—; los valores no. La captura 55 muestra tres unidades del mismo
  proyecto en tres stages distintos y casi nos hace modelar stages por unidad, cuando el dominio dice
  que un desarrollo tiene un solo trámite (D-029).
- **Antes de concluir que un entregable está mal, verificá que estás mirando el entregable.** Cuatro
  `.puml` regenerados desde los PDF de M1 tenían las flechas de la FSM invertidas, y durante una
  sesión entera creímos que el entregable estaba mal. El paquete canónico es
  `M1-D2-Architecture-and-Data-Models/`, hasheado en la Proof of Achievement.
- **Grepear solo `*.md` esconde entregables.** Una búsqueda con `--include="*.md"` concluyó que algo
  no aparecía en `docs/`; estaba en un `.csv`. Grepeá sin filtro de extensión.
- **Los códigos de entregable se reinician en cada milestone y colisionan**: `M1-D1` es el whitepaper,
  `M2-D1` es el mapa de arquitectura de información. Al citar, usá siempre la forma completa
  (`M2-D1 §4`). Y `M2-D5`/`M2-D6` son entregables de **Milestone 2** aunque vivan en la carpeta de M3.
- **Los PDF de este repo no se leen con la herramienta de lectura** (falta `pdftoppm`). Las capturas
  PNG sí. Para un PDF: `qlmanage -t -s 1800 -o <dir> archivo.pdf`.
- **Un verificador que vive dentro del corpus que verifica se encuentra a sí mismo.** Un guardia que
  matcheaba la mención de `docs/` se bloqueó al escribirse. **Antes de agregar un verificador,
  preguntá si el problema no se arregla mejor cambiando la forma de lo verificado** (D-053).
- **Editar un `package.json` sin correr `pnpm install` produce un verde falso.** Lo atrapa
  `pnpm install --frozen-lockfile` en CI, y alcanza. Un verde sobre el entorno equivocado es peor que
  un rojo.
- **`pnpm.overrides` vive en `package.json` y pnpm 10+ dejó de leerlo.** El pin
  `"packageManager": "pnpm@9.15.0"` es lo único que hoy lo sostiene: un pnpm más nuevo instalado en
  la máquina delega a 9.15.0 y el override se aplica igual —lo prueba la línea 8 de `pnpm-lock.yaml`
  y que `@types/express` resuelva a 5.0.6—, pero avisa `The "pnpm" field in package.json is no longer
  read by pnpm`. **Ese warning no es ruido: es la cuenta regresiva.** El día que se suba el pin a
  pnpm 10+, los overrides se ignoran **en silencio** y sin romper el build; hay que moverlos a
  `pnpm-workspace.yaml` en el mismo commit que sube la versión.
- **`pnpm verify` corre contra el entorno de test, no contra el que declara `render.yaml`.** Entre
  los dos no había nada, y una regresión de configuración solo se veía en los logs del deploy.
  Lo cierra `apps/api/test/render-config.test.ts` (D-076). **Si agregás una lectura de `env.*`
  nueva, declarala en `render.yaml` o el test se pone rojo** — que es el punto.
- **Las capturas del developer no coinciden en el header.** Documentación (46) va sin logo, Audit
  log (49) va con logo, ninguna trae campana ni idioma, y M2-D3 dice *never omit the logo*. No se
  transcribe captura por captura: D-074 unifica. Si una pantalla nueva "sigue la captura" y saca el
  logo, está mal.
