import { createFileRoute } from '@tanstack/react-router'
import { INVESTOR_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { ProfileScreen } from '#/components/ProfileScreen'

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
