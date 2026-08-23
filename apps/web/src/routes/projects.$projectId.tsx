import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { ApiError, api } from '../api/port'
import type { Evidence, Milestone, MilestoneState } from '../api/types'
import { useRequireSession } from '../auth/useSession'
import { AppHeader } from '../components/AppHeader'
import { HashChip } from '../components/domain/HashChip'
import { MilestoneIndicator, MilestoneStateBadge } from '../components/domain/MilestoneStateBadge'
import { projectProgress } from '../components/domain/ProjectCard'
import { StatusPill } from '../components/domain/StatusPill'

export const Route = createFileRoute('/projects/$projectId')({ component: ProjectDetail })

// Tabla de transiciones de la FSM (D-020) — el front solo ofrece movimientos válidos.
const VALID_TRANSITIONS: Record<MilestoneState, Array<{ to: MilestoneState; label: string }>> = {
  Pending: [{ to: 'InProgress', label: 'Iniciar' }],
  InProgress: [
    { to: 'Completed', label: 'Certificar' },
    { to: 'Observed', label: 'Observar' }
  ],
  Observed: [{ to: 'InProgress', label: 'Reabrir' }],
  Completed: []
}

const CATEGORIES = [
  { value: 'technical_plans', label: 'Planos técnicos' },
  { value: 'site_progress', label: 'Avance de obra' },
  { value: 'certifications', label: 'Certificaciones' },
  { value: 'permits', label: 'Permisos' },
  { value: 'legal', label: 'Legal' }
] as const

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

function evidenceIcon(e: Evidence): string {
  return e.evidenceType === 'photo' ? '📷' : e.evidenceType === 'certificate' ? '🏅' : '📄'
}

