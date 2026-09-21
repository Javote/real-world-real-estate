# DECISIONS.md

**Las restricciones vigentes. Nada más.**

Cada entrada dice **qué obliga hoy**, en una o dos líneas. El argumento completo —el contexto, lo
que se descartó, lo que se midió— vive en
[`specs/archive/DECISIONS-hasta-2026-08-23.md`](specs/archive/DECISIONS-hasta-2026-08-23.md), que
conserva las 63 entradas originales enteras.

**Por qué se partió** (D-068): el archivo había llegado a 2400 líneas para una app con 2% de
conformidad. La documentación creció más rápido que el producto, y buena parte describía cosas que
ya no existen. Partirlo no pierde nada: el porqué sigue estando, deja de pesar.

> **Jerarquía de precedencia — dos capas, y un techo adentro de la primera (D-090):**
>
> - **Obligaciones (el *qué*): `docs/` es ley.** Entregables aprobados por reviewers de Catalyst
>   1400106. Nada de este archivo puede reducir lo que debemos. **Y adentro de `docs/`: los
>   entregables de M2/M3 (`M2-D1`…`M2-D6`, las capturas) priman sobre el texto del SOM** — el SOM es
>   la intención de alto nivel: los entregables son su elaboración ya aprobada, y son lo que el
>   equipo construye contra. Ver D-090.
> - **Implementación (el *cómo*): `DECISIONS.md` > `CLAUDE.md` > `specs/`.**
>
> **`docs/` no se edita nunca.** Un error o una ambigüedad en un entregable se resuelve con una
> decisión acá que cite el documento y el párrafo. Un desvío solo es legítimo si (a) el entregable
> se contradice internamente, (b) es un error de redacción, o (c) seguirlo al pie contradiría una
> verdad del producto declarada por el dueño — **nunca por conveniencia**.
>
> **La numeración no se recicla.** Las decisiones nuevas siguen desde D-093.

## Desvíos vigentes

Los lugares donde **no seguimos la letra** de un entregable, cada uno con el caso que lo legitima.
Todos se comunican en la entrega.

| Qué dice el entregable | Resolución | Caso | Decisión |
|---|---|---|---|
| M3 SOM: "Plutus **V2** state machine" | El proyecto Aiken compila **Plutus V3**, que es lo que Aiken 1.1.x emite. Ningún entregable fija versión de Aiken | (b) redacción | D-019 |
| M3 SOM: "reserva → **escrow**" | La plataforma nunca custodia ni transfiere valor. El "escrow" es el contrato anclado, nunca fondos retenidos | (c) verdad del producto | D-021 |
| M3 SOM: "**percentages** configurables" (un `%` de avance por stage) | Ningún entregable de M2/M3 lo define (ni M2-D1, ni M2-D3, ni la captura 34C) — nació de leer el SOM en vez de los entregables. El avance es **derivado**, `completadas/total` por proyecto, sin peso por etapa | (c) verdad del producto + techo de precedencia | D-090, D-091 |
| M3 SOM: "**signers** configurables" (rol configurable por stage) | Lo que el SOM pide ya existe, con otra forma: D-020 fija **qué rol autoriza cada transición**, construido y testeado — "configurable por proyecto" no aparece en ningún entregable. No se agrega una UI para reasignarlo | (c) verdad del producto + techo de precedencia | D-090, D-092 |
| M1 §README lista los estados como "…**Certified**…"; el `.puml` dice `Completed` | Gana `Completed`: precedencia interna de M1, y `Certified` implicaría que la plataforma certifica | (a) contradicción interna | D-020, D-026 |
| M1 §README promete que la taxonomía indica "authoritative" y "anchored on-chain" | El CSV entregado no tiene esas columnas. El hueco lo llenan D-027 y D-028 | (a) contradicción interna | D-027, D-028 |
| M2-D5 §2.1 usa notación de rutas Wouter | Las rutas se leen como **paths**, no como elección de router | (b) redacción | D-022 |
| M2-D4 §Pattern 2 dice "First 6 characters **after** the `0x` prefix" y su ejemplo es `0xdcd5...7994`, que son 6 **contando** el prefijo | Gana el ejemplo: es la única de las cuatro menciones de la regla que muestra el resultado, y las otras tres dicen solo "6+4 characters" | (a) contradicción interna | D-069 |
| M2-D1 §6 "Evidence flow" pasos 5-6: DEV *"Release stage N payment is enabled"*, INV *"Contract and **payments**… Releases by Stage"* | La plataforma **no administra fondos**: refleja y respalda la vida real, no la ejecuta. Sí puede mostrar el estado comercial de la unidad (vendida / disponible) | (c) verdad del producto | D-070 |
| M2-D5 fila 42-43 lista un componente `Chart` que M2-D3 no define entre sus 36 | Las barras de la captura 42 son **composición de esa pantalla**, no una entrada nueva de la biblioteca | (a) contradicción interna | D-073 |
| M2-D2 dibuja headers distintos en secciones hermanas del developer (46 sin logo, 49 con logo) y omite campana / perfil / idioma; M2-D3 dice *never omit the logo* y reserva el slot derecho a esas utilidades | Header autenticado unificado: logo + campana + perfil + idioma; `back` no reemplaza al logo | (a) contradicción interna + (c) verdad del producto | D-074 |
| M2-D5 §3 asume tRPC-libre "REST over HTTPS"… y lo marca `[ASSUMPTION]` anulable | **Se confirma, no se anula**: la columna de endpoints de las 53 filas y la verificación externa por `curl` dependen de REST | — | D-066 |
| M3 SOM: state machine "with parameterized roles and ≥8 construction stages, **timeouts, and fallback branches**" | Nada en `docs/` (el `.puml` canónico de M1-D2, el resumen del whitepaper) define timeouts ni una rama de fallback en la FSM on-chain. Se releen como robustez del **pipeline de anclaje**, no como una feature nueva del validador: ver D-089 | (c) verdad del producto | D-089 |

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

