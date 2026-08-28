import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { FileCheck2, FileClock, ShieldCheck } from 'lucide-react'
import { api } from '#/api/port'
import { DEV_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { DocumentCard } from '#/components/domain/DocumentCard'
import { PrimaryButton } from '#/components/domain/PrimaryButton'
import { StatCard } from '#/components/domain/StatCard'
import { PanelLayout } from '#/components/PanelLayout'
import { formatDate } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'

// **M2-D5 filas 46-47 · `/developer/documentation`** — capturas 46 y 47.
// Endpoints: GET /developer/documents · POST /developer/documents (anclar).
// Test IDs: DEV-DOCS-LIST-001, DEV-DOC-ANCHOR-002. Patrones: P1, P2.
//
// **El corte en dos secciones no es de presentación: es la regla 17.** Un
// documento está en "Verificados" si y solo si tiene TXID. Con hash pero sin
// anclaje confirmado va a "Pendientes", nunca a la de arriba (D-027 y M2-D4
// §6.2). Por eso el filtro es `txid !== null` y no un campo de estado: el
// `DocumentCard` deriva el pill del mismo dato, así que no pueden discrepar.
//
// **El hash va truncado 6+4, contra lo que dice M2-D1.** El Screen Tree pide
// "full hash chips per document", pero M2-D4 es normativo para todo lo que
// muestre un hash (CLAUDE.md §Antes de empezar una superficie) y ahí la regla
// no admite lectura: *"Never display the full untruncated hex inline — only in
// the verification modal"*, con la jerarquía de profundidad repitiéndolo
// (§190-191: depth 2 son 6+4, el hash completo es depth 3). La captura muestra
// el hash largo desbordando la card, que es la maqueta incumpliendo su propio
// patrón. `HashChip` recibe el hash COMPLETO igual (regla 16) y lo copia
// entero: la truncación es solo visual.
//
// **El chip no abre modal acá.** La fila 46-47 lista P1 y P2, no P3, así que
// `DocumentCard` va sin `onOpenProof` y el chip queda en lectura + copia.

export const Route = createFileRoute('/developer/documentation')({
  component: DeveloperDocumentation
})

function DeveloperDocumentation() {
  const { ready } = useRoleGuard(DEV_ROLES)
  const { t, locale } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: documentos } = useQuery({
    queryKey: ['developer', 'documents'],
    queryFn: () => api.listDeveloperDocuments(),
    enabled: ready
  })

  const anclar = useMutation({
    mutationFn: (evidenceId: string) => api.anchorDocument(evidenceId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['developer', 'documents'] })
  })

  if (!ready) return null

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
      rol="developer"
      title={t('developer.docs.title')}
      context={t('developer.docs.context', { count: String(documentos?.length ?? 0) })}
      back={{
        label: t('nav.backToPanel'),
        onClick: () => void navigate({ to: '/developer' })
      }}
      hideBrand
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
          <ShieldCheck className="size-icon-md text-verified" aria-hidden="true" />
          {t('developer.docs.verifiedSection')}
        </h2>

        {verificados.length ? (
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
          <p className="rounded-xl bg-card p-s4 text-body-sm text-text-muted shadow-e1">
            {t('developer.docs.emptyVerified')}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-s2">
        <h2 className="text-h2 font-bold text-text-primary">
          {t('developer.docs.pendingSection')}
        </h2>

        {pendientes.length ? (
          pendientes.map((d) => (
            <div key={d.id} className="flex flex-col gap-s2">
              <DocumentCard
                filename={d.filename}
                uploadedAtLabel={formatDate(String(d.uploadedAt), locale)}
                format={d.category}
                sha256={d.sha256Hash}
                // Sin TXID: el pill dice "Pendiente" porque el componente lo
                // deriva de este mismo `null`, no de un flag aparte.
                txid={null}
                labels={etiquetas}
              />
              {/* **El anclaje lo inicia el usuario, siempre.** Un documento con
                  hash es candidato a la cadena de prueba (D-027), pero anclarlo
                  solo al abrir la pantalla sería una escritura on-chain que
                  nadie pidió. */}
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
          <p className="rounded-xl bg-card p-s4 text-body-sm text-text-muted shadow-e1">
            {t('developer.docs.emptyPending')}
          </p>
        )}
      </section>
    </PanelLayout>
  )
}
