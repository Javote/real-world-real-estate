import { useQueries, useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Building2, ChevronRight, FileText, Images, MapPin } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ApiError, api } from '#/api/port'
import type { MerkleProof } from '#/api/types'
import { INVESTOR_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { BuildingSchematic } from '#/components/domain/BuildingSchematic'
import { HashChip } from '#/components/domain/HashChip'
import { ImageGalleryModal } from '#/components/domain/ImageGalleryModal'
import { LocationMapModal } from '#/components/domain/LocationMapModal'
import { MerkleRootProof } from '#/components/domain/MerkleRootProof'
import { PrimaryButton } from '#/components/domain/PrimaryButton'
import { ProgressTimeline } from '#/components/domain/ProgressTimeline'
import { StageChips } from '#/components/domain/StageChips'
import { PanelLayout } from '#/components/PanelLayout'
import { Dialog, DialogContent, DialogTitle } from '#/components/ui/dialog'
import { formatCurrency, formatMonthYear, formatRelative } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'
import { useAnnounce } from '#/lib/announce'
import { useObjectUrls } from '#/lib/blobUrls'
import {
  claveEstadoStage,
  claveNovedad,
  confirmacionesNuevas,
  esFoto,
  intervaloDeNovedades,
  reintentarSiNoEsAusencia,
  unicosPorStageId
} from '#/lib/investor'
import { avanceDeStages, timelineDeStages } from '#/lib/stageProgress'

// **M2-D5 filas 15-18, 19, 20, 21, 25m · `/investor/unit/:unitId`**
// Test IDs: INV-UNIT-DETAIL-001, INV-UNIT-NEWS-002, INV-UNIT-GALLERY-001,
// INV-UNIT-LOC-001, INV-UNIT-BUILDING-001. P9 (+ P5 en el hito).

export const Route = createFileRoute('/investor/unit/$unitId/')({
  component: InvestorUnitDetail
})

function InvestorUnitDetail() {
  const { unitId } = Route.useParams()
  const { ready } = useRoleGuard(INVESTOR_ROLES)
  const { t, locale } = useTranslation()
  const navigate = useNavigate()
  const announce = useAnnounce()

  const [galeria, setGaleria] = useState(false)
  const [mapa, setMapa] = useState(false)
  const [edificio, setEdificio] = useState(false)
  const [bundleId, setBundleId] = useState<string | null>(null)
  const [prueba, setPrueba] = useState<MerkleProof | null>(null)
  const objectUrl = useObjectUrls()

  const { data: unidad, error } = useQuery({
    queryKey: ['investor', 'unit', unitId],
    queryFn: () => api.getInvestorUnit(unitId),
    enabled: ready,
    retry: reintentarSiNoEsAusencia
  })

  const { data: news } = useQuery({
    queryKey: ['investor', 'unit', unitId, 'news'],
    queryFn: () => api.getInvestorUnitNews(unitId),
    enabled: ready && Boolean(unidad),
    retry: reintentarSiNoEsAusencia,
    refetchInterval: (query) => intervaloDeNovedades(query.state.data),
    // Sin esto, cambiar de pestaña pausa el poll (default de la librería) y la
    // confirmación vuelve a depender de que el investor esté mirando esta
    // pantalla en el instante exacto en que entra al bloque — la misma espera
    // que el fix existe para evitar.
    refetchIntervalInBackground: true
  })

  // SPEC-104 (F-03): el poll de arriba puede confirmar una novedad con la
  // pestaña en background — se anuncia recién cuando vuelve el foco (el
  // efecto corre igual, pero el lector de pantalla no lee nada sin foco) y
  // agregado, no un anuncio por evento: `refetchIntervalInBackground` puede
  // acumular varias confirmaciones entre dos renders.
  const noticiasPrevias = useRef<{ id: string; status: string | null }[]>([])
  useEffect(() => {
    if (!news) return
    const nuevas = confirmacionesNuevas(noticiasPrevias.current, news)
    if (nuevas > 0) announce(t('investor.unit.newsConfirmed', { count: String(nuevas) }))
    noticiasPrevias.current = news
  }, [news, announce, t])

  const { data: proyecto } = useQuery({
    queryKey: ['project', unidad?.projectId],
    queryFn: () => api.getProject(unidad!.projectId),
    enabled: ready && Boolean(unidad?.projectId),
    retry: reintentarSiNoEsAusencia
  })

  const { data: documentos } = useQuery({
    queryKey: ['project', unidad?.projectId, 'documents'],
    queryFn: () => api.listProjectDocuments(unidad!.projectId),
    enabled: ready && Boolean(unidad?.projectId),
    retry: reintentarSiNoEsAusencia
  })

  const { data: contrato } = useQuery({
    queryKey: ['investor', 'contract', unitId],
    queryFn: () => api.getInvestorContract(unitId),
    enabled: ready && Boolean(unidad),
    retry: reintentarSiNoEsAusencia
  })

  const { data: schematic } = useQuery({
    queryKey: ['project', unidad?.projectId, 'schematic'],
    queryFn: () => api.getBuildingSchematic(unidad!.projectId),
    enabled: ready && edificio && Boolean(unidad?.projectId)
  })

  const { data: bundleFiles } = useQuery({
    queryKey: ['bundle', bundleId, 'files'],
    queryFn: () => api.getBundleFiles(bundleId!),
    enabled: Boolean(bundleId)
  })

  const fotos = (documentos ?? []).filter((d) => esFoto(d.evidenceType, d.mimeType))
  const blobs = useQueries({
    queries: fotos.map((f, i) => ({
      queryKey: ['evidence-blob', f.id],
      queryFn: async () => objectUrl(await api.downloadEvidence(f.id)),
      // `gcTime: 0`: la URL se revoca al desmontar, así que la caché no puede
      // sobrevivirle — devolvería una URL muerta al volver a la pantalla.
      gcTime: 0,
      enabled: ready && Boolean(unidad) && (galeria || i === 0)
    }))
  })
  const imagenes = fotos.flatMap((_f, i) => {
    const url = blobs[i]?.data
    return url ? [{ url, alt: t('investor.unit.gallery') }] : []
  })

  if (!ready) return null

  if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
    return (
      <PanelLayout rol="investor" title={t('investor.units.title')}>
        <p data-testid="INV-UNIT-DETAIL-001">
          {error.status === 403 ? t('error.forbidden') : t('error.notFound')}
        </p>
      </PanelLayout>
    )
  }

  const stages = unicosPorStageId(unidad?.stages ?? [])
  const timeline = timelineDeStages(stages)
  const actual = timeline.find((s) => s.state === 'current')
  const avance = avanceDeStages(stages)
  const ubicacion = [unidad?.city, unidad?.country].filter(Boolean).join(', ')
  const portada = imagenes[0]?.url
  const tienePisos = (schematic ?? []).some((p) => p.floor != null) || unidad?.floor != null
  const stageDelBundle = stages.find((s) => s.bundleId === bundleId)

  const unidadesEsquema = (schematic ?? []).flatMap((piso) =>
    piso.floor == null
      ? []
      : piso.units
          .filter((u) => u.floor != null)
          .map((u) => ({
            id: u.id,
            unitReference: u.unitReference,
            floor: u.floor as number,
            state:
              u.id === unitId
                ? ('mine' as const)
                : u.status === 'available'
                  ? ('available' as const)
                  : ('occupied' as const)
          }))
  )

  return (
    <PanelLayout
      rol="investor"
      title={unidad?.unitReference ?? t('investor.units.title')}
      {...(unidad ? { context: unidad.projectName } : {})}
      back={{
        label: t('investor.unit.back'),
        onClick: () => void navigate({ to: '/investor/units' })
      }}
    >
      <section className="flex flex-col gap-s4" data-testid="INV-UNIT-DETAIL-001">
        <div className="grid grid-cols-2 gap-s3">
          <button
            type="button"
            onClick={() => setGaleria(true)}
            // SPEC-105 (F-12): sin fotos no hay nada que abrir — `disabled`,
            // no un handler que no hace nada. El usuario tiene que poder
            // distinguir "no hay nada" de "no anduvo".
            disabled={fotos.length === 0}
            className="relative overflow-hidden rounded-xl bg-surface-alt disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={t('investor.unit.openGallery')}
          >
            {portada ? (
              <img src={portada} alt="" className="aspect-video w-full object-cover" />
            ) : (
              <span className="flex aspect-video items-center justify-center text-disabled">
                <Building2 size={28} aria-hidden="true" />
              </span>
            )}
            {fotos.length ? (
              <span className="absolute bottom-s2 left-s2 rounded-full bg-black/50 px-s3 py-s1 text-caption text-white">
                {t('investor.unit.photosCount', { count: String(fotos.length) })}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setMapa(true)}
            // SPEC-105 (F-12): sin coordenadas no hay mapa que abrir.
            disabled={proyecto?.latitude == null || proyecto?.longitude == null}
            className="overflow-hidden rounded-xl bg-card text-left shadow-e1 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={t('investor.unit.openMap')}
          >
            <span className="flex aspect-video items-center justify-center bg-surface-alt text-primary">
              <MapPin className="size-icon-stat" aria-hidden="true" />
            </span>
            {ubicacion ? (
              <span className="block truncate px-s3 py-s2 text-caption text-text-muted">
                {ubicacion}
              </span>
            ) : null}
          </button>
        </div>

        {tienePisos ? (
          <PrimaryButton onClick={() => setEdificio(true)}>
            <Building2 className="size-icon-inline" aria-hidden="true" />
            {t('investor.unit.building')}
          </PrimaryButton>
        ) : null}

        <article className="flex flex-col gap-s3 rounded-xl bg-card p-s4 shadow-e1">
          <h2 className="text-body font-bold text-text-primary">{t('investor.unit.details')}</h2>
          <dl className="flex flex-col gap-s2 text-body-sm">
            <div className="flex justify-between gap-s2">
              <dt className="text-text-muted">{t('investor.unit.project')}</dt>
              <dd className="font-bold text-text-primary">{unidad?.projectName}</dd>
            </div>
            <div className="flex justify-between gap-s2">
              <dt className="text-text-muted">{t('investor.unit.unit')}</dt>
              <dd className="font-bold text-text-primary">{unidad?.unitReference}</dd>
            </div>
            {unidad?.floor != null ? (
              <div className="flex justify-between gap-s2">
                <dt className="text-text-muted">{t('investor.unit.floor')}</dt>
                <dd className="font-bold text-text-primary">{unidad.floor}</dd>
              </div>
            ) : null}
            {unidad?.sizeM2 != null ? (
              <div className="flex justify-between gap-s2">
                <dt className="text-text-muted">{t('investor.unit.surface')}</dt>
                <dd className="font-bold text-text-primary">
                  {t('investor.unit.m2', { size: String(unidad.sizeM2) })}
                </dd>
              </div>
            ) : null}
            {unidad?.priceMinorUnits != null && unidad.currency ? (
              <div className="flex justify-between gap-s2">
                <dt className="text-text-muted">{t('investor.unit.investment')}</dt>
                <dd className="font-bold text-text-primary">
                  {formatCurrency(unidad.priceMinorUnits, unidad.currency, locale)}
                </dd>
              </div>
            ) : null}
            {unidad?.status ? (
              <div className="flex justify-between gap-s2">
                <dt className="text-text-muted">{t('investor.unit.status')}</dt>
                <dd className="font-bold text-text-primary">{t(`unitStatus.${unidad.status}`)}</dd>
              </div>
            ) : null}
            {proyecto?.estimatedDelivery ? (
              <div className="flex justify-between gap-s2">
                <dt className="text-text-muted">{t('investor.unit.delivery')}</dt>
                <dd className="font-bold text-text-primary">
                  {formatMonthYear(String(proyecto.estimatedDelivery), locale)}
                </dd>
              </div>
            ) : null}
            {ubicacion ? (
              <div className="flex justify-between gap-s2">
                <dt className="text-text-muted">{t('investor.unit.location')}</dt>
                <dd className="font-bold text-text-primary">{ubicacion}</dd>
              </div>
            ) : null}
          </dl>
        </article>

        <article className="flex flex-col gap-s3 rounded-xl bg-card p-s4 shadow-e1">
          <h2 className="text-body font-bold text-text-primary">{t('investor.unit.progress')}</h2>
          {actual ? (
            <p className="text-body-sm text-text-secondary">
              {t('investor.unit.currentStage', {
                name: actual.name,
                percent: String(avance)
              })}
            </p>
          ) : null}
          <ProgressTimeline
            stages={timeline}
            ariaLabel={t('investor.project.timelineAria')}
            finalizationLabel={
              proyecto?.estimatedDelivery
                ? t('investor.project.delivery', {
                    date: formatMonthYear(String(proyecto.estimatedDelivery), locale)
                  })
                : undefined
            }
          />
        </article>

        <article className="flex flex-col gap-s3 rounded-xl bg-card p-s4 shadow-e1">
          <h2 className="text-body font-bold text-text-primary">{t('investor.unit.news')}</h2>
          <div className="flex flex-col gap-s2" data-testid="INV-UNIT-NEWS-002">
            {news?.length ? (
              news.slice(0, 3).map((n) => (
                <div key={n.id} className="flex items-center gap-s3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-light text-primary">
                    <Images className="size-icon-inline" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-sm text-text-primary">
                      {t(claveNovedad(n.eventType), {
                        stage: n.stageName ?? '',
                        state: n.toState ? t(claveEstadoStage(n.toState)) : ''
                      })}
                    </span>
                    <span className="text-caption text-text-muted">
                      {formatRelative(String(n.createdAt), locale)}
                    </span>
                  </span>
                </div>
              ))
            ) : (
              <p className="text-body-sm text-text-muted">{t('investor.unit.newsEmpty')}</p>
            )}
          </div>
          <button
            type="button"
            className="self-start text-body-sm font-medium text-primary"
            onClick={() =>
              void navigate({
                to: '/investor/unit/$unitId/notifications',
                params: { unitId }
              })
            }
          >
            {t('investor.unit.viewAllNews')}
          </button>
        </article>

        <article className="flex flex-col gap-s3 rounded-xl bg-card p-s4 shadow-e1">
          <h2 className="text-body font-bold text-text-primary">{t('investor.unit.contract')}</h2>
          {contrato ? (
            <p className="text-body-sm text-text-secondary">
              {t('investor.unit.contractAmount', {
                amount: formatCurrency(contrato.totalMinorUnits, contrato.currency, locale)
              })}
            </p>
          ) : null}
          <PrimaryButton
            onClick={() =>
              void navigate({ to: '/investor/unit/$unitId/contract', params: { unitId } })
            }
          >
            <FileText className="size-icon-inline" aria-hidden="true" />
            {t('investor.unit.viewContract')}
          </PrimaryButton>
        </article>

        <article className="flex flex-col gap-s3 rounded-xl bg-card p-s4 shadow-e1">
          <h2 className="text-body font-bold text-text-primary">
            {t('investor.unit.evidenceByStage')}
          </h2>
          <p className="text-caption text-text-muted">{t('investor.unit.tapMilestone')}</p>
          <StageChips
            ariaLabel={t('investor.unit.stagesAria')}
            stages={stages.map((s) => ({
              number: s.sequenceOrder,
              anchored: Boolean(s.txid),
              bundleId: s.bundleId ?? undefined
            }))}
            onOpenStage={(chip) => {
              if (chip.bundleId) {
                setPrueba(null)
                setBundleId(chip.bundleId)
              }
            }}
          />
        </article>

        <button
          type="button"
          className="flex items-center justify-between rounded-xl bg-card p-s4 text-left shadow-e1"
          onClick={() =>
            void navigate({ to: '/investor/unit/$unitId/dossier', params: { unitId } })
          }
        >
          <span className="text-body font-medium text-text-primary">
            {t('investor.unit.dossier')}
          </span>
          <ChevronRight className="size-icon-inline text-text-muted" aria-hidden="true" />
        </button>
      </section>

      <ImageGalleryModal
        open={galeria}
        onClose={() => setGaleria(false)}
        images={imagenes}
        testId="INV-UNIT-GALLERY-001"
        labels={{
          title: t('investor.unit.gallery'),
          close: t('investor.gallery.close'),
          previous: t('investor.gallery.prev'),
          next: t('investor.gallery.next'),
          counter: (a, totalN) =>
            t('investor.unit.galleryCounter', { actual: String(a), total: String(totalN) })
        }}
      />

      {proyecto?.latitude != null && proyecto.longitude != null ? (
        <LocationMapModal
          open={mapa}
          onClose={() => setMapa(false)}
          testId="INV-UNIT-LOC-001"
          latitude={proyecto.latitude}
          longitude={proyecto.longitude}
          addressLabel={ubicacion || undefined}
          labels={{
            title: t('investor.unit.location'),
            close: t('map.close'),
            marker: t('map.marker')
          }}
        />
      ) : null}

      <Dialog open={edificio} onOpenChange={(abierto) => !abierto && setEdificio(false)}>
        <DialogContent data-testid="INV-UNIT-BUILDING-001" className="max-w-lg">
          <DialogTitle className="text-h2 font-bold text-text-primary">
            {t('schematic.title')}
          </DialogTitle>
          {unidadesEsquema.length ? (
            <BuildingSchematic
              projectName={unidad?.projectName ?? ''}
              units={unidadesEsquema}
              labels={{
                title: t('schematic.title'),
                available: t('schematic.available'),
                occupied: t('schematic.occupied'),
                mine: t('schematic.mine'),
                access: t('schematic.access'),
                floorPrefix: t('schematic.floorPrefix'),
                callout:
                  unidad?.floor != null
                    ? t('schematic.callout', {
                        floor: String(unidad.floor),
                        unit: unidad.unitReference,
                        size:
                          unidad.sizeM2 != null
                            ? t('investor.unit.m2', { size: String(unidad.sizeM2) })
                            : ''
                      })
                    : undefined,
                disclaimer: t('schematic.disclaimer')
              }}
            />
          ) : schematic ? (
            <p className="text-body-sm text-text-muted">{t('error.notFound')}</p>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(bundleId)}
        onOpenChange={(abierto) => {
          if (!abierto) {
            setBundleId(null)
            setPrueba(null)
          }
        }}
      >
        <DialogContent data-testid="INV-STAGE-MILESTONE-001">
          <DialogTitle className="text-h2 font-bold text-text-primary">
            {stageDelBundle?.name ?? t('investor.stage.milestone')}
          </DialogTitle>
          <MerkleRootProof
            testId="INV-MERKLE-PROOF-002"
            merkleRoot={bundleFiles?.merkleRoot ?? ''}
            txid={stageDelBundle?.txid ?? null}
            archivos={(bundleFiles?.files ?? []).map((f) => ({
              id: f.sha256Hash,
              nombre: f.filename ?? f.sha256Hash,
              sha256: f.sha256Hash
            }))}
            onOpenArchivo={(archivo) => {
              if (!bundleId) return
              void api.getMerkleProof(bundleId, archivo.sha256).then(setPrueba)
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
    </PanelLayout>
  )
}
