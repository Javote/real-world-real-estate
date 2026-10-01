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

      try {
        await api.me()
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          clearSession()
          if (!cancelled) void navigate({ to: '/login' })
          return
        }
      }

      if (cancelled) return

      if (local.user.role !== 'admin' && !allowedRoles.includes(local.user.role)) {
        void navigate({ to: ROLE_LANDING[local.user.role] })
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
