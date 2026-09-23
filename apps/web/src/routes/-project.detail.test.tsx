import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '#/api/port'
import { dictionary } from '#/i18n/dictionary'
import { autenticarComo, INVESTOR_USER, montarRuta } from './-test-mount'
import { Route } from './project.$projectId.index'

vi.mock('leaflet', () => import('#/test/leaflet-falso'))

const t = dictionary['es-AR']

type Proyecto = Awaited<ReturnType<typeof api.getProject>>
type Documento = Awaited<ReturnType<typeof api.listProjectDocuments>>[number]
type Favoritos = Awaited<ReturnType<typeof api.listFavorites>>

const stage = (n: number, state: string) => ({
  id: `s${n}`,
  projectId: 'p1',
  name: `Etapa-${n}`,
  sequenceOrder: n,
  state,
  validationCritical: true,
  certifiedAt: null,
  certifiedById: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
})

/** Proyecto completo: con ubicación, entrega, organización y tres etapas. */
const proyectoCompleto = (over: Record<string, unknown> = {}) =>
  ({
    id: 'p1',
    name: 'Torre Norte',
    slug: 'torre-norte',
    address: 'Calle 1',
    city: 'Rosario',
    country: 'Argentina',
    latitude: -32.9,
    longitude: -60.6,
    totalUnits: 10,
    estimatedDelivery: '2027-06-15T12:00:00.000Z',
    status: 'in_progress',
    organizationId: 'org-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    stages: [stage(1, 'Completed'), stage(2, 'InProgress'), stage(3, 'Pending')],
    members: [],
    ...over
  }) as unknown as Proyecto

/** Proyecto mínimo: todos los nullables en `null` y sin etapas. */
const proyectoMinimo = () =>
  proyectoCompleto({
    address: null,
    city: null,
    country: null,
    latitude: null,
    longitude: null,
    estimatedDelivery: null,
    organizationId: null,
    stages: []
  })

