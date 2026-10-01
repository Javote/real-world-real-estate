import { Languages } from 'lucide-react'
import type { TranslationKey } from '#/i18n/dictionary'
import type { Locale } from '#/i18n/locale'
import { useTranslation } from '#/i18n/useTranslation'

const OPCIONES: ReadonlyArray<{
  locale: Locale
  code: string
  lang: string
  nameKey: TranslationKey
}> = [
  { locale: 'es-AR', code: 'ES', lang: 'es', nameKey: 'languageToggle.es' },
  { locale: 'en-US', code: 'EN', lang: 'en', nameKey: 'languageToggle.en' }
]

export function LanguageToggle() {
  const { locale, setLocale, t } = useTranslation()

  return (
    <fieldset
      aria-label={t('languageToggle.label')}
      className="m-0 flex min-w-0 items-center gap-s1 rounded-full border border-white/40 p-0.5 text-white"
    >
      <Languages size={16} aria-hidden="true" className="ml-s1" />
      {OPCIONES.map((o) => {
        const activo = o.locale === locale
        return (
          <button
            key={o.locale}
            type="button"
            lang={o.lang}
            aria-label={t(o.nameKey)}
            aria-pressed={activo}
            onClick={() => {
              if (!activo) setLocale(o.locale)
            }}
            className={
              activo
                ? 'rounded-full bg-white px-s2 py-0.5 text-body-sm font-semibold text-primary'
                : 'rounded-full px-s2 py-0.5 text-body-sm text-white/80 hover:bg-white/20 hover:text-white'
            }
          >
            {o.code}
          </button>
        )
      })}
    </fieldset>
  )
}
