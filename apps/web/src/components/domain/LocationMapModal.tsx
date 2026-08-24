import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogTitle } from '#/components/ui/dialog'

// M2-D3 §Modals · LocationMapModal — *"Full-screen interactive Leaflet map."*
// Se usa para la ubicación de un proyecto y la de una unidad adquirida.
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

interface LocationMapModalProps {
  open: boolean
  onClose: () => void
  latitude: number
  longitude: number
  /** Domicilio ya armado por quien lo usa (D-025). Va arriba a la izquierda. */
  addressLabel: string
  labels: {
    title: string
    close: string
    /** Texto alternativo del marcador, para el lector de pantalla. */
    marker: string
  }
  zoom?: number
}

export function LocationMapModal({
  open,
  onClose,
  latitude,
  longitude,
  addressLabel,
  labels,
  zoom = 15
}: LocationMapModalProps) {
  const contenedor = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || !contenedor.current) return

    let destruir: (() => void) | undefined
    let cancelado = false

    void (async () => {
      const L = await import('leaflet')
      await import('leaflet/dist/leaflet.css')

      // El efecto puede haberse limpiado mientras cargaba el módulo.
      if (cancelado || !contenedor.current) return

      const mapa = L.map(contenedor.current).setView([latitude, longitude], zoom)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(mapa)

      L.marker([latitude, longitude]).addTo(mapa).bindPopup(labels.marker)

      destruir = () => mapa.remove()
    })()

    return () => {
      cancelado = true
      destruir?.()
    }
  }, [open, latitude, longitude, zoom, labels.marker])

  return (
    <Dialog open={open} onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="max-w-3xl overflow-hidden p-0" showCloseButton={false}>
        <DialogTitle className="sr-only">{labels.title}</DialogTitle>

        <div className="relative">
          <span className="absolute top-s3 left-s3 z-[1000] rounded-md bg-card/90 px-s3 py-s2 text-body-sm text-text-primary shadow-e1">
            {addressLabel}
          </span>

          <button
            type="button"
            aria-label={labels.close}
            onClick={onClose}
            className="absolute top-s3 right-s3 z-[1000] rounded-full bg-card/90 p-s2 text-text-primary shadow-e1 hover:bg-card"
          >
            <X className="size-icon-sm" aria-hidden="true" />
          </button>

          {/* `h-[70vh]` y no `aspect-*`: Leaflet mide su contenedor al
              inicializar, y un contenedor sin altura resuelta le da 0px y
              muestra un mapa vacío. */}
          <div ref={contenedor} className="h-[70vh] w-full bg-surface-alt" />
        </div>
      </DialogContent>
    </Dialog>
  )
}
