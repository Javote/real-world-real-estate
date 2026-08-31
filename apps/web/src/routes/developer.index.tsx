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
//
// **Dos tiles de la captura 34 no se dibujan, y es deuda, no olvido.**
// "Active investors" (7 / 12 total) y "Verified events" (16) están en la
// maqueta; `developerKpisSchema` no los expone. El directorio y el audit log
// existen como pantallas, pero el panel no puede afirmar un número que el
// contrato no trae (regla 17). El índice está en `apps/web/CLAUDE.md`.

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
        {/* El KPI llega en unidades mínimas (regla 1). KpiValue no sabe de
            moneda: se divide acá, una sola vez, igual que `formatCurrency`.
            Sin `currency` en el schema no se puede pintar "US$". */}
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

      {/*           **Los accesos a las pantallas huérfanas (D-072), fuera del grid de
          KPIs a propósito.** Las capturas 33/34 fijan la composición de ese
          grid —un ActionCard destacado y siete StatCards— y meterle tiles de
          navegación lo desviaría de lo que el entregable muestra. Acá van los
          destinos que M2-D1 §5.2 le da al developer sin decir cómo se llega.

          Del grid de siete, hoy hay cinco: faltan Active investors y Verified
          events (ver el comentario de arriba). Capital raised sí está: el
          schema ya lo trae.

          Solo se listan los que EXISTEN.

          **Lleva label de sección** porque sin él las dos cards se leen como
          dos KPIs más y el grid de arriba parece cortarse a la mitad. Son otra
          cosa —destinos, no métricas— y el label es lo que lo dice. El estilo
          es el que M2-D3 fija para labels de sección (`--text-label`, bold,
          mayúsculas), el mismo de TxidModal y MerkleRootProof. */}
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
