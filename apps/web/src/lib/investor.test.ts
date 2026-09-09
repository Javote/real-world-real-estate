import { describe, expect, it } from 'vitest'
import { anclajeVigenteDelStage, unicosPorStageId } from './investor'

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
