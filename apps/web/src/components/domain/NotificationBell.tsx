// Componente de dominio (M2-D3 §Foundation): entrada al inbox de
// notificaciones del rol. Mount solo en INV (Buy, Menu) por ahora (M2-D1).
// Sin backend de notificaciones todavía (fuera de alcance de SPEC-011): se
// monta con `unread` en 0 — nunca un número inventado.
import { Bell } from 'lucide-react'

export function NotificationBell({ unread = 0, label }: { unread?: number; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white"
    >
      <Bell size={18} aria-hidden="true" />
      {unread > 0 ? (
        <span
          className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
          style={{ backgroundColor: '#14B8A6' }}
        >
          {unread > 9 ? '9+' : unread}
        </span>
      ) : null}
    </button>
  )
}
