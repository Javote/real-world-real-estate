import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '#/api/port'
import { dictionary } from '#/i18n/dictionary'
import { autenticarComo, INVESTOR_USER, montarRuta } from './-test-mount'
import { Route } from './investor.unit.$unitId.dossier'

const t = dictionary['es-AR']

type Dossier = Awaited<ReturnType<typeof api.getUnitDossier>>
type Unidad = Awaited<ReturnType<typeof api.getInvestorUnit>>
type Proyecto = Awaited<ReturnType<typeof api.getProject>>

const MASTER = 'a'.repeat(64)
const SHA = 'b'.repeat(64)
const TXID_FIRMA = 'f'.repeat(64)
const TXID_ARTEFACTO = 'e'.repeat(64)

const dossier = (over: Partial<Record<keyof Dossier, unknown>> = {}): Dossier =>
  ({
    id: 'd1',
    unitId: 'u1',
    unitReference: 'Torre A · 4B',
    projectId: 'p1',
    projectName: 'Torre A',
    masterHash: MASTER,
    compiledAt: '2026-09-01T00:00:00.000Z',
    status: 'signed',
    artifacts: [
      {
        kind: 'evidence',
        referenceId: 'e1',
        label: 'Plano general',
        sha256: SHA,
        txid: TXID_ARTEFACTO
      },
      { kind: 'stage', referenceId: 's1', label: 'Etapa sin hash', sha256: null, txid: null }
    ],
    completeness: 50,
    signatureTxid: TXID_FIRMA,
    signedAt: '2026-09-02T00:00:00.000Z',
    rejectionNote: null,
    ...over
  }) as unknown as Dossier

const unidad = (stages: unknown[] = []): Unidad =>
  ({ id: 'u1', unitReference: 'Torre A · 4B', projectId: 'p1', stages }) as unknown as Unidad

const stagesDeObra = [
  {
    stageId: 's1',
    name: 'Cimientos',
    sequenceOrder: 1,
    state: 'Completed',
    bundleId: null,
    txid: null
  },
  // Duplicado del join bundles/eventos: se muestra una sola vez.
  {
    stageId: 's1',
    name: 'Cimientos',
    sequenceOrder: 1,
    state: 'Completed',
    bundleId: 'b1',
    txid: 'x'
  },
  {
    stageId: 's2',
    name: 'Estructura',
    sequenceOrder: 2,
    state: 'InProgress',
    bundleId: null,
    txid: null
  }
]

const proyecto = (estimatedDelivery: string | null): Proyecto =>
  ({ id: 'p1', estimatedDelivery }) as unknown as Proyecto

const montar = () =>
  montarRuta(
    Route.options.component as () => React.ReactElement,
    '/investor/unit/$unitId/dossier',
    ['/investor/unit/$unitId'],
    '/investor/unit/u1/dossier'
  )

function preparar(
  opciones: {
    dossier?: Dossier | Error | 'cargando'
    unidad?: Unidad
    entrega?: string | null
  } = {}
) {
  autenticarComo(INVESTOR_USER)
  const d = opciones.dossier ?? dossier()
  vi.spyOn(api, 'getUnitDossier').mockImplementation(() =>
    d === 'cargando'
      ? new Promise(() => {})
      : d instanceof Error
        ? Promise.reject(d)
        : Promise.resolve(d)
  )
  vi.spyOn(api, 'getInvestorUnit').mockResolvedValue(opciones.unidad ?? unidad())
  return vi.spyOn(api, 'getProject').mockResolvedValue(proyecto(opciones.entrega ?? null))
}

