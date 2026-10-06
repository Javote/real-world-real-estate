import type { Profile } from '@plataforma/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, LogOut, ShieldCheck, User } from 'lucide-react'
import { useState } from 'react'
import { api } from '#/api/port'
import { clearSession } from '#/auth/session'
import type { NAV_TABS } from '#/components/domain/navTabs'
import { DangerButton, SecondaryButton } from '#/components/domain/PrimaryButton'
import { StatusPill } from '#/components/domain/StatusPill'
import { TextInput } from '#/components/domain/TextInput'
import { ToggleSwitch } from '#/components/domain/ToggleSwitch'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL } from '#/lib/cardShell'
import { cn } from '#/lib/cn'
import { optimista } from '#/lib/optimista'

const CATEGORIAS = ['stage', 'document', 'release', 'signature', 'certificate'] as const

const prefsDe = (perfil: Profile | undefined): Record<string, boolean> =>
  perfil?.notificationPrefsJson ? JSON.parse(perfil.notificationPrefsJson) : {}

interface ProfileScreenProps {
  rol: keyof typeof NAV_TABS
  testId: string
  back?: { label: string; onClick: () => void }
  editTestId?: string
  prefsTestId?: string
}

export function ProfileScreen({ rol, testId, back, editTestId, prefsTestId }: ProfileScreenProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState('')

  const { data: perfil } = useQuery({ queryKey: ['profile'], queryFn: api.getProfile })

  const prefs = prefsDe(perfil)

  const guardarPrefs = useMutation({
    mutationFn: (cambio: Record<string, boolean>) => api.updateNotificationPrefs(cambio),
    ...optimista(queryClient, ['profile'], (cambio: Record<string, boolean>) => {
      queryClient.setQueryData<Profile>(
        ['profile'],
        (p) => p && { ...p, notificationPrefsJson: JSON.stringify({ ...prefsDe(p), ...cambio }) }
      )
    })
  })

  const guardarNombre = useMutation({
    mutationFn: (fullName: string) => api.updateProfile(fullName),
    onSuccess: () => {
      setEditando(false)
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
    }
  })

  const abrirEdicion = () => {
    setNombre(perfil?.fullName ?? '')
    setEditando(true)
  }

  return (
    <PanelLayout
      title={t('profile.title')}
      context={rol === 'investor' ? t('profile.context') : (perfil?.fullName ?? undefined)}
      {...(back ? { back } : {})}
    >
      <section className="flex flex-col gap-s4" data-testid={testId}>
        <article className={cn('flex items-center gap-s3', CARD_SHELL)}>
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-light">
            <User className="size-icon-stat text-primary" aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-s1">
            <span className="truncate text-body font-bold text-text-primary">
              {perfil?.fullName}
            </span>
            <span className="truncate text-body-sm text-text-muted">{perfil?.email}</span>
            {perfil ? (
              <StatusPill tone="info" className="self-start">
                {t(`role.${perfil.role}`)}
              </StatusPill>
            ) : null}
          </span>
          <SecondaryButton onClick={abrirEdicion} className="shrink-0 px-s3 py-s2">
            {t('profile.edit')}
          </SecondaryButton>
        </article>

        {editando ? (
          <form
            className={cn('flex flex-col gap-s3', CARD_SHELL)}
            {...(editTestId ? { 'data-testid': editTestId } : {})}
            onSubmit={(e) => {
              e.preventDefault()
              const recortado = nombre.trim()
              if (recortado) guardarNombre.mutate(recortado)
            }}
          >
            <TextInput
              label={t('profile.nameLabel')}
              value={nombre}
              onChange={setNombre}
              autoComplete="name"
              required
            />
            <SecondaryButton type="submit" disabled={guardarNombre.isPending}>
              {guardarNombre.isPending ? t('profile.saving') : t('profile.save')}
            </SecondaryButton>
          </form>
        ) : null}

        <article
          className={cn('flex flex-col gap-s3', CARD_SHELL)}
          {...(prefsTestId ? { 'data-testid': prefsTestId } : {})}
        >
          <h2 className="flex items-center gap-s2 text-body font-bold text-text-primary">
            <Bell className="size-icon-inline text-text-muted" aria-hidden="true" />
            {t('profile.notificationsTitle')}
          </h2>

          {CATEGORIAS.map((c) => (
            <ToggleSwitch
              key={c}
              id={`pref-${c}`}
              checked={prefs[c] ?? true}
              onChange={(valor) => guardarPrefs.mutate({ [c]: valor })}
              label={t(`profile.prefs.${c}`)}
            />
          ))}
        </article>

        <article className="flex items-center gap-s2 rounded-xl bg-card p-s4 text-body-sm text-text-secondary shadow-e1">
          <ShieldCheck className="size-icon-inline text-text-muted" aria-hidden="true" />
          {t('profile.roleLabel')}: {perfil ? t(`role.${perfil.role}`) : t('panel.emptyValue')}
        </article>

        <DangerButton
          onClick={() => {
            clearSession()
            window.location.assign('/login')
          }}
        >
          <LogOut className="size-icon-inline" aria-hidden="true" />
          {t('profile.logout')}
        </DangerButton>
      </section>
    </PanelLayout>
  )
}
