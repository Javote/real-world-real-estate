import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { api } from '#/api/port'
import { INVESTOR_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { ProjectCard } from '#/components/domain/ProjectCard'
import type { StatusTone } from '#/components/domain/StatusPill'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'

// **M2-D5 fila 02 · `/investor/buy` (listing)** — captura 2-INVESTOR-HOME.
// Componentes: ProjectCard, NotificationBell, BottomNav, GradientHeader.
// Endpoint: GET /projects?status=. Test ID: INV-BUY-LIST-001.
//
// Los modos map / search / filter son las filas 03, 04 y 05: superficies
// propias, no se adelantan acá.

export const Route = createFileRoute('/investor/buy')({ component: InvestorBuy })

/** El estado del proyecto contra la matriz de M2-D3, sin inventar estados. */
const TONO_POR_ESTADO: Record<string, StatusTone> = {
  planning: 'info',
  in_progress: 'pending',
  delayed: 'pending',
  completed: 'verified'
}

function InvestorBuy() {
  const { ready } = useRoleGuard(INVESTOR_ROLES)
  const { t } = useTranslation()

  const { data: proyectos } = useQuery({
    queryKey: ['projects'],
    queryFn: api.listProjects,
    enabled: ready
  })

  if (!ready) return null

  return (
    <PanelLayout rol="investor" title={t('panel.investor.title')} onOpenNotifications={() => {}}>
      <section className="flex flex-col gap-s4" data-testid="INV-BUY-LIST-001">
        {proyectos?.length ? (
          proyectos.map((proyecto) => {
            const stages = proyecto.stages ?? []
            const completados = stages.filter((s) => s.state === 'Completed').length
            const avance = stages.length ? Math.round((completados / stages.length) * 100) : 0
            const ubicacion = [proyecto.city, proyecto.country].filter(Boolean).join(', ')

            return (
              <ProjectCard
                key={proyecto.id}
                name={proyecto.name}
                location={ubicacion || null}
                status={{
                  label: t(`project.status.${proyecto.status}` as never),
                  tone: TONO_POR_ESTADO[proyecto.status] ?? 'neutral'
                }}
                progress={avance}
                onOpen={() => {}}
                labels={{ from: t('project.from') }}
                testId={`INV-BUY-CARD-${proyecto.id}`}
              />
            )
          })
        ) : (
          <p className="text-body-sm text-text-muted">{t('panel.investor.empty')}</p>
        )}
      </section>
    </PanelLayout>
  )
}
