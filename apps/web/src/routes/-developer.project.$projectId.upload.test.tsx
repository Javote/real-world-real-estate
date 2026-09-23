import { EVIDENCE_MAX_FILE_MB, EVIDENCE_MAX_FILES } from '@plataforma/shared/evidence-rules'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '#/api/port'
import { dictionary } from '#/i18n/dictionary'
import { autenticarComo, DEVELOPER_USER, montarRuta } from './-test-mount'
import { Route } from './developer.project.$projectId.upload'

const t = dictionary['es-AR']

type Resultado = Awaited<ReturnType<typeof api.uploadStageEvidence>>

const TXID = 'b'.repeat(64)
const MERKLE = 'c'.repeat(64)

const PDF_FIRMA = [0x25, 0x50, 0x44, 0x46, 0x2d]
let n = 0
/** Un PDF con firma real y contenido único (el dropzone descarta repetidos por SHA-256). */
const pdf = (nombre: string) =>
  new File([Uint8Array.from(PDF_FIRMA), `contenido-${++n}`], nombre, { type: 'application/pdf' })

const resultado = (over: Record<string, unknown> = {}): Resultado =>
  ({
    evidences: [{ id: 'e1' }],
    rejected: [],
    bundleId: 'b1',
    merkleRoot: MERKLE,
    anchor: { txid: TXID, status: 'Confirmed' },
    ...over
  }) as unknown as Resultado

const montar = () =>
  montarRuta(
    Route.options.component as () => React.ReactElement,
    '/developer/project/$projectId/upload',
    ['/developer/project/$projectId'],
    '/developer/project/p1/upload'
  )

function preparar() {
  autenticarComo(DEVELOPER_USER)
  vi.spyOn(api, 'getDeveloperProject').mockResolvedValue({
    stages: [
      { id: 's1', name: 'Cimientos', sequenceOrder: 1 },
      { id: 's2', name: 'Estructura', sequenceOrder: 2 }
    ]
  } as unknown as Awaited<ReturnType<typeof api.getDeveloperProject>>)
  return vi.spyOn(api, 'uploadStageEvidence')
}

const chip = (numero: number, nombre: string) =>
  t['developer.upload.stageAria'].replace('{number}', String(numero)).replace('{name}', nombre)

async function elegirEtapa(numero = 1, nombre = 'Cimientos') {
  fireEvent.click(await screen.findByRole('button', { name: chip(numero, nombre) }))
  await screen.findByText(t['developer.upload.selectedStage'])
}

const input = () => screen.getByLabelText(t['developer.upload.dropzone']) as HTMLInputElement
const agregar = (...archivos: File[]) => fireEvent.change(input(), { target: { files: archivos } })
const anclar = () => screen.getByRole('button', { name: t['developer.upload.anchor'] })

/** Sube un archivo a la etapa 1 y espera a que el botón quede listo. */
async function conArchivo(nombre = 'plano.pdf') {
  await elegirEtapa()
  agregar(pdf(nombre))
  await screen.findByText(nombre)
  await waitFor(() => expect((anclar() as HTMLButtonElement).disabled).toBe(false))
}

