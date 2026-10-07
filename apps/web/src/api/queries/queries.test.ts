import { hashKey, QueryClient, type QueryKey } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../port'
import { FRESCO_MS } from './frescura'
import {
  archivoQueries,
  auditoriaQueries,
  capitalQueries,
  certificadoQueries,
  contratoQueries,
  dossierQueries,
  etapaQueries,
  evidenciaQueries,
  favoritoQueries,
  invalidaciones,
  invalidar,
  invitacionQueries,
  kpiQueries,
  notificacionQueries,
  proyectoQueries,
  unidadQueries,
  usuarioQueries
} from './index'

const aUrl = () => 'blob:x'

// Una query por entrada de cada fábrica; p2/s2 son de otro proyecto, para ver que no se tocan.
const CATALOGO = {
  'proyecto.lista': proyectoQueries.lista(),
  'proyecto.delDeveloper': proyectoQueries.delDeveloper(),
  'proyecto.detalle': proyectoQueries.detalle('p1'),
  'proyecto.detalleDelDeveloper': proyectoQueries.detalleDelDeveloper('p1'),
  'proyecto.desarrolladora': proyectoQueries.desarrolladora('p1'),
  'proyecto.documentos': proyectoQueries.documentos('p1'),
  'proyecto.etapas': proyectoQueries.etapas('p1'),
  'proyecto.esquema': proyectoQueries.esquema('p1'),
  'proyecto.unidades': proyectoQueries.unidades('p1'),
  'proyecto.contratos': proyectoQueries.contratos('p1'),
  'otroProyecto.detalle': proyectoQueries.detalle('p2'),
  'otroProyecto.documentos': proyectoQueries.documentos('p2'),
  'etapa.detalle': etapaQueries.detalle('p1', 's1'),
  'etapa.delCertificador': etapaQueries.delCertificador('s1'),
  'etapa.progreso': etapaQueries.progreso(),
  'etapa.asignadas': etapaQueries.asignadas(),
  'otraEtapa.detalle': etapaQueries.detalle('p2', 's2'),
  'unidad.delInvestor': unidadQueries.delInvestor(),
  'unidad.delDeveloper': unidadQueries.delDeveloper(),
  'unidad.detalle': unidadQueries.detalle('u1'),
  'unidad.novedades': unidadQueries.novedades('u1'),
  'contrato.deUnidad': contratoQueries.deUnidad('u1'),
  'contrato.liberaciones': contratoQueries.liberaciones('c1'),
  'dossier.deUnidad': dossierQueries.deUnidad('u1'),
  'dossier.detalle': dossierQueries.detalle('d1'),
  'dossier.publico': dossierQueries.publico('t1'),
  'dossier.pendientes': dossierQueries.pendientes(),
  'dossier.firmas': dossierQueries.firmas(),
  'evidencia.delBundle': evidenciaQueries.delBundle('b1'),
  'evidencia.delDeveloper': evidenciaQueries.delDeveloper(),
  'archivo.url': archivoQueries.url('e1', aUrl),
  'archivo.fotosDeEtapa': archivoQueries.fotosDeEtapa('s1', ['e1'], aUrl),
  'notificacion.lista': notificacionQueries.lista(null),
  'notificacion.deUnidad': notificacionQueries.deUnidad('u1', null),
  'notificacion.noLeidas': notificacionQueries.noLeidas(),
  'invitacion.deInvestor': invitacionQueries.deInvestor('i1'),
  'invitacion.delCertificador': invitacionQueries.delCertificador(),
  'invitacion.aCertificadoresDelProyecto': invitacionQueries.aCertificadoresDelProyecto('p1'),
  'kpi.developer': kpiQueries.developer(),
  'kpi.certificador': kpiQueries.certificador(),
  'kpi.notary': kpiQueries.notary(),
  'capital.resumen': capitalQueries.resumen(),
  'capital.mensual': capitalQueries.mensual(),
  'capital.porProyecto': capitalQueries.porProyecto(),
  'usuario.perfil': usuarioQueries.perfil(),
  'usuario.lista': usuarioQueries.lista(),
  'usuario.inversores': usuarioQueries.inversores(),
  'favorito.lista': favoritoQueries.lista(),
  'certificado.lista': certificadoQueries.lista(),
  'auditoria.lista': auditoriaQueries.lista()
}
type Nombre = keyof typeof CATALOGO
const NOMBRES = Object.keys(CATALOGO) as Nombre[]

