import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

type Api = typeof import('./port').api
type Port = typeof import('./port')
type Caso = (() => unknown)[]

const ORIGEN = 'https://api.contract-test.example'

interface Operacion {
  parameters?: { name: string; in: string }[]
  requestBody?: { content: Record<string, { schema?: EsquemaJson }> }
}
interface EsquemaJson {
  type?: string
  properties?: Record<string, unknown>
  required?: string[]
}

const DOC = JSON.parse(
  readFileSync(
    resolve(process.cwd(), '../../specs/evidencia-m3/2-api/openapi/propnexus.openapi.json'),
    'utf8'
  )
) as { paths: Record<string, Record<string, Operacion>> }

const PLANTILLAS = Object.keys(DOC.paths)
  .map((plantilla) => ({
    plantilla,
    parametros: (plantilla.match(/\{/g) ?? []).length,
    regex: new RegExp(
      `^${plantilla.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{[^}]+\}/g, '[^/]+')}$`
    )
  }))
  .sort((a, b) => a.parametros - b.parametros)

interface Captura {
  metodo: string
  url: URL
  cuerpo: unknown
  multipart: boolean
}

let capturas: Captura[] = []
let api: Api
let projectCoverUrl: Port['projectCoverUrl']

beforeAll(async () => {
  vi.stubEnv('VITE_API_ORIGIN', ORIGEN)
  vi.resetModules()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const multipart = init.body instanceof FormData
      capturas.push({
        metodo: (init.method ?? 'GET').toUpperCase(),
        url: new URL(url, 'http://relativa.invalid'),
        cuerpo: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
        multipart
      })
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
  )
  const port = await import('./port')
  api = port.api
  projectCoverUrl = port.projectCoverUrl
})

