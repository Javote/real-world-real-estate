// Fuera de una mutación que la invalide, una query no se vuelve a pedir al montar hasta que pasa
// este tiempo.
export const FRESCO_MS = 30_000

// Lo que muestra un anclaje (TXID, `anchorStatus`, `Pending`, o una cuenta de anclados) solo se
// reusa dentro de la misma navegación: lo que trajo el hover o el loader le sirve a la pantalla que
// monta enseguida, sin volver a pedirlo, pero la que se abre un rato después lo pide de nuevo, porque
// el estado lo reconcilia la API al leer (D-077). Lo reusado viene del servidor y es como mucho así
// de viejo: a lo sumo dice `Pending` un rato más, nunca afirma una prueba que no tiene (regla 17).
export const ANCLAJE_MS = 10_000
export const CON_ANCLAJE = { staleTime: ANCLAJE_MS } as const
export const SIN_ANCLAJE = { staleTime: FRESCO_MS } as const
