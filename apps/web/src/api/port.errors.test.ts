import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSession, setSession } from '#/auth/session'
import { ApiError, api } from './port'

const USER = { id: 'u', email: 'a@b.c', role: 'developer', fullName: 'Dev' } as const

const respuesta = (cuerpo: BodyInit | null, init: ResponseInit) => new Response(cuerpo, init)

beforeEach(() => {
  clearSession()
})

afterEach(() => {
  vi.unstubAllGlobals()
  clearSession()
})

describe('request: errores y bordes', () => {
  it('sin sesión no manda Authorization', async () => {
    const f = vi.fn(async () => respuesta('{}', { status: 200 }))
    vi.stubGlobal('fetch', f)
    await api.me()
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(new Headers(init.headers).has('Authorization')).toBe(false)
  })

  it('con sesión manda el Bearer', async () => {
    setSession({ token: 'tok', user: USER })
    const f = vi.fn(async () => respuesta('{}', { status: 200 }))
    vi.stubGlobal('fetch', f)
    await api.me()
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok')
  })

  it('un 204 devuelve undefined', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respuesta(null, { status: 204 }))
    )
    await expect(api.removeFavorite('p1')).resolves.toBeUndefined()
  })

  it('un error con body {message} usa el message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respuesta(JSON.stringify({ message: 'mal' }), { status: 400 }))
    )
    await expect(api.me()).rejects.toMatchObject({ status: 400, message: 'mal' })
  })

  it('un error con body sin message usa el body serializado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respuesta(JSON.stringify({ code: 'X' }), { status: 400 }))
    )
    await expect(api.me()).rejects.toMatchObject({ message: '{"code":"X"}' })
  })

  it('un error con body null usa "null" (el body es JSON válido)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respuesta('null', { status: 400 }))
    )
    await expect(api.me()).rejects.toMatchObject({ message: 'null' })
  })

  it('un error con cuerpo que no es JSON queda con statusText', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respuesta('<html>', { status: 502, statusText: 'Bad Gateway' }))
    )
    await expect(api.me()).rejects.toMatchObject({ status: 502, message: 'Bad Gateway' })
  })

  it('un 401 borra la sesión', async () => {
    setSession({ token: 'tok', user: USER })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respuesta('{}', { status: 401 }))
    )
    await expect(api.me()).rejects.toBeInstanceOf(ApiError)
    expect(window.sessionStorage.getItem('proptrust.session')).toBeNull()
  })
})

describe('requestBlob: descarga', () => {
  it('devuelve el blob, con y sin sesión', async () => {
    const f = vi.fn(async () => respuesta('abc', { status: 200 }))
    vi.stubGlobal('fetch', f)
    expect(await (await api.downloadEvidence('e1')).text()).toBe('abc')
    setSession({ token: 'tok', user: USER })
    await api.downloadEvidence('e1')
    const init = (f.mock.calls[1] as unknown as [string, RequestInit])[1]
    expect(init.headers).toEqual({ Authorization: 'Bearer tok' })
  })

  it('un error tira ApiError, y un 401 borra la sesión', async () => {
    setSession({ token: 'tok', user: USER })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => respuesta('x', { status: 401, statusText: 'Unauthorized' }))
    )
    await expect(api.downloadEvidence('e1')).rejects.toMatchObject({
      status: 401,
      message: 'Unauthorized'
    })
    expect(window.sessionStorage.getItem('proptrust.session')).toBeNull()
  })
})
