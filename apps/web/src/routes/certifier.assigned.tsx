import { createFileRoute } from '@tanstack/react-router'
import { CERTIFIER_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { AssignedStagesQueue } from '#/components/AssignedStagesQueue'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'

export const Route = createFileRoute('/certifier/assigned')({ component: CertifierAssigned })

function CertifierAssigned() {
  const { ready } = useRoleGuard(CERTIFIER_ROLES)
  const { t } = useTranslation()
  if (!ready) return null

  return (
    <PanelLayout
      rol="certifier"
      title={t('nav.certifier.assigned')}
      context={t('certifier.queue.context')}
    >
      <AssignedStagesQueue />
    </PanelLayout>
  )
}
