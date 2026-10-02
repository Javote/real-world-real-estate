import { createFileRoute } from '@tanstack/react-router'
import { requireRole } from '#/auth/requireRole'
import { ADMIN_ROLES } from '#/auth/roles'
import { PanelShell } from '#/components/PanelLayout'

export const Route = createFileRoute('/admin')({
  beforeLoad: requireRole(ADMIN_ROLES),
  component: () => <PanelShell rol="admin" />
})
