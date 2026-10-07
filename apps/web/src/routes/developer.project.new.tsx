import {
  PROJECT_COVER_ALLOWED_MIME,
  PROJECT_COVER_MAX_FILE_MB
} from '@plataforma/shared/evidence-rules'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { api } from '#/api/port'
import { invalidaciones, invalidar } from '#/api/queries'
import { FileDropzone } from '#/components/domain/FileDropzone'
import { LocationMapModal } from '#/components/domain/LocationMapModal'
import { NumberInput } from '#/components/domain/NumberInput'
import { PrimaryButton } from '#/components/domain/PrimaryButton'
import { SelectDropdown } from '#/components/domain/SelectDropdown'
import { TextInput } from '#/components/domain/TextInput'
import { PanelLayout } from '#/components/PanelLayout'
import type { TranslationKey } from '#/i18n/dictionary'
import { formatCoordinate } from '#/i18n/format'
import { useTranslation } from '#/i18n/useTranslation'
import { CARD_SHELL } from '#/lib/cardShell'
import { cn } from '#/lib/cn'

export const Route = createFileRoute('/developer/project/new')({ component: NuevoProyecto })

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

export const ESPERA_BUSQUEDA_MS = 900
const MINIMO_PARA_BUSCAR = 5

type EstadoUbicacion = 'inicial' | 'buscando' | 'noEncontrada' | 'noDisponible' | 'lista'

const redondear = (grados: number) => Math.round(grados * 1e6) / 1e6

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
  const { t, locale } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [nombre, setNombre] = useState('')
  const [direccion, setDireccion] = useState('')
  const [unidades, setUnidades] = useState<number | null>(null)
  const [entrega, setEntrega] = useState('')
  const [punto, setPunto] = useState<{ latitude: number; longitude: number } | null>(null)
  const [estadoUbicacion, setEstadoUbicacion] = useState<EstadoUbicacion>('inicial')
  const [portada, setPortada] = useState<File[]>([])
  const [creadoId, setCreadoId] = useState<string | null>(null)

  useEffect(() => {
    const q = direccion.trim()
    if (q.length < MINIMO_PARA_BUSCAR) return

    let vigente = true
    const espera = setTimeout(() => {
      setEstadoUbicacion('buscando')
      api
        .geocodeAddress(q)
        .then((r) => {
          if (!vigente) return
          if (r.match) {
            setPunto({ latitude: r.match.latitude, longitude: r.match.longitude })
            setEstadoUbicacion('lista')
          } else {
            setEstadoUbicacion('noEncontrada')
          }
        })
        .catch(() => {
          if (vigente) setEstadoUbicacion('noDisponible')
        })
    }, ESPERA_BUSQUEDA_MS)

    return () => {
      vigente = false
      clearTimeout(espera)
    }
  }, [direccion])

  const crear = useMutation({
    mutationFn: async (lote: { latitude: number; longitude: number }) => {
      const projectId =
        creadoId ??
        (
          await api.createProject({
            name: nombre.trim(),
            slug: slugify(nombre),
            latitude: redondear(lote.latitude),
            longitude: redondear(lote.longitude),
            ...(direccion.trim() ? { address: direccion.trim() } : {}),
            ...(unidades !== null ? { totalUnits: unidades } : {}),
            ...(entrega ? { estimatedDelivery: entrega } : {})
          })
        ).id
      setCreadoId(projectId)
      const [imagen] = portada
      if (imagen) await api.uploadProjectCover(projectId, imagen)
      return projectId
    },
    onSuccess: (projectId) => {
      invalidar(queryClient, invalidaciones.proyectoCreado())
      void navigate({
        to: '/developer/project/$projectId',
        params: { projectId }
      })
    }
  })

  const lote = slugify(nombre).length > 0 && !crear.isPending ? punto : null

  const mensajeUbicacion =
    estadoUbicacion === 'buscando'
      ? t('developer.newProject.mapSearching')
      : estadoUbicacion === 'noEncontrada'
        ? t('developer.newProject.mapNotFound')
        : estadoUbicacion === 'noDisponible'
          ? t('developer.newProject.mapUnavailable')
          : punto
            ? t('developer.newProject.mapPoint', {
                latitude: formatCoordinate(punto.latitude, locale),
                longitude: formatCoordinate(punto.longitude, locale)
              })
            : t('developer.newProject.mapHint')

  return (
    <PanelLayout
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
          if (lote) crear.mutate(lote)
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

        <article className={cn('flex flex-col gap-s3', CARD_SHELL)}>
          <TextInput
            label={t('developer.newProject.location')}
            value={direccion}
            onChange={setDireccion}
            placeholder={t('developer.newProject.locationPlaceholder')}
          />
          <LocationMapModal
            open
            variant="picker"
            {...(punto ? { latitude: punto.latitude, longitude: punto.longitude } : {})}
            onPick={(latitude, longitude) => {
              setPunto({ latitude, longitude })
              setEstadoUbicacion('lista')
            }}
            labels={{
              title: t('developer.newProject.map'),
              close: t('common.close'),
              marker: t('map.marker')
            }}
          />
          <p className="text-body-sm text-text-secondary" aria-live="polite">
            {mensajeUbicacion}
          </p>
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

        <article className={cn('flex flex-col gap-s3', CARD_SHELL)}>
          <p className="text-body-sm font-medium text-text-secondary">
            {t('developer.newProject.cover')}
          </p>
          <FileDropzone
            files={portada}
            onChange={setPortada}
            disabled={crear.isPending}
            maxFiles={1}
            maxSizeMb={PROJECT_COVER_MAX_FILE_MB}
            allowedMime={PROJECT_COVER_ALLOWED_MIME}
            labels={{
              primary: t('developer.newProject.coverDropzone'),
              secondary: t('developer.newProject.coverHint', {
                max: String(PROJECT_COVER_MAX_FILE_MB)
              }),
              remove: t('developer.newProject.coverRemove'),
              rejected: (nombre, motivo) =>
                t(`developer.newProject.coverRejected.${motivo}`, {
                  name: nombre,
                  max: String(PROJECT_COVER_MAX_FILE_MB)
                })
            }}
          />
        </article>

        {crear.isError ? (
          <p className="text-body-sm text-danger">
            {creadoId ? t('developer.newProject.coverError') : t('developer.newProject.error')}
          </p>
        ) : null}

        <PrimaryButton type="submit" disabled={!lote} loading={crear.isPending}>
          {t('developer.newProject.submit')}
        </PrimaryButton>
      </form>
    </PanelLayout>
  )
}
