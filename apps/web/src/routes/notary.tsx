import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Building2, Clock, FileCheck2, ShieldCheck } from 'lucide-react'
import { api } from '#/api/port'
import { NOTARY_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { SecondaryButton } from '#/components/domain/PrimaryButton'
import { ProgressBar } from '#/components/domain/ProgressBar'
import { StatCard } from '#/components/domain/StatCard'
import { KpiValue } from '#/components/KpiValue'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'

// **M2-D5 fila 51 · `/notary` (Panel)** — captura 51-NOTARY-PANEL.
// Componentes: StatCard, ProgressTimeline (barras de completitud del dossier),
// PrimaryButton (Review). Endpoints: GET /notary/kpis,
// GET /notary/dossiers/pending. Test IDs: NOT-PANEL-001, NOT-PENDING-002.
//
// **Este panel se dibuja hoy con sus cuatro KPI en guión y la lista vacía**, y
// eso es lo correcto: el dossier (M2-D4 P8) no existe como entidad, así que no
// hay dossiers pendientes que contar. Es exactamente lo que vería un notario el
// primer día. Poner ceros afirmaría que no tiene trabajo.

export const Route = createFileRoute('/notary')({ component: NotaryPanel })

function NotaryPanel() {
  const { session, ready } = useRoleGuard(NOTARY_ROLES)
  const { t } = useTranslation()
  const kpi = KpiValue()

  const { data: kpis } = useQuery({
    queryKey: ['notary', 'kpis'],
    queryFn: api.getNotaryKpis,
    enabled: ready
  })
  const { data: pendientes } = useQuery({
    queryKey: ['notary', 'pending'],
    queryFn: api.getNotaryPendingDossiers,
    enabled: ready
  })

  if (!ready) return null

  return (
    <PanelLayout
      rol="notary"
      title={t('panel.notary.title')}
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

      <section className="rounded-xl bg-card p-s4 shadow-e1" data-testid="NOT-PENDING-002">
        <h2 className="text-h2 font-bold text-text-primary">{t('panel.notary.pendingList')}</h2>

        {pendientes?.length ? (
          <ul className="mt-s4 flex flex-col gap-s2">
            {pendientes.map((dossier) => (
              <li key={dossier.dossierId} className="rounded-lg bg-surface-alt p-s3">
                <div className="flex items-center justify-between gap-s3">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-body font-bold text-text-primary">
                      {dossier.unitLabel}
                    </span>
                    <span className="truncate text-body-sm text-text-muted">
                      {dossier.investorName}
                    </span>
                  </div>
                  <SecondaryButton className="shrink-0 border-pending px-s3 py-s1 text-body-sm text-pending">
                    {t('panel.notary.review')}
                  </SecondaryButton>
                </div>
                <ProgressBar percent={dossier.completeness} showValue className="mt-s2" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-s3 text-body-sm text-text-muted">{t('panel.notary.emptyPending')}</p>
        )}
      </section>
    </PanelLayout>
  )
}
