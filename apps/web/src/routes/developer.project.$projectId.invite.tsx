import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { api } from '#/api/port'
import { DEV_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { NumberInput } from '#/components/domain/NumberInput'
import { PrimaryButton } from '#/components/domain/PrimaryButton'
import { SelectDropdown } from '#/components/domain/SelectDropdown'
import { TextInput } from '#/components/domain/TextInput'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL } from '#/lib/cardShell'
import { majorToMinor, minorToMajor } from '#/lib/money'

// **M2-D5 fila 39 · `/developer/project/:projectId/invite`** — captura 39.
// Componentes: TextInput, SelectDropdown (unidad), NumberInput (monto),
// PrimaryButton. Test ID: DEV-INVITE-CREATE-001.
//
// **No hay modal de anclaje, y no es un olvido.** La fila anota el endpoint con
// "→ anchor TXID", pero `POST /developer/projects/:id/invitations` no ancla:
// inserta la invitación, reserva la unidad y escribe el AuditLog. El commitment
// del ciclo lo emite `POST /investor/invitations/:id/accept`, y tiene sentido
// que sea ahí — hasta que el investor acepta no hay contrato del que hacer
// commitment. Abrir un `AnchoringSuccessModal` sin TXID sería exactamente la
// señal de prueba que la regla 17 prohíbe.
//
// **Sin el campo "Name" de la captura.** `Invitation` no tiene columna para un
// nombre y el POST usa `z.strictObject`: mandarlo devuelve 400. La invitación
// viaja por email y el nombre del investor sale de su cuenta cuando acepta, así
// que el campo no tendría dónde vivir ni para qué. La fila lista **un**
// TextInput, y anota cuál control es para qué (unidad → SelectDropdown, monto →
// NumberInput): el que queda sin anotar es el email.
//
// **El monto se escribe en unidades mayores y viaja en mínimas** (regla 1). La
// captura muestra "285000", no "28500000": nadie tipea centavos. La conversión
// pasa una sola vez, acá, con `Math.round` — 1234.56 × 100 en punto flotante da
// 123456.00000000001, y ese decimal fantasma es justo lo que la regla evita.
//
// **La moneda sale de la unidad, no de la pantalla.** El endpoint la exige y la
// captura la fija en el label ("Amount (US$)"). Tomarla de la unidad elegida es
// lo mismo cuando coinciden y es correcto cuando no.
//
// **Las unidades que no están disponibles se ven pero no se eligen.** El
// endpoint no valida el estado: invitar sobre una unidad vendida la volvería
// "reservada" sin decir nada. Ocultarlas escondería inventario; deshabilitarlas
// muestra el porqué.

export const Route = createFileRoute('/developer/project/$projectId/invite')({
  component: InviteInvestor
})

/** Fallback cuando la unidad no trae moneda. Coincide con el seed. */
const MONEDA_POR_DEFECTO = 'USD'

function InviteInvestor() {
  const { projectId } = Route.useParams()
  const { ready } = useRoleGuard(DEV_ROLES)
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [email, setEmail] = useState('')
  const [unitId, setUnitId] = useState('')
  const [monto, setMonto] = useState<number | null>(null)

  const { data: unidades } = useQuery({
    queryKey: ['developer', 'project', projectId, 'units'],
    queryFn: () => api.listProjectUnits(projectId),
    enabled: ready
  })

  const unidad = unidades?.find((u) => u.id === unitId)

  // **El monto entra por parámetro y no se lee del scope.** Es lo que saca el
  // `as number`: acá `amountMinorUnits` YA es un entero validado, porque el
  // único que puede llamar a `mutate` es el submit, y para llamarlo tuvo que
  // estrechar el `null` primero. La guarda deja de ser una promesa y pasa a
  // ser el tipo.
  const invitar = useMutation({
    mutationFn: (amountMinorUnits: number) =>
      api.createInvitation(projectId, {
        unitId,
        investorEmail: email.trim(),
        amountMinorUnits,
        currency: unidad?.currency ?? MONEDA_POR_DEFECTO
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['developer'] })
      // La unidad queda reservada: mandar a la lista es mostrar el efecto, no
      // afirmarlo. Es la única prueba que esta pantalla puede sustanciar.
      void navigate({
        to: '/developer/project/$projectId/units',
        params: { projectId }
      })
    }
  })

  if (!ready) return null

  const elegirUnidad = (id: string) => {
    setUnitId(id)
    // El precio de la unidad es el punto de partida del monto, no un techo: el
    // developer puede pactar otro. Solo se prefilla si el campo está vacío,
    // para no pisar lo que ya se tipeó.
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

  // **La conversión pasa una sola vez y ANTES de habilitar el botón**, no en el
  // `mutationFn`. Es lo que vuelve imposible mandar un monto que el helper
  // rechazó: si `majorToMinor` devuelve `null` el formulario no se envía, y el
  // campo dice por qué en vez de redondear a espaldas de quien lo tipeó.
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
      rol="developer"
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
