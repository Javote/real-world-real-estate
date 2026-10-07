import { createFileRoute } from '@tanstack/react-router'
import { usuarioQueries } from '#/api/queries'
import { ProfileScreen } from '#/components/ProfileScreen'

export const Route = createFileRoute('/certifier/profile')({
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(usuarioQueries.perfil())
  },
  component: CertifierProfile
})

function CertifierProfile() {
  return <ProfileScreen rol="certifier" testId="CER-PROFILE-001" />
}
