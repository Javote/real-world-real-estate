import { Building2, MapPin } from 'lucide-react'
import { ProgressBar } from './ProgressBar'
import { StatusPill, type StatusTone } from './StatusPill'

// M2-D3 §Cards · ProjectCard — la card de listado de un proyecto.
//
// "Card is fully tappable; entire surface routes to project detail" y "progress
// bar is required when status ≠ Delivered".
//
// **Los campos que el modelo todavía no tiene** —imagen de portada, precio
// desde, rango de m², nombre del developer— se dibujan como ausencia, no como
// dato falso: sin imagen va una superficie neutra, sin precio no va la línea.
// La captura 2 los muestra porque **la maqueta usa datos mock** (M2-D1); lo
// normativo de una captura es la estructura, no los valores.

interface ProjectCardProps {
  name: string
  location?: string | null
  status: { label: string; tone: StatusTone }
  progress: number
  imageUrl?: string | null
  developerName?: string | null
  priceLabel?: string | null
  sizeLabel?: string | null
  onOpen: () => void
  labels: { from: string }
  testId?: string
}

export function ProjectCard({
  name,
  location,
  status,
  progress,
  imageUrl,
  developerName,
  priceLabel,
  sizeLabel,
  onOpen,
  labels,
  testId
}: ProjectCardProps) {
  return (
    <article className="overflow-hidden rounded-lg bg-card shadow-e1" data-testid={testId}>
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="relative aspect-video w-full bg-surface-alt">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            // Sin imagen: superficie neutra. Un placeholder ilustrado sugeriría
            // contenido que no existe.
            <span className="flex h-full w-full items-center justify-center text-disabled">
              <Building2 size={32} aria-hidden="true" />
            </span>
          )}

          {developerName ? (
            <span className="absolute bottom-s3 right-s3 flex items-center gap-s1 rounded-full bg-primary px-s3 py-s1 text-caption font-bold text-white">
              <Building2 size={14} aria-hidden="true" />
              {developerName}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-s2 p-s4">
          {priceLabel ? (
            <div className="flex flex-col gap-s1">
              <span className="text-body-sm text-text-muted">{labels.from}</span>
              <span className="text-h2 font-bold text-text-primary">{priceLabel}</span>
            </div>
          ) : (
            <span className="text-h2 font-bold text-text-primary">{name}</span>
          )}

          {location ? (
            <span className="flex items-center gap-s1 text-body-sm text-text-secondary">
              <MapPin size={16} aria-hidden="true" />
              {location}
            </span>
          ) : null}

          {sizeLabel ? <span className="text-body-sm text-text-muted">{sizeLabel}</span> : null}

          <StatusPill tone={status.tone}>{status.label}</StatusPill>
          <ProgressBar percent={progress} showValue />
        </div>
      </button>
    </article>
  )
}
