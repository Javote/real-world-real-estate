import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { api } from '#/api/port'
import { DEV_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import {
  type ActorRole,
  type AuditCategory,
  AuditEventCard
} from '#/components/domain/AuditEventCard'
import { CategoryChip } from '#/components/domain/Chips'
import { TxidModal } from '#/components/domain/TxidModal'
import { PanelLayout } from '#/components/PanelLayout'
import { formatDateTime } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'

// **M2-D5 filas 49 y 50 · `/developer/audit-log`** — captura 49.
// Test IDs: DEV-AUDIT-LIST-001, DEV-AUDIT-FILTER-002, DEV-AUDIT-VERIFY-001.
// Patrones: P6 y P3.
//
// **Es el paso 7 del flujo de evidencia** (M2-D1 §6): el ciclo entero —subida,
// certificación— queda indexado acá con sus TXIDs.
//
// **Append-only** (M2-D4 P6): los eventos no se editan ni se borran. Por eso
// esta pantalla solo lee y su único gesto es abrir el `TxidModal`, que nunca se
// abre solo (M2-D4 §6.3).

/** Las cinco categorías del filtro, textuales de M2-D3 §AuditEventCard. */
const CATEGORIAS: readonly AuditCategory[] = [
  'etapa',
  'certificador',
  'firma',
  'liberacion',
  'documento'
]

/**
 * De la acción del `AuditLog` a la categoría de la pill.
 *
 * El backend guarda la acción en crudo (`CREATE_EVIDENCE`, `CERTIFY_STAGE`) y
 * el mapeo a las cinco categorías del entregable es de presentación. Vive acá y
 * no en la API porque es vocabulario de M2-D3, no del dominio.
 */
function categoriaDe(action: string): AuditCategory {
  if (action.includes('CERTIFY')) return 'certificador'
  if (action.includes('SIGN') || action.includes('DOSSIER')) return 'firma'
  if (action.includes('RELEASE')) return 'liberacion'
  if (action.includes('EVIDENCE') || action.includes('DOCUMENT')) return 'documento'
  return 'etapa'
}

/** El rol del actor viene del `User`; `buyer`/`verifier` son los del dominio. */
function rolDe(role: string | null): ActorRole {
  if (role === 'verifier') return 'certifier'
  if (role === 'notary') return 'notary'
  if (role === 'buyer') return 'investor'
  return 'developer'
}

export const Route = createFileRoute('/developer/audit-log')({ component: AuditLog })

function AuditLog() {
  const { ready } = useRoleGuard(DEV_ROLES)
  const { t, locale } = useTranslation()
  const [filtro, setFiltro] = useState<AuditCategory | null>(null)
  const [verTxid, setVerTxid] = useState<{ txid: string; label: string; at: string } | null>(null)

  const { data } = useQuery({
    queryKey: ['developer', 'audit-log'],
    queryFn: () => api.listAuditLog(),
    enabled: ready
  })

  if (!ready) return null

  // El filtro es del cliente: el endpoint filtra por `entityType` y las
  // categorías de M2-D3 no son entidades. Con paginación por cursor esto se
  // mueve al servidor, y ahí sí hace falta que el mapeo viva de aquel lado.
  const eventos = (data?.items ?? []).filter(
    (e) => filtro === null || categoriaDe(e.action) === filtro
  )

  return (
    <PanelLayout
      rol="developer"
      title={t('developer.audit.title')}
      context={t('developer.audit.context')}
    >
      <div
        className="-mx-s4 flex gap-s2 overflow-x-auto px-s4 pb-s1"
        data-testid="DEV-AUDIT-FILTER-002"
      >
        <CategoryChip selected={filtro === null} onSelect={() => setFiltro(null)}>
          {t('developer.audit.all')}
        </CategoryChip>
        {CATEGORIAS.map((c) => (
          <CategoryChip key={c} selected={filtro === c} onSelect={() => setFiltro(c)}>
            {t(`audit.category.${c}` as never)}
          </CategoryChip>
        ))}
      </div>

      <section className="flex flex-col gap-s3" data-testid="DEV-AUDIT-LIST-001">
        {eventos.length ? (
          eventos.map((e) => {
            const txid = e.metadataJson
              ? ((JSON.parse(e.metadataJson) as { txid?: string | null }).txid ?? null)
              : null
            const categoria = categoriaDe(e.action)

            return (
              <AuditEventCard
                key={e.id}
                timestampLabel={formatDateTime(e.createdAt, locale)}
                title={t(`audit.action.${e.action}` as never) ?? e.action}
                category={{ key: categoria, label: t(`audit.category.${categoria}` as never) }}
                actor={{
                  role: rolDe(e.actorRole),
                  roleLabel: t(`role.${e.actorRole ?? 'developer'}` as never),
                  name: e.actorName ?? t('developer.audit.system')
                }}
                txid={txid}
                labels={{ copy: t('hash.copy'), copied: t('hash.copied') }}
                onOpenProof={
                  txid
                    ? () =>
                        setVerTxid({
                          txid,
                          label: t(`audit.action.${e.action}` as never) ?? e.action,
                          at: e.createdAt
                        })
                    : undefined
                }
              />
            )
          })
        ) : (
          <p className="rounded-xl bg-card p-s4 text-body-sm text-text-muted shadow-e1">
            {t('developer.audit.empty')}
          </p>
        )}
      </section>

      {/* **Solo se monta cuando hay TXID que mostrar.** `TxidModal` formatea
          la fecha en su cuerpo, así que corre en cada render aunque esté
          cerrado: con la cadena vacía, `Intl` tira "Invalid time value" y se
          lleva puesta la pantalla entera. Y además nunca se abre solo
          (M2-D4 §6.3), así que montarlo cerrado no aporta nada. */}
      {verTxid ? (
        <TxidModal
          open
          testId="DEV-AUDIT-VERIFY-001"
          onClose={() => setVerTxid(null)}
          label={verTxid.label}
          anchoredAt={verTxid.at}
          txid={verTxid.txid}
          formatDateTime={(iso) => formatDateTime(iso, locale)}
          labels={{
            title: t('txidModal.title'),
            anchoredAtLabel: t('txidModal.anchoredAt'),
            txidLabel: t('hash.txidLabel'),
            openExplorer: t('txidModal.openExplorer'),
            copy: t('hash.copy'),
            copied: t('hash.copied')
          }}
        />
      ) : null}
    </PanelLayout>
  )
}
