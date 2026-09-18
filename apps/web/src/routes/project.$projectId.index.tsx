import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Building2, Heart, Images } from 'lucide-react'
import { useState } from 'react'
import { ApiError, api } from '#/api/port'
import { INVESTOR_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { DocumentCard } from '#/components/domain/DocumentCard'
import { DocumentViewerModal } from '#/components/domain/DocumentViewerModal'
import { ImageGalleryModal } from '#/components/domain/ImageGalleryModal'
import { LocationMapModal } from '#/components/domain/LocationMapModal'
import { PrimaryButton } from '#/components/domain/PrimaryButton'
import { ProgressTimeline } from '#/components/domain/ProgressTimeline'
import { PanelLayout } from '#/components/PanelLayout'
import { formatDate, formatMonthYear } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'
import { useObjectUrls } from '#/lib/blobUrls'
import { esFoto, formatoArchivo, reintentarSiNoEsAusencia } from '#/lib/investor'
import { avanceDeStages, bajarBlob, timelineDeStages } from '#/lib/stageProgress'

// **M2-D5 filas 06-07 · `/project/:projectId`** — capturas 6 y 7.
// Test IDs: INV-PROJECT-DETAIL-001, INV-PROJECT-DOCS-002. Patrones: P1, P2.
//
// GET /projects/:id está scopeado por membresía: un buyer que no es miembro
// recibe 403. Se muestra como error, no se cambia la API.
//
// Org name, rating y "Price from" no se dibujan: el contrato no los da.

export const Route = createFileRoute('/project/$projectId/')({
  component: InvestorProjectDetail
})

function InvestorProjectDetail() {
  const { projectId } = Route.useParams()
  const { ready } = useRoleGuard(INVESTOR_ROLES)
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
    enabled: ready,
    retry: reintentarSiNoEsAusencia
  })

  const { data: documentos } = useQuery({
    queryKey: ['project', projectId, 'documents'],
    queryFn: () => api.listProjectDocuments(projectId),
    enabled: ready && isSuccess,
    retry: reintentarSiNoEsAusencia
  })

  const { data: favoritos } = useQuery({
    queryKey: ['investor', 'favorites'],
    queryFn: api.listFavorites,
    enabled: ready
  })

  const fotos = (documentos ?? []).filter((d) => esFoto(d.evidenceType, d.mimeType))
  const docs = (documentos ?? []).filter((d) => !esFoto(d.evidenceType, d.mimeType))

  const blobs = useQueries({
    queries: fotos.map((f, i) => ({
      queryKey: ['evidence-blob', f.id],
      queryFn: async () => objectUrl(await api.downloadEvidence(f.id)),
      // `gcTime: 0`: la URL se revoca al desmontar, así que la caché no puede
      // sobrevivirle — devolvería una URL muerta al volver a la pantalla.
      gcTime: 0,
      enabled: ready && isSuccess && (galeria || i === 0)
    }))
  })

  const imagenes = fotos.flatMap((_f, i) => {
    const url = blobs[i]?.data
    return url ? [{ url, alt: t('investor.unit.gallery') }] : []
  })

  const docAbierto = docs.find((d) => d.id === docId)
  const { data: docUrl } = useQuery({
    queryKey: ['evidence-blob', docId],
    queryFn: async () => objectUrl(await api.downloadEvidence(docId!)),
    gcTime: 0,
    enabled: Boolean(docId)
  })

  const idsFavoritos = new Set((favoritos ?? []).map((p) => p.id))
  const esFavorito = idsFavoritos.has(projectId)

  const toggleFavorito = useMutation({
    mutationFn: () => (esFavorito ? api.removeFavorite(projectId) : api.addFavorite(projectId)),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['investor', 'favorites'] })
  })

  if (!ready) return null

  if (error instanceof ApiError && error.status === 403) {
    return (
      <PanelLayout rol="investor" title={t('error.forbidden')}>
        <p className="text-body text-text-muted" data-testid="INV-PROJECT-DETAIL-001">
          {t('error.forbidden')}
        </p>
      </PanelLayout>
    )
  }

  const ubicacion = [proyecto?.city, proyecto?.country].filter(Boolean).join(', ')
  const stages = proyecto?.stages ?? []
  const timeline = timelineDeStages(stages)
  const actual = timeline.find((s) => s.state === 'current')
  const portada = imagenes[0]?.url

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
      rol="investor"
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
            onClick={() => imagenes.length && setGaleria(true)}
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
          {/* Sin `data-testid`: INV-FAV-TOGGLE-002 vive en la fila 13
              (`/investor/favorites`). Acá es la misma acción, no el mismo ID. */}
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
          <article className="flex flex-col gap-s2 rounded-xl bg-card p-s4 shadow-e1">
            {proyecto?.status ? (
              <span className="text-body-sm font-medium text-text-muted">
                {t(`project.status.${proyecto.status}` as never)}
              </span>
            ) : null}
            {proyecto?.estimatedDelivery ? (
              <p className="text-body-sm text-text-muted">
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
              <span className="flex aspect-video items-center justify-center bg-surface-alt text-primary">
                <Building2 className="size-icon-stat" aria-hidden="true" />
              </span>
              {ubicacion ? (
                <span className="block truncate px-s3 py-s2 text-caption text-text-muted">
                  {ubicacion}
                </span>
              ) : null}
            </button>
          ) : (
            <article className="flex flex-col justify-center rounded-xl bg-card p-s4 shadow-e1">
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
          {docs.length ? (
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

        <article className="flex flex-col gap-s3 rounded-xl bg-card p-s4 shadow-e1">
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
              const stage = stages.find((x) => s.sequenceOrder === x.sequenceOrder)
              if (!stage) return
              void navigate({
                to: '/project/$projectId/stage/$stageId',
                params: { projectId, stageId: stage.id }
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
        pageUrl={
          esFoto(docAbierto?.evidenceType ?? '', docAbierto?.mimeType ?? '') ? (docUrl ?? '') : ''
        }
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
