// El Merkle root de un bundle de evidencia: `bundle_commitment_hash` de
// `M1-D2/2-core-domain-model.puml`.
//
// **Vive en `shared` y no en la API** porque su razón de ser es que alguien de
// afuera pueda reproducirlo. M1-D1 §Verification Blueprint promete que un
// tercero recalcula el hash de los archivos y lo compara con lo anclado; si la
// regla de armado del árbol vive escondida en una ruta del backend, esa promesa
// no se puede cumplir sin confiar en nosotros — que es justo lo que el producto
// dice no pedir.
//
// La función de hash se INYECTA: este package lo compilan la API y el browser
// con `lib: ["ES2022"]` pelado, así que no puede importar `node:crypto`. El
// servidor le pasa SHA-256 de Node; una futura pantalla de verificación le
// pasaría el de WebCrypto.

/** Toma dos hashes en hex y devuelve el hash de su concatenación, en hex. */
export type PairHasher = (leftHex: string, rightHex: string) => string;

export const MERKLE_LEAF_HEX_LENGTH = 64;

function assertLeaf(leaf: string): void {
  if (!/^[0-9a-f]{64}$/.test(leaf)) {
    throw new Error(`Una hoja del árbol tiene que ser SHA-256 en hex minúscula, y llegó: ${leaf}`);
  }
}

/**
 * Raíz del árbol.
 *
 * Dos reglas que no son estéticas y hay que respetar para reproducirlo:
 *
 * 1. **Las hojas se ordenan** ascendente por su hex. Así el root no depende del
 *    orden en que se subieron los archivos, que es un dato accidental: dos
 *    personas con el mismo conjunto de evidencia obtienen el mismo root.
 * 2. **El nodo impar sube solo**, no se duplica. Duplicarlo —el estilo Bitcoin—
 *    hace que dos conjuntos distintos de hojas puedan dar el mismo root.
 */
export function merkleRoot(leaves: readonly string[], hashPair: PairHasher): string {
  if (leaves.length === 0) {
    throw new Error("Un bundle sin evidencia no tiene commitment: no hay nada que anclar");
  }

  for (const leaf of leaves) assertLeaf(leaf);

  let nivel = [...leaves].sort();

  while (nivel.length > 1) {
    const siguiente: string[] = [];
    for (let i = 0; i < nivel.length; i += 2) {
      const izq = nivel[i] as string;
      const der = nivel[i + 1];
      // Impar: sube solo, sin duplicarse.
      siguiente.push(der === undefined ? izq : hashPair(izq, der));
    }
    nivel = siguiente;
  }

  return nivel[0] as string;
}
