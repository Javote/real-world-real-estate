import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { usuarioQueries } from '#/api/queries'
import { ProfileScreen } from '#/components/ProfileScreen'
import { useTranslation } from '#/i18n/useTranslation'

export const Route = createFileRoute('/developer/profile')({
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(usuarioQueries.perfil())
  },
  component: DeveloperProfile
})

function DeveloperProfile() {
  const { t } = useTranslation()
  const navigate = useNavigate()
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
