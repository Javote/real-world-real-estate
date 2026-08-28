import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { api } from '#/api/port'
import { DEV_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { SecondaryButton } from '#/components/domain/PrimaryButton'
import { ProjectCard } from '#/components/domain/ProjectCard'
import type { StatusTone } from '#/components/domain/StatusPill'
import { PanelLayout } from '#/components/PanelLayout'
import { formatCurrency, formatMonthYear } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'

// **M2-D5 fila 35-36 · `/developer/projects`** — captura 35/36.
// Componentes: ProjectCard, StatusPill, ProgressTimeline (inline).
// Endpoint: GET /developer/projects. Test ID: DEV-PROJECTS-LIST-001.
//
// Es el paso 0 del flujo de evidencia (M2-D1 §6): desde acá se entra al
// proyecto y de ahí a subir. El avance que muestra cada card es **del
// proyecto** (D-029), no de una unidad.
//
// "+ New" va en `headerAction`, alineado con el título (captura 35-36). El
// header es el de D-074: logo + utilidades; la flecha no reemplaza al logo.
//
// **Un dato de la captura no se dibuja, y es deuda declarada, no olvido.** El
// subtítulo dice "3 proyectos" y no "3 projects by Grupo Alpine" porque no hay
// entidad de organización; el porqué está en el prop `developerName` de
// ProjectCard. El "Price from" sí está: lo agrega el endpoint desde las
// unidades del proyecto.

export const Route = createFileRoute('/developer/projects')({ component: DeveloperProjects })

/** El estado del proyecto contra la matriz de M2-D3, sin inventar estados. */
const TONO_POR_ESTADO: Record<string, StatusTone> = {
  planning: 'info',
  in_progress: 'pending',
  delayed: 'pending',
  completed: 'verified'
}

function DeveloperProjects() {
  const { ready } = useRoleGuard(DEV_ROLES)
  const { t, locale } = useTranslation()
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
      context={t('developer.projects.context', { count: String(proyectos?.length ?? 0) })}
      back={{
        label: t('developer.projects.backToPanel'),
        onClick: () => void navigate({ to: '/developer' })
      }}
      headerAction={
        <SecondaryButton onClick={() => void navigate({ to: '/developer/project/new' })}>
          <Plus size={16} aria-hidden="true" />
          {t('developer.projects.new')}
        </SecondaryButton>
      }
    >
      <section className="flex flex-col gap-s3" data-testid="DEV-PROJECTS-LIST-001">
        {proyectos?.length ? (
          proyectos.map((p) => {
            const entregado = p.status === 'completed'
            const dateLabel = p.estimatedDelivery
              ? entregado
                ? t('projectCard.deliveredIn', {
                    year: String(new Date(p.estimatedDelivery).getFullYear())
                  })
                : formatMonthYear(p.estimatedDelivery, locale)
              : null

            return (
              <ProjectCard
                key={p.id}
                variant="developer"
                name={p.name}
                location={[p.city, p.country].filter(Boolean).join(', ')}
                progress={entregado ? null : p.progress}
                status={{
                  tone: TONO_POR_ESTADO[p.status] ?? 'neutral',
                  label: t(`projectStatus.${p.status}` as never)
                }}
                priceLabel={
                  p.priceFromMinorUnits != null && p.priceCurrency
                    ? formatCurrency(p.priceFromMinorUnits, p.priceCurrency, locale)
                    : null
                }
                unitsLabel={String(p.totalUnits)}
                dateLabel={dateLabel}
                labels={{
                  from: t('projectCard.from'),
                  units: t('projectCard.units'),
                  progress: t('projectCard.constructionProgress')
                }}
                onOpen={() =>
                  void navigate({
                    to: '/developer/project/$projectId',
                    params: { projectId: p.id }
                  })
                }
              />
            )
          })
        ) : (
          <p className="rounded-xl bg-card p-s4 text-body-sm text-text-muted shadow-e1">
            {t('developer.projects.empty')}
          </p>
        )}
      </section>
    </PanelLayout>
  )
}
