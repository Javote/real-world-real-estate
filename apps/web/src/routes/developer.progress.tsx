import type { StageState } from '@plataforma/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AlertCircle } from 'lucide-react'
import { api } from '#/api/port'
import { DEV_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { Loading } from '#/components/domain/Loading'
import { PrimaryButton } from '#/components/domain/PrimaryButton'
import { ProgressTimeline, type TimelineStage } from '#/components/domain/ProgressTimeline'
import { StatCard } from '#/components/domain/StatCard'
import { StatusPill } from '#/components/domain/StatusPill'
import { PanelLayout } from '#/components/PanelLayout'
import { formatMonthYear } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL, CARD_SHELL_EMPTY } from '#/lib/cardShell'
import { cn } from '#/lib/cn'
import { claveEstadoStage } from '#/lib/investor'
import { avanceDeStages } from '#/lib/stageProgress'

export const Route = createFileRoute('/developer/progress')({ component: DeveloperProgress })

function nodoDe(state: string): TimelineStage['state'] {
  if (state === 'Completed') return 'completed'
  if (state === 'InProgress' || state === 'Observed') return 'current'
  return 'pending'
}

interface DetalleStage {
  stageId: string
  name: string
  state: StageState
  certifiedAt: string | null
}

function DeveloperProgress() {
  const { ready } = useRoleGuard(DEV_ROLES)
  const { t, locale } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: filas, isPending } = useQuery({
    queryKey: ['developer', 'progress'],
    queryFn: api.getDeveloperProgress,
    enabled: ready
  })

  const reanudar = useMutation({
    mutationFn: (stageId: string) => api.setMilestoneState(stageId, 'InProgress'),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['developer', 'progress'] })
  })

  if (!ready) return null

  const observadas = (filas ?? []).filter((f) => f.state === 'Observed')

  const porProyecto = new Map<
    string,
    {
      nombre: string
      stages: TimelineStage[]
      detalle: DetalleStage[]
      estimatedDelivery: string | null
    }
  >()
  for (const f of filas ?? []) {
    const actual = porProyecto.get(f.projectId) ?? {
      nombre: f.projectName,
      stages: [],
      detalle: [],
      estimatedDelivery: f.estimatedDelivery
    }
    actual.stages.push({
      sequenceOrder: f.sequenceOrder,
      name: f.stageName,
      state: nodoDe(f.state)
    })
    actual.detalle.push({
      stageId: f.stageId,
      name: f.stageName,
      state: f.state,
      certifiedAt: f.certifiedAt
    })
    porProyecto.set(f.projectId, actual)
  }

  const etapas = [...porProyecto.values()].flatMap((p) => p.stages)
  const completadas = etapas.filter((s) => s.state === 'completed').length
  const enCurso = etapas.filter((s) => s.state === 'current').length
  const pendientes = etapas.filter((s) => s.state === 'pending').length

  return (
    <PanelLayout
      rol="developer"
      title={t('developer.progress.title')}
      context={t('developer.progress.context')}
      back={{
        label: t('nav.backToPanel'),
        onClick: () => void navigate({ to: '/developer' })
      }}
    >
      <section className="grid grid-cols-3 gap-s3">
        <StatCard value={String(completadas)} label={t('developer.progress.completed')} />
        <StatCard value={String(enCurso)} label={t('developer.progress.inProgress')} />
        <StatCard value={String(pendientes)} label={t('developer.progress.pending')} />
      </section>

      {observadas.length ? (
        <section
          className={cn('flex flex-col gap-s3', CARD_SHELL)}
          data-testid="DEV-PROGRESS-RESUME"
        >
          <h2 className="flex items-center gap-s2 text-body font-bold text-text-primary">
            <AlertCircle className="size-icon-inline text-pending" aria-hidden="true" />
            {t('developer.progress.observedTitle')}
          </h2>
          <ul className="flex flex-col gap-s2">
            {observadas.map((f) => (
              <li
                key={f.stageId}
                className="flex items-center justify-between gap-s3 rounded-md bg-surface-alt p-s3"
              >
                <div className="flex flex-col gap-s1">
                  <span className="text-body-sm font-medium text-text-primary">
                    {f.projectName} · {f.stageName}
                  </span>
                  <StatusPill tone="pending" className="self-start">
                    {t('status.observed')}
                  </StatusPill>
                </div>
                <PrimaryButton
                  testId="DEV-PROGRESS-RESUME-BTN"
                  onClick={() => reanudar.mutate(f.stageId)}
                  loading={reanudar.isPending && reanudar.variables === f.stageId}
                  disabled={reanudar.isPending}
                >
                  {t('developer.progress.resume')}
                </PrimaryButton>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-s3" data-testid="DEV-PROGRESS-001">
        {isPending ? (
          <Loading />
        ) : porProyecto.size ? (
          [...porProyecto.entries()].map(([id, p]) => {
            const idxActual = p.stages.findIndex((s) => s.state === 'current')
            const total = p.stages.length
            const porcentaje = avanceDeStages(p.detalle.map((s) => ({ state: s.state })))
            return (
              <article key={id} className={cn('flex flex-col gap-s4', CARD_SHELL)}>
                <h2 className="text-body font-bold text-text-primary">{p.nombre}</h2>

                <div className="flex flex-col gap-s2">
                  <span className="text-body font-bold text-text-primary">
                    {t('developer.progress.overallProgress', { percent: String(porcentaje) })}
                  </span>
                  <div
                    role="progressbar"
                    aria-label={p.nombre}
                    aria-valuenow={porcentaje}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-2 w-full overflow-hidden rounded-full bg-surface-alt"
                  >
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${porcentaje}%` }}
                    />
                  </div>
                </div>

                <ProgressTimeline
                  stages={p.stages}
                  ariaLabel={t('developer.progress.timelineAria', { project: p.nombre })}
                  {...(idxActual >= 0
                    ? {
                        currentLabel: t('developer.progress.currentStage', {
                          number: String(idxActual + 1),
                          name: p.stages[idxActual].name
                        })
                      }
                    : {})}
                  {...(p.estimatedDelivery
                    ? {
                        finalizationLabel: t('developer.progress.delivery', {
                          date: formatMonthYear(p.estimatedDelivery, locale)
                        })
                      }
                    : {})}
                />

                <div className="flex flex-col gap-s3">
                  <h3 className="text-body-sm font-bold text-text-primary">
                    {t('developer.progress.stageDetail')}
                  </h3>
                  <ul className="flex flex-col gap-s2">
                    {p.detalle.map((s, i) => (
                      <li
                        key={s.stageId}
                        className="flex items-center justify-between gap-s3 rounded-md bg-surface-alt p-s3"
                      >
                        <span className="flex flex-col gap-s1">
                          <span className="text-body-sm font-medium text-text-primary">
                            {s.name}
                          </span>
                          <span className="text-caption text-text-muted">
                            {t('developer.progress.stageOf', {
                              number: String(i + 1),
                              total: String(total)
                            })}
                            {s.certifiedAt ? ` · ${formatMonthYear(s.certifiedAt, locale)}` : ''}
                          </span>
                        </span>
                        <StatusPill tone={s.state === 'Completed' ? 'verified' : 'pending'}>
                          {t(claveEstadoStage(s.state))}
                        </StatusPill>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            )
          })
        ) : (
          <p className={CARD_SHELL_EMPTY}>{t('developer.progress.empty')}</p>
        )}
      </section>
    </PanelLayout>
  )
}
