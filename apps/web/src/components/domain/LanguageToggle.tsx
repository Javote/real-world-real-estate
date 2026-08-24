import { Languages } from 'lucide-react'
import { useTranslation } from '#/i18n/useTranslation'

// M2-D3 §Foundation · LanguageToggle.
//
// El cambio de locale re-renderiza **strings, formatos numéricos, fechas y
// relativos** — no solo el texto (M2-D3 §Localization). Eso lo garantiza el
// `LocaleProvider`, que es el que expone `setLocale`.
//
// La persistencia va en `localStorage` bajo `propnexus.lang`, literal, y el
// default es `es-AR`: las dos cosas las fija el entregable.

export function LanguageToggle() {
  const { locale, setLocale, t } = useTranslation()
  const otro = locale === 'es-AR' ? 'en-US' : 'es-AR'

  return (
    <button
      type="button"
      onClick={() => setLocale(otro)}
      aria-label={t('languageToggle.label')}
      className="flex items-center gap-s1 rounded-full px-s2 py-s1 text-body-sm text-white"
    >
      <Languages size={16} aria-hidden="true" />
      {locale === 'es-AR' ? 'ES' : 'EN'}
    </button>
  )
}
