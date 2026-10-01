import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '#/components/ui/dialog'

export interface GalleryImage {
  url: string
  alt: string
  caption?: string
}

interface ImageGalleryModalProps {
  open: boolean
  onClose: () => void
  images: readonly GalleryImage[]
  initialIndex?: number
  labels: {
    title: string
    close: string
    previous: string
    next: string
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

  useEffect(() => {
    if (open) setIndice(initialIndex)
  }, [open, initialIndex])

  const actual = images[Math.min(indice, images.length - 1)]
  if (!actual) return null

  const ir = (delta: number) => setIndice((i) => (i + delta + images.length) % images.length)

  return (
    <Dialog open={open} onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent
        data-testid={testId}
        className="bg-text-primary p-0 sm:max-w-3xl"
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
            <X className="size-icon-inline" aria-hidden="true" />
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
                <ChevronLeft className="size-icon-stat" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={labels.next}
                onClick={() => ir(1)}
                className="-translate-y-1/2 absolute top-1/2 right-s2 rounded-full bg-black/40 p-s2 text-white hover:bg-black/60"
              >
                <ChevronRight className="size-icon-stat" aria-hidden="true" />
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
