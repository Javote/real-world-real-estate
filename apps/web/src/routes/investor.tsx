import { createFileRoute } from '@tanstack/react-router'
import { requireRole } from '#/auth/requireRole'
import { INVESTOR_ROLES } from '#/auth/roles'
import { PanelShell } from '#/components/PanelLayout'

export const Route = createFileRoute('/investor')({
  beforeLoad: requireRole(INVESTOR_ROLES),
  component: () => <PanelShell rol="investor" />
})
