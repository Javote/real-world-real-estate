import icono from 'leaflet/dist/images/marker-icon.png'
import iconoRetina from 'leaflet/dist/images/marker-icon-2x.png'
import sombra from 'leaflet/dist/images/marker-shadow.png'
import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '#/components/ui/dialog'
import { cn } from '#/lib/cn'

type Leaflet = typeof import('leaflet')
type LeafletMap = import('leaflet').Map
type LeafletFeatureGroup = import('leaflet').FeatureGroup
type LeafletMarker = import('leaflet').Marker

function usarIconoPublicado(L: Leaflet) {
  delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl
  L.Icon.Default.mergeOptions({ iconUrl: icono, iconRetinaUrl: iconoRetina, shadowUrl: sombra })
}

const CENTRO_CABA: [number, number] = [-34.6037, -58.3816]

function iconoDeEtiqueta(L: Leaflet, label: string) {
  const el = document.createElement('span')
  el.className = 'rounded-full bg-primary px-s2 py-s1 text-caption font-bold text-white'
  el.textContent = label
  return L.divIcon({ className: '', html: el, iconSize: [1, 1], iconAnchor: [0, 0] })
}

export interface MapMarker {
  id: string
  latitude: number
  longitude: number
  label?: string
}

interface LocationMapModalProps {
  open: boolean
  onClose?: () => void
  latitude?: number
  longitude?: number
  addressLabel?: string
  labels: {
    title: string
    close: string
    marker: string
  }
  zoom?: number
  testId?: string
  variant?: 'modal' | 'browse' | 'picker' | 'preview'
  markers?: readonly MapMarker[]
  onSelectMarker?: (id: string) => void
  onBoundsChange?: (bbox: string) => void
  onPick?: (latitude: number, longitude: number) => void
}

