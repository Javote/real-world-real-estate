# CLAUDE.md

> **Documento de trabajo activo:** [`specs/ESTADO-2026-09-10-catalyst-milestone-3.md`](specs/ESTADO-2026-09-10-catalyst-milestone-3.md)
> — el cruce contra los 5 Outputs oficiales del Milestone 3 tal como los publica Catalyst, con lo
> que falta consolidado en una tabla. Es el punto de partida de la próxima sesión.
>
> **Auditoría del backend:** [`specs/AUDITORIA-2026-09-11-calidad-del-backend.md`](specs/AUDITORIA-2026-09-11-calidad-del-backend.md)
> — 15 hallazgos sobre `apps/api`, leyendo los 51 archivos de `src` completos. **Va antes que la del
> frente porque dos de ellos no son pulido: son bugs de corrupción de datos, reproducidos
> ejecutándolos** — B-01 (dos invitaciones sobre la misma unidad le sacan la unidad a quien ya la
> compró) y B-02 (una unidad puede terminar con dos dossiers, y la firma del escribano queda en el
> que la pantalla no lee). Los dos salen del mismo lugar: **hay una sola `db.transaction()` en todo
> `src`**. Ninguno toca los 16 criterios del SOM, pero los dos primeros valen antes de mainnet —
> repararlos después es SQL a mano contra producción, como las migraciones 0004 y 0005. El resto sí
> es deuda de pulido, y no propone endpoint, tabla ni superficie nueva.
> **Ya está transcrita a specs implementables: la serie `SPEC-201`…`SPEC-215`**, una por hallazgo
> salvo donde partirlas habría sido artificial, cada una independiente — registro y orden en
> [`specs/README.md` §Las tres series de pulido](specs/README.md).
>
> **Deuda de pulido del frente:** [`specs/AUDITORIA-2026-09-11-calidad-del-frente.md`](specs/AUDITORIA-2026-09-11-calidad-del-frente.md)
> — 18 hallazgos de accesibilidad, responsive y mantenibilidad, medidos en el navegador contra las
> 42 rutas, cada uno con su evidencia y su archivo. **No es un criterio del SOM y no bloquea la
> entrega**; ninguno propone pantalla, ruta ni componente nuevo. Es para cuando el milestone deje
> aire. El primero de la lista (`--size-icon-sm/md/lg` no existen: 52 clases muertas) explica por
> qué la lista existe — la regla estaba escrita y no tenía guardia.
> **Ya está transcrita a specs implementables: la serie `SPEC-101`…`SPEC-110`**, mismo criterio que
> la serie 2xx. Con una corrección sobre la auditoría, en `SPEC-101`: los tres tokens **no se
> agregan** —M2-D3 nombra la escala de íconos por contexto y `sm`/`md`/`lg` no están en el
> entregable—, los 52 usos se mueven a los cinco nombres normativos.
>
> **Calidad de `contracts/`:** [`specs/AUDITORIA-2026-09-11-calidad-de-contracts.md`](specs/AUDITORIA-2026-09-11-calidad-de-contracts.md)
> — 6 hallazgos sobre los dos archivos Aiken, leídos completos y con todo verificado ejecutándolo.
> **El veredicto general es bueno y conviene decirlo: es la parte mejor organizada del repo** — el
> corte de D-008 aplicado de verdad, 82 tests contra cada punto de rechazo, 0 warnings, blueprint
> reproducible byte por byte, y dos órdenes de magnitud de aire en el presupuesto de ejecución.
> **Pero uno no es pulido: `contracts/CLAUDE.md` afirma que `mint` acuña "exactamente uno por
> stage" y el validador solo garantiza uno por transacción** — el handler no mira `tx.inputs`, así
> que el mismo `stage_ref` se re-acuña (reproducido), y `retryStageMint` tiene el camino construido
> porque su guarda es una consulta a la base que nunca toca la cadena. Es el estado que ya dejó la
> prueba de volumen. El segundo que vale antes de mainnet es que **la clave del `admin` es un
> parámetro del script**, así que no se puede rotar: perderla congela los hilos vivos para siempre.
> Ninguno toca los 16 criterios del SOM.
> **Ya está transcrita a specs implementables: la serie `SPEC-301`…`SPEC-306`, y ya está toda
> revisada.** `301`, `302`, `303`, `304` y `306` están **cerradas** (2026-09-18) — incluida la
> afirmación falsa de `contracts/CLAUDE.md`, corregida por `SPEC-301`, y la clave del `admin`,
> registrada como decisión en D-093 por `SPEC-304`. Queda abierta solo `305`, que sí cambia el
> script hash y es decisión de mainnet — ver `CLAUDE.md` raíz §Antes de mainnet, después del
> Milestone 3.
>
> **Calidad de `packages/`:** [`specs/AUDITORIA-2026-09-11-calidad-de-packages.md`](specs/AUDITORIA-2026-09-11-calidad-de-packages.md)
> — 14 hallazgos sobre los dos packages compartidos, leídos completos (28 archivos, ~5.900 líneas) y
> todo reproducido ejecutándolo. **El veredicto general es bueno y conviene decirlo: es el código
> mejor tipado del repo** — cero `any`, cero `@ts-ignore`, `noUncheckedIndexedAccess` y
> `exactOptionalPropertyTypes` en los dos (`apps/api` tiene solo `strict`), y ningún import que cruce
> el límite de D-014. **No es spaghetti y no está cerca de serlo.** Ninguno de los 14 toca los 16
> criterios del SOM. Tres valen antes de mainnet, y los tres son la misma clase de cosa: suposiciones
> no declaradas donde equivocarse no se deshace — los 36 hashes y TXID que viajan como `z.string()`
> pelado (`SPEC-402`), el `outputRef` que supone la salida `#0` teniendo la respuesta buena calculada
> al lado (`SPEC-407`), y el datum que vuelve de la cadena sin validarse (`SPEC-408`). Un cuarto está
> reproducido con un test en verde: **el simulador olvida todo lo que confirmó en cada reinicio**
> aunque el ledger sobreviva en SQLite, así que en dev un evento anclado antes de reiniciar queda
> `Pending` para siempre (`SPEC-406`).
> **Ya está transcrita a specs implementables: la serie `SPEC-401`…`SPEC-412`.** El hallazgo más
> grande de `packages/shared` **no** abrió spec nueva porque ya tenía una: `SPEC-109` — esta
> auditoría lo confirma desde el otro lado del límite con el número que faltaba, **63 de los 107
> tipos inferidos que el package exporta no tienen ningún consumidor**.

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
| 2.4 | ✔ Las 20 claves i18n de `AuditLog` que faltaban — verificado con Claude en Chrome (`CREATE_UNIT` real, vía `pnpm dev`): antes mostraba el literal, ahora "Creó una unidad" | 10 |

