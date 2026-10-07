import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  Building2,
  DollarSign,
  FileCheck2,
  Home,
  Plus,
  ScrollText,
  TrendingUp,
  Users
} from 'lucide-react'
import { kpiQueries } from '#/api/queries'
import { ActionCard } from '#/components/domain/ActionCard'
import { StatCard } from '#/components/domain/StatCard'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'
import { useKpiValue } from '#/lib/useKpiValue'

export const Route = createFileRoute('/developer/')({
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(kpiQueries.developer())
  },
  component: DeveloperPanel
})

function DeveloperPanel() {
  const { session } = Route.useRouteContext()
  const { t } = useTranslation()
  const kpi = useKpiValue()
  const navigate = useNavigate()

  const { data } = useQuery(kpiQueries.developer())

  return (
    <PanelLayout
      title={t('panel.developer.title')}
      context={t('panel.welcome', { name: session.user.fullName })}
    >
      <section className="grid grid-cols-2 gap-s4" data-testid="DEV-PANEL-KPIS-001">
        <ActionCard
          title={t('panel.developer.newProject')}
          description={t('panel.developer.newProjectHint')}
          icon={Plus}
          featured
          onClick={() => void navigate({ to: '/developer/project/new' })}
        />
        <StatCard
          value={kpi(data?.activeProjects ?? null)}
          label={t('panel.developer.activeProjects')}
          icon={Building2}
          tone="entity"
        />
        <StatCard
          value={kpi(
            data?.capitalRaisedMinorUnits != null ? data.capitalRaisedMinorUnits / 100 : null
          )}
          label={t('panel.developer.capitalRaised')}
          helper={t('panel.developer.capitalHint')}
          icon={DollarSign}
          tone="financial"
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

      <section className="flex flex-col gap-s3">
        <h2 className="text-label font-bold uppercase text-text-muted">
          {t('panel.developer.shortcuts')}
        </h2>

        <div className="grid grid-cols-2 gap-s3">
          <ActionCard
            title={t('panel.developer.investorsAction')}
            description={t('panel.developer.investorsHint')}
            icon={Users}
            onClick={() => void navigate({ to: '/developer/investors' })}
          />
          <ActionCard
            title={t('panel.developer.docsAction')}
            description={t('panel.developer.docsHint')}
            icon={FileCheck2}
            onClick={() => void navigate({ to: '/developer/documentation' })}
          />
          <ActionCard
            title={t('panel.developer.auditAction')}
            description={t('panel.developer.auditHint')}
            icon={ScrollText}
            onClick={() => void navigate({ to: '/developer/audit-log' })}
          />
        </div>
      </section>
    </PanelLayout>
  )
}
