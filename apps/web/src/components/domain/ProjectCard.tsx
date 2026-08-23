import { Link } from '@tanstack/react-router'
import type { Project } from '../../api/types'

const STATUS_LABEL: Record<Project['status'], { text: string; className: string }> = {
  planning: { text: '○ Por iniciar', className: 'status-ontrack' },
  in_progress: { text: '✓ En curso', className: 'status-ontrack' },
  delayed: { text: '⚠ Retrasado', className: 'status-delayed' },
  completed: { text: '✓ Completado', className: 'status-ontrack' }
}

export function projectProgress(project: Project): { done: number; total: number; pct: number } {
  const total = project.milestones.length
  const done = project.milestones.filter((m) => m.state === 'Completed').length
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) }
}

// Componente de dominio (CLAUDE.md): card de proyecto de la maqueta, con datos reales.
export function ProjectCard({ project }: { project: Project }) {
  const { done, total, pct } = projectProgress(project)
  const status = STATUS_LABEL[project.status]
  const location = [project.city, project.country].filter(Boolean).join(', ')

  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: project.id }}
      className="project-card"
      style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}
    >
      <div className="project-hero">
        <img src="/imagen-real-estate.jpg" alt={project.name} />
        <div className="project-hero-overlay">
          <div className="project-name">{project.name}</div>
          <div className="project-location">📍 {location || project.address || '—'}</div>
        </div>
      </div>
      <div className="project-body">
        <div className="project-meta">
          <span className="project-meta-item">🏢 {project.totalUnits} unidades</span>
          {project.estimatedDelivery ? (
            <span className="project-meta-item">
              📅 Entrega: {new Date(project.estimatedDelivery).toLocaleDateString()}
            </span>
          ) : null}
        </div>
        <div className="project-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="progress-text">
            <span>{total > 0 ? `${done} de ${total} milestones` : 'Sin milestones'}</span>
            <span className={`project-status ${status.className}`}>{status.text}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
