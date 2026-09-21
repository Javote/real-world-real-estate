import fs from "node:fs";
import path from "node:path";
import { EVIDENCE_MAX_FILE_BYTES, EVIDENCE_MAX_FILES } from "@plataforma/shared";
import multer from "multer";
import { createId } from "../db/id";

// Anclado al package, NO al cwd. Con `"./uploads"` a secas, dónde caían los
// archivos dependía de desde dónde se arrancara el proceso: correr la API desde
// la raíz del repo creaba un `uploads/` suelto ahí. En el deploy no se nota
// —`render.yaml` setea `UPLOAD_DIR` explícito— pero en local es una trampa.
const uploadDir = process.env.UPLOAD_DIR || path.resolve(__dirname, "..", "..", "uploads");

fs.mkdirSync(uploadDir, { recursive: true });

// SPEC-218: el nombre en disco es OPACO. Antes llevaba el nombre original
// saneado (`<ts>-<rnd>-<nombre>`) y de ahí salía la clave del objeto en R2 y
// `Evidence.storedFilename`: la regla 2 pide refs opacas, y un nombre de
// archivo del usuario no lo es. El nombre original sigue guardándose donde
// corresponde (`Evidence.originalFilename`, que nunca sale a un log ni a la
// cadena).
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.resolve(uploadDir));
  },
  filename: (_req, _file, cb) => {
    cb(null, createId());
  }
});

// **Sin `fileFilter`, a propósito.** Un `fileFilter` que rechaza corta TODO el
// pedido (Multer no puede seguir parseando), y desde SPEC-218 un tipo no
// permitido es un rechazo POR ARCHIVO —el resto del lote entra—. Tampoco
// serviría de barrera: mira el `Content-Type` que declara el cliente, que un
// ejecutable renombrado falsifica gratis. El tipo real se decide después, por
// los primeros bytes (`detectarTipoDeEvidencia`, `packages/shared`), en el
// handler.
//
// El tope de tamaño y de cantidad SÍ son del pedido entero (Multer corta el
// stream): vienen de `packages/shared`, una sola vez para los dos lados.
export const uploadEvidenceFiles = multer({
  storage,
  limits: {
    fileSize: EVIDENCE_MAX_FILE_BYTES,
    files: EVIDENCE_MAX_FILES
  }
}).array("file", EVIDENCE_MAX_FILES);
