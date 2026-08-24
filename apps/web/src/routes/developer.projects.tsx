import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { api } from '#/api/port'
import { DEV_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { ProjectCard } from '#/components/domain/ProjectCard'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'

// **M2-D5 fila 35-36 · `/developer/projects`** — captura 35/36.
// Componentes: ProjectCard, StatusPill, ProgressTimeline (inline).
// Endpoint: GET /developer/projects. Test ID: DEV-PROJECTS-LIST-001.
//
// Es el paso 0 del flujo de evidencia (M2-D1 §6): desde acá se entra al
// proyecto y de ahí a subir. El avance que muestra cada card es **del
// proyecto** (D-029), no de una unidad.

export const Route = createFileRoute('/developer/projects')({ component: DeveloperProjects })

function DeveloperProjects() {
  const { ready } = useRoleGuard(DEV_ROLES)
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data: proyectos } = useQuery({
    queryKey: ['developer', 'projects'],
    queryFn: api.listDeveloperProjects,
    enabled: ready
  })

  if (!ready) return null

  return (
    <PanelLayout
      rol="developer"
      title={t('developer.projects.title')}
      context={t('developer.projects.context')}
    >
      <section className="flex flex-col gap-s3" data-testid="DEV-PROJECTS-LIST-001">
        {proyectos?.length ? (
          proyectos.map((p) => (
            <ProjectCard
              key={p.id}
              name={p.name}
              location={[p.city, p.country].filter(Boolean).join(', ')}
              progress={p.progress}
              status={{
                tone: p.status === 'completed' ? 'verified' : 'pending',
                label: t(`projectStatus.${p.status}` as never)
              }}
              labels={{ from: t('projectCard.from') }}
              onOpen={() =>
                void navigate({ to: '/developer/project/$projectId', params: { projectId: p.id } })
              }
            />
          ))
        ) : (
          <p className="rounded-xl bg-card p-s4 text-body-sm text-text-muted shadow-e1">
            {t('developer.projects.empty')}
          </p>
        )}
      </section>
    </PanelLayout>
  )
}
