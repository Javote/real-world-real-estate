# DECISIONS.md

**Las restricciones vigentes. Nada más.**

Cada entrada dice **qué obliga hoy**, en una o dos líneas. El argumento completo —el contexto, lo
que se descartó, lo que se midió— vive en
[`specs/archive/DECISIONS-hasta-2026-08-23.md`](specs/archive/DECISIONS-hasta-2026-08-23.md), que
conserva las 63 entradas originales enteras.

**Por qué se partió** (D-068): el archivo había llegado a 2400 líneas para una app con 2% de
conformidad. La documentación creció más rápido que el producto, y buena parte describía cosas que
ya no existen. Partirlo no pierde nada: el porqué sigue estando, deja de pesar.

> **Jerarquía de precedencia — dos capas:**
>
> - **Obligaciones (el *qué*): `docs/` es ley.** Entregables aprobados por reviewers de Catalyst
>   1400106. Nada de este archivo puede reducir lo que debemos.
> - **Implementación (el *cómo*): `DECISIONS.md` > `CLAUDE.md` > `specs/`.**
>
> **`docs/` no se edita nunca.** Un error o una ambigüedad en un entregable se resuelve con una
> decisión acá que cite el documento y el párrafo. Un desvío solo es legítimo si (a) el entregable
> se contradice internamente, (b) es un error de redacción, o (c) seguirlo al pie contradiría una
> verdad del producto declarada por el dueño — **nunca por conveniencia**.
>
> **La numeración no se recicla.** Las decisiones nuevas siguen desde D-080.

## Desvíos vigentes

Los lugares donde **no seguimos la letra** de un entregable, cada uno con el caso que lo legitima.
Todos se comunican en la entrega.

| Qué dice el entregable | Resolución | Caso | Decisión |
|---|---|---|---|
| M3 SOM: "Plutus **V2** state machine" | El proyecto Aiken compila **Plutus V3**, que es lo que Aiken 1.1.x emite. Ningún entregable fija versión de Aiken | (b) redacción | D-019 |
| M3 SOM: "signers/**percentages** configurables", "reserva → **escrow**" | La plataforma nunca custodia ni transfiere valor. Los porcentajes son cronograma registrado; el "escrow" es el contrato anclado | (c) verdad del producto | D-021 |
| M1 §README lista los estados como "…**Certified**…"; el `.puml` dice `Completed` | Gana `Completed`: precedencia interna de M1, y `Certified` implicaría que la plataforma certifica | (a) contradicción interna | D-020, D-026 |
| M1 §README promete que la taxonomía indica "authoritative" y "anchored on-chain" | El CSV entregado no tiene esas columnas. El hueco lo llenan D-027 y D-028 | (a) contradicción interna | D-027, D-028 |
| M2-D5 §2.1 usa notación de rutas Wouter | Las rutas se leen como **paths**, no como elección de router | (b) redacción | D-022 |
| M2-D4 §Pattern 2 dice "First 6 characters **after** the `0x` prefix" y su ejemplo es `0xdcd5...7994`, que son 6 **contando** el prefijo | Gana el ejemplo: es la única de las cuatro menciones de la regla que muestra el resultado, y las otras tres dicen solo "6+4 characters" | (a) contradicción interna | D-069 |
| M2-D1 §6 "Evidence flow" pasos 5-6: DEV *"Release stage N payment is enabled"*, INV *"Contract and **payments**… Releases by Stage"* | La plataforma **no administra fondos**: refleja y respalda la vida real, no la ejecuta. Sí puede mostrar el estado comercial de la unidad (vendida / disponible) | (c) verdad del producto | D-070 |
| M2-D5 fila 42-43 lista un componente `Chart` que M2-D3 no define entre sus 36 | Las barras de la captura 42 son **composición de esa pantalla**, no una entrada nueva de la biblioteca | (a) contradicción interna | D-073 |
| M2-D2 dibuja headers distintos en secciones hermanas del developer (46 sin logo, 49 con logo) y omite campana / perfil / idioma; M2-D3 dice *never omit the logo* y reserva el slot derecho a esas utilidades | Header autenticado unificado: logo + campana + perfil + idioma; `back` no reemplaza al logo | (a) contradicción interna + (c) verdad del producto | D-074 |
| M2-D5 §3 asume tRPC-libre "REST over HTTPS"… y lo marca `[ASSUMPTION]` anulable | **Se confirma, no se anula**: la columna de endpoints de las 53 filas y la verificación externa por `curl` dependen de REST | — | D-066 |

---

# Las verdades del producto

Estas cuatro no se negocian y ninguna decisión técnica puede erosionarlas.

## D-021 — La plataforma nunca custodia ni transfiere valor

Ningún validador retiene fondos, en ninguna fase. On-chain van commitments y TXIDs, nunca valor.
"Release" significa **anclar el evento de liberación**, no ejecutar el pago. Si una spec o un prompt
pide un validador que retene fondos, está mal: frenar y avisar.

## D-026 — La plataforma no certifica, no valida y no decide

Acompaña procesos que ya existen afuera y los refleja. El rol certifier verifica **integridad y
completitud** contra los hashes anclados, no validez legal. Solo se pueden sostener cuatro
afirmaciones: *este archivo tiene este hash* · *se registró en este momento* · *declara provenir de
esta autoridad externa* · *esta persona atestiguó haberlo revisado*. Copy, modelo o validador que
afirme más está mal.

