import { useMutation } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { api } from '#/api/port'
import { DEV_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
import { NumberInput } from '#/components/domain/NumberInput'
import { PrimaryButton } from '#/components/domain/PrimaryButton'
import { TextInput } from '#/components/domain/TextInput'
import { PanelLayout } from '#/components/PanelLayout'
import { useTranslation } from '#/i18n/useTranslation'

// **M2-D5 filas 34b-34c · `/developer/project/new`** — capturas 34b y 34C.
// Endpoint: POST /developer/projects. Test ID: DEV-PROJECT-CREATE-001.
//
// **Sin la card de "Stage template", y es deuda declarada, no un olvido.**
// M2-D1 §5.2 la lista como parte del formulario y la captura 34C muestra el
// selector con sus diez etapas. Dos cosas lo bloquean:
//
// 1. **Los diez nombres no existen en ningún entregable.** Grep sobre `docs/`
//    entero: M2-D1 los menciona como "Standard, 10 stages" y nunca los lista.
//    Los únicos nombres son los de la captura, y están mezclados en inglés y
//    español ("Foundations", "Estructura niveles superiores") — la firma del
//    dato mock que CLAUDE.md advierte que no es normativo.
// 2. **El backend no aplica ningún template.** `POST /developer/projects` crea
//    el proyecto y su membresía; los stages se crean de a uno con
//    `POST /projects/:id/stages`, y **cada uno ancla on-chain**. Diez
//    escrituras a cadena disparadas por un submit, sin transaccionalidad y sin
//    forma de revertir la mitad, no es algo que se resuelva en la vista.
//
// El template pertenece al servidor y a una decisión de producto. Mostrar acá
// un selector que no hace nada sería la misma mentira que un tile sin destino.
//
// **El `slug` se deriva del nombre.** El endpoint lo exige y el formulario no
// lo pide: es un identificador de URL, no un dato que el developer elija.

export const Route = createFileRoute('/developer/project/new')({ component: NuevoProyecto })

/** Minúsculas, sin diacríticos, separado por guiones. */
export function slugify(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function NuevoProyecto() {
  const { ready } = useRoleGuard(DEV_ROLES)
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [nombre, setNombre] = useState('')
  const [direccion, setDireccion] = useState('')
  const [unidades, setUnidades] = useState<number | null>(null)
  const [entrega, setEntrega] = useState('')

  const crear = useMutation({
    mutationFn: () =>
      api.createProject({
        name: nombre.trim(),
        slug: slugify(nombre),
        ...(direccion.trim() ? { address: direccion.trim() } : {}),
        ...(unidades !== null ? { totalUnits: unidades } : {}),
        ...(entrega ? { estimatedDelivery: entrega } : {})
      }),
    onSuccess: (proyecto) =>
      void navigate({
        to: '/developer/project/$projectId',
        params: { projectId: proyecto.id }
      })
  })

  if (!ready) return null

  // El nombre es lo único que el endpoint exige además del slug, y el slug sale
  // de él: si no queda nada tras normalizar, no hay proyecto que crear.
  const puedeCrear = slugify(nombre).length > 0 && !crear.isPending

  return (
    <PanelLayout
      rol="developer"
      title={t('developer.newProject.title')}
      context={t('developer.newProject.context')}
      back={{
        label: t('nav.back'),
        onClick: () => void navigate({ to: '/developer/projects' })
      }}
    >
      <form
        className="flex flex-col gap-s4"
        data-testid="DEV-PROJECT-CREATE-001"
        onSubmit={(e) => {
          e.preventDefault()
          if (puedeCrear) crear.mutate()
        }}
      >
        <article className="rounded-xl bg-card p-s4 shadow-e1">
          <TextInput
            label={t('developer.newProject.name')}
            value={nombre}
            onChange={setNombre}
            placeholder={t('developer.newProject.namePlaceholder')}
            required
          />
        </article>

        <article className="rounded-xl bg-card p-s4 shadow-e1">
          <TextInput
            label={t('developer.newProject.location')}
            value={direccion}
            onChange={setDireccion}
            placeholder={t('developer.newProject.locationPlaceholder')}
          />
        </article>

        <article className="rounded-xl bg-card p-s4 shadow-e1">
          <NumberInput
            id="totalUnits"
            label={t('developer.newProject.units')}
            value={unidades}
            onChange={setUnidades}
            min={0}
            stepUpLabel={t('developer.newProject.stepUp')}
            stepDownLabel={t('developer.newProject.stepDown')}
          />
        </article>

        <article className="rounded-xl bg-card p-s4 shadow-e1">
          <TextInput
            label={t('developer.newProject.delivery')}
            value={entrega}
            onChange={setEntrega}
            type="date"
          />
        </article>

        {crear.isError ? (
          <p className="text-body-sm text-danger">{t('developer.newProject.error')}</p>
        ) : null}

        <PrimaryButton type="submit" disabled={!puedeCrear} loading={crear.isPending}>
          {t('developer.newProject.submit')}
        </PrimaryButton>
      </form>
    </PanelLayout>
  )
}
