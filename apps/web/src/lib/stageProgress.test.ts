import { describe, expect, it } from 'vitest'
import { avanceDeStages, timelineDeStages } from './stageProgress'

const etapa = (sequenceOrder: number, name: string, state: string) => ({
  sequenceOrder,
  name,
  state
})

describe('avanceDeStages', () => {
  it('sin etapas no hay avance que afirmar', () => {
    expect(avanceDeStages([])).toBe(0)
  })

  it('cuenta completadas sobre el total', () => {
    expect(
      avanceDeStages([
        { state: 'Completed' },
        { state: 'Completed' },
        { state: 'InProgress' },
        { state: 'Pending' }
      ])
    ).toBe(50)
  })

  it('redondea, no trunca', () => {
    expect(
      avanceDeStages([{ state: 'Completed' }, { state: 'Pending' }, { state: 'Pending' }])
    ).toBe(33)
  })

  it('todas completadas es 100', () => {
    expect(avanceDeStages([{ state: 'Completed' }, { state: 'Completed' }])).toBe(100)
  })
})

describe('timelineDeStages', () => {
  it('la etapa en curso es la actual', () => {
    const out = timelineDeStages([
      etapa(1, 'Excavación', 'Completed'),
      etapa(2, 'Estructura', 'InProgress'),
      etapa(3, 'Terminaciones', 'Pending')
    ])
    expect(out.map((s) => s.state)).toEqual(['completed', 'current', 'pending'])
  })

  it('una etapa observada también es la actual', () => {
    const out = timelineDeStages([
      etapa(1, 'Excavación', 'Completed'),
      etapa(2, 'Estructura', 'Observed')
    ])
    expect(out[1]?.state).toBe('current')
  })

  it('en curso gana sobre el primer no completado', () => {
    const out = timelineDeStages([
      etapa(1, 'Excavación', 'Pending'),
      etapa(2, 'Estructura', 'InProgress')
    ])
    expect(out.map((s) => s.state)).toEqual(['pending', 'current'])
  })

  it('sin ninguna en curso, la actual es la primera sin completar', () => {
    const out = timelineDeStages([
      etapa(1, 'Excavación', 'Completed'),
      etapa(2, 'Estructura', 'Pending'),
      etapa(3, 'Terminaciones', 'Pending')
    ])
    expect(out.map((s) => s.state)).toEqual(['completed', 'current', 'pending'])
  })

  it('con todas completadas no hay actual', () => {
    const out = timelineDeStages([
      etapa(1, 'Excavación', 'Completed'),
      etapa(2, 'Obra', 'Completed')
    ])
    expect(out.every((s) => s.state === 'completed')).toBe(true)
  })

  it('sin etapas devuelve la lista vacía', () => {
    expect(timelineDeStages([])).toEqual([])
  })
})
