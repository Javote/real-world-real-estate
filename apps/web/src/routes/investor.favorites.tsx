import { createFileRoute } from '@tanstack/react-router'
import { projectCoverUrl } from '#/api/port'
import { favoritoQueries } from '#/api/queries'
import type { Project } from '#/api/types'
import { Loading } from '#/components/domain/Loading'
import { ProjectCard } from '#/components/domain/ProjectCard'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL_EMPTY } from '#/lib/cardShell'
import { useFavoritos } from '#/lib/favoritos'
import { useAbrirConPrecarga } from '#/lib/intencion'
import { avanceDeStages, TONO_PROYECTO } from '#/lib/stageProgress'

export const Route = createFileRoute('/investor/favorites')({
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(favoritoQueries.lista())
  },
  component: InvestorFavorites
})

function InvestorFavorites() {
  const { t } = useTranslation()
  const abrir = useAbrirConPrecarga()
  const { favoritos, isPending, alternar } = useFavoritos()

  const lista = favoritos ?? []

  return (
    <PanelLayout
      title={t('investor.favorites.title')}
      context={t('investor.favorites.context', { count: String(lista.length) })}
    >
      <section className="flex flex-col gap-s4" data-testid="INV-FAV-LIST-001">
        {isPending ? (
          <Loading />
        ) : lista.length ? (
          lista.map((proyecto: Project, i) => {
            const ubicacion = [proyecto.city, proyecto.country].filter(Boolean).join(', ')
            return (
              <ProjectCard
                key={proyecto.id}
                name={proyecto.name}
                imageUrl={projectCoverUrl(proyecto.id, proyecto.coverUpdatedAt)}
                location={ubicacion || null}
                status={{
                  label: t(`project.status.${proyecto.status}`),
                  tone: TONO_PROYECTO[proyecto.status]
                }}
                progress={avanceDeStages(proyecto.stages)}
                {...abrir({ to: '/project/$projectId', params: { projectId: proyecto.id } })}
                labels={{ from: t('project.from') }}
                favorited
                onToggleFavorite={() => alternar(proyecto)}
                favoriteAriaLabel={t('investor.favorites.unsave')}
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
