import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import { FileCheck2, FileText, ShieldCheck, Signature } from 'lucide-react'
import { useState } from 'react'
import { api } from '#/api/port'
import type { InvestorInvitation } from '#/api/types'
import { INVESTOR_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import type { AuditCategory } from '#/components/domain/AuditEventCard'
import { CategoryChip } from '#/components/domain/Chips'
import { InvitationAcceptModal } from '#/components/domain/InvitationAcceptModal'
import { InvitationCard } from '#/components/domain/InvitationCard'
import { Loading } from '#/components/domain/Loading'
import { NotificationCard } from '#/components/domain/NotificationCard'
import { PanelLayout } from '#/components/PanelLayout'
import { formatCurrency, formatRelative } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL_EMPTY } from '#/lib/cardShell'

const INVITACION_RECIBIDA = 'notifications.invitation.received'

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
  return {
    invitation:
      typeof raw.invitation === 'string' && raw.invitation.length > 0 ? raw.invitation : undefined
  }
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
  const [abierta, setAbierta] = useState<string | null>(null)

  const { data: notificaciones, isPending } = useQuery({
    queryKey: ['notifications', filtro],
    queryFn: () => api.listNotifications(filtro ? { category: filtro } : undefined),
    enabled: ready
  })

  const avisos = new Map<string, { id: string; leida: boolean }>()
  for (const n of notificaciones ?? []) {
    const id = n.params.invitationId
    if (n.titleKey === INVITACION_RECIBIDA && typeof id === 'string') {
      avisos.set(id, { id: n.id, leida: n.readAt !== null })
    }
  }
  const ids = [...new Set([...(search.invitation ? [search.invitation] : []), ...avisos.keys()])]

  const consultas = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['investor', 'invitation', id],
      queryFn: () => api.getInvitation(id),
      enabled: ready
    }))
  })
  const invitaciones = new Map<string, InvestorInvitation>()
  consultas.forEach((c, i) => {
    if (c.data) invitaciones.set(ids[i]!, c.data)
  })

  const marcarLeida = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] })
  })

  const aceptar = useMutation({
    mutationFn: (id: string) => api.acceptInvitation(id),
    onSuccess: (resultado) => {
      void queryClient.invalidateQueries({ queryKey: ['investor'] })
      setAbierta(null)
      void navigate({
        to: '/investor/unit/$unitId',
        params: { unitId: resultado.contract.unitId }
      })
    }
  })

  const rechazar = useMutation({
    mutationFn: (id: string) => api.declineInvitation(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['investor', 'invitation'] })
      setAbierta(null)
      void navigate({ search: {} })
    }
  })

  if (!ready) return null

  function abrir(id: string) {
    const aviso = avisos.get(id)
    if (aviso && !aviso.leida) marcarLeida.mutate(aviso.id)
    setAbierta(id)
  }

  function tarjeta(inv: InvestorInvitation) {
    return (
      <InvitationCard
        key={inv.id}
        title={t('investor.invite.title')}
        body={t('investor.invite.body', { project: inv.projectName, unit: inv.unitReference })}
        ctaLabel={t('investor.invite.cta')}
        timestampLabel={formatRelative(String(inv.createdAt), locale)}
        resolved={inv.status !== 'pending'}
        onOpen={() => abrir(inv.id)}
      />
    )
  }

  const fijas = ids
    .map((id) => invitaciones.get(id))
    .filter(
      (inv): inv is InvestorInvitation =>
        inv !== undefined && (inv.status === 'pending' || inv.id === search.invitation)
    )
  const fijadas = new Set(fijas.map((inv) => inv.id))
  const invitacion = abierta ? invitaciones.get(abierta) : undefined
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
        {fijas.map(tarjeta)}

        {isPending ? (
          <Loading />
        ) : notificaciones?.length ? (
          notificaciones.map((n) => {
            if (n.titleKey === INVITACION_RECIBIDA) {
              const inv = invitaciones.get(String(n.params.invitationId))
              return inv && !fijadas.has(inv.id) ? tarjeta(inv) : null
            }
            const categoria = n.category
            return (
              <NotificationCard
                key={n.id}
                icon={ICONO[categoria]}
                title={tDinamico(n.titleKey, n.titleKey)}
                timestampLabel={formatRelative(String(n.createdAt), locale)}
                read={n.readAt !== null}
                readLabel={t('investor.notifications.read')}
                {...(filtro ? { category: BORDE[categoria] } : {})}
                onOpen={n.readAt === null ? () => marcarLeida.mutate(n.id) : undefined}
              />
            )
          })
        ) : fijas.length === 0 ? (
          <p className={CARD_SHELL_EMPTY}>{t('investor.notifications.empty')}</p>
        ) : null}
      </section>

      {invitacion ? (
        <InvitationAcceptModal
          open
          onClose={() => setAbierta(null)}
          onAccept={() => aceptar.mutate(invitacion.id)}
          onDecline={() => rechazar.mutate(invitacion.id)}
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
