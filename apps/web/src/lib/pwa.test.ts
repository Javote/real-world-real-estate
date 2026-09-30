import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as Sentry from '@sentry/react'
import { describe, expect, it, vi } from 'vitest'
import { registrarServiceWorker } from './pwa'

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }))

const WEB = join(import.meta.dirname, '..', '..')

function contenedorFalso(register: () => Promise<unknown>) {
  return { register: vi.fn(register) } as unknown as ServiceWorkerContainer & {
    register: ReturnType<typeof vi.fn>
  }
}

describe('registrarServiceWorker', () => {
  it('en producción registra /sw.js cuando la página termina de cargar', () => {
    const contenedor = contenedorFalso(async () => ({}))
    registrarServiceWorker(true, contenedor)
    expect(contenedor.register).not.toHaveBeenCalled()

    window.dispatchEvent(new Event('load'))
    expect(contenedor.register).toHaveBeenCalledWith('/sw.js')
  })

  it('fuera de producción no registra nada', () => {
    const contenedor = contenedorFalso(async () => ({}))
    registrarServiceWorker(false, contenedor)
    window.dispatchEvent(new Event('load'))
    expect(contenedor.register).not.toHaveBeenCalled()
  })

  it('sin soporte de service worker (contexto no seguro) no hace nada', () => {
    expect(() => registrarServiceWorker(true, undefined)).not.toThrow()
  })

  it('un registro que falla se reporta a Sentry y no tira', async () => {
    const error = new Error('no se pudo registrar')
    const contenedor = contenedorFalso(() => Promise.reject(error))
    registrarServiceWorker(true, contenedor)
    window.dispatchEvent(new Event('load'))
    await vi.waitFor(() => expect(Sentry.captureException).toHaveBeenCalledWith(error))
  })
})

// Lo que hace instalable a la app no es código de `src/`: son archivos de
// `public/` e `index.html`. Estos tests fijan que estén y que se correspondan.
describe('los archivos de la PWA', () => {
  const manifest = JSON.parse(readFileSync(join(WEB, 'public', 'manifest.json'), 'utf8')) as {
    name: string
    start_url: string
    display: string
    theme_color: string
    icons: { src: string; sizes: string; purpose: string }[]
  }

  it('index.html linkea el manifest y los íconos', () => {
    const html = readFileSync(join(WEB, 'index.html'), 'utf8')
    expect(html).toContain('<link rel="manifest" href="/manifest.json" />')
    expect(html).toContain('href="/icons/icon.svg"')
    expect(html).toContain('href="/icons/apple-touch-icon.png"')
  })

  it('el manifest es el de PropNexus, no el del boilerplate', () => {
    expect(manifest.name).toBe('PropNexus')
    expect(manifest.start_url).toBe('/')
    expect(manifest.display).toBe('standalone')
  })

  it('theme_color es --color-primary de styles.css', () => {
    const css = readFileSync(join(WEB, 'src', 'styles.css'), 'utf8')
    const primary = /--color-primary:\s*(#[0-9a-f]{6})/i.exec(css)?.[1]
    expect(manifest.theme_color.toLowerCase()).toBe(primary?.toLowerCase())
  })

  it('cada ícono existe y mide lo que el manifest declara', () => {
    const conPropositos = new Set(manifest.icons.map((i) => i.purpose))
    expect(conPropositos).toEqual(new Set(['any', 'maskable']))

    for (const icono of manifest.icons) {
      const png = readFileSync(join(WEB, 'public', icono.src))
      // Cabecera IHDR de un PNG: ancho y alto en los bytes 16-23.
      const lado = `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`
      expect(lado).toBe(icono.sizes)
    }
  })
})
