# Estado sacado del CLAUDE.md raíz y de specs/README.md — 2026-10-01

> Archivado al dejar el estado en una sola tabla (`specs/README.md` §Lo que sigue,
> AUDITORIA-2026-10-01 §6). Es historia: lo vigente está en el README.

## Del CLAUDE.md raíz: el encabezado

> **Documento de trabajo activo:** [`specs/ESTADO-2026-09-10-catalyst-milestone-3.md`](specs/ESTADO-2026-09-10-catalyst-milestone-3.md)
> — el cruce contra los 5 Outputs oficiales del Milestone 3 tal como los publica Catalyst, con lo
> que falta consolidado en una tabla. Es el punto de partida de la próxima sesión.
>
> **Las cuatro auditorías del 2026-09-11** (frente, backend, `contracts/`, `packages/`) están
> transcritas a specs implementables, una por hallazgo, y **el estado de cada una lo lleva
> [`specs/README.md` §Las cuatro series de pulido](specs/README.md)** — no esta tabla, que solo
> dice dónde buscar. **Ninguno de los 53 hallazgos toca los 16 criterios del SOM.** Lo que sí hay
> que decidir antes de mainnet está abajo, en §Antes de mainnet.

| Auditoría | Qué audita | Hallazgos | Serie |
|---|---|---|---|
| [`…-calidad-del-frente`](specs/AUDITORIA-2026-09-11-calidad-del-frente.md) | accesibilidad, responsive y mantenibilidad, medidas en el navegador contra las 42 rutas | 18 | `SPEC-101`…`110` |
| [`…-calidad-del-backend`](specs/AUDITORIA-2026-09-11-calidad-del-backend.md) | los 51 archivos de `apps/api/src`, leídos completos | 15 | `SPEC-201`…`215` |
| [`…-calidad-de-contracts`](specs/AUDITORIA-2026-09-11-calidad-de-contracts.md) | los dos archivos Aiken — **la parte mejor organizada del repo** | 6 | `SPEC-301`…`306` |
| [`…-calidad-de-packages`](specs/AUDITORIA-2026-09-11-calidad-de-packages.md) | los dos packages compartidos — **el código mejor tipado del repo** | 14 | `SPEC-401`…`412` |

**Las cuatro dejaron bugs reales, no solo pulido, y los reproducidos ya están cerrados:** `SPEC-201`
y `SPEC-202` eran corrupción de datos (dos invitaciones sobre la misma unidad; dos dossiers para una
unidad, con la firma del escribano en el que la pantalla no lee), y `SPEC-301`, una garantía que
`contracts/CLAUDE.md` afirmaba y el validador no daba. De las cuatro series no queda nada abierto
salvo lo **postergado** a propósito (los ítems de §Antes de mainnet) — `specs/README.md` lleva la
razón de cada una. `SPEC-104` cerró el 2026-09-22 (código y tests hechos desde el 2026-09-19); la
pasada manual con VoiceOver que le quedaba se separó a `SPEC-112`, ampliada a accesibilidad en
general, sin fecha y sin bloquear nada del SOM. **`SPEC-112` hizo sus capas automatizadas el
2026-09-28 y lo que encontraron se cerró el mismo día**: `SPEC-113` (el contraste de los tokens de
color de M2-D3 no llegaba al 4.5:1 que M2-D3 mismo exige; el dueño decidió oscurecerlos, **D-098**)
y `SPEC-114` (nombres, encabezados y landmarks). El registro de hallazgos de axe quedó vacío. A
`SPEC-112` le queda solo la pasada humana con VoiceOver: la automatizada (Guidepup) se descartó como
limitación de la máquina, porque macOS 15 le pide Acceso total al disco. Ninguna toca el SOM.

Lo transversal. Lo de cada frente vive en `apps/web/CLAUDE.md`, `apps/api/CLAUDE.md`,
`packages/cardano/CLAUDE.md` y `contracts/CLAUDE.md`, y se carga solo cuando tocás ese subárbol.

**Acá solo hay información vigente.** El porqué de cada decisión está en `DECISIONS.md`; el
argumento largo, en `specs/archive/`.