// Muestran un TXID, un `anchorStatus`, una cuenta de anclados o se reconcilian al leer (D-077).
const CON_ANCLAJE: Nombre[] = [
  'proyecto.detalle',
  'proyecto.documentos',
  'proyecto.etapas',
  'proyecto.contratos',
  'otroProyecto.detalle',
  'otroProyecto.documentos',
  'etapa.detalle',
  'otraEtapa.detalle',
  'unidad.detalle',
  'unidad.novedades',
  'contrato.liberaciones',
  'dossier.deUnidad',
  'dossier.detalle',
  'dossier.publico',
  'dossier.firmas',
  'evidencia.delBundle',
  'evidencia.delDeveloper',
  'kpi.developer',
  'kpi.notary',
  'certificado.lista',
  'auditoria.lista'
]
const ARCHIVOS: Nombre[] = ['archivo.url', 'archivo.fotosDeEtapa']

describe('las fábricas de queries', () => {
  afterEach(() => vi.restoreAllMocks())

  it('invariante 3: lo que muestra un anclaje no se sirve de caché fresca; el resto, 30 s', () => {
    for (const nombre of NOMBRES) {
      const esperado = CON_ANCLAJE.includes(nombre) || ARCHIVOS.includes(nombre) ? 0 : FRESCO_MS
      expect({ nombre, staleTime: CATALOGO[nombre].staleTime }).toEqual({
        nombre,
        staleTime: esperado
      })
    }
  })

  it('los binarios no sobreviven a la pantalla que los creó', () => {
    for (const nombre of ARCHIVOS) expect(CATALOGO[nombre].gcTime).toBe(0)
  })

  it('dos entradas distintas nunca comparten llave', () => {
    const hashes = NOMBRES.map((n) => hashKey(CATALOGO[n].queryKey))
    expect(new Set(hashes).size).toBe(NOMBRES.length)
  })

  it('invariante 4: cada queryFn pide exactamente una vez a port.ts', async () => {
    const metodos = api as unknown as Record<string, () => Promise<unknown>>
    const espias = Object.keys(metodos).map((metodo) =>
      vi.spyOn(metodos, metodo).mockResolvedValue(new Blob())
    )
    for (const nombre of NOMBRES) {
      for (const espia of espias) espia.mockClear()
      await (CATALOGO[nombre].queryFn as () => Promise<unknown>)()
      const llamadas = espias.reduce((total, espia) => total + espia.mock.calls.length, 0)
      expect({ nombre, llamadas }).toEqual({ nombre, llamadas: 1 })
    }
  })
})

const PROYECTO_P1: Nombre[] = [
  'proyecto.detalle',
  'proyecto.detalleDelDeveloper',
  'proyecto.desarrolladora',
  'proyecto.documentos',
  'proyecto.etapas',
  'proyecto.esquema',
  'proyecto.unidades',
  'proyecto.contratos'
]
const OTRO_PROYECTO: Nombre[] = ['otroProyecto.detalle', 'otroProyecto.documentos']
const LISTAS_DE_PROYECTOS: Nombre[] = ['proyecto.lista', 'proyecto.delDeveloper']
const KPIS: Nombre[] = ['kpi.developer', 'kpi.certificador', 'kpi.notary']
const UNIDADES: Nombre[] = [
  'unidad.delInvestor',
  'unidad.delDeveloper',
  'unidad.detalle',
  'unidad.novedades'
]
const ETAPAS: Nombre[] = [
  'etapa.detalle',
  'etapa.delCertificador',
  'etapa.progreso',
  'etapa.asignadas',
  'otraEtapa.detalle'
]

function invalidadas(llaves: QueryKey[]): Nombre[] {
  const queryClient = new QueryClient()
  for (const nombre of NOMBRES) queryClient.setQueryData(CATALOGO[nombre].queryKey, {})
  invalidar(queryClient, llaves)
  return NOMBRES.filter((n) => queryClient.getQueryState(CATALOGO[n].queryKey)?.isInvalidated)
}

