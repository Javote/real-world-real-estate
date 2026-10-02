import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { FileText, Images } from 'lucide-react'
import { useState } from 'react'
import { ApiError, api } from '#/api/port'
import type { MerkleProof } from '#/api/types'
import { DocumentCard } from '#/components/domain/DocumentCard'
import { DocumentViewerModal } from '#/components/domain/DocumentViewerModal'
import { HashChip } from '#/components/domain/HashChip'
import { ImageGalleryModal } from '#/components/domain/ImageGalleryModal'
import { Loading } from '#/components/domain/Loading'
import { MerkleRootProof } from '#/components/domain/MerkleRootProof'
import { PrimaryButton } from '#/components/domain/PrimaryButton'
import { TxidModal } from '#/components/domain/TxidModal'
import { VerificationBadge } from '#/components/domain/VerificationBadge'
import { PanelLayout } from '#/components/PanelLayout'
import { Dialog, DialogContent, DialogTitle } from '#/components/ui/dialog'
import { formatDate, formatDateTime, formatMonthYear } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'
import { useObjectUrls } from '#/lib/blobUrls'
import {
  anclajeVigenteDelStage,
  esFoto,
  formatoArchivo,
  reintentarSiNoEsAusencia
} from '#/lib/investor'
import { bajarBlob } from '#/lib/stageProgress'

export const Route = createFileRoute('/project/$projectId/stage/$stageId')({
  component: InvestorStageDetail
})