## D-090 — El techo de precedencia: los entregables M2/M3 priman sobre el SOM

**El caso que lo estableció, `progressPercentage`:** el SOM pide "signers/percentages
configurables"; se construyó una columna `progressPercentage` en `Stage` leyendo esa frase. Ningún
entregable de M2/M3 la pedía — ni `M2-D1` (mapa de arquitectura de información), ni `M2-D3`
(component library), ni `M2-D5` (el backlog de superficies), ni la captura `34C` (la única fuente
real del catálogo de 10 etapas). Se leyó el SOM en vez de leer lo que el equipo ya había construido
y Catalyst ya había aprobado.

**La regla, para que no se repita:** cuando el texto del SOM y un entregable de M2/M3 dicen cosas
distintas sobre el mismo campo, pantalla o comportamiento, **gana el entregable**. El SOM es la
intención de alto nivel del milestone; los entregables de M2/M3 son esa intención ya elaborada,
revisada y aprobada — son lo que el equipo efectivamente construye contra, fila por fila, captura
por captura. El SOM no se ignora: sigue fijando el *qué* general del milestone, pero no agrega
campos, pantallas ni comportamiento que su propia elaboración aprobada no pidió.

**Consecuencia práctica:** ante una frase del SOM que no aparece en ningún entregable de M2/M3, la
respuesta no es "construirla para cubrir la frase" — es volver a los entregables, confirmar que
genuinamente no está, y si no está, **documentar por qué no se construye**, no inventarla. `D-091` y
`D-092` son las dos mitades de ese "no se construye" para `progressPercentage`/signers, la migración
que lo revirtió está en `M3-1.1`.

---

# Dominio y modelo

## D-018 — El producto se llama PropNexus

En toda superficie visible. La clave de `localStorage` del idioma es `propnexus.lang`, literal.

## D-020 — La FSM canónica del stage

`Pending → InProgress → {Observed ⇄ InProgress, Completed}`, con `Completed` **terminal**.
`Observed` es remediación, no estado final. Se llama `Completed` y no `Certified` (D-026). **Una
sola tabla de transiciones**, hoy en `packages/shared` y espejada en `contracts/lib/propnexus/fsm.ak`
— si cambia una, cambian las dos en el mismo commit.

### Qué afirma cada estado: **a quién le toca**

Los cuatro estados no son cuatro momentos de la obra — son **de quién es el turno**. Queda escrito
acá porque no estaba escrito en ningún lado, y es el malentendido más caro que tiene la FSM:
`Pending` e `InProgress` se leen como redundantes hasta que se ve que **esperan a actores
distintos**.

| Estado | A quién espera | Qué afirma |
|---|---|---|
| `Pending` | al **developer** | la etapa está declarada y su hilo anclado; nadie puso nada en el registro todavía |
| `InProgress` | al **certifier** | hay evidencia en el registro; nadie la juzgó |
| `Observed` | al **developer** | el certifier la revisó y encontró un problema (la nota va al `AuditLog`, nunca al datum) |
| `Completed` | a nadie — terminal | el certifier la revisó y la cerró, con el Merkle root del bundle en el datum |

**No es una interpretación nuestra: está en el código.** `GET /certifier/assignments` filtra
`Stage.state in ("InProgress", "Observed")` — un stage `Pending` es literalmente **invisible** para
el certifier. Su cola de trabajo arranca en `InProgress`, que es exactamente lo que dice la
columna "a quién espera".

Corolario que conviene tener a mano: hoy `Pending` es un **hecho derivado**. La única salida
automática es "se subió la primera evidencia", así que `state = Pending` ⟺ el stage no tiene
ninguna fila en `Evidence`. Eso no lo vuelve redundante —`InProgress` significa otra cosa, en otro
eje— pero sí explica por qué lo parece.

### Quién puede pedir cada transición

La misma información vista desde el otro extremo: si `InProgress` espera al certifier, las dos
aristas que salen de ahí son suyas. Confirmada por el dueño el 2026-09-08.

| Transición | Quién | Mecanismo | Dónde vive |
|---|---|---|---|
| `Pending → InProgress` | developer, **automático** | la primera evidencia subida | `developer-evidencia.routes.ts` |
| `Observed → InProgress` | developer, **manual** | "Reanudar etapa" (`/developer/progress`) | `stages.routes.ts` · `PATCH /:id/state` |
| `InProgress → Completed` | certifier, **exclusivo** | "Certificar" | `certifier.routes.ts` |
| `InProgress → Observed` | certifier, **exclusivo** | "Observar" | `certifier.routes.ts` |
| cualquiera | admin | sin restricción | — |

Por qué las dos entradas a `InProgress` tienen mecanismos distintos: el diagrama canónico
(`M1-D2/3-milestone-lifecycle.puml`) las etiqueta distinto. *"work initiated"* ya lo dice la acción
de subir el archivo; *"remediation completed"* no —que aparezca un archivo nuevo no significa que
el developer dé la corrección por terminada—, así que esa sí es un botón.

`PATCH /stages/:id/state` responde 403 `STAGE_TRANSITION_FORBIDDEN` cuando quien pide no es `admin`
y el destino no es `InProgress`: **la FSM dice si la transición es posible, no de quién es.** Sin
ese chequeo un developer se auto-certificaba su propio stage.

### Una tensión con M2-D3, declarada a propósito

M2-D3 §Status pill colour matrix agrupa `Pending` y `Observed` en la **misma píldora naranja**
(*"Awaiting verification or with observations"*), y esta tabla los separa al máximo. Las dos cosas
conviven sin contradecirse: el color es presentación —los dos son "todavía no está bien"— y el
turno es semántica.

