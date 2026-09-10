import type { LiveThread } from "@plataforma/cardano";
import { refToHex } from "@plataforma/shared";
import { anchorPort } from "../lib/anchor";
import { db } from "../lib/db";
import { sql } from "../lib/kysely";

// Reconciliación: promover a `Confirmed` los anclajes que ya están en la cadena
// (SPEC-013 §C).
//
// **Por qué existe.** Anclar devuelve `Pending` y es lo correcto: en ese momento
// la transacción está enviada, no confirmada, y la regla 17 prohíbe mostrar una
// señal de prueba que no podamos sustanciar. Pero sin nadie que vuelva a mirar,
// `Pending` era para siempre —la evidencia quedaba anclada de verdad y la UI
// decía "Pendiente" eternamente—.
//
// **No hay `setInterval` acá, y es deliberado** (D-003 · D-040): un timer dentro
// de la API deja de contar cuando Render duerme el servicio a los 15 minutos, y
// el free tier no tiene workers.
//
// **La invariante, desde el 2026-09-09:** toda lectura que devuelva el estado
// de un anclaje (`anchorStatus`, `status`, un `OnChainEvent` entero) llama a
// `reconciliarParaLectura` con su propio alcance **antes** de consultar. Sin
// eso, el disparo por lectura no alcanza a la pantalla donde se muestra el
// anclaje y el evento se sirve `Pending` para siempre — no hasta la próxima
// carga: para siempre, porque nada más lo iba a mirar. Pasó con tres rutas
// (`GET /projects/:id/documents`, `GET /contracts/:contractId/releases`,
// `GET /certifier/certificates`). Lo fija `test/reconcile-on-read.test.ts`,
// que lo comprueba mirando la base después de pedir la ruta por HTTP.
//
// **Tampoco hay cron, y eso también es una decisión** (D-077, y ver la memoria
// del cron revertido): el disparo es la propia lectura. Cuando alguien abre una
// pantalla que muestra un anclaje `Pending` con TXID, se consulta la cadena para
// ese anclaje antes de responder. La confirmación llega en el momento en que
// alguien la mira, que es el único en que importa, y no hay servicio nuevo que
// mantener ni secreto permanente que rotar. `POST /evidence/reconcile` queda
// para barridos a mano.

export interface ResultadoReconciliacion {
  revisados: number;
  confirmados: number;
}

/**
 * Qué anclajes mirar. Son los cuatro ejes por los que las lecturas del repo ya
 * buscan un `OnChainEvent`; sin alcance se mira todo, que es el barrido.
 *
 * `projectIds` existe para los KPIs, que cuentan sobre varios proyectos.
 */
export interface AlcanceReconciliacion {
  projectId?: string;
  projectIds?: string[];
  stageId?: string;
  evidenceId?: string;
  referenceId?: string;
}

/**
 * Cuántos anclajes se consultan como mucho en una lectura.
 *
 * Es chico a propósito: cada uno es una request a Blockfrost metida adentro del
 * tiempo de respuesta de alguien. En la práctica hay cero o uno —los eventos
 * confirman en un bloque y dejan de estar `Pending`—, y el tope está para que
 * una acumulación rara no convierta una pantalla en una espera. Lo que quede sin
 * mirar lo levanta la lectura siguiente, o el barrido.
 */
const TOPE_POR_LECTURA = 5;

/** El barrido a mano: `POST /evidence/reconcile`. */
export async function reconciliarAnclajes(limite = 50): Promise<ResultadoReconciliacion> {
  return reconciliar({}, limite);
}

/**
 * El disparo por lectura. **Se llama antes de la consulta, no después.**
 *
 * Reconciliar la *respuesta* obligaría a un mapeo por cada sitio de lectura, y
 * hay trece con formas distintas —unos `selectAll`, otros proyecciones con
 * alias—. Actualizando la base primero, la consulta que ya existía ve el estado
 * nuevo sin enterarse de que esto pasó.
 *
 * **Nunca hace fallar la lectura.** Si la cadena no responde, o si el puerto
 * está inhabilitado, la pantalla se dibuja con lo que haya en la base: eso es
 * `Pending`, que es la verdad de lo que podemos sustanciar (regla 17).
 */
export async function reconciliarParaLectura(alcance: AlcanceReconciliacion): Promise<void> {
  try {
    await reconciliar(alcance, TOPE_POR_LECTURA);
  } catch (error) {
    console.error("[reconcile] la reconciliación por lectura falló", { alcance, error });
  }
}

