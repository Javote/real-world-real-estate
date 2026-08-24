import { createFileRoute } from '@tanstack/react-router'
import { CERTIFIER_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { ProfileScreen } from '#/components/ProfileScreen'

// **M2-D5 fila cer-prof · `/certifier/profile`** (implícita en el backlog).
// Test ID: CER-PROFILE-001.

export const Route = createFileRoute('/certifier/profile')({ component: CertifierProfile })

function CertifierProfile() {
  const { ready } = useRoleGuard(CERTIFIER_ROLES)
  if (!ready) return null
  return <ProfileScreen rol="certifier" testId="CER-PROFILE-001" />
}
