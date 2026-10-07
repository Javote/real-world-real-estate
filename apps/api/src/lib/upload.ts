import fs from "node:fs";
import path from "node:path";
import {
  EVIDENCE_MAX_FILE_BYTES,
  EVIDENCE_MAX_FILES,
  PROJECT_COVER_MAX_FILE_BYTES
} from "@plataforma/shared";
import multer from "multer";
import { createId } from "../db/id.js";
import { entorno } from "../platform/config.js";

const uploadDir = entorno().UPLOAD_DIR ?? path.resolve(import.meta.dirname, "..", "..", "uploads");

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.resolve(uploadDir));
  },
  filename: (_req, _file, cb) => {
    cb(null, createId());
  }
});

export const uploadEvidenceFiles = multer({
  storage,
  limits: {
    fileSize: EVIDENCE_MAX_FILE_BYTES,
    files: EVIDENCE_MAX_FILES
  }
}).array("file", EVIDENCE_MAX_FILES);

export const uploadProjectCoverFile = multer({
  storage,
  limits: {
    fileSize: PROJECT_COVER_MAX_FILE_BYTES,
    files: 1
  }
}).single("file");
