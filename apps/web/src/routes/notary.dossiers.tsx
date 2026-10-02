import { createFileRoute } from '@tanstack/react-router'
import { PanelLayout } from '#/components/PanelLayout'
import { PendingDossiersQueue } from '#/components/PendingDossiersQueue'
import { useTranslation } from '#/i18n/useTranslation'

export const Route = createFileRoute('/notary/dossiers')({ component: NotaryDossiers })

function NotaryDossiers() {
  const { t } = useTranslation()

  return (
    <PanelLayout title={t('nav.notary.dossiers')} context={t('notary.queue.context')}>
      <PendingDossiersQueue />
    </PanelLayout>
  )
}
