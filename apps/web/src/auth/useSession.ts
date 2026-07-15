import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { getSession, type Session } from './session'

// La sesión vive en sessionStorage → solo existe en el cliente. Las rutas
// privadas renderizan null hasta montar para no desincronizar la hidratación SSR.
export function useRequireSession() {
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const s = getSession()
    if (!s) {
      void navigate({ to: '/login' })
    } else {
      setSession(s)
    }
    setReady(true)
  }, [navigate])

  return { session, ready }
}
