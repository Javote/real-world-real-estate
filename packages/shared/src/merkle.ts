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

/**
 * El camino de prueba de una hoja hasta la raíz.
 *
 * **Es lo que vuelve real la promesa de M2-D4 Pattern 5**: *"To verify any
 * single file, a reviewer can re-compute the file hash, walk the Merkle path,
 * and check that the root matches the anchored value."* Sin el camino, el root
 * prueba el conjunto pero nadie puede verificar **su** archivo sin bajarse todos
 * los demás.
 *
 * Cada paso dice con qué hermano combinar y de qué lado va, porque el orden
 * importa: `hash(A+B)` no es `hash(B+A)`.
 */
export interface MerkleStep {
  sibling: string;
  position: "left" | "right";
}

export function merkleProof(
  leaves: readonly string[],
  leaf: string,
  hashPair: PairHasher
): MerkleStep[] {
  for (const l of leaves) assertLeaf(l);
  assertLeaf(leaf);

  let nivel = [...leaves].sort();
  let indice = nivel.indexOf(leaf);
  if (indice === -1) {
    throw new Error("Esa hoja no está en el bundle: no hay camino que probar");
  }

  const camino: MerkleStep[] = [];

  while (nivel.length > 1) {
    const siguiente: string[] = [];
    for (let i = 0; i < nivel.length; i += 2) {
      const izq = nivel[i] as string;
      const der = nivel[i + 1];

      if (der === undefined) {
        // Nodo impar: sube solo, así que no agrega paso al camino.
        siguiente.push(izq);
        if (i === indice) indice = siguiente.length - 1;
        continue;
      }

      if (i === indice) camino.push({ sibling: der, position: "right" });
      else if (i + 1 === indice) camino.push({ sibling: izq, position: "left" });

      siguiente.push(hashPair(izq, der));
      if (i === indice || i + 1 === indice) indice = siguiente.length - 1;
    }
    nivel = siguiente;
  }

  return camino;
}

/** Rehace la raíz desde una hoja y su camino. Es lo que corre el verificador. */
export function merkleRootFromProof(
  leaf: string,
  proof: readonly MerkleStep[],
  hashPair: PairHasher
): string {
  return proof.reduce(
    (acc, paso) =>
      paso.position === "right" ? hashPair(acc, paso.sibling) : hashPair(paso.sibling, acc),
    leaf
  );
}