describe('/developer/project/$projectId/upload', () => {
  afterEach(() => vi.restoreAllMocks())

  it('DEV-EVIDENCE-UPLOAD-001: sin etapa elegida solo se ven los chips de las etapas', async () => {
    preparar()
    montar()

    await screen.findByRole('button', { name: chip(1, 'Cimientos') })
    expect(screen.getByTestId('DEV-EVIDENCE-UPLOAD-001')).toBeTruthy()
    expect(screen.getByRole('button', { name: chip(2, 'Estructura') })).toBeTruthy()
    expect(screen.queryByText(t['developer.upload.selectedStage'])).toBeNull()
    expect(screen.queryByLabelText(t['developer.upload.dropzone'])).toBeNull()
  })

  it('mientras el proyecto carga no hay chips', async () => {
    autenticarComo(DEVELOPER_USER)
    vi.spyOn(api, 'getDeveloperProject').mockReturnValue(new Promise(() => {}))
    montar()

    await screen.findByText(t['developer.upload.selectStage'])
    expect(screen.queryByRole('button', { name: /Cimientos/ })).toBeNull()
  })

  it('elegir una etapa muestra su número y nombre, y el botón de anclar deshabilitado sin archivos', async () => {
    preparar()
    montar()

    await elegirEtapa(2, 'Estructura')

    expect(screen.getByText('2. Estructura', { selector: 'span.text-h2' })).toBeTruthy()
    expect((anclar() as HTMLButtonElement).disabled).toBe(true)
  })

  it('agregar un archivo lo lista, y quitarlo lo saca', async () => {
    preparar()
    montar()
    await elegirEtapa()

    agregar(pdf('plano.pdf'))
    await screen.findByText('plano.pdf')
    fireEvent.click(screen.getByRole('button', { name: t['developer.upload.remove'] }))

    await waitFor(() => expect(screen.queryByText('plano.pdf')).toBeNull())
  })

  it('un archivo que supera el tamaño máximo se rechaza en el cliente, con su motivo', async () => {
    preparar()
    montar()
    await elegirEtapa()

    const grande = pdf('grande.pdf')
    Object.defineProperty(grande, 'size', { value: (EVIDENCE_MAX_FILE_MB + 1) * 1024 * 1024 })
    agregar(grande)

    await screen.findByText(
      t['developer.upload.rejected.size']
        .replace('{name}', 'grande.pdf')
        .replace('{max}', String(EVIDENCE_MAX_FILE_MB))
    )
    expect((anclar() as HTMLButtonElement).disabled).toBe(true)
  })

  it('más archivos que el cupo por pedido: el que sobra se rechaza por cantidad', async () => {
    preparar()
    montar()
    await elegirEtapa()

    agregar(...Array.from({ length: EVIDENCE_MAX_FILES + 1 }, (_, i) => pdf(`doc-${i}.pdf`)))

    await screen.findByText(
      t['developer.upload.rejected.tooMany']
        .replace('{name}', `doc-${EVIDENCE_MAX_FILES}.pdf`)
        .replace('{max}', String(EVIDENCE_MAX_FILES))
    )
  })

  it('anclar sin notas manda un solo `file`, `evidenceType=document` y `category=document`', async () => {
    const subir = preparar().mockResolvedValue(resultado())
    montar()
    await conArchivo()

    fireEvent.click(anclar())

    await waitFor(() => expect(subir).toHaveBeenCalledTimes(1))
    const [proyecto, etapa, form] = subir.mock.calls[0] as [string, string, FormData]
    expect(proyecto).toBe('p1')
    expect(etapa).toBe('s1')
    expect(form.getAll('file')).toHaveLength(1)
    expect(form.get('evidenceType')).toBe('document')
    expect(form.get('category')).toBe('document')
  })

  it('anclar con notas manda `category=inspection`', async () => {
    const subir = preparar().mockResolvedValue(resultado())
    montar()
    await conArchivo()

    fireEvent.change(screen.getByLabelText(t['developer.upload.notes']), {
      target: { value: 'Se inspeccionó la losa' }
    })
    fireEvent.click(anclar())

    await waitFor(() => expect(subir).toHaveBeenCalledTimes(1))
    const [, , form] = subir.mock.calls[0] as [string, string, FormData]
    expect(form.get('category')).toBe('inspection')
  })

  it('mientras ancla el botón dice "Anclando…" y queda deshabilitado', async () => {
    preparar().mockReturnValue(new Promise(() => {}))
    montar()
    await conArchivo()

    fireEvent.click(anclar())

    const boton = (await screen.findByRole('button', {
      name: t['developer.upload.anchoring']
    })) as HTMLButtonElement
    expect(boton.disabled).toBe(true)
  })

  it('con TXID abre AnchoringSuccessModal, vacía la lista y las notas; "Listo" lo cierra', async () => {
    preparar().mockResolvedValue(resultado())
    montar()
    await conArchivo()
    fireEvent.change(screen.getByLabelText(t['developer.upload.notes']), {
      target: { value: 'notas' }
    })

    fireEvent.click(anclar())

    const modal = await screen.findByTestId('DEV-ANCHOR-SUCCESS-001')
    expect(modal.textContent).toContain(t['developer.anchorSuccess.title'])
    expect(screen.queryByText('plano.pdf')).toBeNull()
    expect((screen.getByLabelText(t['developer.upload.notes']) as HTMLTextAreaElement).value).toBe(
      ''
    )
    expect(screen.queryByText(t['developer.upload.anchorPending'])).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: t['developer.anchorSuccess.done'] }))
    await waitFor(() => expect(screen.queryByTestId('DEV-ANCHOR-SUCCESS-001')).toBeNull())
  })

  it('sin TXID (anclaje fallido) no hay modal de éxito: solo el aviso de pendiente (regla 17)', async () => {
    preparar().mockResolvedValue(resultado({ anchor: { txid: null, status: 'Failed' } }))
    montar()
    await conArchivo()

    fireEvent.click(anclar())

    await screen.findByText(t['developer.upload.anchorPending'])
    expect(screen.queryByTestId('DEV-ANCHOR-SUCCESS-001')).toBeNull()
  })

  it('resultado parcial: el rechazado se queda con su motivo y las notas, y se avisa', async () => {
    const subir = preparar().mockResolvedValue(
      resultado({ rejected: [{ index: 1, code: 'EVIDENCE_ALREADY_IN_STAGE' }] })
    )
    montar()
    await elegirEtapa()
    agregar(pdf('bueno.pdf'), pdf('repetido.pdf'))
    await screen.findByText('repetido.pdf')
    await waitFor(() => expect((anclar() as HTMLButtonElement).disabled).toBe(false))
    fireEvent.change(screen.getByLabelText(t['developer.upload.notes']), {
      target: { value: 'notas' }
    })

    fireEvent.click(anclar())

    await screen.findByText(t['developer.upload.partial'])
    expect(subir).toHaveBeenCalledTimes(1)
    expect(
      screen.getByText(t['developer.upload.serverRejected.EVIDENCE_ALREADY_IN_STAGE'])
    ).toBeTruthy()
    expect(screen.getByText('repetido.pdf')).toBeTruthy()
    expect(screen.queryByText('bueno.pdf')).toBeNull()
    expect((screen.getByLabelText(t['developer.upload.notes']) as HTMLTextAreaElement).value).toBe(
      'notas'
    )
  })

  it('un rechazo del servidor con índice fuera de la lista se ignora', async () => {
    preparar().mockResolvedValue(
      resultado({ rejected: [{ index: 7, code: 'UNSUPPORTED_FILE_TYPE' }] })
    )
    montar()
    await conArchivo()

    fireEvent.click(anclar())

    await screen.findByText(t['developer.upload.partial'])
    expect(
      screen.queryByText(t['developer.upload.serverRejected.UNSUPPORTED_FILE_TYPE'])
    ).toBeNull()
  })

  it('400 NO_FILES_ACCEPTED: ninguno entró, cada archivo muestra su motivo y no sale el error genérico', async () => {
    preparar().mockRejectedValue(
      new ApiError(400, 'ninguno', {
        code: 'NO_FILES_ACCEPTED',
        rejected: [
          { index: 0, code: 'UNSUPPORTED_FILE_TYPE' },
          { index: 1, code: 'inventado' },
          { index: 'x', code: 'UNSUPPORTED_FILE_TYPE' },
          'basura',
          null
        ]
      })
    )
    montar()
    await conArchivo()

    fireEvent.click(anclar())

    await screen.findByText(t['developer.upload.noneAccepted'])
    expect(
      screen.getByText(t['developer.upload.serverRejected.UNSUPPORTED_FILE_TYPE'])
    ).toBeTruthy()
    expect(screen.queryByText(t['developer.upload.error'])).toBeNull()
    expect(screen.getByText('plano.pdf')).toBeTruthy()
  })

  it.each([
    ['otro `code`', new ApiError(400, 'x', { code: 'OTRO', rejected: [] })],
    [
      '`rejected` que no es lista',
      new ApiError(400, 'x', { code: 'NO_FILES_ACCEPTED', rejected: 'no' })
    ],
    ['un ApiError sin body', new ApiError(500, 'boom')],
    ['un body que no es objeto', new ApiError(500, 'boom', 'texto')],
    ['un body nulo', new ApiError(500, 'boom', null)],
    ['un error que no es ApiError', new Error('red caída')]
  ])('un fallo con %s muestra el error genérico y conserva el archivo', async (_nombre, error) => {
    preparar().mockRejectedValue(error)
    montar()
    await conArchivo()

    fireEvent.click(anclar())

    await screen.findByText(t['developer.upload.error'])
    expect(screen.queryByText(t['developer.upload.noneAccepted'])).toBeNull()
    expect(screen.getByText('plano.pdf')).toBeTruthy()
  })

  it('el botón de volver lleva al detalle del proyecto', async () => {
    preparar()
    const router = montar()
    await screen.findByRole('button', { name: chip(1, 'Cimientos') })

    fireEvent.click(screen.getByRole('button', { name: t['nav.back'] }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/developer/project/p1'))
  })
})
