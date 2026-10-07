import { createFileRoute } from '@tanstack/react-router'
import { etapaQueries } from '#/api/queries'
import { AssignedStagesQueue } from '#/components/AssignedStagesQueue'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'

export const Route = createFileRoute('/certifier/assigned')({
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(etapaQueries.asignadas())
  },
  component: CertifierAssigned
})

function CertifierAssigned() {
  const { t } = useTranslation()

  return (
    <PanelLayout title={t('nav.certifier.assigned')} context={t('certifier.queue.context')}>
      <AssignedStagesQueue />
    </PanelLayout>
  )
}