export function LocationMapModal({
  open,
  onClose,
  latitude,
  longitude,
  addressLabel,
  labels,
  zoom = 15,
  testId,
  variant = 'modal',
  markers,
  onSelectMarker,
  onBoundsChange,
  onPick
}: LocationMapModalProps) {
  const [contenedor, setContenedor] = useState<HTMLDivElement | null>(null)
  const esBrowse = variant === 'browse'
  const esPicker = variant === 'picker'
  const esPreview = variant === 'preview'

  const onSelectRef = useRef(onSelectMarker)
  const onBoundsRef = useRef(onBoundsChange)
  const onPickRef = useRef(onPick)
  useEffect(() => {
    onSelectRef.current = onSelectMarker
    onBoundsRef.current = onBoundsChange
    onPickRef.current = onPick
  })

  const puntoRef = useRef<[number, number] | null>(null)
  useEffect(() => {
    puntoRef.current = latitude != null && longitude != null ? [latitude, longitude] : null
  })
  const latitudCreacion = esPicker ? undefined : latitude
  const longitudCreacion = esPicker ? undefined : longitude

  const pines = (markers ?? []).filter((m) => m.latitude != null && m.longitude != null)
  const pinesClave = pines.map((m) => `${m.id}:${m.latitude}:${m.longitude}`).join('|')
  const pinesRef = useRef(pines)
  useEffect(() => {
    pinesRef.current = pines
  })

  const leafletRef = useRef<Leaflet | null>(null)
  const mapaRef = useRef<LeafletMap | null>(null)
  const grupoRef = useRef<LeafletFeatureGroup | null>(null)
  const pinRef = useRef<LeafletMarker | null>(null)
  const yaEncuadrado = useRef(false)
  const [generacion, setGeneracion] = useState(0)

  useEffect(() => {
    if (!open || !contenedor) return

    let destruir: (() => void) | undefined
    let cancelado = false

    void (async () => {
      const L = await import('leaflet')
      await import('leaflet/dist/leaflet.css')

      if (cancelado) return
      usarIconoPublicado(L)

      const primerPin = pinesRef.current[0]
      const punto = puntoRef.current
      const centro: [number, number] = esPicker
        ? (punto ?? CENTRO_CABA)
        : latitudCreacion != null && longitudCreacion != null
          ? [latitudCreacion, longitudCreacion]
          : primerPin
            ? [primerPin.latitude, primerPin.longitude]
            : CENTRO_CABA
      const zoomInicial = esPicker && !punto ? 12 : zoom

      const opciones = esPreview
        ? {
            dragging: false,
            zoomControl: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            keyboard: false,
            touchZoom: false
          }
        : {}
      const mapa = L.map(contenedor, opciones).setView(centro, zoomInicial)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(mapa)

      if (esBrowse) {
        const grupo = L.featureGroup().addTo(mapa)
        grupoRef.current = grupo

        const emitirBbox = () => {
          const b = mapa.getBounds()
          onBoundsRef.current?.(`${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`)
        }
        mapa.on('moveend', emitirBbox)
      } else if (esPicker) {
        mapa.on('click', (e: { latlng: { lat: number; lng: number } }) =>
          onPickRef.current?.(e.latlng.lat, e.latlng.lng)
        )
      } else if (latitudCreacion != null && longitudCreacion != null) {
        L.marker([latitudCreacion, longitudCreacion]).addTo(mapa).bindPopup(labels.marker)
      }

      requestAnimationFrame(() => mapa.invalidateSize())

      leafletRef.current = L
      mapaRef.current = mapa
      setGeneracion((n) => n + 1)

      destruir = () => {
        mapa.remove()
        mapaRef.current = null
        grupoRef.current = null
        pinRef.current = null
        yaEncuadrado.current = false
      }
    })()

    return () => {
      cancelado = true
      destruir?.()
    }
  }, [
    open,
    contenedor,
    latitudCreacion,
    longitudCreacion,
    zoom,
    labels.marker,
    esBrowse,
    esPicker,
    esPreview
  ])

  useEffect(() => {
    const L = leafletRef.current
    const mapa = mapaRef.current
    const grupo = grupoRef.current
    if (!esBrowse || !L || !mapa || !grupo) return

    grupo.clearLayers()

    for (const pin of pinesRef.current) {
      const marcador = pin.label
        ? L.marker([pin.latitude, pin.longitude], { icon: iconoDeEtiqueta(L, pin.label) })
        : L.marker([pin.latitude, pin.longitude])
      marcador.on('click', () => onSelectRef.current?.(pin.id))
      grupo.addLayer(marcador)
    }

    if (!yaEncuadrado.current && pinesRef.current.length) {
      yaEncuadrado.current = true
      mapa.fitBounds(grupo.getBounds().pad(0.2), { maxZoom: 15 })
    }
  }, [esBrowse, pinesClave, generacion])

  useEffect(() => {
    const L = leafletRef.current
    const mapa = mapaRef.current
    if (!esPicker || !L || !mapa) return

    if (latitude == null || longitude == null) {
      pinRef.current?.remove()
      pinRef.current = null
      return
    }

    if (pinRef.current) {
      pinRef.current.setLatLng([latitude, longitude])
    } else {
      const pin = L.marker([latitude, longitude], { draggable: true }).addTo(mapa)
      pin.on('dragend', () => {
        const p = pin.getLatLng()
        onPickRef.current?.(p.lat, p.lng)
      })
      pinRef.current = pin
    }

    if (mapa.getZoom() < 15 || !mapa.getBounds().contains([latitude, longitude])) {
      mapa.setView([latitude, longitude], 16)
    }
  }, [esPicker, latitude, longitude, generacion])

  const mapaEl = (
    <div className="relative isolate">
      {addressLabel ? (
        <span className="absolute top-s3 left-s3 z-[1000] rounded-md bg-card/90 px-s3 py-s2 text-body-sm text-text-primary shadow-e1">
          {addressLabel}
        </span>
      ) : null}

      {variant === 'modal' ? (
        <button
          type="button"
          aria-label={labels.close}
          onClick={onClose}
          className="absolute top-s3 right-s3 z-[1000] rounded-full bg-card/90 p-s2 text-text-primary shadow-e1 hover:bg-card"
        >
          <X className="size-icon-inline" aria-hidden="true" />
        </button>
      ) : null}

      <div
        ref={setContenedor}
        className={cn(
          'w-full bg-surface-alt',
          esPicker ? 'h-64 rounded-lg' : variant === 'modal' ? 'h-[80vh]' : 'h-[70vh]'
        )}
      />
    </div>
  )

  if (esPreview) {
    if (!open) return null
    return (
      <div
        data-testid={testId}
        aria-hidden="true"
        className="pointer-events-none isolate h-full w-full"
      >
        <div ref={setContenedor} className="h-full w-full bg-surface-alt" />
      </div>
    )
  }

  if (esPicker) {
    if (!open) return null
    return (
      <div data-testid={testId} className="overflow-hidden rounded-lg">
        {mapaEl}
      </div>
    )
  }

  if (esBrowse) {
    if (!open) return null
    return (
      <div data-testid={testId} className="-mx-s4">
        {mapaEl}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(abierto) => !abierto && onClose?.()}>
      <DialogContent
        data-testid={testId}
        className="overflow-hidden p-0 sm:max-w-4xl"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{labels.title}</DialogTitle>
        {mapaEl}
      </DialogContent>
    </Dialog>
  )
}
