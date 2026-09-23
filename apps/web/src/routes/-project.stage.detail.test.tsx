import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '#/api/port'
import { dictionary } from '#/i18n/dictionary'
import { autenticarComo, INVESTOR_USER, montarRuta } from './-test-mount'
import { Route } from './project.$projectId.stage.$stageId'

const t = dictionary['es-AR']

type Detalle = Awaited<ReturnType<typeof api.getProjectStage>>
type Documento = Awaited<ReturnType<typeof api.listProjectDocuments>>[number]

const TXID_ETAPA = 'txid-etapa-vigente'
const TXID_BUNDLE = 'txid-del-bundle'
const RAIZ = 'c'.repeat(64)
const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)

const evidencia = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  evidenceType: 'document',
  category: 'permit',
  authoritative: false,
  originalFilename: `${id}.pdf`,
  mimeType: 'application/pdf',
  sizeBytes: 10,
  sha256Hash: HASH_A,
  uploadedAt: '2026-05-10T12:00:00.000Z',
  ...over
})

const foto = (id: string) =>
  evidencia(id, { evidenceType: 'photo', mimeType: 'image/jpeg', originalFilename: `${id}.jpg` })

const evento = (over: Record<string, unknown> = {}) => ({
  eventType: 'STAGE_TRANSITION',
  toState: 'Completed',
  commitment: null,
  txid: null,
  status: 'Confirmed',
  outputRef: null,
  createdAt: '2026-05-12T12:00:00.000Z',
  ...over
})

/** Etapa completa: fotos, documentos, bundle anclado y transiciones. */
const detalle = (over: Record<string, unknown> = {}) =>
  ({
    id: 's2',
    projectId: 'p1',
    name: 'Cimientos',
    sequenceOrder: 2,
    state: 'Completed',
    validationCritical: true,
    certifiedAt: '2026-05-15T12:00:00.000Z',
    certifiedById: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    evidences: [foto('f1'), evidencia('d1'), evidencia('d2', { originalFilename: 'acta.pdf' })],
    bundle: { id: 'b1', commitmentHash: RAIZ, createdAt: '2026-05-12T12:00:00.000Z' },
    events: [
      evento({ toState: 'InProgress', txid: 'txid-arranque' }),
      evento({ commitment: RAIZ, txid: TXID_BUNDLE }),
      evento({ txid: TXID_ETAPA })
    ],
    ...over
  }) as unknown as Detalle