---


## Del CLAUDE.md raíz: el plan de entrega de M3

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

## Lo que queda del plan

**Todo el plan está cerrado.** Lo único que queda es entregar y que Catalyst acepte. (`3.12` — video walkthrough, criterio 13 — se cerró el 2026-10-01, abajo. `3.13` — recontacto de los 3
pilotos, criterio 4 — se cerró: confirmado por el dueño el 2026-09-22. `3.15` — cobertura ≥95% en
toda la app, criterio 2 — se cerró el 2026-09-24: las cuatro partes TypeScript en 100% en las
cuatro métricas y CI corriendo `test:coverage` con umbral en las cuatro, detalle en
[`specs/SPEC-019-cobertura-de-apps-web.md`](specs/SPEC-019-cobertura-de-apps-web.md). `3.14` —
muestras de reserva → escrow, criterio 9 — se cerró el 2026-09-28: 6 compras reales en Preprod,
mediana 0.33 min, en
[`specs/evidencia-m3/3-preprod/reservation-to-escrow-report.md`](specs/evidencia-m3/3-preprod/reservation-to-escrow-report.md).)

| | Qué | Criterio |
|---|---|---|
| 3.12 | **Video walkthrough** — runbook paso a paso, listo para grabar, en [`specs/GUION-2026-09-21-video-walkthrough.md`](specs/GUION-2026-09-21-video-walkthrough.md): preparar, grabar en dos sesiones, recortar, voz, unir y cerrar (9 tomas, cada una con sus marcas de tiempo de pantalla y de voz; revisado contra el código el 2026-09-28; el 2026-09-30 el dueño sacó la sesión C y el video cierra en el audit log; el 2026-10-01 la sesión A pasó a ser una sola toma de 3:33, y el panel y el alta del developer otra de 3:00 (T07), y la unidad, la invitación y la evidencia otra de 3:15 (T09), y aceptar, la unidad y el contrato otra de 1:44 (T12), y observar, reanudar y certificar otra de 1:27 (T18), y el dossier y la firma otra de 1:38 (T23), las seis ya grabadas y con narración del dueño). **Cerrado el 2026-10-01:** el `walkthrough-final.mp4` (16:16) salió con la voz baja (−25 LUFS); se normalizó a −16 LUFS y se recomprimió a menos de 100 MB (el límite de archivo de GitHub) en [`specs/evidencia-m3/3-preprod/walkthrough-video.mp4`](specs/evidencia-m3/3-preprod/walkthrough-video.mp4), con su `.srt`. El original y el normalizado en calidad completa quedan fuera del repo, en `~/Movies/propnexus-walkthrough/`. **No es lo mismo que `SPEC-104`/`SPEC-112`**: esas son accesibilidad (`aria-live`, verificada con el lector de pantalla VoiceOver de macOS), no narración de video — coinciden en la palabra "voice" y nada más. `SPEC-104` ya cerró; `SPEC-112` (la pasada de accesibilidad) sigue abierta, pero por su cuenta, sin relación con este ítem | 13 ✅ |

**La evidencia para enviar vive en [`specs/evidencia-m3/`](specs/evidencia-m3/README.md), en
inglés y solo lo exportable**, una subcarpeta por ítem de *"Evidence of milestone completion"*. Los
documentos de trabajo en castellano de los que salen (prueba de volumen, TXIDs, security review,
runbook, monitoreo, reporte de tests) siguen en `specs/` y son los que se mantienen: **si cambia uno,
se actualiza su versión en inglés en el mismo commit**, y su PDF con `bash scripts/evidencia-pdf/generar.sh`
(cada `.md` de la carpeta tiene un `.pdf` hermano generado desde él).

