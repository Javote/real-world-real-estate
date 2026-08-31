import { createFileRoute } from '@tanstack/react-router'
import { INVESTOR_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { ProfileScreen } from '#/components/ProfileScreen'

// **M2-D5 fila 30 · `/investor/profile`** — captura 30. Test IDs:
// INV-PROFILE-VIEW-001, INV-PROFILE-EDIT-002, INV-NOTIF-PREFS-003.
//
// La pantalla es compartida (`ProfileScreen`): esta ruta solo aporta el guard
// del rol y su test ID. Ver el comentario de `ProfileScreen` sobre por qué es
// una sola superficie con cuatro entradas. El tab User del investor ya
// apuntaba acá; D-074 también llega desde el ícono del header.

export const Route = createFileRoute('/investor/profile')({ component: InvestorProfile })

function InvestorProfile() {
  const { ready } = useRoleGuard(INVESTOR_ROLES)
  if (!ready) return null
  return (
    <ProfileScreen
      rol="investor"
      testId="INV-PROFILE-VIEW-001"
      editTestId="INV-PROFILE-EDIT-002"
      prefsTestId="INV-NOTIF-PREFS-003"
    />
  )
}
