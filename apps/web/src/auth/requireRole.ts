import { type QueryClient, queryOptions } from '@tanstack/react-query'
import { redirect } from '@tanstack/react-router'
import { ApiError, api } from '../api/port'
import type { UserRole } from '../api/types'
import { ROLE_LANDING } from './roles'
import { clearSession, getSession, type Session } from './session'

// El rol no cambia dentro de una sesión, y un token revocado lo corta igual la primera request
// de la pantalla (401 → clearSession). Cinco minutos sacan el /auth/me de cada navegación.
const ME_STALE_MS = 5 * 60_000

// El token va en la llave: un login nuevo no lee el `me` del anterior, y después de un 401 no
// hay sesión, así que la próxima navegación no llega a la caché.
export const meQuery = (token: string) =>
  queryOptions({
    queryKey: ['auth', 'me', token],
    queryFn: () => api.me(),
    staleTime: ME_STALE_MS
  })

export function requireRole(allowed: readonly UserRole[]) {
  return async ({
    context
  }: {
    context: { queryClient: QueryClient }
  }): Promise<{ session: Session }> => {
    const session = getSession()
    if (!session) throw redirect({ to: '/login' })

    try {
      await context.queryClient.fetchQuery(meQuery(session.token))
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearSession()
        throw redirect({ to: '/login' })
      }
    }

    const { role } = session.user
    if (role !== 'admin' && !allowed.includes(role)) throw redirect({ to: ROLE_LANDING[role] })

    return { session }
  }
}
