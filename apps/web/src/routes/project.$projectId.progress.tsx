import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { FileText, Images } from 'lucide-react'
import { ApiError, api } from '#/api/port'
import { INVESTOR_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { ProgressTimeline } from '#/components/domain/ProgressTimeline'
import { StatusPill } from '#/components/domain/StatusPill'
import { PanelLayout } from '#/components/PanelLayout'
import { formatMonthYear } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'
import { claveEstadoStage, reintentarSiNoEsAusencia } from '#/lib/investor'
import { timelineDeStages } from '#/lib/stageProgress'

// **M2-D5 fila 08 · `/project/:projectId/progress`** — captura 8.
// Test ID: INV-PROJECT-STAGES-001.

export const Route = createFileRoute('/project/$projectId/progress')({
  component: InvestorProjectProgress
})

function InvestorProjectProgress() {
  const { projectId } = Route.useParams()
  const { ready } = useRoleGuard(INVESTOR_ROLES)
  const { t, locale } = useTranslation()
  const navigate = useNavigate()

  const { data: proyecto, error: errorProyecto } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.getProject(projectId),
    enabled: ready,
    retry: reintentarSiNoEsAusencia
  })

  const { data: stages, error } = useQuery({
    queryKey: ['project', projectId, 'stages'],
    queryFn: () => api.listProjectStages(projectId),
    enabled: ready,
    retry: reintentarSiNoEsAusencia
  })

  const { data: documentos } = useQuery({
    queryKey: ['project', projectId, 'documents'],
    queryFn: () => api.listProjectDocuments(projectId),
    enabled: ready,
    retry: reintentarSiNoEsAusencia
  })

  if (!ready) return null

  if (
    (error instanceof ApiError && error.status === 403) ||
    (errorProyecto instanceof ApiError && errorProyecto.status === 403)
  ) {
    return (
      <PanelLayout rol="investor" title={t('investor.project.progress')}>
        <p data-testid="INV-PROJECT-STAGES-001">{t('error.forbidden')}</p>
      </PanelLayout>
    )
  }

  const lista = stages ?? []
  const timeline = timelineDeStages(lista)
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
      rol="investor"
      title={t('investor.project.progress')}
      {...(proyecto ? { context: proyecto.name } : {})}
      back={{
        label: t('investor.project.back'),
        onClick: () => void navigate({ to: '/project/$projectId', params: { projectId } })
      }}
    >
      <section className="flex flex-col gap-s4" data-testid="INV-PROJECT-STAGES-001">
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
              const stage = lista.find((x) => x.sequenceOrder === s.sequenceOrder)
              if (!stage) return
              void navigate({
                to: '/project/$projectId/stage/$stageId',
                params: { projectId, stageId: stage.id }
              })
            }}
          />
        </article>

        <h2 className="text-h2 font-bold text-text-primary">{t('investor.project.stages')}</h2>

        {lista.length ? (
          lista.map((stage) => {
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
                      number: String(stage.sequenceOrder),
                      total: String(total)
                    })}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-s2">
                  {fotos ? (
                    <span className="inline-flex items-center gap-s1 rounded-full bg-surface-alt px-s3 py-s1 text-caption text-text-secondary">
                      <Images className="size-icon-sm" aria-hidden="true" />
                      {t('investor.stage.imagesCount', { count: String(fotos) })}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-s1 rounded-full bg-surface-alt px-s3 py-s1 text-caption text-text-secondary">
                    <FileText className="size-icon-sm" aria-hidden="true" />
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
