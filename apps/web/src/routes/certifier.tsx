import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Activity, AlertCircle, Clock, ShieldCheck } from 'lucide-react'
import { api } from '#/api/port'
import { CERTIFIER_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { SecondaryButton } from '#/components/domain/PrimaryButton'
import { StatCard } from '#/components/domain/StatCard'
import { KpiValue } from '#/components/KpiValue'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'

// **M2-D5 fila 55 · `/certifier` (Panel)** — captura 55-CERTIFIER-PANEL.
// Componentes: StatCard, PrimaryButton (Certify). Endpoints:
// GET /certifier/kpis, GET /certifier/assignments.
// Test IDs: CER-PANEL-001, CER-ASSIGNMENTS-002.

export const Route = createFileRoute('/certifier')({ component: CertifierPanel })

function CertifierPanel() {
  const { session, ready } = useRoleGuard(CERTIFIER_ROLES)
  const { t } = useTranslation()
  const kpi = KpiValue()

  const { data: kpis } = useQuery({
    queryKey: ['certifier', 'kpis'],
    queryFn: api.getCertifierKpis,
    enabled: ready
  })
  const { data: asignados } = useQuery({
    queryKey: ['certifier', 'assignments'],
    queryFn: api.getCertifierAssignments,
    enabled: ready
  })

  if (!ready) return null

  return (
    <PanelLayout
      rol="certifier"
      title={t('panel.certifier.title')}
      context={session ? t('panel.welcome', { name: session.user.fullName }) : undefined}
    >
      <section className="grid grid-cols-2 gap-s4" data-testid="CER-PANEL-001">
        <StatCard
          value={kpi(kpis?.assigned ?? null)}
          label={t('panel.certifier.assigned')}
          icon={Clock}
          tone="entity"
        />
        <StatCard
          value={kpi(kpis?.certified ?? null)}
          label={t('panel.certifier.certified')}
          icon={ShieldCheck}
          tone="verification"
        />
        <StatCard
          value={kpi(kpis?.observed ?? null)}
          label={t('panel.certifier.observed')}
          icon={AlertCircle}
          tone="trend"
        />
        <StatCard
          value={kpi(kpis?.totalStages ?? null)}
          label={t('panel.certifier.totalStages')}
          icon={Activity}
          tone="portfolio"
        />
      </section>

      <section className="rounded-xl bg-card p-s4 shadow-e1" data-testid="CER-ASSIGNMENTS-002">
        <h2 className="text-h2 font-bold text-text-primary">{t('panel.certifier.assignedList')}</h2>

        {asignados?.length ? (
          <ul className="mt-s4 flex flex-col gap-s2">
            {asignados.map((asignacion) => (
              <li
                key={asignacion.stageId}
                className="flex items-center justify-between gap-s3 rounded-lg bg-surface-alt p-s3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-body font-bold text-text-primary">
                    {asignacion.projectName}
                  </span>
                  <span className="truncate text-body-sm text-text-muted">
                    {t('panel.certifier.stageLine', {
                      number: String(asignacion.sequenceOrder),
                      name: asignacion.stageName
                    })}
                  </span>
                </div>
                {/* La captura muestra un pill compacto de borde naranja: es el
                    SecondaryButton con el token `pending`, no un componente
                    nuevo. */}
                <SecondaryButton className="shrink-0 border-pending px-s3 py-s1 text-body-sm text-pending">
                  {t('panel.certifier.certify')}
                </SecondaryButton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-s3 text-body-sm text-text-muted">{t('panel.certifier.emptyAssigned')}</p>
        )}
      </section>
    </PanelLayout>
  )
}
