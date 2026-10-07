import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Activity, AlertCircle, Clock, ShieldCheck } from 'lucide-react'
import { api } from '#/api/port'
import {
  etapaQueries,
  invalidaciones,
  invalidar,
  invitacionQueries,
  kpiQueries
} from '#/api/queries'
import { AssignedStagesQueue } from '#/components/AssignedStagesQueue'
import { PrimaryButton, SecondaryButton } from '#/components/domain/PrimaryButton'
import { StatCard } from '#/components/domain/StatCard'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL } from '#/lib/cardShell'
import { useKpiValue } from '#/lib/useKpiValue'

export const Route = createFileRoute('/certifier/')({
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(kpiQueries.certificador())
    void queryClient.prefetchQuery(invitacionQueries.delCertificador())
    void queryClient.prefetchQuery(etapaQueries.asignadas())
  },
  component: CertifierPanel
})

function CertifierPanel() {
  const { session } = Route.useRouteContext()
  const { t } = useTranslation()
  const kpi = useKpiValue()

  const { data: kpis } = useQuery(kpiQueries.certificador())

  return (
    <PanelLayout
      title={t('panel.certifier.title')}
      context={t('panel.welcome', { name: session.user.fullName })}
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

  const { data: invitaciones } = useQuery(invitacionQueries.delCertificador())

  const responder = useMutation({
    mutationFn: ({ id, acepta }: { id: string; acepta: boolean }) =>
      acepta ? api.acceptCertifierInvitation(id) : api.declineCertifierInvitation(id),
    onSuccess: () => invalidar(queryClient, invalidaciones.invitacionDeCertificadorRespondida())
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
