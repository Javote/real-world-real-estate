import { createFileRoute } from '@tanstack/react-router'
import { NOTARY_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { PanelLayout } from '#/components/PanelLayout'
import { PendingDossiersQueue } from '#/components/PendingDossiersQueue'
import { useTranslation } from '#/i18n/useTranslation'

// **La solapa 2 del notario.** M2-D1 §Screen tree la declara —"Dossiers |
// Pending dossiers for review and signing"— y M2-D3 §BottomNav §Usage rules la
// lista entre las cuatro del rol. Lo que NO tiene es una fila propia en el
// backlog de M2-D5 §6.1, porque la misma cola aparece dentro del panel
// (fila 51).
//
// Por eso esta pantalla **no lleva test ID**: no es una superficie del backlog,
// es el destino de una solapa que el entregable sí declara. Darle su path es
// transcribir la solapa; dejarla apuntando a una ruta inexistente era un 404 en
// la demo, y apuntarla al panel rompía el invariante de que ninguna solapa
// duplica destino (`navTabs.test.ts`).

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
