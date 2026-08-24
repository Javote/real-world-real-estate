import { createFileRoute } from '@tanstack/react-router'
import { CERTIFIER_ROLES } from '../auth/roles'
import { useRoleGuard } from '../auth/useRoleGuard'

// **Stub deliberado.** El path es el correcto —fila 55 de M2-D5— y el guard de
// rol es real, así que la navegación por rol funciona de punta a punta. Lo que
// falta es la superficie: se transcribe desde su captura cuando llegue su
// vertical (SPEC-014), con los componentes que la fila nombra y el test ID
// CER-PANEL-001 (M3-FE-26).
//
// Existe como stub y no como pantalla a medias a propósito: una pantalla
// inventada se ve terminada y compite con la captura.
export const Route = createFileRoute('/certifier')({ component: Pendiente })

function Pendiente() {
  const { ready } = useRoleGuard(CERTIFIER_ROLES)
  if (!ready) return null

  return (
    <main data-testid="surface-pending" data-m2d5-row="55">
      <p>Pendiente de transcribir — M2-D5 fila 55</p>
    </main>
  )
}
