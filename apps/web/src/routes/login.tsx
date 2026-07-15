import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { api, ApiError } from '../api/port'
import { setSession } from '../auth/session'

export const Route = createFileRoute('/login')({ component: LoginScreen })

// Perfiles del seed (packages/api/prisma/seed.ts). El rol "certifier" de la
// maqueta corresponde al rol global `verifier` del backend (SPEC-006).
export const ROLE_PRESETS = [
  { key: 'developer', icon: '🏗️', label: 'Developer', email: 'developer@example.com', password: 'dev123' },
  { key: 'certifier', icon: '✓', label: 'Certifier', email: 'verifier@example.com', password: 'verifier123' },
  { key: 'buyer', icon: '🏠', label: 'Buyer', email: 'buyer@example.com', password: 'buyer123' },
] as const

export function LoginScreen() {
  const navigate = useNavigate()
  const [preset, setPreset] = useState(0)
  const [email, setEmail] = useState<string>(ROLE_PRESETS[0].email)
  const [password, setPassword] = useState<string>(ROLE_PRESETS[0].password)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function selectPreset(i: number) {
    setPreset(i)
    const p = ROLE_PRESETS[i]
    if (p) {
      setEmail(p.email)
      setPassword(p.password)
    }
    setError(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await api.login(email, password)
      setSession({ token: res.token, user: res.user })
      void navigate({ to: '/dashboard' })
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'Credenciales inválidas'
          : 'No se pudo conectar con la API — ¿está levantada? (pnpm dev)',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <div className="logo" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
            Prop<span>Trust</span>
          </div>
          <p style={{ color: 'var(--gray-600)' }}>Trazabilidad inmobiliaria con anclaje blockchain</p>
        </div>

        <form className="card" onSubmit={submit}>
          <p className="form-label" style={{ textAlign: 'center', marginBottom: '1rem' }}>
            Seleccioná tu rol para continuar (usuarios del seed demo)
          </p>

          <div className="role-selector">
            {ROLE_PRESETS.map((p, i) => (
              <div
                key={p.key}
                className={`role-option ${i === preset ? 'active' : ''}`}
                onClick={() => selectPreset(i)}
              >
                <div className="icon">{p.icon}</div>
                <div className="label">{p.label}</div>
              </div>
            ))}
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error ? (
            <p style={{ color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '1rem' }}>{error}</p>
          ) : null}

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Ingresando…' : 'Ingresar'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <Link to="/verify" style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>
              Verificar documento sin cuenta →
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
