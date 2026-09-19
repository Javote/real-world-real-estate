import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Activity, AlertCircle, Clock, ShieldCheck } from 'lucide-react'
import { api } from '#/api/port'
import { CERTIFIER_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { AssignedStagesQueue } from '#/components/AssignedStagesQueue'
import { StatCard } from '#/components/domain/StatCard'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL } from '#/lib/cardShell'
import { useKpiValue } from '#/lib/useKpiValue'

// **M2-D5 fila 55 · `/certifier` (Panel)** — captura 55-CERTIFIER-PANEL.
// Componentes: StatCard, PrimaryButton (Certify). Endpoints:
// GET /certifier/kpis, GET /certifier/assignments.
// Test IDs: CER-PANEL-001, CER-ASSIGNMENTS-002.

// **`*.index.tsx` y no `notary.tsx`/`certifier.tsx` a secas.** En el ruteo por
// archivos de TanStack, `notary.tsx` es el LAYOUT de todo lo que cuelga de
// `/notary` y tiene que renderizar un `<Outlet/>`; como esto es una pantalla y
// no un layout, `/notary/profile` matcheaba el layout y mostraba el panel con
// la URL del perfil. Con `.index` el panel es una hoja y sus hermanas son
// hermanas de verdad.
export const Route = createFileRoute('/certifier/')({ component: CertifierPanel })

function CertifierPanel() {
  const { session, ready } = useRoleGuard(CERTIFIER_ROLES)
  const { t } = useTranslation()
  const kpi = useKpiValue()

  const { data: kpis } = useQuery({
    queryKey: ['certifier', 'kpis'],
    queryFn: api.getCertifierKpis,
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

      <section className={CARD_SHELL} data-testid="CER-ASSIGNMENTS-002">
        <h2 className="text-h2 font-bold text-text-primary">{t('panel.certifier.assignedList')}</h2>

        <AssignedStagesQueue />
      </section>
    </PanelLayout>
  )
}
