// Segunda capa de autorización del front (regla 5 / invariante 1 de
// SPEC-011): cada landing de rol valida contra el grupo de M2-D1, no solo
// contra "hay sesión". Nadie con rol developer aterriza en /certifier
// cambiando la URL a mano.

import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ApiError, api } from '../api/port'
import type { UserRole } from '../api/types'
import { ROLE_LANDING } from './roles'
import { clearSession, getSession, type Session } from './session'

export function useRoleGuard(allowedRoles: readonly UserRole[]) {
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function check() {
      const local = getSession()
      if (!local) {
        void navigate({ to: '/login' })
        return
      }

      // Valida el token contra el servidor (invariante 12): un token
      // corrupto/expirado en sessionStorage no debe dejar pasar solo porque
      // el objeto de sesión sigue ahí.
      try {
        await api.me()
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          clearSession()
          if (!cancelled) void navigate({ to: '/login' })
          return
        }
        // Error de red: no desloguea por una falla transitoria de conexión,
        // deja pasar con la sesión local ya validada en logins anteriores.
      }

      if (cancelled) return

      if (!allowedRoles.includes(local.user.role)) {
        const ownLanding = ROLE_LANDING[local.user.role]
        void navigate({ to: ownLanding ?? '/login' })
        return
      }

      setSession(local)
      setReady(true)
    }

    void check()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, allowedRoles.includes])

  return { session, ready }
}
