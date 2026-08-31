import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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

type Leaflet = typeof import('leaflet')
type LeafletMap = import('leaflet').Map
type LeafletFeatureGroup = import('leaflet').FeatureGroup

/**
 * La etiqueta del pin sale de datos del proyecto, así que **se escribe como
 * texto de un nodo, nunca interpolada en `html`**: `divIcon` acepta un
 * `HTMLElement` y esa forma no puede inyectar marcado.
 */
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

  // Los callbacks cambian de identidad en cada render del padre. Van por ref
  // —sincronizada en un efecto, no durante el render— para que el mapa no se
  // reconstruya por eso.
  const onSelectRef = useRef(onSelectMarker)
  const onBoundsRef = useRef(onBoundsChange)
  useEffect(() => {
    onSelectRef.current = onSelectMarker
    onBoundsRef.current = onBoundsChange
  })

  const pines = (markers ?? []).filter((m) => m.latitude != null && m.longitude != null)
  const pinesClave = pines.map((m) => `${m.id}:${m.latitude}:${m.longitude}`).join('|')
  const pinesRef = useRef(pines)
  useEffect(() => {
    pinesRef.current = pines
  })

  const leafletRef = useRef<Leaflet | null>(null)
  const mapaRef = useRef<LeafletMap | null>(null)
  const grupoRef = useRef<LeafletFeatureGroup | null>(null)
  const yaEncuadrado = useRef(false)
  const [generacion, setGeneracion] = useState(0)

  // ── Efecto 1: crear el mapa. **No depende de los pines.**
  //
  // Reconstruir el mapa cuando cambia el resultado era un bucle: `moveend` →
  // `bbox` → refetch → otros pines → mapa nuevo → `fitBounds` → `moveend`. Y
  // de paso le tiraba abajo el pan y el zoom al usuario en cada respuesta.
  useEffect(() => {
    if (!open || !contenedor.current) return

    let destruir: (() => void) | undefined
    let cancelado = false

    void (async () => {
      const L = await import('leaflet')
      await import('leaflet/dist/leaflet.css')

      if (cancelado || !contenedor.current) return

      const primerPin = pinesRef.current[0]
      const centro: [number, number] =
        latitude != null && longitude != null
          ? [latitude, longitude]
          : primerPin
            ? [primerPin.latitude, primerPin.longitude]
            : [-34.6037, -58.3816]

      const mapa = L.map(contenedor.current).setView(centro, zoom)

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
        emitirBbox()
      } else if (latitude != null && longitude != null) {
        L.marker([latitude, longitude]).addTo(mapa).bindPopup(labels.marker)
      }

      requestAnimationFrame(() => mapa.invalidateSize())

      leafletRef.current = L
      mapaRef.current = mapa
      setGeneracion((n) => n + 1)

      destruir = () => {
        mapa.remove()
        mapaRef.current = null
        grupoRef.current = null
        yaEncuadrado.current = false
      }
    })()

    return () => {
      cancelado = true
      destruir?.()
    }
  }, [open, latitude, longitude, zoom, labels.marker, esBrowse])

  // ── Efecto 2: sincronizar los pines sobre el mapa que ya existe.
  //
  // El encuadre automático es UNA vez: después manda el usuario. Volver a
  // encuadrar con cada respuesta es lo que cerraba el bucle.
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
      mapa.fitBounds(grupo.getBounds().pad(0.2))
    }
  }, [esBrowse, pinesClave, generacion])

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
