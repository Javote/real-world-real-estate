// Leaflet real no corre en jsdom (no hay layout, no hay tiles). `LocationMapModal`
// lo carga con `import()` dinámico — SPEC-019 §Paso 0, punto 9: un `L` falso,
// compartido por los cuatro lotes que montan el mapa (investor.buy,
// investor.unit.$unitId.index, project.$projectId.index, LocationMapModal).
//
// Uso: `vi.mock('leaflet', () => import('#/test/leaflet-falso'))` al principio
// del archivo de test. Para disparar `moveend` a mano: `dispararMoveend()`;
// un clic en el mapa (variante `picker`): `dispararClick(lat, lng)`. `estado`
// fija lo que el mapa responde a `getZoom()` y a `getBounds().contains()`.
import { vi } from 'vitest'

interface BoundsFalsos {
  getWest(): number
  getSouth(): number
  getEast(): number
  getNorth(): number
}

/** Lo que el mapa falso contesta; cada test lo puede fijar. */
export const estado = { zoom: 15, contiene: true }

const boundsPorDefecto: BoundsFalsos & { contains: () => boolean } = {
  getWest: () => -58.4,
  getSouth: () => -34.7,
  getEast: () => -58.3,
  getNorth: () => -34.5,
  contains: () => estado.contiene
}

type Callback = () => void
type CallbackClick = (e: { latlng: { lat: number; lng: number } }) => void

let callbackMoveend: Callback | undefined
let callbackClick: CallbackClick | undefined

/** Dispara el `moveend` que `LocationMapModal` registró, como si el usuario hubiera movido el mapa. */
export function dispararMoveend() {
  callbackMoveend?.()
}

/** Dispara el clic en el mapa que registró la variante `picker`. */
export function dispararClick(lat: number, lng: number) {
  callbackClick?.({ latlng: { lat, lng } })
}

function mapaFalso() {
  const mapa = {
    setView: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    invalidateSize: vi.fn(),
    getBounds: vi.fn(() => boundsPorDefecto),
    getZoom: vi.fn(() => estado.zoom),
    on: vi.fn((evento: string, cb: Callback & CallbackClick) => {
      if (evento === 'moveend') callbackMoveend = cb
      if (evento === 'click') callbackClick = cb
      return mapa
    }),
    fitBounds: vi.fn()
  }
  return mapa
}

function grupoFalso() {
  const capas: unknown[] = []
  const grupo = {
    addTo: vi.fn().mockReturnThis(),
    clearLayers: vi.fn(() => {
      capas.length = 0
    }),
    addLayer: vi.fn((capa: unknown) => {
      capas.push(capa)
    }),
    getBounds: vi.fn(() => ({ pad: () => boundsPorDefecto }))
  }
  return grupo
}

function marcadorFalso(posicion: [number, number]) {
  let [lat, lng] = posicion
  const marcador = {
    addTo: vi.fn().mockReturnThis(),
    bindPopup: vi.fn().mockReturnThis(),
    on: vi.fn(),
    remove: vi.fn(),
    setLatLng: vi.fn((p: [number, number]) => {
      ;[lat, lng] = p
      return marcador
    }),
    getLatLng: vi.fn(() => ({ lat, lng }))
  }
  return marcador
}

export const map = vi.fn(() => mapaFalso())
export const tileLayer = vi.fn(() => ({ addTo: vi.fn() }))
export const featureGroup = vi.fn(() => grupoFalso())
export const marker = vi.fn((posicion: [number, number], _opciones?: unknown) =>
  marcadorFalso(posicion)
)
export const divIcon = vi.fn((opciones: unknown) => opciones)

/** El ícono por defecto: `LocationMapModal` le pasa las imágenes publicadas por Vite. */
export const Icon = { Default: { prototype: { _getIconUrl: vi.fn() }, mergeOptions: vi.fn() } }

export default { map, tileLayer, featureGroup, marker, divIcon, Icon }
