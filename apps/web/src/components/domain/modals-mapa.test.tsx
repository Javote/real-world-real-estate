import { act, fireEvent, render as renderRTL, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '#/i18n/useTranslation'
import * as L from '#/test/leaflet-falso'
import { LocationMapModal, type MapMarker } from './LocationMapModal'

vi.mock('leaflet', () => import('#/test/leaflet-falso'))
vi.mock('leaflet/dist/leaflet.css', () => ({}))

// SPEC-019 W7 · R7 + R8. El Leaflet falso guarda el callback de `moveend`.

function render(ui: ReactElement) {
  return renderRTL(ui, { wrapper: LocaleProvider })
}

const labels = { title: 'Mapa', close: 'Cerrar mapa', marker: 'Ubicación' }
const BA = [-34.6037, -58.3816]

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 0
  })
})

const mapaCreado = () => waitFor(() => expect(L.map).toHaveBeenCalled())
const ultimoMapa = () => L.map.mock.results.at(-1)?.value as ReturnType<typeof L.map>

type Props = Parameters<typeof LocationMapModal>[0]

// 🐞 En la variante `modal` el efecto que crea el mapa corre **antes** de que el
// portal de Radix monte su contenido (`contenedor.current` es `null`) y sus
// dependencias no cambian después, así que el mapa nunca se crea. Ver el
// `it.fails` de abajo. Para poder cubrir el resto de la variante, este helper
// re-renderiza con otro `zoom`: eso re-ejecuta el efecto con el contenedor ya
// montado.
function montarModal(props: Partial<Props> = {}) {
  const zoomFinal = props.zoom ?? 15
  const completo = (zoom: number) => (
    <LocationMapModal open onClose={vi.fn()} labels={labels} {...props} zoom={zoom} />
  )
  const r = render(completo(zoomFinal + 1))
  r.rerender(completo(zoomFinal))
  return { ...r, completo }
}

