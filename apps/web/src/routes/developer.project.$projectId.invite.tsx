import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { api } from '#/api/port'
import { invalidaciones, invalidar, proyectoQueries } from '#/api/queries'
import { NumberInput } from '#/components/domain/NumberInput'
import { PrimaryButton } from '#/components/domain/PrimaryButton'
import { SelectDropdown } from '#/components/domain/SelectDropdown'
import { TextInput } from '#/components/domain/TextInput'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL } from '#/lib/cardShell'
import { majorToMinor, minorToMajor } from '#/lib/money'

export const Route = createFileRoute('/developer/project/$projectId/invite')({
  component: InviteInvestor
})

const MONEDA_POR_DEFECTO = 'USD'

function InviteInvestor() {
  const { projectId } = Route.useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [email, setEmail] = useState('')
  const [unitId, setUnitId] = useState('')
  const [monto, setMonto] = useState<number | null>(null)

  const { data: unidades } = useQuery(proyectoQueries.unidades(projectId))

  const unidad = unidades?.find((u) => u.id === unitId)

  const invitar = useMutation({
    mutationFn: (amountMinorUnits: number) =>
      api.createInvitation(projectId, {
        unitId,
        investorEmail: email.trim(),
        amountMinorUnits,
        currency: unidad?.currency ?? MONEDA_POR_DEFECTO
      }),
    onSuccess: () => {
      invalidar(queryClient, invalidaciones.inversorInvitado(projectId))
      void navigate({
        to: '/developer/project/$projectId/units',
        params: { projectId }
      })
    }
  })

  const elegirUnidad = (id: string) => {
    setUnitId(id)
    const elegida = unidades?.find((u) => u.id === id)
    if (monto === null && elegida?.priceMinorUnits != null)
      setMonto(minorToMajor(elegida.priceMinorUnits))
  }

  const opciones =
    unidades?.map((u) => ({
      value: u.id,
      label: u.unitReference,
      disabled: u.status !== 'available'
    })) ?? []

  const montoMinor = majorToMinor(monto)
  const montoInvalido = monto !== null && montoMinor === null

  const puedeInvitar =
    email.trim().length > 0 &&
    unitId !== '' &&
    montoMinor !== null &&
    montoMinor > 0 &&
    !invitar.isPending

  return (
    <PanelLayout
      title={t('developer.invite.title')}
      context={t('developer.invite.context')}
      back={{
        label: t('nav.back'),
        onClick: () =>
          void navigate({
            to: '/developer/project/$projectId',
            params: { projectId }
          })
      }}
    >
      <form
        className="flex flex-col gap-s4"
        data-testid="DEV-INVITE-CREATE-001"
        onSubmit={(e) => {
          e.preventDefault()
          if (puedeInvitar && montoMinor !== null) invitar.mutate(montoMinor)
        }}
      >
        <article className={CARD_SHELL}>
          <TextInput
            label={t('developer.invite.email')}
            value={email}
            onChange={setEmail}
            type="email"
            placeholder={t('developer.invite.emailPlaceholder')}
            autoComplete="email"
            required
          />
        </article>

        <article className={CARD_SHELL}>
          <SelectDropdown
            id="invite-unit"
            label={t('developer.invite.unit')}
            value={unitId}
            onChange={elegirUnidad}
            options={opciones}
            placeholder={t('developer.invite.unitPlaceholder')}
          />
        </article>

        <article className={CARD_SHELL}>
          <NumberInput
            id="invite-amount"
            label={t('developer.invite.amount', {
              currency: unidad?.currency ?? MONEDA_POR_DEFECTO
            })}
            value={monto}
            onChange={setMonto}
            min={1}
            step={0.01}
            {...(montoInvalido ? { error: t('developer.invite.amountInvalid') } : {})}
            stepUpLabel={t('developer.invite.amountUp')}
            stepDownLabel={t('developer.invite.amountDown')}
          />
        </article>

        {invitar.isError ? (
          <p className="text-body-sm text-danger">{t('developer.invite.error')}</p>
        ) : null}

        <PrimaryButton type="submit" disabled={!puedeInvitar} loading={invitar.isPending}>
          {t('developer.invite.submit')}
        </PrimaryButton>
      </form>
    </PanelLayout>
  )
}
