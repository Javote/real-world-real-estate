// SPEC-218 — las reglas de la subida de evidencia, UNA sola vez.
//
// **Este módulo NO importa nada, y es a propósito.** `apps/web` no carga Zod en
// runtime (solo usa tipos de `packages/shared`), y `shared` se compila a CommonJS:
// un `import` de valores desde el índice arrastraría TODO —Zod y los 30 archivos
// de schemas— al bundle del front, que no se puede tree-shakear. Las reglas que el
// front SÍ necesita como valores (tipos permitidos, topes, detección por magic
// bytes, códigos de rechazo) viven acá, sin dependencias, y se importan por su
// propia entrada: `@plataforma/shared/evidence-rules`. Los schemas Zod que las
// usan están en `evidence-files.ts`.
//
// Antes las reglas estaban escritas en dos lugares que ya divergían:
// `TIPOS_ACEPTADOS` en `FileDropzone.tsx` contra `allowedMimeTypes` en
// `upload.ts`, y el tamaño como `MAX_FILE_SIZE_MB` (variable de entorno del
// backend) contra un `50` a mano en el front, dos veces, con un comentario que
// decía "tiene que coincidir". Un valor que "tiene que coincidir" en dos archivos
// es un bug esperando: acá vive una vez y los dos lados lo importan (D-012).
//
// Regla 10 (CLAUDE.md raíz): solo `application/pdf`, `image/jpeg`,
// `image/png`; máximo `EVIDENCE_MAX_FILE_MB`.

export const EVIDENCE_ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"] as const;
export type EvidenceMime = (typeof EVIDENCE_ALLOWED_MIME)[number];

/** Tope de archivos por pedido (decisión del dueño, 2026-09-20). */
export const EVIDENCE_MAX_FILES = 10;

/**
 * Tope de tamaño por archivo. Antes era `MAX_FILE_SIZE_MB` (env): sube de 10
 * a 50 el 2026-09-10 y el front nunca se enteraba salvo por un comentario.
 */
export const EVIDENCE_MAX_FILE_MB = 50;
export const EVIDENCE_MAX_FILE_BYTES = EVIDENCE_MAX_FILE_MB * 1024 * 1024;

/** Cuántos bytes del comienzo alcanzan para reconocer los tres formatos (la firma PNG es la más larga). */
export const EVIDENCE_SIGNATURE_BYTES = 8;

const FIRMAS: readonly { mime: EvidenceMime; bytes: readonly number[] }[] = [
  // `%PDF-`
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  // JPEG: SOI + el primer marcador
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  // PNG: la firma completa de 8 bytes
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }
];

/**
 * El tipo REAL de un archivo, mirando sus primeros bytes — no el
 * `Content-Type` que declara quien lo manda, que un ejecutable renombrado
 * falsifica gratis. **Función pura: una implementación, dos usos** — el front
 * la usa para avisar en el momento, el backend para decidir.
 *
 * Devuelve `null` si no es ninguno de los tres formatos permitidos (o si vinieron
 * menos bytes de los que la firma necesita). No valida que el archivo esté
 * bien formado: solo que empiece como lo que dice ser.
 */
export function detectarTipoDeEvidencia(bytes: ArrayLike<number>): EvidenceMime | null {
  for (const { mime, bytes: firma } of FIRMAS) {
    if (bytes.length >= firma.length && firma.every((b, i) => bytes[i] === b)) return mime;
  }
  return null;
}

/**
 * Por qué un archivo de un lote NO se aceptó. Son claves, no copy (regla 15):
 * el front las traduce. El resto del lote sigue (SPEC-218): un rechazo por
 * archivo no tumba a los demás.
 */
export const EVIDENCE_REJECTION_CODES = [
  "UNSUPPORTED_FILE_TYPE",
  "DUPLICATE_FILE_IN_BATCH",
  "EVIDENCE_ALREADY_IN_STAGE"
] as const;
export type EvidenceRejectionCode = (typeof EVIDENCE_REJECTION_CODES)[number];
