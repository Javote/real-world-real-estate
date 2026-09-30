// `public/sw.js` y `sw-baja.js` no son módulos: el navegador los corre como
// scripts sueltos dentro de un `ServiceWorkerGlobalScope`. Acá se corren tal
// cual, con un scope falso (`self`, `caches`, `fetch`) que registra lo que
// hacen. Quedan fuera del umbral de coverage (que mide `src/`), así que cada
// regla de SPEC-222 tiene su test explícito.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const WEB = join(import.meta.dirname, '..', '..')
const ORIGEN = 'https://propnexus-web.onrender.com'

type Manejador = (evento: Record<string, unknown>) => void

function cacheStorageFalso() {
  const cajas = new Map<string, Map<string, Response>>()
  const clave = (pedido: string | { url: string }) =>
    new URL(typeof pedido === 'string' ? pedido : pedido.url, ORIGEN).href
  const abrir = (nombre: string) => {
    if (!cajas.has(nombre)) cajas.set(nombre, new Map())
    const caja = cajas.get(nombre) as Map<string, Response>
    return {
      add: async (url: string) => {
        caja.set(clave(url), new Response('<html>shell</html>'))
      },
      put: async (pedido: string | { url: string }, respuesta: Response) => {
        caja.set(clave(pedido), respuesta)
      }
    }
  }
  return {
    cajas,
    open: vi.fn(async (nombre: string) => abrir(nombre)),
    keys: vi.fn(async () => [...cajas.keys()]),
    delete: vi.fn(async (nombre: string) => cajas.delete(nombre)),
    match: vi.fn(async (pedido: string | { url: string }) => {
      for (const caja of cajas.values()) {
        const guardada = caja.get(clave(pedido))
        if (guardada) return guardada.clone()
      }
      return undefined
    })
  }
}

function correr(archivo: string) {
  const manejadores = new Map<string, Manejador>()
  const self = {
    location: { origin: ORIGEN },
    addEventListener: (tipo: string, fn: Manejador) => manejadores.set(tipo, fn),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(async () => {}) },
    registration: { unregister: vi.fn(async () => true) }
  }
  const caches = cacheStorageFalso()
  const fetch = vi.fn<(pedido: unknown) => Promise<Response>>()
  const codigo = readFileSync(join(WEB, archivo), 'utf8')
  new Function('self', 'caches', 'fetch', codigo)(self, caches, fetch)

  async function ciclo(tipo: 'install' | 'activate') {
    let espera: Promise<unknown> = Promise.resolve()
    manejadores.get(tipo)?.({ waitUntil: (p: Promise<unknown>) => (espera = p) })
    await espera
  }

  function pedir(ruta: string, opciones: { method?: string; mode?: string } = {}) {
    let respuesta: Promise<Response> | undefined
    manejadores.get('fetch')?.({
      request: {
        url: new URL(ruta, ORIGEN).href,
        method: opciones.method ?? 'GET',
        mode: opciones.mode ?? 'cors'
      },
      respondWith: (p: Promise<Response>) => (respuesta = p)
    })
    return respuesta
  }

  return { self, caches, fetch, ciclo, pedir }
}

const html = (cuerpo: string) =>
  new Response(cuerpo, { headers: { 'content-type': 'text/html; charset=utf-8' } })

