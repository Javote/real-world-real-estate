import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import { FileCheck2, FileText, ShieldCheck, Signature } from 'lucide-react'
import { useState } from 'react'
import { api } from '#/api/port'
import { INVESTOR_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import type { AuditCategory } from '#/components/domain/AuditEventCard'
import { CategoryChip } from '#/components/domain/Chips'
import { Loading } from '#/components/domain/Loading'
import { NotificationCard } from '#/components/domain/NotificationCard'
import { PanelLayout } from '#/components/PanelLayout'
import { formatRelative } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL_EMPTY } from '#/lib/cardShell'
import { reintentarSiNoEsAusencia } from '#/lib/investor'

// **M2-D5 fila 22 · `/investor/unit/:unitId/notifications`** — captura 22.
// Test IDs: INV-NOTIF-UNIT-001, INV-NOTIF-READ-002.

const CATEGORIAS = ['stage', 'document', 'release', 'signature', 'certificate'] as const
type NotifCategory = (typeof CATEGORIAS)[number]

const ICONO: Record<NotifCategory, LucideIcon> = {
  stage: ShieldCheck,
  document: FileText,
  release: FileCheck2,
  signature: Signature,
  certificate: ShieldCheck
}

const BORDE: Record<NotifCategory, AuditCategory> = {
  stage: 'etapa',
  document: 'documento',
  release: 'liberacion',
  signature: 'firma',
  certificate: 'certificador'
}

export const Route = createFileRoute('/investor/unit/$unitId/notifications')({
  component: InvestorUnitNotifications
})

function InvestorUnitNotifications() {
  const { unitId } = Route.useParams()
  const { ready } = useRoleGuard(INVESTOR_ROLES)
  const { t, tDinamico, locale } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filtro, setFiltro] = useState<NotifCategory | null>(null)

  const { data: unidad } = useQuery({
    queryKey: ['investor', 'unit', unitId],
    queryFn: () => api.getInvestorUnit(unitId),
    enabled: ready,
    retry: reintentarSiNoEsAusencia
  })

  const { data: notificaciones, isPending } = useQuery({
    queryKey: ['notifications', unitId, filtro],
    queryFn: () =>
      api.listNotifications({
        unitId,
        ...(filtro ? { category: filtro } : {})
      }),
    enabled: ready
  })

  const marcarLeida = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] })
  })

  if (!ready) return null

  const primeraSinLeer = notificaciones?.find((n) => n.readAt === null)?.id

  return (
    <PanelLayout
      rol="investor"
      title={t('investor.unit.notifications')}
      context={t('investor.unit.notificationsContext', {
        unit: unidad?.unitReference ?? ''
      })}
      back={{
        label: t('investor.unit.back'),
        onClick: () => void navigate({ to: '/investor/unit/$unitId', params: { unitId } })
      }}
    >
      <div className="-mx-s4 flex gap-s2 overflow-x-auto px-s4 pb-s1">
        <CategoryChip selected={filtro === null} onSelect={() => setFiltro(null)}>
          {t('developer.audit.all')}
        </CategoryChip>
        {CATEGORIAS.map((c) => (
          <CategoryChip key={c} selected={filtro === c} onSelect={() => setFiltro(c)}>
            {t(`audit.category.${BORDE[c]}`)}
          </CategoryChip>
        ))}
      </div>

      <section className="flex flex-col gap-s3" data-testid="INV-NOTIF-UNIT-001">
        {isPending ? (
          <Loading />
        ) : notificaciones?.length ? (
          notificaciones.map((n) => {
            const categoria = n.category
            return (
              <NotificationCard
                key={n.id}
                icon={ICONO[categoria]}
                title={tDinamico(n.titleKey, n.titleKey)}
                timestampLabel={formatRelative(String(n.createdAt), locale)}
                read={n.readAt !== null}
                readLabel={t('investor.notifications.read')}
                // Solo la PRIMERA sin leer: el ID marca la acción de marcar
                // leída, no cada fila. Repetido, deja de ser un selector.
                {...(n.id === primeraSinLeer ? { testId: 'INV-NOTIF-READ-002' } : {})}
                {...(filtro ? { category: BORDE[categoria] } : {})}
                onOpen={n.readAt === null ? () => marcarLeida.mutate(n.id) : undefined}
              />
            )
          })
        ) : (
          <p className={CARD_SHELL_EMPTY}>{t('investor.notifications.empty')}</p>
        )}
      </section>
    </PanelLayout>
  )
}
