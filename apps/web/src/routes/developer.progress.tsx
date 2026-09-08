import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AlertCircle } from 'lucide-react'
import { api } from '#/api/port'
import { DEV_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { PrimaryButton } from '#/components/domain/PrimaryButton'
import { ProgressTimeline, type TimelineStage } from '#/components/domain/ProgressTimeline'
import { StatCard } from '#/components/domain/StatCard'
import { StatusPill } from '#/components/domain/StatusPill'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'

// **M2-D5 fila 45 · `/developer/progress`** — el avance de obra a través de
// todos los proyectos. Endpoint: GET /developer/progress.
// Test ID: DEV-PROGRESS-001.
//
// **Es la dimensión de OBRA, no la de prueba.** El `ProgressTimeline` muestra
// en qué etapa va la construcción; qué está anclado lo muestran los
// `StageChips` (P9). Dos preguntas distintas — M2-D4 §6.1: los patrones
// componen, nunca se superponen.
//
// **Los tres StatCard se derivan de los estados de las etapas**, que el
// endpoint ya trae. La captura 45 los muestra sobre UN desarrollo de diez
// etapas; acá el endpoint cruza proyectos, así que los conteos y los
// timelines son por el conjunto, agrupados por proyecto. No hay thumbnail de
// etapa en el contrato: no se dibuja.
//
// **"Etapas observadas" (`DEV-PROGRESS-RESUME`) no está en ninguna
// captura — es una decisión nueva, no una superficie de M2-D5.** El diagrama
// canónico (`M1-D2c-milestone-lifecycle`) etiqueta `Observed → InProgress`
// como "remediation completed": el developer decide cuándo la corrección
// está lista, así que es una acción explícita y separada de subir evidencia
// (a diferencia de `Pending → InProgress`, que sí se dispara solo con la
// primera evidencia — ver `POST /projects/:id/evidence`). Reusa
// `PATCH /stages/:id/state`, ya restringido a que el developer solo pueda
// pedir `→ InProgress`.

export const Route = createFileRoute('/developer/progress')({ component: DeveloperProgress })

/** Del estado de la FSM al estado visual del nodo. */
function nodoDe(state: string): TimelineStage['state'] {
  if (state === 'Completed') return 'completed'
  if (state === 'InProgress' || state === 'Observed') return 'current'
  return 'pending'
}

function DeveloperProgress() {
  const { ready } = useRoleGuard(DEV_ROLES)
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: filas } = useQuery({
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

  // Agrupado por proyecto: la respuesta viene plana, una fila por etapa.
  const porProyecto = new Map<string, { nombre: string; stages: TimelineStage[] }>()
  for (const f of filas ?? []) {
    const actual = porProyecto.get(f.projectId) ?? { nombre: f.projectName, stages: [] }
    actual.stages.push({
      sequenceOrder: f.sequenceOrder,
      name: f.stageName,
      state: nodoDe(f.state)
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
          className="flex flex-col gap-s3 rounded-xl bg-card p-s4 shadow-e1"
          data-testid="DEV-PROGRESS-RESUME"
        >
          <h2 className="flex items-center gap-s2 text-body font-bold text-text-primary">
            <AlertCircle className="size-icon-sm text-pending" aria-hidden="true" />
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
                  <StatusPill tone="pending">{t('status.observed')}</StatusPill>
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
        {porProyecto.size ? (
          [...porProyecto.entries()].map(([id, p]) => {
            const actual = p.stages.find((s) => s.state === 'current')
            return (
              <article key={id} className="flex flex-col gap-s3 rounded-xl bg-card p-s4 shadow-e1">
                <h2 className="text-body font-bold text-text-primary">{p.nombre}</h2>
                <ProgressTimeline
                  stages={p.stages}
                  ariaLabel={t('developer.progress.timelineAria', { project: p.nombre })}
                  {...(actual
                    ? {
                        currentLabel: t('developer.progress.currentStage', {
                          number: String(actual.sequenceOrder),
                          name: actual.name
                        })
                      }
                    : {})}
                />
              </article>
            )
          })
        ) : (
          <p className="rounded-xl bg-card p-s4 text-body-sm text-text-muted shadow-e1">
            {t('developer.progress.empty')}
          </p>
        )}
      </section>
    </PanelLayout>
  )
}
