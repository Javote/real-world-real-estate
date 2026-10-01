import { Bell } from 'lucide-react'

interface NotificationBellProps {
  unread: number
  onClick: () => void
  ariaLabel: string
}

export function NotificationBell({ unread, onClick, ariaLabel }: NotificationBellProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white"
    >
      <Bell size={20} aria-hidden="true" />
      {unread > 0 ? (
        <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-verified px-s1 text-caption font-bold text-white">
          {unread > 9 ? '9+' : unread}
        </span>
      ) : null}
    </button>
  )
}
