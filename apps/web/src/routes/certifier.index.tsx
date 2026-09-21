import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Activity, AlertCircle, Clock, ShieldCheck } from 'lucide-react'
import { api } from '#/api/port'
import { CERTIFIER_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { AssignedStagesQueue } from '#/components/AssignedStagesQueue'
import { PrimaryButton, SecondaryButton } from '#/components/domain/PrimaryButton'
import { StatCard } from '#/components/domain/StatCard'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL } from '#/lib/cardShell'
import { useKpiValue } from '#/lib/useKpiValue'

// **M2-D5 fila 55 · `/certifier` (Panel)** — captura 55-CERTIFIER-PANEL.
// Componentes: StatCard, PrimaryButton (Certify). Endpoints:
// GET /certifier/kpis, GET /certifier/assignments.
// Test IDs: CER-PANEL-001, CER-ASSIGNMENTS-002.
//
// **Las invitaciones a certificar (SPEC-221, D-095)** van arriba de todo y solo
// si hay alguna pendiente: es donde el certifier ya mira, y no hace falta
// inventar un inbox (el suyo no existe en M2-D5). Test ID propio:
// CER-INVITATIONS-003.

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
      <InvitacionesACertificar />

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

function InvitacionesACertificar() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: invitaciones } = useQuery({
    queryKey: ['certifier', 'invitations'],
    queryFn: api.getMyCertifierInvitations
  })

  const responder = useMutation({
    mutationFn: ({ id, acepta }: { id: string; acepta: boolean }) =>
      acepta ? api.acceptCertifierInvitation(id) : api.declineCertifierInvitation(id),
    // Aceptar suma el proyecto: la cola y los KPIs cambian, no solo la lista.
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['certifier'] })
  })

  if (!invitaciones || invitaciones.length === 0) return null

  return (
    <section className={CARD_SHELL} data-testid="CER-INVITATIONS-003">
      <h2 className="text-h2 font-bold text-text-primary">{t('panel.certifier.invitations')}</h2>
      <ul className="flex flex-col gap-s3">
        {invitaciones.map((i) => (
          <li key={i.id} className="flex flex-col gap-s2">
            <p className="text-body text-text-primary">
              {t('panel.certifier.invitationLine', { project: i.projectName })}
            </p>
            <div className="flex gap-s2">
              <PrimaryButton
                onClick={() => responder.mutate({ id: i.id, acepta: true })}
                disabled={responder.isPending}
              >
                {t('panel.certifier.acceptInvitation')}
              </PrimaryButton>
              <SecondaryButton
                onClick={() => responder.mutate({ id: i.id, acepta: false })}
                disabled={responder.isPending}
              >
                {t('panel.certifier.declineInvitation')}
              </SecondaryButton>
            </div>
          </li>
        ))}
      </ul>
      {responder.isError ? (
        <p role="alert" className="text-body-sm text-danger">
          {t('panel.certifier.invitationError')}
        </p>
      ) : null}
    </section>
  )
}
