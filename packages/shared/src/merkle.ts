export type PairHasher = (leftHex: string, rightHex: string) => string;

export const MERKLE_LEAF_HEX_LENGTH = 64;

function assertLeaf(leaf: string): void {
  if (!/^[0-9a-f]{64}$/.test(leaf)) {
    throw new Error(`Una hoja del árbol tiene que ser SHA-256 en hex minúscula, y llegó: ${leaf}`);
  }
}

// Las hojas se ordenan y el nodo impar sube solo, sin duplicarse: si no, la raíz no es reproducible.
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
      siguiente.push(der === undefined ? izq : hashPair(izq, der));
    }
    nivel = siguiente;
  }

  return nivel[0] as string;
}

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

export function merkleRootFromProof(
  leaf: string,
  proof: readonly MerkleStep[],
  hashPair: PairHasher
): string {
  assertLeaf(leaf);
  for (const paso of proof) assertLeaf(paso.sibling);

  return proof.reduce(
    (acc, paso) =>
      paso.position === "right" ? hashPair(acc, paso.sibling) : hashPair(paso.sibling, acc),
    leaf
  );
}
