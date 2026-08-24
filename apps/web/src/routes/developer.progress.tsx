import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { api } from '#/api/port'
import { DEV_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { ProgressTimeline, type TimelineStage } from '#/components/domain/ProgressTimeline'
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

  const { data: filas } = useQuery({
    queryKey: ['developer', 'progress'],
    queryFn: api.getDeveloperProgress,
    enabled: ready
  })

  if (!ready) return null

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

  return (
    <PanelLayout
      rol="developer"
      title={t('developer.progress.title')}
      context={t('developer.progress.context')}
    >
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
