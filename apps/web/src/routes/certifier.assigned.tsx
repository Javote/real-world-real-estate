import { createFileRoute } from '@tanstack/react-router'
import { AssignedStagesQueue } from '#/components/AssignedStagesQueue'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'

export const Route = createFileRoute('/certifier/assigned')({ component: CertifierAssigned })

function CertifierAssigned() {
  const { t } = useTranslation()

  return (
    <PanelLayout title={t('nav.certifier.assigned')} context={t('certifier.queue.context')}>
      <AssignedStagesQueue />
    </PanelLayout>
  )
}
