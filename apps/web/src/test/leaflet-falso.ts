import { vi } from 'vitest'

interface BoundsFalsos {
  getWest(): number
  getSouth(): number
  getEast(): number
  getNorth(): number
}

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

export function dispararMoveend() {
  callbackMoveend?.()
}

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

export const Icon = { Default: { prototype: { _getIconUrl: vi.fn() }, mergeOptions: vi.fn() } }

export default { map, tileLayer, featureGroup, marker, divIcon, Icon }
