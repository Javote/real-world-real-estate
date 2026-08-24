import { createFileRoute } from '@tanstack/react-router'
import { CERTIFIER_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { AssignedStagesQueue } from '#/components/AssignedStagesQueue'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'

// **La solapa 2 del certifier.** Misma situación que `/notary/dossiers`: la
// declara M2-D3 §BottomNav, la cola vive también en el panel (fila 55) y no
// tiene fila propia en M2-D5, así que no lleva test ID. Ver el comentario largo
// en `notary.dossiers.tsx`.

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
