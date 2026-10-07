import { clearSession, getSession } from '../auth/session'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown
  ) {
    super(message)
  }
}

export const API_BASE = import.meta.env.VITE_API_ORIGIN ?? ''

/**
 * El `fetch` con sesión del front: pone el Bearer, borra la sesión ante un 401 y convierte toda
 * respuesta que no es 2xx en `ApiError`. Lo usan `request()` y el link del cliente del contrato.
 */
export async function fetchConSesion(
  entrada: string | Request,
  init: RequestInit = {}
): Promise<Response> {
  const session = getSession()
  const headers = new Headers(
    init.headers ?? (entrada instanceof Request ? entrada.headers : undefined)
  )
  if (session) headers.set('Authorization', `Bearer ${session.token}`)

  const res = await fetch(entrada, { ...init, headers })

  if (res.status === 401) clearSession()
  if (!res.ok) {
    let message = res.statusText
    let cuerpo: unknown
    try {
      const body = await res.json()
      cuerpo = body
      message = body?.message ?? JSON.stringify(body)
    } catch {}
    throw new ApiError(res.status, message, cuerpo)
  }
  return res
}
