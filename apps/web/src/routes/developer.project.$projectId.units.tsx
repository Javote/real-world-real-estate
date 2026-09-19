import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { api } from '#/api/port'
import type { DeveloperProjectUnit } from '#/api/types'
import { DEV_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { Loading } from '#/components/domain/Loading'
import { NumberInput } from '#/components/domain/NumberInput'
import { PrimaryButton, SecondaryButton } from '#/components/domain/PrimaryButton'
import { StatCard } from '#/components/domain/StatCard'
import { TextInput } from '#/components/domain/TextInput'
import { UnitCard } from '#/components/domain/UnitCard'
import { PanelLayout } from '#/components/PanelLayout'
import type { TranslationKey } from '#/i18n/dictionary'
import { formatCurrency } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL, CARD_SHELL_EMPTY } from '#/lib/cardShell'
import { cn } from '#/lib/cn'

// **M2-D5 fila 44b · `/developer/project/:projectId/units`** — captura 44b.
// Componentes: UnitCard (variante developer), StatusPill, TextInput,
// NumberInput, PrimaryButton. Test IDs: DEV-UNITS-LIST-001,
// DEV-UNIT-CREATE-002, DEV-UNIT-UPDATE-003.
//
// **Una card de formulario y una lista** — la captura no tiene más que eso, y
// los tres test IDs viven en la misma pantalla porque las tres acciones son la
// misma superficie: listar, agregar, corregir.
//
// **La card cambia de modo, no de lugar.** Tocar una fila la carga en el mismo
// formulario y el título pasa a "Editar <referencia>". Es lo que permiten los
// cinco componentes que la fila nombra: no hay en M2-D3 un modal de edición ni
// un menú contextual, y agregar uno sería inventar componente (regla 2).
//
// **La referencia no se edita.** El PATCH del endpoint no la acepta a
// propósito: es la identidad comercial de la unidad y ya la nombran las
// invitaciones y los contratos. Por eso en modo edición es el título de la
// card y no un campo — un campo que no guarda es una mentira más cara que su
// ausencia.
//
// **El estado comercial tampoco se edita a mano.** `available → reserved →
// sold` lo produce el ciclo de invitación y contrato (filas 39 y 40-41), no un
// dropdown: la plataforma refleja lo que pasó, no lo declara (D-070). El
// StatusPill lo muestra y M2-D3 es explícito en que los pills son de solo
// lectura.
//
// **El investor sale como "asignada / sin asignar", nunca como nombre.** El
// endpoint hace `selectAll()` sobre `Unit` y devuelve `investorId`, no una
// persona; la captura muestra "Carlos Ruiz" porque es dato mock. Pintar un
// nombre que no vino sería la regla 17 al revés.
//
// **Los cuatro tiles van en dos columnas y la captura los muestra en cuatro.**
// M2-D3 §StatCard §Usage rules es explícito —*"Group into 2-column grids on
// mobile; 3 or 4 on desktop"*— y a 320px cuatro tiles dejan ~66px por tile:
// "Available" parte en dos. La captura gana en QUÉ se muestra (los cuatro
// conteos, que es la diferencia real contra la captura 44); la regla del
// componente gana en cómo se agrupan.

export const Route = createFileRoute('/developer/project/$projectId/units')({
  component: ProjectUnits
})

const TONO = {
  sold: 'verified',
  delivered: 'verified',
  reserved: 'pending',
  available: 'neutral'
} as const

function ProjectUnits() {
  const { projectId } = Route.useParams()
  const { ready } = useRoleGuard(DEV_ROLES)
  const { t, locale } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [referencia, setReferencia] = useState('')
  const [piso, setPiso] = useState<number | null>(null)
  const [superficie, setSuperficie] = useState<number | null>(null)
  const [editando, setEditando] = useState<DeveloperProjectUnit | null>(null)

  const { data: proyecto } = useQuery({
    queryKey: ['developer', 'project', projectId],
    queryFn: () => api.getDeveloperProject(projectId),
    enabled: ready
  })

  const { data: unidades, isPending: unidadesPending } = useQuery({
    queryKey: ['developer', 'project', projectId, 'units'],
    queryFn: () => api.listProjectUnits(projectId),
    enabled: ready
  })

  const limpiar = () => {
    setEditando(null)
    setReferencia('')
    setPiso(null)
    setSuperficie(null)
  }

  const refrescar = () => {
    limpiar()
    void queryClient.invalidateQueries({ queryKey: ['developer'] })
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

  if (!ready) return null

  const editar = (unidad: DeveloperProjectUnit) => {
    setEditando(unidad)
    setReferencia(unidad.unitReference)
    setPiso(unidad.floor)
    setSuperficie(unidad.sizeM2)
  }

  const contar = (estado: string) => unidades?.filter((u) => u.status === estado).length ?? 0

  const enVuelo = crear.isPending || actualizar.isPending
  // En alta hace falta una referencia; en edición ya la hay y lo que se manda
  // son los dos campos opcionales, así que alcanza con que alguno tenga valor.
  const puedeGuardar = editando
    ? (piso !== null || superficie !== null) && !enVuelo
    : referencia.trim().length > 0 && !enVuelo

  return (
    <PanelLayout
      rol="developer"
      title={t('developer.projectUnits.title')}
      {...(proyecto ? { context: proyecto.name } : {})}
      back={{
        label: t('nav.back'),
        onClick: () =>
          void navigate({
            to: '/developer/project/$projectId',
            params: { projectId }
          })
      }}
    >
      {/*
        Los tiles CUENTAN unidades y los pills CALIFICAN una: en español eso es
        distinto número gramatical. Reusar `unitStatus.*` daba "0 Reservada".
      */}
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
                tone: TONO[u.status as keyof typeof TONO] ?? 'neutral',
                label: t(`unitStatus.${u.status}`) ?? u.status
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

/**
 * "Piso 3 · 65 m²", con los tramos que la unidad realmente tenga.
 *
 * El `detailLine` de UnitCard llega ya formateado porque el componente no arma
 * copy (D-025); acá se decide qué mostrar cuando falta un dato, y la respuesta
 * es omitir el tramo, no rellenarlo con un cero.
 */
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
