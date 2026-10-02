import { Building2, Calendar, Heart, MapPin } from 'lucide-react'
import { ProgressBar } from './ProgressBar'
import { StatusPill, type StatusTone } from './StatusPill'

interface ProjectCardBaseProps {
  name: string
  location?: string | null
  status: { label: string; tone: StatusTone }
  progress?: number | null
  imageUrl?: string | null
  developerName?: string | null
  priceLabel?: string | null
  sizeLabel?: string | null
  unitsLabel?: string | null
  dateLabel?: string | null
  onOpen: () => void
  labels: { from: string; units?: string; progress?: string }
  testId?: string
  variant?: 'buy' | 'developer'
}

type FavoritoProps =
  | {
      onToggleFavorite: () => void
      favoriteAriaLabel: string
      favorited?: boolean
      favoriteTestId?: string
    }
  | {
      onToggleFavorite?: undefined
      favoriteAriaLabel?: undefined
      favorited?: undefined
      favoriteTestId?: undefined
    }

type ProjectCardProps = ProjectCardBaseProps & FavoritoProps

export function ProjectCard({
  name,
  location,
  status,
  progress,
  imageUrl,
  developerName,
  priceLabel,
  sizeLabel,
  unitsLabel,
  dateLabel,
  onOpen,
  labels,
  testId,
  variant = 'buy',
  favorited,
  onToggleFavorite,
  favoriteAriaLabel,
  favoriteTestId
}: ProjectCardProps) {
  const esDeveloper = variant === 'developer'

  return (
    <article className="relative overflow-hidden rounded-lg bg-card shadow-e1" data-testid={testId}>
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="relative aspect-video w-full bg-surface-alt">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
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
          {esDeveloper ? (
            <div className="flex items-start justify-between gap-s2">
              <span className="min-w-0 break-words text-h2 font-bold text-text-primary">
                {name}
              </span>
              <StatusPill tone={status.tone}>{status.label}</StatusPill>
            </div>
          ) : priceLabel ? (
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

          {esDeveloper ? (
            priceLabel || unitsLabel ? (
              <div className="grid grid-cols-2 gap-s3">
                {priceLabel ? (
                  <div className="flex flex-col gap-s1">
                    <span className="text-body-sm text-text-muted">{labels.from}</span>
                    <span className="font-bold text-text-primary">{priceLabel}</span>
                  </div>
                ) : null}
                {unitsLabel ? (
                  <div className="flex flex-col gap-s1">
                    <span className="text-body-sm text-text-muted">{labels.units}</span>
                    <span className="font-bold text-text-primary">{unitsLabel}</span>
                  </div>
                ) : null}
              </div>
            ) : null
          ) : sizeLabel ? (
            <span className="text-body-sm text-text-muted">{sizeLabel}</span>
          ) : null}

          {esDeveloper && dateLabel ? (
            <span className="flex items-center gap-s1 text-body-sm text-text-muted">
              <Calendar size={16} aria-hidden="true" />
              {dateLabel}
            </span>
          ) : null}

          {!esDeveloper ? (
            <StatusPill tone={status.tone} className="self-start">
              {status.label}
            </StatusPill>
          ) : null}

          {progress != null ? (
            <div className="flex flex-col gap-s1">
              {esDeveloper ? (
                <div className="flex items-center justify-between text-body-sm text-text-secondary">
                  <span>{labels.progress}</span>
                  <span className="font-medium">{Math.round(progress)}%</span>
                </div>
              ) : null}
              <ProgressBar percent={progress} label={name} showValue={!esDeveloper} />
            </div>
          ) : null}
        </div>
      </button>

      {onToggleFavorite ? (
        <FavoriteButton
          favorited={Boolean(favorited)}
          onToggle={onToggleFavorite}
          ariaLabel={favoriteAriaLabel}
          testId={favoriteTestId}
        />
      ) : null}
    </article>
  )
}

function FavoriteButton({
  favorited,
  onToggle,
  ariaLabel,
  testId
}: {
  favorited: boolean
  onToggle: () => void
  ariaLabel: string
  testId?: string
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={favorited}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggle()
      }}
      className="absolute top-s3 right-s3 z-10 rounded-full bg-card/90 p-s2 text-primary shadow-e1"
    >
      <Heart size={20} aria-hidden="true" className={favorited ? 'fill-primary' : ''} />
    </button>
  )
}
