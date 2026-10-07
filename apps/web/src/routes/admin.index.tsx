import type { MembershipRole } from '@plataforma/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ApiError, api } from '#/api/port'
import {
  invalidaciones,
  invalidar,
  invitacionQueries,
  proyectoQueries,
  usuarioQueries
} from '#/api/queries'
import type { CertifierInvitation } from '#/api/types'
import { PrimaryButton } from '#/components/domain/PrimaryButton'
import { SelectDropdown } from '#/components/domain/SelectDropdown'
import { StatusPill, type StatusTone } from '#/components/domain/StatusPill'
import { PanelLayout } from '#/components/PanelLayout'
import type { TranslationKey } from '#/i18n/dictionary'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL } from '#/lib/cardShell'

export const Route = createFileRoute('/admin/')({
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(proyectoQueries.lista())
    void queryClient.prefetchQuery(usuarioQueries.lista())
  },
  component: AdminPanel
})

const ERRORES_CON_NOMBRE: Record<string, TranslationKey> = {
  CERTIFIER_NOT_ELIGIBLE: 'admin.error.CERTIFIER_NOT_ELIGIBLE',
  ALREADY_MEMBER: 'admin.error.ALREADY_MEMBER',
  INVITATION_ALREADY_PENDING: 'admin.error.INVITATION_ALREADY_PENDING'
}

const ESTADO: Record<CertifierInvitation['status'], { tone: StatusTone; key: TranslationKey }> = {
  pending: { tone: 'pending', key: 'admin.invitation.pending' },
  accepted: { tone: 'verified', key: 'admin.invitation.accepted' },
  declined: { tone: 'neutral', key: 'admin.invitation.declined' }
}

const ROL: Record<MembershipRole, TranslationKey> = {
  developer: 'admin.role.developer',
  buyer: 'admin.role.buyer',
  verifier: 'admin.role.verifier'
}

function AdminPanel() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [elegido, setElegido] = useState('')
  const [certifierId, setCertifierId] = useState('')

  const { data: proyectos } = useQuery(proyectoQueries.lista())

  const ordenados = [...(proyectos ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const projectId = elegido || ordenados[0]?.id || ''

  const { data: detalle } = useQuery({
    ...proyectoQueries.detalle(projectId),
    enabled: projectId !== ''
  })

  const { data: invitaciones } = useQuery({
    ...invitacionQueries.aCertificadoresDelProyecto(projectId),
    enabled: projectId !== ''
  })

  const { data: usuarios } = useQuery(usuarioQueries.lista())

  const miembros = detalle?.members ?? []
  const yaCertifican = new Set(
    miembros.filter((m) => m.membershipRole === 'verifier').map((m) => m.userId)
  )
  const conPendiente = new Set(
    (invitaciones ?? []).filter((i) => i.status === 'pending').map((i) => i.certifierId)
  )
  const invitables = (usuarios ?? []).filter(
    (u) => u.role === 'verifier' && u.isActive && !yaCertifican.has(u.id) && !conPendiente.has(u.id)
  )

  const invitar = useMutation({
    mutationFn: () => api.inviteCertifier(projectId, certifierId),
    onSuccess: () => {
      setCertifierId('')
      invalidar(queryClient, invalidaciones.certificadorInvitado(projectId))
    }
  })

  const codigoDeError =
    invitar.error instanceof ApiError
      ? (invitar.error.body as { code?: string } | undefined)?.code
      : undefined
  const mensajeDeError = t(
    (codigoDeError && ERRORES_CON_NOMBRE[codigoDeError]) || 'admin.error.generic'
  )

  return (
    <PanelLayout title={t('admin.title')} context={t('admin.context')}>
      <section className={CARD_SHELL} data-testid="ADMIN-PROJECT-001">
        <h2 className="text-h2 font-bold text-text-primary">{t('admin.projects')}</h2>
        <SelectDropdown
          id="admin-project"
          label={t('admin.project')}
          value={projectId}
          onChange={(id) => {
            setElegido(id)
            setCertifierId('')
            invitar.reset()
          }}
          options={ordenados.map((p) => ({ value: p.id, label: p.name }))}
          placeholder={t('admin.selectProject')}
        />
      </section>

      {projectId ? (
        <>
          <section className={CARD_SHELL} data-testid="ADMIN-MEMBERS-002">
            <h2 className="text-h2 font-bold text-text-primary">{t('admin.members')}</h2>
            {miembros.length === 0 ? (
              <p className="text-body text-text-muted">{t('admin.noMembers')}</p>
            ) : (
              <ul className="flex flex-col gap-s2">
                {miembros.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-s3">
                    <span className="text-body text-text-primary">{m.user.fullName}</span>
                    <StatusPill tone="info">{t(ROL[m.membershipRole])}</StatusPill>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <form
            className={CARD_SHELL}
            data-testid="ADMIN-CERTIFIER-INVITE-003"
            onSubmit={(e) => {
              e.preventDefault()
              if (certifierId) invitar.mutate()
            }}
          >
            <h2 className="text-h2 font-bold text-text-primary">{t('admin.inviteCertifier')}</h2>
            <p className="text-body-sm text-text-muted">{t('admin.inviteHelp')}</p>
            <SelectDropdown
              id="admin-certifier"
              label={t('admin.certifier')}
              value={certifierId}
              onChange={(id) => {
                setCertifierId(id)
                invitar.reset()
              }}
              options={invitables.map((u) => ({ value: u.id, label: u.fullName }))}
              placeholder={t('admin.selectCertifier')}
            />
            {invitar.isError ? (
              <p role="alert" className="text-body-sm text-danger">
                {mensajeDeError}
              </p>
            ) : null}
            {invitar.isSuccess ? (
              <p role="status" className="text-body-sm text-verified">
                {t('admin.invited')}
              </p>
            ) : null}
            <PrimaryButton type="submit" disabled={!certifierId} loading={invitar.isPending}>
              {t('admin.invite')}
            </PrimaryButton>
          </form>

          <section className={CARD_SHELL} data-testid="ADMIN-CERTIFIER-INVITATIONS-004">
            <h2 className="text-h2 font-bold text-text-primary">{t('admin.invitations')}</h2>
            {(invitaciones ?? []).length === 0 ? (
              <p className="text-body text-text-muted">{t('admin.noInvitations')}</p>
            ) : (
              <ul className="flex flex-col gap-s2">
                {invitaciones?.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-s3">
                    <span className="text-body text-text-primary">{i.certifierName}</span>
                    <StatusPill tone={ESTADO[i.status].tone}>{t(ESTADO[i.status].key)}</StatusPill>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </PanelLayout>
  )
}
