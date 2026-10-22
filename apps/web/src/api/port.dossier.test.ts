import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './port'

interface Pedido {
  metodo: string
  ruta: string
  cuerpo: string
}

let pedidos: Pedido[] = []

function responder(cuerpo: unknown, status = 200) {
  pedidos = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: Request) => {
      const url = new URL(entrada.url)
      pedidos.push({
        metodo: entrada.method,
        ruta: url.pathname + url.search,
        cuerpo: await entrada.text()
      })
      return new Response(JSON.stringify(cuerpo), {
        status,
        headers: { 'Content-Type': 'application/json' }
      })
    })
  )
}

// Los métodos del dossier van por el cliente del contrato (SPEC-609): las requests son las mismas
// que armaba `request()` a mano, salvo el `{}` que mandaban `share` y `sign`, que ahora van sin cuerpo.
describe('el dossier por el cliente del contrato: mismo verbo, path y cuerpo', () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each<[string, () => Promise<unknown>, Pedido]>([
    [
      'getNotaryKpis',
      () => api.getNotaryKpis(),
      { metodo: 'GET', ruta: '/api/v1/notary/kpis', cuerpo: '' }
    ],
    [
      'getNotaryPendingDossiers',
      () => api.getNotaryPendingDossiers(),
      { metodo: 'GET', ruta: '/api/v1/notary/dossiers/pending', cuerpo: '' }
    ],
    [
      'getDossier',
      () => api.getDossier('d1'),
      { metodo: 'GET', ruta: '/api/v1/notary/dossiers/d1', cuerpo: '' }
    ],
    [
      'rejectDossier',
      () => api.rejectDossier('d1', 'falta el plano'),
      {
        metodo: 'POST',
        ruta: '/api/v1/notary/dossiers/d1/reject',
        cuerpo: '{"note":"falta el plano"}'
      }
    ],
    [
      'listSignatures',
      () => api.listSignatures(),
      { metodo: 'GET', ruta: '/api/v1/notary/signatures', cuerpo: '' }
    ],
    [
      'listSignatures con cursor',
      () => api.listSignatures('k1'),
      { metodo: 'GET', ruta: '/api/v1/notary/signatures?cursor=k1', cuerpo: '' }
    ],
    [
      'getUnitDossier',
      () => api.getUnitDossier('u1'),
      { metodo: 'GET', ruta: '/api/v1/investor/units/u1/dossier', cuerpo: '' }
    ],
    [
      'shareUnitDossier',
      () => api.shareUnitDossier('u1'),
      { metodo: 'POST', ruta: '/api/v1/investor/units/u1/dossier/share', cuerpo: '' }
    ],
    [
      'getPublicDossier',
      () => api.getPublicDossier('tok'),
      { metodo: 'GET', ruta: '/api/v1/public/dossier/tok', cuerpo: '' }
    ]
  ])('%s', async (_nombre, llamar, esperado) => {
    responder({})
    await llamar()
    expect(pedidos).toEqual([esperado])
  })

  it('signDossier devuelve el cuerpo de la respuesta, no el status que la acompaña', async () => {
    const firma = { dossierId: 'd1', masterHash: 'a'.repeat(64) }
    responder(firma, 201)

    await expect(api.signDossier('d1')).resolves.toEqual(firma)
    expect(pedidos).toEqual([
      { metodo: 'POST', ruta: '/api/v1/notary/dossiers/d1/sign', cuerpo: '' }
    ])
  })
})
