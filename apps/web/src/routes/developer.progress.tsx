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
import { formatMonthYear } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'
import { claveEstadoStage } from '#/lib/investor'
import { avanceDeStages } from '#/lib/stageProgress'

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
// etapa en el contrato: no se dibuja (deuda declarada, `apps/web/CLAUDE.md`).
//
// **"Overall Progress: N%" (M3 §2.2) es derivado por proyecto** (D-021/
// DECISIONS.md: `completadas/total`, sin peso por etapa) y lo dibuja esta
// pantalla — no `ProgressTimeline`, que solo sabe de nodos y una etiqueta.
// `finalizationLabel` sale de `Project.estimatedDelivery`. "Stage Detail"
// lista las etapas del proyecto con su `certifiedAt` cuando existe.
//
// **"Etapa N/total" usa la POSICIÓN en la lista, no `sequenceOrder` crudo**
// (M3 §2.5, encontrado corrigiendo la etapa fabricada de `torre-a`). Un
// proyecto viejo puede tener huecos —`torre-a` en producción tiene
// `sequenceOrder` 1/2/3 con solo 3 filas, no 10— y numerador/denominador
// tienen que salir de la MISMA base o el numerador puede superar al total.
// Tampoco vale hardcodear el tamaño del catálogo (10): la fila 1 de `torre-a`
// es "Cimentación", que en `DEFAULT_STAGE_CATALOG` es la etapa 4 — decir
// "1/10" ahí sería una alineación falsa con un catálogo que ese proyecto no
// usa. La posición en la lista es honesta para cualquier forma que tenga el
// proyecto.
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

/** Fila de "Stage Detail" — el dato crudo, no el nodo mapeado del timeline. */
interface DetalleStage {
  stageId: string
  name: string
  state: string
  certifiedAt: string | null
}

function DeveloperProgress() {
  const { ready } = useRoleGuard(DEV_ROLES)
  const { t, locale } = useTranslation()
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
            const idxActual = p.stages.findIndex((s) => s.state === 'current')
            const total = p.stages.length
            const porcentaje = avanceDeStages(p.detalle.map((s) => ({ state: s.state })))
            return (
              <article key={id} className="flex flex-col gap-s4 rounded-xl bg-card p-s4 shadow-e1">
                <h2 className="text-body font-bold text-text-primary">{p.nombre}</h2>

                <div className="flex flex-col gap-s2">
                  <span className="text-body font-bold text-text-primary">
                    {t('developer.progress.overallProgress', { percent: String(porcentaje) })}
                  </span>
                  <div
                    role="progressbar"
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
          <p className="rounded-xl bg-card p-s4 text-body-sm text-text-muted shadow-e1">
            {t('developer.progress.empty')}
          </p>
        )}
      </section>
    </PanelLayout>
  )
}
