// Fuera de una mutación que la invalide, una query no se vuelve a pedir al montar hasta que pasa
// este tiempo.
export const FRESCO_MS = 30_000

// Lo que muestra un anclaje (TXID, `anchorStatus`, `Pending`, o una cuenta de anclados) se pide
// siempre al montar: el estado lo reconcilia la API al leer (D-077) y una caché fresca podría
// mostrar una prueba que ya cambió (regla 17).
export const CON_ANCLAJE = { staleTime: 0 } as const
export const SIN_ANCLAJE = { staleTime: FRESCO_MS } as const