/**
 * Revisa los eventos `Pending` que tienen TXID y confirma los que ya entraron
 * en un bloque.
 *
 * Un evento sin `txid` **no se toca**: es un anclaje que falló al enviarse
 * (`Failed`) o que todavía no se envió, y ahí no hay nada que consultar.
 */
async function reconciliar(
  alcance: AlcanceReconciliacion,
  limite: number
): Promise<ResultadoReconciliacion> {
  // Con el puerto inhabilitado no hay a quién preguntarle, y cada consulta sería
  // una excepción garantizada. Se corta antes de tocar la base: en una instancia
  // sin los secretos cargados, esto es todas las lecturas.
  if (anchorPort().mode === "disabled") return { revisados: 0, confirmados: 0 };

  let query = db
    .selectFrom("OnChainEvent")
    .select(["id", "txid"])
    .where("status", "=", "Pending")
    .where("txid", "is not", null);

  if (alcance.projectId) query = query.where("projectId", "=", alcance.projectId);
  if (alcance.projectIds) query = query.where("projectId", "in", alcance.projectIds);
  if (alcance.stageId) query = query.where("stageId", "=", alcance.stageId);
  if (alcance.evidenceId) query = query.where("evidenceId", "=", alcance.evidenceId);
  if (alcance.referenceId) query = query.where("referenceId", "=", alcance.referenceId);

  const pendientes = await query.orderBy("createdAt", "asc").limit(limite).execute();

  let confirmados = 0;

  for (const evento of pendientes) {
    if (!evento.txid) continue;

    // Uno por uno y sin `Promise.all`: son llamadas a un proveedor externo con
    // límite de rate, y este trabajo no tiene apuro. Que un TXID falle no puede
    // tumbar la tanda entera.
    let blockTimestamp: number | null = null;
    try {
      blockTimestamp = await anchorPort().confirmedAt(evento.txid);
    } catch {
      continue;
    }

    if (blockTimestamp === null) continue;

    await db
      .updateTable("OnChainEvent")
      .set({
        status: "Confirmed",
        blockTimestamp: new Date(blockTimestamp),
        updatedAt: new Date()
      })
      .where("id", "=", evento.id)
      // Solo si sigue `Pending`: entre la consulta y el update pudo haber pasado
      // otra tanda. Sin esto, dos disparos concurrentes se pisan.
      .where("status", "=", "Pending")
      .execute();

    confirmados++;
  }

  return { revisados: pendientes.length, confirmados };
}

export interface HiloSospechoso {
  eventId: string;
  projectId: string;
  // Nullable en la tabla en general (un `EVIDENCE_ANCHOR` no cuelga de un
  // stage), pero acá siempre viene poblado: el `where` de abajo filtra por
  // `eventType: "STAGE_TRANSITION"`, que siempre tiene `stageId`. Se declara
  // nullable igual para no forzar el tipo con un cast.
  stageId: string | null;
  eventIndex: number;
  fromState: string | null;
  toState: string | null;
  status: string;
  createdAt: Date;
}

const TOPE_SOSPECHOSOS = 20;

/**
 * Detección, no reparación, del patrón que la prueba de volumen del
 * 2026-09-10 encontró a mano (`specs/REPORTE-2026-09-10-prueba-de-volumen.md`
 * §Hallazgo): una `STAGE_TRANSITION` sin `txid` que el stage ya dejó atrás —
 * existe un evento con `eventIndex` mayor en el mismo hilo, así que el
 * anclaje de este no se va a reintentar solo.
 *
 * **No distingue los dos casos del reporte, y no puede** sin consultar la
 * cadena: puede ser que la transacción nunca haya salido (el caso simple,
 * "etapa 4" — ahí alcanza con reintentar la transición) o que haya salido y
 * la aplicación haya perdido el recibo antes de este fix (el caso "etapa 3"
 * — ahí el hilo real vive en un UTxO que esta función no puede nombrar,
 * porque el `AnchorPort` de hoy busca por `outputRef` conocido, no por el
 * asset del thread token; nombrarlo pidió Koios a mano en el reporte).
 * **Esa distinción ya la cierra `repararHilosSospechosos`, más abajo**, con la
 * capacidad nueva del puerto (`findLiveThread`, Capa 1).
 *
 * **Por qué no es un `setInterval` ni un cron:** D-003 · D-040 · D-077 — un
 * timer interno deja de contar cuando Render duerme el servicio, y el free
 * tier no tiene workers. Esto es una consulta, para correr a demanda
 * (`POST /evidence/reconcile` la suma a su respuesta) — el mismo criterio
 * que ya rige `reconciliarAnclajes`.
 */
