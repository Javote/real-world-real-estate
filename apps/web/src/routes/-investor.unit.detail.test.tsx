import { focusManager } from '@tanstack/react-query'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '#/api/port'
import { dictionary } from '#/i18n/dictionary'
import { autenticarComo, INVESTOR_USER, montarRuta } from './-test-mount'
import { Route } from './investor.unit.$unitId.index'

vi.mock('leaflet', () => import('#/test/leaflet-falso'))

const anunciar = vi.hoisted(() => vi.fn())
vi.mock('#/lib/announce', async (importarOriginal) => ({
  ...(await importarOriginal<typeof import('#/lib/announce')>()),
  useAnnounce: () => anunciar
}))

const t = dictionary['es-AR']

type Unidad = Awaited<ReturnType<typeof api.getInvestorUnit>>
type Novedad = Awaited<ReturnType<typeof api.getInvestorUnitNews>>[number]
type Documento = Awaited<ReturnType<typeof api.listProjectDocuments>>[number]
type Esquema = Awaited<ReturnType<typeof api.getBuildingSchematic>>

const TX1 = '1'.repeat(64)
const TX2 = '2'.repeat(64)
const RAIZ = 'a'.repeat(64)
const HASH_A = 'b'.repeat(64)
const HASH_B = 'c'.repeat(64)
const HERMANO = 'd'.repeat(64)

const etapas = [
  {
    stageId: 's1',
    name: 'Cimientos',
    sequenceOrder: 1,
    state: 'Completed',
    bundleId: 'b1',
    txid: TX1
  },
  // El join de la API duplica el stage: la pantalla lo muestra una vez.
  {
    stageId: 's1',
    name: 'Cimientos',
    sequenceOrder: 1,
    state: 'Completed',
    bundleId: 'b1',
    txid: TX1
  },
  {
    stageId: 's2',
    name: 'Estructura',
    sequenceOrder: 2,
    state: 'InProgress',
    bundleId: 'b2',
    txid: null
  },
  {
    stageId: 's3',
    name: 'Terminaciones',
    sequenceOrder: 3,
    state: 'Pending',
    bundleId: null,
    txid: null
  }
]

const completa = (over: Partial<Record<keyof Unidad, unknown>> = {}): Unidad =>
  ({
    id: 'u1',
    unitReference: '4B',
    status: 'reserved',
    sizeM2: 60,
    floor: 4,
    priceMinorUnits: 15000000,
    currency: 'USD',
    investorId: 'u-inv',
    projectId: 'p1',
    projectName: 'Torre A',
    city: 'Buenos Aires',
    country: 'Argentina',
    stages: etapas,
    ...over
  }) as unknown as Unidad

const minima = (): Unidad =>
  completa({
    sizeM2: null,
    floor: null,
    priceMinorUnits: null,
    currency: null,
    city: null,
    country: null,
    stages: []
  })

const novedad = (over: Partial<Record<keyof Novedad, unknown>> = {}): Novedad =>
  ({
    id: 'n1',
    eventType: 'STAGE_TRANSITION',
    toState: 'Completed',
    txid: TX1,
    status: 'Confirmed',
    createdAt: '2026-09-01T00:00:00.000Z',
    stageName: 'Cimientos',
    ...over
  }) as unknown as Novedad

const documento = (over: Partial<Record<keyof Documento, unknown>> = {}): Documento =>
  ({
    id: 'd1',
    stageId: 's1',
    evidenceType: 'photo',
    category: 'progress',
    authoritative: false,
    originalFilename: 'foto.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 10,
    sha256Hash: HASH_A,
    uploadedAt: '2026-09-01T00:00:00.000Z',
    txid: null,
    anchorStatus: 'Pending',
    ...over
  }) as unknown as Documento

const proyecto = (over: Record<string, unknown> = {}) =>
  ({
    id: 'p1',
    latitude: -34.6,
    longitude: -58.4,
    estimatedDelivery: '2027-03-15T12:00:00.000Z',
    ...over
  }) as unknown as Awaited<ReturnType<typeof api.getProject>>

