import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Building2, CalendarClock, KeyRound, Users } from 'lucide-react'
import { useState } from 'react'
import { api, projectCoverUrl } from '#/api/port'
import type { DeveloperProfile } from '#/api/types'
import { INVESTOR_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { Loading } from '#/components/domain/Loading'
import { SecondaryButton } from '#/components/domain/PrimaryButton'
import { ProjectCard } from '#/components/domain/ProjectCard'
import { StatCard } from '#/components/domain/StatCard'
import { PanelLayout } from '#/components/PanelLayout'
import { formatCurrency } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL } from '#/lib/cardShell'
import { reintentarSiNoEsAusencia } from '#/lib/investor'
import { TONO_PROYECTO } from '#/lib/stageProgress'

export const Route = createFileRoute('/project/$projectId/developer')({
  component: InvestorProjectDeveloper
})

function InvestorProjectDeveloper() {
  const { projectId } = Route.useParams()
  const { ready } = useRoleGuard(INVESTOR_ROLES)
  const { t, locale } = useTranslation()
  const navigate = useNavigate()
  const [expandida, setExpandida] = useState(false)

  const { data, error, isPending } = useQuery({
    queryKey: ['project', projectId, 'developer'],
    queryFn: () => api.getProjectDeveloper(projectId),
    enabled: ready,
    retry: reintentarSiNoEsAusencia
  })

  const volver = () => void navigate({ to: '/project/$projectId', params: { projectId } })

  if (!ready) return null

  if (error || (!isPending && !data?.organization)) {
    return (
      <PanelLayout
        rol="investor"
        title={t('investor.developer.title')}
        back={{ label: t('investor.developer.back'), onClick: volver }}
      >
        <p className="text-body text-text-muted" data-testid="INV-DEVELOPER-PROFILE-001">
          {t('investor.developer.notFound')}
        </p>
      </PanelLayout>
    )
  }

  return (
    <PanelLayout
      rol="investor"
      title={data?.organization?.name ?? t('investor.developer.title')}
      back={{ label: t('investor.developer.back'), onClick: volver }}
    >
      {isPending || !data ? (
        <Loading />
      ) : (
        <section className="flex flex-col gap-s4" data-testid="INV-DEVELOPER-PROFILE-001">
          <Bio
            texto={data.organization?.bio ?? null}
            expandida={expandida}
            onAlternar={() => setExpandida((v) => !v)}
            verMas={t('investor.developer.seeMore')}
            verMenos={t('investor.developer.seeLess')}
          />

          <div className="grid grid-cols-2 gap-s3">
            <StatCard
              value={String(data.stats.projectsDelivered)}
              label={t('investor.developer.projectsDelivered')}
              icon={Building2}
              tone="entity"
            />
            {data.stats.yearsInBusiness !== null ? (
              <StatCard
                value={String(data.stats.yearsInBusiness)}
                label={t('investor.developer.yearsInBusiness')}
                icon={CalendarClock}
                tone="trend"
              />
            ) : null}
            <StatCard
              value={String(data.stats.unitsSold)}
              label={t('investor.developer.unitsSold')}
              icon={KeyRound}
              tone="portfolio"
            />
            <StatCard
              value={String(data.stats.investors)}
              label={t('investor.developer.investors')}
              icon={Users}
              tone="people"
            />
          </div>

          <Obras
            titulo={t('investor.developer.previousProjects')}
            vacio={t('investor.developer.emptyPrevious')}
            obras={data.previousProjects}
            testId="INV-DEVELOPER-PREVIOUS-002"
            developerName={data.organization?.name}
          />
          <Obras
            titulo={t('investor.developer.activeProjects')}
            vacio={t('investor.developer.emptyActive')}
            obras={data.activeProjects}
            testId="INV-DEVELOPER-ACTIVE-003"
            developerName={data.organization?.name}
          />
        </section>
      )}
    </PanelLayout>
  )

  function Bio({
    texto,
    expandida,
    onAlternar,
    verMas,
    verMenos
  }: {
    texto: string | null
    expandida: boolean
    onAlternar: () => void
    verMas: string
    verMenos: string
  }) {
    if (!texto) return null
    const larga = texto.length > 180
    return (
      <div className={CARD_SHELL}>
        <p className={`text-body text-text-primary ${!expandida && larga ? 'line-clamp-3' : ''}`}>
          {texto}
        </p>
        {larga ? (
          <SecondaryButton onClick={onAlternar}>{expandida ? verMenos : verMas}</SecondaryButton>
        ) : null}
      </div>
    )
  }

  function Obras({
    titulo,
    vacio,
    obras,
    testId,
    developerName
  }: {
    titulo: string
    vacio: string
    obras: DeveloperProfile['previousProjects']
    testId: string
    developerName: string | undefined
  }) {
    return (
      <section className="flex flex-col gap-s3" data-testid={testId}>
        <h2 className="text-h2 font-bold text-text-primary">{titulo}</h2>
        {obras.length === 0 ? (
          <p className="text-body-sm text-text-muted">{vacio}</p>
        ) : (
          obras.map((obra) => (
            <ProjectCard
              key={obra.id}
              name={obra.name}
              imageUrl={projectCoverUrl(obra.id, obra.coverUpdatedAt)}
              location={obra.city}
              status={{
                label: t(`project.status.${obra.status}`),
                tone: TONO_PROYECTO[obra.status]
              }}
              progress={obra.progress}
              priceLabel={
                obra.priceFromMinorUnits !== null && obra.priceCurrency
                  ? formatCurrency(obra.priceFromMinorUnits, obra.priceCurrency, locale)
                  : null
              }
              sizeLabel={
                obra.sizeMinM2 !== null && obra.sizeMaxM2 !== null
                  ? `${obra.sizeMinM2} m² – ${obra.sizeMaxM2} m²`
                  : null
              }
              developerName={developerName}
              onOpen={() =>
                void navigate({ to: '/project/$projectId', params: { projectId: obra.id } })
              }
              labels={{ from: t('project.from'), progress: t('investor.project.progress') }}
            />
          ))
        )}
      </section>
    )
  }
}
