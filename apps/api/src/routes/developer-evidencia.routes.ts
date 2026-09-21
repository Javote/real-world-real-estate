import fs from "node:fs";
import path from "node:path";
import {
  cuidParamSchema,
  detectarTipoDeEvidencia,
  EVIDENCE_MAX_FILE_BYTES,
  EVIDENCE_MAX_FILES,
  EVIDENCE_SIGNATURE_BYTES,
  type EvidenceMime,
  type EvidenceRejection,
  stageEvidenceUploadResultSchema,
  stageEvidenceUploadSchema
} from "@plataforma/shared";
import { type Request, type RequestHandler, Router } from "express";
import type { z } from "zod";
import { createId } from "../db/id";
import { anchorCommitmentEvent } from "../domain/anchoring";
import { notifyUnitInvestors } from "../domain/notify";
import { crearBundle, transitionStage } from "../domain/stage-transition";
import { db } from "../lib/db";
import { call, ORPCError, os } from "../lib/orpc";
import { leerCabecera, sha256DeArchivo, storage } from "../lib/storage";
import { uploadEvidenceFiles } from "../lib/upload";
import { authenticate, authorize } from "../middlewares/auth";
import { paramValidator } from "../middlewares/validate-params";
import { writeAuditLog } from "../utils/audit";
import { EVIDENCE_SAFE_COLUMNS } from "./_shared";

// **La subida anclada de evidencia por stage** (M2-D5 filas 38 y 44c) —
// M3-BE-13 y M3-SC-02, patrones P4 y P5.
//
// Un solo endpoint, y en archivo propio porque no se parece a nada más del
// prefijo: es el único que combina multipart, storage, hashing, armado de
// bundle y anclaje en la misma request. M2-D5 §2.2 lo obliga —*"client awaits
// success with TXID/Merkle root in the same response"*— porque es lo que
// alimenta el `AnchoringSuccessModal`, la única superficie de prueba que se
// abre sola (M2-D4 §6.3).
//
// **SPEC-212 — investigación "Multer + `call()`" (2026-09-20), adoptada en
// alcance acotado.** Esta sigue siendo la única ruta de §D que no migra a
// `OpenAPIHandler` — la razón no cambió: bufferea el multipart entero en
// memoria sin límite configurable (ver `CLAUDE.md` de este subárbol, §Trampas
// verificadas). Lo que sí cambia es SOLO el paso de validación de los campos
// de texto: `stageEvidenceUploadSchema.safeParse(req.body)` se reemplazó por
// `call(validarCamposDeTexto, req.body)`, que corre el MISMO schema a través
// del `.input()` de un procedimiento oRPC. El resultado, verificado con un
// smoke test: el 400 ahora tiene el mismo shape (`ORPCError.toJSON()`,
// `{code, status, data: {issues}}`) que las otras 45 rutas de §A-D, en vez de
// `error.flatten()` — que es lo que hoy las 45 devuelven y esta única ruta no
// devolvía. **A propósito no se llevó el resto del handler adentro de un
// procedimiento oRPC** (storage, bundle, anclaje, notificaciones, audit log,
// transición de stage): es lógica de dominio con side effects que ya
// funciona y no es lo que esta investigación puso en duda — meterla adentro
// del `.handler()` de un procedimiento hubiera sido un cambio mucho más
// grande que "unificar el shape del 400", sin necesidad. Por eso
// `borrarHuerfano()` y todo lo que sigue después de la validación no se tocó.
// Sin `.output()`: el valor que devuelve el `.handler()` YA es la salida
// transformada de `stageEvidenceUploadSchema` (`authoritative` a `boolean`,
// `issuingAuthority` a `string | null`) — volver a pasarla por el mismo
// schema como output typa contra su forma de ENTRADA (pre-transform, donde
// `authoritative` todavía es `string`) y no compila. No hace falta: nadie
// más consume el output de este procedimiento por HTTP, es un passthrough
// de validación en proceso.
// **SPEC-218 — la subida es por LOTE, validada en los dos lados.** Un pedido trae
// hasta `EVIDENCE_MAX_FILES` archivos (`file` repetido) y produce **un**
// bundle, **un** anclaje, **una** notificación y **una** transición de stage.
// Tres niveles de error, y no se mezclan:
//
//  · **Del pedido** (falla todo, no se procesa nada): stage ajeno o cerrado
//    —se decide ANTES de guardar nada, ver `rechazarStageAntesDeRecibir`—, más de 10 archivos o uno por
//    encima del tope (Multer corta el stream), y una falla de infraestructura
//    (R2, base), esta última con limpieza de lo ya guardado.
//  · **Por archivo** (se rechaza ese archivo, el resto sigue): tipo real no
//    permitido (por los primeros bytes, no por el `Content-Type` que declara
//    el cliente), repetido dentro del lote, o ya enviado a ese stage. Vuelven
//    en `rejected` con su código: ningún rechazo es silencioso.
//  · **Si no se acepta ninguno:** 400 `NO_FILES_ACCEPTED`.
//
// **La regla del repetido: un stage no tiene dos evidencias con el mismo
// SHA-256.** El hash oficial lo calcula `storage.put()` releyendo el objeto
// DESPUÉS de subirlo (D-027), o sea que recién existe cuando el archivo ya
// está guardado — y detectar un repetido tiene que ser ANTES de guardar. Por
// eso se hashea primero el temporal (una lectura local, en streaming) y, tras
// el `put`, el hash que devuelve el storage tiene que COINCIDIR con ese: si no,
// la subida se truncó o se corrompió y el pedido falla con limpieza. Esa
// comparación es una verificación de integridad que antes no existía.
//
// El chequeo de repetidos es de aplicación, no una restricción de la base:
// dos pedidos simultáneos con el mismo archivo podrían pasar los dos. Lo cierra
// `SPEC-219` (`UNIQUE (stageId, sha256Hash)`), aparte a propósito.
const validarCamposDeTexto = os
  .route({ method: "POST", path: "/projects/{id}/stages/{stageId}/evidence" })
  .input(stageEvidenceUploadSchema)
  .handler(({ input }) => input);