**Las etiquetas no se tocan.** El vocabulario del front sigue al del backend y al del validador,
que son el mismo `StageState`; la maqueta de M2 podía permitirse sinónimos porque no tenía lógica
detrás, y ahora que la tiene, la consistencia de terminología pesa más que la precisión de una
etiqueta suelta. Si alguna vez se toca una, es para **acercarla** al resto del proyecto, nunca para
alejarla.

## D-091 — El avance de un proyecto es derivado: `completadas/total`, sin peso por etapa

La captura 45 (`45-DEVELOPER-PROGRESS.png`, la única referencia real de "Overall Progress") muestra
un número y una barra por proyecto — no un desglose ponderado por stage. El avance **se deriva**
contando `Stage.state = 'Completed'` sobre el total de etapas del proyecto (`avanceDeStages()`,
`apps/web/src/lib/stageProgress.ts`); no se declara, no se guarda, y ninguna etapa pesa más que
otra. Es la mitad "percentages" del criterio 3 del SOM, resuelta por D-090: no hace falta un campo
de peso por stage porque ningún entregable pide uno — la fuente de la verdad es la captura, y la
captura muestra un cociente simple.

**Consecuencia para cualquier pantalla que muestre "N% de avance":** el numerador y el denominador
tienen que salir de la **misma lista** de etapas del proyecto — nunca de una columna cruda como
`sequenceOrder`, que puede tener huecos en un proyecto viejo (`torre-a`, `M3-2.5`). El % es sobre
posiciones, no sobre valores de una columna.

## D-092 — "Signers configurables" no existe como diseño — cierra el criterio 3 del SOM

La mitad "signers" del criterio 3 pide, leído literal, que un admin pueda **reasignar** qué rol
autoriza cada transición de cada stage, por proyecto. Ningún entregable de M2/M3 lo muestra: ni una
pantalla de configuración, ni un campo en la captura 34C, ni una mención en `M2-D1`/`M2-D3`/`M2-D5`.
Por D-090, no se construye.

