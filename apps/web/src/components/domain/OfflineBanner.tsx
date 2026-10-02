import { WifiOff } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { useTranslation } from '#/i18n/useTranslation'

// D-101: con la PWA el armazón carga sin red, y una pantalla que no mira el error de su consulta
// dibuja su estado vacío como si fuera cierto. Este aviso dice que lo de abajo puede no estar al
// día. Solo cubre "sin red": con la API caída `navigator.onLine` sigue en `true` (eso es la Fase 2,
// W3/W4: el `error` de cada pantalla).

function suscribir(avisar: () => void) {
  window.addEventListener('online', avisar)
  window.addEventListener('offline', avisar)
  return () => {
    window.removeEventListener('online', avisar)
    window.removeEventListener('offline', avisar)
  }
}

const sinRed = () => !navigator.onLine

export function OfflineBanner() {
  const { t } = useTranslation()
  const offline = useSyncExternalStore(suscribir, sinRed)
  if (!offline) return null
  return (
    <div
      role="status"
      data-testid="PWA-OFFLINE-BANNER-001"
      className="mx-auto max-w-2xl px-s4 pt-s4"
    >
      <p className="flex w-full items-start gap-s2 rounded-lg bg-pending-light p-s3 text-body-sm text-pending">
        <WifiOff className="mt-0.5 size-icon-inline shrink-0" aria-hidden="true" />
        {t('common.offline')}
      </p>
    </div>
  )
}