const router = Router();

router.param("id", paramValidator(cuidParamSchema));
router.param("stageId", paramValidator(cuidParamSchema));

router.use(authenticate);

/**
 * Resuelve si el stage acepta una subida: 404 si no es de este proyecto, 409 si
 * ya está `Completed`. Se usa DOS veces —antes de recibir los bytes, para no
 * recibir hasta 50 MB por un pedido condenado, y después de recibirlos, porque
 * el stage puede haberse cerrado mientras se subía—, así que las dos veces
 * responde lo mismo.
 *
 * **`Completed` es terminal en la FSM (D-020) y también acá.** Sin este
 * chequeo el pipeline de evidencia no se enteraba de que el stage había
 * cerrado: la subida armaba un bundle NUEVO, con un root nuevo, y lo
 * anclaba por metadata — mientras el datum del hilo conserva para siempre
 * el root congelado al certificar.
 *
 * La consecuencia es visible y es de la regla 17: `GET /projects/:id/
 * stages/:stageId` devuelve el bundle **más reciente**
 * (`orderBy createdAt desc limit 1`), así que la pantalla mostraría ese
 * `commitmentHash` al lado del evento de certificación, cuyo `commitment`
 * es el viejo. Un root exhibido junto a un TXID que no lo atestigua.
 *
 * **Dónde va la documentación posterior al cierre:** `POST /developer/
 * documents`, que es a nivel proyecto y no toca el bundle de ningún stage.
 * Por eso esto rechaza en vez de aceptar-y-no-rebundlear: aceptar en
 * silencio dejaría al developer creyendo que subió evidencia de la etapa.
 */
async function stageQueAceptaSubida(projectId: string, stageId: string) {
  const stage = await db
    .selectFrom("Stage")
    .selectAll()
    .where("id", "=", stageId)
    .where("projectId", "=", projectId)
    .executeTakeFirst();

  if (!stage) {
    return { rechazo: { status: 404, body: { message: "Stage does not belong to project" } } };
  }
  if (stage.state === "Completed") {
    return {
      rechazo: {
        status: 409,
        body: {
          message: "A completed stage does not accept more evidence",
          code: "STAGE_ALREADY_COMPLETED"
        }
      }
    };
  }
  return { stage };
}

/**
 * Antes de que Multer escriba un solo byte a disco.
 *
 * **Descarta el body ANTES de responder, y esto no es opcional.** Se probó
 * responder el 404/409 de inmediato (con `req.resume()`): con un body de unos
 * MB el servidor cierra la conexión con el cliente todavía subiendo y este ve
 * `ECONNRESET`, un error de red, en vez del 409 — reproducido en
 * `evidence-upload.test.ts`. HTTP/1.1 no permite cortar la subida de un cliente
 * que ya empezó: lo único seguro es leer (y tirar) lo que viene y recién ahí
 * contestar. Lo que sí se ahorra es escribirlo a disco, hashearlo y guardarlo.
 *
 * El drenaje tiene tope —lo mismo que Multer aceptaría, más un margen para los
 * campos de texto—: un cliente que siga mandando bytes después no es una
 * subida, y se le corta.
 */
