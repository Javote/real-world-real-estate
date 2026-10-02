import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { completarServiceWorker } from './swPrecache'

const SW = readFileSync(join(import.meta.dirname, '..', '..', 'public', 'sw.js'), 'utf8')

const BUNDLE = [
  'index.html',
  'assets/vendor-react-b2.js',
  'assets/index-a1.js',
  'assets/index-c3.css'
]

const version = (fuente: string) => fuente.match(/const VERSION = '([^']*)'/)?.[1]
const precache = (fuente: string) =>
  JSON.parse(fuente.match(/const PRECACHE = (\[.*\])/)?.[1] ?? 'null') as string[] | null

describe('completarServiceWorker', () => {
  it('escribe en el sw.js real la lista de /assets/, ordenada y sin index.html', () => {
    expect(precache(completarServiceWorker(SW, BUNDLE))).toEqual([
      '/assets/index-a1.js',
      '/assets/index-c3.css',
      '/assets/vendor-react-b2.js'
    ])
  })

  it('la versión depende de los archivos y no de su orden', () => {
    const una = version(completarServiceWorker(SW, BUNDLE))
    expect(una).toMatch(/^[0-9a-f]{8}$/)
    expect(version(completarServiceWorker(SW, [...BUNDLE].reverse()))).toBe(una)
    expect(version(completarServiceWorker(SW, [...BUNDLE, 'assets/nuevo-d4.js']))).not.toBe(una)
  })

  it('el resultado sigue siendo un script válido', () => {
    expect(() => new Function(completarServiceWorker(SW, BUNDLE))).not.toThrow()
  })

  it('si sw.js perdió una de las dos líneas, el build falla en vez de publicar un worker sin lista', () => {
    expect(() => completarServiceWorker(SW.replace("const VERSION = 'dev'", ''), BUNDLE)).toThrow(
      /VERSION/
    )
    expect(() => completarServiceWorker(`${SW}\nconst PRECACHE = []`, BUNDLE)).toThrow(/PRECACHE/)
  })
})