Lo cerrado —las tres Tandas de esquema, código y documentación, y la prueba de volumen que dio los
criterios 8 y 15— está ítem por ítem en
[`specs/ESTADO-2026-09-10-catalyst-milestone-3.md`](specs/ESTADO-2026-09-10-catalyst-milestone-3.md),
con el detalle de la prueba en
[`specs/REPORTE-2026-09-10-prueba-de-volumen.md`](specs/REPORTE-2026-09-10-prueba-de-volumen.md)
(30/30 etapas `Completed`, 180/180 eventos `Confirmed`, **~99.8 ADA** de costo real medido, y las 3
capas de autocura que salieron del único hallazgo). Los criterios **6, 8, 9, 14 y 15** quedaron ✅.

## Fuera de alcance de este milestone

| Qué | Por qué |
|---|---|
| **Mainnet** | Decisión del dueño, 2026-09-09. D-013 lo hace imposible por configuración y `specs/README.md` ya lo declara fuera |
| **Fusionar anclaje + transición** | Ahorra ~5% del costo on-chain; es 🟡 sobre el core de anclaje. Después de la prueba de volumen, que da la distribución real. Detalle en `specs/PROPUESTA-2026-09-09-fusionar-anclaje-evidencia-transicion.md` |
| **`TOPE_POR_LECTURA`** | Medir una carga real antes de tocar el número. El disparador por lectura ya se arregló (2026-09-09) |
| **"Contenido en `Pending`"** | Mejora de UX, ningún criterio la pide. Necesita que el listado de stages devuelva el anclaje y reconcilie |
| **Columna `AuditLog.projectId`** | Sacaría el mapeo fail-closed de `auditScope`. Pide backfill que para filas viejas no tiene respuesta |
| **`validationCritical` siempre `true`** | Config muerta con rama viva y testeada en el validador. No molesta |
| **Upload directo del navegador a R2 (sin pasar por Render)** | Hoy el archivo hace escala en `UPLOAD_DIR` (Multer a disco, en streaming) antes de llegar al bucket. **Ojo: el argumento de RAM que figuraba acá no aplica a Multer** — con `diskStorage` el body no pasa por memoria (`SPEC-218` §Los hallazgos); lo que pesa es disco efímero y latencia. Un presigned URL lo evitaría, pero es un cambio de forma real (CORS, flujo de 3 pasos en el front) y el hash sigue teniendo que releerse desde R2 igual (D-027). **Después de mainnet** — el diseño y el costo, en [`specs/archive/CLAUDE-argumentos-de-las-reglas-2026-09-20.md`](specs/archive/CLAUDE-argumentos-de-las-reglas-2026-09-20.md) §Anexo |
| **La espera al crear un proyecto** | Los 10 mints tardaban minutos porque cada uno esperaba su bloque adentro de la request (`awaitTx`). Eso se sacó (AUDITORIA-2026-10-01 §9, ítem 3): ahora pesa solo construir y enviar diez transacciones en serie. Falta medirlo en Preprod y, si sigue largo, la UI de la espera |
| **"Evidence by stage" del investor no abre una etapa en curso** | El chip solo se activa con el `txid` de la transición a `Completed` (`StageChips.tsx:34`, `investor.routes.ts:271`): una etapa `InProgress` con su paquete de evidencia ya anclado queda deshabilitada. Visto grabando T17, que salió del video (2026-10-01). Hay que decidir si el chip se activa con el anclaje de la evidencia |
| **El "Certify" de la cola del certifier solo abre la etapa** | En "Assigned" y en el panel, el botón de cada etapa dice "Certify" pero navega a `/certifier/stage/:id` (`AssignedStagesQueue.tsx:60`); el que certifica de verdad está abajo de esa pantalla, al lado de "Observe". Confunde justo antes de una acción irrepetible. Visto grabando T18 (2026-10-01) |

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
| 8 | **Idea:** Koios en vez de Blockfrost, o como segunda fuente | Hoy dependemos de una sola empresa (D-005). Koios es comunitario, no pide key, y cualquiera puede verificar un TXID contra la misma fuente que usamos (el 2026-10-01 confirmó dos tx de Preprod que Blockfrost ya había confirmado). Lucid ya trae el provider; Blockfrost está atado solo en `factory.ts` y en el `fetch` de `confirmedAt`. **Sin medir:** que el provider de Koios evalúe bien Plutus V3. Primer paso: `yaci.test.ts` con ese provider. Paso intermedio más barato: Koios solo como respaldo de `confirmedAt` | D-005 |

