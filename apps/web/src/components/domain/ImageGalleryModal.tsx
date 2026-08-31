import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '#/components/ui/dialog'

// M2-D3 §Modals · ImageGalleryModal — carrusel a pantalla completa para galerías
// de proyecto, de unidad y de evidencia fotográfica de stage.
//
// El pie cambia según el contexto —proyecto, stage, o GPS + timestamp— y por eso
// `caption` es un string que arma quien lo usa: el componente no sabe de qué
// galería es.
//
// **El índice se resetea al abrir**, no al cerrar: si se cierra en la foto 3 y
// se vuelve a abrir, empieza donde el que abre diga. Guardar el índice entre
// aperturas haría que la galería recuerde algo que el usuario no pidió.

export interface GalleryImage {
  url: string
  /** Texto alternativo real. Nunca el nombre del archivo. */
  alt: string
  caption?: string
}

interface ImageGalleryModalProps {
  open: boolean
  onClose: () => void
  images: readonly GalleryImage[]
  /** Desde qué foto abre. */
  initialIndex?: number
  labels: {
    title: string
    close: string
    previous: string
    next: string
    /** "2/4" — se arma con `Intl` afuera si el locale lo pide distinto. */
    counter: (actual: number, total: number) => string
  }
  testId?: string
}

export function ImageGalleryModal({
  open,
  onClose,
  images,
  initialIndex = 0,
  labels,
  testId
}: ImageGalleryModalProps) {
  const [indice, setIndice] = useState(initialIndex)

  // Al abrir vuelve a la foto que pidieron. `open` en las dependencias es lo
  // que hace que reabrir reinicie en vez de continuar donde quedó.
  useEffect(() => {
    if (open) setIndice(initialIndex)
  }, [open, initialIndex])

  if (images.length === 0) return null

  const actual = images[Math.min(indice, images.length - 1)]
  if (!actual) return null

  const ir = (delta: number) => setIndice((i) => (i + delta + images.length) % images.length)

  return (
    <Dialog open={open} onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent
        data-testid={testId}
        className="max-w-3xl bg-text-primary p-0"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{labels.title}</DialogTitle>

        <div className="relative flex flex-col">
          <button
            type="button"
            aria-label={labels.close}
            onClick={onClose}
            className="absolute top-s2 right-s2 z-10 rounded-full bg-black/40 p-s2 text-white hover:bg-black/60"
          >
            <X className="size-icon-sm" aria-hidden="true" />
          </button>

          <img src={actual.url} alt={actual.alt} className="max-h-[70vh] w-full object-contain" />

          {images.length > 1 ? (
            <>
              <button
                type="button"
                aria-label={labels.previous}
                onClick={() => ir(-1)}
                className="-translate-y-1/2 absolute top-1/2 left-s2 rounded-full bg-black/40 p-s2 text-white hover:bg-black/60"
              >
                <ChevronLeft className="size-icon-md" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={labels.next}
                onClick={() => ir(1)}
                className="-translate-y-1/2 absolute top-1/2 right-s2 rounded-full bg-black/40 p-s2 text-white hover:bg-black/60"
              >
                <ChevronRight className="size-icon-md" aria-hidden="true" />
              </button>
            </>
          ) : null}

          <div className="flex items-center justify-between gap-s2 px-s4 py-s3">
            <span className="text-body-sm text-white/80">{actual.caption}</span>
            <span className="shrink-0 text-caption text-white/60 tabular-nums">
              {labels.counter(indice + 1, images.length)}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