function ProjectDetail() {
  const { session, ready } = useRequireSession()
  const { projectId } = Route.useParams()
  const queryClient = useQueryClient()

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.getProject(projectId),
    enabled: !!session
  })
  const evidenceQuery = useQuery({
    queryKey: ['evidence', projectId],
    queryFn: () => api.listEvidence(projectId),
    enabled: !!session
  })

  const stateMutation = useMutation({
    mutationFn: ({ id, state }: { id: string; state: MilestoneState }) =>
      api.setMilestoneState(id, state),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
    }
  })

  const [tab, setTab] = useState<'timeline' | 'docs'>('timeline')

  if (!ready || !session) return null

  const canWrite = session.user.role === 'admin' || session.user.role === 'developer'
  const project = projectQuery.data
  const evidence = evidenceQuery.data ?? []

  if (projectQuery.isLoading) {
    return (
      <>
        <AppHeader session={session} />
        <div className="container">
          <p className="page-subtitle">Cargando proyecto…</p>
        </div>
      </>
    )
  }

  if (projectQuery.isError || !project) {
    const err = projectQuery.error
    return (
      <>
        <AppHeader session={session} />
        <div className="container">
          <p style={{ color: 'var(--danger)' }}>
            {err instanceof ApiError && err.status === 403
              ? 'No tenés acceso a este proyecto.'
              : 'No se pudo cargar el proyecto.'}
          </p>
          <Link to="/dashboard" className="back-link">
            ← Volver a proyectos
          </Link>
        </div>
      </>
    )
  }

  const { done, total, pct } = projectProgress(project)
  const location = [project.city, project.country].filter(Boolean).join(', ')

  return (
    <>
      <AppHeader session={session} />

      <div className="project-detail-hero">
        <img src="/imagen-real-estate.jpg" alt={project.name} />
        <div className="project-detail-overlay">
          <div className="project-detail-name">{project.name}</div>
          <div className="project-detail-location">
            📍 {location || project.address || '—'} · {project.totalUnits} unidades
          </div>
          <div className="project-detail-stats">
            <div className="project-detail-stat">
              <span className="project-detail-stat-value">{pct}%</span>
              <span className="project-detail-stat-label">Progreso</span>
            </div>
            <div className="project-detail-stat">
              <span className="project-detail-stat-value">
                {done}/{total}
              </span>
              <span className="project-detail-stat-label">Milestones</span>
            </div>
            <div className="project-detail-stat">
              <span className="project-detail-stat-value">{evidence.length}</span>
              <span className="project-detail-stat-label">Documentos</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        <Link to="/dashboard" className="back-link">
          ← Volver a proyectos
        </Link>

        <div className="card">
          <dl className="info-grid">
            <div className="info-item">
              <dt>Referencia</dt>
              <dd>{project.slug}</dd>
            </div>
            <div className="info-item">
              <dt>Dirección</dt>
              <dd>{project.address ?? '—'}</dd>
            </div>
            <div className="info-item">
              <dt>Estado general</dt>
              <dd>{project.status}</dd>
            </div>
            <div className="info-item">
              <dt>Entrega estimada</dt>
              <dd>
                {project.estimatedDelivery
                  ? new Date(project.estimatedDelivery).toLocaleDateString()
                  : '—'}
              </dd>
            </div>
            <div className="info-item">
              <dt>Última actualización</dt>
              <dd>{new Date(project.updatedAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </div>

        <div className="tabs">
          <button
            type="button"
            className={`tab ${tab === 'timeline' ? 'active' : ''}`}
            onClick={() => setTab('timeline')}
          >
            Trazabilidad
          </button>
          <button
            type="button"
            className={`tab ${tab === 'docs' ? 'active' : ''}`}
            onClick={() => setTab('docs')}
          >
            Documentos
          </button>
        </div>

        {tab === 'timeline' ? (
          <div className="timeline">
            <div className="card-header" style={{ marginBottom: '1.5rem' }}>
              <h2 className="section-title">Milestones del proyecto</h2>
            </div>
            {project.milestones.map((m) => (
              <MilestoneRow
                key={m.id}
                milestone={m}
                evidence={evidence.filter((e) => e.milestoneId === m.id)}
                canWrite={canWrite}
                projectId={projectId}
                onChangeState={(state) => stateMutation.mutate({ id: m.id, state })}
                changing={stateMutation.isPending}
              />
            ))}
            {project.milestones.length === 0 ? (
              <p className="page-subtitle">Este proyecto no tiene milestones cargados.</p>
            ) : null}
          </div>
        ) : (
          <div className="card">
            <div className="card-header">
              <h2 className="section-title">Documentos del proyecto</h2>
            </div>
            <EvidenceList items={evidence.filter((e) => !e.milestoneId)} />
            {canWrite ? <UploadArea projectId={projectId} /> : null}
          </div>
        )}
      </div>
    </>
  )
}

function MilestoneRow({
  milestone,
  evidence,
  canWrite,
  projectId,
  onChangeState,
  changing
}: {
  milestone: Milestone
  evidence: Evidence[]
  canWrite: boolean
  projectId: string
  onChangeState: (state: MilestoneState) => void
  changing: boolean
}) {
  const transitions = VALID_TRANSITIONS[milestone.state]

  return (
    <div className="milestone">
      <MilestoneIndicator state={milestone.state} />
      <div className="milestone-content">
        <div className="milestone-header">
          <span className="milestone-name">{milestone.name}</span>
          <MilestoneStateBadge state={milestone.state} />
          {canWrite
            ? transitions.map((t) => (
                <button
                  type="button"
                  key={t.to}
                  className={`btn btn-sm ${t.to === 'Completed' ? 'btn-success' : 'btn-secondary'}`}
                  disabled={changing}
                  onClick={() => onChangeState(t.to)}
                >
                  {t.label}
                </button>
              ))
            : null}
        </div>
        <p className="milestone-meta">
          {milestone.certifiedAt
            ? `Certificado el ${new Date(milestone.certifiedAt).toLocaleDateString()} · `
            : ''}
          {evidence.length} documento{evidence.length === 1 ? '' : 's'} · {milestone.scopeUnitCount}{' '}
          unidades
        </p>

        {evidence.length > 0 || (canWrite && milestone.state !== 'Completed') ? (
          <div className="evidence-section">
            {evidence.length > 0 ? (
              <div className="evidence-header">
                <span className="evidence-count">Evidencia registrada</span>
                <Link to="/verify" className="verify-link">
                  Verificar en blockchain →
                </Link>
              </div>
            ) : null}
            <EvidenceList items={evidence} />
            {canWrite && milestone.state !== 'Completed' ? (
              <UploadArea projectId={projectId} milestoneId={milestone.id} />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function EvidenceList({ items }: { items: Evidence[] }) {
  async function download(e: Evidence) {
    const blob = await api.downloadEvidence(e.id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = e.originalFilename
    a.click()
    URL.revokeObjectURL(url)
  }

  if (items.length === 0) return null

  return (
    <div className="evidence-list">
      {items.map((e) => (
        <div key={e.id} className="evidence-item">
          <div className="evidence-icon">{evidenceIcon(e)}</div>
          <div className="evidence-info">
            <div className="evidence-name">{e.originalFilename}</div>
            <div className="evidence-type">
              {e.mimeType} · {formatBytes(e.sizeBytes)} · {e.category}
              {e.authoritative ? ' · Documento autoritativo' : ''}
            </div>
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'center',
                marginTop: '0.375rem'
              }}
            >
              <HashChip hash={e.sha256Hash} />
              <StatusPill />
            </div>
          </div>
          <div className="evidence-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void download(e)}
            >
              ↓
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function UploadArea({ projectId, milestoneId }: { projectId: string; milestoneId?: string }) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [category, setCategory] = useState<string>('site_progress')
  const [error, setError] = useState<string | null>(null)

  const upload = useMutation({
    mutationFn: async (files: FileList) => {
      for (const file of Array.from(files)) {
        const form = new FormData()
        form.append('file', file)
        form.append('category', category)
        form.append(
          'evidenceType',
          category === 'certifications'
            ? 'certificate'
            : file.type.startsWith('image/')
              ? 'photo'
              : 'document'
        )
        if (milestoneId) form.append('milestoneId', milestoneId)
        await api.uploadEvidence(projectId, form)
      }
    },
    onSuccess: () => {
      setError(null)
      void queryClient.invalidateQueries({ queryKey: ['evidence', projectId] })
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Error al subir el archivo')
    }
  })

  return (
    <div>
      <button
        type="button"
        className="upload-area"
        onClick={() => inputRef.current?.click()}
        style={{ opacity: upload.isPending ? 0.6 : 1 }}
      >
        {upload.isPending ? (
          <p>Subiendo y calculando hash SHA-256…</p>
        ) : (
          <>
            <p>
              📎 Hacé clic para subir evidencia
              {milestoneId ? ' de este milestone' : ' del proyecto'}
            </p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: 'var(--gray-600)' }}>
              PDF, JPG, PNG hasta 10 MB
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) upload.mutate(e.target.files)
            e.target.value = ''
          }}
        />
      </button>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.5rem' }}>
        <label className="form-label" htmlFor="evidence-category" style={{ margin: 0 }}>
          Categoría
        </label>
        <select
          id="evidence-category"
          className="form-select"
          style={{ width: 'auto' }}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        {error ? (
          <span style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</span>
        ) : null}
      </div>
    </div>
  )
}
