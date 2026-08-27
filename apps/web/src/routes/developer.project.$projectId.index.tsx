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
// **Los cuatro tiles son los cuatro de la captura.** El de contratos dice
// "Contratos" y no "Contratos y liberaciones" porque la pantalla a la que
// lleva es el registro de los acuerdos, no un flujo de pagos (D-070): el tile
// no puede prometer lo que su destino no hace.
//
// Los dos tiles que ocupaban esos lugares mientras las pantallas no existían
// —"Inversores" y "Registro de auditoría"— se fueron de acá: los dos iban a
// destinos GLOBALES, no a nada de este proyecto. Viven en los accesos del
// panel, que es la sección que D-072 creó justamente para eso.

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
            title={t('developer.project.contractsAction')}
            description={t('developer.project.contractsDescription')}
            icon={FileText}
            onClick={() =>
              void navigate({
                to: '/developer/project/$projectId/contracts',
                params: { projectId }
              })
            }
          />
        </div>
      </section>
    </PanelLayout>
  )
}