**Lo que sí existe, y responde la pregunta de fondo que el criterio persigue** ("¿quién puede
avanzar cada stage?"): la tabla de D-020 §Quién puede pedir cada transición — fija, la misma para
todo proyecto, construida y testeada (`STAGE_TRANSITION_FORBIDDEN`, D-088). No es *configurable*
porque nada en `docs/` pide que lo sea; es **determinística y completa**, que es lo que un signer
schema hace de verdad cuando no hay dos roles compitiendo por la misma transición.

**El criterio 3 del SOM queda sin código pendiente.** Documentación de cierre en `specs/README.md`
y `M3-3.4`.

## D-029 — Los stages son del proyecto; la unidad es lo comercial

Un desarrollo tiene **un solo trámite**: no se hace movimiento de suelos por departamento. `Unit`
nace en la subdivisión y puede no existir al principio. El dossier es por unidad, pero compone
pruebas del proyecto.

## D-028 — Qué es "evidencia sin firmar"

La plataforma no valida la firma: **registra la declaración de origen y la atestación de revisión**.
Evidencia sin firmar es (a) la declarada `authoritative` sin atribución de autoridad
(`issuingAuthority`), o (b) un bundle que ningún revisor atestiguó. **El rechazo ocurre en la
transición, no en el upload**: subir siempre se puede; avanzar no.
*Estado: implementado el piso (exige que haya evidencia). Faltan las columnas de (a) y (b).*
**Acotada por D-084**, que sacó `authorityReference` de (a), y por **D-086**, que eliminó (b):
la atestación se registra, pero ya no condiciona el avance.

## D-084 — La atribución de autoridad es **quién**, no **quién más su número de expediente**

La mitad (a) de D-028 pedía dos columnas cuando `authoritative = true`: `issuingAuthority` y
`authorityReference` (expediente, matrícula). **Queda solo `issuingAuthority`.**

**Por qué se saca.** Ninguno de los dos nombres aparece en `docs/` — los dos los inventamos
nosotros. La diferencia es que uno tiene contraparte y el otro no: `5-evidence-taxonomy.csv` tiene
exactamente cuatro columnas —`evidence_category`, `examples`, `typical_source`, `purpose`— y
`typical_source` **es** la atribución de origen. No hay ninguna columna que corresponda a una
referencia, y nada en `docs/` menciona expediente, matrícula ni *file/reference/registration
number*. El resumen del whitepaper describe la taxonomía como *"categoriza la evidencia, sus fuentes
típicas, qué respaldan y sus métodos de prueba de integridad"*: las cuatro columnas, sin referencia.
Se cumple estrictamente lo que el entregable pide, sin agregarle.

**No reduce lo que debemos.** El criterio 7 del SOM —*"rejects unsigned evidence"*— sigue satisfecho:
(a) exige atribución y (b) exige atestación. Lo que se achica es nuestra elaboración, que vive en la
capa de implementación donde manda este archivo. `docs/` no pierde nada.

**Y es más honesto.** Un número de expediente que la plataforma no verifica da **apariencia** de
verificabilidad. D-026 dice que no validamos nada; guardar la referencia invita a leerla como si
alguien la hubiera chequeado. Las cuatro afirmaciones del producto dicen *"declara provenir de esta
autoridad externa"* — la autoridad, no la autoridad más su trámite.

**Por qué `issuingAuthority` sí se queda, en vez de borrar las dos.** Tres razones, y la primera
sola alcanzaría: es lo que mapea a `typical_source`, que está en el entregable. Es el dato debajo de
una de las cuatro afirmaciones, y sin él esa frase es copy sin nada que la sustancie (regla 17). Y
D-028 separó (a) de (b) **como cobertura**: si el spike de CIP-30 (D-009) sale mal, (b) degrada a
atestación custodial sin rehacer el modelo. (a) es la mitad sin riesgo técnico; borrarla dejaría
todo el peso sobre la que puede fallar.

**Lo que se pierde, dicho.** Sin referencia, "lo emitió la Municipalidad de X" no se puede ir a
chequear al organismo. Es correcto: la plataforma nunca prometió que el permiso fuera válido, solo
que ese archivo, con esa declaración de origen, existía en ese momento y no cambió.

**Alcance.** No toca la mitad (b). `authoritative` ya existe como columna desde `0000_init.sql`;
lo que falta es `issuingAuthority`, obligatorio en la transición cuando `authoritative = true`.

## D-085 — La migración se corrige editando `0000_init.sql`, y producción se re-siembra

**Sigue habiendo un solo archivo de migración.** `network` en `OnChainEvent` (D-080) e
`issuingAuthority` en `Evidence` (D-028/D-084) entran editando `0000_init.sql`, no en un `0001_`.

**Contra D-063, y a sabiendas.** D-063 permitía editar el archivo *"mientras la única base sea
local"* y daba eso por terminado con Turso vivo. El dueño decide sostener la regla en vez de la
excepción: el costo de una cadena de migraciones es para siempre, y el de re-sembrar una instancia
demo es de una vez.

**Lo que cuesta, medido antes de decidir.** Producción tenía 5 usuarios, 1 proyecto, 2 stages, 1
evidencia, 1 bundle y 4 filas de `AuditLog`. `OnChainEvent` ya estaba en 0, así que **no se pierde
ningún anclaje**. Las cuentas demo **no cambian de password** si se re-siembra con las mismas
`SEED_ADMIN_PASSWORD` y `SEED_DEMO_PASSWORD`: el seed las lee de ahí (`db/credentials.ts`). Lo único
irrecuperable son las 4 filas de auditoría, que son de datos sembrados.

**El borrado tiene que incluir `_migrations`, y esto es lo que puede salir mal en silencio.**
`migrate.ts` corre en el `startCommand` de Render y **saltea todo archivo cuyo nombre ya esté en
`_migrations`**. Editar `0000_init.sql` no lo vuelve a aplicar: si se deploya sin borrar esa tabla,
el deploy sale **verde**, la API arranca, y recién falla al consultar una columna que no existe.
Es el mismo modo de falla de siempre — no rompe, miente.

**El orden es parte de la decisión:** se pushea, se borran **todas** las tablas incluida
`_migrations`, se reinicia para que `migrate` reconstruya el esquema nuevo, y recién ahí se
re-siembra. Entre el deploy y el borrado hay una ventana en la que la API está rota; es una
instancia demo con 0 anclajes y se asume.

**Cuándo deja de valer.** Con datos reales de un tercero —una obra de verdad, un comprador de
verdad— esto no se puede volver a hacer. La próxima vez que el esquema cambie después de eso, hay
migración nueva y la cadena empieza ahí.

## D-086 — La atestación del revisor deja de ser condición para avanzar

**Se cae la mitad (b) de D-028.** Ya no se exige que un revisor haya atestiguado un bundle para que
el stage pueda avanzar. El criterio 7 del SOM —*"rejects unsigned evidence"*— queda sostenido solo
por (a): `authoritative = true` exige `issuingAuthority`.

**Verdad de producto declarada por el dueño**, que es la cláusula (c) de la jerarquía: *la app no
revisa ni certifica nada; respalda evidencia que ya fue verificada off-chain*. Es la misma línea que
D-026, llevada a su consecuencia sobre el modelo: si la verificación ocurrió afuera, exigir una
atestación adentro como condición de avance convierte a la plataforma en árbitro de un proceso que
declara no arbitrar.

**Lo que NO cambia.** Los roles `verifier` y `notary` siguen existiendo —están en `docs/`, son dos
de los cuatro— y sus acciones siguen anclando: `POST /certifier/stages/:id/certify` produce
`CERTIFY_STAGE` y `POST /notary/dossiers/:id/sign` produce `DOSSIER_SIGNATURE`. La cuarta afirmación
del producto sigue en pie: *esta persona atestiguó haberlo revisado*. Lo que se cae es que esa
atestación **bloquee** una transición, no que se registre.

**Lo que se acepta.** Hoy `crearBundle` se llama también desde la subida de evidencia del developer
(`developer-evidencia.routes.ts`), así que existe un bundle que nace sin que ningún certificador
toque nada. Con (b) en pie eso era un hueco a cerrar; sin (b) es el comportamiento correcto, porque
el bundle es un **acta de lo que hay**, no un certificado de que alguien lo miró.

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

### El test ID que nunca se cubre

`DEV-RELEASE-EXECUTE-002` —el segundo test ID de las filas 40-41, el botón *"Release stage N
payment"*— **no se implementa nunca**. Es la decisión permanente, no backlog que algún día cierre.

**Actualizado 2026-09-03: se excluye del denominador, no se deja pendiente para siempre.** La
primera versión de esta decisión medía 74/75 a propósito, para que el hueco quedara visible y nadie
lo completara sin leer esto. En la práctica un medidor pegado en 74/75 para siempre no se lee como
"decisión permanente": se lee como "falta uno", e invita exactamente a lo que se quería evitar.
`scripts/check-testids.mjs` ahora excluye `DEV-RELEASE-EXECUTE-002` de `declarados` vía
`NO_SE_CONSTRUYE` —un set nombrado y comentado, no un ajuste silencioso del piso— y `pnpm testids`
mide **74/74 (100%)**. El entregable (`docs/`) no se toca: sigue listando el ID en la fila 40-41, tal
como D-022 exige; lo que cambia es qué cuenta como backlog. El razonamiento de por qué la pantalla no
lo implementa, con qué se muestra en su lugar, vive en el encabezado de
`apps/web/src/routes/developer.project.$projectId.contracts.tsx`.

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

## D-089 — "Timeouts" y "fallback branches" son del pipeline de anclaje, no del validador

**Contexto.** El SOM de M3 pide una state machine "with parameterized roles and ≥8 construction
stages, timeouts, and fallback branches". Nada en `docs/` lo define: el `.puml` canónico de M1-D2
(`3-milestone-lifecycle.puml`) tiene 4 estados y transiciones puramente por evento, sin deadline ni
rama de cancelación; el resumen del whitepaper tampoco lo menciona. Es la misma familia que D-021 —
vocabulario del SOM sin correlato en el entregable.

**Decisión.** No se agrega un estado de cancelación ni un deadline al validador. La FSM que D-020
ratifica queda como está — Aiken es zona 🟡 y el objetivo es cerrar M3, no reabrir un contrato que
ya está hasheado en la Proof of Achievement por un requisito que ningún entregable pidió con esa
forma. Cardano tampoco ejecuta nada "solo": todo lo que pasa on-chain es una transacción que alguien
firma, así que un "timeout" que dispara sin intervención no existe en este modelo sin agregar una
transacción externa que lo dispare — y eso es exactamente lo que ya hace el pipeline de anclaje.

**Cómo se releen los dos términos, contra código ya construido:**

| Término del SOM | Qué es en realidad | Dónde ya está |
|---|---|---|
| "timeouts" | Una transacción de anclaje que no confirma en el momento en que se declara no bloquea nada: el evento queda `Pending` y se reconcilia solo cuando alguien vuelve a leer ese proyecto/stage/evidencia — no hay una espera fija, pero tampoco un límite que rompa algo | D-077 (`reconciliarParaLectura`), `POST /evidence/reconcile` para barridos a mano |
| "fallback branches" | Si el `AnchorPort` tira una excepción o la configuración de anclaje está rota, la declaración off-chain se escribe **igual** y el evento queda `Failed` — el camino que toma el sistema cuando el camino feliz (anclar) no sale | D-075, D-059; `POST /projects/:id/stages/:stageId/retry-anchor` para el caso de un mint que falló de verdad sobre un stage que sigue en `Pending` (`STAGE_ALREADY_ADVANCED` si ya avanzó sin hilo — no hay retroactivo honesto) |

**Por qué es la lectura correcta y no una excusa.** Las dos mitades —qué pasa si una tx tarda, qué
pasa si una tx falla— ya estaban resueltas antes de que este SOM se escribiera, con sus tests y su
verificación. Llamarlas "timeout" y "fallback branch" no es forzar el vocabulario: es la traducción
literal de lo que esas palabras significan para un pipeline que depende de una cadena externa, y es
exactamente el mismo movimiento que D-028 hizo con "unsigned evidence".

## D-093 — La clave del `admin` no es rotable

**El hecho.** `validator stage(admin: VerificationKeyHash)` — el firmante es un **parámetro del
script**, aplicado al compilar. La dirección del script y el policy id del thread token son función
de esa clave (`packages/cardano/src/blueprint.ts`: `applyParamsToScript` + `mintingPolicyToId`).

**La consecuencia, que es la parte que hay que decidir con los ojos abiertos.** Si
`SERVICE_WALLET_PRIVATE_KEY` se pierde o se compromete, **todos los hilos vivos quedan congelados
para siempre**: `spend` exige la firma de ese único `admin` sin alternativa, no hay burn, y el hilo
no tiene otra salida. Los hilos nuevos nacerían bajo otro policy id, así que un stage a medio camino
bajo la clave vieja no se puede terminar nunca — se corta la continuidad de su cadena de prueba. Es
más grave que las 2 ADA bloqueadas por etapa (D-057): eso es costo, esto es pérdida de la función del
producto para las obras en vuelo.

**La decisión: se acepta el riesgo, y la custodia de la clave es el control — no una tarea de
operaciones, un requisito de diseño.** No se implementa multisig ni una clave de recuperación en
este milestone: D-058 (un solo firmante, ratificado por el dueño) ya establece que no hace falta
co-firma, y hoy no hay valor en riesgo (D-021) que justifique el cambio más grande que existe en
`contracts/` — un multisig o un segundo `recovery` tocan `spend`, `mint` y el armado de la tx en
`packages/cardano`, y cualquiera de los dos cambia el script hash. Quedan registradas para cuando
mainnet las vuelva a poner sobre la mesa, en `SPEC-304`.

**Por qué no contradice D-058.** D-058 fija que hay un solo firmante. Esta decisión no cambia eso:
nombra la consecuencia que D-058 no nombraba — que ese firmante único, al ser parámetro del script,
es además irremplazable sin abandonar los hilos vivos.

**Antes del primer mint en mainnet, elegir entre las tres opciones que `SPEC-304` deja registradas**
(dejarlo así, multisig M-de-N, o un segundo VKH de recuperación) — no después.

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

## D-080 — `OnChainEvent` registra la **red**, no el adaptador que lo ancló

Rechazada una columna `anchorMode` (`simulated` | `real`). Lo que va a llevar la tabla es
**`network`** (`Preprod` | `Mainnet`).

**Por qué se propuso `anchorMode`.** Como tercera defensa contra el TXID inventado del 2026-08-27:
si cada fila dijera de qué adaptador vino, un anclaje simulado sería distinguible de uno real para
siempre.

**Por qué se rechaza.** Mete **nuestra configuración** en el modelo de dominio. A la tabla no le
importa qué adaptador corrió: es una abstracción que se filtra. Y la premisa correcta es la
contraria — **si está en la base, es un anclaje real**, porque D-075 impide que el simulador escriba
contra una base remota. La defensa buena es esa, no una columna que documente la posibilidad de
haber mentido.

**Por qué `network` sí.** Es información de dominio que **hoy falta**: la red es solo una variable
de proceso (`CARDANO_NETWORK`), no se guarda por evento. Un TXID **sin red es inverificable** en
cuanto existan dos, y mainnet es inminente. No es una defensa contra nosotros mismos, es el dato que
falta para poder verificar.

**Cuándo.** Antes del primer anclaje en mainnet. Producción tiene 0 filas, así que hacerlo temprano
es el único momento en que toda fila nace atribuida; después queda una era de `NULL` que solo se
reconstruye adivinando. Implica una migración nueva y por lo tanto rompe el "una sola migración" del
stack (D-063): esa parte la decide el dueño.

## D-082 — Un anclaje por vez, y el adaptador se acuerda de lo que envió

`LucidAnchorAdapter` serializa **todas** sus transacciones en una cola en memoria, y después de cada
envío se queda con la vista de lo que acaba de crear: el vuelto de la wallet, vía
`overrideUTxOs()`, y las salidas al script, en un mapa que `advanceThread` consulta antes que al
proveedor. Esa vista **vence a los 3 minutos** (`PENDING_UTXO_TTL_MS`).

**El problema.** La wallet de servicio tiene un solo UTxO grande, y `getUtxos()` se lo pregunta al
proveedor, que solo conoce lo que entró en un bloque —~20 s en Preprod—. Dos anclajes dentro de esa
ventana eligen la misma entrada: el segundo se arma contra un UTxO ya gastado y muere en `Your
wallet does not have enough funds`. Del otro lado pasa lo mismo con el hilo: `advanceThread` no
encuentra el UTxO que `openThread` acaba de crear y devuelve `UNKNOWN_THREAD`. Es la razón por la
que `PLAN-2026-08-31` §2 tenía que esperar el bloque entre crear un stage y moverlo.

**Las dos mitades, y por qué ninguna sirve sola.** Serializar no arregla nada por sí mismo: dos
anclajes en serie contra el proveedor eligen igual la misma entrada, porque el proveedor no cambió
de opinión en el medio. Y encadenar no sirve sin serializar: armar la transacción **lee** el
conjunto de UTxOs y enviarla lo **invalida**, así que con dos pedidos concurrentes los dos leen
antes de que ninguno escriba y no hay orden de `overrideUTxOs()` que llegue a tiempo.

**Se construye con `chain()` en vez de `complete()`.** Es la misma transacción —`complete()` es
`chain()` tirando dos de los tres valores— pero además entrega el conjunto con el que hay que
quedarse: los UTxOs de la wallet menos los que esta transacción gasta, más el vuelto que crea. O
sea, exactamente lo que el proveedor va a contestar dentro de veinte segundos.

**El costo, que es real: la vista local puede mentir.** Si el nodo termina descartando una
transacción, el adaptador queda encadenando sobre un vuelto que no va a existir nunca. Por eso la
vista vence, por eso el TTL es corto, y por eso **no** se limpia cuando un envío falla: si la
transacción anterior sí entró al mempool, volver a preguntarle al proveedor devuelve la entrada que
esa transacción ya gastó y el siguiente anclaje falla igual. Vencer es la única salida del estado
malo — y es también lo que hace que fondear la wallet se vea.

**Vale para un proceso, y hoy hay uno** (Render, plan free — D-039). Con dos instancias esto no
alcanza y el arreglo es de otra clase: el estado compartido tendría que salir de la memoria. Se dice
acá para que se sepa antes de escalar, no después.

**El `Emulator` reproduce el bug exacto**, y por eso los tests prueban algo: su `getUtxos()` lee
solo el ledger y deja el mempool afuera, igual que Blockfrost. Un anclaje sin `awaitBlock()` detrás
es un anclaje contra un proveedor que todavía no vio el anterior.

## D-083 — El validador se publica una vez como reference script, y vive en la wallet

`LucidAnchorAdapter` **referencia** el validador (`readFrom`) en vez de adjuntarlo cuando encuentra
un UTxO que lo lleva adentro. Lo publica `pnpm --filter @plataforma/cardano ref:publish`, una vez
por red; el adaptador lo **descubre solo** al arrancar, comparando el hash del script.

**Qué ahorra, medido.** Un `openThread` pasa de 2890 a 599 bytes y de 0,2976 a 0,2317 tADA de fee
(Emulator, mismos parámetros). El validador son 2289 bytes que hasta ahora viajaban en **cada**
transacción de hilo.

**Vive en la dirección de la wallet, no en la del script.** En la del script sería inmune a la
selección de monedas, pero también **irrecuperable**: gastarlo pediría la aprobación de un validador
que no sabe nada de él, así que los ~11 ADA del mínimo quedarían muertos para siempre. En la wallet
son recuperables con una transacción deliberada.

**El precio de esa elección, y cómo se paga.** En la wallet, el UTxO del reference script *es plata*
para la selección de monedas. Lucid dice en sus mensajes de error que excluye los UTxOs con script
—`Or it contains UTxOs with reference scripts; which are excluded from coin selection`— y en 0.6.2
**eso no es cierto**: solo excluye los que la propia transacción declaró con `readFrom`, y un
anclaje por metadata no declara ninguno. Con la wallet corta, ese anclaje se llevaba puesto el
script. Se filtra en el adaptador, en el único lugar por el que pasan todas las transacciones
(`entradasDeLaWallet`), pasándole a Lucid `presetWalletInputs`.

**No se configura con una variable.** Un `txid#index` en el entorno se puede desincronizar del
blueprint, y el síntoma sería una transacción que referencia un script que no es el nuestro. El
descubrimiento compara el **hash** del script con el que sale del blueprint con el admin aplicado:
un script viejo no matchea y se ignora.

**Se descubre al arrancar, así que publicar exige reiniciar la API.** Una instancia ya levantada
sigue adjuntando el validador hasta el próximo restart. No rompe nada: paga de más.

**Los ~11 ADA que quedan inmovilizados no son valor** (D-021), igual que `THREAD_MIN_LOVELACE`: son
el mínimo que Cardano exige para que un UTxO con un script adentro exista.

**Es una operación de operador y por eso no está en `AnchorPort`**: gasta ADA de la wallet de
servicio, se hace una vez por red y no produce ningún anclaje. Meterla en el puerto obligaría al
simulador a fingir que la tiene. Es idempotente (regla 8): vuelve a mirar la cadena antes de
publicar.

## D-088 — Una sola forma de declarar autorización: `authorize({ roles, acceso })`

Las tres capas de la regla 5 eran tres middlewares encadenados. Pasan a ser **un objeto con dos
campos obligatorios**, y las 87 rutas montadas lo declaran.

**El motivo es uno solo y conviene no inflarlo.** No es que las tres hicieran lo mismo (el rol sale
del token, las otras dos cargan una fila) ni que se lea mejor (la matriz de `route-guards.test.ts`
ya daba la regla completa en una línea). Es que **nada obligaba a declarar la pertenencia**: una
ruta del investor escrita con `requireRole("admin", "buyer")` y nada más compilaba, pasaba el happy
path y servía la unidad de otro. D-042 resolvió eso para las membresías haciendo que omitir el
argumento **no compile**, y esa jugada no se puede repetir con middlewares sueltos porque **la
ausencia de una llamada no es un tipo**.

`acceso` obligatorio lo convierte en una afirmación: `"soloRol"` no fuerza a acertar —alguien
apurado lo escribe sin pensar— pero una ausencia es invisible en un diff y una afirmación es algo
que alguien firmó y que el revisor puede discutir. Hay un test que lo fija: `authorize({ roles })`
sin `acceso` **no compila** (`test/require-project-access.test.ts`).

**Lo que destrabó, y no era el objetivo:** `{ alguna: [...] }` expresa disyunciones, que una cadena
de middlewares no puede porque una cadena es un AND. `GET /contracts/:contractId/releases` —dueño
del contrato **o** miembro del proyecto— dejó de autorizar adentro del handler. Para que eso fuera
posible hubo que separar **evaluar** de **responder**: los evaluadores devuelven un `Veredicto` y
`authorize` decide, porque un middleware que ya contestó 403 no deja probar la segunda rama.

**Qué NO cambió, y es la parte importante de un refactor de autorización.** Ninguna ruta ganó ni
perdió acceso. `projectScope` sigue siendo la única definición de "qué proyectos ve este usuario"
(D-043), con el bypass de `admin` adentro; `ANY_MEMBERSHIP` sigue siendo una lista literal (D-042);
la deuda de distinguir 404 de 403 desde afuera se conserva tal cual (`SPEC-012`). Se probó con los
275 tests en verde y la matriz equivalente ruta por ruta en cada paso.

**Se pudo hacer recién ahora.** `SPEC-012` prohíbe cambiar semántica de seguridad adentro de un
refactor, y hasta que existió la matriz no había forma de *probar* que un refactor no la cambiaba.
Matriz (2026-09-03) → `requireOwnership` (2026-09-04) → unificación: cada paso habilita el
siguiente. La secuencia completa está en `specs/PLAN-2026-09-04-guard-unico.md`.

**La partición, hecha el mismo día.** `"soloRol"` quedaba en 45 de 87 rutas y **26 de ellas sí
tenían regla de fila**, aplicada por el handler en su query. Decir "esta ruta no tiene regla de fila"
cuando la tiene es peor que no decir nada, porque se lee como una revisión hecha. Ahora esas 26
declaran `{ scopeEnQuery: "<el filtro>" }` — `"Unit.investorId = usuario"`,
`"projectScope(developer)"`— y un test exige que el texto **no esté vacío**: sin eso sería
`"soloRol"` con otro nombre. No lo verifica el compilador —el handler podría no aplicarlo— pero la
afirmación pasa a ser concreta y contrastable contra el `where` de al lado. Reparto final:
`"soloRol"` 19 · `{ scopeEnQuery }` 26 · `{ proyecto }` 30 · `{ dueño }` 9 · `{ alguna }` 1 · sin
sesión 2.

**Y encontró lo que tenía que encontrar.** Etiquetar obliga a leer el handler, y al leerlos
aparecieron dos cosas que ninguna herramienta iba a marcar:

- **`GET /developer/audit-log` devolvía el `AuditLog` entero, sin acotar por proyecto** — con
  `actorName` y `actorRole` de cada usuario del sistema. Es la regla 5 sin su segunda capa, de la
  misma familia que el agujero de `GET /evidence/:bundleId/files`. **No era decisión de producto:**
  M2-D1 §4 y M2-D4 §P6 ya decían *project-scoped*, y el código no lo cumplía. Cerrado con
  `auditScope`, hermana de `projectScope`, fail-closed. La forma que corresponde es una columna
  `projectId` en `AuditLog`; no se hizo porque pide la primera migración sobre base desplegada
  (D-063) y un backfill sin respuesta para filas viejas — anotada para el día que se toque ese
  esquema.
- **`POST /developer/documents` hacía la segunda capa a mano** porque el id le llega en el **body** y
  el guard solo miraba el path. Cerrado: `ProjectSource` acepta `en: "body"`, y la distinción no es
  cosmética — un param de path ausente es la ruta mal declarada (500) y un campo de body ausente es
  input del cliente (400). `nombre` conserva el `"Document not found"` que ya devolvía.

**Y `alguna` dejó de anidar.** `ReglaDeAcceso` se partió en `ReglaSimple` + la disyunción, que toma
`[ReglaSimple, ReglaSimple, ...ReglaSimple[]]`: mínimo dos ramas, ninguna anidada. Con el tipo
recursivo, los cuatro consumidores tenían que recursionar para expresar algo que nadie necesita — un
`alguna` adentro de un `alguna` se aplana a uno solo. Que la use **una sola** ruta también es
información y quedó escrito: la disyunción existe porque *dueño de un contrato* y *miembro del
proyecto* eran vínculos **desconectados** en el modelo.

**Y mirar eso destapó un bug de verdad, ya cerrado:** `POST /investor/invitations/:id/accept` **no
creaba `ProjectMember`**, así que un investor real aceptaba y toda ruta con `requireProjectAccess` le
daba 403 — incluidas las del Merkle proof de su propia evidencia. Ningún test lo veía porque el seed
plantaba la membresía a mano. Detalle y la lección en `apps/api/CLAUDE.md` §Trampas verificadas.
**`alguna` se conserva igual**: ahora aceptar crea la membresía, pero los contratos que ya existen
—y los que nazcan por otro camino— pueden no tenerla, así que *dueño* sigue sin implicar *miembro*.

## D-087 — El simulador declara `Pending`, y `Confirmed` sale siempre de un chequeo aparte

**"Defensa 3"**, la que quedaba abierta de las tres que salieron del incidente del 2026-08-31 (una
fila en producción con TXID inventado, marcada `Confirmed` — ver la memoria del hallazgo). Las
otras dos: que la API se niegue a simular contra una base remota (D-075, ✅) y `network` en vez de
una columna `anchorMode` (D-080, ✅). Esta cierra la que quedaba: el simulador devolvía `Confirmed`
directo desde `openThread`/`advanceThread`/`anchorCommitment`, y el adaptador real siempre devolvió
`Pending` — la única diferencia de contrato entre los dos adaptadores, y la que hacía ambiguo qué
significa `Confirmed` en el código que los llama.

**Los dos adaptadores devuelven el mismo recibo ahora: `Pending`, siempre.** `Confirmed` sale
únicamente de un chequeo aparte —`verify()` para hilos, `confirmedAt()` para metadata— nunca del
propio recibo. `anchorEvent` (state-thread) y `anchorCommitmentEvent`/`POST /evidence/:id/anchor`
(metadata) hacen ese chequeo **en el mismo request**, así que en la práctica un anclaje simulado
sigue confirmando al toque —su ledger queda listo desde el `commit`— pero ya no porque el recibo lo
afirme: porque algo lo preguntó. Contra Preprod, el chequeo no encuentra nada todavía y el evento
queda `Pending` hasta que alguien reconcilie — que es exactamente lo que ya pasaba.

**No cambia ningún test.** Los que afirman `Confirmed` contra el simulador lo siguen viendo así,
porque el chequeo inmediato lo sigue encontrando; lo que cambia es que ya no hay ningún código que
confíe en el campo `status` del recibo sin verificar.

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

## D-094 — El perfil del desarrollador se construye sin rating

**El hecho.** Las capturas 59 y 60 de M2-D2 (`DEVELOPER-REPUTATION-A/B`) diseñan el perfil de la
organización desarrolladora, y M2-D1:109 lo enlaza desde el detalle de obra. **No tienen fila en
M2-D5**, así que el backlog de M3 nunca las pidió y nadie las construyó — se encontró el 2026-09-21
cruzando el catálogo de capturas contra las rutas, no el backlog contra las rutas, que es lo que
`pnpm testids` mide y por eso no podía verlo.

**Qué se construye (SPEC-220).** La pantalla, con todo lo que se puede **derivar del registro**:
obras entregadas (`Project.status = 'completed'`), unidades vendidas (`Unit.status = 'sold'`),
compradores distintos, los dos listados de obras partidos por estado, y el "desde" y el rango de
metros de cada card. Se **guarda** solo lo autodeclarado: nombre, bio y año de fundación, en una
tabla `Organization` nueva (migración 0010).

**Qué NO se construye: el rating.** La captura muestra "4.8 / 5.0 · 127 investors" junto al nombre.
Un rating es una **afirmación sobre la calidad de un tercero**, y D-026 fija que la plataforma solo
puede sostener cuatro afirmaciones —*este archivo tiene este hash · se registró en este momento ·
declara provenir de esta autoridad · esta persona atestiguó haberlo revisado*—, todas sobre
documentos y atestaciones. No hay reseñas, no hay quién las firme y no hay de dónde recalcularlo:
una columna `rating` solo podría llenarse a mano, que es exactamente la señal fabricada que la
regla 17 prohíbe.

**Por qué no se construye el mecanismo tampoco.** Un rating real es una rebanada entera —tabla de
reseñas, quién puede dejarlas, si se editan, si se anclan— y ninguna de esas preguntas está
contestada en ningún entregable. Construir el almacenamiento sin el mecanismo sería peor: un campo
listo para que alguien lo llene a dedo.

**Es el mismo caso que D-070**, y se resuelve igual: la captura muestra una capacidad que este
producto no tiene, se construye todo lo demás, y la ausencia queda escrita —acá, en el schema
(`developerProfileSchema` no declara el campo), en la migración, y en un test que la asienta— en
vez de quedar como un hueco que alguien "completa" más adelante sin leer esto.

**Lo que sí se muestra del pill:** el conteo de compradores, como una StatCard junto a las otras
tres métricas derivadas. Es un hecho del registro —cuánta gente compró— y no una nota de calidad.
