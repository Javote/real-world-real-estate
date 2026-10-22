import { createFileRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { dossierQueries } from '#/api/queries'
import { estadosDeRuta } from '#/components/EstadosDeRuta'
import { PanelLayout } from '#/components/PanelLayout'
import { PendingDossiersQueue } from '#/components/PendingDossiersQueue'
import { useTranslation } from '#/i18n/useTranslation'

function Marco({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <PanelLayout title={t('nav.notary.dossiers')} context={t('notary.queue.context')}>
      {children}
    </PanelLayout>
  )
}

export const Route = createFileRoute('/notary/dossiers')({
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(dossierQueries.pendientes())
  },
  ...estadosDeRuta(Marco),
  component: NotaryDossiers
})

function NotaryDossiers() {
  return (
    <Marco>
      <PendingDossiersQueue />
    </Marco>
  )
}