describe('public/sw.js', () => {
  it('al instalarse guarda el shell, y no se salta la espera', async () => {
    const sw = correr('public/sw.js')
    await sw.ciclo('install')
    expect(await (await sw.caches.match('/index.html'))?.text()).toBe('<html>shell</html>')
    expect(sw.self.skipWaiting).not.toHaveBeenCalled()
  })

  it('al activarse borra las cachés de versiones viejas y ninguna ajena', async () => {
    const sw = correr('public/sw.js')
    await sw.caches.open('propnexus-v0')
    await sw.caches.open('otra-app')
    await sw.ciclo('install')
    await sw.ciclo('activate')
    expect([...sw.caches.cajas.keys()].sort()).toEqual(['otra-app', 'propnexus-v1'])
    expect(sw.self.clients.claim).toHaveBeenCalled()
  })

  it.each([
    ['la API por el proxy de dev', '/api/v1/projects', {}],
    ['la API en su propio origen', 'https://propnexus-api.onrender.com/api/v1/projects', {}],
    ['una navegación a la API', '/api/v1/projects', { mode: 'navigate' }],
    ['/health', '/health', {}],
    ['otro origen', 'https://preprod.cardanoscan.io/transaction/abc', {}],
    ['un POST', '/assets/index-abc.js', { method: 'POST' }],
    ['un archivo suelto de public/', '/manifest.json', {}]
  ])('%s pasa de largo, sin respondWith', (_caso, ruta, opciones) => {
    const sw = correr('public/sw.js')
    expect(sw.pedir(ruta, opciones)).toBeUndefined()
    expect(sw.fetch).not.toHaveBeenCalled()
  })

  it('una navegación va primero a la red y guarda la respuesta como shell', async () => {
    const sw = correr('public/sw.js')
    sw.fetch.mockResolvedValue(html('<html>nuevo</html>'))
    const respuesta = await sw.pedir('/investor/buy', { mode: 'navigate' })
    expect(await respuesta?.text()).toBe('<html>nuevo</html>')
    expect(await (await sw.caches.match('/index.html'))?.text()).toBe('<html>nuevo</html>')
  })

  it('una navegación que no devuelve HTML no reemplaza al shell', async () => {
    const sw = correr('public/sw.js')
    await sw.ciclo('install')
    sw.fetch.mockResolvedValue(new Response('no', { status: 404 }))
    await sw.pedir('/lo-que-sea', { mode: 'navigate' })
    sw.fetch.mockResolvedValue(
      new Response('{}', { headers: { 'content-type': 'application/json' } })
    )
    await sw.pedir('/otra', { mode: 'navigate' })
    expect(await (await sw.caches.match('/index.html'))?.text()).toBe('<html>shell</html>')
  })

  it('sin red, una navegación devuelve el shell guardado', async () => {
    const sw = correr('public/sw.js')
    await sw.ciclo('install')
    sw.fetch.mockRejectedValue(new TypeError('Failed to fetch'))
    const respuesta = await sw.pedir('/investor/units', { mode: 'navigate' })
    expect(await respuesta?.text()).toBe('<html>shell</html>')
  })

  it('sin red y sin shell guardado, devuelve un error de red', async () => {
    const sw = correr('public/sw.js')
    sw.fetch.mockRejectedValue(new TypeError('Failed to fetch'))
    const respuesta = await sw.pedir('/investor/units', { mode: 'navigate' })
    expect(respuesta?.type).toBe('error')
  })

  it('un asset con hash se busca en la red una vez y después sale de la caché', async () => {
    const sw = correr('public/sw.js')
    sw.fetch.mockResolvedValue(new Response('console.log(1)'))
    expect(await (await sw.pedir('/assets/index-abc123.js'))?.text()).toBe('console.log(1)')
    expect(await (await sw.pedir('/assets/index-abc123.js'))?.text()).toBe('console.log(1)')
    expect(sw.fetch).toHaveBeenCalledTimes(1)
  })

  it('un asset que falla no se guarda', async () => {
    const sw = correr('public/sw.js')
    sw.fetch.mockResolvedValue(new Response('no', { status: 404 }))
    expect((await sw.pedir('/assets/viejo-000.js'))?.status).toBe(404)
    expect(await sw.caches.match('/assets/viejo-000.js')).toBeUndefined()
  })
})

describe('sw-baja.js, el rollback', () => {
  it('no se publica: vive fuera de public/', () => {
    expect(() => readFileSync(join(WEB, 'public', 'sw-baja.js'))).toThrow()
  })

  it('toma el control enseguida, borra las cachés de PropNexus y se desregistra', async () => {
    const sw = correr('sw-baja.js')
    await sw.caches.open('propnexus-v1')
    await sw.caches.open('otra-app')
    await sw.ciclo('install')
    expect(sw.self.skipWaiting).toHaveBeenCalled()
    await sw.ciclo('activate')
    expect([...sw.caches.cajas.keys()]).toEqual(['otra-app'])
    expect(sw.self.registration.unregister).toHaveBeenCalled()
  })

  it('no intercepta ningún pedido', () => {
    const sw = correr('sw-baja.js')
    expect(sw.pedir('/investor/buy', { mode: 'navigate' })).toBeUndefined()
  })
})
