import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { usuarioQueries } from '#/api/queries'
import { InvestorCard } from '#/components/domain/InvestorCard'
import { Loading } from '#/components/domain/Loading'
import { PanelLayout } from '#/components/PanelLayout'
import { formatCurrency } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL_EMPTY } from '#/lib/cardShell'

export const Route = createFileRoute('/developer/investors')({ component: DeveloperInvestors })

function DeveloperInvestors() {
  const { t, locale } = useTranslation()
  const navigate = useNavigate()

  const { data: investors, isPending } = useQuery(usuarioQueries.inversores())

  return (
    <PanelLayout
      title={t('developer.investors.title')}
      context={t('developer.investors.context', { count: String(investors?.length ?? 0) })}
      back={{
        label: t('nav.backToPanel'),
        onClick: () => void navigate({ to: '/developer' })
      }}
    >
      <section className="flex flex-col gap-s2" data-testid="DEV-INVESTORS-LIST-001">
        {isPending ? (
          <Loading />
        ) : investors?.length ? (
          investors.map((inv) => (
            <InvestorCard
              key={inv.id}
              fullName={inv.fullName}
              email={inv.email}
              investedLabel={
                inv.currency
                  ? formatCurrency(inv.investedMinorUnits, inv.currency, locale)
                  : t('developer.investors.noAmount')
              }
              unitLabel={t('developer.investors.units', { count: String(inv.units) })}
              projectName={inv.projects.join(' · ')}
              investmentHeading={t('developer.investors.investment')}
              unitHeading={t('developer.investors.unit')}
            />
          ))
        ) : (
          <p className={CARD_SHELL_EMPTY}>{t('developer.investors.empty')}</p>
        )}
      </section>
    </PanelLayout>
  )
}