**Saneamiento de la demo** (no es un criterio, pero se demuestra sobre esto)

| | Qué |
|---|---|
| 2.5 | ✔ `Cimentación` de `torre-a` ya no está fabricada — `UPDATE Stage SET state='InProgress'` corrido a mano contra Turso producción (autorizado y verificado con `turso db shell`, 0 evidencia/0 eventos confirmados antes de tocarla), y `seed.ts` ya no pre-marca ninguna etapa nueva `Completed`. Destapó un bug real de UI, cerrado en el mismo commit: "Etapa N/total" usaba `sequenceOrder` crudo en vez de la posición en la lista — con huecos (como los de `torre-a`) el numerador podía superar al total. Afectaba `developer.progress.tsx` (2.2) y `project.$projectId.progress.tsx` (investor); las dos verificadas con Claude en Chrome reproduciendo el hueco a propósito en local |

## Tanda 3 — documentación, decisiones y evidencia

**Decisiones nuevas**

| | Qué |
|---|---|
| 3.1 | ✔ `DECISIONS.md`: el techo de precedencia — **entregables M2/M3 sobre el SOM** (D-090), con `progressPercentage` como el caso que lo estableció |
| 3.2 | ✔ `DECISIONS.md`: el avance es **derivado por proyecto** (`completadas/total`, D-091), según captura 45. No hay peso por etapa |
| 3.3 | ✔ `DECISIONS.md`: **"signers configurables" no existe en el diseño** (D-092) — misma resolución que 3.1, y cierra el criterio 3 |

