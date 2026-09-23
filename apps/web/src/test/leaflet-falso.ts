// Leaflet real no corre en jsdom (no hay layout, no hay tiles). `LocationMapModal`
// lo carga con `import()` dinámico — SPEC-019 §Paso 0, punto 9: un `L` falso,
// compartido por los cuatro lotes que montan el mapa (investor.buy,
// investor.unit.$unitId.index, project.$projectId.index, LocationMapModal).
//
// Uso: `vi.mock('leaflet', () => import('#/test/leaflet-falso'))` al principio
// del archivo de test. Para disparar `moveend` a mano:
// `dispararMoveend(bounds?)`.
import { vi } from 'vitest'

interface BoundsFalsos {
  getWest(): number
  getSouth(): number
  getEast(): number
  getNorth(): number
}

const boundsPorDefecto: BoundsFalsos = {
  getWest: () => -58.4,
  getSouth: () => -34.7,
  getEast: () => -58.3,
  getNorth: () => -34.5
}

type Callback = () => void

let callbackMoveend: Callback | undefined

/** Dispara el `moveend` que `LocationMapModal` registró, como si el usuario hubiera movido el mapa. */
export function dispararMoveend() {
  callbackMoveend?.()
}

function mapaFalso() {
  const mapa = {
    setView: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    invalidateSize: vi.fn(),
    getBounds: vi.fn(() => boundsPorDefecto),
    on: vi.fn((evento: string, cb: Callback) => {
      if (evento === 'moveend') callbackMoveend = cb
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

function marcadorFalso() {
  const marcador = {
    addTo: vi.fn().mockReturnThis(),
    bindPopup: vi.fn().mockReturnThis(),
    on: vi.fn()
  }
  return marcador
}

export const map = vi.fn(() => mapaFalso())
export const tileLayer = vi.fn(() => ({ addTo: vi.fn() }))
export const featureGroup = vi.fn(() => grupoFalso())
export const marker = vi.fn(() => marcadorFalso())
export const divIcon = vi.fn((opciones: unknown) => opciones)

export default { map, tileLayer, featureGroup, marker, divIcon }
