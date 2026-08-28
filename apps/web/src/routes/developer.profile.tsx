import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { DEV_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { ProfileScreen } from '#/components/ProfileScreen'
import { useTranslation } from '#/i18n/useTranslation'

// **M2-D5 fila dev-prof · `/developer/profile`** (implícita en el backlog).
// Test ID: DEV-PROFILE-001.
//
// La pantalla es compartida (`ProfileScreen`): esta ruta solo aporta el guard
// del rol y su test ID. Ver el comentario de `ProfileScreen` sobre por qué es
// una sola superficie con cuatro entradas.
//
// **Sin captura propia.** Notary (54) e investor (30) son tab y no llevan
// flecha. El developer no tiene tab de perfil: llega desde el header (D-072),
// así que lleva back al panel. El header es el de D-074.

export const Route = createFileRoute('/developer/profile')({ component: DeveloperProfile })

function DeveloperProfile() {
  const { ready } = useRoleGuard(DEV_ROLES)
  const { t } = useTranslation()
  const navigate = useNavigate()
  if (!ready) return null
  return (
    <ProfileScreen
      rol="developer"
      testId="DEV-PROFILE-001"
      back={{
        label: t('nav.backToPanel'),
        onClick: () => void navigate({ to: '/developer' })
      }}
    />
  )
}
