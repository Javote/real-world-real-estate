import { QueryClient, type QueryKey } from '@tanstack/react-query'
import type { AnyRoute } from '@tanstack/react-router'
import { describe, expect, it, vi } from 'vitest'
import {
  auditoriaQueries,
  capitalQueries,
  certificadoQueries,
  contratoQueries,
  dossierQueries,
  etapaQueries,
  evidenciaQueries,
  favoritoQueries,
  invitacionQueries,
  kpiQueries,
  notificacionQueries,
  proyectoQueries,
  unidadQueries,
  usuarioQueries
} from '#/api/queries'
import { Route as AdminIndex } from './admin.index'
import { Route as CertifierAssigned } from './certifier.assigned'
import { Route as CertifierIndex } from './certifier.index'
import { Route as CertifierIssued } from './certifier.issued'
import { Route as CertifierProfile } from './certifier.profile'
import { Route as CertifierStage } from './certifier.stage.$stageId'
import { Route as DeveloperAuditLog } from './developer.audit-log'
import { Route as DeveloperCapital } from './developer.capital'
import { Route as DeveloperDocumentation } from './developer.documentation'
import { Route as DeveloperIndex } from './developer.index'
import { Route as DeveloperInvestors } from './developer.investors'
import { Route as DeveloperProfile } from './developer.profile'
import { Route as DeveloperProgress } from './developer.progress'
import { Route as DevProjectContracts } from './developer.project.$projectId.contracts'
import { Route as DevProject } from './developer.project.$projectId.index'
import { Route as DevProjectInvite } from './developer.project.$projectId.invite'
import { Route as DevProjectUnits } from './developer.project.$projectId.units'
import { Route as DevProjectUpload } from './developer.project.$projectId.upload'
import { Route as DeveloperProjects } from './developer.projects'
import { Route as DeveloperUnits } from './developer.units'
import { Route as InvestorBuy } from './investor.buy'
import { Route as InvestorFavorites } from './investor.favorites'
import { Route as InvestorNotifications } from './investor.notifications'
import { Route as InvestorProfile } from './investor.profile'
import { Route as UnitContract } from './investor.unit.$unitId.contract'
import { Route as UnitDossier } from './investor.unit.$unitId.dossier'
import { Route as UnitDetail } from './investor.unit.$unitId.index'
import { Route as UnitNotifications } from './investor.unit.$unitId.notifications'
import { Route as InvestorUnits } from './investor.units'
import { Route as NotaryDossier } from './notary.dossier.$dossierId'
import { Route as NotaryDossiers } from './notary.dossiers'
import { Route as NotaryIndex } from './notary.index'
import { Route as NotaryProfile } from './notary.profile'
import { Route as NotarySigned } from './notary.signed'
import { Route as ProjectDeveloper } from './project.$projectId.developer'
import { Route as ProjectDetail } from './project.$projectId.index'
import { Route as ProjectProgress } from './project.$projectId.progress'
import { Route as StageDetail } from './project.$projectId.stage.$stageId'
import { Route as PublicDossier } from './public.dossier.$shareToken'

type Opciones = { queryKey: QueryKey; staleTime?: unknown }
// [ruta, Route, params, search, lo que tiene que precargar]
type Caso = [string, AnyRoute, Record<string, string>, unknown, Opciones[]]

const PERFIL = [usuarioQueries.perfil()]