export async function hilosSospechosos(limite = TOPE_SOSPECHOSOS): Promise<HiloSospechoso[]> {
  return db
    .selectFrom("OnChainEvent")
    .select([
      "id as eventId",
      "projectId",
      "stageId",
      "eventIndex",
      "fromState",
      "toState",
      "status",
      "createdAt"
    ])
    .where("eventType", "=", "STAGE_TRANSITION")
    .where("txid", "is", null)
    .where("stageId", "is not", null)
    .where((eb) =>
      eb.exists(
        eb
          .selectFrom("OnChainEvent as siguiente")
          .select(sql.lit(1).as("one"))
          .whereRef("siguiente.stageId", "=", "OnChainEvent.stageId")
          .whereRef("siguiente.eventIndex", ">", "OnChainEvent.eventIndex")
      )
    )
    .orderBy("createdAt", "asc")
    .limit(limite)
    .execute();
}

export interface HiloReparado {
  eventId: string;
  txid: string;
  outputRef: string;
}

/**
 * Capa 1: repara el bookkeeping de un hilo sospechoso **sin firmar nada
 * nuevo**. Cierra el caso "etapa 3" del reporte del 2026-09-10 —una
 * transacción que sí salió y confirmó, pero cuyo `OnChainEvent` se quedó sin
 * `txid` porque el proceso se cayó entre el `submit()` y el `UPDATE`— sin
 * volver a hacer a mano lo que esa sesión hizo con Koios.
 *
 * **Por qué es seguro escribir sin revisión humana** (a diferencia de mandar
 * una transacción, que sigue siendo 🔴 y manual, ver la CLI de Capa 2): esto
 * nunca gasta ADA ni construye nada — `findLiveThread` solo lee. Y antes de
 * escribir, compara el `state` del datum encontrado contra el `toState` que
 * el propio evento ya declaraba: si no coinciden, **no se toca nada**. Eso
 * descarta el otro caso del reporte ("etapa 4", donde la transacción nunca
 * salió) sin necesidad de que esta función sepa distinguirlos — si nunca
 * salió, `findLiveThread` sigue viendo el datum *anterior* (u otro hilo
 * completamente distinto en un caso patológico), y el chequeo lo filtra
 * igual.
 *
 * **Dos guardas de idempotencia:** `WHERE txid IS NULL` (regla 8, mismo
 * criterio que la migración 0004) — si dos disparos corren superpuestos, el
 * segundo no pisa nada — y el filtro de `hilosSospechosos()` en sí, que ya
 * exige que no haya un evento posterior con `outputRef`.
 *
 * El evento queda en `status: "Pending"` a propósito, igual que un anclaje
 * recién enviado: es `reconciliarAnclajes` (más arriba, y ya corre en el
 * mismo `POST /evidence/reconcile`) quien lo promueve a `Confirmed` — es la
 * misma pregunta (`confirmedAt`) que ya le hace a cualquier otro `Pending`
 * con `txid`, y repetirla acá sería la misma lógica en dos lugares.
 */
export async function repararHilosSospechosos(limite = TOPE_SOSPECHOSOS): Promise<HiloReparado[]> {
  if (anchorPort().mode === "disabled") return [];

  const sospechosos = await hilosSospechosos(limite);
  const reparados: HiloReparado[] = [];

  for (const sospechoso of sospechosos) {
    if (!sospechoso.stageId || !sospechoso.toState) continue;

    let vivo: LiveThread | null;
    try {
      vivo = await anchorPort().findLiveThread(refToHex(sospechoso.stageId));
    } catch (error) {
      console.error("[reconcile] findLiveThread falló para un sospechoso", {
        eventId: sospechoso.eventId,
        error
      });
      continue;
    }

    if (!vivo || vivo.datum.state !== sospechoso.toState) continue;

    const [txid] = vivo.outputRef.split("#");
    if (!txid) continue;

    const escrito = await db
      .updateTable("OnChainEvent")
      .set({
        txid,
        outputRef: vivo.outputRef,
        network: anchorPort().network ?? "Preprod",
        status: "Pending",
        updatedAt: new Date()
      })
      .where("id", "=", sospechoso.eventId)
      .where("txid", "is", null)
      .executeTakeFirst();

    if (Number(escrito.numUpdatedRows) > 0) {
      reparados.push({ eventId: sospechoso.eventId, txid, outputRef: vivo.outputRef });
    }
  }

  return reparados;
}
