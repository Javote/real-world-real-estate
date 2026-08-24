import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { FileText, Layers, ShieldCheck, Upload, Users } from 'lucide-react'
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
// **La grilla tiene tres acciones y no cuatro.** La cuarta de la captura es
// "Contratos y liberaciones", que **no se transcribe** (D-070): la plataforma
// no administra fondos. Dejar el tile llevando a una pantalla que promete
// liberar pagos sería afirmar algo que el producto no hace.

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
          <ActionCard
            title={t('developer.project.investorsAction')}
            description={t('developer.project.investorsDescription')}
            icon={Users}
            // Sin destino todavía: la superficie de investors es la fila 48 y
            // no entra en esta tanda. El tile se ve, no miente.
            onClick={() => {}}
          />
        </div>
      </section>
    </PanelLayout>
  )
}
