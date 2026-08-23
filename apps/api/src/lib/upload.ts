import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { HttpError } from "./http-error";

// Anclado al package, NO al cwd. Con `"./uploads"` a secas, dónde caían los
// archivos dependía de desde dónde se arrancara el proceso: correr la API desde
// la raíz del repo creaba un `uploads/` suelto ahí. En el deploy no se nota
// —`render.yaml` setea `UPLOAD_DIR` explícito— pero en local es una trampa.
const uploadDir = process.env.UPLOAD_DIR || path.resolve(__dirname, "..", "..", "uploads");
const maxFileSizeMb = Number(process.env.MAX_FILE_SIZE_MB || 10);

fs.mkdirSync(uploadDir, { recursive: true });

const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png"];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.resolve(uploadDir));
  },
  filename: (_req, file, cb) => {
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeOriginal}`;
    cb(null, uniqueName);
  }
});

export const uploadSingleEvidence = multer({
  storage,
  limits: {
    fileSize: maxFileSizeMb * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      // `HttpError` y no `Error` pelado: es un mensaje que escribimos para quien
      // sube el archivo, así que el errorHandler puede mostrarlo sin filtrar nada.
      cb(new HttpError(400, "Unsupported file type. Only PDF, JPG/JPEG, and PNG are allowed."));
      return;
    }

    cb(null, true);
  }
}).single("file");
