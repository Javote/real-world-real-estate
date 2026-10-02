import { createFileRoute } from '@tanstack/react-router'
import { ProfileScreen } from '#/components/ProfileScreen'

export const Route = createFileRoute('/notary/profile')({ component: NotaryProfile })

function NotaryProfile() {
  return <ProfileScreen rol="notary" testId="NOT-PROFILE-001" />
}