const TOPE_DE_DRENAJE = EVIDENCE_MAX_FILES * EVIDENCE_MAX_FILE_BYTES + 1024 * 1024;

const rechazarStageAntesDeRecibir: RequestHandler<{ id: string; stageId: string }> = async (
  req,
  res,
  next
) => {
  try {
    const { rechazo } = await stageQueAceptaSubida(req.params.id, req.params.stageId);
    if (!rechazo) return next();

    const responder = () => void res.status(rechazo.status).json(rechazo.body);
    if (req.readableEnded) return responder();

    let leidos = 0;
    req.on("data", (chunk: Buffer) => {
      leidos += chunk.length;
      if (leidos > TOPE_DE_DRENAJE) req.destroy();
    });
    req.once("end", responder);
    req.resume();
  } catch (err) {
    next(err);
  }
};

/**
 * Fila 38 y 44c — la subida del developer, scopeada al stage — **M3-BE-13** y
 * **M3-SC-02**, patrones P4 y P5. **Por lote desde SPEC-218.**
 *
 * Es la MISMA subida que `POST /projects/:id/evidence` con el path y la forma
 * que el backlog pide, y con una diferencia que no es cosmética: acá el stage
 * es obligatorio y **la respuesta trae el Merkle root y el TXID en el mismo
 * request**. M2-D5 §2.2 lo fija: *"back end submits to Cardano; client awaits
 * success with TXID/Merkle root in the same response"* — es lo que alimenta el
 * `AnchoringSuccessModal`, la única superficie de prueba que se abre sola
 * (M2-D4 §6.3). M2-D4 §P5 describe el bundle como *"anchor multiple files with
 * a single hash"*: un lote es un bundle y un anclaje, no uno por archivo.
 *
 * **El bundle se rearma en cada subida.** Cada uno es un acta del conjunto que
 * existía en ese momento, no un índice que se edita: el root ya anclado tiene
 * que seguir verificando después de que se suba el archivo siguiente.
 *
 * **La asimetría de siempre** (D-059): el archivo y su hash quedan escritos
 * aunque el anclaje falle. En ese caso `anchor.status` es `Failed`, el TXID es
 * `null` y la UI muestra "Pendiente" — nunca "Verificado" (regla 17).
 *
 * Los campos de texto (`evidenceType`, `category`, `authoritative`, …) valen
 * para TODOS los archivos del lote.
 */
