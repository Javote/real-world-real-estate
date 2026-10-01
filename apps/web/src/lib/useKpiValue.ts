import { useTranslation } from '#/i18n/useTranslation'

export function useKpiValue() {
  const { t, locale } = useTranslation()

  return (valor: number | null, sufijo = ''): string =>
    valor === null
      ? t('panel.emptyValue')
      : `${new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(valor)}${sufijo}`
}
