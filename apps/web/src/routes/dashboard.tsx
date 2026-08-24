import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { api } from '../api/port'
import type { Milestone, Project } from '../api/types'
import { useRequireSession } from '../auth/useSession'
import { AppHeader } from '../components/AppHeader'
import { ProjectCard } from '../components/domain/ProjectCard'

export const Route = createFileRoute('/dashboard')({ component: Dashboard })

type MilestoneWithProject = Milestone & { project: Project }

function milestonesByState(
  projects: Project[],
  states: Milestone['state'][]
): MilestoneWithProject[] {
  return projects.flatMap((p) =>
    p.milestones.filter((m) => states.includes(m.state)).map((m) => ({ ...m, project: p }))
  )
}

function Dashboard() {
  const { session, ready } = useRequireSession()

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: api.listProjects,
    enabled: !!session
  })

  if (!ready || !session) return null

  const projects = projectsQuery.data ?? []
  const role = session.user.role

  return (
    <>
      <AppHeader session={session} />
      {projectsQuery.isLoading ? (
        <div className="container">
          <p className="page-subtitle">Cargando proyectos…</p>
        </div>
      ) : projectsQuery.isError ? (
        <div className="container">
          <p style={{ color: 'var(--danger)' }}>
            No se pudieron cargar los proyectos. ¿La API está levantada? (pnpm dev)
          </p>
        </div>
      ) : role === 'verifier' ? (
        <CertifierDashboard projects={projects} />
      ) : role === 'buyer' ? (
        <BuyerDashboard projects={projects} />
      ) : (
        <DeveloperDashboard projects={projects} />
      )}
    </>
  )
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function TaskRow({
  milestone,
  priorityClass,
  meta,
  actionLabel
}: {
  milestone: MilestoneWithProject
  priorityClass: string
  meta: string
  actionLabel: string
}) {
  return (
    <div className="task-item">
      <div className={`task-priority ${priorityClass}`} />
      <div className="task-content">
        <div className="task-title">
          {milestone.project.name} | {milestone.name}
        </div>
        <div className="task-meta">{meta}</div>
      </div>
      <div className="task-actions">
        <Link
          to="/projects/$projectId"
          params={{ projectId: milestone.projectId }}
          className="btn btn-primary btn-sm"
          style={{ textDecoration: 'none' }}
        >
          {actionLabel}
        </Link>
      </div>
    </div>
  )
}

function DeveloperDashboard({ projects }: { projects: Project[] }) {
  const [tab, setTab] = useState<'projects' | 'tasks'>('projects')
  const active = projects.filter((p) => p.status !== 'completed')
  const totalUnits = projects.reduce((acc, p) => acc + p.totalUnits, 0)
  const pending = milestonesByState(projects, ['Pending', 'InProgress', 'Observed'])
  const completed = milestonesByState(projects, ['Completed'])

  return (
    <div className="container">
      <h1 className="page-title">Mis Proyectos</h1>
      <p className="page-subtitle">Gestión de desarrollos y carga de evidencia</p>

      <div className="stats-grid">
        <Stat value={active.length} label="Proyectos activos" />
        <Stat value={totalUnits} label="Unidades totales" />
        <Stat value={pending.length} label="Milestones pendientes" />
        <Stat value={completed.length} label="Milestones completados" />
      </div>

      <div className="tabs">
        <button
          type="button"
          className={`tab ${tab === 'projects' ? 'active' : ''}`}
          onClick={() => setTab('projects')}
        >
          Proyectos
        </button>
        <button
          type="button"
          className={`tab ${tab === 'tasks' ? 'active' : ''}`}
          onClick={() => setTab('tasks')}
        >
          Tareas Pendientes
        </button>
      </div>

      {tab === 'projects' ? (
        <div className="project-grid">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
          {projects.length === 0 ? (
            <p className="page-subtitle">No sos miembro de ningún proyecto todavía.</p>
          ) : null}
        </div>
      ) : (
        <>
          <h2 className="section-title">Milestones que requieren evidencia</h2>
          <div className="task-list">
            {milestonesByState(projects, ['InProgress', 'Observed']).map((m) => (
              <TaskRow
                key={m.id}
                milestone={m}
                priorityClass={m.state === 'Observed' ? 'priority-high' : 'priority-medium'}
                meta={`Estado: ${m.state === 'Observed' ? 'Observado' : 'En progreso'}`}
                actionLabel="Cargar"
              />
            ))}
            {milestonesByState(projects, ['InProgress', 'Observed']).length === 0 ? (
              <p className="page-subtitle">Nada pendiente por ahora.</p>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}

function CertifierDashboard({ projects }: { projects: Project[] }) {
  const queue = milestonesByState(projects, ['InProgress'])
  const observed = milestonesByState(projects, ['Observed'])
  const approved = milestonesByState(projects, ['Completed'])

  return (
    <div className="container">
      <h1 className="page-title">Certificaciones Pendientes</h1>
      <p className="page-subtitle">Revisión y aprobación de milestones por proyecto</p>

      <div className="stats-grid">
        <Stat value={queue.length} label="Milestones por revisar" />
        <Stat value={approved.length} label="Aprobados" />
        <Stat value={observed.length} label="Observados" />
        <Stat value={projects.length} label="Proyectos asignados" />
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="section-title">Cola de certificación</h2>
        </div>
        <div className="task-list">
          {queue.map((m) => (
            <TaskRow
              key={m.id}
              milestone={m}
              priorityClass="priority-medium"
              meta="En progreso"
              actionLabel="Revisar"
            />
          ))}
          {queue.length === 0 ? <p className="page-subtitle">Sin milestones en cola.</p> : null}
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <h2 className="section-title">Observados recientemente</h2>
        </div>
        <div className="task-list">
          {observed.map((m) => (
            <TaskRow
              key={m.id}
              milestone={m}
              priorityClass="priority-high"
              meta="Observado"
              actionLabel="Ver estado"
            />
          ))}
          {observed.length === 0 ? (
            <p className="page-subtitle">Sin observaciones activas.</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function BuyerDashboard({ projects }: { projects: Project[] }) {
  const certified = milestonesByState(projects, ['Completed']).filter((m) => m.certifiedAt)

  return (
    <div className="container">
      <h1 className="page-title">Mis Inversiones</h1>
      <p className="page-subtitle">Seguimiento de proyectos en construcción</p>

      <div className="stats-grid">
        <Stat value={projects.length} label="Proyectos" />
        <Stat
          value={projects.reduce((acc, p) => acc + p.totalUnits, 0)}
          label="Unidades en mis proyectos"
        />
        <Stat value={certified.length} label="Milestones certificados" />
        <Stat
          value={milestonesByState(projects, ['InProgress']).length}
          label="Etapas en progreso"
        />
      </div>

      <h2 className="section-title">Mis proyectos</h2>
      <div className="project-grid">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
        {projects.length === 0 ? (
          <p className="page-subtitle">No sos miembro de ningún proyecto todavía.</p>
        ) : null}
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <h2 className="section-title">Actividad reciente en mis proyectos</h2>
        </div>
        <div className="task-list">
          {certified.map((m) => (
            <TaskRow
              key={m.id}
              milestone={m}
              priorityClass="priority-low"
              meta={`Certificado el ${m.certifiedAt ? new Date(m.certifiedAt).toLocaleDateString() : '—'}`}
              actionLabel="Ver"
            />
          ))}
          {certified.length === 0 ? (
            <p className="page-subtitle">Todavía no hay milestones certificados.</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
