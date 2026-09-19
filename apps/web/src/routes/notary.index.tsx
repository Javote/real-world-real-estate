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

// **M2-D5 fila 51 · `/notary` (Panel)** — captura 51-NOTARY-PANEL.
// Componentes: StatCard, ProgressTimeline (barras de completitud del dossier),
// PrimaryButton (Review). Endpoints: GET /notary/kpis,
// GET /notary/dossiers/pending. Test IDs: NOT-PANEL-001, NOT-PENDING-002.
//
// **Este panel se dibuja hoy con sus cuatro KPI en guión y la lista vacía**, y
// eso es lo correcto: el dossier (M2-D4 P8) no existe como entidad, así que no
// hay dossiers pendientes que contar. Es exactamente lo que vería un notario el
// primer día. Poner ceros afirmaría que no tiene trabajo.

// **`*.index.tsx` y no `notary.tsx`/`certifier.tsx` a secas.** En el ruteo por
// archivos de TanStack, `notary.tsx` es el LAYOUT de todo lo que cuelga de
// `/notary` y tiene que renderizar un `<Outlet/>`; como esto es una pantalla y
// no un layout, `/notary/profile` matcheaba el layout y mostraba el panel con
// la URL del perfil. Con `.index` el panel es una hoja y sus hermanas son
// hermanas de verdad.
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
