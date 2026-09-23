import type { MembershipRole } from '@plataforma/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ApiError, api } from '#/api/port'
import type { CertifierInvitation } from '#/api/types'
import { ADMIN_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { PrimaryButton } from '#/components/domain/PrimaryButton'
import { SelectDropdown } from '#/components/domain/SelectDropdown'
import { StatusPill, type StatusTone } from '#/components/domain/StatusPill'
import { PanelLayout } from '#/components/PanelLayout'
import type { TranslationKey } from '#/i18n/dictionary'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL } from '#/lib/cardShell'

// **`/admin` · la pantalla del admin** — D-095, SPEC-221. No es de M2-D5: los
// entregables definen cuatro roles y ninguna superficie de admin. El admin es
// la salvaguarda: puede entrar a los cuatro paneles (la barra de navegación lo
// lleva) y, desde acá, hace lo único que no tiene pantalla en ningún rol —
// invitar a un certifier a un proyecto.
//
// Componentes: todos de M2-D3 (SelectDropdown, PrimaryButton, StatusPill) sobre
// el mismo armazón que los paneles (PanelLayout). Test IDs propios, `ADMIN-*`.

export const Route = createFileRoute('/admin/')({ component: AdminPanel })

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
  const { ready } = useRoleGuard(ADMIN_ROLES)
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [elegido, setElegido] = useState('')
  const [certifierId, setCertifierId] = useState('')

  const { data: proyectos } = useQuery({
    queryKey: ['admin', 'projects'],
    queryFn: () => api.listProjects(),
    enabled: ready
  })

  // El más nuevo primero: el caso de uso real es el proyecto recién creado.
  const ordenados = [...(proyectos ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const projectId = elegido || ordenados[0]?.id || ''

  const { data: detalle } = useQuery({
    queryKey: ['admin', 'project', projectId],
    queryFn: () => api.getProject(projectId),
    enabled: ready && projectId !== ''
  })

  const { data: invitaciones } = useQuery({
    queryKey: ['admin', 'certifier-invitations', projectId],
    queryFn: () => api.listProjectCertifierInvitations(projectId),
    enabled: ready && projectId !== ''
  })

  const { data: usuarios } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: api.listUsers,
    enabled: ready
  })

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
      void queryClient.invalidateQueries({ queryKey: ['admin', 'certifier-invitations'] })
    }
  })

  const codigoDeError =
    invitar.error instanceof ApiError
      ? (invitar.error.body as { code?: string } | undefined)?.code
      : undefined
  const mensajeDeError = t(
    (codigoDeError && ERRORES_CON_NOMBRE[codigoDeError]) || 'admin.error.generic'
  )

  if (!ready) return null

  return (
    <PanelLayout rol="admin" title={t('admin.title')} context={t('admin.context')}>
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
                {(invitaciones ?? []).map((i) => (
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
