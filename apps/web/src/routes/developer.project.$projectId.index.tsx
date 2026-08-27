import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { FileText, Home, Layers, ShieldCheck, Upload, Users } from 'lucide-react'
import { api } from '#/api/port'
import { DEV_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { ActionCard } from '#/components/domain/ActionCard'
import { StatCard } from '#/components/domain/StatCard'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'

// **M2-D5 fila 37 · `/developer/project/:projectId`** — captura 37.
// Componentes: ActionCard (grilla de 4), StatCard (3).
// Endpoint: GET /developer/projects/:id. Test ID: DEV-PROJECT-DETAIL-001.
//
// Es el hub del proyecto: el paso 1 del flujo de evidencia entra por acá
// ("Project detail → Upload evidence", M2-D1 §6).
//
// **La grilla tiene cuatro acciones y tres son las de la captura**:
// "Administrar unidades", "Invitar inversor" y "Subir evidencia". La cuarta de
// la captura es "Contratos y liberaciones", que **no se transcribe** (D-070):
// la plataforma no administra fondos, y dejar el tile llevando a una pantalla
// que promete liberar pagos sería afirmar algo que el producto no hace. En su
// lugar va el registro de auditoría, que es el destino más cercano a lo que el
// developer busca ahí: el rastro de lo que pasó con el proyecto.
//
// El tile de "Inversores" que ocupaba ese lugar se fue con esta rebanada: iba
// al directorio GLOBAL, no a nada del proyecto, y desde el panel ya se llega.
// La acción que sí es del proyecto es invitar.

// `.index` porque esta ruta TIENE hijas (`/upload`). Sin el sufijo, TanStack la
// trata como layout de todo lo que cuelga de `/developer/project/:projectId` y
// exige un `<Outlet/>`: la pantalla de subir evidencia mostraba el detalle. Es
// la tercera vez que este archivo-como-layout muerde — ver `notary.index.tsx`.
export const Route = createFileRoute('/developer/project/$projectId/')({
  component: DeveloperProjectDetail
})

function DeveloperProjectDetail() {
  const { projectId } = Route.useParams()
  const { ready } = useRoleGuard(DEV_ROLES)
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { data: proyecto } = useQuery({
    queryKey: ['developer', 'project', projectId],
    queryFn: () => api.getDeveloperProject(projectId),
    enabled: ready
  })

  if (!ready) return null

  return (
    <PanelLayout
      rol="developer"
      title={proyecto?.name ?? t('developer.project.title')}
      {...(proyecto
        ? { context: [proyecto.city, proyecto.country].filter(Boolean).join(', ') }
        : {})}
    >
      <section className="flex flex-col gap-s4" data-testid="DEV-PROJECT-DETAIL-001">
        <div className="grid grid-cols-3 gap-s3">
          <StatCard
            value={String(proyecto?.progress ?? 0)}
            label={t('developer.project.progress')}
            icon={Layers}
            tone="trend"
          />
          <StatCard
            value={String(proyecto?.stages.length ?? 0)}
            label={t('developer.project.stages')}
            icon={ShieldCheck}
            tone="entity"
          />
          <StatCard
            value={String(proyecto?.evidenceCount ?? 0)}
            label={t('developer.project.evidence')}
            icon={FileText}
            tone="verification"
          />
        </div>

        <div className="grid grid-cols-2 gap-s3">
          <ActionCard
            title={t('developer.project.unitsAction')}
            description={t('developer.project.unitsDescription')}
            icon={Home}
            onClick={() =>
              void navigate({
                to: '/developer/project/$projectId/units',
                params: { projectId }
              })
            }
          />
          <ActionCard
            title={t('developer.project.inviteAction')}
            description={t('developer.project.inviteDescription')}
            icon={Users}
            onClick={() =>
              void navigate({
                to: '/developer/project/$projectId/invite',
                params: { projectId }
              })
            }
          />
          <ActionCard
            title={t('developer.project.uploadAction')}
            description={t('developer.project.uploadDescription')}
            icon={Upload}
            featured
            onClick={() =>
              void navigate({
                to: '/developer/project/$projectId/upload',
                params: { projectId }
              })
            }
          />
          <ActionCard
            title={t('developer.project.auditAction')}
            description={t('developer.project.auditDescription')}
            icon={FileText}
            onClick={() => void navigate({ to: '/developer/audit-log' })}
          />
        </div>
      </section>
    </PanelLayout>
  )
}
