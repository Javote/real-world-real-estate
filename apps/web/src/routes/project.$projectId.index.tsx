import type { ProjectStatus } from '@plataforma/shared'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  Building2,
  HardHat,
  Heart,
  Images,
  KeyRound,
  type LucideIcon,
  PencilRuler
} from 'lucide-react'
import { useState } from 'react'
import { ApiError, api, projectCoverUrl } from '#/api/port'
import { DocumentCard } from '#/components/domain/DocumentCard'
import { DocumentViewerModal } from '#/components/domain/DocumentViewerModal'
import { ImageGalleryModal } from '#/components/domain/ImageGalleryModal'
import { Loading } from '#/components/domain/Loading'
import { LocationMapModal } from '#/components/domain/LocationMapModal'
import { PrimaryButton, SecondaryButton } from '#/components/domain/PrimaryButton'
import { ProgressTimeline } from '#/components/domain/ProgressTimeline'
import { type StatusTone, TONOS } from '#/components/domain/StatusPill'
import { PanelLayout } from '#/components/PanelLayout'
import { formatDate, formatMonthYear } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'
import { useObjectUrls } from '#/lib/blobUrls'
import { CARD_SHELL } from '#/lib/cardShell'
import { cn } from '#/lib/cn'
import { esFoto, formatoArchivo, reintentarSiNoEsAusencia } from '#/lib/investor'
import { avanceDeStages, bajarBlob, TONO_PROYECTO, timelineDeStages } from '#/lib/stageProgress'

// Ninguno es un tilde: un tilde verde se lee como "verificado" (regla 17).
const ICONO_DE_ESTADO: Record<ProjectStatus, LucideIcon> = {
  planning: PencilRuler,
  in_progress: HardHat,
  delayed: HardHat,
  completed: KeyRound
}

const BORDE_DE_TONO: Record<StatusTone, string> = {
  verified: 'ring-1 ring-inset ring-verified',
  pending: 'ring-1 ring-inset ring-pending',
  info: 'ring-1 ring-inset ring-info',
  neutral: 'ring-1 ring-inset ring-border'
}

export const Route = createFileRoute('/project/$projectId/')({
  component: InvestorProjectDetail
})

