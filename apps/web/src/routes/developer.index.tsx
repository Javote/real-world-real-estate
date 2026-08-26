import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Building2, FileCheck2, Home, Plus, TrendingUp, Users } from 'lucide-react'
import { api } from '#/api/port'
import { DEV_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { ActionCard } from '#/components/domain/ActionCard'
import { StatCard } from '#/components/domain/StatCard'
import { KpiValue } from '#/components/KpiValue'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'

// **M2-D5 fila 33-34 · `/developer` (Panel)** — captura 33-DEVELOPER-HOME-A.
// Componentes: StatCard, ActionCard (featured), NotificationBell,
// GradientHeader. Endpoint: GET /developer/kpis. Test ID: DEV-PANEL-KPIS-001.

// `.index` y no `developer.tsx`: un archivo de ruta sin `.index` es el LAYOUT
// de todo lo que cuelga del prefijo y tiene que renderizar un `<Outlet/>`. Sin
// esto, `/developer/projects` mostraba el panel. Misma corrección que en
// `notary.index.tsx` y `certifier.index.tsx`.
export const Route = createFileRoute('/developer/')({ component: DeveloperPanel })

function DeveloperPanel() {
  const { session, ready } = useRoleGuard(DEV_ROLES)
  const { t } = useTranslation()
  const kpi = KpiValue()
  const navigate = useNavigate()

  const { data } = useQuery({
    queryKey: ['developer', 'kpis'],
    queryFn: api.getDeveloperKpis,
    enabled: ready
  })

  if (!ready) return null

  return (
    <PanelLayout
      rol="developer"
      title={t('panel.developer.title')}
      context={session ? t('panel.welcome', { name: session.user.fullName }) : undefined}
      onOpenNotifications={() => void navigate({ to: '/developer' })}
      onOpenProfile={() => void navigate({ to: '/developer/profile' })}
    >
      <section className="grid grid-cols-2 gap-s4" data-testid="DEV-PANEL-KPIS-001">
        <ActionCard
          title={t('panel.developer.newProject')}
          description={t('panel.developer.newProjectHint')}
          icon={Plus}
          featured
          onClick={() => void navigate({ to: '/developer' })}
          testId="DEV-PROJECT-CREATE-001"
        />
        <StatCard
          value={kpi(data?.activeProjects ?? null)}
          label={t('panel.developer.activeProjects')}
          icon={Building2}
          tone="entity"
        />
        <StatCard
          value={kpi(data?.totalUnits ?? null)}
          label={t('panel.developer.totalUnits')}
          icon={Home}
          tone="portfolio"
        />
        <StatCard
          value={kpi(data?.averageProgress ?? null, '%')}
          label={t('panel.developer.averageProgress')}
          helper={t('panel.developer.averageProgressHint')}
          icon={TrendingUp}
          tone="trend"
        />
        <StatCard
          value={kpi(data?.verifiedDocuments ?? null)}
          label={t('panel.developer.verifiedDocuments')}
          helper={t('panel.developer.verifiedDocumentsHint')}
          icon={FileCheck2}
          tone="verification"
        />
      </section>

      {/* **Los accesos a las pantallas huérfanas (D-072), fuera del grid de
          KPIs a propósito.** Las capturas 33/34 fijan la composición de ese
          grid —un ActionCard destacado y siete StatCards— y meterle tiles de
          navegación lo desviaría de lo que el entregable muestra. Acá van los
          destinos que M2-D1 §5.2 le da al developer sin decir cómo se llega.

          Solo se listan los que EXISTEN: `/developer/documentation` entra con
          su pantalla, no antes. */}
      <section className="grid grid-cols-2 gap-s3">
        <ActionCard
          title={t('panel.developer.investorsAction')}
          description={t('panel.developer.investorsHint')}
          icon={Users}
          onClick={() => void navigate({ to: '/developer/investors' })}
        />
      </section>
    </PanelLayout>
  )
}
