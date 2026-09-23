import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Building2, CalendarClock, KeyRound, Users } from 'lucide-react'
import { useState } from 'react'
import { api } from '#/api/port'
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

// **Capturas 59-60 de M2-D2 (`DEVELOPER-REPUTATION-A/B`) · SPEC-220.**
//
// **Es la única superficie del producto sin fila en M2-D5**: está diseñada en
// M2-D2 y el backlog de M3 nunca la recogió. No hay test IDs que transcribir —
// los de acá son nuestros, con la misma forma que los del entregable.
//
// **Lo que la captura muestra y esta pantalla NO dibuja, y es una decisión
// (D-094):** el pill de rating ("4.8 / 5.0 · 127 investors") que va al lado del
// nombre. Un rating es una afirmación sobre la calidad del desarrollador, y
// D-026 limita lo que la plataforma sostiene a cuatro afirmaciones, todas sobre
// documentos y atestaciones. No hay reseñas, no hay quién las firme y no hay de
// dónde recalcularlo: el número solo podría escribirse a mano, que es fabricar
// la señal (regla 17). Mismo criterio que D-070 con "Release stage N payment".
//
// El conteo de compradores SÍ se muestra, pero como StatCard junto a las otras
// tres métricas derivadas — es un hecho del registro ("cuánta gente compró"),
// no una nota de reputación.

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

          {/* Las cuatro métricas son derivadas, no columnas: obras `completed`,
              unidades `sold`, compradores distintos y el año de fundación
              contra el actual. `yearsInBusiness` puede venir `null` —el
              desarrollador no lo declaró— y entonces no se dibuja su tile en
              vez de mostrar un 0 que afirmaría algo. */}
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

  /** El bloque de bio con su "see more" — colapsado salvo que sea corta. */
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
    // Sin dato no hay bloque, y sin exceso no hay control: un "ver más" que no
    // revela nada es un control que miente.
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
              location={obra.city}
              status={{
                label: t(`project.status.${obra.status}`),
                tone: TONO_PROYECTO[obra.status]
              }}
              progress={obra.progress}
              // El "From 310.000 US$" y el "60 m² to 150 m²" de la captura 60.
              // Los dos son agregaciones sobre las unidades: sin unidades con
              // precio o sin metros declarados, la línea no va.
              //
              // **`formatCurrency` recibe unidades mínimas y divide él** — no
              // se le pasa el monto ya dividido. La primera versión hacía
              // `/100` acá y mostraba "US$ 1.950" donde iban US$ 195.000:
              // typechequea igual (los dos son `number`) y solo se ve
              // renderizado. Mismo call site que `developer.projects.tsx:99`.
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
