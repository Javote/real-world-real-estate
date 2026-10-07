import type { UnitStatus } from '@plataforma/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { api } from '#/api/port'
import { invalidaciones, invalidar, proyectoQueries } from '#/api/queries'
import type { DeveloperProjectUnit } from '#/api/types'
import { Loading } from '#/components/domain/Loading'
import { NumberInput } from '#/components/domain/NumberInput'
import { PrimaryButton, SecondaryButton } from '#/components/domain/PrimaryButton'
import { StatCard } from '#/components/domain/StatCard'
import type { StatusTone } from '#/components/domain/StatusPill'
import { TextInput } from '#/components/domain/TextInput'
import { UnitCard } from '#/components/domain/UnitCard'
import { PanelLayout } from '#/components/PanelLayout'
import type { TranslationKey } from '#/i18n/dictionary'
import { formatCurrency } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL, CARD_SHELL_EMPTY } from '#/lib/cardShell'
import { cn } from '#/lib/cn'

export const Route = createFileRoute('/developer/project/$projectId/units')({
  loader: ({ context: { queryClient }, params: { projectId } }) => {
    void queryClient.prefetchQuery(proyectoQueries.detalleDelDeveloper(projectId))
    void queryClient.prefetchQuery(proyectoQueries.unidades(projectId))
  },
  component: ProjectUnits
})

const TONO: Record<UnitStatus, StatusTone> = {
  sold: 'verified',
  delivered: 'verified',
  reserved: 'pending',
  available: 'neutral'
}

