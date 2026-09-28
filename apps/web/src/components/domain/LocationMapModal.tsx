import icono from 'leaflet/dist/images/marker-icon.png'
import iconoRetina from 'leaflet/dist/images/marker-icon-2x.png'
import sombra from 'leaflet/dist/images/marker-shadow.png'
import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '#/components/ui/dialog'
import { cn } from '#/lib/cn'

// M2-D3 §Modals · LocationMapModal — *"Full-screen interactive Leaflet map."*
// Se usa para la ubicación de un proyecto, la de una unidad adquirida,
// (variante `browse`) el mapa de exploración de la fila 03, y (variante
// `picker`, D-097) el "Map preview" del alta de proyecto de la captura 34b,
// donde el developer fija el punto de la obra.
//
// **El contenedor del mapa es estado, no un `useRef`** (bug visto en
// producción el 2026-09-28). En la variante `modal` el `<div>` vive dentro del
// portal de Radix, que se monta un render DESPUÉS de que el diálogo abre: con
// un ref, el efecto que crea el mapa corría con el contenedor en `null`, salía
// temprano y no volvía a correr — el modal abría vacío. Como estado, montar el
// contenedor re-dispara el efecto.
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
type LeafletMarker = import('leaflet').Marker

/**
 * El pin por defecto de Leaflet arma la URL de su imagen a partir de la ruta
 * de su propio CSS, que Vite no publica: en producción el pin salía como una
 * imagen rota (visto el 2026-09-28). Se le pasan las imágenes importadas como
 * assets, que Vite sí publica con su hash.
 */
function usarIconoPublicado(L: Leaflet) {
  delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl
  L.Icon.Default.mergeOptions({ iconUrl: icono, iconRetinaUrl: iconoRetina, shadowUrl: sombra })
}

/** Centro de CABA: el punto de partida cuando todavía no hay nada que mostrar. */
const CENTRO_CABA: [number, number] = [-34.6037, -58.3816]

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
  /** Solo `modal`: las variantes en línea (`browse`, `picker`) no se cierran. */
  onClose?: () => void
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
   *
   * `picker` es el "Map preview" del alta de proyecto (D-097): en línea, sin
   * diálogo, con un solo pin que se fija con un clic o arrastrándolo, y que se
   * mueve solo cuando `latitude`/`longitude` cambian desde afuera (la
   * dirección encontrada).
   */
  variant?: 'modal' | 'browse' | 'picker'
  markers?: readonly MapMarker[]
  onSelectMarker?: (id: string) => void
  onBoundsChange?: (bbox: string) => void
  /** Solo `picker`: el punto que el usuario marcó en el mapa. */
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

  // Los callbacks cambian de identidad en cada render del padre. Van por ref
  // —sincronizada en un efecto, no durante el render— para que el mapa no se
  // reconstruya por eso.
  const onSelectRef = useRef(onSelectMarker)
  const onBoundsRef = useRef(onBoundsChange)
  const onPickRef = useRef(onPick)
  useEffect(() => {
    onSelectRef.current = onSelectMarker
    onBoundsRef.current = onBoundsChange
    onPickRef.current = onPick
  })

  // En `picker` el punto cambia con cada clic: el mapa NO se reconstruye por
  // eso (lo sigue el efecto 3). El punto inicial se lee de este ref.
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

  // ── Efecto 1: crear el mapa. **No depende de los pines.**
  //
  // Reconstruir el mapa cuando cambia el resultado era un bucle: `moveend` →
  // `bbox` → refetch → otros pines → mapa nuevo → `fitBounds` → `moveend`. Y
  // de paso le tiraba abajo el pan y el zoom al usuario en cada respuesta.
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

      const mapa = L.map(contenedor).setView(centro, zoomInicial)

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
        // El bbox sale recién con el primer `moveend` — el del encuadre del
        // efecto 2 —, no al crear el mapa. Emitirlo acá mandaba el recuadro del
        // zoom de calle sobre el primer pin, el listado se filtraba a esa sola
        // obra, y el encuadre terminaba sobre un pin en vez de todos (visto en
        // producción el 2026-09-28: 1 pin de 3).
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
  }, [open, contenedor, latitudCreacion, longitudCreacion, zoom, labels.marker, esBrowse, esPicker])

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
      mapa.fitBounds(grupo.getBounds().pad(0.2), { maxZoom: 15 })
    }
  }, [esBrowse, pinesClave, generacion])

  // ── Efecto 3 (`picker`): el pin sigue al punto, venga de un clic, de
  // arrastrarlo o de la dirección encontrada. Si el punto quedó fuera de
  // vista o el mapa está lejos (zoom de ciudad), se centra ahí.
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
    <div className="relative">
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
        className={cn('w-full bg-surface-alt', esPicker ? 'h-64 rounded-lg' : 'h-[70vh]')}
      />
    </div>
  )

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
        className="max-w-3xl overflow-hidden p-0"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{labels.title}</DialogTitle>
        {mapaEl}
      </DialogContent>
    </Dialog>
  )
}
