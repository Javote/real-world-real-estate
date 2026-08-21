// Componente de dominio (M2-D3 §Foundation): switch ES/EN persistente.
// Visible en /login y en cada Profile/Menu (M2-D1). Invariante 6: togglear
// re-renderiza sincrónicamente sin recargar la página.
import { Globe } from 'lucide-react'
import { useTranslation } from '../../i18n/useTranslation'

export function LanguageToggle() {
  const { t, locale, setLocale } = useTranslation()
  const other = locale === 'es-AR' ? 'en-US' : 'es-AR'
  const code = locale === 'es-AR' ? 'ES' : 'EN'

  return (
    <button
      type="button"
      onClick={() => setLocale(other)}
      className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1.5 text-sm text-white"
      aria-label={`${t('languageToggle.label')}: ${code}`}
    >
      <Globe size={16} aria-hidden="true" />
      {code}
    </button>
  )
}