afterAll(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const CASOS: Record<keyof Api, Caso> = {
  login: [() => api.login('a@b.co', 'x')],
  me: [() => api.me()],
  listProjects: [
    () => api.listProjects(),
    () =>
      api.listProjects({ status: 'in_progress', q: 'x', bbox: '0,0,1,1', sort: 'name', city: 'c' })
  ],
  getDeveloperKpis: [() => api.getDeveloperKpis()],
  getCertifierKpis: [() => api.getCertifierKpis()],
  getCertifierAssignments: [() => api.getCertifierAssignments()],
  getNotaryKpis: [() => api.getNotaryKpis()],
  getNotaryPendingDossiers: [() => api.getNotaryPendingDossiers()],
  getProject: [() => api.getProject('p1')],
  getProjectDeveloper: [() => api.getProjectDeveloper('p1')],
  setMilestoneState: [() => api.setMilestoneState('s1', 'InProgress')],
  listDeveloperProjects: [() => api.listDeveloperProjects()],
  getDeveloperProject: [() => api.getDeveloperProject('p1')],
  uploadStageEvidence: [() => api.uploadStageEvidence('p1', 's1', new FormData())],
  listAuditLog: [() => api.listAuditLog(), () => api.listAuditLog({ category: 'c', cursor: 'k' })],
  listDeveloperUnits: [() => api.listDeveloperUnits()],
  listProjectUnits: [() => api.listProjectUnits('p1')],
  createProjectUnit: [() => api.createProjectUnit('p1', { unitReference: 'A-1' })],
  updateUnit: [() => api.updateUnit('u1', { floor: 2 })],
  listProjectContracts: [() => api.listProjectContracts('p1')],
  createInvitation: [
    () =>
      api.createInvitation('p1', {
        unitId: 'u1',
        investorEmail: 'a@b.co',
        amountMinorUnits: 100,
        currency: 'USD'
      })
  ],
  getDeveloperProgress: [() => api.getDeveloperProgress()],
  listInvestors: [() => api.listInvestors()],
  getCapitalSummary: [() => api.getCapitalSummary()],
  getCapitalMonthly: [() => api.getCapitalMonthly()],
  getCapitalByProject: [() => api.getCapitalByProject()],
  uploadProjectCover: [
    () => api.uploadProjectCover('p1', new File(['x'], 'render.png', { type: 'image/png' }))
  ],
  createProject: [
    () => api.createProject({ name: 'n', slug: 's', latitude: -34.6, longitude: -58.4 })
  ],
  geocodeAddress: [() => api.geocodeAddress('Av. del Libertador 7200')],
  listDeveloperDocuments: [
    () => api.listDeveloperDocuments(),
    () => api.listDeveloperDocuments('pending')
  ],
  anchorDocument: [() => api.anchorDocument('e1')],
  listInvestorUnits: [() => api.listInvestorUnits()],
  listProjectDocuments: [() => api.listProjectDocuments('p1')],
  listProjectStages: [() => api.listProjectStages('p1')],
  getProjectStage: [() => api.getProjectStage('p1', 's1')],
  getBuildingSchematic: [() => api.getBuildingSchematic('p1')],
  listFavorites: [() => api.listFavorites()],
  addFavorite: [() => api.addFavorite('p1')],
  removeFavorite: [() => api.removeFavorite('p1')],
  getInvestorUnit: [() => api.getInvestorUnit('u1')],
  getInvestorUnitNews: [() => api.getInvestorUnitNews('u1')],
  getInvestorContract: [() => api.getInvestorContract('u1')],
  listContractReleases: [() => api.listContractReleases('c1')],
  getUnitDossier: [() => api.getUnitDossier('u1')],
  exportUnitDossier: [() => api.exportUnitDossier('u1')],
  shareUnitDossier: [() => api.shareUnitDossier('u1')],
  getPublicDossier: [() => api.getPublicDossier('tok')],
  getBundleFiles: [() => api.getBundleFiles('b1')],
  getMerkleProof: [() => api.getMerkleProof('b1', 'ab'.repeat(32))],
  getInvitation: [() => api.getInvitation('i1')],
  acceptInvitation: [() => api.acceptInvitation('i1')],
  declineInvitation: [() => api.declineInvitation('i1')],
  listNotifications: [
    () => api.listNotifications(),
    () => api.listNotifications({ unitId: 'u1', category: 'stage' })
  ],
  markNotificationRead: [() => api.markNotificationRead('n1')],
  getUnreadCount: [() => api.getUnreadCount()],
  getCertifierStage: [() => api.getCertifierStage('s1')],
  certifyStage: [() => api.certifyStage('s1')],
  listUsers: [() => api.listUsers()],
  listProjectCertifierInvitations: [() => api.listProjectCertifierInvitations('p1')],
  inviteCertifier: [() => api.inviteCertifier('p1', 'u1')],
  getMyCertifierInvitations: [() => api.getMyCertifierInvitations()],
  acceptCertifierInvitation: [() => api.acceptCertifierInvitation('i1')],
  declineCertifierInvitation: [() => api.declineCertifierInvitation('i1')],
  observeStage: [() => api.observeStage('s1', 'nota')],
  listCertificates: [() => api.listCertificates(), () => api.listCertificates('k')],
  getDossier: [() => api.getDossier('d1')],
  signDossier: [() => api.signDossier('d1')],
  rejectDossier: [() => api.rejectDossier('d1', 'nota')],
  listSignatures: [() => api.listSignatures(), () => api.listSignatures('k')],
  getProfile: [() => api.getProfile()],
  updateProfile: [() => api.updateProfile('Nombre')],
  updateNotificationPrefs: [() => api.updateNotificationPrefs({})],
  downloadEvidence: [() => api.downloadEvidence('e1')]
}

async function capturar(llamada: () => unknown): Promise<Captura> {
  capturas = []
  await llamada()
  expect(capturas, 'el método debe hacer exactamente un fetch').toHaveLength(1)
  return capturas[0] as Captura
}

describe('ApiPort contra el OpenAPI de la API', () => {
  it('CASOS cubre exactamente los métodos de `api` (nada sin contrastar, nada de más)', () => {
    expect(Object.keys(CASOS).sort()).toEqual(Object.keys(api).sort())
  })

  for (const [metodo, llamadas] of Object.entries(CASOS)) {
    llamadas.forEach((llamada, i) => {
      it(`${metodo} #${i + 1}: verbo, path, filtros y cuerpo existen en el contrato`, async () => {
        const c = await capturar(llamada)

        expect(c.url.origin, 'la URL tiene que salir de VITE_API_ORIGIN').toBe(ORIGEN)

        const ruta = PLANTILLAS.find((p) => p.regex.test(c.url.pathname))
        expect(ruta, `${c.metodo} ${c.url.pathname} no existe en el OpenAPI`).toBeDefined()

        const operacion = DOC.paths[ruta?.plantilla ?? '']?.[c.metodo.toLowerCase()]
        expect(
          operacion,
          `${c.url.pathname} existe pero no acepta ${c.metodo} (la API la declara con otro verbo)`
        ).toBeDefined()

        const declarados = (operacion?.parameters ?? [])
          .filter((p) => p.in === 'query')
          .map((p) => p.name)
        for (const clave of c.url.searchParams.keys()) {
          expect(
            declarados,
            `el filtro "${clave}" no está declarado en ${ruta?.plantilla}`
          ).toContain(clave)
        }

        if (c.multipart) {
          expect(operacion?.requestBody, 'la ruta no declara cuerpo').toBeDefined()
          return
        }
        if (c.cuerpo === undefined || Object.keys(c.cuerpo as object).length === 0) return

        const esquema = operacion?.requestBody?.content['application/json']?.schema
        expect(esquema, `${c.metodo} ${ruta?.plantilla} no declara un cuerpo JSON`).toBeDefined()
        const enviadas = Object.keys(c.cuerpo as object)
        if (esquema?.properties) {
          for (const clave of enviadas) {
            expect(
              Object.keys(esquema.properties),
              `el campo "${clave}" no existe en el cuerpo de ${ruta?.plantilla}`
            ).toContain(clave)
          }
        }
        for (const clave of esquema?.required ?? []) {
          expect(enviadas, `falta el campo obligatorio "${clave}"`).toContain(clave)
        }
      })
    })
  }
})

describe('projectCoverUrl (D-099): la URL que pide el <img>, sin fetch', () => {
  it('apunta a una ruta GET del contrato, en el origen de la API, con `v` declarado', () => {
    const url = new URL(projectCoverUrl('p1', '2026-09-30T12:00:00.000Z') ?? '')
    expect(url.origin).toBe(ORIGEN)
    expect(url.searchParams.get('v')).toBe('2026-09-30T12:00:00.000Z')

    const ruta = PLANTILLAS.find((p) => p.regex.test(url.pathname))
    const operacion = DOC.paths[ruta?.plantilla ?? '']?.get
    expect(operacion, `${url.pathname} no existe como GET en el OpenAPI`).toBeDefined()
    expect((operacion?.parameters ?? []).map((p) => p.name)).toContain('v')
  })

  it('sin portada no hay URL', () => {
    expect(projectCoverUrl('p1', null)).toBeNull()
  })
})
