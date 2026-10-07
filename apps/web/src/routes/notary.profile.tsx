import { createFileRoute } from '@tanstack/react-router'
import { usuarioQueries } from '#/api/queries'
import { ProfileScreen } from '#/components/ProfileScreen'

export const Route = createFileRoute('/notary/profile')({
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(usuarioQueries.perfil())
  },
  component: NotaryProfile
})

function NotaryProfile() {
  return <ProfileScreen rol="notary" testId="NOT-PROFILE-001" />
}
