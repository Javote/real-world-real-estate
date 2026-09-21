// El contrato de `ApiPort` contra el OpenAPI que publica la API.
//
// `port.ts` es el único lugar que arma URLs, verbos, cuerpos y filtros — a
// mano. Los TIPOS de respuesta ya se derivan de `packages/shared`
// (`Serialized<T>`, SPEC-109), pero el emparejamiento "este método pega contra
// esta ruta" se sostenía solo por disciplina: renombrar una ruta, mover un
// filtro o agregar un campo obligatorio en la API dejaba al front compilando y
// fallando en runtime con un 404 o un 400.
//
// Este test ejecuta CADA método de `api` con un `fetch` falso, captura el
// request que arma y lo cruza contra `specs/openapi/propnexus.openapi.json` —
// el mismo documento que la API genera desde sus procedimientos y cuya
// frescura ya fija `apps/api/test/openapi-freshness.test.ts`. Así el drift se
// vuelve un test rojo y no un 4xx en producción.
//
// **Lo que NO cubre, a propósito (SPEC-111):** que el TIPO de respuesta de un
// método sea el schema de esa ruta. Eso sigue siendo `request<T>` a mano.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

type Api = typeof import('./port').api
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
  // jsdom hace que `import.meta.url` sea http: el path sale del cwd, que vitest
  // fija en `apps/web` (donde vive `vitest.config.ts`).
  readFileSync(resolve(process.cwd(), '../../specs/openapi/propnexus.openapi.json'), 'utf8')
) as { paths: Record<string, Record<string, Operacion>> }

// Un path de OpenAPI (`/x/{id}`) como regex. Ante dos plantillas que matchean
// (`/dossiers/pending` y `/dossiers/{id}`) gana la que tiene MENOS parámetros:
// la más literal.
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

beforeAll(async () => {
  // `API_BASE` se lee al cargar el módulo: hay que fijar el origen ANTES del import.
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
  api = (await import('./port')).api
})

afterAll(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

// Un caso por cada forma de llamar a un método. Tipado como `Record<keyof Api>`:
// agregar un método a `api` sin su entrada acá es un error de `tsc`, no un
// método que nadie contrasta.
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
  createProject: [() => api.createProject({ name: 'n', slug: 's' })],
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

        // En producción el web vive en otro origen (D-065): una URL relativa
        // pega contra el sitio estático, no contra la API.
        expect(c.url.origin, 'la URL tiene que salir de VITE_API_ORIGIN').toBe(ORIGEN)

        const ruta = PLANTILLAS.find((p) => p.regex.test(c.url.pathname))
        expect(ruta, `${c.metodo} ${c.url.pathname} no existe en el OpenAPI`).toBeDefined()

        const operacion = DOC.paths[ruta?.plantilla ?? '']?.[c.metodo.toLowerCase()]
        expect(
          operacion,
          `${c.url.pathname} existe pero no acepta ${c.metodo} (la API la declara con otro verbo)`
        ).toBeDefined()

        // Cada filtro que manda el front tiene que estar declarado en la ruta.
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

        // Cuerpo JSON: la ruta lo declara, no manda claves que ella no conozca
        // y no se olvida de un campo que ella exige.
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