function InvestorStageDetail() {
  const { projectId, stageId } = Route.useParams()
  const { t, locale } = useTranslation()
  const navigate = useNavigate()

  const [galeria, setGaleria] = useState(false)
  const [fotoInicial, setFotoInicial] = useState(0)
  const [docId, setDocId] = useState<string | null>(null)
  const [hito, setHito] = useState(false)
  const [prueba, setPrueba] = useState<MerkleProof | null>(null)
  const [txidModal, setTxidModal] = useState<{ txid: string; at: string; label: string } | null>(
    null
  )
  const objectUrl = useObjectUrls()

  const { data: stages } = useQuery({
    queryKey: ['project', projectId, 'stages'],
    queryFn: () => api.listProjectStages(projectId),
    retry: reintentarSiNoEsAusencia
  })

  const {
    data: stage,
    error,
    isPending
  } = useQuery({
    queryKey: ['project', projectId, 'stage', stageId],
    queryFn: () => api.getProjectStage(projectId, stageId),
    retry: reintentarSiNoEsAusencia
  })

  const { data: bundleFiles } = useQuery({
    queryKey: ['bundle', stage?.bundle?.id, 'files'],
    queryFn: () => api.getBundleFiles(stage!.bundle!.id),
    enabled: hito && Boolean(stage?.bundle?.id)
  })

  const { data: documentosDelProyecto } = useQuery({
    queryKey: ['project', projectId, 'documents'],
    queryFn: () => api.listProjectDocuments(projectId),
    retry: reintentarSiNoEsAusencia
  })

  const fotos = (stage?.evidences ?? []).filter((e) => esFoto(e.evidenceType, e.mimeType))
  const docs = (stage?.evidences ?? []).filter((e) => !esFoto(e.evidenceType, e.mimeType))

  const { data: urls } = useQuery({
    queryKey: ['stage-photos', stageId, fotos.map((f) => f.id).join(',')],
    queryFn: async () => {
      const pares = await Promise.all(
        fotos.map(async (f) => ({
          id: f.id,
          url: objectUrl(await api.downloadEvidence(f.id))
        }))
      )
      return Object.fromEntries(pares.map((p) => [p.id, p.url])) as Record<string, string>
    },
    gcTime: 0,
    enabled: fotos.length > 0
  })

  const docAbierto = docs.find((d) => d.id === docId)

  if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
    return (
      <PanelLayout title={t('investor.project.stages')}>
        <p data-testid="INV-STAGE-DETAIL-001">
          {error.status === 403 ? t('error.forbidden') : t('error.notFound')}
        </p>
      </PanelLayout>
    )
  }

  const txidDelStage = anclajeVigenteDelStage(stage?.events ?? [])?.txid ?? null

  const raizDelBundle = stage?.bundle?.commitmentHash ?? null
  const anclajeDelBundle = raizDelBundle
    ? stage?.events.find((e) => e.txid && e.commitment === raizDelBundle)
    : undefined
  const txidDelBundle = anclajeDelBundle?.txid ?? null

  const txidPorEvidencia = new Map(
    (documentosDelProyecto ?? []).map((d) => [d.id, d.txid] as const)
  )
  const txidDe = (evidenceId: string) => txidPorEvidencia.get(evidenceId) ?? null

  const hitoDelStage = stage?.bundle
    ? { name: stage.name, bundleId: stage.bundle.id, raiz: stage.bundle.commitmentHash }
    : null

  const total = stages?.length ?? 0
  const visibles = fotos.slice(0, 5)

  const etiquetasDoc = {
    verified: t('status.verified'),
    pending: t('status.pending'),
    view: t('document.view'),
    download: t('document.download'),
    copy: t('hash.copy'),
    copied: t('hash.copied'),
    hashLabel: t('hash.label')
  }

  const imagenes = fotos.flatMap((f) => {
    const url = urls?.[f.id]
    return url ? [{ url, alt: t('investor.stage.photos') }] : []
  })

  return (
    <PanelLayout
      title={stage?.name ?? t('investor.project.stages')}
      context={
        stage
          ? t('investor.stage.number', {
              number: String(stage.sequenceOrder),
              total: String(total || stage.sequenceOrder)
            })
          : undefined
      }
      back={{
        label: t('investor.stage.back'),
        onClick: () => void navigate({ to: '/project/$projectId/progress', params: { projectId } })
      }}
    >
      <section className="flex flex-col gap-s4" data-testid="INV-STAGE-DETAIL-001">
        <div className="flex flex-wrap items-center gap-s2">
          {stage?.certifiedAt ? (
            <span className="text-body-sm text-text-muted">
              {formatMonthYear(String(stage.certifiedAt), locale)}
            </span>
          ) : null}
          <VerificationBadge
            txid={txidDelStage}
            verifiedLabel={t('status.verified')}
            pendingLabel={t('status.pending')}
          />
        </div>

        {isPending ? <Loading /> : null}

        {isPending ? null : (
          <>
            <section className="flex flex-col gap-s3">
              <h2 className="flex items-center gap-s2 text-body font-bold text-text-primary">
                <Images className="size-icon-inline text-primary" aria-hidden="true" />
                {t('investor.stage.photos')}
              </h2>
              {fotos.length ? (
                <div className="grid grid-cols-2 gap-s2">
                  {visibles.map((f, i) => (
                    <button
                      key={f.id}
                      type="button"
                      className="overflow-hidden rounded-lg bg-surface-alt"
                      aria-label={t('investor.stage.photos')}
                      onClick={() => {
                        setFotoInicial(i)
                        setGaleria(true)
                      }}
                    >
                      {urls?.[f.id] ? (
                        <img
                          src={urls[f.id]}
                          alt={t('investor.stage.photos')}
                          className="aspect-square w-full object-cover"
                        />
                      ) : (
                        <span className="flex aspect-square items-center justify-center">
                          <Images className="size-icon-stat text-disabled" aria-hidden="true" />
                        </span>
                      )}
                    </button>
                  ))}
                  {fotos.length > 5 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setFotoInicial(5)
                        setGaleria(true)
                      }}
                      className="flex aspect-square flex-col items-center justify-center rounded-lg bg-surface-alt text-body font-bold text-text-primary"
                    >
                      {t('investor.stage.imagesCount', { count: String(fotos.length - 5) })}
                      <span className="text-caption font-medium text-text-muted">
                        {t('investor.stage.viewAll')}
                      </span>
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="text-body-sm text-text-muted">{t('investor.stage.noPhotos')}</p>
              )}
            </section>

            <section className="flex flex-col gap-s3">
              <h2 className="flex items-center gap-s2 text-body font-bold text-text-primary">
                <FileText className="size-icon-inline text-primary" aria-hidden="true" />
                {t('investor.stage.docs')}
              </h2>
              {docs.length ? (
                docs.map((d) => (
                  <DocumentCard
                    key={d.id}
                    filename={d.originalFilename}
                    uploadedAtLabel={formatDate(String(d.uploadedAt), locale)}
                    format={formatoArchivo(d.mimeType, d.category)}
                    sha256={d.sha256Hash}
                    txid={txidDe(d.id)}
                    showHash
                    labels={etiquetasDoc}
                    onView={() => setDocId(d.id)}
                    onDownload={
                      txidDe(d.id)
                        ? () =>
                            void api
                              .downloadEvidence(d.id)
                              .then((blob) => bajarBlob(blob, d.originalFilename))
                        : undefined
                    }
                  />
                ))
              ) : (
                <p className="text-body-sm text-text-muted">{t('investor.stage.noDocs')}</p>
              )}
            </section>
          </>
        )}

        {stage?.bundle ? (
          <PrimaryButton onClick={() => setHito(true)}>
            {t('investor.stage.openMilestone')}
          </PrimaryButton>
        ) : null}
      </section>

      <ImageGalleryModal
        open={galeria}
        onClose={() => setGaleria(false)}
        images={imagenes}
        initialIndex={fotoInicial}
        labels={{
          title: t('investor.stage.photos'),
          close: t('investor.gallery.close'),
          previous: t('investor.gallery.prev'),
          next: t('investor.gallery.next'),
          counter: (a, totalN) =>
            t('investor.unit.galleryCounter', { actual: String(a), total: String(totalN) })
        }}
      />

      <DocumentViewerModal
        open={Boolean(docAbierto)}
        onClose={() => setDocId(null)}
        testId="INV-STAGE-DOCVIEW-002"
        title={docAbierto?.category ?? t('investor.stage.docs')}
        filename={docAbierto?.originalFilename ?? ''}
        pageUrl=""
        dateLabel={docAbierto ? formatDate(String(docAbierto.uploadedAt), locale) : ''}
        txid={docAbierto ? txidDe(docAbierto.id) : null}
        onDownload={
          docAbierto && txidDe(docAbierto.id)
            ? () =>
                void api
                  .downloadEvidence(docAbierto.id)
                  .then((blob) => bajarBlob(blob, docAbierto.originalFilename))
            : undefined
        }
        labels={{
          verified: t('status.verified'),
          pending: t('status.pending'),
          download: t('document.download'),
          watermark: t('document.watermark')
        }}
      />

      {hitoDelStage ? (
        <Dialog
          open={hito}
          onOpenChange={() => {
            setHito(false)
            setPrueba(null)
          }}
        >
          <DialogContent data-testid="INV-STAGE-MILESTONE-001">
            <DialogTitle className="text-h2 font-bold text-text-primary">
              {hitoDelStage.name}
            </DialogTitle>
            <p className="text-body-sm text-text-muted">{t('investor.stage.verifiedDocs')}</p>
            {(bundleFiles?.files ?? []).map((f) => (
              <div
                key={f.sha256Hash}
                className="flex flex-col gap-s1 rounded-lg bg-surface-alt p-s3"
              >
                <span className="truncate text-body font-medium text-text-primary">
                  {f.filename ?? f.sha256Hash}
                </span>
                <VerificationBadge
                  txid={txidDelBundle}
                  verifiedLabel={t('status.verified')}
                  pendingLabel={t('status.pending')}
                />
                <HashChip
                  hash={f.sha256Hash}
                  copyLabel={t('hash.copy')}
                  copiedLabel={t('hash.copied')}
                />
              </div>
            ))}
            <MerkleRootProof
              testId="INV-MERKLE-PROOF-002"
              merkleRoot={bundleFiles?.merkleRoot ?? hitoDelStage.raiz}
              txid={txidDelBundle}
              archivos={(bundleFiles?.files ?? []).map((f) => ({
                id: f.sha256Hash,
                nombre: f.filename ?? f.sha256Hash,
                sha256: f.sha256Hash
              }))}
              onOpenTxid={
                txidDelBundle && anclajeDelBundle
                  ? () =>
                      setTxidModal({
                        txid: txidDelBundle,
                        at: String(anclajeDelBundle.createdAt),
                        label: hitoDelStage.name
                      })
                  : undefined
              }
              onOpenArchivo={(archivo) => {
                void api.getMerkleProof(hitoDelStage.bundleId, archivo.sha256).then(setPrueba)
              }}
              labels={{
                rootLabel: t('merkle.root'),
                txidLabel: t('hash.txidLabel'),
                filesLabel: t('merkle.files'),
                pending: t('status.pending'),
                pendingRoot: t('merkle.pendingRoot'),
                copy: t('hash.copy'),
                copied: t('hash.copied')
              }}
            />
            {prueba?.proof.length ? (
              <div className="flex flex-col gap-s2">
                <span className="text-label font-bold uppercase text-text-muted">
                  {t('merkle.proofPath')}
                </span>
                {prueba.proof.map((paso, i) => (
                  <HashChip
                    key={`${paso.sibling}-${i}`}
                    hash={paso.sibling}
                    copyLabel={t('hash.copy')}
                    copiedLabel={t('hash.copied')}
                  />
                ))}
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}

      {txidModal ? (
        <TxidModal
          open
          onClose={() => setTxidModal(null)}
          label={txidModal.label}
          anchoredAt={txidModal.at}
          txid={txidModal.txid}
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
