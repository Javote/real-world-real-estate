import type { api } from '#/api/port'

type Salida<M extends keyof typeof api> = Awaited<ReturnType<(typeof api)[M]>>

type Dossier = Salida<'getDossier'>
type DossierPublico = Salida<'getPublicDossier'>
type Pendiente = Salida<'getNotaryPendingDossiers'>[number]
type Firma = Salida<'listSignatures'>['items'][number]

// Los fixtures del módulo dossier, con la forma que llega por el cable (las fechas, `string`): cada
// test pisa solo lo que le importa.
export const fabrica = {
  dossier: (pisar: Partial<Dossier> = {}): Dossier => ({
    id: 'd1',
    unitId: 'u1',
    unitReference: 'Torre A · 4B',
    projectId: 'p1',
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

  pendiente: (pisar: Partial<Pendiente> = {}): Pendiente => ({
    dossierId: 'd1',
    unitLabel: 'Torre A · 4B',
    investorName: 'Ana Torres',
    completeness: 60,
    ...pisar
  }),

  firma: (pisar: Partial<Firma> = {}): Firma => ({
    dossierId: 'd1',
    unitReference: 'Torre A · 4B',
    projectName: 'Torre A',
    masterHash: 'a'.repeat(64),
    signatureTxid: null,
    signedAt: null,
    status: 'compiled',
    ...pisar
  })
}
