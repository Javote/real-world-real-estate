import { createFileRoute } from '@tanstack/react-router'
import { CERTIFIER_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { ProfileScreen } from '#/components/ProfileScreen'

export const Route = createFileRoute('/certifier/profile')({ component: CertifierProfile })

function CertifierProfile() {
  const { ready } = useRoleGuard(CERTIFIER_ROLES)
  if (!ready) return null
  return <ProfileScreen rol="certifier" testId="CER-PROFILE-001" />
}
