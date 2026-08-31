import { describe, expect, it } from 'vitest'
import { unicosPorStageId } from './investor'

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
