import type { CapitalMonthlyPoint } from '@plataforma/shared'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Building2, DollarSign } from 'lucide-react'
import { capitalQueries } from '#/api/queries'
import { Loading } from '#/components/domain/Loading'
import { ProgressBar } from '#/components/domain/ProgressBar'
import { PanelLayout } from '#/components/PanelLayout'
import { formatCurrency, formatCurrencyCompact } from '#/i18n/format'
import type { Locale } from '#/i18n/locale'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL, CARD_SHELL_EMPTY } from '#/lib/cardShell'
import { cn } from '#/lib/cn'

export const Route = createFileRoute('/developer/capital')({
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(capitalQueries.resumen())
    void queryClient.prefetchQuery(capitalQueries.mensual())
    void queryClient.prefetchQuery(capitalQueries.porProyecto())
  },
  component: DeveloperCapital
})

function DeveloperCapital() {
  const { t, locale } = useTranslation()
  const navigate = useNavigate()

  const { data: resumen, isPending: resumenPending } = useQuery(capitalQueries.resumen())

  const { data: mensual, isPending: mensualPending } = useQuery(capitalQueries.mensual())

  const { data: porProyecto, isPending: porProyectoPending } = useQuery(
    capitalQueries.porProyecto()
  )

  const cargando = resumenPending || mensualPending || porProyectoPending

  const moneda = resumen?.currency
  const total = resumen?.raisedMinorUnits ?? 0

  return (
    <PanelLayout
      title={t('developer.capital.title')}
      context={t('developer.capital.context')}
      back={{
        label: t('nav.backToPanel'),
        onClick: () => void navigate({ to: '/developer' })
      }}
    >
      {cargando ? (
        <Loading />
      ) : (
        <>
          <section
            className={cn('flex flex-col gap-s5', CARD_SHELL)}
            data-testid="DEV-CAPITAL-SUMMARY-001"
          >
            <div className="flex items-center gap-s3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-verified text-white">
                <DollarSign size={20} aria-hidden="true" />
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="text-stat font-bold text-text-primary">
                  {moneda ? formatCurrency(total, moneda, locale) : t('panel.emptyValue')}
                </span>
                <span className="text-body-sm text-text-muted">
                  {t('developer.capital.totalRaised')}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-s3" data-testid="DEV-CAPITAL-MONTHLY-002">
              <h2 className="text-body font-bold text-text-primary">
                {t('developer.capital.monthly')}
              </h2>
              {mensual?.length ? (
                <BarrasMensuales serie={mensual} moneda={moneda ?? null} locale={locale} />
              ) : (
                <p className="text-body-sm text-text-muted">
                  {t('developer.capital.monthlyEmpty')}
                </p>
              )}
            </div>
          </section>

          <section className="flex flex-col gap-s3">
            <h2 className="text-h2 font-bold text-text-primary">
              {t('developer.capital.byProject')}
            </h2>

            {porProyecto?.length ? (
              porProyecto.map((p) => (
                <article key={p.projectId} className={cn('flex flex-col gap-s3', CARD_SHELL)}>
                  <div className="flex items-center gap-s3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-light">
                      <Building2 className="size-icon-stat text-primary" aria-hidden="true" />
                    </span>
                    <h3 className="min-w-0 truncate text-body font-bold text-text-primary">
                      {p.projectName}
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-s3">
                    <div className="flex flex-col">
                      <span className="text-body-sm text-text-muted">
                        {t('developer.capital.raised')}
                      </span>
                      <span className="text-body font-bold text-text-primary tabular-nums">
                        {p.currency
                          ? formatCurrency(p.raisedMinorUnits, p.currency, locale)
                          : t('panel.emptyValue')}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-body-sm text-text-muted">
                        {t('developer.capital.investors')}
                      </span>
                      <span className="text-body font-bold text-text-primary tabular-nums">
                        {p.investors}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-s1">
                    <div className="flex items-baseline justify-between gap-s2">
                      <span className="text-body-sm text-text-muted">
                        {t('developer.capital.share')}
                      </span>
                    </div>
                    <ProgressBar
                      percent={total > 0 ? Math.round((p.raisedMinorUnits / total) * 100) : 0}
                      label={p.projectName}
                      showValue
                    />
                  </div>
                </article>
              ))
            ) : (
              <p className={CARD_SHELL_EMPTY}>{t('developer.capital.empty')}</p>
            )}
          </section>
        </>
      )}
    </PanelLayout>
  )
}

function BarrasMensuales({
  serie,
  moneda,
  locale
}: {
  serie: CapitalMonthlyPoint[]
  moneda: string | null
  locale: Locale
}) {
  const maximo = Math.max(...serie.map((p) => p.raisedMinorUnits), 1)

  return (
    <ol className="flex items-end gap-s2 overflow-x-auto">
      {serie.map((punto) => (
        <li
          key={punto.month}
          className="flex min-w-12 max-w-24 flex-1 flex-col items-center gap-s1"
        >
          <span className="text-caption text-text-muted tabular-nums">
            {moneda ? formatCurrencyCompact(punto.raisedMinorUnits, moneda, locale) : '—'}
          </span>
          <div className="flex h-32 w-full items-end">
            <div
              className="w-full rounded-t-md bg-primary"
              style={{
                height: `${Math.max(Math.round((punto.raisedMinorUnits / maximo) * 100), 4)}%`
              }}
            />
          </div>
          <span className="text-caption text-text-muted">{nombreDeMes(punto.month, locale)}</span>
        </li>
      ))}
    </ol>
  )
}

function nombreDeMes(month: string, locale: Locale): string {
  const [anio, mes] = month.split('-')
  return new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(Number(anio), Number(mes) - 1, 1))
  )
}
