import { type ClientContext, createORPCClient, type NestedClient } from '@orpc/client'
import { OpenAPILink } from '@orpc/openapi-client/fetch'
import type { ApiClient } from '@plataforma/shared/contract'
import contratoMinificado from '@plataforma/shared/contract.min.json'
import { API_BASE, fetchConSesion } from './transporte'

type ContratoMinificado = ConstructorParameters<typeof OpenAPILink>[0]

/**
 * El cliente que sale del contrato (SPEC-609): el link arma verbo, path y cuerpo desde el contrato
 * minificado, sin Zod, y sale por el mismo `fetchConSesion` que `request()`. Un método de `port.ts`
 * migrado llama a `cliente`; la fachada no cambia de forma.
 */
export function crearCliente<T extends NestedClient<ClientContext>>(contrato: object): T {
  // Un JSON importado no conserva los tipos del contrato (`method` llega como `string`): los tipos
  // del cliente los da `T`, y el JSON solo aporta las rutas.
  const link = new OpenAPILink(contrato as ContratoMinificado, {
    url: () => `${API_BASE || window.location.origin}/api/v1`,
    fetch: (request, init) => fetchConSesion(request, init)
  })
  return createORPCClient<T>(link)
}

export const cliente = crearCliente<ApiClient>(contratoMinificado)
