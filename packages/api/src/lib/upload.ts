import fs from "fs";
import path from "path";
import multer from "multer";

const uploadDir = process.env.UPLOAD_DIR || "./uploads";
const maxFileSizeMb = Number(process.env.MAX_FILE_SIZE_MB || 10);

fs.mkdirSync(uploadDir, { recursive: true });

const allowedMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png"
];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.resolve(uploadDir));
  },
  filename: (_req, file, cb) => {
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const uniqueName = `${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}-${safeOriginal}`;
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
      cb(
        new Error(
          "Unsupported file type. Only PDF, JPG/JPEG, and PNG are allowed."
        )
      );
      return;
    }

    cb(null, true);
  }
}).single("file");