## D-027 — El hash es el ticket de entrada a la cadena de prueba

Solo se hashea lo que se va a anclar. Si un archivo tiene `sha256Hash`, termina anclado — o se
muestra "Pendiente" mientras confirma, **nunca** "Verificado". El hash lo calcula el servidor y no
se recalcula ni se edita. Los assets informativos (renders, folletos, fotos de unidad de muestra) no
se hashean, no se anclan y no muestran ninguna señal de prueba. No hay estado intermedio.

## D-022 — `docs/` es inmutable

Ni para corregir un error evidente. Los originales viven afuera y están aprobados. Los desvíos se
registran acá arriba.

---

# Dominio y modelo

## D-018 — El producto se llama PropNexus

En toda superficie visible. La clave de `localStorage` del idioma es `propnexus.lang`, literal.

## D-020 — La FSM canónica del stage

`Pending → InProgress → {Observed ⇄ InProgress, Completed}`, con `Completed` **terminal**.
`Observed` es remediación, no estado final. Se llama `Completed` y no `Certified` (D-026). **Una
sola tabla de transiciones**, hoy en `packages/shared` y espejada en `contracts/lib/propnexus/fsm.ak`
— si cambia una, cambian las dos en el mismo commit.

## D-029 — Los stages son del proyecto; la unidad es lo comercial

Un desarrollo tiene **un solo trámite**: no se hace movimiento de suelos por departamento. `Unit`
nace en la subdivisión y puede no existir al principio. El dossier es por unidad, pero compone
pruebas del proyecto.

## D-028 — Qué es "evidencia sin firmar"

La plataforma no valida la firma: **registra la declaración de origen y la atestación de revisión**.
Evidencia sin firmar es (a) la declarada `authoritative` sin atribución de autoridad
(`issuingAuthority`, `authorityReference`), o (b) un bundle que ningún revisor atestiguó. **El
rechazo ocurre en la transición, no en el upload**: subir siempre se puede; avanzar no.
*Estado: implementado el piso (exige que haya evidencia). Faltan las columnas de (a) y (b).*

## D-067 — `Milestone` → `Stage` en todo el dominio — **ejecutada 2026-08-24**

"Milestone" queda reservado a los hitos de Catalyst (M1/M2/M3). Ejecuta D-023, que estuvo abierta un
mes. **La evidencia que lo decidió:** en `docs/` hay 203 apariciones de "stage" contra 135 de
"milestone", y en M2-D5 —el índice que vamos a transcribir— **todos los paths y test IDs dicen
`stage`** (`/projects/:id/stages`, `CER-STAGE-VIEW-001`). Mantener `Milestone` obligaba a traducir
en cada pantalla. **Excepción: los test IDs se transcriben literales**, incluso `INV-STAGE-MILESTONE-001`.

**No es `ConstructionStage` ni `MilestoneStage`.** Los dos aparecen **cero** veces en `docs/`:
`ConstructionStage` lo inventó D-023 y `MilestoneStage` no lo escribió nunca nadie. El entregable
dice `stage` a secas en identificadores y "construction stage" como frase en prosa (8 veces). Se usa
el identificador.

---

# Frontend

## D-064 — El front se reconstruye desde las capturas, no se refactoriza

Medido el 2026-08-23: **6 de 53 superficies** de M2-D5 existen, **10 de 33** componentes de M2-D3,
**0 de 10** patrones de prueba de M2-D4, **0** test IDs, y la paleta del código **no comparte un solo
color** con la normativa. Refactorizar eso cuesta más que transcribirlo.

**Se conserva** lo que es decisión y no superficie: `ApiPort`, `useRoleGuard` (los role groups de
M2-D1 §7.2), la maquinaria de i18n, el router y los configs.
**Se borra** todo lo demás, incluidas dos superficies que **no existen en ningún entregable**:
`/dashboard` y `/verify`. La verificación sin cuenta la cumple `/public/dossier/:shareToken`, que sí
está especificada.

## D-065 — Web sin SSR: TanStack Router sobre Vite, static site, PWA desde el arranque

Revierte la mitad "Start" de D-002; **shadcn/ui y Tailwind v4 siguen** (D-024).

**La evidencia:** `grep` de `createServerFn|createServerRoute|loader:|beforeLoad:` sobre `apps/web`
daba **cero**. Pagábamos un runtime de SSR que no usábamos, y ya lo habíamos pagado dos veces en
depuración (D-037 con Nitro, D-050 con el `502`).

**Consecuencias:** el web pasa de servicio Node a **static site** en Render — no se duerme, no
consume del presupuesto de horas, y la API se queda sola con las 750. **PWA desde el arranque**:
manifest, service worker y shell offline, que es lo natural sobre un SPA servido desde CDN y lo que
las capturas piden (son teléfonos). App nativa: **no** — el día que se quiera, reutiliza
`packages/shared` y el `ApiPort`, nunca los componentes.

**Se pierde:** previews de link (OG) para el dossier público. Se resuelve con una página
prerenderizada cuando haga falta; no bloquea M3.

## D-070 — La plataforma no administra fondos: el "ciclo de dinero" de M2-D1 §6 no se transcribe

