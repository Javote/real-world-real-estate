// **El único lugar del front donde el dinero cambia de unidad hacia arriba.**
//
// Todo lo demás va en la dirección de la presentación —`formatCurrency` divide
// por 100 y se lo da a `Intl`—, que es inofensiva porque el resultado se
// muestra y se descarta. Esta va al revés: lo que sale de acá se persiste y
// termina en un contrato, así que es donde la regla 1 se sostiene o se pierde.
//
// **Por qué no alcanza `Math.round(major * 100)`.** Para los montos reales da
// exacto, y ese nunca fue el problema. El problema es que `285000.567` entra
// sin chistar y sale `28500057`: el tercer decimal se pierde en silencio, y
// nadie —ni quien lo tipeó ni quien firma después— se entera de que el monto
// registrado no es el que se escribió. Un monto no se redondea por nuestra
// cuenta; o es representable, o se rechaza.

/** Cuántos decimales admite una unidad mayor. Hoy fijo: no hay JPY ni KWD. */
const DECIMALES = 2

/**
 * Unidades mayores → unidades mínimas enteras.
 *
 * Devuelve `null` cuando el valor **no se puede representar sin inventar
 * precisión**: no finito, negativo, con más de dos decimales, o tan grande que
 * el entero resultante deja de ser exacto. `null` es "esto no es un monto", y
 * quien llama lo trata como error de validación — nunca como cero.
 */
export function majorToMinor(major: number | null): number | null {
  if (major === null || !Number.isFinite(major) || major < 0) return null

  // El corte se hace sobre el DECIMAL, no sobre el producto: `toFixed` sobre
  // el número ya multiplicado llegaría tarde, con el error de punto flotante
  // adentro. Acá `285000.567` se detecta antes de multiplicar nada.
  const [entera, decimal = ''] = major.toString().split('.')
  if (decimal.includes('e') || entera.includes('e')) return null
  if (decimal.length > DECIMALES) return null

  const minor = Number(entera) * 10 ** DECIMALES + Number(decimal.padEnd(DECIMALES, '0'))
  return Number.isSafeInteger(minor) ? minor : null
}

/**
 * Unidades mínimas → el número que se muestra en un campo de carga.
 *
 * Es la inversa de `majorToMinor` y solo se usa para PREFILLAR un input: el
 * valor que se envía siempre vuelve a pasar por `majorToMinor`.
 */
export function minorToMajor(minor: number): number {
  return minor / 10 ** DECIMALES
}