**Saneamiento de `specs/README.md`** — hoy tiene cinco afirmaciones falsas

| | Qué |
|---|---|
| 3.4 | ✔ Criterio 3 reescrito con D-090/D-091/D-092: catálogo real de 10 (no 8), sin ruta que acepte el campo, "signers" resuelto por la tabla fija de D-020 |
| 3.5 | ✔ Números corregidos: **335 tests** de API (eran "235"), **82** de Aiken (eran "73"), superficies **53/53** (eran "46") |
| 3.6 | ✔ `SPEC-013 §C` — gana "hecho" (D-077 lo sostiene); corregido el registro de specs para que diga lo mismo que el orden de trabajo |

**Documentación de frente**

| | Qué |
|---|---|
| 3.7 | ✔ Ficha de `DEFAULT_STAGE_CATALOG`: motivo del "sin `progressPercentage`" ahora cita D-090/D-091 |
| 3.8 | ✔ `apps/web/CLAUDE.md`: deuda declarada de la miniatura de "Stage Detail" en la tabla de "Lo que la captura pide y el contrato no da" |
| 3.9 | ✔ `CLAUDE.md` raíz: tabla de pendientes de §Estado reescrita — solo quedan la prueba de volumen y mainnet (fuera de alcance) |

**Evidencia de entrega** (no es código ni prosa nuestra)

| | Qué | Criterio |
|---|---|---|
| 3.10 | ✔ Publicar la **lista formal de TXIDs** resolubles en explorador — `specs/EVIDENCIA-2026-09-11-lista-formal-de-txids.md` + CSV, las 180 re-verificadas contra Koios el mismo día | 15 ✅ |
| 3.11 | ✔ **Screenshot de monitoring** — `specs/EVIDENCIA-2026-09-11-monitoring-screenshots.md` + capturas de Sentry, Grafana/Tempo y PostHog, tomadas en vivo contra producción | 14 ✅ |
| 3.12 | **Video walkthrough** | 13 ⬜ |
| 3.13 | **3 pilotos** — recontactar; `M1-D3-PilotPlan.pdf` ya trae cartas de M1 y probablemente cubre parte | 4 ⬜ externo |

## La prueba de volumen (ex-pendiente #0) — ✔ cerrada 2026-09-10

Tres criterios dependían de ella, y ya corrió: `specs/REPORTE-2026-09-10-prueba-de-volumen.md`
(30/30 etapas `Completed`, 180/180 eventos on-chain `Confirmed`, en 3 proyectos nuevos).

| Criterio | Qué le dio la prueba |
|---|---|
| **8** ✅ | *"Flujos de UI end-to-end en pre-prod"* — la prueba **es** la evidencia |
| **9** ✅ | Cerrado el 2026-09-11, aparte: es un flujo distinto (compra del investor), la prueba ejercitó la FSM del stage. Mediana real 2.76 min, ver `specs/README.md` |
| **15** ✅ | Cerrado el 2026-09-11: **lista formal** publicada (3.10), las 180 TXIDs re-verificadas contra Koios el mismo día |

Costo real medido: **~99.8 ADA total** (39.83 de fees + 60 bloqueadas, D-057), levemente por debajo
de lo presupuestado (~105 ADA). Con esto cerrado, 3.10 se cerró el 2026-09-11; 3.12/3.13 siguen
abiertos — ver `specs/ESTADO-2026-09-10-catalyst-milestone-3.md` para el detalle.

## Fuera de alcance de este milestone

