import { createFileRoute } from '@tanstack/react-router'
import { ProfileScreen } from '#/components/ProfileScreen'

export const Route = createFileRoute('/investor/profile')({ component: InvestorProfile })

function InvestorProfile() {
  return (
    <ProfileScreen
      rol="investor"
      testId="INV-PROFILE-VIEW-001"
      editTestId="INV-PROFILE-EDIT-002"
      prefsTestId="INV-NOTIF-PREFS-003"
    />
  )
}
