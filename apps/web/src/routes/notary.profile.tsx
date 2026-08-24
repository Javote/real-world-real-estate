import { createFileRoute } from '@tanstack/react-router'
import { NOTARY_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { ProfileScreen } from '#/components/ProfileScreen'

// **M2-D5 fila 54 · `/notary/profile`** — captura 54-NOTARY-SETTINGS.
// Test ID: NOT-PROFILE-001.
//
// La pantalla es compartida (`ProfileScreen`): esta ruta solo aporta el guard
// del rol y su test ID. Ver el comentario de `ProfileScreen` sobre por qué es
// una sola superficie con cuatro entradas.

export const Route = createFileRoute('/notary/profile')({ component: NotaryProfile })

function NotaryProfile() {
  const { ready } = useRoleGuard(NOTARY_ROLES)
  if (!ready) return null
  return <ProfileScreen rol="notary" testId="NOT-PROFILE-001" />
}