describe('/investor/unit/$unitId/dossier', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('INV-DOSSIER-VIEW-001: dossier firmado — hash maestro, resumen, completitud y artefactos', async () => {
    preparar()
    montar()

    await screen.findByText(t['investor.dossier.certification'])
    const vista = screen.getByTestId('INV-DOSSIER-VIEW-001')
    await waitFor(() => expect(vista.textContent).toContain('Torre A · 4B'))
    expect(vista.textContent).toContain(t['investor.dossier.masterHash'])
    expect(vista.textContent).toContain('50%')
    expect(vista.textContent).toContain('Plano general')
    expect(vista.textContent).toContain('Etapa sin hash')
    // Firmado, y un artefacto verificado, el otro pendiente (regla 17).
    expect(vista.textContent).toContain(t['status.signed'])
    expect(vista.textContent).toContain(t['status.verified'])
    expect(vista.textContent).toContain(t['status.pending'])
  })

  it('sin firma del escribano el sello dice "pendiente", nunca "firmado"', async () => {
    preparar({
      dossier: dossier({ signatureTxid: null, signedAt: null, status: 'compiled', artifacts: [] })
    })
    montar()

    await screen.findByText(t['investor.dossier.certification'])
    const vista = screen.getByTestId('INV-DOSSIER-VIEW-001')
    expect(vista.textContent).not.toContain(t['status.signed'])
    expect(vista.textContent).toContain(t['status.pending'])
  })

  it('mientras carga no muestra el dossier pero sí las acciones', async () => {
    preparar({ dossier: 'cargando' })
    montar()

    await screen.findByRole('button', { name: t['investor.dossier.share'] })
    expect(screen.queryByText(t['investor.dossier.certification'])).toBeNull()
  })

  it('sin permiso (403) — error de acceso', async () => {
    preparar({ dossier: new ApiError(403, 'no') })
    montar()

    await screen.findByText(t['error.forbidden'])
    expect(screen.queryByText(t['investor.dossier.certification'])).toBeNull()
  })

  it('sin dossier (404) — no se encontró', async () => {
    preparar({ dossier: new ApiError(404, 'no') })
    montar()

    await screen.findByText(t['error.notFound'])
  })

  it('un error que no es de ausencia deja la pantalla con sus acciones y sin dossier', async () => {
    preparar({ dossier: new ApiError(500, 'boom') })
    montar()

    await screen.findByRole('button', { name: t['investor.dossier.export'] })
    // React Query reintenta un 500 (2 veces, con espera): recién después
    // deja de estar cargando, y ahí no hay dossier ni error de acceso.
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull(), { timeout: 6000 })
    expect(screen.queryByText(t['error.forbidden'])).toBeNull()
    expect(screen.queryByText(t['investor.dossier.certification'])).toBeNull()
  })

  it('con etapas de obra muestra el avance, sin duplicar la etapa del join', async () => {
    preparar({ unidad: unidad(stagesDeObra) })
    montar()

    await screen.findByText(t['investor.unit.progress'])
    const linea = screen.getByRole('list', { name: t['investor.project.timelineAria'] })
    expect(linea.querySelectorAll('li')).toHaveLength(2)
    expect(screen.getAllByTitle('Cimientos')).toHaveLength(1)
    expect(screen.getByTitle('Estructura').getAttribute('aria-current')).toBe('step')
  })

  it('sin etapas de obra no dibuja el avance', async () => {
    preparar()
    montar()

    await screen.findByText(t['investor.dossier.certification'])
    expect(screen.queryByText(t['investor.unit.progress'])).toBeNull()
  })

  it('con entrega estimada del proyecto la línea de tiempo la muestra como cierre', async () => {
    preparar({ unidad: unidad(stagesDeObra), entrega: '2027-03-15T12:00:00.000Z' })
    montar()

    await screen.findByText(t['investor.unit.progress'])
    await screen.findByText(/2027/)
  })

  it('INV-DOSSIER-EXPORT-002: exportar baja el PDF, y mientras exporta el botón se bloquea', async () => {
    preparar()
    let terminar: (b: Blob) => void = () => {}
    const exportar = vi
      .spyOn(api, 'exportUnitDossier')
      .mockImplementation(() => new Promise<Blob>((r) => (terminar = r)))
    const crear = vi.fn(() => 'blob:falso')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: crear, revokeObjectURL: vi.fn() }))
    montar()

    fireEvent.click(await screen.findByTestId('INV-DOSSIER-EXPORT-002'))

    await waitFor(() => expect(exportar).toHaveBeenCalledWith('u1'))
    const boton = await screen.findByRole('button', { name: t['investor.dossier.exporting'] })
    expect((boton as HTMLButtonElement).disabled).toBe(true)

    terminar(new Blob(['%PDF']))

    await waitFor(() => expect(crear).toHaveBeenCalled())
    await screen.findByRole('button', { name: t['investor.dossier.export'] })
  })

  it('INV-DOSSIER-SHARE-001: compartir abre el modal con el enlace público', async () => {
    preparar()
    const compartir = vi.spyOn(api, 'shareUnitDossier').mockResolvedValue({
      shareToken: 'tok123',
      path: '/public/dossier/tok123',
      masterHash: MASTER
    })
    montar()

    expect(screen.queryByTestId('INV-DOSSIER-SHARE-001')).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: t['investor.dossier.share'] }))

    const modal = await screen.findByTestId('INV-DOSSIER-SHARE-001')
    expect(compartir).toHaveBeenCalledWith('u1')
    expect(modal.textContent).toContain(t['investor.dossier.shareTitle'])
    // El enlace va en un HashChip: se ven los primeros y los últimos caracteres.
    expect(modal.textContent).toContain('k123')
  })

  it('el modal de compartir se cierra con Escape', async () => {
    preparar()
    vi.spyOn(api, 'shareUnitDossier').mockResolvedValue({
      shareToken: 'tok123',
      path: '/public/dossier/tok123',
      masterHash: MASTER
    })
    montar()

    fireEvent.click(await screen.findByRole('button', { name: t['investor.dossier.share'] }))
    await screen.findByTestId('INV-DOSSIER-SHARE-001')

    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByTestId('INV-DOSSIER-SHARE-001')).toBeNull())
  })

  it('el botón de volver lleva al detalle de la unidad', async () => {
    preparar()
    const router = montar()

    fireEvent.click(await screen.findByRole('button', { name: t['investor.dossier.back'] }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/investor/unit/u1'))
  })
})
