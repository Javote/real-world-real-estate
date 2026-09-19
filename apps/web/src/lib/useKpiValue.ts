import { useTranslation } from '#/i18n/useTranslation'

/**
 * Un KPI que puede no ser calculable todavía.
 *
 * **`null` no es cero.** El backend devuelve `null` cuando la entidad que haría
 * falta para contar no existe (`Unit`, `Contract`, `Dossier`), y mostrar `0`
 * ahí sería afirmar algo falso: "no hay unidades vendidas" en vez de "todavía
 * no hay unidades". Se dibuja con el guión de `panel.emptyValue`.
 */
export function useKpiValue() {
  const { t, locale } = useTranslation()

  return (valor: number | null, sufijo = ''): string =>
    valor === null
      ? t('panel.emptyValue')
      : `${new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(valor)}${sufijo}`
}
