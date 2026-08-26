import { createFileRoute } from '@tanstack/react-router'
import { DEV_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { ProfileScreen } from '#/components/ProfileScreen'

// **M2-D5 fila dev-prof · `/developer/profile`** (implícita en el backlog).
// Test ID: DEV-PROFILE-001.
//
// La pantalla es compartida (`ProfileScreen`): esta ruta solo aporta el guard
// del rol y su test ID. Ver el comentario de `ProfileScreen` sobre por qué es
// una sola superficie con cuatro entradas.
//
// **Sin entrada de navegación, a propósito.** El BottomNav del developer son
// cinco tabs y ninguno es Profile (M2-D3 §Usage rules, espejado en `NAV_TABS`),
// y las capturas 33/34 no muestran avatar ni engranaje en el header. Notary y
// certifier sí tienen su tab; developer no. Agregar un sexto tab o un botón que
// el entregable no define sería inventar superficie, así que la ruta existe y
// se alcanza por URL hasta que la entrada se decida.

export const Route = createFileRoute('/developer/profile')({ component: DeveloperProfile })

function DeveloperProfile() {
  const { ready } = useRoleGuard(DEV_ROLES)
  if (!ready) return null
  return <ProfileScreen rol="developer" testId="DEV-PROFILE-001" />
}
