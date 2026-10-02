import { Loader2 } from 'lucide-react'
import { useTranslation } from '#/i18n/useTranslation'

export function Loading() {
  const { t } = useTranslation()
  return (
    <div role="status" className="flex flex-col items-center gap-s2 py-s8 text-text-muted">
      <Loader2 className="size-icon-stat animate-spin" aria-hidden="true" />
      <span className="text-body-sm">{t('common.loading')}</span>
    </div>
  )
}
