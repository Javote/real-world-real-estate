import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Building2, Clock, FileCheck2, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { dossierQueries, kpiQueries } from '#/api/queries'
import { StatCard } from '#/components/domain/StatCard'
import { RutaCargando, RutaConError } from '#/components/EstadosDeRuta'
import { PanelLayout } from '#/components/PanelLayout'
import { PendingDossiersQueue } from '#/components/PendingDossiersQueue'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL } from '#/lib/cardShell'
import { PENDING_MS } from '#/lib/cargaDeRuta'
import { useKpiValue } from '#/lib/useKpiValue'

function Marco({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return <PanelLayout title={t('panel.notary.title')}>{children}</PanelLayout>
}

export const Route = createFileRoute('/notary/')({
  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.ensureQueryData(kpiQueries.notary()),
      queryClient.ensureQueryData(dossierQueries.pendientes())
    ])
  },
  pendingMs: PENDING_MS,
  pendingComponent: () => <RutaCargando Marco={Marco} testId="NOT-PANEL-001" />,
  errorComponent: ({ error }) => (
    <RutaConError Marco={Marco} testId="NOT-PANEL-001" error={error} />
  ),
  component: NotaryPanel
})

function NotaryPanel() {
  const { session } = Route.useRouteContext()
  const { t } = useTranslation()
  const kpi = useKpiValue()

  const { data: kpis } = useSuspenseQuery(kpiQueries.notary())

  return (
    <PanelLayout
      title={t('panel.notary.title')}
      context={t('panel.welcome', { name: session.user.fullName })}
    >
      <section className="grid grid-cols-2 gap-s4" data-testid="NOT-PANEL-001">
        <StatCard
          value={kpi(kpis.pendingDossiers)}
          label={t('panel.notary.pendingDossiers')}
          icon={Clock}
          tone="entity"
        />
        <StatCard
          value={kpi(kpis.verified)}
          label={t('panel.notary.verified')}
          icon={ShieldCheck}
          tone="verification"
        />
        <StatCard
          value={kpi(kpis.signed)}
          label={t('panel.notary.signed')}
          icon={FileCheck2}
          tone="portfolio"
        />
        <StatCard
          value={kpi(kpis.unitsUnderReview)}
          label={t('panel.notary.unitsUnderReview')}
          icon={Building2}
          tone="trend"
        />
      </section>

      <section className={CARD_SHELL} data-testid="NOT-PENDING-002">
        <h2 className="text-h2 font-bold text-text-primary">{t('panel.notary.pendingList')}</h2>

        <PendingDossiersQueue />
      </section>
    </PanelLayout>
  )
}
