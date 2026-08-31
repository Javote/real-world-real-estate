import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { DollarSign, FileText, Home, TrendingUp, Upload, Users } from 'lucide-react'
import { api } from '#/api/port'
import { DEV_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { ActionCard } from '#/components/domain/ActionCard'
import { StatCard } from '#/components/domain/StatCard'
import { StatusPill, type StatusTone } from '#/components/domain/StatusPill'
import { PanelLayout } from '#/components/PanelLayout'
import { formatCurrencyCompact } from '#/i18n/format'
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
//
// **Las tres stats son Avance / Capital / Inversores**, no Avance / Etapas /
// Evidencia. El capital y el conteo de investors salen de
// `GET /developer/capital/by-project` (la fila de ESTE proyecto); el avance,
// del detalle. El monto va compacto porque un tile de una grilla de tres no
// entra un monto completo (captura 37: "US$ 8.4M").
//
// **El orden de la captura:** card blanca (nombre + pill) → acciones → stats.
// Los ActionCard van `compact`: ícono + label en una línea, sin descripción.

// `.index` porque esta ruta TIENE hijas (`/upload`). Sin el sufijo, TanStack la
// trata como layout de todo lo que cuelga de `/developer/project/:projectId` y
// exige un `<Outlet/>`: la pantalla de subir evidencia mostraba el detalle. Es
// la tercera vez que este archivo-como-layout muerde — ver `notary.index.tsx`.
export const Route = createFileRoute('/developer/project/$projectId/')({
  component: DeveloperProjectDetail
})

const TONO_POR_ESTADO: Record<string, StatusTone> = {
  planning: 'info',
  in_progress: 'pending',
  delayed: 'pending',
  completed: 'verified'
}

function DeveloperProjectDetail() {
  const { projectId } = Route.useParams()
  const { ready } = useRoleGuard(DEV_ROLES)
  const { t, locale } = useTranslation()
  const navigate = useNavigate()

  const { data: proyecto } = useQuery({
    queryKey: ['developer', 'project', projectId],
    queryFn: () => api.getDeveloperProject(projectId),
    enabled: ready
  })

  const { data: capitalPorProyecto } = useQuery({
    queryKey: ['developer', 'capital', 'by-project'],
    queryFn: api.getCapitalByProject,
    enabled: ready
  })

  if (!ready) return null

  const capital = capitalPorProyecto?.find((p) => p.projectId === projectId)
  const ubicacion = [proyecto?.city, proyecto?.country].filter(Boolean).join(', ')

  return (
    <PanelLayout
      rol="developer"
      title={proyecto?.name ?? t('developer.project.title')}
      {...(ubicacion ? { context: ubicacion } : {})}
      back={{
        label: t('nav.back'),
        onClick: () => void navigate({ to: '/developer/projects' })
      }}
    >
      <section className="flex flex-col gap-s4" data-testid="DEV-PROJECT-DETAIL-001">
        {proyecto ? (
          <article className="flex items-start justify-between gap-s3 rounded-xl bg-card p-s4 shadow-e1">
            <div className="min-w-0">
              <h2 className="truncate text-h2 font-bold text-text-primary">{proyecto.name}</h2>
              {ubicacion ? (
                <p className="truncate text-body-sm text-text-muted">{ubicacion}</p>
              ) : null}
            </div>
            <StatusPill tone={TONO_POR_ESTADO[proyecto.status] ?? 'neutral'}>
              {t(`project.status.${proyecto.status}` as never)}
            </StatusPill>
          </article>
        ) : null}

        <div className="grid grid-cols-2 gap-s3">
          <ActionCard
            compact
            title={t('developer.project.unitsAction')}
            icon={Home}
            onClick={() =>
              void navigate({
                to: '/developer/project/$projectId/units',
                params: { projectId }
              })
            }
          />
          <ActionCard
            compact
            title={t('developer.project.inviteAction')}
            icon={Users}
            onClick={() =>
              void navigate({
                to: '/developer/project/$projectId/invite',
                params: { projectId }
              })
            }
          />
          <ActionCard
            compact
            title={t('developer.project.uploadAction')}
            icon={Upload}
            onClick={() =>
              void navigate({
                to: '/developer/project/$projectId/upload',
                params: { projectId }
              })
            }
          />
          <ActionCard
            compact
            title={t('developer.project.contractsAction')}
            icon={FileText}
            onClick={() =>
              void navigate({
                to: '/developer/project/$projectId/contracts',
                params: { projectId }
              })
            }
          />
        </div>

        <div className="grid grid-cols-3 gap-s3">
          <StatCard
            value={`${proyecto?.progress ?? 0}%`}
            label={t('developer.project.progress')}
            icon={TrendingUp}
            tone="trend"
          />
          <StatCard
            value={
              capital?.currency
                ? formatCurrencyCompact(capital.raisedMinorUnits, capital.currency, locale)
                : t('panel.emptyValue')
            }
            label={t('developer.project.capital')}
            icon={DollarSign}
            tone="financial"
          />
          <StatCard
            value={String(capital?.investors ?? 0)}
            label={t('developer.project.investors')}
            icon={Users}
            tone="people"
          />
        </div>
      </section>
    </PanelLayout>
  )
}