describe('LocationMapModal — variante modal', () => {
  it.fails('BUG: con open=true a secas el mapa se crea (hoy no: el portal aún no montó el contenedor)', async () => {
    render(<LocationMapModal open onClose={vi.fn()} labels={labels} />)
    await waitFor(() => expect(L.map).toHaveBeenCalled(), { timeout: 500 })
  })

  it('con coordenadas centra ahí, pone el marcador con su popup y muestra el domicilio', async () => {
    montarModal({
      latitude: -31.4,
      longitude: -64.2,
      zoom: 12,
      addressLabel: 'Av. Siempreviva 742',
      testId: 'MAPA'
    })
    await mapaCreado()
    expect(screen.getByTestId('MAPA')).toBeDefined()
    expect(screen.getByText('Av. Siempreviva 742')).toBeDefined()
    expect(ultimoMapa().setView).toHaveBeenCalledWith([-31.4, -64.2], 12)
    await waitFor(() => expect(L.marker).toHaveBeenCalledWith([-31.4, -64.2]))
    expect(L.marker.mock.results[0]?.value.bindPopup).toHaveBeenCalledWith('Ubicación')
  })

  it('sin coordenadas ni pines centra en Buenos Aires y no pone marcador ni domicilio', async () => {
    montarModal()
    await mapaCreado()
    expect(ultimoMapa().setView).toHaveBeenCalledWith(BA, 15)
    expect(L.marker).not.toHaveBeenCalled()
  })

  it('sin coordenadas propias pero con pines centra en el primero', async () => {
    montarModal({ markers: [{ id: 'a', latitude: -32, longitude: -60 }] })
    await mapaCreado()
    expect(ultimoMapa().setView).toHaveBeenCalledWith([-32, -60], 15)
  })

  it('con solo latitud usa el centro por defecto', async () => {
    montarModal({ latitude: -31 })
    await mapaCreado()
    expect(ultimoMapa().setView).toHaveBeenCalledWith(BA, 15)
    expect(L.marker).not.toHaveBeenCalled()
  })

  it('cerrado no crea el mapa', async () => {
    render(<LocationMapModal open={false} onClose={vi.fn()} labels={labels} />)
    await act(async () => {})
    expect(L.map).not.toHaveBeenCalled()
  })

  it('la X y Escape llaman a onClose', async () => {
    const onClose = vi.fn()
    montarModal({ onClose })
    await mapaCreado()
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar mapa' }))
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('al cerrarse destruye el mapa', async () => {
    const { rerender, completo } = montarModal()
    await mapaCreado()
    const mapa = ultimoMapa()
    await waitFor(() => expect(mapa.invalidateSize).toHaveBeenCalled())
    rerender(<LocationMapModal open={false} onClose={vi.fn()} labels={labels} />)
    expect(mapa.remove).toHaveBeenCalled()
    expect(completo).toBeDefined()
  })

  it('si se desmonta antes de que cargue Leaflet, no crea el mapa', async () => {
    const { unmount } = montarModal()
    unmount()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(L.map).not.toHaveBeenCalled()
  })
})

describe('LocationMapModal — variante browse', () => {
  const pines: MapMarker[] = [
    { id: 'a', latitude: -34.6, longitude: -58.4, label: 'desde US$ 1' },
    { id: 'b', latitude: -34.7, longitude: -58.5 }
  ]

  it('cerrado no renderiza nada', () => {
    const { container } = render(
      <LocationMapModal open={false} variant="browse" onClose={vi.fn()} labels={labels} />
    )
    expect(container.querySelector('div')).toBeNull()
  })

  it('sin botón de cierre; emite el bbox al crear y en cada moveend', async () => {
    const onBoundsChange = vi.fn()
    render(
      <LocationMapModal
        open
        variant="browse"
        onClose={vi.fn()}
        labels={labels}
        testId="BROWSE"
        onBoundsChange={onBoundsChange}
      />
    )
    await mapaCreado()
    expect(screen.getByTestId('BROWSE')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Cerrar mapa' })).toBeNull()
    await waitFor(() => expect(onBoundsChange).toHaveBeenCalledWith('-58.4,-34.7,-58.3,-34.5'))
    onBoundsChange.mockClear()
    act(() => L.dispararMoveend())
    expect(onBoundsChange).toHaveBeenCalledTimes(1)
  })

  it('el mapa solo reacciona a moveend: otro evento no dispara el bbox', async () => {
    const onBoundsChange = vi.fn()
    render(
      <LocationMapModal
        open
        variant="browse"
        onClose={vi.fn()}
        labels={labels}
        onBoundsChange={onBoundsChange}
      />
    )
    await mapaCreado()
    await waitFor(() => expect(onBoundsChange).toHaveBeenCalledTimes(1))
    // El Leaflet falso solo guarda el callback de `moveend`; cualquier otro se ignora.
    ultimoMapa().on('zoomend', vi.fn())
    act(() => L.dispararMoveend())
    expect(onBoundsChange).toHaveBeenCalledTimes(2)
  })

  it('moveend sin onBoundsChange no rompe', async () => {
    render(<LocationMapModal open variant="browse" onClose={vi.fn()} labels={labels} />)
    await mapaCreado()
    expect(() => act(() => L.dispararMoveend())).not.toThrow()
  })

  it('un pin con label usa divIcon y el otro marcador simple; clic elige el id; encuadra una sola vez', async () => {
    const onSelectMarker = vi.fn()
    const { rerender } = render(
      <LocationMapModal
        open
        variant="browse"
        onClose={vi.fn()}
        labels={labels}
        markers={pines}
        onSelectMarker={onSelectMarker}
      />
    )
    await mapaCreado()
    await waitFor(() => expect(L.marker).toHaveBeenCalledTimes(2))
    expect(L.divIcon).toHaveBeenCalledTimes(1)
    const opts = L.divIcon.mock.calls[0]?.[0] as { html: HTMLElement }
    expect(opts.html.textContent).toBe('desde US$ 1')
    expect(L.marker.mock.calls[0]?.[1]).toEqual({ icon: opts })
    expect(L.marker.mock.calls[1]?.[1]).toBeUndefined()

    const alClic = L.marker.mock.results[1]?.value.on.mock.calls[0]?.[1] as () => void
    alClic()
    expect(onSelectMarker).toHaveBeenCalledWith('b')

    const mapa = ultimoMapa()
    expect(mapa.fitBounds).toHaveBeenCalledTimes(1)

    // Otros pines: se re-sincronizan pero no se vuelve a encuadrar.
    rerender(
      <LocationMapModal
        open
        variant="browse"
        onClose={vi.fn()}
        labels={labels}
        markers={[{ id: 'c', latitude: -34.5, longitude: -58.3 }]}
      />
    )
    await waitFor(() => expect(L.marker).toHaveBeenCalledTimes(3))
    expect(mapa.fitBounds).toHaveBeenCalledTimes(1)
  })

  it('clic en un pin sin onSelectMarker no rompe', async () => {
    render(
      <LocationMapModal open variant="browse" onClose={vi.fn()} labels={labels} markers={pines} />
    )
    await waitFor(() => expect(L.marker).toHaveBeenCalledTimes(2))
    const alClic = L.marker.mock.results[0]?.value.on.mock.calls[0]?.[1] as () => void
    expect(() => alClic()).not.toThrow()
  })

  it('sin pines no encuadra', async () => {
    render(
      <LocationMapModal open variant="browse" onClose={vi.fn()} labels={labels} markers={[]} />
    )
    await mapaCreado()
    await waitFor(() => expect(ultimoMapa().invalidateSize).toHaveBeenCalled())
    expect(ultimoMapa().fitBounds).not.toHaveBeenCalled()
  })

  it('descarta los pines sin coordenadas', async () => {
    const raros = [
      { id: 'x', latitude: null, longitude: -58 },
      { id: 'y', latitude: -34, longitude: null },
      { id: 'z', latitude: -34.6, longitude: -58.4 }
    ] as unknown as MapMarker[]
    render(
      <LocationMapModal open variant="browse" onClose={vi.fn()} labels={labels} markers={raros} />
    )
    await waitFor(() => expect(L.marker).toHaveBeenCalledTimes(1))
  })
})
