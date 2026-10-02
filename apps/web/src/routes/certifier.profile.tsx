import { createFileRoute } from '@tanstack/react-router'
import { ProfileScreen } from '#/components/ProfileScreen'

export const Route = createFileRoute('/certifier/profile')({ component: CertifierProfile })

function CertifierProfile() {
  return <ProfileScreen rol="certifier" testId="CER-PROFILE-001" />
}
