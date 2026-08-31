import { describe, expect, it } from 'vitest'
import { slugify } from './developer.project.new'

// El guion inicial del archivo lo mantiene fuera del generador de rutas: un
// `*.test.ts` dentro de `routes/` se escanea como ruta y avisa "does not export
// a Route" (apps/web/CLAUDE.md §Trampas).

describe('slugify', () => {
  it('normaliza a minúsculas separadas por guiones', () => {
    expect(slugify('Torres del Palermo')).toBe('torres-del-palermo')
  })

  // El default del producto es es-AR: un nombre con acentos o eñe es el caso
  // NORMAL, no el borde. Sin normalizar NFD, "Añasco" daba "a-asco".
  it('saca los diacríticos en vez de comerse la letra', () => {
    expect(slugify('Añasco Güemes Ñandú')).toBe('anasco-guemes-nandu')
  })

  it('colapsa la puntuación y no deja guiones colgando', () => {
    expect(slugify('  ¡Edificio "Río" — 2da etapa!  ')).toBe('edificio-rio-2da-etapa')
  })

  // Lo que habilita el submit es que el slug tenga algo: un nombre que solo
  // tiene símbolos no produce proyecto.
  it('devuelve vacío cuando no queda nada utilizable', () => {
    expect(slugify('¿¡—!?')).toBe('')
  })
})
