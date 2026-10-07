import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { FileText, Images } from 'lucide-react'
import { ApiError } from '#/api/port'
import { proyectoQueries } from '#/api/queries'
import { Loading } from '#/components/domain/Loading'
import { ProgressTimeline } from '#/components/domain/ProgressTimeline'
import { StatusPill } from '#/components/domain/StatusPill'
import { PanelLayout } from '#/components/PanelLayout'
import { formatMonthYear } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL } from '#/lib/cardShell'
import { cn } from '#/lib/cn'
import { claveEstadoStage, reintentarSiNoEsAusencia } from '#/lib/investor'
import { timelineDeStages } from '#/lib/stageProgress'

export const Route = createFileRoute('/project/$projectId/progress')({
  loader: ({ context: { queryClient }, params: { projectId } }) => {
    void queryClient.prefetchQuery(proyectoQueries.detalle(projectId))
    void queryClient.prefetchQuery(proyectoQueries.etapas(projectId))
    void queryClient.prefetchQuery(proyectoQueries.documentos(projectId))
  },
  component: InvestorProjectProgress
})

function InvestorProjectProgress() {
  const { projectId } = Route.useParams()
  const { t, locale } = useTranslation()
  const navigate = useNavigate()

  const { data: proyecto, error: errorProyecto } = useQuery({
    ...proyectoQueries.detalle(projectId),
    retry: reintentarSiNoEsAusencia
  })

  const {
    data: stages,
    error,
    isPending
  } = useQuery({
    ...proyectoQueries.etapas(projectId),
    retry: reintentarSiNoEsAusencia
  })

  const { data: documentos } = useQuery({
    ...proyectoQueries.documentos(projectId),
    retry: reintentarSiNoEsAusencia
  })

  if (
    (error instanceof ApiError && error.status === 403) ||
    (errorProyecto instanceof ApiError && errorProyecto.status === 403)
  ) {
    return (
      <PanelLayout title={t('investor.project.progress')}>
        <p data-testid="INV-PROJECT-STAGES-001">{t('error.forbidden')}</p>
      </PanelLayout>
    )
  }

  const lista = stages ?? []
  const timeline = timelineDeStages(lista)
  const idPorOrden: Record<number, string> = Object.fromEntries(
    lista.map((s) => [s.sequenceOrder, s.id])
  )
  const actual = timeline.find((s) => s.state === 'current')
  const total = lista.length

  const fotosPorStage = new Map<string, number>()
  for (const d of documentos ?? []) {
    if (d.stageId && (d.evidenceType === 'photo' || d.mimeType.startsWith('image/'))) {
      fotosPorStage.set(d.stageId, (fotosPorStage.get(d.stageId) ?? 0) + 1)
    }
  }

  return (
    <PanelLayout
      title={t('investor.project.progress')}
      context={proyecto ? proyecto.name : null}
      back={{
        label: t('investor.project.back'),
        onClick: () => void navigate({ to: '/project/$projectId', params: { projectId } })
      }}
    >
      <section className="flex flex-col gap-s4" data-testid="INV-PROJECT-STAGES-001">
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
        </article>

        <h2 className="text-h2 font-bold text-text-primary">{t('investor.project.stages')}</h2>

        {isPending ? (
          <Loading />
        ) : lista.length ? (
          lista.map((stage, i) => {
            const fotos = fotosPorStage.get(stage.id) ?? 0
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() =>
                  void navigate({
                    to: '/project/$projectId/stage/$stageId',
                    params: { projectId, stageId: stage.id }
                  })
                }
                className="flex flex-col gap-s3 rounded-xl bg-card p-s4 text-left shadow-e1"
              >
                <span className="flex items-center justify-between gap-s2">
                  <span className="text-body font-bold text-text-primary">{stage.name}</span>
                  <span className="text-caption text-text-muted">
                    {t('investor.stage.number', {
                      number: String(i + 1),
                      total: String(total)
                    })}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-s2">
                  {fotos ? (
                    <span className="inline-flex items-center gap-s1 rounded-full bg-surface-alt px-s3 py-s1 text-caption text-text-secondary">
                      <Images className="size-icon-inline" aria-hidden="true" />
                      {t('investor.stage.imagesCount', { count: String(fotos) })}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-s1 rounded-full bg-surface-alt px-s3 py-s1 text-caption text-text-secondary">
                    <FileText className="size-icon-inline" aria-hidden="true" />
                    {t('investor.stage.documentation')}
                  </span>
                  <StatusPill tone={stage.state === 'Completed' ? 'verified' : 'pending'}>
                    {t(claveEstadoStage(stage.state))}
                  </StatusPill>
                </span>
              </button>
            )
          })
        ) : (
          <p className="text-body-sm text-text-muted">{t('developer.progress.empty')}</p>
        )}
      </section>
    </PanelLayout>
  )
}
