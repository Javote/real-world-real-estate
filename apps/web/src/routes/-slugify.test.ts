import { describe, expect, it } from 'vitest'
import { slugify } from './developer.project.new'

describe('slugify', () => {
  it('normaliza a minúsculas separadas por guiones', () => {
    expect(slugify('Torres del Palermo')).toBe('torres-del-palermo')
  })

  it('saca los diacríticos en vez de comerse la letra', () => {
    expect(slugify('Añasco Güemes Ñandú')).toBe('anasco-guemes-nandu')
  })

  it('colapsa la puntuación y no deja guiones colgando', () => {
    expect(slugify('  ¡Edificio "Río" — 2da etapa!  ')).toBe('edificio-rio-2da-etapa')
  })

  it('devuelve vacío cuando no queda nada utilizable', () => {
    expect(slugify('¿¡—!?')).toBe('')
  })
})