| Qué | Por qué |
|---|---|
| **Mainnet** | Decisión del dueño, 2026-09-09. D-013 lo hace imposible por configuración y `specs/README.md` ya lo declara fuera |
| **Fusionar anclaje + transición** | Ahorra ~5% del costo on-chain; es 🟡 sobre el core de anclaje. Después de la prueba de volumen, que da la distribución real. Detalle en `specs/PROPUESTA-2026-09-09-fusionar-anclaje-evidencia-transicion.md` |
| **`TOPE_POR_LECTURA`** | Medir una carga real antes de tocar el número. El disparador por lectura ya se arregló (2026-09-09) |
| **"Contenido en `Pending`"** | Mejora de UX, ningún criterio la pide. Necesita que el listado de stages devuelva el anclaje y reconcilie |
| **Columna `AuditLog.projectId`** | Sacaría el mapeo fail-closed de `auditScope`. Pide backfill que para filas viejas no tiene respuesta |
| **`validationCritical` siempre `true`** | Config muerta con rama viva y testeada en el validador. No molesta |
| **Upload directo del navegador a R2 (sin pasar por Render)** | Hoy el archivo hace escala en `UPLOAD_DIR` (Multer disco → `storage.put()` → R2 → se borra, `apps/api/src/lib/storage.ts`) antes de llegar al bucket — es lo que hace que `MAX_FILE_SIZE_MB` (2026-09-10: 10→50) le pese a la RAM del proceso, no solo al límite de R2 (5 GiB por PUT simple). Un presigned URL lo evitaría, pero es un cambio de forma real: CORS nuevo en el bucket, el front pasa de un POST a un flujo de 3 pasos, y el hash sigue teniendo que calcularse releyendo el objeto desde R2 después (D-027) — no se simplifica esa parte. **Después de mainnet**, cuando el volumen de uploads reales lo justifique frente al costo de tocar `storage.ts` (🟡) y el único endpoint que hoy usa `uploadSingleEvidence` |

## Antes de mainnet, después del Milestone 3

**Ninguna de estas bloquea la entrega de M3 — ninguna toca los 16 criterios del SOM, y por eso están
acá y no en la lista de trabajo.** Pero tampoco son "para siempre después": son las decisiones que
hay que tomar (con plata, tiempo o riesgo de por medio) antes de habilitar `CARDANO_NETWORK=Mainnet`,
y hoy vivían dispersas entre `DECISIONS.md`, `specs/README.md` y los `CLAUDE.md` de cada subárbol.
Esta tabla es el punto de partida cuando llegue el momento — no hay que releer las cuatro auditorías
del 2026-09-11 de nuevo.

| # | Qué | Por qué espera | Detalle |
|---|---|---|---|
| 1 | Habilitar la red: runbook + `CARDANO_NETWORK=Mainnet` | D-013 lo hace imposible **por configuración** hoy — no es solo procedimiento, es código | D-013 |
| 2 | Custodia y rotabilidad de la clave del `admin` | Es un parámetro del script Aiken, así que es irreemplazable por construcción: perderla o comprometerla congela todos los hilos vivos para siempre. Elegir entre dejarlo así, un multisig M-de-N o un segundo VKH de recuperación — las dos últimas cambian el script hash | D-093, `specs/SPEC-304-la-clave-del-admin-no-se-puede-rotar.md` |
| 3 | Unicidad del hilo on-chain + tope de `evidence_root` | El validador solo garantiza un token **por transacción**, no por stage (`SPEC-301` ya cerró el camino alcanzable desde el backend; esto es cerrarlo en el validador mismo), y acepta un `evidence_root` de largo arbitrario en stages no críticos. Cambia dirección y policy id de los 180 eventos ya anclados en Preprod — es la única de esta tabla que cambia el script hash | `specs/SPEC-305-el-proximo-cambio-de-script-hash.md` |
| 4 | Los 36 hashes y TXID que `packages/shared` declara como `z.string()` pelado | Sin forma validada, cualquier string pasa el schema y el error solo se descubre en la cadena | `specs/SPEC-402-los-hashes-y-txid-tienen-forma.md` |
| 5 | El `outputRef` del recibo se supone `#0` en vez de buscarse | Tiene la respuesta correcta calculada al lado y no la usa — asume una posición de output que puede no serlo | `specs/SPEC-407-el-outputref-se-busca-no-se-supone.md` |
| 6 | El datum que vuelve de la cadena no se valida, por las dos puertas de lectura | Se confía en la forma sin chequearla — un datum corrupto o de otra versión del contrato se lee como bueno | `specs/SPEC-408-lo-que-vuelve-de-la-cadena-se-valida.md` |
| 7 | Las 2 ADA bloqueadas por etapa (20 por proyecto de 10 etapas) | Sin burn (D-057) son permanentes — no es un bug, es el número real con el que hay que decidir si el costo por proyecto es aceptable en mainnet | D-057, `specs/REPORTE-2026-09-10-prueba-de-volumen.md` |

