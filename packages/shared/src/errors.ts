// Sin dependencias: el front lo importa como valor por `@plataforma/shared/errors`.

/**
 * Los códigos de error que la API manda hoy, cada uno con su status y la clave del diccionario que la
 * web muestra (SPEC-613). Es inventario, no diseño: ninguno es nuevo, y `apps/api/test/error-codes.test.ts`
 * lo cruza contra el código. Donde el diccionario no tiene una clave propia, es la que la web ya muestra
 * por status (`claveDeError`).
 */
export const ERROR_CODES = {
  // Los de `ORPCError` con nombre. `FORBIDDEN` e `INTERNAL_SERVER_ERROR` los manda el guard de los
  // procedimientos oRPC (`guard-orpc.ts`), con los mismos status y mensajes que `authorize`.
  BAD_REQUEST: { status: 400, clave: "error.generic" },
  UNAUTHORIZED: { status: 401, clave: "error.generic" },
  FORBIDDEN: { status: 403, clave: "error.forbidden" },
  NOT_FOUND: { status: 404, clave: "error.notFound" },
  CONFLICT: { status: 409, clave: "error.generic" },
  INTERNAL_SERVER_ERROR: { status: 500, clave: "error.generic" },

  // Declarados con `.errors()` en un procedimiento.
  ALREADY_MEMBER: { status: 409, clave: "admin.error.ALREADY_MEMBER" },
  CERTIFIER_NOT_ELIGIBLE: { status: 400, clave: "admin.error.CERTIFIER_NOT_ELIGIBLE" },
  DOSSIER_NOT_REJECTABLE: { status: 409, clave: "error.generic" },
  DOSSIER_NOT_SIGNABLE: { status: 409, clave: "error.generic" },
  DOSSIER_SIGNED: { status: 409, clave: "error.generic" },
  EVIDENCE_ANCHORED: { status: 409, clave: "error.generic" },
  GEOCODER_UNAVAILABLE: { status: 503, clave: "error.generic" },
  INVITATION_ALREADY_PENDING: { status: 409, clave: "admin.error.INVITATION_ALREADY_PENDING" },
  INVITATION_NOT_PENDING: { status: 409, clave: "error.generic" },
  NO_HASH: { status: 400, clave: "error.generic" },
  RELATED_RESOURCE_NOT_FOUND: { status: 400, clave: "error.generic" },
  RESOURCE_ALREADY_EXISTS: { status: 409, clave: "error.generic" },
  STAGE_ALREADY_ADVANCED: { status: 409, clave: "error.generic" },
  STAGE_CREATED_EVENT_NOT_FOUND: { status: 404, clave: "error.notFound" },
  STAGE_EVIDENCE_REQUIRED: { status: 409, clave: "error.generic" },
  STAGE_EVIDENCE_UNATTRIBUTED: { status: 409, clave: "error.generic" },
  STAGE_IDENTITY_IMMUTABLE: { status: 409, clave: "error.generic" },
  STAGE_NOT_CERTIFIED: { status: 409, clave: "error.generic" },
  STAGE_TRANSITION_FORBIDDEN: { status: 403, clave: "error.forbidden" },
  STAGE_TRANSITION_INVALID: { status: 409, clave: "error.generic" },
  THREAD_ALREADY_ON_CHAIN: { status: 409, clave: "error.generic" },
  THREAD_ALREADY_OPEN: { status: 409, clave: "error.generic" },
  UNIT_NOT_AVAILABLE: { status: 409, clave: "error.generic" },

  // Los que devuelve el dominio (`TransitionFailure`) sin pasar por `.errors()`.
  STAGE_NOT_FOUND: { status: 404, clave: "error.notFound" },

  // Los que responde Express: la subida multipart y su límite de Multer.
  STAGE_ALREADY_COMPLETED: { status: 409, clave: "error.generic" },
  NO_FILES_ACCEPTED: { status: 400, clave: "error.generic" },
  UNSUPPORTED_FILE_TYPE: {
    status: 400,
    clave: "developer.upload.serverRejected.UNSUPPORTED_FILE_TYPE"
  },
  LIMIT_FILE_SIZE: { status: 400, clave: "error.generic" }
} as const satisfies Record<string, { readonly status: number; readonly clave: string }>;

export type ErrorCode = keyof typeof ERROR_CODES;

export const esErrorCode = (codigo: unknown): codigo is ErrorCode =>
  typeof codigo === "string" && Object.hasOwn(ERROR_CODES, codigo);
