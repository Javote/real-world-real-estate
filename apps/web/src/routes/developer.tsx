import { createFileRoute } from '@tanstack/react-router'
import { requireRole } from '#/auth/requireRole'
import { DEV_ROLES } from '#/auth/roles'
import { PanelShell } from '#/components/PanelLayout'

export const Route = createFileRoute('/developer')({
  beforeLoad: requireRole(DEV_ROLES),
  component: () => <PanelShell rol="developer" />
})