const documento = (id: string, over: Record<string, unknown> = {}) =>
  ({
    id,
    stageId: 's1',
    evidenceType: 'document',
    category: 'permit',
    authoritative: false,
    originalFilename: `${id}.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 10,
    sha256Hash: 'a'.repeat(64),
    uploadedAt: '2026-05-10T12:00:00.000Z',
    txid: null,
    anchorStatus: 'Pending',
    ...over
  }) as unknown as Documento

const fotoDoc = (id: string) =>
  documento(id, {
    evidenceType: 'photo',
    mimeType: 'image/jpeg',
    originalFilename: `${id}.jpg`,
    txid: 'tx-foto'
  })

const RUTAS = [
  '/investor/buy',
  '/project/$projectId/progress',
  '/project/$projectId/developer',
  '/project/$projectId/stage/$stageId'
]

function montarConDatos(
  opciones: { proyecto?: Proyecto; documentos?: Documento[]; favoritos?: Favoritos } = {}
) {
  autenticarComo(INVESTOR_USER)
  vi.spyOn(api, 'getProject').mockResolvedValue(opciones.proyecto ?? proyectoCompleto())
  vi.spyOn(api, 'listProjectDocuments').mockResolvedValue(opciones.documentos ?? [])
  vi.spyOn(api, 'listFavorites').mockResolvedValue(opciones.favoritos ?? [])
  vi.spyOn(api, 'downloadEvidence').mockResolvedValue(new Blob(['x']))
  return montarRuta(Route, '/project/$projectId', RUTAS, '/project/p1')
}

describe('/project/:projectId (investor)', () => {
  beforeEach(() => {
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:falso'), revokeObjectURL: vi.fn() })
  })
  afterEach(() => vi.restoreAllMocks())

  it('INV-PROJECT-DETAIL-001: un 403 muestra "sin acceso" en vez del detalle', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'getProject').mockRejectedValue(new ApiError(403, 'no'))
    vi.spyOn(api, 'listFavorites').mockResolvedValue([])
    montarRuta(Route, '/project/$projectId', RUTAS, '/project/p1')

    const p = await screen.findByText(t['error.forbidden'], { selector: 'p' })
    expect(p.getAttribute('data-testid')).toBe('INV-PROJECT-DETAIL-001')
  })

  it('mientras carga: título genérico, sin estado ni entrega, y el botón de favorito ya está', async () => {
    autenticarComo(INVESTOR_USER)
    vi.spyOn(api, 'getProject').mockReturnValue(new Promise(() => {}))
    vi.spyOn(api, 'listFavorites').mockReturnValue(new Promise(() => {}))
    montarRuta(Route, '/project/$projectId', RUTAS, '/project/p1')

    await screen.findByRole('heading', { name: t['panel.investor.title'] })
    const detalle = screen.getByTestId('INV-PROJECT-DETAIL-001')
    expect(detalle.textContent).not.toContain(t['project.status.in_progress'])
    expect(screen.getByRole('button', { name: t['investor.favorites.save'] })).toBeTruthy()
    expect(screen.queryByTestId('INV-DEVELOPER-LINK-004')).toBeNull()
  })

  it('proyecto completo: nombre, ubicación, estado, entrega y avance de la etapa actual', async () => {
    montarConDatos()

    await screen.findByRole('heading', { name: 'Torre Norte' })
    const detalle = screen.getByTestId('INV-PROJECT-DETAIL-001')
    expect(detalle.textContent).toContain(t['project.status.in_progress'])
    expect(detalle.textContent).toContain('Rosario, Argentina')
    expect(detalle.textContent).toContain('2027')
    expect(detalle.textContent).toContain('Etapa actual: Etapa-2')
    // 1 de 3 etapas completadas.
    expect(detalle.textContent).toContain('33%')
  })

  it('con todas las etapas completadas no hay "etapa actual" ni porcentaje', async () => {
    montarConDatos({
      proyecto: proyectoCompleto({ stages: [stage(1, 'Completed'), stage(2, 'Completed')] })
    })

    await screen.findByRole('heading', { name: 'Torre Norte' })
    expect(screen.getByTestId('INV-PROJECT-DETAIL-001').textContent).not.toContain('Etapa actual')
  })

  it('proyecto mínimo: sin ubicación ni entrega ni enlace al desarrollador; la tarjeta dice "Ubicación"', async () => {
    montarConDatos({ proyecto: proyectoMinimo() })

    await screen.findByRole('heading', { name: 'Torre Norte' })
    const detalle = screen.getByTestId('INV-PROJECT-DETAIL-001')
    expect(detalle.textContent).toContain(t['investor.project.location'])
    expect(screen.queryByRole('button', { name: t['investor.project.location'] })).toBeNull()
    expect(screen.queryByTestId('INV-DEVELOPER-LINK-004')).toBeNull()
    expect(detalle.textContent).not.toContain('Finalización')
  })

  it('sin coordenadas pero con ciudad: la tarjeta muestra el domicilio y no hay botón de mapa', async () => {
    montarConDatos({ proyecto: proyectoCompleto({ latitude: null, longitude: null }) })

    await screen.findByRole('heading', { name: 'Torre Norte' })
    expect(screen.getAllByText('Rosario, Argentina').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: t['investor.project.location'] })).toBeNull()
  })

  it('coordenadas sin ciudad ni país: el botón del mapa no lleva domicilio', async () => {
    montarConDatos({ proyecto: proyectoCompleto({ city: null, country: null }) })

    const boton = await screen.findByRole('button', { name: t['investor.project.location'] })
    expect(boton.textContent).toBe('')
  })

  it('el botón del mapa abre el modal de ubicación y se cierra con Escape', async () => {
    montarConDatos()

    await userEvent.click(
      await screen.findByRole('button', { name: t['investor.project.location'] })
    )

    await screen.findByRole('dialog', { name: t['investor.project.location'] })
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('INV-DEVELOPER-LINK-004: con organización, el enlace lleva al perfil del desarrollador', async () => {
    montarConDatos()

    await userEvent.click(await screen.findByTestId('INV-DEVELOPER-LINK-004'))

    await screen.findByText('/project/$projectId/developer')
  })

  it('un proyecto que no es favorito ofrece guardarlo', async () => {
    montarConDatos()
    const agregar = vi.spyOn(api, 'addFavorite').mockResolvedValue(undefined as never)

    const guardar = await screen.findByRole('button', { name: t['investor.favorites.save'] })
    expect(guardar.getAttribute('aria-pressed')).toBe('false')
    await userEvent.click(guardar)
    await waitFor(() => expect(agregar).toHaveBeenCalledWith('p1'))
  })

  it('un proyecto que ya es favorito ofrece sacarlo', async () => {
    montarConDatos({ favoritos: [{ id: 'p1' }] as unknown as Favoritos })
    const sacar = vi.spyOn(api, 'removeFavorite').mockResolvedValue(undefined as never)

    const boton = await screen.findByRole('button', { name: t['investor.favorites.unsave'] })
    expect(boton.getAttribute('aria-pressed')).toBe('true')
    await userEvent.click(boton)
    await waitFor(() => expect(sacar).toHaveBeenCalledWith('p1'))
  })

  it('INV-PROJECT-DOCS-002: sin documentos, el aviso vacío', async () => {
    montarConDatos()

    const docs = await screen.findByTestId('INV-PROJECT-DOCS-002')
    await within(docs).findByText(t['investor.project.docsEmpty'])
  })

  it('INV-PROJECT-DOCS-002: mientras cargan los documentos, un spinner', async () => {
    montarConDatos()
    vi.spyOn(api, 'listProjectDocuments').mockReturnValue(new Promise(() => {}))

    const docs = await screen.findByTestId('INV-PROJECT-DOCS-002')
    expect(within(docs).getByRole('status')).toBeTruthy()
  })

  it('INV-PROJECT-DOCS-002: documentos y fotos se separan; solo el anclado ofrece descarga', async () => {
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    montarConDatos({
      documentos: [
        documento('d1', { txid: 'tx-d1', anchorStatus: 'Confirmed' }),
        documento('d2'),
        fotoDoc('f1')
      ]
    })

    const docs = await screen.findByTestId('INV-PROJECT-DOCS-002')
    const anclado = (await within(docs).findByRole('button', { name: 'd1.pdf' })).closest(
      'article'
    )!
    const pendiente = within(docs).getByRole('button', { name: 'd2.pdf' }).closest('article')!
    // La foto no es un documento.
    expect(within(docs).queryByText('f1.jpg')).toBeNull()
    expect(anclado.textContent).toContain(t['status.verified'])
    expect(pendiente.textContent).toContain(t['status.pending'])
    expect(within(pendiente).queryByRole('button', { name: t['document.download'] })).toBeNull()

    await userEvent.click(within(anclado).getByRole('button', { name: t['document.download'] }))
    await waitFor(() => expect(clic).toHaveBeenCalled())
    expect(api.downloadEvidence).toHaveBeenCalledWith('d1')
  })

  it('abrir un documento anclado muestra el visor verificado con descarga', async () => {
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    montarConDatos({ documentos: [documento('d1', { txid: 'tx-d1', anchorStatus: 'Confirmed' })] })

    await userEvent.click(await screen.findByRole('button', { name: 'd1.pdf' }))

    const visor = await screen.findByRole('dialog')
    expect(visor.textContent).toContain('permit')
    expect(visor.textContent).toContain(t['status.verified'])
    await userEvent.click(within(visor).getByRole('button', { name: t['document.download'] }))
    await waitFor(() => expect(clic).toHaveBeenCalled())
  })

  it('abrir un documento sin anclar muestra el visor Pendiente, sin descarga, y Escape lo cierra', async () => {
    montarConDatos({ documentos: [documento('d2')] })

    await userEvent.click(await screen.findByRole('button', { name: 'd2.pdf' }))

    const visor = await screen.findByRole('dialog')
    expect(visor.textContent).toContain(t['status.pending'])
    expect(within(visor).queryByRole('button', { name: t['document.download'] })).toBeNull()
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('sin fotos, tocar la portada no abre nada', async () => {
    montarConDatos()
    await screen.findByRole('heading', { name: 'Torre Norte' })

    await userEvent.click(screen.getByRole('button', { name: t['investor.unit.openGallery'] }))

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('con fotos, la portada es la primera y tocarla abre la galería', async () => {
    montarConDatos({ documentos: [fotoDoc('f1'), fotoDoc('f2')] })

    // La portada tiene `alt=""` (decorativa): no hay rol `img` que consultar.
    await waitFor(() =>
      expect(document.querySelector('img')?.getAttribute('src')).toBe('blob:falso')
    )
    await userEvent.click(screen.getByRole('button', { name: t['investor.unit.openGallery'] }))

    const galeria = await screen.findByRole('dialog')
    // Al abrir se piden también las demás fotos.
    await waitFor(() => expect(galeria.textContent).toContain('/2'))
    await userEvent.click(
      within(galeria).getByRole('button', { name: t['investor.gallery.close'] })
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('un clic en una etapa del timeline navega a esa etapa', async () => {
    montarConDatos()

    await userEvent.click(await screen.findByRole('button', { name: 'Etapa-2' }))

    await screen.findByText('/project/$projectId/stage/$stageId')
  })

  it('"Ver el avance completo" navega al avance del proyecto', async () => {
    montarConDatos()

    await userEvent.click(
      await screen.findByRole('button', { name: t['investor.project.viewProgress'] })
    )

    await screen.findByText('/project/$projectId/progress')
  })

  it('volver lleva al listado de proyectos', async () => {
    montarConDatos()

    await userEvent.click(await screen.findByRole('button', { name: t['nav.back'] }))

    await screen.findByText('/investor/buy')
  })
})
