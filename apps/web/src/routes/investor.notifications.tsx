import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import { Bell, FileCheck2, FileText, ShieldCheck, Signature } from 'lucide-react'
import { useState } from 'react'
import { api } from '#/api/port'
import { INVESTOR_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import type { AuditCategory } from '#/components/domain/AuditEventCard'
import { CategoryChip } from '#/components/domain/Chips'
import { InvitationAcceptModal } from '#/components/domain/InvitationAcceptModal'
import { InvitationCard } from '#/components/domain/InvitationCard'
import { NotificationCard } from '#/components/domain/NotificationCard'
import { PanelLayout } from '#/components/PanelLayout'
import { formatCurrency, formatRelative } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'

// **M2-D5 filas 62 y 63 · `/investor/notifications`**
// Test IDs: INV-NOTIF-LIST-001, INV-INVITE-VIEW-001, INV-INVITE-ACCEPT-002,
// INV-INVITE-DECLINE-003.
//
// No hay GET de listado de invitaciones. La card solo aparece con
// `?invitation=` (el POST de crear no notifica). No se inventa un endpoint.

const CATEGORIAS = ['stage', 'document', 'release', 'signature', 'certificate'] as const
type NotifCategory = (typeof CATEGORIAS)[number]

const ICONO: Record<NotifCategory, LucideIcon> = {
  stage: ShieldCheck,
  document: FileText,
  release: FileCheck2,
  signature: Signature,
  certificate: ShieldCheck
}

const BORDE: Record<NotifCategory, AuditCategory> = {
  stage: 'etapa',
  document: 'documento',
  release: 'liberacion',
  signature: 'firma',
  certificate: 'certificador'
}

type NotifSearch = { invitation?: string }

function parseSearch(raw: Record<string, unknown>): NotifSearch {
  return typeof raw.invitation === 'string' && raw.invitation.length > 0
    ? { invitation: raw.invitation }
    : {}
}

export const Route = createFileRoute('/investor/notifications')({
  validateSearch: (raw: Record<string, unknown>) => parseSearch(raw),
  component: InvestorNotifications
})

function InvestorNotifications() {
  const { ready } = useRoleGuard(INVESTOR_ROLES)
  const { t, tDinamico, locale } = useTranslation()
  const navigate = useNavigate({ from: '/investor/notifications' })
  const search = Route.useSearch()
  const queryClient = useQueryClient()
  const [filtro, setFiltro] = useState<NotifCategory | null>(null)
  const [modal, setModal] = useState(false)

  const { data: notificaciones } = useQuery({
    queryKey: ['notifications', filtro],
    queryFn: () => api.listNotifications(filtro ? { category: filtro } : undefined),
    enabled: ready
  })

  const { data: invitacion } = useQuery({
    queryKey: ['investor', 'invitation', search.invitation],
    queryFn: () => api.getInvitation(search.invitation!),
    enabled: ready && Boolean(search.invitation)
  })

  const marcarLeida = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] })
  })

  const aceptar = useMutation({
    mutationFn: () => api.acceptInvitation(search.invitation!),
    onSuccess: (resultado) => {
      void queryClient.invalidateQueries({ queryKey: ['investor'] })
      setModal(false)
      void navigate({
        to: '/investor/unit/$unitId',
        params: { unitId: resultado.contract.unitId }
      })
    }
  })

  const rechazar = useMutation({
    mutationFn: () => api.declineInvitation(search.invitation!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['investor', 'invitation'] })
      setModal(false)
      void navigate({ search: {} })
    }
  })

  if (!ready) return null

  const pendiente = invitacion?.status === 'pending'

  return (
    <PanelLayout
      rol="investor"
      title={t('investor.notifications.title')}
      context={t('investor.notifications.context')}
    >
      <div className="-mx-s4 flex gap-s2 overflow-x-auto px-s4 pb-s1">
        <CategoryChip selected={filtro === null} onSelect={() => setFiltro(null)}>
          {t('developer.audit.all')}
        </CategoryChip>
        {CATEGORIAS.map((c) => (
          <CategoryChip key={c} selected={filtro === c} onSelect={() => setFiltro(c)}>
            {t(`audit.category.${BORDE[c]}`)}
          </CategoryChip>
        ))}
      </div>

      <section className="flex flex-col gap-s3" data-testid="INV-NOTIF-LIST-001">
        {invitacion ? (
          <InvitationCard
            title={t('investor.invite.title')}
            body={t('investor.invite.body', {
              project: invitacion.projectName,
              unit: invitacion.unitReference
            })}
            ctaLabel={t('investor.invite.cta')}
            timestampLabel={formatRelative(String(invitacion.createdAt), locale)}
            resolved={!pendiente}
            onOpen={() => setModal(true)}
          />
        ) : null}

        {notificaciones?.length ? (
          notificaciones.map((n) => {
            const categoria = n.category as NotifCategory
            return (
              <NotificationCard
                key={n.id}
                icon={ICONO[categoria] ?? Bell}
                title={tDinamico(n.titleKey, n.titleKey)}
                timestampLabel={formatRelative(String(n.createdAt), locale)}
                read={n.readAt !== null}
                readLabel={t('investor.notifications.read')}
                {...(filtro ? { category: BORDE[categoria] } : {})}
                onOpen={n.readAt === null ? () => marcarLeida.mutate(n.id) : undefined}
              />
            )
          })
        ) : !invitacion ? (
          <p className="rounded-xl bg-card p-s4 text-body-sm text-text-muted shadow-e1">
            {t('investor.notifications.empty')}
          </p>
        ) : null}
      </section>

      {invitacion ? (
        <InvitationAcceptModal
          open={modal}
          onClose={() => setModal(false)}
          onAccept={() => aceptar.mutate()}
          onDecline={() => rechazar.mutate()}
          submitting={aceptar.isPending || rechazar.isPending}
          pending={pendiente}
          details={{
            developerLine: t('investor.invite.developerLine'),
            project: invitacion.projectName,
            unit: invitacion.unitReference,
            amount: formatCurrency(invitacion.amountMinorUnits, invitacion.currency, locale)
          }}
          labels={{
            title: t('investor.invite.title'),
            projectLabel: t('investor.invite.project'),
            unitLabel: t('investor.invite.unit'),
            amountLabel: t('investor.invite.amount'),
            handoverLabel: t('investor.invite.handover'),
            termsTitle: t('investor.invite.terms'),
            anchoredNotice: t('investor.invite.anchored'),
            decline: t('investor.invite.decline'),
            accept: t('investor.invite.accept'),
            submitting: t('investor.invite.submitting'),
            resolved: t('investor.invite.resolved')
          }}
        />
      ) : null}
    </PanelLayout>
  )
}