function InvestorProjectDetail() {
  const { projectId } = Route.useParams()
  const { t, locale } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [galeria, setGaleria] = useState(false)
  const [mapa, setMapa] = useState(false)
  const [docId, setDocId] = useState<string | null>(null)
  const objectUrl = useObjectUrls()

  const {
    data: proyecto,
    error,
    isSuccess
  } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.getProject(projectId),
    retry: reintentarSiNoEsAusencia
  })

  const { data: documentos, isPending: documentosPending } = useQuery({
    queryKey: ['project', projectId, 'documents'],
    queryFn: () => api.listProjectDocuments(projectId),
    enabled: isSuccess,
    retry: reintentarSiNoEsAusencia
  })

  const { data: favoritos } = useQuery({
    queryKey: ['investor', 'favorites'],
    queryFn: api.listFavorites
  })

  const fotos = (documentos ?? []).filter((d) => esFoto(d.evidenceType, d.mimeType))
  const docs = (documentos ?? []).filter((d) => !esFoto(d.evidenceType, d.mimeType))

  const blobs = useQueries({
    queries: fotos.map((f) => ({
      queryKey: ['evidence-blob', f.id],
      queryFn: async () => objectUrl(await api.downloadEvidence(f.id)),
      gcTime: 0,
      enabled: isSuccess && galeria
    }))
  })

  const portada = projectCoverUrl(projectId, proyecto?.coverUpdatedAt ?? null)
  const imagenes = [
    ...(portada ? [{ url: portada, alt: t('investor.unit.gallery') }] : []),
    ...fotos.flatMap((_f, i) => {
      const url = blobs[i]?.data
      return url ? [{ url, alt: t('investor.unit.gallery') }] : []
    })
  ]

  const docAbierto = docs.find((d) => d.id === docId)

  const idsFavoritos = new Set((favoritos ?? []).map((p) => p.id))
  const esFavorito = idsFavoritos.has(projectId)

  const toggleFavorito = useMutation({
    mutationFn: () => (esFavorito ? api.removeFavorite(projectId) : api.addFavorite(projectId)),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['investor', 'favorites'] })
  })

  if (error instanceof ApiError && error.status === 403) {
    return (
      <PanelLayout title={t('error.forbidden')}>
        <p className="text-body text-text-muted" data-testid="INV-PROJECT-DETAIL-001">
          {t('error.forbidden')}
        </p>
      </PanelLayout>
    )
  }

  const ubicacion = [proyecto?.city, proyecto?.country].filter(Boolean).join(', ')
  const stages = proyecto?.stages ?? []
  const timeline = timelineDeStages(stages)
  const idPorOrden: Record<number, string> = Object.fromEntries(
    stages.map((s) => [s.sequenceOrder, s.id])
  )
  const actual = timeline.find((s) => s.state === 'current')

  const etiquetasDoc = {
    verified: t('status.verified'),
    pending: t('status.pending'),
    view: t('document.view'),
    download: t('document.download'),
    copy: t('hash.copy'),
    copied: t('hash.copied'),
    hashLabel: t('hash.label')
  }

  return (
    <PanelLayout
      title={proyecto?.name ?? t('panel.investor.title')}
      {...(ubicacion ? { context: ubicacion } : {})}
      back={{
        label: t('nav.back'),
        onClick: () => void navigate({ to: '/investor/buy' })
      }}
    >
      <section className="flex flex-col gap-s4" data-testid="INV-PROJECT-DETAIL-001">
        <div className="relative overflow-hidden rounded-xl bg-surface-alt">
          <button
            type="button"
            className="block w-full"
            onClick={() => (portada || fotos.length) && setGaleria(true)}
            aria-label={t('investor.unit.openGallery')}
          >
            {portada ? (
              <img src={portada} alt="" className="aspect-video w-full object-cover" />
            ) : (
              <span className="flex aspect-video w-full items-center justify-center text-disabled">
                <Building2 size={32} aria-hidden="true" />
              </span>
            )}
          </button>
          <button
            type="button"
            aria-pressed={esFavorito}
            aria-label={esFavorito ? t('investor.favorites.unsave') : t('investor.favorites.save')}
            onClick={() => toggleFavorito.mutate()}
            className="absolute right-s3 bottom-s3 rounded-full bg-card/90 p-s2 text-primary shadow-e1"
          >
            <Heart size={20} aria-hidden="true" className={esFavorito ? 'fill-primary' : ''} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-s3">
          <article
            className={cn(
              'flex flex-col items-center justify-center gap-s2 text-center',
              CARD_SHELL,
              proyecto?.status ? TONOS[TONO_PROYECTO[proyecto.status]] : undefined,
              proyecto?.status ? BORDE_DE_TONO[TONO_PROYECTO[proyecto.status]] : undefined
            )}
          >
            {proyecto?.status ? (
              <>
                <EstadoIcono status={proyecto.status} />
                <span className="text-h2 font-bold">{t(`project.status.${proyecto.status}`)}</span>
              </>
            ) : null}
            {proyecto?.estimatedDelivery ? (
              <p className="text-body-sm text-text-secondary">
                {t('investor.project.delivery', {
                  date: formatMonthYear(String(proyecto.estimatedDelivery), locale)
                })}
              </p>
            ) : null}
          </article>

          {proyecto?.latitude != null && proyecto.longitude != null ? (
            <button
              type="button"
              onClick={() => setMapa(true)}
              className="overflow-hidden rounded-xl bg-card text-left shadow-e1"
              aria-label={t('investor.project.location')}
            >
              <span className="block aspect-video">
                <LocationMapModal
                  open
                  variant="preview"
                  latitude={proyecto.latitude}
                  longitude={proyecto.longitude}
                  labels={{
                    title: t('investor.project.location'),
                    close: t('map.close'),
                    marker: t('map.marker')
                  }}
                />
              </span>
              {ubicacion ? (
                <span className="block truncate px-s3 py-s2 text-caption text-text-muted">
                  {ubicacion}
                </span>
              ) : null}
            </button>
          ) : (
            <article className={cn('flex flex-col justify-center', CARD_SHELL)}>
              {ubicacion ? (
                <p className="text-body-sm text-text-muted">{ubicacion}</p>
              ) : (
                <p className="text-body-sm text-text-muted">{t('investor.project.location')}</p>
              )}
            </article>
          )}
        </div>

        <section className="flex flex-col gap-s3" data-testid="INV-PROJECT-DOCS-002">
          <h2 className="text-h2 font-bold text-text-primary">{t('investor.project.docs')}</h2>
          {documentosPending ? (
            <Loading />
          ) : docs.length ? (
            <div className="grid grid-cols-2 gap-s3">
              {docs.map((d) => (
                <DocumentCard
                  key={d.id}
                  filename={d.originalFilename}
                  uploadedAtLabel={formatDate(String(d.uploadedAt), locale)}
                  format={formatoArchivo(d.mimeType, d.category)}
                  sha256={d.sha256Hash}
                  txid={d.txid}
                  showHash
                  labels={etiquetasDoc}
                  onView={() => setDocId(d.id)}
                  onDownload={
                    d.txid
                      ? () =>
                          void api
                            .downloadEvidence(d.id)
                            .then((blob) => bajarBlob(blob, d.originalFilename))
                      : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <p className="text-body-sm text-text-muted">{t('investor.project.docsEmpty')}</p>
          )}
        </section>

        {proyecto?.organizationId ? (
          <SecondaryButton
            testId="INV-DEVELOPER-LINK-004"
            onClick={() =>
              void navigate({ to: '/project/$projectId/developer', params: { projectId } })
            }
          >
            {t('investor.developer.link')}
          </SecondaryButton>
        ) : null}

        <article className={cn('flex flex-col gap-s3', CARD_SHELL)}>
          <h2 className="text-h2 font-bold text-text-primary">{t('investor.project.progress')}</h2>
          <ProgressTimeline
            stages={timeline}
            ariaLabel={t('investor.project.timelineAria')}
            currentLabel={
              actual ? t('investor.project.currentStage', { name: actual.name }) : undefined
            }
            finalizationLabel={
              proyecto?.estimatedDelivery
                ? t('investor.project.delivery', {
                    date: formatMonthYear(String(proyecto.estimatedDelivery), locale)
                  })
                : undefined
            }
            onSelectStage={(s) => {
              void navigate({
                to: '/project/$projectId/stage/$stageId',
                params: { projectId, stageId: idPorOrden[s.sequenceOrder] }
              })
            }}
          />
          {actual ? (
            <p className="flex items-center justify-between gap-s2 text-body-sm">
              <span className="text-text-primary">{actual.name}</span>
              <span className="text-text-muted">{avanceDeStages(stages)}%</span>
            </p>
          ) : null}
          <PrimaryButton
            onClick={() =>
              void navigate({ to: '/project/$projectId/progress', params: { projectId } })
            }
          >
            <Images className="size-icon-inline" aria-hidden="true" />
            {t('investor.project.viewProgress')}
          </PrimaryButton>
        </article>
      </section>

      <ImageGalleryModal
        open={galeria}
        onClose={() => setGaleria(false)}
        images={imagenes}
        labels={{
          title: t('investor.unit.gallery'),
          close: t('investor.gallery.close'),
          previous: t('investor.gallery.prev'),
          next: t('investor.gallery.next'),
          counter: (actualN, total) =>
            t('investor.unit.galleryCounter', {
              actual: String(actualN),
              total: String(total)
            })
        }}
      />

      {proyecto?.latitude != null && proyecto.longitude != null ? (
        <LocationMapModal
          open={mapa}
          onClose={() => setMapa(false)}
          latitude={proyecto.latitude}
          longitude={proyecto.longitude}
          addressLabel={ubicacion || undefined}
          labels={{
            title: t('investor.project.location'),
            close: t('map.close'),
            marker: t('map.marker')
          }}
        />
      ) : null}

      <DocumentViewerModal
        open={Boolean(docAbierto)}
        onClose={() => setDocId(null)}
        title={docAbierto?.category ?? t('investor.project.docs')}
        filename={docAbierto?.originalFilename ?? ''}
        pageUrl=""
        dateLabel={docAbierto ? formatDate(String(docAbierto.uploadedAt), locale) : ''}
        txid={docAbierto?.txid ?? null}
        onDownload={
          docAbierto?.txid
            ? () =>
                void api
                  .downloadEvidence(docAbierto.id)
                  .then((blob) => bajarBlob(blob, docAbierto.originalFilename))
            : undefined
        }
        labels={{
          verified: t('status.verified'),
          pending: t('status.pending'),
          download: t('document.download'),
          watermark: t('document.watermark')
        }}
      />
    </PanelLayout>
  )
}

function EstadoIcono({ status }: { status: ProjectStatus }) {
  const Icono = ICONO_DE_ESTADO[status]
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-card">
      <Icono className="size-icon-stat" aria-hidden="true" />
    </span>
  )
}
