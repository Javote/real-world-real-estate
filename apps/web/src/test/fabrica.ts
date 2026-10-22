import type { api } from '#/api/port'

type Salida<M extends keyof typeof api> = Awaited<ReturnType<(typeof api)[M]>>

type Dossier = Salida<'getDossier'>
type DossierPublico = Salida<'getPublicDossier'>
type Pendiente = Salida<'getNotaryPendingDossiers'>[number]
type Firma = Salida<'listSignatures'>['items'][number]

// Un fixture escribe sus ids como `string`; la fábrica los devuelve con la marca que trae la API.
type ConIds<T, K extends keyof T> = Partial<Omit<T, K>> & { [P in K]?: string }

// Los fixtures del módulo dossier, con la forma que llega por el cable (las fechas, `string`; los ids,
// con marca): cada test pisa solo lo que le importa.
export const fabrica = {
  dossier: ({
    id = 'd1',
    unitId = 'u1',
    projectId = 'p1',
    ...pisar
  }: ConIds<Dossier, 'id' | 'unitId' | 'projectId'> = {}): Dossier => ({
    id: id as Dossier['id'],
    unitId: unitId as Dossier['unitId'],
    unitReference: 'Torre A · 4B',
    projectId: projectId as Dossier['projectId'],
    projectName: 'Torre A',
    masterHash: 'a'.repeat(64),
    compiledAt: '2026-09-01T00:00:00.000Z',
    status: 'compiled',
    artifacts: [],
    completeness: 40,
    signatureTxid: null,
    signedAt: null,
    rejectionNote: null,
    ...pisar
  }),

  dossierPublico: (pisar: Partial<DossierPublico> = {}): DossierPublico => ({
    unitReference: 'Unidad 4B',
    projectName: 'Torre Norte',
    masterHash: 'a'.repeat(64),
    compiledAt: '2026-05-10T12:00:00.000Z',
    status: 'signed',
    completeness: 80,
    signatureTxid: null,
    signedAt: null,
    artifacts: [],
    ...pisar
  }),

  pendiente: ({ dossierId = 'd1', ...pisar }: ConIds<Pendiente, 'dossierId'> = {}): Pendiente => ({
    dossierId: dossierId as Pendiente['dossierId'],
    unitLabel: 'Torre A · 4B',
    investorName: 'Ana Torres',
    completeness: 60,
    ...pisar
  }),

  firma: ({ dossierId = 'd1', ...pisar }: ConIds<Firma, 'dossierId'> = {}): Firma => ({
    dossierId: dossierId as Firma['dossierId'],
    unitReference: 'Torre A · 4B',
    projectName: 'Torre A',
    masterHash: 'a'.repeat(64),
    signatureTxid: null,
    signedAt: null,
    status: 'compiled',
    ...pisar
  })
}
