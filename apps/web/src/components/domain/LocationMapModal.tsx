import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogTitle } from '#/components/ui/dialog'

// M2-D3 §Modals · LocationMapModal — *"Full-screen interactive Leaflet map."*
// Se usa para la ubicación de un proyecto, la de una unidad adquirida, y
// (variante `browse`) el mapa de exploración de la fila 03.
//
// **Leaflet se carga con `import()` dinámico y no como import estático**, por
// tres razones concretas:
//
//   1. Leaflet toca `window` y `document` al importarse. Un import estático lo
//      arrastra al bundle inicial y al entorno de tests (jsdom), donde no tiene
//      nada que hacer — este modal es una superficie secundaria que la mayoría
//      de las sesiones no abre.
//   2. Su CSS es obligatorio para que los tiles se posicionen: sin él el mapa
//      se ve como una pila de imágenes rotas. Va junto al módulo, no suelto en
//      un `styles.css` que lo cargaría siempre.
//   3. Solo se instancia con el modal ABIERTO. Un mapa montado detrás de un
//      diálogo cerrado pide tiles que nadie mira.
//
// **Los tiles salen a un servidor externo** (OpenStreetMap). Es la única
// request de la app que no va a nuestra API — vale saberlo: sin red, el modal
// muestra el marco y el domicilio, que es la información que de verdad importa.

export interface MapMarker {
  id: string
  latitude: number
  longitude: number
  /** Etiqueta ya armada (p. ej. el "desde" de la captura 3). Sin dato, pin. */
  label?: string
}

interface LocationMapModalProps {
  open: boolean
  onClose: () => void
  latitude?: number
  longitude?: number
  /** Domicilio ya armado por quien lo usa (D-025). Va arriba a la izquierda. */
  addressLabel?: string
  labels: {
    title: string
    close: string
    /** Texto alternativo del marcador, para el lector de pantalla. */
    marker: string
  }
  zoom?: number
  testId?: string
  /**
   * `browse` es el mapa de la fila 03: varios pines, sin diálogo, y el
   * viewport manda `bbox` al listado. Un proyecto sin coordenadas no entra:
   * no se le inventa un punto.
   */
  variant?: 'modal' | 'browse'
  markers?: readonly MapMarker[]
  onSelectMarker?: (id: string) => void
  onBoundsChange?: (bbox: string) => void
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
  onBoundsChange
}: LocationMapModalProps) {
  const contenedor = useRef<HTMLDivElement>(null)
  const esBrowse = variant === 'browse'
  const onSelectRef = useRef(onSelectMarker)
  const onBoundsRef = useRef(onBoundsChange)
  onSelectRef.current = onSelectMarker
  onBoundsRef.current = onBoundsChange
  const pinesClave = (markers ?? []).map((m) => `${m.id}:${m.latitude}:${m.longitude}`).join('|')

  useEffect(() => {
    if (!open || !contenedor.current) return

    let destruir: (() => void) | undefined
    let cancelado = false

    void (async () => {
      const L = await import('leaflet')
      await import('leaflet/dist/leaflet.css')

      if (cancelado || !contenedor.current) return

      const pines = (markers ?? []).filter((m) => m.latitude != null && m.longitude != null)

      const centro: [number, number] =
        latitude != null && longitude != null
          ? [latitude, longitude]
          : pines[0]
            ? [pines[0].latitude, pines[0].longitude]
            : [-34.6037, -58.3816]

      const mapa = L.map(contenedor.current).setView(centro, zoom)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(mapa)

      if (esBrowse && pines.length) {
        const grupo = L.featureGroup()
        for (const pin of pines) {
          const icono = pin.label
            ? L.divIcon({
                className: '',
                html: `<span class="rounded-full bg-primary px-s2 py-s1 text-caption font-bold text-white">${pin.label}</span>`,
                iconSize: [1, 1],
                iconAnchor: [0, 0]
              })
            : undefined
          const marcador = icono
            ? L.marker([pin.latitude, pin.longitude], { icon: icono })
            : L.marker([pin.latitude, pin.longitude])
          marcador.on('click', () => onSelectRef.current?.(pin.id))
          grupo.addLayer(marcador)
        }
        grupo.addTo(mapa)
        mapa.fitBounds(grupo.getBounds().pad(0.2))
      } else if (latitude != null && longitude != null) {
        L.marker([latitude, longitude]).addTo(mapa).bindPopup(labels.marker)
      }

      const emitirBbox = () => {
        const b = mapa.getBounds()
        onBoundsRef.current?.(`${b.getWest()},${b.getSouth()},${b.getEast()},${b.getNorth()}`)
      }

      if (esBrowse && onBoundsRef.current) {
        mapa.on('moveend', emitirBbox)
        emitirBbox()
      }

      requestAnimationFrame(() => mapa.invalidateSize())

      destruir = () => mapa.remove()
    })()

    return () => {
      cancelado = true
      destruir?.()
    }
  }, [open, latitude, longitude, zoom, labels.marker, esBrowse, pinesClave])

  const mapaEl = (
    <div className="relative">
      {addressLabel ? (
        <span className="absolute top-s3 left-s3 z-[1000] rounded-md bg-card/90 px-s3 py-s2 text-body-sm text-text-primary shadow-e1">
          {addressLabel}
        </span>
      ) : null}

      {!esBrowse ? (
        <button
          type="button"
          aria-label={labels.close}
          onClick={onClose}
          className="absolute top-s3 right-s3 z-[1000] rounded-full bg-card/90 p-s2 text-text-primary shadow-e1 hover:bg-card"
        >
          <X className="size-icon-sm" aria-hidden="true" />
        </button>
      ) : null}

      <div ref={contenedor} className="h-[70vh] w-full bg-surface-alt" />
    </div>
  )

  if (esBrowse) {
    if (!open) return null
    return (
      <div data-testid={testId} className="-mx-s4">
        {mapaEl}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent
        data-testid={testId}
        className="max-w-3xl overflow-hidden p-0"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{labels.title}</DialogTitle>
        {mapaEl}
      </DialogContent>
    </Dialog>
  )
}
