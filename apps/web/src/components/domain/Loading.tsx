import { Loader2 } from 'lucide-react'
import { useTranslation } from '#/i18n/useTranslation'

// SPEC-110 (F-18) — el patrón único de carga: 30 de 42 rutas colapsaban
// "cargando" y "cargado y vacío" en el mismo render (`data ?? []`), así que
// mostraban el empty-state completo —"No hay proyectos"— durante todo el
// fetch. Es una afirmación sobre el mundo hecha antes de tener el dato.
//
// `role="status"` (no `alert`): es información, no algo que interrumpa. El
// texto sale del diccionario (regla 14), igual que cualquier otro string.
export function Loading() {
  const { t } = useTranslation()
  return (
    <div role="status" className="flex flex-col items-center gap-s2 py-s8 text-text-muted">
      <Loader2 className="size-icon-stat animate-spin" aria-hidden="true" />
      <span className="text-body-sm">{t('common.loading')}</span>
    </div>
  )
}