const ordenado = (nombres: Nombre[]) => [...nombres].sort()

describe('cada mutación invalida la entidad que tocó, no el rol', () => {
  it.each<[string, QueryKey[], Nombre[]]>([
    [
      'guardar una unidad',
      invalidaciones.unidadGuardada('p1'),
      [...UNIDADES, ...PROYECTO_P1, ...LISTAS_DE_PROYECTOS, ...KPIS]
    ],
    [
      'subir evidencia a una etapa',
      invalidaciones.evidenciaSubida('p1', 's1'),
      [
        'evidencia.delBundle',
        'evidencia.delDeveloper',
        'etapa.detalle',
        'etapa.delCertificador',
        'etapa.progreso',
        ...PROYECTO_P1,
        ...LISTAS_DE_PROYECTOS,
        ...KPIS,
        'auditoria.lista'
      ]
    ],
    [
      'anclar un documento',
      invalidaciones.documentoAnclado(),
      [
        'evidencia.delBundle',
        'evidencia.delDeveloper',
        ...PROYECTO_P1,
        ...OTRO_PROYECTO,
        ...LISTAS_DE_PROYECTOS,
        ...KPIS,
        'auditoria.lista'
      ]
    ],
    [
      'cambiar el estado de una etapa',
      invalidaciones.etapaCambiada(),
      [
        ...ETAPAS,
        ...PROYECTO_P1,
        ...OTRO_PROYECTO,
        ...LISTAS_DE_PROYECTOS,
        'certificado.lista',
        ...KPIS,
        'auditoria.lista'
      ]
    ],
    [
      'responder una invitación a certificar',
      invalidaciones.invitacionDeCertificadorRespondida(),
      [
        'invitacion.delCertificador',
        'invitacion.aCertificadoresDelProyecto',
        'etapa.asignadas',
        ...KPIS
      ]
    ],
    [
      'invitar a un certificador',
      invalidaciones.certificadorInvitado('p1'),
      ['invitacion.aCertificadoresDelProyecto']
    ],
    [
      'firmar o rechazar un dossier',
      invalidaciones.dossierResuelto(),
      [
        'dossier.deUnidad',
        'dossier.detalle',
        'dossier.publico',
        'dossier.pendientes',
        'dossier.firmas',
        ...KPIS
      ]
    ],
    [
      'aceptar una invitación del developer',
      invalidaciones.invitacionDeInvestorAceptada(),
      [
        'invitacion.deInvestor',
        ...UNIDADES,
        'contrato.deUnidad',
        'contrato.liberaciones',
        'dossier.deUnidad',
        ...PROYECTO_P1,
        ...OTRO_PROYECTO,
        ...LISTAS_DE_PROYECTOS
      ]
    ],
    [
      'rechazar una invitación del developer',
      invalidaciones.invitacionDeInvestorRechazada(),
      ['invitacion.deInvestor']
    ],
    [
      'invitar a un investor',
      invalidaciones.inversorInvitado('p1'),
      [...PROYECTO_P1, ...LISTAS_DE_PROYECTOS, ...UNIDADES, 'usuario.inversores', ...KPIS]
    ],
    [
      'crear un proyecto',
      invalidaciones.proyectoCreado(),
      [
        ...LISTAS_DE_PROYECTOS,
        ...UNIDADES,
        ...KPIS,
        'capital.resumen',
        'capital.mensual',
        'capital.porProyecto'
      ]
    ],
    ['guardar el perfil', invalidaciones.perfilGuardado(), ['usuario.perfil']]
  ])('%s', (_caso, llaves, esperadas) => {
    expect(ordenado(invalidadas(llaves))).toEqual(ordenado(esperadas))
  })

  it('ninguna invalidación toca los binarios', () => {
    for (const llaves of Object.values(invalidaciones)) {
      const tocadas = invalidadas((llaves as (...a: string[]) => QueryKey[])('p1', 's1'))
      expect(tocadas.filter((n) => ARCHIVOS.includes(n))).toEqual([])
    }
  })
})
