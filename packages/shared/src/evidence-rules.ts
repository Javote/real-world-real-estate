// Este módulo no importa nada: el front lo usa y no carga Zod.
export const EVIDENCE_ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"] as const;
export type EvidenceMime = (typeof EVIDENCE_ALLOWED_MIME)[number];

export const EVIDENCE_MAX_FILES = 10;

export const EVIDENCE_MAX_FILE_MB = 50;
export const EVIDENCE_MAX_FILE_BYTES = EVIDENCE_MAX_FILE_MB * 1024 * 1024;

export const EVIDENCE_SIGNATURE_BYTES = 8;

const FIRMAS: readonly { mime: EvidenceMime; bytes: readonly number[] }[] = [
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }
];

export function detectarTipoDeEvidencia(bytes: ArrayLike<number>): EvidenceMime | null {
  for (const { mime, bytes: firma } of FIRMAS) {
    if (bytes.length >= firma.length && firma.every((b, i) => bytes[i] === b)) return mime;
  }
  return null;
}

export const EVIDENCE_REJECTION_CODES = [
  "UNSUPPORTED_FILE_TYPE",
  "DUPLICATE_FILE_IN_BATCH",
  "EVIDENCE_ALREADY_IN_STAGE"
] as const;
export type EvidenceRejectionCode = (typeof EVIDENCE_REJECTION_CODES)[number];

export const PROJECT_COVER_ALLOWED_MIME = ["image/jpeg", "image/png"] as const;
export type ProjectCoverMime = (typeof PROJECT_COVER_ALLOWED_MIME)[number];

export const PROJECT_COVER_MAX_FILE_MB = 10;
export const PROJECT_COVER_MAX_FILE_BYTES = PROJECT_COVER_MAX_FILE_MB * 1024 * 1024;

export function detectarTipoDePortada(bytes: ArrayLike<number>): ProjectCoverMime | null {
  const real = detectarTipoDeEvidencia(bytes);
  return real === "image/jpeg" || real === "image/png" ? real : null;
}
