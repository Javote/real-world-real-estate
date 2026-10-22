import { notFound } from '@tanstack/react-router'
import { ApiError } from '#/api/port'

// Lo que usa el archivo de una ruta con Suspense fuera de sus componentes: lo que importa queda en
// el JS inicial, así que no trae ninguno.
export const PENDING_MS = 150

/** En un loader, un 404 de la API es la ruta que no existe: lo dibuja su `notFoundComponent`. */
export async function oNoEncontrado<T>(pedido: Promise<T>): Promise<T> {
  try {
    return await pedido
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) throw notFound()
    throw err
  }
}
