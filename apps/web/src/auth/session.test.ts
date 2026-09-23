import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearSession, getSession, setSession } from './session'

const USER = { id: 'u', email: 'a@b.c', role: 'developer', fullName: 'Dev' } as const

afterEach(() => {
  vi.restoreAllMocks()
  window.sessionStorage.clear()
})

describe('sesión', () => {
  it('guarda, lee y borra', () => {
    setSession({ token: 't', user: USER })
    expect(getSession()?.token).toBe('t')
    clearSession()
    expect(getSession()).toBeNull()
  })

  it('un valor guardado que no es JSON se lee como sin sesión', () => {
    window.sessionStorage.setItem('proptrust.session', '{roto')
    expect(getSession()).toBeNull()
  })

  it('un storage que tira se lee como sin sesión', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    expect(getSession()).toBeNull()
  })
})
