import path from 'node:path'
import { build, type Rolldown } from 'vite'
import { describe, expect, it } from 'vitest'

async function modulosDelBundle(entrada: string): Promise<string[]> {
  const salida = (await build({
    configFile: false,
    root: path.resolve(import.meta.dirname, '../..'),
    logLevel: 'silent',
    build: {
      write: false,
      lib: { entry: path.resolve(import.meta.dirname, entrada), formats: ['es'] }
    }
  })) as Rolldown.RolldownOutput | Rolldown.RolldownOutput[]
  return [salida]
    .flat()
    .flatMap((s) => s.output)
    .flatMap((o) => (o.type === 'chunk' ? o.moduleIds : []))
}

describe('el cliente del contrato en el bundle (SPEC-609)', () => {
  it('trae el link de oRPC y el contrato minificado, y Zod no entra', async () => {
    const modulos = await modulosDelBundle('cliente.ts')

    expect(modulos.some((m) => m.includes('@orpc/openapi-client'))).toBe(true)
    expect(modulos.some((m) => m.endsWith('contract.min.json'))).toBe(true)
    expect(modulos.filter((m) => /[\\/]zod[\\/]/.test(m))).toEqual([])
  }, 60_000)
})
