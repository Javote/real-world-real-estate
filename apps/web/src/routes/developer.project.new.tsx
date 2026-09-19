import { useMutation } from '@tanstack/react-query'
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
import type { TranslationKey } from '#/i18n/dictionary'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL } from '#/lib/cardShell'
import { cn } from '#/lib/cn'

// **M2-D5 filas 34b-34c · `/developer/project/new`** — capturas 34b y 34C.
// Endpoint: POST /developer/projects. Test ID: DEV-PROJECT-CREATE-001.
//
// **La card de "Stage template" ya no es deuda declarada — cerrada
// 2026-09-08.** Lo que la bloqueaba, y cómo se cerró:
//
// 1. **Los diez nombres no existían en ningún entregable.** Los de la captura
//    (`34C-DEVELOPER-NEW-PROJECT-B.png`) estaban mezclados en inglés y
//    español. El dueño los confirmó como catálogo normativo, traducidos al
//    español — viven en `DEFAULT_STAGE_CATALOG` (`packages/shared`) para el
//    backend, y acá abajo como claves de i18n (regla 14: nada de texto
//    hardcodeado). Es la misma lista en dos lugares porque el front no
//    importa valores en runtime de `packages/shared` (solo tipos — no carga
//    Zod); si el catálogo cambia, cambian los dos.
// 2. **El backend no aplicaba ningún template.** Ahora `POST
//    /developer/projects` crea el proyecto, su membresía y las 10 etapas en
//    una sola transacción de base — atómico a nivel de fila. El anclaje
//    on-chain de cada etapa es aparte y no puede ser atómico (el validador
//    rechaza acuñar más de un hilo por transacción,
//    `mint_rejects_two_threads_in_one_tx`): se intenta una por una, tolerando
//    que alguna quede `Failed` sin bloquear a las demás (D-059).
//
// Es la única plantilla que existe — no hay "ninguna" ni otra opción — así
// que el dropdown siempre muestra la misma selección; existe para que la
// pantalla coincida con la captura, no porque haya algo que elegir hoy.
//
// **El `slug` se deriva del nombre.** El endpoint lo exige y el formulario no
// lo pide: es un identificador de URL, no un dato que el developer elija.

export const Route = createFileRoute('/developer/project/new')({ component: NuevoProyecto })

/** Espeja `DEFAULT_STAGE_CATALOG` de `packages/shared` — ver el comentario de arriba. */
const ETAPAS_DEL_TEMPLATE: readonly TranslationKey[] = [
  'developer.newProject.stageTemplate.stage1',
  'developer.newProject.stageTemplate.stage2',
  'developer.newProject.stageTemplate.stage3',
  'developer.newProject.stageTemplate.stage4',
  'developer.newProject.stageTemplate.stage5',
  'developer.newProject.stageTemplate.stage6',
  'developer.newProject.stageTemplate.stage7',
  'developer.newProject.stageTemplate.stage8',
  'developer.newProject.stageTemplate.stage9',
  'developer.newProject.stageTemplate.stage10'
]

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
        <article className={CARD_SHELL}>
          <TextInput
            label={t('developer.newProject.name')}
            value={nombre}
            onChange={setNombre}
            placeholder={t('developer.newProject.namePlaceholder')}
            required
          />
        </article>

        <article className={CARD_SHELL}>
          <TextInput
            label={t('developer.newProject.location')}
            value={direccion}
            onChange={setDireccion}
            placeholder={t('developer.newProject.locationPlaceholder')}
          />
        </article>

        <article className={CARD_SHELL}>
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

        <article className={CARD_SHELL}>
          <TextInput
            label={t('developer.newProject.delivery')}
            value={entrega}
            onChange={setEntrega}
            type="date"
          />
        </article>

        <article className={cn('flex flex-col gap-s3', CARD_SHELL)}>
          <SelectDropdown
            id="stageTemplate"
            label={t('developer.newProject.stageTemplate.label')}
            value="standard"
            onChange={() => {}}
            options={[
              { value: 'standard', label: t('developer.newProject.stageTemplate.standard') }
            ]}
          />
          <ol className="flex flex-col gap-s1 text-body-sm text-text-secondary">
            {ETAPAS_DEL_TEMPLATE.map((clave, i) => (
              <li key={clave}>
                {i + 1}. {t(clave)}
              </li>
            ))}
          </ol>
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
