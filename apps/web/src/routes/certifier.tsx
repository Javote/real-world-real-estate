import { createFileRoute } from '@tanstack/react-router'
import { requireRole } from '#/auth/requireRole'
import { CERTIFIER_ROLES } from '#/auth/roles'
import { PanelShell } from '#/components/PanelLayout'

export const Route = createFileRoute('/certifier')({
  beforeLoad: requireRole(CERTIFIER_ROLES),
  component: () => <PanelShell rol="certifier" />
})
