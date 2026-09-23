import { describe, expect, it } from 'vitest'
import { ApiError } from '#/api/port'
import {
  anclajeVigenteDelStage,
  claveEstadoStage,
  claveNovedad,
  confirmacionesNuevas,
  esFoto,
  formatoArchivo,
  intervaloDeNovedades,
  reintentarSiNoEsAusencia,
  unicosPorStageId
} from './investor'

describe('unicosPorStageId', () => {
  it('deja un stage por id y prefiere el que trae TXID', () => {
    const out = unicosPorStageId([
      { stageId: 'a', sequenceOrder: 1, txid: null },
      { stageId: 'b', sequenceOrder: 2, txid: null },
      { stageId: 'b', sequenceOrder: 2, txid: 'abc' },
      { stageId: 'b', sequenceOrder: 2, txid: null }
    ])
    expect(out).toEqual([
      { stageId: 'a', sequenceOrder: 1, txid: null },
      { stageId: 'b', sequenceOrder: 2, txid: 'abc' }
    ])
  })
})

describe('anclajeVigenteDelStage', () => {
  // `events` llega ordenado por eventIndex asc, así que un `.find()` devuelve
  // la transición más vieja. Es el shape real de "Terminaciones" de torre-a.
  const hilo = [
    { eventType: 'STAGE_CREATED', txid: 'mint' },
    { eventType: 'STAGE_TRANSITION', txid: 'b28eb6cf' },
    { eventType: 'EVIDENCE_ANCHOR', txid: 'ddafe9e1' },
    { eventType: 'EVIDENCE_ANCHOR', txid: 'ae521653' },
    { eventType: 'STAGE_TRANSITION', txid: 'e842c8ac' }
  ]

  it('devuelve la ÚLTIMA transición anclada, no la primera', () => {
    expect(anclajeVigenteDelStage(hilo)?.txid).toBe('e842c8ac')
  })

  it('ignora los anclajes de evidencia, que no son transiciones', () => {
    expect(anclajeVigenteDelStage(hilo)?.eventType).toBe('STAGE_TRANSITION')
  })

  it('ignora una transición sin TXID: sin prueba no hay señal (regla 17)', () => {
    const conFallido = [...hilo, { eventType: 'STAGE_TRANSITION', txid: null }]
    expect(anclajeVigenteDelStage(conFallido)?.txid).toBe('e842c8ac')
  })

  it('devuelve undefined si el stage no tiene ninguna transición anclada', () => {
    expect(anclajeVigenteDelStage([{ eventType: 'STAGE_CREATED', txid: 'mint' }])).toBeUndefined()
    expect(anclajeVigenteDelStage([])).toBeUndefined()
  })
})

describe('intervaloDeNovedades', () => {
  it('pollea cada 10s si hay un evento Pending', () => {
    expect(intervaloDeNovedades([{ status: 'Pending' }])).toBe(10_000)
  })

  it('pollea si CUALQUIERA de varios eventos sigue Pending', () => {
    expect(intervaloDeNovedades([{ status: 'Confirmed' }, { status: 'Pending' }])).toBe(10_000)
  })

  it('no pollea si todo ya confirmó: nada que reconciliar', () => {
    expect(intervaloDeNovedades([{ status: 'Confirmed' }, { status: 'Confirmed' }])).toBe(false)
  })

  it('no pollea con la lista vacía', () => {
    expect(intervaloDeNovedades([])).toBe(false)
  })

  it('no pollea mientras `news` no cargó todavía (undefined)', () => {
    expect(intervaloDeNovedades(undefined)).toBe(false)
  })
})

describe('confirmacionesNuevas', () => {
  it('cuenta un evento que pasó de Pending a Confirmed', () => {
    const previo = [{ id: 'a', status: 'Pending' }]
    const actual = [{ id: 'a', status: 'Confirmed' }]
    expect(confirmacionesNuevas(previo, actual)).toBe(1)
  })

  it('agrega varias confirmaciones nuevas en un solo número, no una lista', () => {
    const previo = [
      { id: 'a', status: 'Pending' },
      { id: 'b', status: 'Pending' },
      { id: 'c', status: 'Confirmed' }
    ]
    const actual = [
      { id: 'a', status: 'Confirmed' },
      { id: 'b', status: 'Confirmed' },
      { id: 'c', status: 'Confirmed' }
    ]
    expect(confirmacionesNuevas(previo, actual)).toBe(2)
  })

  it('no cuenta un evento que ya estaba Confirmed', () => {
    const previo = [{ id: 'a', status: 'Confirmed' }]
    const actual = [{ id: 'a', status: 'Confirmed' }]
    expect(confirmacionesNuevas(previo, actual)).toBe(0)
  })

  it('no cuenta un evento nuevo que aparece directamente Confirmed (sin Pending previo)', () => {
    expect(confirmacionesNuevas([], [{ id: 'a', status: 'Confirmed' }])).toBe(0)
  })

  it('no cuenta un evento que sigue Pending', () => {
    const previo = [{ id: 'a', status: 'Pending' }]
    expect(confirmacionesNuevas(previo, previo)).toBe(0)
  })
})

describe('reintentarSiNoEsAusencia', () => {
  it('no reintenta un 403 ni un 404: son la respuesta', () => {
    expect(reintentarSiNoEsAusencia(0, new ApiError(403, 'x'))).toBe(false)
    expect(reintentarSiNoEsAusencia(0, new ApiError(404, 'x'))).toBe(false)
  })

  it('reintenta hasta dos veces otro error de la API y cualquier error que no sea de la API', () => {
    expect(reintentarSiNoEsAusencia(0, new ApiError(500, 'x'))).toBe(true)
    expect(reintentarSiNoEsAusencia(2, new ApiError(500, 'x'))).toBe(false)
    expect(reintentarSiNoEsAusencia(1, new Error('red'))).toBe(true)
  })
})

describe('esFoto', () => {
  it('es foto por tipo de evidencia o por MIME de imagen', () => {
    expect(esFoto('photo', 'application/pdf')).toBe(true)
    expect(esFoto('document', 'image/png')).toBe(true)
    expect(esFoto('document', 'application/pdf')).toBe(false)
  })
})

describe('formatoArchivo', () => {
  it.each([
    ['application/pdf', 'PDF'],
    ['image/jpeg', 'JPEG'],
    ['image/jpg', 'JPEG'],
    ['image/png', 'PNG'],
    ['application/zip', 'inspection']
  ])('%s → %s', (mime, esperado) => {
    expect(formatoArchivo(mime, 'inspection')).toBe(esperado)
  })
})

describe('claveNovedad', () => {
  it('traduce un tipo conocido y cae a la genérica con uno desconocido', () => {
    expect(claveNovedad('STAGE_TRANSITION')).toBe('investor.news.STAGE_TRANSITION')
    expect(claveNovedad('TIPO_NUEVO')).toBe('investor.news.generic')
  })
})

describe('claveEstadoStage', () => {
  it.each(['Pending', 'InProgress', 'Observed', 'Completed'] as const)('%s', (estado) => {
    expect(claveEstadoStage(estado)).toBe(`stage.state.${estado}`)
  })
})
