import { createFileRoute } from '@tanstack/react-router'
import { dossierQueries } from '#/api/queries'
import { PanelLayout } from '#/components/PanelLayout'
import { PendingDossiersQueue } from '#/components/PendingDossiersQueue'
import { useTranslation } from '#/i18n/useTranslation'

export const Route = createFileRoute('/notary/dossiers')({
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(dossierQueries.pendientes())
  },
  component: NotaryDossiers
})

function NotaryDossiers() {
  const { t } = useTranslation()

  return (
    <PanelLayout title={t('nav.notary.dossiers')} context={t('notary.queue.context')}>
      <PendingDossiersQueue />
    </PanelLayout>
  )
}
