import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Building2, Clock, FileCheck2, ShieldCheck } from 'lucide-react'
import { api } from '#/api/port'
import { NOTARY_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { StatCard } from '#/components/domain/StatCard'
import { PanelLayout } from '#/components/PanelLayout'
import { PendingDossiersQueue } from '#/components/PendingDossiersQueue'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL } from '#/lib/cardShell'
import { useKpiValue } from '#/lib/useKpiValue'

export const Route = createFileRoute('/notary/')({ component: NotaryPanel })

function NotaryPanel() {
  const { session, ready } = useRoleGuard(NOTARY_ROLES)
  const { t } = useTranslation()
  const kpi = useKpiValue()

  const { data: kpis } = useQuery({
    queryKey: ['notary', 'kpis'],
    queryFn: api.getNotaryKpis,
    enabled: ready
  })
  if (!ready) return null

  return (
    <PanelLayout
      rol="notary"
      title={t('panel.notary.title')}
      /* v8 ignore next -- @preserve: `useRoleGuard` hace `setSession` y `setReady(true)` juntos y la pantalla ya salió en `if (!ready) return null`, así que `session` nunca es `null` acá */
      context={session ? t('panel.welcome', { name: session.user.fullName }) : undefined}
    >
      <section className="grid grid-cols-2 gap-s4" data-testid="NOT-PANEL-001">
        <StatCard
          value={kpi(kpis?.pendingDossiers ?? null)}
          label={t('panel.notary.pendingDossiers')}
          icon={Clock}
          tone="entity"
        />
        <StatCard
          value={kpi(kpis?.verified ?? null)}
          label={t('panel.notary.verified')}
          icon={ShieldCheck}
          tone="verification"
        />
        <StatCard
          value={kpi(kpis?.signed ?? null)}
          label={t('panel.notary.signed')}
          icon={FileCheck2}
          tone="portfolio"
        />
        <StatCard
          value={kpi(kpis?.unitsUnderReview ?? null)}
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
