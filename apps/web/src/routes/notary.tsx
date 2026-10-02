import { createFileRoute } from '@tanstack/react-router'
import { requireRole } from '#/auth/requireRole'
import { NOTARY_ROLES } from '#/auth/roles'
import { PanelShell } from '#/components/PanelLayout'

export const Route = createFileRoute('/notary')({
  beforeLoad: requireRole(NOTARY_ROLES),
  component: () => <PanelShell rol="notary" />
})
