import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { getSession } from '../auth/session'
import { ROLE_LANDING } from '../auth/roles'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const navigate = useNavigate()

  useEffect(() => {
    const session = getSession()
    const landing = session ? (ROLE_LANDING[session.user.role] ?? '/login') : '/login'
    void navigate({ to: landing })
  }, [navigate])

  return null
}
