import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { getSession } from '../auth/session'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const navigate = useNavigate()

  useEffect(() => {
    void navigate({ to: getSession() ? '/dashboard' : '/login' })
  }, [navigate])

  return null
}
