import { createFileRoute } from '@tanstack/react-router'
import { NOTARY_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { ProfileScreen } from '#/components/ProfileScreen'

export const Route = createFileRoute('/notary/profile')({ component: NotaryProfile })

function NotaryProfile() {
  const { ready } = useRoleGuard(NOTARY_ROLES)
  if (!ready) return null
  return <ProfileScreen rol="notary" testId="NOT-PROFILE-001" />
}