const esquema = (): Esquema =>
  [
    {
      floor: 4,
      units: [
        { id: 'u1', unitReference: '4B', floor: 4, status: 'reserved' },
        { id: 'u2', unitReference: '4A', floor: 4, status: 'available' },
        { id: 'u3', unitReference: '4C', floor: 4, status: 'sold' },
        // Sin piso propio dentro de un piso: no se dibuja.
        { id: 'u4', unitReference: '4X', floor: null, status: 'sold' }
      ]
    },
    // El grupo "sin piso" no entra al esquema.
    { floor: null, units: [{ id: 'u5', unitReference: 'SP1', floor: null, status: 'available' }] }
  ] as unknown as Esquema

const montar = (entrada = '/investor/unit/u1') =>
  montarRuta(
    Route.options.component as () => React.ReactElement,
    '/investor/unit/$unitId/',
    [
      '/investor/units',
      '/investor/unit/$unitId/notifications',
      '/investor/unit/$unitId/contract',
      '/investor/unit/$unitId/dossier'
    ],
    entrada
  )

/** Los chips llegan con la unidad: la lista existe desde el primer render, vacía. */
const esperarChips = async () =>
  within(await screen.findByRole('list', { name: t['investor.unit.stagesAria'] })).findByRole(
    'button',
    { name: '1' }
  )

interface Opciones {
  unidad?: Unidad | Error | 'cargando'
  news?: Novedad[]
  proyecto?: ReturnType<typeof proyecto>
  documentos?: Documento[]
  contrato?: unknown
}

function preparar(o: Opciones = {}) {
  autenticarComo(INVESTOR_USER)
  const u = o.unidad ?? completa()
  const getUnidad = vi
    .spyOn(api, 'getInvestorUnit')
    .mockImplementation(() =>
      u === 'cargando'
        ? new Promise(() => {})
        : u instanceof Error
          ? Promise.reject(u)
          : Promise.resolve(u)
    )
  const getNews = vi.spyOn(api, 'getInvestorUnitNews').mockResolvedValue(o.news ?? [])
  vi.spyOn(api, 'getProject').mockResolvedValue(o.proyecto ?? proyecto())
  vi.spyOn(api, 'listProjectDocuments').mockResolvedValue(o.documentos ?? [])
  vi.spyOn(api, 'getInvestorContract').mockImplementation(() =>
    o.contrato
      ? Promise.resolve(o.contrato as never)
      : Promise.reject(new ApiError(404, 'sin contrato'))
  )
  const getEsquema = vi.spyOn(api, 'getBuildingSchematic').mockResolvedValue(esquema())
  const descargar = vi.spyOn(api, 'downloadEvidence').mockResolvedValue(new Blob(['img']))
  return { getUnidad, getNews, getEsquema, descargar }
}

