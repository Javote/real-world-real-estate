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

// **M2-D5 filas 30, 54, dev-prof y cer-prof** — captura 30-INVESTOR-PROFILE
// (investor) y 54-NOTARY-SETTINGS.
//
// **Es UNA superficie con cuatro entradas**, no cuatro pantallas. M2-D5 §3 lo
// declara: *"`/profile` and `/profile/notifications` operate on the
// authenticated user regardless of role"*. Por eso esto es un componente que
// las cuatro rutas de rol montan con su `rol` — la alternativa era copiar la
// misma pantalla cuatro veces y garantizar que se desincronicen.
//
// Fila 30: INV-PROFILE-VIEW-001 (en la ruta), INV-PROFILE-EDIT-002 (el
// formulario de nombre), INV-NOTIF-PREFS-003 (los toggles).
//
// **Change password no se dibuja:** no hay endpoint en el backlog. Sin dato,
// no se dibuja.

const CATEGORIAS = ['stage', 'document', 'release', 'signature', 'certificate'] as const

interface ProfileScreenProps {
  rol: keyof typeof NAV_TABS
  /** Test ID de la fila de ESE rol: son cuatro distintos sobre una pantalla. */
  testId: string
  /**
   * El developer no tiene tab de perfil (D-072): llega desde el header y
   * necesita `back`. Notary e investor son tab y no lo llevan (capturas 54 y
   * 30). El header en sí es el de D-074: logo + utilidades, siempre.
   */
  back?: { label: string; onClick: () => void }
  /**
   * Los test IDs de la edición y de las preferencias los pone **la ruta**, como
   * `testId`: M2-D5 se los da a la fila 30 (investor) y no a los otros tres
   * roles. Puestos acá dentro, `/developer/profile` emitiría IDs `INV-*`.
   */
  editTestId?: string
  prefsTestId?: string
}

export function ProfileScreen({ rol, testId, back, editTestId, prefsTestId }: ProfileScreenProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState('')

  const { data: perfil } = useQuery({ queryKey: ['profile'], queryFn: api.getProfile })

  const prefs = perfil?.notificationPrefsJson
    ? (JSON.parse(perfil.notificationPrefsJson) as Record<string, boolean>)
    : {}

  const guardarPrefs = useMutation({
    mutationFn: (cambio: Record<string, boolean>) => api.updateNotificationPrefs(cambio),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['profile'] })
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
      rol={rol}
      title={t('profile.title')}
      context={rol === 'investor' ? t('profile.context') : (perfil?.fullName ?? undefined)}
      {...(back ? { back } : {})}
    >
      <section className="flex flex-col gap-s4" data-testid={testId}>
        <article className="flex items-center gap-s3 rounded-xl bg-card p-s4 shadow-e1">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-light">
            <User className="size-icon-stat text-primary" aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-s1">
            <span className="truncate text-body font-bold text-text-primary">
              {perfil?.fullName}
            </span>
            <span className="truncate text-body-sm text-text-muted">{perfil?.email}</span>
            {perfil ? (
              <StatusPill tone="info">{t(`role.${perfil.role}` as never)}</StatusPill>
            ) : null}
          </span>
          <SecondaryButton onClick={abrirEdicion} className="shrink-0 px-s3 py-s2">
            {t('profile.edit')}
          </SecondaryButton>
        </article>

        {editando ? (
          <form
            className="flex flex-col gap-s3 rounded-xl bg-card p-s4 shadow-e1"
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
          className="flex flex-col gap-s3 rounded-xl bg-card p-s4 shadow-e1"
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
              // Ausente ⇒ activada: quien nunca tocó esta pantalla quiere
              // enterarse de lo que pasa con su operación.
              checked={prefs[c] ?? true}
              onChange={(valor) => guardarPrefs.mutate({ [c]: valor })}
              label={t(`profile.prefs.${c}` as never)}
              disabled={guardarPrefs.isPending}
            />
          ))}
        </article>

        {/* La credencial del rol, cuando el rol la tiene. Hoy solo se muestra
            cuál es: la matrícula no está en el modelo todavía (M2-D5 la anida
            "per role" sin definir sus campos). */}
        <article className="flex items-center gap-s2 rounded-xl bg-card p-s4 text-body-sm text-text-secondary shadow-e1">
          <ShieldCheck className="size-icon-inline text-text-muted" aria-hidden="true" />
          {t('profile.roleLabel')}:{' '}
          {perfil ? t(`role.${perfil.role}` as never) : t('panel.emptyValue')}
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
