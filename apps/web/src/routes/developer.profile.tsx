import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { DEV_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { ProfileScreen } from '#/components/ProfileScreen'
import { useTranslation } from '#/i18n/useTranslation'

export const Route = createFileRoute('/developer/profile')({ component: DeveloperProfile })

function DeveloperProfile() {
  const { ready } = useRoleGuard(DEV_ROLES)
  const { t } = useTranslation()
  const navigate = useNavigate()
  if (!ready) return null
  return (
    <ProfileScreen
      rol="developer"
      testId="DEV-PROFILE-001"
      back={{
        label: t('nav.backToPanel'),
        onClick: () => void navigate({ to: '/developer' })
      }}
    />
  )
}