function ProjectUnits() {
  const { projectId } = Route.useParams()
  const { t, locale } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [referencia, setReferencia] = useState('')
  const [piso, setPiso] = useState<number | null>(null)
  const [superficie, setSuperficie] = useState<number | null>(null)
  const [editando, setEditando] = useState<DeveloperProjectUnit | null>(null)

  const { data: proyecto } = useQuery(proyectoQueries.detalleDelDeveloper(projectId))

  const { data: unidades, isPending: unidadesPending } = useQuery(
    proyectoQueries.unidades(projectId)
  )

  const limpiar = () => {
    setEditando(null)
    setReferencia('')
    setPiso(null)
    setSuperficie(null)
  }

  const refrescar = () => {
    limpiar()
    invalidar(queryClient, invalidaciones.unidadGuardada(projectId))
  }

  const crear = useMutation({
    mutationFn: () =>
      api.createProjectUnit(projectId, {
        unitReference: referencia.trim(),
        ...(piso !== null ? { floor: piso } : {}),
        ...(superficie !== null ? { sizeM2: superficie } : {})
      }),
    onSuccess: refrescar
  })

  const actualizar = useMutation({
    mutationFn: () =>
      api.updateUnit(editando!.id, {
        ...(piso !== null ? { floor: piso } : {}),
        ...(superficie !== null ? { sizeM2: superficie } : {})
      }),
    onSuccess: refrescar
  })

  const editar = (unidad: DeveloperProjectUnit) => {
    setEditando(unidad)
    setReferencia(unidad.unitReference)
    setPiso(unidad.floor)
    setSuperficie(unidad.sizeM2)
  }

  const contar = (estado: string) => unidades?.filter((u) => u.status === estado).length ?? 0

  const enVuelo = crear.isPending || actualizar.isPending
  const puedeGuardar = editando
    ? (piso !== null || superficie !== null) && !enVuelo
    : referencia.trim().length > 0 && !enVuelo

  return (
    <PanelLayout
      title={t('developer.projectUnits.title')}
      context={proyecto ? proyecto.name : null}
      back={{
        label: t('nav.back'),
        onClick: () =>
          void navigate({
            to: '/developer/project/$projectId',
            params: { projectId }
          })
      }}
    >
      <section className="grid grid-cols-2 gap-s3">
        <StatCard
          value={String(unidades?.length ?? 0)}
          label={t('developer.projectUnits.countTotal')}
        />
        <StatCard value={String(contar('sold'))} label={t('developer.projectUnits.countSold')} />
        <StatCard
          value={String(contar('reserved'))}
          label={t('developer.projectUnits.countReserved')}
        />
        <StatCard
          value={String(contar('available'))}
          label={t('developer.projectUnits.countAvailable')}
        />
      </section>

      <form
        className={cn('flex flex-col gap-s4', CARD_SHELL)}
        data-testid={editando ? 'DEV-UNIT-UPDATE-003' : 'DEV-UNIT-CREATE-002'}
        onSubmit={(e) => {
          e.preventDefault()
          if (!puedeGuardar) return
          if (editando) actualizar.mutate()
          else crear.mutate()
        }}
      >
        <h2 className="flex items-center gap-s2 text-h2 font-bold text-text-primary">
          {editando ? null : <Plus className="size-icon-inline text-primary" aria-hidden="true" />}
          {editando
            ? t('developer.projectUnits.editTitle', { unit: editando.unitReference })
            : t('developer.projectUnits.addTitle')}
        </h2>

        {editando ? null : (
          <TextInput
            label={t('developer.projectUnits.reference')}
            value={referencia}
            onChange={setReferencia}
            placeholder={t('developer.projectUnits.referencePlaceholder')}
            required
          />
        )}

        <NumberInput
          id="unit-floor"
          label={t('developer.projectUnits.floor')}
          value={piso}
          onChange={setPiso}
          min={0}
          stepUpLabel={t('developer.projectUnits.floorUp')}
          stepDownLabel={t('developer.projectUnits.floorDown')}
        />

        <NumberInput
          id="unit-size"
          label={t('developer.projectUnits.size')}
          value={superficie}
          onChange={setSuperficie}
          min={1}
          stepUpLabel={t('developer.projectUnits.sizeUp')}
          stepDownLabel={t('developer.projectUnits.sizeDown')}
        />

        {crear.isError || actualizar.isError ? (
          <p className="text-body-sm text-danger">{t('developer.projectUnits.error')}</p>
        ) : null}

        <PrimaryButton type="submit" disabled={!puedeGuardar} loading={enVuelo}>
          {editando ? t('developer.projectUnits.save') : t('developer.projectUnits.add')}
        </PrimaryButton>

        {editando ? (
          <SecondaryButton onClick={limpiar}>{t('developer.projectUnits.cancel')}</SecondaryButton>
        ) : null}
      </form>

      <section className="flex flex-col gap-s2" data-testid="DEV-UNITS-LIST-001">
        {unidadesPending ? (
          <Loading />
        ) : unidades?.length ? (
          unidades.map((u) => (
            <UnitCard
              key={u.id}
              variant="developer"
              unitReference={u.unitReference}
              detailLine={detalle(u, t)}
              investorLabel={
                u.investorId ? t('developer.units.assigned') : t('developer.units.unassigned')
              }
              {...(u.priceMinorUnits !== null && u.currency
                ? { priceLabel: formatCurrency(u.priceMinorUnits, u.currency, locale) }
                : {})}
              status={{
                tone: TONO[u.status],
                label: t(`unitStatus.${u.status}`)
              }}
              onOpen={() => editar(u)}
            />
          ))
        ) : (
          <p className={CARD_SHELL_EMPTY}>{t('developer.units.empty')}</p>
        )}
      </section>
    </PanelLayout>
  )
}

function detalle(
  unidad: DeveloperProjectUnit,
  t: (clave: TranslationKey, valores?: Record<string, string>) => string
): string {
  const tramos: string[] = []
  if (unidad.floor !== null)
    tramos.push(t('developer.projectUnits.floorValue', { floor: String(unidad.floor) }))
  if (unidad.sizeM2 !== null)
    tramos.push(t('developer.projectUnits.sizeValue', { size: String(unidad.sizeM2) }))
  return tramos.join(' · ')
}
