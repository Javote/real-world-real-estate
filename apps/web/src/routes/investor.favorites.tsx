import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { api } from '#/api/port'
import type { Project } from '#/api/types'
import { INVESTOR_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { ProjectCard } from '#/components/domain/ProjectCard'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL_EMPTY } from '#/lib/cardShell'
import { avanceDeStages, TONO_PROYECTO } from '#/lib/stageProgress'

// **M2-D5 fila 13 · `/investor/favorites`** — captura 13.
// Test IDs: INV-FAV-LIST-001, INV-FAV-TOGGLE-002.

export const Route = createFileRoute('/investor/favorites')({
  component: InvestorFavorites
})

function InvestorFavorites() {
  const { ready } = useRoleGuard(INVESTOR_ROLES)
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: favoritos } = useQuery({
    queryKey: ['investor', 'favorites'],
    queryFn: api.listFavorites,
    enabled: ready
  })

  const quitar = useMutation({
    mutationFn: (id: string) => api.removeFavorite(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['investor', 'favorites'] })
  })

  if (!ready) return null

  const lista = favoritos ?? []

  return (
    <PanelLayout
      rol="investor"
      title={t('investor.favorites.title')}
      context={t('investor.favorites.context', { count: String(lista.length) })}
    >
      <section className="flex flex-col gap-s4" data-testid="INV-FAV-LIST-001">
        {lista.length ? (
          lista.map((proyecto: Project, i) => {
            const ubicacion = [proyecto.city, proyecto.country].filter(Boolean).join(', ')
            return (
              <ProjectCard
                key={proyecto.id}
                name={proyecto.name}
                location={ubicacion || null}
                status={{
                  label: t(`project.status.${proyecto.status}`),
                  tone: TONO_PROYECTO[proyecto.status] ?? 'neutral'
                }}
                progress={avanceDeStages(proyecto.stages ?? [])}
                onOpen={() =>
                  void navigate({
                    to: '/project/$projectId',
                    params: { projectId: proyecto.id }
                  })
                }
                labels={{ from: t('project.from') }}
                favorited
                onToggleFavorite={() => quitar.mutate(proyecto.id)}
                favoriteAriaLabel={t('investor.favorites.unsave')}
                // **Un test ID identifica una superficie, no N filas.** En la
                // primera tarjeta: repetido por fila, un `getByTestId` en
                // strict mode matchea varios elementos y falla.
                {...(i === 0 ? { favoriteTestId: 'INV-FAV-TOGGLE-002' } : {})}
              />
            )
          })
        ) : (
          <p className={CARD_SHELL_EMPTY}>{t('investor.favorites.empty')}</p>
        )}
      </section>
    </PanelLayout>
  )
}