**Por qué junta specs de auditorías distintas.** Los ítems 2 y 3 salen de
`AUDITORIA-2026-09-11-calidad-de-contracts.md`; los ítems 4, 5 y 6, de
`AUDITORIA-2026-09-11-calidad-de-packages.md`. No comparten numeración porque nacieron de auditorías
separadas, pero comparten la misma restricción: todas piden una decisión del dueño que no tiene
sentido apurar para cerrar M3. El resto de las dos series (`SPEC-301`–`SPEC-303`, `SPEC-306`, y todo
lo que no está en esta tabla de `SPEC-401`…`SPEC-412`) ya está resuelto o es pulido sin fecha —
`specs/README.md` lleva el estado real de cada una.

## Cerrado, pendiente de aceptación por Catalyst

1. **El criterio 3 se cierra por documentación** (D-090, D-091 y D-092), sin construir signers ni percentages. Es
   la consecuencia directa de la regla de precedencia del dueño (entregables M2/M3 sobre el SOM,
   2026-09-09), aplicada de forma consistente con `progressPercentage`. No hay más trabajo posible
   de este lado — lo único que falta es que Catalyst lo acepte en la entrega, y eso no se sabe hasta
   entregar.

---


## Del CLAUDE.md raíz: "Estado, y lo próximo"

# Estado, y lo próximo

> **Lo que falta está en §Lo que queda del plan, arriba, y en
> [`specs/ESTADO-2026-09-10-catalyst-milestone-3.md`](specs/ESTADO-2026-09-10-catalyst-milestone-3.md)**
> (el cruce contra los 5 Outputs oficiales de Catalyst). Acá queda el único ítem que no encaja en
> ninguna Tanda. **El historial de lo ya cerrado —narración día a día hasta el 2026-09-08— vive en
> [`specs/archive/CLAUDE-historial-hasta-2026-09-10.md`](specs/archive/CLAUDE-historial-hasta-2026-09-10.md)**:
> sigue siendo válido tal cual, solo que ya no es "lo próximo".

**Mainnet** — runbook, habilitar la red, custodia de la clave. **Fuera de alcance de este milestone**
(decisión del dueño, 2026-09-09). D-013 la hace **imposible por configuración**: es código, no solo
procedimiento. 🔴 El checklist completo de lo que hay que decidir antes de encenderla —incluida la
clave del `admin`— vive en §Antes de mainnet, después del Milestone 3.


## De specs/README.md

## Estado medido (2026-09-01)

**Backend y cadena: la mitad difícil está hecha.**

| | |
|---|---|
| Contratos | validador con thread token y `mint` validado, datum alineado con M1-D2, **82 tests** |
| Anclaje | `AnchorPort` simulado y real; probado contra el `Emulator`, contra un devnet local y contra Preprod. El validador viaja por referencia (D-083) |
| API | autorización en dos capas, FSM aplicada, bundles con Merkle root, audit log, **335 tests** |
| Storage | port S3 probado contra MinIO real; el hash cubre los bytes guardados |

**Front:** SPEC-016 cierra el backlog de test IDs del investor. `DEV-RELEASE-EXECUTE-002` está
excluido del conteo (D-070, no es deuda ni backlog — nunca se implementa).

| Dimensión | Especificado | Existe | Conforme |
|---|---:|---:|---:|
| Superficies (M2-D5) | 53 | **53** | 53 — una superficie cuenta cuando TODOS sus test IDs están reclamados. Esta tabla es del 2026-09-01; el número vigente (53/53, auditado el 2026-09-03 contra el código) está en §Orden de trabajo, más abajo |
| Componentes (M2-D3) | 36 | **36** | 36 |
| Patrones de prueba (M2-D4) | 10 | 10 | 10 |
| Test IDs | **74** | 74 | 74 (100%) — medido por `pnpm testids`; `DEV-RELEASE-EXECUTE-002` excluido por D-070 |

