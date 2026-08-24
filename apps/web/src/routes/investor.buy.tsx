import { createFileRoute } from '@tanstack/react-router'
import { INVESTOR_ROLES } from '../auth/roles'
import { useRoleGuard } from '../auth/useRoleGuard'

// **Stub deliberado.** El path es el correcto —fila 02 de M2-D5— y el guard de
// rol es real, así que la navegación por rol funciona de punta a punta. Lo que
// falta es la superficie: se transcribe desde su captura cuando llegue su
// vertical (SPEC-014), con los componentes que la fila nombra y el test ID
// INV-BUY-LIST-001 (M3-FE-02).
//
// Existe como stub y no como pantalla a medias a propósito: una pantalla
// inventada se ve terminada y compite con la captura.
export const Route = createFileRoute('/investor/buy')({ component: Pendiente })

function Pendiente() {
  const { ready } = useRoleGuard(INVESTOR_ROLES)
  if (!ready) return null

  return (
    <main data-testid="surface-pending" data-m2d5-row="02">
      <p>Pendiente de transcribir — M2-D5 fila 02</p>
    </main>
  )
}