**Por qué junta specs de auditorías distintas.** Los ítems 2 y 3 salen de
`AUDITORIA-2026-09-11-calidad-de-contracts.md`; los ítems 4, 5 y 6, de
`AUDITORIA-2026-09-11-calidad-de-packages.md`. No comparten numeración porque nacieron de auditorías
separadas, pero comparten la misma restricción: todas piden una decisión del dueño que no tiene
sentido apurar para cerrar M3. El resto de las dos series (`SPEC-301`–`SPEC-303`, `SPEC-306`, y todo
lo que no está en esta tabla de `SPEC-401`…`SPEC-412`) ya está resuelto o es pulido sin fecha —
`specs/README.md` lleva el estado real de cada una.

## Cerrado, pendiente de aceptación por Catalyst

1. **El criterio 3 se cierra por documentación** (3.1–3.4), sin construir signers ni percentages. Es
   la consecuencia directa de la regla de precedencia del dueño (entregables M2/M3 sobre el SOM,
   2026-09-09), aplicada de forma consistente con `progressPercentage`. No hay más trabajo posible
   de este lado — lo único que falta es que Catalyst lo acepte en la entrega, y eso no se sabe hasta
   entregar.

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

> **La lista completa de lo que falta está en §El plan de entrega, arriba, y en
> [`specs/ESTADO-2026-09-10-catalyst-milestone-3.md`](specs/ESTADO-2026-09-10-catalyst-milestone-3.md)**
> (el cruce contra los 5 Outputs oficiales de Catalyst). Esta tabla es solo el resumen de los dos
> ítems que no encajaban en ninguna Tanda. **El historial completo de lo ya cerrado —narración
> día a día hasta el 2026-09-08— se movió a
> [`specs/archive/CLAUDE-historial-hasta-2026-09-10.md`](specs/archive/CLAUDE-historial-hasta-2026-09-10.md)
> el 2026-09-10**, para que esta raíz vuelva a cargar solo lo vigente. Sigue siendo válido tal cual,
> solo que ya no es "lo próximo".

| # | Qué | Estado |
|---|---|---|
| 0 | ~~Prueba end-to-end de volumen, en preprod, antes de mainnet~~ | **Cerrada el 2026-09-10** — 30/30 etapas `Completed` en 3 proyectos nuevos, 180/180 eventos on-chain `Confirmed`, las 4 aristas de la FSM ejercitadas por click real en el navegador. Detalle completo, el hallazgo real que dejó (dos etapas con anclaje perdido, causa raíz confirmada) y las 3 capas de autocura que salieron de ahí: `specs/REPORTE-2026-09-10-prueba-de-volumen.md`. Alimentó los criterios 8 y 15 del SOM; el 9 (reserva→escrow) se cerró aparte el 2026-09-11, es un flujo distinto — ver `specs/ESTADO-2026-09-10-catalyst-milestone-3.md` |
| 1 | **Mainnet** — runbook, habilitar la red, custodia de la clave. **Fuera de alcance de este milestone** (decisión del dueño, 2026-09-09 — ver §El plan de entrega) | D-013 la hace **imposible por configuración**: es código, no solo procedimiento. 🔴 El checklist completo de lo que hay que decidir antes de encenderla —incluida la clave del `admin`— vive en §Antes de mainnet, después del Milestone 3 |

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

**La única excepción: un commit donde TODO archivo termina en `.md`, y la decide `git`, no vos.**

```bash
[ -n "$(git diff --cached --name-only -- ':(exclude)*.md')" ] && pnpm verify:all
```

Si aparece un solo archivo que no sea `.md`, corre todo. Si no, no corre nada. **La regla es
mecánica a propósito:** "esto es solo documentación" clasificado a ojo es el mismo verde falso que
editar un `package.json` sin `pnpm install` (ver Trampas), y el día que el commit arrastre un `.ts`
chico se saltea igual. El pathspec no tiene ese problema.