**API contra M2-D5:** de los **64** endpoints especificados coinciden **5** exactos —
`POST /auth/login`, `GET /auth/me`, `GET /projects`, `GET /projects/:id` y
`GET /projects/:id/stages`, que entró con el rename de D-067—. Contra **M2-D6** —la guía de
arquitectura— el backend **sí** está alineado: sus seis dominios funcionales existen. M2-D6 es prosa
arquitectónica; M2-D5 es el contrato.

*(La medición anterior decía "2 de ~56": el extractor se comía los endpoints con anotaciones. Con el
parser corregido son 5 de 64.)*


## Orden de trabajo

| # | Qué | Estado |
|---|---|---|
| 1 | **Reset documental**: memoria partida, `CLAUDE.md` con el flujo, `SPEC-014` | hecho |
| 2 | **Borrado + tokens + shadcn/ui + rename D-067** | hecho |
| 3 | **Los ~12 componentes transversales** de M2-D3 | hecho — 36/36 (ver tabla de arriba) |
| 4 | **Los patrones P1–P10** de M2-D4 | **hecho** — 10/10, auditado contra el código el 2026-09-03 |
| 5+ | **Verticales**, en el orden del flujo cross-rol de M2-D1 §6: `evidencia → certificar → liberar` | **hecho** — 53/53 superficies, auditado el 2026-09-03: los 68 endpoints únicos del backlog existen en `apps/api/src/routes`, 74/74 test IDs (`DEV-RELEASE-EXECUTE-002` excluido del conteo por D-070, no deuda) |
| — | `AnchorPort` §C: reconciliación y `verify()` público ([`SPEC-013`](SPEC-013-anchorport.md)) | **hecho** — `reconciliarParaLectura` cableada en cinco routers (D-077) |
| — | **Encender el anclaje real** en la instancia desplegada ([`PLAN-2026-08-31`](PLAN-2026-08-31-anclaje-real.md)) | **hecho 2026-09-03** — primer anclaje real por metadata y por state-thread, los dos confirmados en Preprod. Ver la tabla de `CLAUDE.md` |
| — | Preprod: cuenta Blockfrost + wallet de servicio 🔴 | **hecho 2026-08-31** — wallet fondeada, clave cargada en el dashboard |

Cada vertical trae sus endpoints (con paths scopeados por rol, D-066) y sus test IDs. **El criterio
de corte de una rebanada es que la app quede corriendo y demostrable.**

## Riesgos, señal temprana y plan B

| Riesgo | Señal temprana | Plan B |
|---|---|---|
| **Los 3 pilotos no responden a tiempo** | Sin contacto al cerrar la vertical de evidencia | Escalar a los developers socios; es su compromiso elegirlos |
| **Scope creep de UI**: 53 superficies, 33 componentes | Una vertical no cierra | Cortar superficies secundarias antes que mover la fecha. **Dossier y audit log no son cortables**: son la tesis del producto |
| Blockfrost caído o limitado | 402/429 en el adaptador | El anclaje falla y el estado queda `Pending`; se reconcilia en la próxima lectura (D-077). **Caer a `ANCHOR_MODE=simulated` no es plan B**: produciría TXIDs que no existen, que es el incidente del 2026-08-27, y D-075 lo vuelve imposible por código |
| Confirmaciones lentas rompen la UX | `AnchoringSuccessModal` tarda >30s | Modal en dos tiempos: "enviado" (TXID) → "confirmado" (poll) |
| Fricción CIP-30 con profesionales | Rechazo de los pilotos | Sin alcance en el validador (D-058); si vuelve, es decisión nueva |
| La métrica de 12 minutos se descubre tarde | No hay telemetría al llegar a la vertical de invitación | Instrumentarla cuando nazca ese flujo, no después |
| El free tier duerme el servicio en una demo | Primera demo con la URL fría | El web pasa a static site (D-065) y no duerme; queda la API. Si molesta, el disparador para mirar edge |

## Registro de specs

