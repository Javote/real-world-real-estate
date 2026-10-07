import type { Client } from '@orpc/client'
import type { ClienteCable } from '@plataforma/shared/contract'
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { clearSession, getSession, setSession } from '#/auth/session'

// La forma que deja `minifyContractRouter`: lo que el link recibe en runtime (contract.min.json).
const CONTRATO = {
  notary: {
    kpis: { '~orpc': { errorMap: {}, meta: {}, route: { method: 'GET', path: '/notary/kpis' } } },
    firmar: {
      '~orpc': {
        errorMap: {},
        meta: {},
        route: { method: 'POST', path: '/notary/dossiers/{dossierId}/sign' }
      }
    }
  }
}

type SinContexto = Record<never, never>
type Cliente = ClienteCable<{
  notary: {
    kpis: Client<SinContexto, undefined, { firmados: number; at: Date }, Error>
    firmar: Client<SinContexto, { dossierId: string }, { dossierId: string }, Error>
  }
}>

const USER = { id: 'u', email: 'a@b.c', role: 'notary', fullName: 'Not' } as const

interface Pedido {
  url: URL
  metodo: string
  headers: Headers
}

let pedidos: Pedido[] = []

function responder(cuerpo: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: Request, init: RequestInit = {}) => {
      pedidos.push({
        url: new URL(entrada.url),
        metodo: entrada.method,
        headers: new Headers(init.headers)
      })
      return new Response(JSON.stringify(cuerpo), {
        status,
        headers: { 'Content-Type': 'application/json' }
      })
    })
  )
}

// `resetModules` relee `VITE_API_ORIGIN`, y con él `ApiError` es otra clase: se toma de la misma carga.
async function clienteDePrueba() {
  vi.resetModules()
  const { crearCliente } = await import('./cliente')
  const { ApiError } = await import('./transporte')
  return { cliente: crearCliente<Cliente>(CONTRATO), ApiError }
}

beforeEach(() => {
  pedidos = []
  clearSession()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  clearSession()
})

describe('el cliente del contrato', () => {
  it('pide el path REST de la ruta bajo /api/v1, en el mismo origen si no hay VITE_API_ORIGIN', async () => {
    responder({ firmados: 3, at: '2026-10-07T12:00:00.000Z' })
    const { cliente } = await clienteDePrueba()

    const kpis = await cliente.notary.kpis()

    expect(pedidos).toHaveLength(1)
    expect(pedidos[0]?.metodo).toBe('GET')
    expect(pedidos[0]?.url.origin).toBe(window.location.origin)
    expect(pedidos[0]?.url.pathname).toBe('/api/v1/notary/kpis')
    expect(kpis).toEqual({ firmados: 3, at: '2026-10-07T12:00:00.000Z' })
  })

  it('con VITE_API_ORIGIN va a ese origen, y los params del input van al path', async () => {
    vi.stubEnv('VITE_API_ORIGIN', 'https://api.cliente-test.example')
    responder({ dossierId: 'd1' })
    const { cliente } = await clienteDePrueba()

    await cliente.notary.firmar({ dossierId: 'd1' })

    expect(pedidos[0]?.metodo).toBe('POST')
    expect(pedidos[0]?.url.href).toBe(
      'https://api.cliente-test.example/api/v1/notary/dossiers/d1/sign'
    )
  })

  it('sale por fetchConSesion: con sesión manda el Bearer', async () => {
    setSession({ token: 'tok', user: USER })
    responder({ firmados: 0, at: '2026-10-07T12:00:00.000Z' })
    const { cliente } = await clienteDePrueba()

    await cliente.notary.kpis()

    expect(pedidos[0]?.headers.get('Authorization')).toBe('Bearer tok')
  })

  it('un 401 borra la sesión y llega como ApiError', async () => {
    setSession({ token: 'vencido', user: USER })
    responder({ message: 'Missing or invalid token' }, 401)
    const { cliente, ApiError } = await clienteDePrueba()

    const error = await cliente.notary.kpis().catch((e: unknown) => e)

    expect(getSession()).toBeNull()
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401, message: 'Missing or invalid token' })
  })

  it('un error de la API llega como el ApiError de siempre, con status y body', async () => {
    const cuerpo = { code: 'NOT_FOUND', status: 404, message: 'Dossier not found' }
    responder(cuerpo, 404)
    const { cliente, ApiError } = await clienteDePrueba()

    const error = await cliente.notary.firmar({ dossierId: 'd9' }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, message: 'Dossier not found', body: cuerpo })
  })

  it('el tipo no miente sobre el cable: una fecha del output es string', () => {
    type Kpis = Awaited<ReturnType<Cliente['notary']['kpis']>>
    expectTypeOf<Kpis>().toEqualTypeOf<{ firmados: number; at: string }>()
    const llega = { firmados: 1, at: '2026-10-07T12:00:00.000Z' } satisfies Kpis
    // @ts-expect-error — el cliente no revive fechas: tiparla como Date mentiría (SPEC-609)
    const fecha: Date = llega.at
    void fecha
  })

  it('el cliente de la app sale del contrato commiteado', async () => {
    vi.resetModules()
    const { cliente } = await import('./cliente')
    expect(cliente).toBeDefined()
  })
})
