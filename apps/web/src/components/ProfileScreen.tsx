import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, LogOut, ShieldCheck, User } from 'lucide-react'
import { api } from '#/api/port'
import { clearSession } from '#/auth/session'
import type { NAV_TABS } from '#/components/domain/navTabs'
import { DangerButton } from '#/components/domain/PrimaryButton'
import { ToggleSwitch } from '#/components/domain/ToggleSwitch'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'

// **M2-D5 filas 30, 54, dev-prof y cer-prof** — captura 54-NOTARY-SETTINGS.
//
// **Es UNA superficie con cuatro entradas**, no cuatro pantallas. M2-D5 §3 lo
// declara: *"`/profile` and `/profile/notifications` operate on the
// authenticated user regardless of role"*. Por eso esto es un componente que
// las cuatro rutas de rol montan con su `rol` — la alternativa era copiar la
// misma pantalla cuatro veces y garantizar que se desincronicen.
//
// Las secciones que la captura muestra como filas navegables (Personal
// information, Credentials & license, Settings) **no se dibujan todavía**: no
// tienen endpoint en el backlog ni superficie propia en M2-D5. Inventarlas
// sería exactamente lo que CLAUDE.md prohíbe. Lo que sí está es lo que la fila
// del backlog nombra: perfil, preferencias de notificación y salir.

const CATEGORIAS = ['stage', 'document', 'release', 'signature', 'certificate'] as const

interface ProfileScreenProps {
  rol: keyof typeof NAV_TABS
  /** Test ID de la fila de ESE rol: son cuatro distintos sobre una pantalla. */
  testId: string
}

export function ProfileScreen({ rol, testId }: ProfileScreenProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: perfil } = useQuery({ queryKey: ['profile'], queryFn: api.getProfile })

  const prefs = perfil?.notificationPrefsJson
    ? (JSON.parse(perfil.notificationPrefsJson) as Record<string, boolean>)
    : {}

  const guardar = useMutation({
    mutationFn: (cambio: Record<string, boolean>) => api.updateNotificationPrefs(cambio),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['profile'] })
  })

  return (
    <PanelLayout
      rol={rol}
      title={t('profile.title')}
      {...(perfil ? { context: perfil.fullName } : {})}
    >
      <section className="flex flex-col gap-s4" data-testid={testId}>
        <article className="flex items-center gap-s3 rounded-xl bg-card p-s4 shadow-e1">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-light">
            <User className="size-icon-md text-primary" aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-body font-bold text-text-primary">
              {perfil?.fullName}
            </span>
            <span className="truncate text-body-sm text-text-muted">{perfil?.email}</span>
          </span>
        </article>

        <article className="flex flex-col gap-s3 rounded-xl bg-card p-s4 shadow-e1">
          <h2 className="flex items-center gap-s2 text-body font-bold text-text-primary">
            <Bell className="size-icon-sm text-text-muted" aria-hidden="true" />
            {t('profile.notifications')}
          </h2>

          {CATEGORIAS.map((c) => (
            <ToggleSwitch
              key={c}
              id={`pref-${c}`}
              // Ausente ⇒ activada: quien nunca tocó esta pantalla quiere
              // enterarse de lo que pasa con su operación.
              checked={prefs[c] ?? true}
              onChange={(valor) => guardar.mutate({ [c]: valor })}
              label={t(`profile.prefs.${c}` as never)}
              disabled={guardar.isPending}
            />
          ))}
        </article>

        {/* La credencial del rol, cuando el rol la tiene. Hoy solo se muestra
            cuál es: la matrícula no está en el modelo todavía (M2-D5 la anida
            "per role" sin definir sus campos). */}
        <article className="flex items-center gap-s2 rounded-xl bg-card p-s4 text-body-sm text-text-secondary shadow-e1">
          <ShieldCheck className="size-icon-sm text-text-muted" aria-hidden="true" />
          {t('profile.roleLabel')}: {perfil ? t(`role.${perfil.role}` as never) : '—'}
        </article>

        <DangerButton
          onClick={() => {
            clearSession()
            window.location.assign('/login')
          }}
        >
          <LogOut className="size-icon-sm" aria-hidden="true" />
          {t('profile.logout')}
        </DangerButton>
      </section>
    </PanelLayout>
  )
}