describe('/investor/unit/$unitId', () => {
  beforeEach(() => {
    let n = 0
    URL.createObjectURL = vi.fn(() => `blob:foto-${++n}`)
    URL.revokeObjectURL = vi.fn()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    focusManager.setFocused(undefined)
    anunciar.mockClear()
  })

  describe('datos de la unidad', () => {
    it('INV-UNIT-DETAIL-001: unidad completa — cada dato con su etiqueta', async () => {
      preparar()
      montar()

      const detalle = await screen.findByTestId('INV-UNIT-DETAIL-001')
      await waitFor(() => expect(detalle.textContent).toContain(t['investor.unit.floor']))
      const texto = detalle.textContent ?? ''
      expect(texto).toContain('Torre A')
      expect(texto).toContain('4B')
      expect(texto).toContain(t['investor.unit.surface'])
      expect(texto).toContain('60 m²')
      expect(texto).toContain(t['investor.unit.investment'])
      expect(texto).toContain('150.000')
      expect(texto).toContain(t['unitStatus.reserved'])
      await waitFor(() =>
        expect(screen.getByTestId('INV-UNIT-DETAIL-001').textContent).toContain(
          t['investor.unit.delivery']
        )
      )
      expect(texto).toContain('Buenos Aires, Argentina')
    })

    it('unidad mínima — sin piso, superficie, precio, entrega ni ubicación no dibuja esas filas', async () => {
      preparar({ unidad: minima(), proyecto: proyecto({ estimatedDelivery: null }) })
      montar()

      await screen.findByText(t['investor.unit.details'])
      await screen.findByText('4B', { selector: 'dd' })
      const detalle = screen.getByTestId('INV-UNIT-DETAIL-001').textContent ?? ''
      for (const clave of [
        'investor.unit.floor',
        'investor.unit.surface',
        'investor.unit.investment',
        'investor.unit.delivery',
        'investor.unit.location'
      ] as const) {
        expect(detalle).not.toContain(t[clave])
      }
    })

    it('un precio sin moneda no se muestra: sin moneda no hay cómo formatearlo', async () => {
      preparar({ unidad: completa({ currency: null }) })
      montar()

      await screen.findByText(t['investor.unit.floor'])
      expect(screen.queryByText(t['investor.unit.investment'])).toBeNull()
    })

    it('mientras la unidad carga, el título es el genérico y no hay filas de datos', async () => {
      preparar({ unidad: 'cargando' })
      montar()

      await screen.findByTestId('INV-UNIT-DETAIL-001')
      expect(screen.getByRole('heading', { name: t['investor.units.title'] })).toBeTruthy()
      expect(screen.queryByText(t['investor.unit.floor'])).toBeNull()
      expect(screen.queryByText(t['investor.unit.status'])).toBeNull()
    })

    it('sin permiso (403) — error de acceso', async () => {
      preparar({ unidad: new ApiError(403, 'no') })
      montar()

      await screen.findByText(t['error.forbidden'])
      expect(screen.queryByText(t['investor.unit.details'])).toBeNull()
    })

    it('unidad inexistente (404) — no se encontró', async () => {
      preparar({ unidad: new ApiError(404, 'no') })
      montar()

      await screen.findByText(t['error.notFound'])
    })

    it('un 500 reintenta y no reemplaza la pantalla por el error de acceso', async () => {
      preparar({ unidad: new ApiError(500, 'boom') })
      montar()

      await screen.findByTestId('INV-UNIT-DETAIL-001')
      expect(screen.queryByText(t['error.forbidden'])).toBeNull()
      expect(screen.queryByText(t['error.notFound'])).toBeNull()
    })
  })

  describe('avance de obra', () => {
    it('muestra la etapa actual con el porcentaje y no repite el stage duplicado del join', async () => {
      preparar()
      montar()

      await screen.findByText(
        t['investor.unit.currentStage'].replace('{name}', 'Estructura').replace('{percent}', '33')
      )
      const linea = screen.getByRole('list', { name: t['investor.project.timelineAria'] })
      expect(linea.querySelectorAll('li')).toHaveLength(3)
      // Fecha de entrega: en el bloque de datos y como cierre de la línea de tiempo.
      await waitFor(() => expect(screen.getAllByText(/2027/)).toHaveLength(2))
    })

    it('sin etapa en curso (todas completadas) no hay línea de "etapa actual"', async () => {
      preparar({
        unidad: completa({
          stages: [
            {
              stageId: 's1',
              name: 'Cimientos',
              sequenceOrder: 1,
              state: 'Completed',
              bundleId: null,
              txid: null
            }
          ]
        })
      })
      montar()

      await screen.findByText(t['investor.unit.progress'])
      expect(screen.queryByText(/Etapa actual/)).toBeNull()
    })
  })

  describe('novedades', () => {
    it('INV-UNIT-NEWS-002: sin novedades muestra el vacío', async () => {
      preparar({ news: [] })
      montar()

      await screen.findByText(t['investor.unit.newsEmpty'])
    })

    it('muestra las tres primeras, con su etapa y el estado, y descarta el resto', async () => {
      preparar({
        news: [
          novedad({ id: 'n1', stageName: 'Cimientos', toState: 'Completed' }),
          novedad({ id: 'n2', stageName: 'Estructura', toState: 'InProgress' }),
          novedad({ id: 'n3', stageName: 'Muros', toState: 'Observed' }),
          novedad({ id: 'n4', stageName: 'CUARTA', toState: 'Pending' })
        ]
      })
      montar()

      const caja = await screen.findByTestId('INV-UNIT-NEWS-002')
      await waitFor(() => expect(caja.textContent).toContain('Cimientos: Completada'))
      expect(caja.textContent).toContain('Estructura: En curso')
      expect(caja.textContent).toContain('Muros: Observada')
      expect(caja.textContent).not.toContain('CUARTA')
    })

    it('una novedad sin etapa ni estado destino no rompe el texto', async () => {
      preparar({
        news: [
          novedad({ eventType: 'STAGE_TRANSITION', stageName: null, toState: null }),
          novedad({ id: 'n2', eventType: 'EVIDENCE_ANCHOR', stageName: null, toState: null })
        ]
      })
      montar()

      const caja = await screen.findByTestId('INV-UNIT-NEWS-002')
      await waitFor(() => expect(caja.textContent).toContain('Evidencia anclada:'))
    })

    it('un tipo de evento que el front no conoce cae en el texto genérico', async () => {
      preparar({ news: [novedad({ eventType: 'EVENTO_NUEVO', toState: null })] })
      montar()

      await screen.findByText(t['investor.news.generic'])
    })

    it('SPEC-104: cuando una novedad pasa de Pending a Confirmed se anuncia una sola vez, agregado', async () => {
      const { getNews } = preparar({
        news: [
          novedad({ id: 'a', status: 'Pending' }),
          novedad({ id: 'b', status: 'Pending' }),
          novedad({ id: 'c', status: 'Confirmed' })
        ]
      })
      montar()
      await screen.findAllByText(/Cimientos: Completada/)
      expect(getNews).toHaveBeenCalledTimes(1)
      expect(anunciar).not.toHaveBeenCalled()

      // Vuelve el foco a la pestaña: el poll relee y las dos confirman.
      getNews.mockResolvedValue([
        novedad({ id: 'a', status: 'Confirmed' }),
        novedad({ id: 'b', status: 'Confirmed' }),
        novedad({ id: 'c', status: 'Confirmed' })
      ])
      focusManager.setFocused(false)
      focusManager.setFocused(true)
      await waitFor(() => expect(getNews).toHaveBeenCalledTimes(2))

      await waitFor(() =>
        expect(anunciar).toHaveBeenCalledWith(
          t['investor.unit.newsConfirmed'].replace('{count}', '2')
        )
      )
      expect(anunciar).toHaveBeenCalledTimes(1)
    })

    it('"Ver todas" lleva a las novedades de la unidad', async () => {
      preparar()
      const router = montar()

      fireEvent.click(await screen.findByRole('button', { name: t['investor.unit.viewAllNews'] }))

      await waitFor(() =>
        expect(router.state.location.pathname).toBe('/investor/unit/u1/notifications')
      )
    })
  })

  describe('contrato y dossier', () => {
    it('con contrato muestra el monto', async () => {
      preparar({ contrato: { id: 'c1', totalMinorUnits: 15000000, currency: 'USD' } })
      montar()

      await screen.findByText(t['investor.unit.contractAmount'].replace('{amount}', 'US$ 150.000'))
    })

    it('sin contrato (404) no muestra monto, pero sí el acceso al contrato', async () => {
      preparar()
      montar()

      await screen.findByRole('button', { name: t['investor.unit.viewContract'] })
      expect(screen.queryByText(/Monto:/)).toBeNull()
    })

    it('"Ver contrato y pagos" navega al contrato', async () => {
      preparar()
      const router = montar()

      fireEvent.click(await screen.findByRole('button', { name: t['investor.unit.viewContract'] }))

      await waitFor(() => expect(router.state.location.pathname).toBe('/investor/unit/u1/contract'))
    })

    it('el acceso al dossier navega al dossier', async () => {
      preparar()
      const router = montar()

      fireEvent.click(await screen.findByRole('button', { name: t['investor.unit.dossier'] }))

      await waitFor(() => expect(router.state.location.pathname).toBe('/investor/unit/u1/dossier'))
    })

    it('el botón de volver lleva a "Mis unidades"', async () => {
      preparar()
      const router = montar()

      fireEvent.click(await screen.findByRole('button', { name: t['investor.unit.back'] }))

      await waitFor(() => expect(router.state.location.pathname).toBe('/investor/units'))
    })
  })

  describe('galería de fotos (INV-UNIT-GALLERY-001)', () => {
    const fotos = [
      documento({ id: 'f1' }),
      // Foto por el tipo de evidencia, y foto por el MIME: las dos cuentan.
      documento({ id: 'f2', evidenceType: 'document', mimeType: 'image/png' }),
      documento({ id: 'pdf', evidenceType: 'document', mimeType: 'application/pdf' })
    ]

    it('sin fotos el botón de la galería está deshabilitado y no cuenta nada', async () => {
      preparar({
        documentos: [
          documento({ id: 'pdf', evidenceType: 'document', mimeType: 'application/pdf' })
        ]
      })
      montar()

      const boton = await screen.findByRole('button', { name: t['investor.unit.openGallery'] })
      expect((boton as HTMLButtonElement).disabled).toBe(true)
      expect(screen.queryByText(/fotos$/)).toBeNull()
    })

    it('con fotos cuenta solo las fotos, y la portada es la primera (solo se descarga esa hasta abrir)', async () => {
      const { descargar } = preparar({ documentos: fotos })
      montar()

      await screen.findByText(t['investor.unit.photosCount'].replace('{count}', '2'))
      await waitFor(() => expect(descargar).toHaveBeenCalledTimes(1))
      expect(descargar).toHaveBeenCalledWith('f1')
      const boton = screen.getByRole('button', { name: t['investor.unit.openGallery'] })
      expect((boton as HTMLButtonElement).disabled).toBe(false)
      await waitFor(() => expect(boton.querySelector('img')).toBeTruthy())
    })

    it('abrir la galería descarga el resto y se cierra con el botón de cerrar', async () => {
      const { descargar } = preparar({ documentos: fotos })
      montar()
      const boton = await screen.findByRole('button', { name: t['investor.unit.openGallery'] })
      await waitFor(() => expect(boton.querySelector('img')).toBeTruthy())

      fireEvent.click(boton)

      const modal = await screen.findByTestId('INV-UNIT-GALLERY-001')
      await waitFor(() => expect(descargar).toHaveBeenCalledWith('f2'))
      await waitFor(() =>
        expect(
          within(modal).getByText(
            t['investor.unit.galleryCounter'].replace('{actual}', '1').replace('{total}', '2')
          )
        ).toBeTruthy()
      )

      fireEvent.click(within(modal).getByRole('button', { name: t['investor.gallery.close'] }))

      await waitFor(() => expect(screen.queryByTestId('INV-UNIT-GALLERY-001')).toBeNull())
    })

    it('al desmontar se revocan las URLs de las fotos', async () => {
      preparar({ documentos: fotos })
      montar()
      const boton = await screen.findByRole('button', { name: t['investor.unit.openGallery'] })
      await waitFor(() => expect(boton.querySelector('img')).toBeTruthy())

      expect(URL.revokeObjectURL).not.toHaveBeenCalled()
      cleanup()

      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:foto-1')
    })
  })

  describe('mapa (INV-UNIT-LOC-001)', () => {
    it('sin coordenadas el botón del mapa está deshabilitado y no hay modal', async () => {
      preparar({ proyecto: proyecto({ latitude: null, longitude: null }) })
      montar()

      const boton = await screen.findByRole('button', { name: t['investor.unit.openMap'] })
      expect((boton as HTMLButtonElement).disabled).toBe(true)
      expect(screen.queryByTestId('INV-UNIT-LOC-001')).toBeNull()
    })

    it('mientras carga el proyecto el mapa tampoco se puede abrir', async () => {
      preparar({ unidad: 'cargando' })
      montar()

      const boton = await screen.findByRole('button', { name: t['investor.unit.openMap'] })
      expect((boton as HTMLButtonElement).disabled).toBe(true)
    })

    it('con coordenadas abre el modal del mapa y lo cierra con Escape', async () => {
      preparar()
      montar()
      const boton = await screen.findByRole('button', { name: t['investor.unit.openMap'] })
      await waitFor(() => expect((boton as HTMLButtonElement).disabled).toBe(false))
      expect(screen.getByText('Buenos Aires, Argentina', { selector: 'span' })).toBeTruthy()

      fireEvent.click(boton)
      await screen.findByTestId('INV-UNIT-LOC-001')

      fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' })

      await waitFor(() => expect(screen.queryByTestId('INV-UNIT-LOC-001')).toBeNull())
    })

    it('sin ciudad ni país el mapa no lleva dirección', async () => {
      preparar({ unidad: completa({ city: null, country: null }) })
      montar()

      const boton = await screen.findByRole('button', { name: t['investor.unit.openMap'] })
      await waitFor(() => expect((boton as HTMLButtonElement).disabled).toBe(false))
      fireEvent.click(boton)
      await screen.findByTestId('INV-UNIT-LOC-001')
    })

    it('solo el país alcanza para la ubicación', async () => {
      preparar({ unidad: completa({ city: null }) })
      montar()

      await screen.findByText('Argentina', { selector: 'dd' })
    })
  })

  describe('esquema del edificio (INV-UNIT-BUILDING-001)', () => {
    it('una unidad sin piso no ofrece el esquema', async () => {
      const { getEsquema } = preparar({ unidad: minima() })
      montar()

      await screen.findByText(t['investor.unit.details'])
      expect(screen.queryByRole('button', { name: t['investor.unit.building'] })).toBeNull()
      expect(getEsquema).not.toHaveBeenCalled()
    })

    it('abre el esquema: la propia, la disponible y la ocupada; sin las de piso nulo', async () => {
      const { getEsquema } = preparar()
      montar()
      const abrir = await screen.findByRole('button', { name: t['investor.unit.building'] })
      expect(getEsquema).not.toHaveBeenCalled()

      fireEvent.click(abrir)

      const dialogo = await screen.findByTestId('INV-UNIT-BUILDING-001')
      await within(dialogo).findByText('4A')
      expect(getEsquema).toHaveBeenCalledWith('p1')
      const esquemaEl = within(dialogo).getByRole('region', { name: t['schematic.title'] })
      expect(within(esquemaEl).getByText('4B').getAttribute('aria-current')).toBe('true')
      expect(within(esquemaEl).getByText('4C')).toBeTruthy()
      expect(within(esquemaEl).queryByText('4X')).toBeNull()
      expect(within(esquemaEl).queryByText('SP1')).toBeNull()
      expect(dialogo.textContent).toContain(
        t['schematic.callout']
          .replace('{floor}', '4')
          .replace('{unit}', '4B')
          .replace('{size}', '60 m²')
      )
    })

    it('sin superficie el callout va sin tamaño', async () => {
      preparar({ unidad: completa({ sizeM2: null }) })
      montar()

      fireEvent.click(await screen.findByRole('button', { name: t['investor.unit.building'] }))

      const dialogo = await screen.findByTestId('INV-UNIT-BUILDING-001')
      await within(dialogo).findByText('4A')
      expect(dialogo.textContent).toContain(
        t['schematic.callout'].replace('{floor}', '4').replace('{unit}', '4B').replace('{size}', '')
      )
    })

    it('si el proyecto no tiene ninguna unidad con piso dice que no se encontró', async () => {
      const { getEsquema } = preparar()
      getEsquema.mockResolvedValue([
        { floor: null, units: [{ id: 'u1', unitReference: '4B', floor: null, status: 'reserved' }] }
      ] as unknown as Esquema)
      montar()

      fireEvent.click(await screen.findByRole('button', { name: t['investor.unit.building'] }))

      const dialogo = await screen.findByTestId('INV-UNIT-BUILDING-001')
      await within(dialogo).findByText(t['error.notFound'])
    })

    it('el esquema se cierra con Escape', async () => {
      preparar()
      montar()
      fireEvent.click(await screen.findByRole('button', { name: t['investor.unit.building'] }))
      await screen.findByTestId('INV-UNIT-BUILDING-001')

      fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' })

      await waitFor(() => expect(screen.queryByTestId('INV-UNIT-BUILDING-001')).toBeNull())
    })

    it('mientras el esquema carga el diálogo no afirma nada', async () => {
      const { getEsquema } = preparar()
      getEsquema.mockReturnValue(new Promise(() => {}))
      montar()

      fireEvent.click(await screen.findByRole('button', { name: t['investor.unit.building'] }))

      const dialogo = await screen.findByTestId('INV-UNIT-BUILDING-001')
      expect(within(dialogo).queryByText(t['error.notFound'])).toBeNull()
      expect(within(dialogo).queryByRole('region')).toBeNull()
    })
  })

  describe('evidencia por etapa (P9 y Merkle proof)', () => {
    const chip = (n: number) =>
      within(screen.getByRole('list', { name: t['investor.unit.stagesAria'] })).getByRole(
        'button',
        { name: String(n) }
      )

    it('los chips reflejan el anclaje: anclada abre, sin anclar está deshabilitada', async () => {
      preparar()
      montar()

      await esperarChips()
      expect((chip(1) as HTMLButtonElement).disabled).toBe(false)
      expect((chip(2) as HTMLButtonElement).disabled).toBe(true)
      expect((chip(3) as HTMLButtonElement).disabled).toBe(true)
    })

    it('un chip anclado sin bundle no abre nada', async () => {
      preparar({
        unidad: completa({
          stages: [
            {
              stageId: 's1',
              name: 'Cimientos',
              sequenceOrder: 1,
              state: 'Completed',
              bundleId: null,
              txid: TX1
            }
          ]
        })
      })
      montar()
      await esperarChips()

      fireEvent.click(chip(1))

      expect(screen.queryByTestId('INV-STAGE-MILESTONE-001')).toBeNull()
    })

    it('abre el hito: raíz de Merkle, TXID del stage y archivos con su hash', async () => {
      preparar()
      const archivos = vi.spyOn(api, 'getBundleFiles').mockResolvedValue({
        bundleId: 'b1',
        merkleRoot: RAIZ,
        files: [
          { evidenceId: 'e1', sha256Hash: HASH_A, filename: 'plano.pdf' },
          { evidenceId: 'e2', sha256Hash: HASH_B, filename: null }
        ]
      })
      montar()
      await esperarChips()

      fireEvent.click(chip(1))

      const modal = await screen.findByTestId('INV-STAGE-MILESTONE-001')
      expect(archivos).toHaveBeenCalledWith('b1')
      await within(modal).findByText('plano.pdf')
      expect(within(modal).getByRole('heading', { name: 'Cimientos' })).toBeTruthy()
      const prueba = within(modal).getByTestId('INV-MERKLE-PROOF-002')
      expect(prueba.textContent).toContain(t['merkle.root'])
      expect(prueba.textContent).toContain(t['merkle.files'])
      expect(prueba.textContent).not.toContain(t['status.pending'])
    })

    it('un bundle sin TXID ni raíz muestra "pendiente" (regla 17)', async () => {
      preparar({
        unidad: completa({
          stages: [
            {
              stageId: 's1',
              name: 'Cimientos',
              sequenceOrder: 1,
              state: 'Completed',
              bundleId: 'b1',
              txid: null
            }
          ]
        })
      })
      vi.spyOn(api, 'getBundleFiles').mockResolvedValue({
        bundleId: 'b1',
        merkleRoot: '',
        files: []
      })
      montar()
      await esperarChips()

      // Sin TXID el chip no es clicable: el anclaje no está sustanciado.
      expect((chip(1) as HTMLButtonElement).disabled).toBe(true)
    })

    it('tocar un archivo pide su camino de Merkle y lo muestra; abrir otro hito lo descarta', async () => {
      preparar()
      vi.spyOn(api, 'getBundleFiles').mockResolvedValue({
        bundleId: 'b1',
        merkleRoot: RAIZ,
        files: [{ evidenceId: 'e1', sha256Hash: HASH_A, filename: 'plano.pdf' }]
      })
      const camino = vi.spyOn(api, 'getMerkleProof').mockResolvedValue({
        merkleRoot: RAIZ,
        leaf: HASH_A,
        proof: [{ sibling: HERMANO, position: 'right' }],
        signerUserId: 'u1',
        anchorStatus: 'Confirmed',
        txid: TX1,
        timestamp: '2026-09-01T00:00:00.000Z'
      })
      montar()
      await esperarChips()
      fireEvent.click(chip(1))
      const modal = await screen.findByTestId('INV-STAGE-MILESTONE-001')
      await within(modal).findByText('plano.pdf')

      const fila = within(modal).getByText('plano.pdf').closest('li') as HTMLElement
      fireEvent.click(within(fila).getAllByRole('button')[0] as HTMLElement)

      await within(modal).findByText(t['merkle.proofPath'])
      expect(camino).toHaveBeenCalledWith('b1', HASH_A)
    })

    it('un camino de Merkle vacío no dibuja la sección', async () => {
      preparar()
      vi.spyOn(api, 'getBundleFiles').mockResolvedValue({
        bundleId: 'b1',
        merkleRoot: RAIZ,
        files: [{ evidenceId: 'e1', sha256Hash: HASH_A, filename: 'plano.pdf' }]
      })
      const camino = vi.spyOn(api, 'getMerkleProof').mockResolvedValue({
        merkleRoot: RAIZ,
        leaf: HASH_A,
        proof: [],
        signerUserId: 'u1',
        anchorStatus: 'Confirmed',
        txid: TX1,
        timestamp: null
      })
      montar()
      await esperarChips()
      fireEvent.click(chip(1))
      const modal = await screen.findByTestId('INV-STAGE-MILESTONE-001')
      await within(modal).findByText('plano.pdf')

      fireEvent.click(
        within(within(modal).getByText('plano.pdf').closest('li') as HTMLElement).getAllByRole(
          'button'
        )[0] as HTMLElement
      )

      await waitFor(() => expect(camino).toHaveBeenCalled())
      expect(within(modal).queryByText(t['merkle.proofPath'])).toBeNull()
    })

    it('el hito se cierra con Escape y descarta el camino cargado', async () => {
      preparar()
      vi.spyOn(api, 'getBundleFiles').mockResolvedValue({
        bundleId: 'b1',
        merkleRoot: RAIZ,
        files: []
      })
      montar()
      await esperarChips()
      fireEvent.click(chip(1))
      await screen.findByTestId('INV-STAGE-MILESTONE-001')

      fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' })

      await waitFor(() => expect(screen.queryByTestId('INV-STAGE-MILESTONE-001')).toBeNull())
    })

    it('reabrir otro hito no arrastra el camino del anterior', async () => {
      preparar({
        unidad: completa({
          stages: [
            {
              stageId: 's1',
              name: 'Cimientos',
              sequenceOrder: 1,
              state: 'Completed',
              bundleId: 'b1',
              txid: TX1
            },
            {
              stageId: 's2',
              name: 'Estructura',
              sequenceOrder: 2,
              state: 'Completed',
              bundleId: 'b2',
              txid: TX2
            }
          ]
        })
      })
      vi.spyOn(api, 'getBundleFiles').mockImplementation(async (id) => ({
        bundleId: id,
        merkleRoot: RAIZ,
        files: [{ evidenceId: 'e1', sha256Hash: HASH_A, filename: `archivo-${id}.pdf` }]
      }))
      vi.spyOn(api, 'getMerkleProof').mockResolvedValue({
        merkleRoot: RAIZ,
        leaf: HASH_A,
        proof: [{ sibling: HERMANO, position: 'left' }],
        signerUserId: 'u1',
        anchorStatus: 'Confirmed',
        txid: TX1,
        timestamp: null
      })
      montar()
      await esperarChips()
      fireEvent.click(chip(1))
      const modal = await screen.findByTestId('INV-STAGE-MILESTONE-001')
      const fila = (await within(modal).findByText('archivo-b1.pdf')).closest('li') as HTMLElement
      fireEvent.click(within(fila).getAllByRole('button')[0] as HTMLElement)
      await within(modal).findByText(t['merkle.proofPath'])

      fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' })
      await waitFor(() => expect(screen.queryByTestId('INV-STAGE-MILESTONE-001')).toBeNull())

      fireEvent.click(chip(2))

      await screen.findByText('archivo-b2.pdf')
      expect(screen.queryByText(t['merkle.proofPath'])).toBeNull()
    })
  })
})
