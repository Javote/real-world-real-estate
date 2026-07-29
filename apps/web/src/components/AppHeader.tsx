import { Link, useNavigate } from '@tanstack/react-router'
import { clearSession, type Session } from '../auth/session'

export function AppHeader({ session }: { session: Session }) {
  const navigate = useNavigate()

  function logout() {
    clearSession()
    void navigate({ to: '/login' })
  }

  return (
    <header className="header">
      <Link to="/dashboard" className="logo" style={{ textDecoration: 'none' }}>
        Prop<span>Nexus</span>
      </Link>
      <nav className="nav">
        <Link to="/dashboard">Proyectos</Link>
        <Link to="/verify">Verificar</Link>
      </nav>
      <div className="user-menu">
        <span className="role-badge">{session.user.role}</span>
        <span>{session.user.fullName}</span>
        <button
          onClick={logout}
          aria-label="Salir"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-600)' }}
        >
          🚪
        </button>
      </div>
    </header>
  )
}