router.post(
  "/projects/:id/stages/:stageId/evidence",
  authorize({
    roles: ["admin", "developer"],
    acceso: { proyecto: { param: "id" }, membresias: ["developer"] }
  }),
  rechazarStageAntesDeRecibir,
  (req, res, next) => {
    uploadEvidenceFiles(req, res, (err) => (err ? next(err) : next()));
  },
  async (req: Request<{ id: string; stageId: string }>, res, next) => {
    const { id: projectId, stageId } = req.params;
    const archivos = (req.files ?? []) as Express.Multer.File[];

    // Lo que hay que deshacer si el pedido no llega a commitear las filas
    // `Evidence`: los temporales y lo que ya subió a R2. Pasado ese punto NO se
    // borra nada (D-059: el archivo y su hash quedan aunque falle el anclaje).
    let confirmado = false;
    const subidos: string[] = [];

    try {
      if (archivos.length === 0) return res.status(400).json({ message: "File is required" });

      // `call()` corre `stageEvidenceUploadSchema` a través de `.input()` — el
      // MISMO schema que antes validaba con `safeParse`, ahora vía oRPC para
      // que el 400 tenga el shape unificado de las otras rutas (ver el
      // comentario grande de arriba). Un `ORPCError` es un rechazo CLASIFICADO
      // (acá, `BAD_REQUEST` de `.input()`) — se responde directo con su propio
      // `status`/`toJSON()`, igual que hace `OpenAPIHandler.encodeError`; nunca
      // pasa por `errorHandler`, así que tampoco por Sentry (una validación
      // fallida no es un fallo del servidor). Cualquier OTRA excepción sigue
      // yendo a `next(err)`: esta ruta nunca dejó de ser Express llano.
      let parsed: z.infer<typeof stageEvidenceUploadSchema>;
      try {
        parsed = await call(validarCamposDeTexto, req.body);
      } catch (err) {
        if (err instanceof ORPCError) return res.status(err.status).json(err.toJSON());
        throw err;
      }

      // El stage pudo cerrarse mientras se subían los bytes.
      const { stage, rechazo } = await stageQueAceptaSubida(projectId, stageId);
      if (rechazo) return res.status(rechazo.status).json(rechazo.body);

      // ── Clasificar cada archivo ANTES de guardar ninguno ────────────────
      const rechazados: EvidenceRejection[] = [];
      const candidatos: {
        indice: number;
        file: Express.Multer.File;
        mime: EvidenceMime;
        sha256: string;
      }[] = [];

      for (const [indice, file] of archivos.entries()) {
        const cabecera = await leerCabecera(file.path, EVIDENCE_SIGNATURE_BYTES);
        const real = detectarTipoDeEvidencia(cabecera);
        // El tipo REAL tiene que ser uno permitido Y coincidir con el que
        // declaró el cliente: un PNG etiquetado JPEG es tan sospechoso como un
        // ejecutable etiquetado PDF.
        if (real === null || real !== file.mimetype) {
          rechazados.push({ index: indice, code: "UNSUPPORTED_FILE_TYPE" });
          continue;
        }
        candidatos.push({ indice, file, mime: real, sha256: await sha256DeArchivo(file.path) });
      }

      const existentes = new Set(
        candidatos.length === 0
          ? []
          : (
              await db
                .selectFrom("Evidence")
                .select("sha256Hash")
                .where("stageId", "=", stage.id)
                .where(
                  "sha256Hash",
                  "in",
                  candidatos.map((c) => c.sha256)
                )
                .execute()
            ).map((f) => f.sha256Hash)
      );

      // Primero contra el stage y después dentro del lote: dos idénticos que
      // además ya existían dan `EVIDENCE_ALREADY_IN_STAGE` los dos (el motivo de
      // fondo), no "repetido" el segundo.
      const vistos = new Set<string>();
      const aceptados: typeof candidatos = [];
      for (const c of candidatos) {
        if (existentes.has(c.sha256)) {
          rechazados.push({ index: c.indice, code: "EVIDENCE_ALREADY_IN_STAGE" });
        } else if (vistos.has(c.sha256)) {
          rechazados.push({ index: c.indice, code: "DUPLICATE_FILE_IN_BATCH" });
        } else {
          vistos.add(c.sha256);
          aceptados.push(c);
        }
      }
      rechazados.sort((a, b) => a.index - b.index);

      // Un rechazado no se guarda nunca: su temporal se va ya.
      const aceptadosIdx = new Set(aceptados.map((a) => a.indice));
      for (const [indice, file] of archivos.entries()) {
        if (!aceptadosIdx.has(indice) && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }

      if (aceptados.length === 0) {
        return res.status(400).json({
          message: "No file was accepted",
          code: "NO_FILES_ACCEPTED",
          rejected: rechazados
        });
      }

      // ── Guardar los aceptados ───────────────────────────────────────────
      const guardados: {
        id: string;
        c: (typeof aceptados)[number];
        storageRef: string;
        sha256: string;
      }[] = [];
      for (const c of aceptados) {
        const g = await storage.put({
          localPath: path.resolve(c.file.path),
          key: `evidence/${projectId}/${c.file.filename}`,
          contentType: c.mime
        });
        subidos.push(g.storageRef);
        // El hash de lo que quedó GUARDADO tiene que ser el del temporal: si
        // difiere, la subida se truncó o se corrompió y anclar esa huella sería
        // anclar un archivo que no existe (D-027).
        if (g.sha256 !== c.sha256) {
          throw new Error("El hash del archivo guardado no coincide con el del temporal");
        }
        guardados.push({ id: createId(), c, storageRef: g.storageRef, sha256: g.sha256 });
      }

      const now = new Date();
      await db.transaction().execute(async (trx) => {
        for (const g of guardados) {
          await trx
            .insertInto("Evidence")
            .values({
              id: g.id,
              projectId,
              stageId,
              uploadedById: req.user!.id,
              evidenceType: parsed.evidenceType,
              category: parsed.category,
              authoritative: parsed.authoritative ?? false,
              issuingAuthority: parsed.issuingAuthority,
              originalFilename: g.c.file.originalname,
              storedFilename: g.c.file.filename,
              mimeType: g.c.mime,
              sizeBytes: g.c.file.size,
              storagePath: g.storageRef,
              sha256Hash: g.sha256,
              uploadedAt: now,
              createdAt: now,
              updatedAt: now
            })
            .execute();
        }
      });
      confirmado = true;

      // El acta del conjunto que existe AHORA, con los archivos recién subidos
      // adentro. Nunca es null: acabamos de insertar al menos una evidencia.
      const merkleRoot = await crearBundle(stage, req.user!.id);

      const bundle = await db
        .selectFrom("EvidenceBundle")
        .select(["id", "commitmentHash"])
        .where("stageId", "=", stage.id)
        .orderBy("createdAt", "desc")
        .limit(1)
        .executeTakeFirstOrThrow();

      // Se ancla el ROOT del bundle, no el hash del archivo: el archivo suelto ya
      // tiene su propia ruta de anclaje (`POST /evidence/:id/anchor`), y lo que
      // el patrón P5 muestra es el root con las hojas debajo. **Uno por lote.**
      const anchor = await anchorCommitmentEvent({
        projectId,
        stageId: stage.id,
        evidenceId: guardados[0]!.id,
        eventType: "EVIDENCE_ANCHOR",
        commitment: bundle.commitmentHash,
        // Ref opaca: el id del bundle, nunca el nombre del archivo (regla 2).
        reference: bundle.id
      });

      const ids = guardados.map((g) => g.id);
      const filas = await db
        .selectFrom("Evidence")
        .select(EVIDENCE_SAFE_COLUMNS)
        .where("id", "in", ids)
        .execute();
      const evidences = ids.map((id) => filas.find((f) => f.id === id)!);

      // Los investors del proyecto se enteran de que hay evidencia nueva. Con
      // clave, no con copy (regla 15). **Una notificación por lote**, sin
      // importar cuántos archivos entraron.
      //
      // SPEC-209 (B-13): se trae `investorId` de una y se inserta todo en un
      // solo `INSERT` (antes era un `SELECT` + una consulta por unidad).
      const unidades = await db
        .selectFrom("Unit")
        .select(["id", "investorId"])
        .where("projectId", "=", projectId)
        .where("investorId", "is not", null)
        .execute();

      await notifyUnitInvestors(
        unidades
          .filter((u): u is { id: string; investorId: string } => u.investorId !== null)
          .map((u) => ({ unitId: u.id, investorId: u.investorId })),
        {
          category: "document",
          titleKey: "notifications.evidence.uploaded",
          params: { stageName: stage.name }
        }
      );

      // Una entrada por evidencia, con el bundle en la metadata: el lote no
      // borra la granularidad del audit log.
      for (const g of guardados) {
        await writeAuditLog({
          actorUserId: req.user!.id,
          action: "UPLOAD_STAGE_EVIDENCE",
          entityType: "Evidence",
          entityId: g.id,
          metadata: { bundleId: bundle.id, merkleRoot, txid: anchor.txid }
        });
      }

      // M1-D2c: "Pending → InProgress : work initiated". La primera evidencia
      // que un developer sube a un stage Pending ES la señal de que el trabajo
      // arrancó — no hace falta un botón aparte (ver CLAUDE.md raíz).
      // `Observed → InProgress` no se dispara acá a propósito, es una acción
      // explícita aparte. Una vez por lote.
      if (stage.state === "Pending") {
        await transitionStage({
          stageId: stage.id,
          to: "InProgress",
          actorUserId: req.user!.id,
          auditAction: "STAGE_WORK_INITIATED"
        });
      }

      return res.status(201).json(
        stageEvidenceUploadResultSchema.parse({
          evidences,
          rejected: rechazados,
          bundleId: bundle.id,
          merkleRoot: bundle.commitmentHash,
          anchor
        })
      );
    } catch (err) {
      return next(err);
    } finally {
      // Sin filas confirmadas: nada de lo subido tiene que sobrevivir, ni el
      // temporal ni el objeto en R2. Con filas confirmadas y driver `s3`, el
      // temporal ya cumplió (el archivo vive en R2); con `disk` el "temporal"
      // ES el almacenamiento y no se toca.
      for (const f of archivos) {
        if ((!confirmado || storage.driver === "s3") && fs.existsSync(f.path))
          fs.unlinkSync(f.path);
      }
      if (!confirmado) {
        for (const ref of subidos) {
          await storage.remove(ref).catch((e) => console.error("[upload] no se pudo limpiar", e));
        }
      }
    }
  }
);

export default router;