**Desvío legítimo por la causal (c)** de la jerarquía de precedencia: *seguir el entregable al pie
contradiría una verdad del producto declarada por el dueño* (2026-08-24).

M2-D1 §6 "Evidence flow" cierra con dos pasos que no se van a construir como los describe:

| Paso | Lo que dice el entregable |
|---|---|
| 5 | DEV · *"Project detail → Contracts and releases. After certification, **Release stage N payment** is enabled."* |
| 6 | INV · *"Unit → **Contract and payments**. Sees stage-release TXID listed under **Releases by Stage**."* |

Eso describe una plataforma que habilita y ejecuta pagos por etapa. **No es este producto.** La
plataforma refleja y respalda en la cadena la vida real que ocurre afuera; no administra fondos, no
los custodia y no los libera. D-021 ya lo decía para los validadores; esto lo extiende a la
**superficie y al lenguaje**, que es por donde se había colado.

**De dónde salió:** de un documento viejo y erróneo que se creyó subsanado y no lo estaba. No es
una contradicción interna de M2-D1 —el paso está escrito con toda intención— así que no alcanza con
leerlo distinto: hay que declarar el desvío.

### Qué SÍ puede mostrar la plataforma

Lo que es verdad y verificable: **el estado comercial de las unidades**. Que las unidades de un
proyecto terminado ya no están disponibles porque se vendieron es un hecho del mundo real que el
registro puede reflejar y la cadena respaldar. Eso es `Unit.status` y el `Contract` como registro
del acuerdo — no un flujo de pagos.

### Consecuencia inmediata

Las filas 40-41 (`/developer/project/:projectId/contracts`) y 23-24
(`/investor/unit/:unitId/contract`) **no se transcriben con el encuadre de pagos**. Cuando se
construyan, muestran el contrato como registro y el estado de la unidad, no un botón de liberar.

### Deuda declarada, no resuelta acá

El encuadre viejo dejó rastro y **sigue en el repo**, funcionando y testeado. No se toca en este
commit porque borrarlo es un cambio de alcance propio, no un efecto colateral:

- `apps/api/src/routes/capital.routes.ts` y `contracts.routes.ts` (incluido
  `POST /developer/contracts/:id/releases/:stageNum`)
- la tabla `PaymentRelease` y el evento `PAYMENT_RELEASE`
- `packages/shared/src/capital.ts`
- `apps/web/src/components/domain/ReleaseProofList.tsx`
- el patrón **P10** de M2-D4, *"Per-release financial proof"*

Los comentarios de esos archivos ya aclaran que "release" significa anclar el evento y no mover
plata (D-021), así que hoy no afirman nada falso. Lo que hay que decidir aparte es si esa superficie
existe.

## D-069 — El HashChip trunca 6+4 **contando** el prefijo `0x`

M2-D4 §Pattern 2 se contradice: el texto dice *"First 6 characters after the `0x` prefix"* y el
ejemplo de la misma línea es `0xdcd5...7994`, donde `0xdcd5` son exactamente 6 **con** el prefijo —
o sea 4 después de él. Las otras tres menciones de la regla (M2-D3 §Principio 1, M2-D4 §Solution,
M2-D4 §Depth 2) dicen solo *"6+4 characters"*, sin aclarar.

**Gana el ejemplo.** Es la única de las cuatro que muestra el resultado, y es la lectura con la que
las cuatro concuerdan. Un hash sin prefijo se trunca a 6+4 a secas.

Lo encontró un test, no una lectura: el primer intento implementó la letra de la regla y falló
contra el ejemplo del propio entregable.

## D-024 — Sistema de diseño: Tailwind v4 + shadcn/ui con los tokens de M2-D3

Los **tokens no se eligen: se transcriben**. Color, matriz de status pills, escala tipográfica (10
niveles, dos monoespaciados exclusivos para hashes), espaciado 4px, radios, elevación. Hex normativo.
Iconos de Lucide, nunca portadores únicos de significado.

## D-025 — i18n es-AR / en-US, cero strings hardcodeados

Todo texto visible sale de una clave. Moneda, fecha, relativos y decimales con `Intl.*` y el locale
activo. Default `es-AR` con voseo ("Mirá tu unidad", no "Mira" ni "Mire"). **El backend devuelve
claves de traducción, nunca copy** (M2-D4 §8.2).

## D-072 — Las tres pantallas huérfanas del developer se alcanzan desde el Panel

**Desvío legítimo por la causal (a)** de la jerarquía de precedencia: *el entregable se contradice
internamente* (2026-08-26).

M2-D1 §4, matriz de permisos, otorga `R W` sobre *"Profile and notification preferences"* a los
cuatro roles y lo subraya: *"All roles manage their own profile."* Las reglas de localización lo
repiten dos veces —el `LanguageToggle` va en *"every profile screen across all four roles"* (§45) y
*"Login + Profile (all roles)"* (M2-D3 §296)—. Pero el Screen Tree del developer (M2-D1 §5.2) **no
tiene fila de `/developer/profile`**, y su bottom nav son cinco tabs sin ninguno de perfil.

El mismo documento le da tres pantallas al developer **sin decir cómo se llega a ninguna**:

