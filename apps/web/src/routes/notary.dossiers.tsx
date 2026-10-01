import { createFileRoute } from '@tanstack/react-router'
import { NOTARY_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { PanelLayout } from '#/components/PanelLayout'
import { PendingDossiersQueue } from '#/components/PendingDossiersQueue'
import { useTranslation } from '#/i18n/useTranslation'

export const Route = createFileRoute('/notary/dossiers')({ component: NotaryDossiers })

function NotaryDossiers() {
  const { ready } = useRoleGuard(NOTARY_ROLES)
  const { t } = useTranslation()
  if (!ready) return null

  return (
    <PanelLayout rol="notary" title={t('nav.notary.dossiers')} context={t('notary.queue.context')}>
      <PendingDossiersQueue />
    </PanelLayout>
  )
}
