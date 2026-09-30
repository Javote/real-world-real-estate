import {
  PROJECT_COVER_ALLOWED_MIME,
  PROJECT_COVER_MAX_FILE_MB
} from '@plataforma/shared/evidence-rules'
import { useMutation } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { api } from '#/api/port'
import { DEV_ROLES } from '#/auth/roles'
import { useRoleGuard } from '#/auth/useRoleGuard'
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
//
// **El "Map preview" de la captura 34b es donde se fija el lote (D-097).**
// `LocationMapModal` —el componente que la fila de M2-D5 lista para esta
// pantalla— en su variante `picker`. Dos caminos al mismo punto: escribir la
// dirección (la API la busca en Nominatim, `GET /developer/geocode`, y el pin
// cae solo) o tocar/arrastrar el pin. Sin punto no se crea: latitud y
// longitud son obligatorias en el endpoint, porque un proyecto sin coordenadas
// no se puede dibujar en ningún mapa (regla 17).
//
// **La portada (D-099) no está en las capturas 34b/34C, y es una decisión del
// dueño, no un invento:** M2-D3 exige la imagen en `ProjectCard` y el alta no
// tenía dónde cargarla. Va con `FileDropzone` —el componente de subida que
// M2-D3 ya define— limitado a una imagen JPEG o PNG, y es opcional. Se sube
// después de crear el proyecto, a su id: si el proyecto se crea y la portada
// falla, reintentar sube solo la portada (no vuelve a crear el proyecto, que
// chocaría con su propio slug).

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

/** Cuánto se espera después de la última tecla antes de buscar la dirección. */
export const ESPERA_BUSQUEDA_MS = 900
/** Menos que esto no es una dirección que valga la pena buscar. */
const MINIMO_PARA_BUSCAR = 5

type EstadoUbicacion = 'inicial' | 'buscando' | 'noEncontrada' | 'noDisponible' | 'lista'

/** Seis decimales (~10 cm): más precisión que eso es ruido del clic. */
const redondear = (grados: number) => Math.round(grados * 1e6) / 1e6

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
  const { t, locale } = useTranslation()
  const navigate = useNavigate()

  const [nombre, setNombre] = useState('')
  const [direccion, setDireccion] = useState('')
  const [unidades, setUnidades] = useState<number | null>(null)
  const [entrega, setEntrega] = useState('')
  const [punto, setPunto] = useState<{ latitude: number; longitude: number } | null>(null)
  const [estadoUbicacion, setEstadoUbicacion] = useState<EstadoUbicacion>('inicial')
  const [portada, setPortada] = useState<File[]>([])
  const [creadoId, setCreadoId] = useState<string | null>(null)

  // La dirección escrita mueve el pin, con una pausa para no buscar tecla por
  // tecla (Nominatim acepta un pedido por segundo para todo el servicio). Una
  // respuesta que llega después de que la dirección cambió se descarta.
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
    onSuccess: (projectId) =>
      void navigate({
        to: '/developer/project/$projectId',
        params: { projectId }
      })
  })

  if (!ready) return null

  // El endpoint exige el nombre (y el slug, que sale de él) y el punto del
  // lote: sin alguno de los dos no hay proyecto que crear.
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