**Y es `git` solo, sin `grep`, por una razón medida.** La primera versión era
`... | grep -qv '\.md$'`, y es correcta con el `grep` del sistema. Pero **bajo `ugrep` —el `grep`
que shimea Claude Code en su shell— contesta al revés: un commit con `.md` + un `.ts` da
"saltea"**, que es exactamente la dirección peligrosa. Comprobado en los dos binarios, no supuesto.
El pathspec de `git` no depende de qué `grep` haya en el PATH. Verificado en seis casos: solo `.md`,
mixto, solo `.ts`, nada staged, `.md` anidado, y `.MD` en mayúscula — este último manda a correr
todo, que es el lado seguro del error.

Lo que la sostiene, medido el 2026-09-11 y no estimado:

- **Nada del pipeline lee los `.md` que editamos.** Biome no parsea Markdown, y `typecheck`, `test`
  y `build` tampoco los miran. El único check que abre un `.md` es `pnpm testids`
  (`scripts/check-testids.mjs`), y lee `docs/milestone-3-implementacion/UI-implementation-plan.md`
  — que es **inmutable** por D-022. **Si algún día se tocara algo dentro de `docs/`, el skip no
  aplica**: ahí sí hay un check que lee.
- **La red sigue puesta.** `ci.yml` dispara en `push: [main]` sin filtro de paths, así que corre
  igual en CI. Saltearlo local no saca la verificación: la mueve 98s más tarde a otra máquina.
- **Son 98s.** Ese es el ahorro completo, y por eso la excepción es una línea de `grep` y no un
  `verify:docs` en el `package.json` ni un flag: infraestructura nueva para 98s es el patrón que ya
  se revirtió una vez con el cron.

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

# Worktrees

Usar `git worktree` para aislar trabajo en paralelo está bien — pero cada uno es un checkout
completo con su propio `pnpm install`, y en este repo eso pesa: **~750MB por worktree** (más si
corre `docker compose` o baja modelos). El 2026-09-18 el disco llegó a **99% de uso, 120Mi libres**,
con nueve worktrees viejos —todos ya mergeados y pusheados a `main`— sin borrar.

- **Borrar el worktree apenas su rama está mergeada y pusheada.**
  `git worktree remove --force .claude/worktrees/<nombre>`. No hay razón para dejarlo "por las
  dudas": el commit ya vive en `main`, el worktree no agrega nada.
- **Antes de crear uno nuevo, `git worktree list`** y borrar los que ya se mergearon. Un worktree
  con una rama que sigue sin mergear puede ser trabajo en curso de otra sesión — no lo toques ni
  asumas que es tuyo para borrar.
- **No tocar un worktree que no reconocés** (ramas `agent-*` u otro nombre que no arrancaste vos):
  puede ser una sesión concurrente con trabajo sin commitear.
- **El disco se llena en silencio.** No hay alerta hasta que algo falla con `ENOSPC`. Si vas a
  instalar dependencias, levantar `compose.dev.yml` o crear un worktree, chequeá `df -h /` antes si
  hace un tiempo que no se limpia nada.
- **Cachés reconstruibles no cuestan nada limpiar:** `~/.npm`, `~/Library/pnpm/store`,
  `~/.cache/uv`, `~/.cache/puppeteer`, `~/.cache/huggingface` se vuelven a poblar solos en el
  próximo `pnpm install` o uso. Limpialos sin preguntar si el disco aprieta.
- **Las imágenes de Docker con nombre no son cachés: son infraestructura del repo.** `yaci-cli`,
  `yaci-devkit`, `minio` y `postgres` son las que usan `compose.dev.yml` y `pnpm --filter
  @plataforma/api test:s3` / `test:yaci` (§Comandos) — bajarlas de nuevo son minutos y varios GB.
  `docker container prune` y `docker image prune` (sin `-a`, que solo se llevan contenedores
  parados e imágenes dangling) son seguros; borrar esas cuatro imágenes con nombre no.

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
