import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { FileCheck2, FileClock, ShieldCheck } from 'lucide-react'
import { api } from '#/api/port'
import { evidenciaQueries, invalidaciones, invalidar } from '#/api/queries'
import { DocumentCard } from '#/components/domain/DocumentCard'
import { Loading } from '#/components/domain/Loading'
import { PrimaryButton } from '#/components/domain/PrimaryButton'
import { StatCard } from '#/components/domain/StatCard'
import { PanelLayout } from '#/components/PanelLayout'
import { formatDate } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL_EMPTY } from '#/lib/cardShell'

export const Route = createFileRoute('/developer/documentation')({
  component: DeveloperDocumentation
})

function DeveloperDocumentation() {
  const { t, locale } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: documentos, isPending } = useQuery(evidenciaQueries.delDeveloper())

  const anclar = useMutation({
    mutationFn: (evidenceId: string) => api.anchorDocument(evidenceId),
    onSuccess: () => invalidar(queryClient, invalidaciones.documentoAnclado())
  })

  const verificados = documentos?.filter((d) => d.txid !== null) ?? []
  const pendientes = documentos?.filter((d) => d.txid === null) ?? []

  const etiquetas = {
    verified: t('status.verified'),
    pending: t('status.pending'),
    view: t('document.view'),
    download: t('document.download'),
    copy: t('hash.copy'),
    copied: t('hash.copied'),
    hashLabel: t('hash.label')
  }

  return (
    <PanelLayout
      title={t('developer.docs.title')}
      context={t('developer.docs.context', { count: String(documentos?.length ?? 0) })}
      back={{
        label: t('nav.backToPanel'),
        onClick: () => void navigate({ to: '/developer' })
      }}
    >
      <section className="grid grid-cols-2 gap-s4">
        <StatCard
          value={String(verificados.length)}
          label={t('developer.docs.verifiedLabel')}
          icon={FileCheck2}
          tone="verification"
        />
        <StatCard
          value={String(pendientes.length)}
          label={t('developer.docs.pendingLabel')}
          icon={FileClock}
          tone="trend"
        />
      </section>

      <section className="flex flex-col gap-s2" data-testid="DEV-DOCS-LIST-001">
        <h2 className="flex items-center gap-s2 text-h2 font-bold text-text-primary">
          <ShieldCheck className="size-icon-stat text-verified" aria-hidden="true" />
          {t('developer.docs.verifiedSection')}
        </h2>

        {isPending ? (
          <Loading />
        ) : verificados.length ? (
          verificados.map((d) => (
            <DocumentCard
              key={d.id}
              filename={d.filename}
              uploadedAtLabel={formatDate(String(d.uploadedAt), locale)}
              format={d.category}
              sha256={d.sha256Hash}
              txid={d.txid}
              showHash
              labels={etiquetas}
            />
          ))
        ) : (
          <p className={CARD_SHELL_EMPTY}>{t('developer.docs.emptyVerified')}</p>
        )}
      </section>

      <section className="flex flex-col gap-s2">
        <h2 className="text-h2 font-bold text-text-primary">
          {t('developer.docs.pendingSection')}
        </h2>

        {isPending ? (
          <Loading />
        ) : pendientes.length ? (
          pendientes.map((d) => (
            <div key={d.id} className="flex flex-col gap-s2">
              <DocumentCard
                filename={d.filename}
                uploadedAtLabel={formatDate(String(d.uploadedAt), locale)}
                format={d.category}
                sha256={d.sha256Hash}
                txid={null}
                labels={etiquetas}
              />
              <PrimaryButton
                onClick={() => anclar.mutate(d.id)}
                disabled={anclar.isPending || !d.sha256Hash}
                loading={anclar.isPending}
                testId="DEV-DOC-ANCHOR-002"
              >
                {t('developer.docs.anchor')}
              </PrimaryButton>
            </div>
          ))
        ) : (
          <p className={CARD_SHELL_EMPTY}>{t('developer.docs.emptyPending')}</p>
        )}
      </section>
    </PanelLayout>
  )
}
