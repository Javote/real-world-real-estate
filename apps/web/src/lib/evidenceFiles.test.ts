import { afterEach, describe, expect, it, vi } from 'vitest'
import { clasificarEntrantes } from './evidenceFiles'

// SPEC-218 — lo que el front comprueba ANTES de mandar. Es experiencia de
// usuario, no una barrera: el backend decide con las mismas reglas.

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d] // %PDF-
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG = [0xff, 0xd8, 0xff, 0xe0]

let n = 0
/** Un archivo con la firma real de su tipo y un contenido ÚNICO. */
const archivo = (firma: number[], nombre: string, tipo: string, cola = `u${++n}`) =>
  new File([Uint8Array.from(firma), cola], nombre, { type: tipo })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('clasificarEntrantes', () => {
  it('acepta un PDF, un PNG y un JPEG con su firma real', async () => {
    const pdf = archivo(PDF, 'a.pdf', 'application/pdf')
    const png = archivo(PNG, 'b.png', 'image/png')
    const jpg = archivo(JPEG, 'c.jpg', 'image/jpeg')

    const r = await clasificarEntrantes([pdf, png, jpg], [])

    expect(r.aceptados).toEqual([pdf, png, jpg])
    expect(r.rechazados).toEqual([])
  })

  it('rechaza por tamaño, y el tamaño se mira antes que el tipo', async () => {
    const grande = archivo(PDF, 'grande.pdf', 'application/pdf', 'x'.repeat(100))
    const exeGrande = archivo(
      [0x4d, 0x5a],
      'grande.exe',
      'application/x-msdownload',
      'x'.repeat(100)
    )

    const r = await clasificarEntrantes([grande, exeGrande], [], { maxBytes: 10 })

    expect(r.aceptados).toEqual([])
    expect(r.rechazados.map((x) => x.motivo)).toEqual(['size', 'size'])
  })

  it('rechaza un tipo declarado que no es de la regla 10', async () => {
    const exe = archivo([0x4d, 0x5a], 'virus.exe', 'application/x-msdownload')

    const r = await clasificarEntrantes([exe], [])

    expect(r.rechazados).toEqual([{ file: exe, motivo: 'type' }])
  })

  it('rechaza un ejecutable que se declara PDF: el tipo real sale de los primeros bytes', async () => {
    const falso = archivo([0x4d, 0x5a, 0x90, 0x00], 'falso.pdf', 'application/pdf')

    const r = await clasificarEntrantes([falso], [])

    expect(r.aceptados).toEqual([])
    expect(r.rechazados).toEqual([{ file: falso, motivo: 'type' }])
  })

  it('rechaza un PNG etiquetado como JPEG', async () => {
    const engañoso = archivo(PNG, 'engañoso.jpg', 'image/jpeg')

    const r = await clasificarEntrantes([engañoso], [])

    expect(r.rechazados).toEqual([{ file: engañoso, motivo: 'type' }])
  })

  it('rechaza un archivo repetido aunque tenga OTRO nombre: cuenta el contenido', async () => {
    const original = archivo(PDF, 'original.pdf', 'application/pdf', 'mismo contenido')
    const copia = archivo(PDF, 'copia.pdf', 'application/pdf', 'mismo contenido')

    const r = await clasificarEntrantes([original, copia], [])

    expect(r.aceptados).toEqual([original])
    expect(r.rechazados).toEqual([{ file: copia, motivo: 'duplicate' }])
  })

  it('rechaza un archivo igual a uno que ya está en la lista', async () => {
    const yaElegido = archivo(PDF, 'ya.pdf', 'application/pdf', 'contenido')
    const otraVez = archivo(PDF, 'otra-vez.pdf', 'application/pdf', 'contenido')

    const r = await clasificarEntrantes([otraVez], [yaElegido])

    expect(r.rechazados).toEqual([{ file: otraVez, motivo: 'duplicate' }])
  })

  it('no confunde dos archivos distintos', async () => {
    const a = archivo(PDF, 'a.pdf', 'application/pdf', 'uno')
    const b = archivo(PDF, 'b.pdf', 'application/pdf', 'dos')

    const r = await clasificarEntrantes([a, b], [])

    expect(r.aceptados).toEqual([a, b])
  })

  it('respeta el cupo del lote: el que no entra vuelve como `tooMany`', async () => {
    const yaElegido = archivo(PDF, 'ya.pdf', 'application/pdf')
    const a = archivo(PDF, 'a.pdf', 'application/pdf')
    const b = archivo(PDF, 'b.pdf', 'application/pdf')

    const r = await clasificarEntrantes([a, b], [yaElegido], { maxFiles: 2 })

    expect(r.aceptados).toEqual([a])
    expect(r.rechazados).toEqual([{ file: b, motivo: 'tooMany' }])
  })

  it('FALLA ABIERTO sin `crypto.subtle` (contexto no seguro): no avisa de repetidos y deja decidir al backend', async () => {
    vi.stubGlobal('crypto', {})
    const original = archivo(PDF, 'original.pdf', 'application/pdf', 'mismo')
    const copia = archivo(PDF, 'copia.pdf', 'application/pdf', 'mismo')

    const r = await clasificarEntrantes([original, copia], [])

    // No bloquea: el backend los va a rechazar con su `rejected`.
    expect(r.aceptados).toEqual([original, copia])
    expect(r.rechazados).toEqual([])
  })

  it('FALLA ABIERTO si el navegador no deja leer los bytes: el tipo lo decide el backend', async () => {
    const f = archivo(PDF, 'a.pdf', 'application/pdf')
    vi.spyOn(f, 'slice').mockImplementation(() => {
      throw new Error('no se puede leer')
    })

    const r = await clasificarEntrantes([f], [])

    expect(r.aceptados).toEqual([f])
  })
})
