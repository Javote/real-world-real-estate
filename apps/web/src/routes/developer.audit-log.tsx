import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { auditoriaQueries } from '#/api/queries'
import {
  type ActorRole,
  type AuditCategory,
  AuditEventCard
} from '#/components/domain/AuditEventCard'
import { CategoryChip } from '#/components/domain/Chips'
import { Loading } from '#/components/domain/Loading'
import { TxidModal } from '#/components/domain/TxidModal'
import { PanelLayout } from '#/components/PanelLayout'
import { formatDateTime } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL_EMPTY } from '#/lib/cardShell'

const CATEGORIAS: readonly AuditCategory[] = [
  'etapa',
  'certificador',
  'firma',
  'liberacion',
  'documento'
]

function categoriaDe(action: string): AuditCategory {
  if (action.includes('CERTIFY')) return 'certificador'
  if (action.includes('SIGN') || action.includes('DOSSIER')) return 'firma'
  if (action.includes('RELEASE')) return 'liberacion'
  if (action.includes('EVIDENCE') || action.includes('DOCUMENT')) return 'documento'
  return 'etapa'
}

function rolDe(role: string | null): ActorRole {
  if (role === 'verifier') return 'certifier'
  if (role === 'notary') return 'notary'
  if (role === 'buyer') return 'investor'
  return 'developer'
}

export const Route = createFileRoute('/developer/audit-log')({ component: AuditLog })

function AuditLog() {
  const { t, locale } = useTranslation()
  const navigate = useNavigate()
  const [filtro, setFiltro] = useState<AuditCategory | null>(null)
  const [verTxid, setVerTxid] = useState<{ txid: string; label: string; at: string } | null>(null)

  const { data, isPending } = useQuery(auditoriaQueries.lista())

  const eventos = (data?.items ?? []).filter(
    (e) => filtro === null || categoriaDe(e.action) === filtro
  )

  return (
    <PanelLayout
      title={t('developer.audit.title')}
      context={t('developer.audit.context')}
      back={{
        label: t('nav.back'),
        onClick: () => void navigate({ to: '/developer' })
      }}
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
            {t(`audit.category.${c}`)}
          </CategoryChip>
        ))}
      </div>

      <section className="flex flex-col gap-s3" data-testid="DEV-AUDIT-LIST-001">
        <h2 className="sr-only">{t('developer.audit.context')}</h2>
        {isPending ? (
          <Loading />
        ) : eventos.length ? (
          eventos.map((e) => {
            const txid = e.metadataJson
              ? ((JSON.parse(e.metadataJson) as { txid?: string | null }).txid ?? null)
              : null
            const categoria = categoriaDe(e.action)

            return (
              <AuditEventCard
                key={e.id}
                timestampLabel={formatDateTime(e.createdAt, locale)}
                title={t(`audit.action.${e.action}`) ?? e.action}
                category={{ key: categoria, label: t(`audit.category.${categoria}`) }}
                actor={{
                  role: rolDe(e.actorRole),
                  roleLabel: t(`role.${e.actorRole ?? 'developer'}`),
                  name: e.actorName ?? t('developer.audit.system')
                }}
                txid={txid}
                labels={{ copy: t('hash.copy'), copied: t('hash.copied') }}
                onOpenProof={
                  txid
                    ? () =>
                        setVerTxid({
                          txid,
                          label: t(`audit.action.${e.action}`) ?? e.action,
                          at: e.createdAt
                        })
                    : undefined
                }
              />
            )
          })
        ) : (
          <p className={CARD_SHELL_EMPTY}>{t('developer.audit.empty')}</p>
        )}
      </section>

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