const documentoDelProyecto = (id: string, txid: string | null) =>
  ({
    id,
    stageId: 's2',
    evidenceType: 'document',
    category: 'permit',
    authoritative: false,
    originalFilename: `${id}.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 10,
    sha256Hash: HASH_A,
    uploadedAt: '2026-05-10T12:00:00.000Z',
    txid,
    anchorStatus: txid ? 'Confirmed' : 'Pending'
  }) as unknown as Documento

const tresStages = [
  { id: 's1', sequenceOrder: 1 },
  { id: 's2', sequenceOrder: 2 },
  { id: 's3', sequenceOrder: 3 }
] as unknown as Awaited<ReturnType<typeof api.listProjectStages>>

function montarConDatos(
  opciones: { stage?: Detalle; documentos?: Documento[]; stages?: typeof tresStages } = {}
) {
  autenticarComo(INVESTOR_USER)
  vi.spyOn(api, 'listProjectStages').mockResolvedValue(opciones.stages ?? tresStages)
  vi.spyOn(api, 'getProjectStage').mockResolvedValue(opciones.stage ?? detalle())
  vi.spyOn(api, 'listProjectDocuments').mockResolvedValue(
    opciones.documentos ?? [documentoDelProyecto('d1', 'txid-d1'), documentoDelProyecto('d2', null)]
  )
  vi.spyOn(api, 'downloadEvidence').mockResolvedValue(new Blob(['x']))
  return montar()
}

const montar = () =>
  montarRuta(
    Route,
    '/project/$projectId/stage/$stageId',
    ['/project/$projectId/progress'],
    '/project/p1/stage/s2'
  )

describe('/project/:projectId/stage/:stageId (investor)', () => {
  beforeEach(() => {
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:falso'), revokeObjectURL: vi.fn() })
  })
  afterEach(() => vi.restoreAllMocks())

  it('INV-STAGE-DETAIL-001: un 403 muestra "sin acceso" en vez del detalle', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'listProjectStages').mockResolvedValue(tresStages)
    vi.spyOn(api, 'listProjectDocuments').mockResolvedValue([])
    vi.spyOn(api, 'getProjectStage').mockRejectedValue(new ApiError(403, 'no'))
    montar()

    const p = await screen.findByText(t['error.forbidden'])
    expect(p.getAttribute('data-testid')).toBe('INV-STAGE-DETAIL-001')
  })

  it('INV-STAGE-DETAIL-001: un 404 muestra "no se encontró"', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'listProjectStages').mockResolvedValue(tresStages)
    vi.spyOn(api, 'listProjectDocuments').mockResolvedValue([])
    vi.spyOn(api, 'getProjectStage').mockRejectedValue(new ApiError(404, 'no'))
    montar()

    const p = await screen.findByText(t['error.notFound'])
    expect(p.getAttribute('data-testid')).toBe('INV-STAGE-DETAIL-001')
  })

  it('mientras carga: spinner, título genérico y sin sello de verificado ni botón de hito', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'listProjectStages').mockReturnValue(new Promise(() => {}))
    vi.spyOn(api, 'getProjectStage').mockReturnValue(new Promise(() => {}))
    vi.spyOn(api, 'listProjectDocuments').mockReturnValue(new Promise(() => {}))
    montar()

    const seccion = await screen.findByTestId('INV-STAGE-DETAIL-001')
    expect(within(seccion).getByRole('status')).toBeTruthy()
    expect(screen.getByRole('heading', { name: t['investor.project.stages'] })).toBeTruthy()
    expect(seccion.textContent).toContain(t['status.pending'])
    expect(seccion.textContent).not.toContain(t['status.verified'])
    expect(screen.queryByRole('button', { name: t['investor.stage.openMilestone'] })).toBeNull()
  })

  it('etapa completa: título, "Etapa 2 de 3", fecha de certificación y sello con la última transición anclada', async () => {
    montarConDatos()

    await screen.findByRole('heading', { name: 'Cimientos' })
    expect(screen.getByText(/Etapa 2 de 3/)).toBeTruthy()
    const seccion = screen.getByTestId('INV-STAGE-DETAIL-001')
    expect(seccion.textContent).toContain('2026')
    expect(seccion.textContent).toContain(t['status.verified'])
  })

  it('sin lista de etapas y sin transición anclada: el total cae al orden y el sello dice Pendiente', async () => {
    montarConDatos({
      stages: [] as unknown as typeof tresStages,
      documentos: [],
      stage: detalle({ certifiedAt: null, events: [evento({ txid: null })] })
    })

    await screen.findByText(/Etapa 2 de 2/)
    const seccion = screen.getByTestId('INV-STAGE-DETAIL-001')
    expect(seccion.textContent).not.toContain(t['status.verified'])
    expect(seccion.textContent).toContain(t['status.pending'])
  })

  it('sin fotos, sin documentos y sin bundle: avisos vacíos y ningún botón de hito', async () => {
    montarConDatos({ stage: detalle({ evidences: [], bundle: null }) })

    await screen.findByText(t['investor.stage.noPhotos'])
    expect(screen.getByText(t['investor.stage.noDocs'])).toBeTruthy()
    expect(screen.queryByRole('button', { name: t['investor.stage.openMilestone'] })).toBeNull()
  })

  it('documentos: el anclado dice Verificado, el que no tiene TXID dice Pendiente (regla 17)', async () => {
    montarConDatos()

    const anclado = (await screen.findByRole('button', { name: 'd1.pdf' })).closest('article')!
    const sinAnclar = screen.getByRole('button', { name: 'acta.pdf' }).closest('article')!
    expect(anclado.textContent).toContain(t['status.verified'])
    expect(sinAnclar.textContent).toContain(t['status.pending'])
    // Solo el anclado ofrece descarga.
    expect(within(anclado).getByRole('button', { name: t['document.download'] })).toBeTruthy()
    expect(within(sinAnclar).queryByRole('button', { name: t['document.download'] })).toBeNull()
  })

  it('descargar un documento anclado pide el archivo y dispara la descarga', async () => {
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    montarConDatos()

    const tarjeta = (await screen.findByRole('button', { name: 'd1.pdf' })).closest('article')!
    await userEvent.click(within(tarjeta).getByRole('button', { name: t['document.download'] }))

    await waitFor(() => expect(clic).toHaveBeenCalled())
    expect(api.downloadEvidence).toHaveBeenCalledWith('d1')
  })

  it('INV-STAGE-DOCVIEW-002: abrir un documento anclado muestra el visor verificado con su descarga', async () => {
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    montarConDatos()

    await userEvent.click(await screen.findByRole('button', { name: 'd1.pdf' }))

    const visor = await screen.findByTestId('INV-STAGE-DOCVIEW-002')
    expect(visor.textContent).toContain('permit')
    expect(visor.textContent).toContain(t['status.verified'])
    await userEvent.click(within(visor).getByRole('button', { name: t['document.download'] }))
    await waitFor(() => expect(clic).toHaveBeenCalled())
  })

  it('INV-STAGE-DOCVIEW-002: el visor de un documento sin TXID dice Pendiente y no ofrece descarga', async () => {
    montarConDatos()

    await userEvent.click(await screen.findByRole('button', { name: 'acta.pdf' }))

    const visor = await screen.findByTestId('INV-STAGE-DOCVIEW-002')
    expect(visor.textContent).toContain(t['status.pending'])
    expect(within(visor).queryByRole('button', { name: t['document.download'] })).toBeNull()
  })

  it('cerrar el visor con Escape lo quita', async () => {
    montarConDatos()
    await userEvent.click(await screen.findByRole('button', { name: 'd1.pdf' }))
    await screen.findByTestId('INV-STAGE-DOCVIEW-002')

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByTestId('INV-STAGE-DOCVIEW-002')).toBeNull())
  })

  it('fotos: hasta cinco miniaturas, y abrir una abre la galería en esa foto', async () => {
    montarConDatos({
      stage: detalle({ evidences: [foto('f1'), foto('f2')], bundle: null })
    })

    const miniaturas = await screen.findAllByRole('img', { name: t['investor.stage.photos'] })
    await waitFor(() => expect(api.downloadEvidence).toHaveBeenCalledTimes(2))
    expect(miniaturas.length).toBeGreaterThan(0)

    await userEvent.click((await screen.findAllByRole('img'))[0]!.closest('button')!)

    const galeria = await screen.findByRole('dialog')
    expect(galeria.textContent).toContain('1/2')
    await userEvent.click(
      within(galeria).getByRole('button', { name: t['investor.gallery.close'] })
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('más de cinco fotos: el botón "+N Ver todas" abre la galería en la sexta', async () => {
    montarConDatos({
      stage: detalle({
        evidences: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7'].map(foto),
        bundle: null
      })
    })

    await userEvent.click(await screen.findByRole('button', { name: /\+2/ }))

    const galeria = await screen.findByRole('dialog')
    await waitFor(() => expect(galeria.textContent).toContain('6/7'))
  })

  it('una foto cuya descarga todavía no llegó muestra el ícono de reemplazo, sin imagen', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'listProjectStages').mockResolvedValue(tresStages)
    vi.spyOn(api, 'getProjectStage').mockResolvedValue(
      detalle({ evidences: [foto('f1')], bundle: null })
    )
    vi.spyOn(api, 'listProjectDocuments').mockResolvedValue([])
    vi.spyOn(api, 'downloadEvidence').mockReturnValue(new Promise(() => {}))
    montar()

    await screen.findByRole('heading', { name: t['investor.stage.photos'] })
    expect(screen.queryByRole('img', { name: t['investor.stage.photos'] })).toBeNull()
  })

  describe('el hito de la etapa (bundle y Merkle)', () => {
    const archivos = {
      bundleId: 'b1',
      merkleRoot: RAIZ,
      files: [
        { evidenceId: 'e1', sha256Hash: HASH_A, filename: 'plano.pdf' },
        { evidenceId: 'e2', sha256Hash: HASH_B, filename: null }
      ]
    } as Awaited<ReturnType<typeof api.getBundleFiles>>

    it('INV-STAGE-MILESTONE-001: con un evento que ancla la raíz, sus archivos salen Verificados y con el TXID del bundle', async () => {
      vi.spyOn(api, 'getBundleFiles').mockResolvedValue(archivos)
      montarConDatos()

      await userEvent.click(
        await screen.findByRole('button', { name: t['investor.stage.openMilestone'] })
      )

      const hito = await screen.findByTestId('INV-STAGE-MILESTONE-001')
      await within(hito).findAllByText('plano.pdf')
      expect(api.getBundleFiles).toHaveBeenCalledWith('b1')
      // Sin `filename`, se usa el hash como nombre.
      expect(within(hito).getAllByText(HASH_B).length).toBeGreaterThan(0)
      expect(within(hito).getAllByText(t['status.verified']).length).toBeGreaterThan(0)
      expect(within(hito).getByTestId('INV-MERKLE-PROOF-002')).toBeTruthy()
    })

    it('regla 17: si ningún evento ancla la raíz del bundle, el hito dice Pendiente y no Verificado', async () => {
      vi.spyOn(api, 'getBundleFiles').mockResolvedValue(archivos)
      montarConDatos({
        stage: detalle({ events: [evento({ commitment: 'otra-raiz', txid: 'txid-ajeno' })] })
      })

      await userEvent.click(
        await screen.findByRole('button', { name: t['investor.stage.openMilestone'] })
      )

      const hito = await screen.findByTestId('INV-STAGE-MILESTONE-001')
      await within(hito).findAllByText('plano.pdf')
      expect(hito.textContent).not.toContain(t['status.verified'])
      expect(hito.textContent).toContain(t['status.pending'])
    })

    it('antes de que lleguen los archivos, el hito muestra la raíz del bundle de la etapa', async () => {
      vi.spyOn(api, 'getBundleFiles').mockReturnValue(new Promise(() => {}))
      montarConDatos()

      await userEvent.click(
        await screen.findByRole('button', { name: t['investor.stage.openMilestone'] })
      )

      const hito = await screen.findByTestId('INV-STAGE-MILESTONE-001')
      expect(hito.textContent).toContain('cccccc...cccc')
    })

    it('el chip del TXID del bundle abre el modal con su TXID, y se cierra', async () => {
      vi.spyOn(api, 'getBundleFiles').mockResolvedValue(archivos)
      montarConDatos()

      await userEvent.click(
        await screen.findByRole('button', { name: t['investor.stage.openMilestone'] })
      )
      const hito = await screen.findByTestId('INV-STAGE-MILESTONE-001')
      await within(hito).findAllByText('plano.pdf')

      await userEvent.click(within(hito).getByRole('button', { name: /txid-d\.\.\.ndle/ }))

      const modal = await screen.findByText(t['txidModal.title'])
      expect(modal).toBeTruthy()
      fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
      await waitFor(() => expect(screen.queryByText(t['txidModal.title'])).toBeNull())
    })

    it('el camino de Merkle de un archivo se pide al abrir su hash y se muestra paso a paso', async () => {
      vi.spyOn(api, 'getBundleFiles').mockResolvedValue(archivos)
      const prueba = vi.spyOn(api, 'getMerkleProof').mockResolvedValue({
        merkleRoot: RAIZ,
        leaf: HASH_A,
        proof: [
          { sibling: 'd'.repeat(64), position: 'left' },
          { sibling: 'e'.repeat(64), position: 'right' }
        ],
        signerUserId: 'u1',
        anchorStatus: 'Confirmed',
        txid: TXID_BUNDLE,
        timestamp: '2026-05-12T12:00:00.000Z'
      })
      montarConDatos()

      await userEvent.click(
        await screen.findByRole('button', { name: t['investor.stage.openMilestone'] })
      )
      const hito = await screen.findByTestId('INV-STAGE-MILESTONE-001')
      await within(hito).findAllByText('plano.pdf')

      const lista = within(within(hito).getByTestId('INV-MERKLE-PROOF-002')).getByRole('list')
      await userEvent.click(within(lista).getAllByRole('button', { name: /aaaaaa\.\.\.aaaa/ })[0]!)

      await within(hito).findByText(t['merkle.proofPath'])
      expect(prueba).toHaveBeenCalledWith('b1', HASH_A)
      expect(within(hito).getByText('dddddd...dddd')).toBeTruthy()
      expect(within(hito).getByText('eeeeee...eeee')).toBeTruthy()
    })

    it('una prueba sin pasos no dibuja el camino de Merkle', async () => {
      vi.spyOn(api, 'getBundleFiles').mockResolvedValue(archivos)
      const prueba = vi.spyOn(api, 'getMerkleProof').mockResolvedValue({
        merkleRoot: RAIZ,
        leaf: HASH_A,
        proof: [],
        signerUserId: 'u1',
        anchorStatus: 'Confirmed',
        txid: TXID_BUNDLE,
        timestamp: null
      })
      montarConDatos()

      await userEvent.click(
        await screen.findByRole('button', { name: t['investor.stage.openMilestone'] })
      )
      const hito = await screen.findByTestId('INV-STAGE-MILESTONE-001')
      await within(hito).findAllByText('plano.pdf')
      const lista = within(within(hito).getByTestId('INV-MERKLE-PROOF-002')).getByRole('list')
      await userEvent.click(within(lista).getAllByRole('button', { name: /aaaaaa\.\.\.aaaa/ })[0]!)

      await waitFor(() => expect(prueba).toHaveBeenCalled())
      expect(within(hito).queryByText(t['merkle.proofPath'])).toBeNull()
    })

    it('cerrar el hito con Escape descarta el camino de Merkle abierto', async () => {
      vi.spyOn(api, 'getBundleFiles').mockResolvedValue(archivos)
      vi.spyOn(api, 'getMerkleProof').mockResolvedValue({
        merkleRoot: RAIZ,
        leaf: HASH_A,
        proof: [{ sibling: 'd'.repeat(64), position: 'left' }],
        signerUserId: 'u1',
        anchorStatus: 'Confirmed',
        txid: TXID_BUNDLE,
        timestamp: null
      })
      montarConDatos()

      await userEvent.click(
        await screen.findByRole('button', { name: t['investor.stage.openMilestone'] })
      )
      const hito = await screen.findByTestId('INV-STAGE-MILESTONE-001')
      await within(hito).findAllByText('plano.pdf')
      const lista = within(within(hito).getByTestId('INV-MERKLE-PROOF-002')).getByRole('list')
      await userEvent.click(within(lista).getAllByRole('button', { name: /aaaaaa\.\.\.aaaa/ })[0]!)
      await within(hito).findByText(t['merkle.proofPath'])

      fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
      await waitFor(() => expect(screen.queryByTestId('INV-STAGE-MILESTONE-001')).toBeNull())

      // Al reabrirlo el camino anterior ya no está.
      await userEvent.click(screen.getByRole('button', { name: t['investor.stage.openMilestone'] }))
      const reabierto = await screen.findByTestId('INV-STAGE-MILESTONE-001')
      expect(within(reabierto).queryByText(t['merkle.proofPath'])).toBeNull()
    })
  })

  it('volver navega al avance del proyecto', async () => {
    montarConDatos()

    await userEvent.click(await screen.findByRole('button', { name: t['investor.stage.back'] }))

    await screen.findByText('/project/$projectId/progress')
  })
})
