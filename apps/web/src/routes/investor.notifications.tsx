import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import { Bell, FileCheck2, FileText, ShieldCheck, Signature } from 'lucide-react'
import { useState } from 'react'
import { api } from '#/api/port'
import { INVESTOR_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import type { AuditCategory } from '#/components/domain/AuditEventCard'
import { CategoryChip } from '#/components/domain/Chips'
import { NotificationCard } from '#/components/domain/NotificationCard'
import { PanelLayout } from '#/components/PanelLayout'
import { formatRelative } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'

// **M2-D5 fila 62 · `/investor/notifications`** — Test ID: INV-NOTIF-LIST-001.
// Componentes: NotificationCard, InvitationCard, FilterPill.
//
// **Es el paso 3 del flujo de evidencia** (M2-D1 §6): el investor recibe
// "Construction progress — stage verified" cuando el developer ancla. Sin esta
// pantalla el ciclo se demuestra a medias — el lado que le da valor al producto
// es justamente que el comprador se entere y pueda verificar.
//
// **El backend manda CLAVES, no copy** (regla 15 y M2-D4 §8.2): llega
// `titleKey` + `params` y acá se resuelve con el locale activo. Si el backend
// mandara la frase armada, el toggle de idioma no la tocaría.
//
// El filtro por categoría usa las mismas cinco del audit log: son los mismos
// eventos vistos desde el otro lado.

const CATEGORIAS = ['stage', 'document', 'release', 'signature', 'certificate'] as const
type NotifCategory = (typeof CATEGORIAS)[number]

const ICONO: Record<NotifCategory, LucideIcon> = {
  stage: ShieldCheck,
  document: FileText,
  release: FileCheck2,
  signature: Signature,
  certificate: ShieldCheck
}

/** De la categoría de notificación a la del borde de color (M2-D3). */
const BORDE: Record<NotifCategory, AuditCategory> = {
  stage: 'etapa',
  document: 'documento',
  release: 'liberacion',
  signature: 'firma',
  certificate: 'certificador'
}

export const Route = createFileRoute('/investor/notifications')({
  component: InvestorNotifications
})

function InvestorNotifications() {
  const { ready } = useRoleGuard(INVESTOR_ROLES)
  const { t, locale } = useTranslation()
  const queryClient = useQueryClient()
  const [filtro, setFiltro] = useState<NotifCategory | null>(null)

  const { data: notificaciones } = useQuery({
    queryKey: ['notifications', filtro],
    queryFn: () => api.listNotifications(filtro ? { category: filtro } : undefined),
    enabled: ready
  })

  const marcarLeida = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] })
  })

  if (!ready) return null

  return (
    <PanelLayout
      rol="investor"
      title={t('investor.notifications.title')}
      context={t('investor.notifications.context')}
    >
      <div className="-mx-s4 flex gap-s2 overflow-x-auto px-s4 pb-s1">
        <CategoryChip selected={filtro === null} onSelect={() => setFiltro(null)}>
          {t('developer.audit.all')}
        </CategoryChip>
        {CATEGORIAS.map((c) => (
          <CategoryChip key={c} selected={filtro === c} onSelect={() => setFiltro(c)}>
            {t(`audit.category.${BORDE[c]}` as never)}
          </CategoryChip>
        ))}
      </div>

      <section className="flex flex-col gap-s3" data-testid="INV-NOTIF-LIST-001">
        {notificaciones?.length ? (
          notificaciones.map((n) => {
            const categoria = n.category as NotifCategory
            return (
              <NotificationCard
                key={n.id}
                icon={ICONO[categoria] ?? Bell}
                // La clave del backend, resuelta con el locale de acá.
                title={t(n.titleKey as never) ?? n.titleKey}
                timestampLabel={formatRelative(String(n.createdAt), locale)}
                read={n.readAt !== null}
                readLabel={t('investor.notifications.read')}
                {...(filtro ? { category: BORDE[categoria] } : {})}
                onOpen={n.readAt === null ? () => marcarLeida.mutate(n.id) : undefined}
              />
            )
          })
        ) : (
          <p className="rounded-xl bg-card p-s4 text-body-sm text-text-muted shadow-e1">
            {t('investor.notifications.empty')}
          </p>
        )}
      </section>
    </PanelLayout>
  )
}