| Spec | Título | Estado |
|---|---|---|
| [`SPEC-010`](SPEC-010-superficie-roja.md) | Endurecer la superficie 🔴 | cerrada 2026-08-21 |
| [`SPEC-012`](SPEC-012-segunda-capa-como-middleware.md) | `requireProjectAccess`: la segunda capa como middleware | cerrada 2026-08-23 · **superada por D-088** el 2026-09-04 |
| [`SPEC-013`](SPEC-013-anchorport.md) | `AnchorPort`: conectar el registro con la cadena | **cerrada** — §A, §B y §C. §C (`reconcile()` en lectura, `verify()` público, estados de la UI) cerró con D-077 (`reconciliarParaLectura` cableada en cinco routers) — este archivo lo tenía desactualizado contra §Orden de trabajo, más arriba |
| [`SPEC-014`](SPEC-014-reconstruccion-del-front.md) | Reconstrucción del front desde los entregables | **cerrada 2026-09-11** |
| [`SPEC-015`](SPEC-015-saneamiento-de-la-instrumentacion.md) | Saneamiento de la instrumentación: tests, fixtures, coverage, CI | **cerrada 2026-09-11** — los 7 cambios. El 6 cerró **reformulado**: se parte por concern, no por conteo de líneas (§El ítem 6) |
| [`SPEC-016`](SPEC-016-superficie-del-investor.md) | Superficie del investor (M2-D5 §4) | **cerrada 2026-08-28** |
| [`SPEC-017`](SPEC-017-cobertura-95-en-toda-la-app.md) | 95% de cobertura con unit tests, en toda la app (criterio 2) | **cerrada 2026-09-22, partida en SPEC-018 y SPEC-019** — shared, cardano y contratos cerrados; la API, sobre el 95% de líneas |
| [`SPEC-018`](SPEC-018-cobertura-de-apps-api.md) | Cobertura de `apps/api`: branches ≥95%, el resto ≥98% | **cerrada 2026-09-23** — vara más estricta que el criterio 2, pedida por el dueño. Los seis lotes (A1-A6) más tres `catch` de logging que ninguna tabla de lote traía: las cuatro métricas quedaron en **100%** (branches 839/839). Umbrales de `vitest.config.mts` subidos a 99/99/99/99 |
| [`SPEC-019`](SPEC-019-cobertura-de-apps-web.md) | Cobertura de `apps/web`: las cuatro métricas ≥95%, más CI y evidencia | **cerrada 2026-09-24** — las cuatro métricas en 100% (W1–W9), umbrales del `vitest.config.ts` en 100/100/100/100, `test:coverage` de la raíz corre las cuatro partes TypeScript y CI también. El criterio 2 del SOM cierra ✅ |


## Riesgos, señal temprana y plan B

| Riesgo | Señal temprana | Plan B |
|---|---|---|
| **Los 3 pilotos no responden a tiempo** | Sin contacto al cerrar la vertical de evidencia | Escalar a los developers socios; es su compromiso elegirlos |
| **Scope creep de UI**: 53 superficies, 33 componentes | Una vertical no cierra | Cortar superficies secundarias antes que mover la fecha. **Dossier y audit log no son cortables**: son la tesis del producto |
| Blockfrost caído o limitado | 402/429 en el adaptador | El anclaje falla y el estado queda `Pending`; se reconcilia en la próxima lectura (D-077). **Caer a `ANCHOR_MODE=simulated` no es plan B**: produciría TXIDs que no existen, que es el incidente del 2026-08-27, y D-075 lo vuelve imposible por código |
| Confirmaciones lentas rompen la UX | `AnchoringSuccessModal` tarda >30s | Modal en dos tiempos: "enviado" (TXID) → "confirmado" (poll) |
| Fricción CIP-30 con profesionales | Rechazo de los pilotos | Sin alcance en el validador (D-058); si vuelve, es decisión nueva |
| La métrica de 12 minutos se descubre tarde | No hay telemetría al llegar a la vertical de invitación | Instrumentarla cuando nazca ese flujo, no después |
| El free tier duerme el servicio en una demo | Primera demo con la URL fría | El web pasa a static site (D-065) y no duerme; queda la API. Si molesta, el disparador para mirar edge |