| Pantalla | Está en | Entrada definida |
|---|---|---|
| `/developer/profile` | matriz de permisos §4 | ninguna |
| `/developer/documentation` | Screen Tree §5.2 | ninguna |
| `/developer/investors` | Screen Tree §5.2 | ninguna |

Investor llega a su perfil por el tab 5 ("User"); notary y certifier por su tab 4 ("Profile"). El
developer es el único de los cuatro sin acceso.

**Lo que se descartó y por qué.** Un sexto tab contradice a M2-D3 §Layout (*"4 or 5 tabs depending
on role"*) y a la tabla taxativa de cinco tabs de M2-D1 §5.2: sería romper algo normativo para
tapar algo omitido. Y los `StatCard` del panel ("Verified Documents", "Active Investors") **no son
la entrada implícita**: M2-D3 §StatCard define dos estados, Default y Highlighted, y ninguno es
interactivo.

**Lo que se hace:**

1. **Perfil → ícono en el slot derecho del `GradientHeader`**, junto a la campana y el toggle de
   idioma. M2-D3 §GradientHeader ya reserva ese slot para *"utilities: NotificationBell,
   LanguageToggle, action button"*, así que no se inventa superficie: se usa un slot definido.
   D-074 monta esas tres utilidades en **todo** `PanelLayout`; esta decisión sigue siendo la que
   explica *por qué el developer llega al perfil por el header* (no tiene tab).
2. **`/developer/documentation` y `/developer/investors` → `ActionCard` en el Panel.** M2-D3
   §Layout patterns ya declara la grilla de acción como patrón del Developer Panel (*"New project
   tile + Active Projects"*), y `ActionCard` es uno de los 36.

**La regla de orden que impone:** un tile entra en el mismo commit que su pantalla, nunca antes. Un
destino que no existe se ve terminado y no lo está.

## D-073 — El `Chart` de las filas 42-43 es composición de pantalla, no un componente nuevo

**Desvío legítimo por la causal (a)** de la jerarquía de precedencia: *el entregable se contradice
internamente* (2026-08-26).

M2-D5 fila 42-43 lista `Chart (monthly + per-project)` entre los componentes de `/developer/capital`,
y M2-D1 §5.2 lo describe: *"Monthly evolution bar chart, By Project breakdown with share-of-total
bars."* Pero **`Chart` no está entre los 36 componentes de M2-D3 §Component Library**. Un entregable
manda un componente que el otro no define, y SPEC-014 invariante 1 es taxativo: *"Ningún componente
fuera de M2-D3. Uno nuevo es una decisión, no un archivo."*

**Qué se miró antes de decidir.** La captura 42. Lo que dibuja son seis barras verticales con su
valor encima y el nombre del mes debajo. **Sin ejes, sin grilla, sin leyenda, sin tooltip, sin
interacción.** La altura de cada barra es un porcentaje; el color es `--color-primary`; el radio y
la tipografía son tokens. No hay nada ahí que M2-D3 no provea ya.

Y las *share-of-total bars* del desglose por proyecto **no son parte del problema**: son el
`ProgressBar` de M2-D3, que existe desde la primera rebanada.

**Lo que se hace:** las barras se arman **dentro de la ruta** `developer.capital.tsx`, con tokens y
sin agregar nada a `components/domain/`. No se crea un componente `Chart`.

**Lo que se descartó y por qué.** Crear `Chart.tsx` habría sido inventar una entrada de la
biblioteca —con su anatomía, sus estados y sus reglas de uso— que ningún entregable especifica: el
riesgo no es el archivo, es que la próxima pantalla lo herede y la biblioteca crezca por acumulación
en vez de por decisión. Y una librería de gráficos, además, sería una dependencia nueva para dibujar
seis rectángulos.

**El criterio que fija, y es lo único que hay que recordar:** una composición se vuelve componente
cuando la necesita una **segunda** superficie. Hoy son las barras verticales de una sola pantalla.
El día que otra las pida, se extrae — y eso sí es una decisión, con su número.

Es el mismo criterio con el que `PanelLayout` vive en `components/` sin ser de M2-D3: se extrajo
porque lo repetían cuatro paneles y repetirlo garantizaba que se desincronizaran.

## D-074 — El header autenticado es uno: logo + campana + perfil + idioma

**Desvío legítimo por las causales (a) y (c)** de la jerarquía de precedencia: *el entregable se
contradice internamente*, y *seguirlo al pie contradiría una verdad del producto declarada por el
dueño* (2026-08-28).

M2-D3 §GradientHeader es taxativo: *"Never omit the logo — it is the role-agnostic anchor"* y el
slot derecho está reservado a *"NotificationBell, LanguageToggle, action button"*. Las capturas del
developer no cumplen ninguna de las dos cosas, y no coinciden entre sí. Documentación (46) e
Investors (48) reemplazan el logo por "← Back to panel". Audit log (49) y el detalle de proyecto
(37) dejan el logo y ponen la flecha debajo. Ninguna dibuja campana, avatar ni idioma. Transcribir
captura por captura produjo tres headers distintos en secciones del mismo panel.

**Lo que se hace.** Toda pantalla autenticada que use `PanelLayout` muestra el header completo:

- Logo PropNexus a la izquierda. No hay forma de ocultarlo.
- Campana, perfil e idioma a la derecha. La pantalla no los pasa ni los saca.
- Si hay padre, `back` va **entre** el logo y el título. Nunca en el lugar del logo.

Login no usa `PanelLayout`: ahí sigue solo el toggle de idioma (M2-D3 §LanguageToggle).

La campana cuenta no leídas (`GET /notifications/unread-count`, cross-rol). Solo el investor tiene
inbox en M2-D5; en los otros tres roles cae al panel. No se inventa una superficie de notificaciones.

**Lo que se descartó.** Seguir transcribiendo el header captura por captura. El resultado ya se
vio: `/developer/investors` sin logo, `/developer/audit-log` con logo, home con utilidades que las
otras no tenían. Unificar a la versión *mínima* (solo flecha) contradice M2-D3. Unificar a la
completa no inventa componentes: usa el slot que el entregable ya definió.

---

# API y contrato

## D-066 — Contrato único tipado: Zod en `shared` + oRPC sobre REST. tRPC descartado

**tRPC no**, por tres razones en orden de peso: M2-D5 define **método + path** para las 53
superficies y esa columna es criterio de aceptación; la tesis del producto exige que un tercero
verifique con `curl`; y D-022 no admite desviarse de un entregable por conveniencia.

**Lo que sí:** el contrato vive una sola vez en `packages/shared` como Zod, y de ahí se derivan
**los handlers y el cliente**. `@orpc/openapi` mantiene paths REST literales de M2-D5 y produce el
OpenAPI. Mata las cinco costuras donde hoy los tipos se cortan — sobre todo el espejo escrito a mano
de `apps/web/src/api/types.ts`.

**Descartado `ts-rest`** por dato, no por gusto: último publish 2025-06-02 contra oRPC, que publicó
1.15.0 el día de esta decisión.

**El framework no cambia: Express 5 se queda** (D-054 tiene tres semanas y el principio 3 pide
evidencia para reabrir). Lo valioso de la API son los middlewares —autorización en dos capas, rate
limit, `errorHandler`, uploads—, y sobreviven al re-scopeo por rol. Con oRPC el framework deja de
importar para el type-safety. Se descartó Hono porque su cliente `hc` infiere del tipo del servidor,
lo que haría que `apps/web` importe de `apps/api` e **invertiría** la dependencia que `packages/shared`
existe para evitar.

**Los endpoints se re-scopean por rol** (`/investor/*`, `/developer/*`, `/notary/*`, `/certifier/*`)
**vertical por vertical**, nunca en un big-bang.

## D-007 — El backend es fuente de verdad del **registro**; on-chain van pruebas

No decide el estado de una obra: lo determinan procesos externos. Es fuente de verdad de **qué se
declaró, cuándo y quién**. El `state` del datum on-chain es un **commitment, no la autoridad**: que
el validador verifique la transición no lo vuelve fuente de verdad, lo vuelve algo que **ni el
operador puede reescribir después**.

**Dos puntos de enforcement, una sola fuente de verdad:** la API valida al registrar (protege contra
un cliente o un bug); el validador valida al anclar (protege contra nosotros).

## D-042 — En la superficie 🔴 el default inseguro no existe

Si falta configuración crítica, el proceso **revienta al arrancar** — no en la primera request con
un usuario esperando. Aplica a `JWT_SECRET` y a `STORAGE_DRIVER=s3`: sin ellos no hay forma segura
de seguir sirviendo.

**Ya no aplica al anclaje**, porque ahí sí la hay — ver D-075.

## D-043 — La visibilidad de proyectos existe una sola vez: `projectScope`

Misma semántica que `canAccessProject` sobre un proyecto puntual, en forma de query.

## D-045 — Rate limiting en `/auth/login`

Existe porque cerrar el oráculo de tiempos hizo que **todo** intento cueste un bcrypt. La IP sale de
`TRUST_PROXY_HOPS`: 0 en local, 1 detrás de Render. Con 0 detrás del proxy todos comparten balde y
la app queda inusable.

## D-046 — bcrypt cost 10, con argumento

En 0.1 CPU un KDF memory-hard es la forma equivocada. La **política** (mín. 8 caracteres, máx. 72
bytes rechazando en vez de truncar, sin reglas de composición) vive en `passwordSchema` de
`packages/shared` y se aplica donde la password se **escribe**, nunca en el login. Jamás loguear ni
devolver `passwordHash`.

## D-047 — El seed de demo se niega a sembrar credenciales publicadas fuera de local

Contra cualquier base que no sea un SQLite local exige `SEED_ADMIN_PASSWORD`/`SEED_DEMO_PASSWORD`.

## D-035 · D-036 — Zod 4 en el contrato · Multer 2.x

---

# Datos

## D-038 — SQLite en dev, Turso en prod. ORM: Kysely

Turso es **obligatorio, no preferencia**: en free tier no hay disco persistente.

## D-063 — Una sola migración, y la regla con su condición explícita

`apps/api/migrations/0000_init.sql` describe la base entera. **"No editar una migración aplicada"
protege entornos, no archivos:** mientras la única base sea `dev.db` y la `test.db` que la suite
recrea, el esquema se corrige editando el archivo y borrando la base local. **El día que exista
Turso, toda corrección es migración nueva, sin excepción.**

El runner registra por nombre de archivo: una base que ya aplicó una versión anterior **no** aplica
la nueva y se queda con el esquema viejo en silencio. Si tenés una base anterior, borrala.

## D-012 — Cambios aditivos entre deploys; migraciones idempotentes en el arranque

## D-061 — Todo stage es `validation_critical`

Sin evidencia no se completa. El flag existía con default `false` y **nadie lo llenaba**, así que la
regla más fuerte del whitepaper colgaba de una casilla que alguien podía olvidarse de marcar.
Ningún entregable define cuáles stages lo son: `validation_critical` aparece dos veces en todo
`docs/`, una como atributo y otra como *"optional criticality metadata"*.

**Anclar evidencia lo dispara el admin, nunca el upload.** El SHA-256 se sigue calculando al subir
(D-027); lo que deja de ser automático es *anclar*: una vez en la cadena no se borra, y anclar en el
upload anclaría borradores.

**Los dos caminos on-chain de M1-D2 §1**, porque el entregable dibuja dos:

| Camino | Qué prueba | Cómo |
|---|---|---|
| `Evidence Anchor Transactions` | *este archivo existía a esta hora* | metadata, label 1904, sin validador (D-006) |
| `Milestone State Anchors` | *este stage se completó con esta evidencia y en este orden* | Merkle root del bundle en el datum (D-008) |

---

# Cadena

## D-013 — Preprod siempre. Mainnet fuera del alcance de M3

## D-005 — Lucid Evolution + Blockfrost

En local el provider es **Kupmios**: el de Blockfrost en Lucid 0.6 lee `cost_models_raw`, que
yaci-store todavía no devuelve. El adaptador no se entera — recibe la instancia ya construida.

## D-014 — La cadena detrás de un puerto propio, con modo real y simulado

`packages/cardano` expone `AnchorPort`. **El simulador es producto, no stub**: rechaza doble gasto,
hilo duplicado, transición inválida, identidad reescrita y stage crítico sin commitment. Uno que
dice que sí a todo miente, y encima da confianza. `ANCHOR_MODE` sin default inseguro; si la
configuración está rota el puerto se inhabilita y la API sigue viva (D-075).
**Nada fuera de `packages/cardano` importa Lucid o Blockfrost.**

## D-075 — Una configuración de anclaje rota inhabilita el puerto, no la API

Si el `AnchorPort` no se puede construir —falta `BLOCKFROST_API_KEY`, la seed es inválida,
Blockfrost no responde, o es `ANCHOR_MODE=simulated` contra una base remota— la API **arranca
igual** con un puerto inhabilitado que rechaza toda operación de anclaje.

**Por qué se cambió.** Antes eso era `process.exit(1)` por D-042. El costo apareció al planear el
encendido del modo real: pushear `render.yaml` con `ANCHOR_MODE: real` antes de cargar los secretos
dejaba la instancia **sin API** —no un anclaje que falla: login, listados, evidencia, contratos, todo
abajo— y la ventana duraba lo que tardara alguien en cargarlos a mano. Matar el proceso castiga a
las otras cincuenta funciones por el problema de una.

**Por qué es seguro, que es la pregunta que importa.** El puerto inhabilitado no produce **ni un
solo TXID**: no puede afirmar una prueba que no existe (regla 17, D-026). Y la degradación ya estaba
diseñada para el resto del ciclo de vida —SPEC-013 §Invariante 2: si el puerto tira una excepción,
la declaración queda escrita y el evento queda `Failed`—. Lo único que quedaba afuera del invariante
era el puerto que nace roto; esto lo mete adentro. Un Blockfrost caído y una key ausente ahora
producen el mismo resultado visible, que es lo correcto: **una configuración rota no es peor que una
caída del proveedor, y ninguna de las dos justifica apagar el producto.**

**Lo que se pierde, dicho en voz alta.** D-042 quería que el operador se enterara antes que el
usuario. Con esto, un anclaje puede fallar con evidencia ya subida. A cambio queda el log de
arranque (`AnchorPort listo en modo "disabled"` más el motivo), el motivo adentro de cada rechazo,
y un producto que sigue funcionando. `"disabled"` no es un valor de `ANCHOR_MODE`: no se elige, se
cae en él.

## D-076 — `render.yaml` tiene contrato y lo verifica la suite

`apps/api/test/render-config.test.ts` carga el Blueprint y (a) ejecuta las reglas de arranque de la
API contra el `ANCHOR_MODE` declarado y una `DATABASE_URL` con forma de Turso, exigiendo que el
puerto no quede inhabilitado; (b) exige que los secretos del modo real estén como `sync: false`;
(c) exige que **toda** variable que el backend lee esté declarada, con una lista corta de opcionales
que a su vez se verifica que no envejezca.

**Por qué existe.** El 2026-08-31 se pusheó un commit sabiendo que dejaría el anclaje inhabilitado
en producción, y eso se verificó *después*, leyendo los logs del deploy. Saber el resultado no es un
control: `pnpm verify` corre contra el entorno de test, que no es el que declara el Blueprint, y
entre los dos no había nada. La regresión llegaba a producción y recién ahí se veía.

**La forma importa: el test ejecuta la regla, no la copia.** `motivoParaNoAnclar()` se exporta y se
invoca; si mañana aparece otra condición que inhabilite el puerto, el contrato la hereda solo. Una
aserción sobre el string `"real"` habría pasado igual y no habría probado nada.

Verificado en los dos sentidos antes de commitear: con `ANCHOR_MODE: simulated` —la configuración
que estuvo desplegada— el test se pone rojo, y sacando cualquier variable declarada, también.

## D-077 — La reconciliación la dispara la lectura, no un cron

Cuando una pantalla va a mostrar un `OnChainEvent` `Pending` **que tiene TXID**, se consulta la
cadena para ese anclaje **antes** de responder (`reconciliarParaLectura`, acotado por `projectId`,
`stageId`, `evidenceId` o `referenceId`). `POST /evidence/reconcile` queda para barridos a mano.

**Por qué hace falta algo.** Anclar devuelve `Pending` y eso es correcto: la transacción está
enviada, no confirmada, y la regla 17 prohíbe afirmar lo que no se puede sustanciar. Pero nadie
movía `Pending → Confirmed`: con el modo real encendido, la evidencia quedaba anclada de verdad y
la UI decía "Pendiente" para siempre. No se notaba porque el simulador devuelve `Confirmed` directo.

**Por qué la lectura y no un cron.** El free tier no tiene workers y un `setInterval` deja de contar
cuando Render duerme el servicio (D-003 · D-040). Un cron externo es un servicio más que mantener y
un secreto permanente que rotar, para un problema que todavía no duele. La confirmación llega en el
momento en que alguien la mira, que es el único en que importa.

**Antes de la consulta y no después de la respuesta.** Trece sitios leen `OnChainEvent` con formas
distintas —unos `selectAll`, otros proyecciones con alias—, así que reconciliar la respuesta pedía
trece mapeos. Actualizando la base primero, la consulta que ya existía ve el estado nuevo sin
enterarse.

**Lo que no puede hacer: romper la pantalla.** Si la cadena no responde, se loguea y se sigue con lo
que hay en la base — `Pending`, que es la verdad de lo que podemos sustanciar. Es SPEC-013
§Invariante 2 extendido a la lectura. Con el puerto inhabilitado (D-075) ni siquiera consulta la
base: en una instancia sin secretos eso sería todas las lecturas.

**El costo, acotado a propósito:** tope de 5 anclajes por lectura. En la práctica hay cero o uno —un
evento confirma en un bloque y deja de estar `Pending`—; lo que quede lo levanta la lectura
siguiente o el barrido.

## D-078 — Una sola clave, una sola vez: el servicio recibe una clave de pago

`SERVICE_WALLET_PRIVATE_KEY` (bech32) es **el único secreto de wallet** que el servicio conoce.
Reemplaza a `SERVICE_WALLET_SEED`. No hay una segunda variable con la dirección.

**Por qué no una seed.** Una seed BIP-39 deriva el árbol HD entero: todas las cuentas, todas las
direcciones, la clave de staking. El servicio solo necesita firmar con **una** clave de pago. Darle
la seed era más autoridad de la necesaria en una variable de entorno.

**Por qué tampoco una variable con la dirección.** La dirección se **deriva** de la clave, así que
es imposible configurar una que la clave no controle. Dos variables serían dos cosas que pueden
desincronizarse, y el síntoma de esa desincronización es una wallet que parece vacía.

**La dirección es "enterprise", y no es un capricho de la librería.** Una dirección base es *pago +
staking*: dos credenciales, o sea dos claves. Con una sola clave de pago **no existe** la opción de
armar una base. La forma de la dirección es la consecuencia del requisito, no una concesión — y para
un servicio que paga fees y nunca delega, no tener credencial de staking es estrictamente menos
material de clave, el mismo principio que hizo sacar la seed.

**Cómo se descubrió, porque el rodeo enseñó algo.** La wallet original nació de una seed y quedó
fondeada en su dirección **base**. Al pasar a clave de pago, Lucid derivaba la *enterprise* y la
wallet parecía vacía —la clave podía gastar esos UTxOs, el payment credential es el mismo, pero
Lucid miraba otra dirección—. Se llegó a proponer derivar la clave de la seed y mudar los fondos, y
hasta escribir un adaptador de `Wallet` propio para conservar la dirección base. **Las dos cosas
eran arreglos de un problema que no había que tener**: la wallet no debió nacer de una seed. Se
generó una nueva y se fondeó la dirección que el servicio realmente mira. El faucet pide una
dirección, no una clave.

**Lo que queda como regla:** `wallet:new` genera la clave, la escribe con permisos 600, **no la
imprime**, y sí imprime la dirección y el admin. El arranque de la API loguea la dirección de la
wallet (`server.ts`), para que "el anclaje falla" y "la wallet está vacía" dejen de ser el mismo
síntoma.

**Sigue sin poder rotarse.** El admin del validador es el hash de esta clave; reemplazarla deja
inalcanzables los hilos ya anclados, sin ningún error visible.

## D-079 — El simulador solo confirma lo que él mismo ancló

`SimulatedAnchorAdapter.confirmedAt(txid)` responde desde su propio registro de txid emitidos y
devuelve `null` para cualquier otro. Antes devolvía `this.now()` para todo.

**Por qué era una mentira y no una simplificación.** Afirmaba confirmación sobre transacciones que
nunca produjo. Era el único lugar del código que confundía *tengo un hash* con *está confirmada*, y
esas son dos cosas distintas incluso en Cardano de verdad: **el txid es el hash del cuerpo de la
transacción**, se computa antes de firmar y antes de enviar (`cardano-cli transaction txid` es
offline). Un submit exitoso significa "el nodo lo aceptó en su mempool", no "está en un bloque".

**La forma correcta no es un temporizador.** La confirmación no es tiempo transcurrido, es *¿la
cadena conoce esta transacción?*. El simulador **es** su propia cadena, así que contesta desde su
ledger — la misma pregunta que el adaptador real le hace a Blockfrost. Se registran los dos caminos,
incluido el de metadata, que no deja `AnchorProof` y por eso no puede resolverse con `verify()`.

**No cambia el `status` que devuelve al anclar.** Dentro del simulador no hay mempool: el commit
entra a su ledger en el acto, así que `Confirmed` inmediato es cierto en su modelo. La defensa 1
(D-075) es la que impide que ese `Confirmed` llegue a una base remota.

**Lo que destapó:** cuatro tests de `reconcile.test.ts` insertaban txid inventados y pasaban porque
el simulador confirmaba cualquier cosa. Ahora anclan de verdad contra el puerto para obtener su
txid. Un test que pasa contra un puerto que miente no prueba la promoción, prueba la mentira.

## D-008 — Validador state-thread con núcleo puro separado

El validador es cáscara delgada sobre `lib/propnexus/fsm.ak`. **Por qué existe un validador si la
plataforma no controla nada:** no controla el mundo real, **controla al operador**. Con metadata
suelta, quien tenga la wallet puede publicar cualquier secuencia. Con state-thread, cada transición
gasta el UTxO anterior: la secuencia queda encadenada y **ni nosotros podemos falsificarla después**.

## D-058 — Un thread token por stage, `mint` validado, ids opacos, el operador como único firmante

**El firmante es el operador y es definitivo** — el whitepaper §System Overview dice que las
interacciones con la cadena las hace el backend del operador. **Consecuencia que hay que decir en voz
alta:** la cadena prueba **integridad de secuencia y de momento**, no que un profesional atestiguó.
Eso vive off-chain (documento firmado + `AuditLog`).

**Thread token:** policy = el propio script, asset name = `stage_ref`. Sin él, dos UTxOs del mismo
stage con estados contradictorios validan los dos. **Sin burn**: quemar el token sería borrar la
historia de un stage.

**Ids:** los bytes crudos del id off-chain (cuid2 hoy). Tope de 32 bytes porque es el asset name. **No
se puede cambiar de criterio con hilos ya acuñados.**

## D-019 — Plutus V3, no V2

## D-006 — Anclaje por metadata, label 1904, strings ≤64 bytes

## D-015 — Versionado: CalVer para servicios, enteros para contratos

---

# Infraestructura

## D-039 · D-040 — Render, en free tier, como restricción de diseño

Keep-warm prohibido: dos servicios despiertos 24/7 son ~1460 h contra las 750 del plan.

## D-041 — Deploy con runtime nativo de Node y `render.yaml`. Sin Docker

## D-062 — La infraestructura **local** sí corre en Docker

`compose.dev.yml` levanta MinIO y un devnet de Cardano. No se despliega y el CI no lo toca. Probar
contra MinIO y contra un nodo real demuestra que el código es coherente **con lo que va a correr**,
no solo consigo mismo. Dos cosas pineadas por necesidad: **yaci-cli `0.10.6`** (el `latest` reporta
Babbage y **no ejecuta Plutus V3**) y el entrypoint por `bash` (el de la imagen usa `sh` sobre un
script con sintaxis de bash).

**Los tests de integración no corren en CI**: un CI de diez minutos se empieza a saltear.

## D-011 — Storage S3 genérico: MinIO en dev, R2 en prod

Es el **mismo código** contra los dos: cambian variables, no el driver. Con `s3` el hash se calcula
**releyendo el objeto subido**, así que cubre los bytes guardados y no los del temporal.
`storagePath` es opaco y **jamás sale al cliente**.

---

# Método

## D-068 — La memoria se parte: restricciones vigentes acá, argumento en el archivo

Este archivo dice **qué obliga**. `specs/archive/DECISIONS-hasta-2026-08-23.md` dice **por qué**, con
las 63 entradas originales. Una decisión entra acá solo si restringe código que existe o que vamos a
escribir; si describe algo que borramos, es archivo.

## D-030 — Trunk-based: una sola rama `main`, sin PRs

Vuelve a PRs cuando se sume una segunda persona.

## D-053 — No hay harness de agentes

Se borró entero: 1099 líneas que en tres días necesitaron cinco commits de arreglo a sí mismas y no
detectaron ninguno de los bugs reales del período. **Antes de agregar un verificador, preguntá si el
problema no se arregla mejor cambiando la forma de lo verificado.**

## D-055 — `apps/` es lo desplegable, `packages/` es librería

`contracts/` queda fuera del workspace pnpm: otro toolchain, otro lockfile, otra caché.

## D-033 · D-034 — `docs/` contiene solo entregables · el inventario del stack vive en `specs/stack.md`

## D-001 — Monorepo pnpm con `contracts/` adentro
