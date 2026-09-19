// SPEC-108 (F-15) — el shell de card se repetía escrito a mano en 63 sitios,
// y ya divergió una vez: alguien escribió `rounded-lg p-s3` donde el resto
// usa `rounded-xl p-s4` (`ReleaseProofList`, `DocumentCard`, `AuditEventCard`,
// `BuildingSchematic`, la fila del dossier público) — mirado contra M2-D2, es
// un caso legítimo de card **densa** dentro de una lista, no deriva, y por
// eso es la tercera constante y no una que haya que alinear.
//
// Sin componente nuevo: no hay nada que proponerle a M2-D3, solo texto que no
// se puede volver a escribir distinto por accidente.

/** La card estándar: `article`/`div` de contenido, la que más se repite. */
export const CARD_SHELL = 'rounded-xl bg-card p-s4 shadow-e1'

/** El empty-state dentro de una card estándar. */
export const CARD_SHELL_EMPTY = 'rounded-xl bg-card p-s4 text-body-sm text-text-muted shadow-e1'

/** La card densa: filas de lista (`DocumentCard`, `AuditEventCard`, …). */
export const CARD_SHELL_DENSE = 'rounded-lg bg-card p-s3 shadow-e1'
