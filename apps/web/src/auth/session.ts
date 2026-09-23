// Sesión en sessionStorage. Invariante: nada de tokens
// hardcodeados en el bundle; el token siempre sale del login real).

import type { SessionUser } from '../api/types'

export interface Session {
  token: string
  user: SessionUser
}

const KEY = 'proptrust.session'

export function getSession(): Session | null {
  try {
    const raw = window.sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function setSession(session: Session): void {
  window.sessionStorage.setItem(KEY, JSON.stringify(session))
}

export function clearSession(): void {
  window.sessionStorage.removeItem(KEY)
}