const CASOS: Caso[] = [
  ['/investor/buy', InvestorBuy, {}, {}, [proyectoQueries.lista({}), favoritoQueries.lista()]],
  [
    '/investor/buy con filtros',
    InvestorBuy,
    {},
    { status: 'in_progress', q: 'torre', sort: 'recent', city: 'CABA', view: 'filter' },
    [
      proyectoQueries.lista({ status: 'in_progress', q: 'torre', sort: 'recent', city: 'CABA' }),
      favoritoQueries.lista()
    ]
  ],
  ['/investor/buy en el mapa', InvestorBuy, {}, { view: 'map' }, [favoritoQueries.lista()]],
  ['/investor/favorites', InvestorFavorites, {}, undefined, [favoritoQueries.lista()]],
  ['/investor/units', InvestorUnits, {}, undefined, [unidadQueries.delInvestor()]],
  ['/investor/profile', InvestorProfile, {}, undefined, PERFIL],
  ['/investor/notifications', InvestorNotifications, {}, {}, [notificacionQueries.lista(null)]],
  [
    '/investor/notifications?invitation',
    InvestorNotifications,
    {},
    { invitation: 'i1' },
    [notificacionQueries.lista(null), invitacionQueries.deInvestor('i1')]
  ],
  [
    '/investor/unit/$unitId',
    UnitDetail,
    { unitId: 'u1' },
    undefined,
    [unidadQueries.detalle('u1')]
  ],
  [
    '/investor/unit/$unitId/contract',
    UnitContract,
    { unitId: 'u1' },
    undefined,
    [unidadQueries.detalle('u1'), contratoQueries.deUnidad('u1')]
  ],
  [
    '/investor/unit/$unitId/dossier',
    UnitDossier,
    { unitId: 'u1' },
    undefined,
    [dossierQueries.deUnidad('u1'), unidadQueries.detalle('u1')]
  ],
  [
    '/investor/unit/$unitId/notifications',
    UnitNotifications,
    { unitId: 'u1' },
    undefined,
    [unidadQueries.detalle('u1'), notificacionQueries.deUnidad('u1', null)]
  ],
  [
    '/project/$projectId: el proyecto y sus documentos, en paralelo',
    ProjectDetail,
    { projectId: 'p1' },
    undefined,
    [proyectoQueries.detalle('p1'), proyectoQueries.documentos('p1'), favoritoQueries.lista()]
  ],
  [
    '/project/$projectId/progress',
    ProjectProgress,
    { projectId: 'p1' },
    undefined,
    [proyectoQueries.detalle('p1'), proyectoQueries.etapas('p1'), proyectoQueries.documentos('p1')]
  ],
  [
    '/project/$projectId/stage/$stageId',
    StageDetail,
    { projectId: 'p1', stageId: 's1' },
    undefined,
    [
      proyectoQueries.etapas('p1'),
      etapaQueries.detalle('p1', 's1'),
      proyectoQueries.documentos('p1')
    ]
  ],
  [
    '/project/$projectId/developer',
    ProjectDeveloper,
    { projectId: 'p1' },
    undefined,
    [proyectoQueries.desarrolladora('p1')]
  ],
  [
    '/public/dossier/$shareToken',
    PublicDossier,
    { shareToken: 't1' },
    undefined,
    [dossierQueries.publico('t1')]
  ],
  ['/developer', DeveloperIndex, {}, undefined, [kpiQueries.developer()]],
  ['/developer/projects', DeveloperProjects, {}, undefined, [proyectoQueries.delDeveloper()]],
  [
    '/developer/units',
    DeveloperUnits,
    {},
    undefined,
    [unidadQueries.delDeveloper(), proyectoQueries.delDeveloper()]
  ],
  ['/developer/investors', DeveloperInvestors, {}, undefined, [usuarioQueries.inversores()]],
  [
    '/developer/capital',
    DeveloperCapital,
    {},
    undefined,
    [capitalQueries.resumen(), capitalQueries.mensual(), capitalQueries.porProyecto()]
  ],
  ['/developer/progress', DeveloperProgress, {}, undefined, [etapaQueries.progreso()]],
  [
    '/developer/documentation',
    DeveloperDocumentation,
    {},
    undefined,
    [evidenciaQueries.delDeveloper()]
  ],
  ['/developer/audit-log', DeveloperAuditLog, {}, undefined, [auditoriaQueries.lista()]],
  ['/developer/profile', DeveloperProfile, {}, undefined, PERFIL],
  [
    '/developer/project/$projectId',
    DevProject,
    { projectId: 'p1' },
    undefined,
    [proyectoQueries.detalleDelDeveloper('p1'), capitalQueries.porProyecto()]
  ],
  [
    '/developer/project/$projectId/units',
    DevProjectUnits,
    { projectId: 'p1' },
    undefined,
    [proyectoQueries.detalleDelDeveloper('p1'), proyectoQueries.unidades('p1')]
  ],
  [
    '/developer/project/$projectId/upload',
    DevProjectUpload,
    { projectId: 'p1' },
    undefined,
    [proyectoQueries.detalleDelDeveloper('p1')]
  ],
  [
    '/developer/project/$projectId/contracts',
    DevProjectContracts,
    { projectId: 'p1' },
    undefined,
    [proyectoQueries.detalleDelDeveloper('p1'), proyectoQueries.contratos('p1')]
  ],
  [
    '/developer/project/$projectId/invite',
    DevProjectInvite,
    { projectId: 'p1' },
    undefined,
    [proyectoQueries.unidades('p1')]
  ],
  [
    '/certifier',
    CertifierIndex,
    {},
    undefined,
    [kpiQueries.certificador(), invitacionQueries.delCertificador(), etapaQueries.asignadas()]
  ],
  ['/certifier/assigned', CertifierAssigned, {}, undefined, [etapaQueries.asignadas()]],
  [
    '/certifier/stage/$stageId',
    CertifierStage,
    { stageId: 's1' },
    undefined,
    [etapaQueries.delCertificador('s1')]
  ],
  ['/certifier/issued', CertifierIssued, {}, undefined, [certificadoQueries.lista()]],
  ['/certifier/profile', CertifierProfile, {}, undefined, PERFIL],
  ['/notary', NotaryIndex, {}, undefined, [kpiQueries.notary(), dossierQueries.pendientes()]],
  ['/notary/dossiers', NotaryDossiers, {}, undefined, [dossierQueries.pendientes()]],
  [
    '/notary/dossier/$dossierId',
    NotaryDossier,
    { dossierId: 'd1' },
    undefined,
    [dossierQueries.detalle('d1')]
  ],
  ['/notary/signed', NotarySigned, {}, undefined, [dossierQueries.firmas()]],
  ['/notary/profile', NotaryProfile, {}, undefined, PERFIL],
  ['/admin', AdminIndex, {}, undefined, [proyectoQueries.lista(), usuarioQueries.lista()]]
]

const forma = (o: Opciones) => ({ queryKey: o.queryKey, staleTime: o.staleTime })

describe('los loaders precargan lo que lee la pantalla, sin esperarlo', () => {
  it.each(CASOS)('%s', (_ruta, ruta, params, search, esperadas) => {
    const queryClient = new QueryClient()
    const prefetch = vi.spyOn(queryClient, 'prefetchQuery').mockResolvedValue()

    const deps = ruta.options.loaderDeps?.({ search })
    const resultado = ruta.options.loader({ context: { queryClient }, params, deps })

    expect(resultado).toBeUndefined()
    expect(prefetch.mock.calls.map(([o]) => forma(o as Opciones))).toEqual(esperadas.map(forma))
  })
})
