import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { api } from '../api/port'
import type { Evidence, Project } from '../api/types'
import { getSession, type Session } from '../auth/session'
import { HashChip } from '../components/domain/HashChip'

export const Route = createFileRoute('/verify')({ component: VerifyScreen })

type Match = { evidence: Evidence; project: Project }
type Result = { kind: 'idle' } | { kind: 'valid'; match: Match } | { kind: 'invalid' }

function VerifyScreen() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result>({ kind: 'idle' })

  useEffect(() => {
    setSession(getSession())
    setReady(true)
  }, [])

  async function verify() {
    const needle = input.trim().toLowerCase()
    if (!needle) return
    setBusy(true)
    setResult({ kind: 'idle' })
    try {
      // Verificación contra los proyectos accesibles con la sesión actual.
      // La verificación pública real (sin cuenta, contra la chain) llega con
      // AnchorPort (D-014).
      const projects = await api.listProjects()
      for (const project of projects) {
        const evidence = await api.listEvidence(project.id)
        const found = evidence.find((e) => e.sha256Hash.toLowerCase() === needle)
        if (found) {
          setResult({ kind: 'valid', match: { evidence: found, project } })
          setBusy(false)
          return
        }
      }
      setResult({ kind: 'invalid' })
    } catch {
      setResult({ kind: 'invalid' })
    } finally {
      setBusy(false)
    }
  }

  if (!ready) return null

  return (
    <div>
      <div className="verification-hero">
        <div className="logo" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
          Prop<span>Nexus</span>
        </div>
        <h1>Verificación de documentos</h1>
        <p>
          Validá la integridad de cualquier documento registrado en la plataforma por su hash
          SHA-256. El anclaje en Cardano (verificación pública por TXID) llega con la integración
          on-chain (D-014).
        </p>

        {session ? (
          <>
            <div className="verification-form">
              <div className="verification-input-group">
                <input
                  type="text"
                  className="verification-input"
                  placeholder="Pegá el hash SHA-256 del documento…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void verify()
                  }}
                />
                <button className="btn btn-primary" onClick={() => void verify()} disabled={busy}>
                  {busy ? 'Verificando…' : 'Verificar'}
                </button>
              </div>
            </div>

            {result.kind === 'valid' ? (
              <div className="verification-result">
                <div className="result-card valid">
                  <div className="result-header">
                    <span style={{ fontSize: '1.5rem' }}>✓</span>
                    <span className="result-status valid">Documento verificado</span>
                  </div>
                  <p style={{ color: 'var(--gray-600)', marginBottom: '1rem' }}>
                    El hash coincide con un documento registrado en la plataforma:
                  </p>
                  <div className="proof-row">
                    <span className="proof-label">Hash verificado</span>
                    <HashChip hash={result.match.evidence.sha256Hash} />
                  </div>
                  <div className="proof-row">
                    <span className="proof-label">Archivo</span>
                    <span className="proof-value">{result.match.evidence.originalFilename}</span>
                  </div>
                  <div className="proof-row">
                    <span className="proof-label">Proyecto asociado</span>
                    <span className="proof-value">
                      {result.match.project.name}
                      {result.match.evidence.milestone ? ` · ${result.match.evidence.milestone.name}` : ''}
                    </span>
                  </div>
                  <div className="proof-row">
                    <span className="proof-label">Registrado</span>
                    <span className="proof-value">
                      {new Date(result.match.evidence.uploadedAt).toLocaleString()} ·{' '}
                      {result.match.evidence.uploadedBy?.fullName ?? '—'}
                    </span>
                  </div>
                  <div className="proof-row">
                    <span className="proof-label">Anclaje on-chain</span>
                    <span className="proof-value">Pendiente</span>
                  </div>
                </div>
              </div>
            ) : null}

            {result.kind === 'invalid' ? (
              <div className="verification-result">
                <div className="result-card invalid">
                  <div className="result-header">
                    <span style={{ fontSize: '1.5rem' }}>✗</span>
                    <span className="result-status invalid">No se encontró el documento</span>
                  </div>
                  <p style={{ color: 'var(--gray-600)' }}>
                    El hash no coincide con ninguna evidencia de tus proyectos accesibles. Verificá
                    que el hash sea correcto.
                  </p>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="verification-result">
            <div className="result-card">
              <p style={{ color: 'var(--gray-600)' }}>
                La verificación sin cuenta estará disponible cuando el anclaje on-chain esté
                integrado (D-014): ahí cualquier persona podrá validar un hash o TXID
                directamente contra Cardano. Por ahora, iniciá sesión para verificar contra tus
                proyectos.
              </p>
            </div>
          </div>
        )}

        <div style={{ marginTop: '3rem' }}>
          <Link to={session ? '/dashboard' : '/login'} style={{ color: 'var(--primary)' }}>
            ← Volver
          </Link>
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-600)', fontSize: '0.9rem' }}>
        <p>PropNexus · Trazabilidad inmobiliaria con blockchain</p>
        <p style={{ marginTop: '0.5rem' }}>Powered by Cardano</p>
      </div>
    </div>
  )
}
