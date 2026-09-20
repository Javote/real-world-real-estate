import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { merkleProof, merkleRoot, merkleRootFromProof } from "./merkle";

// El hash que usa la API. Acá se inyecta el de Node; el package en sí no
// importa `node:crypto` porque también lo compila el browser.
const sha256Pair = (a: string, b: string) =>
  createHash("sha256")
    .update(Buffer.from(a + b, "hex"))
    .digest("hex");

const hoja = (n: number) => createHash("sha256").update(`archivo-${n}`).digest("hex");

describe("merkleRoot", () => {
  it("con una sola hoja, el root es la hoja", () => {
    expect(merkleRoot([hoja(1)], sha256Pair)).toBe(hoja(1));
  });

  it("no depende del orden en que se subieron los archivos", () => {
    // El orden de subida es un dato accidental: dos personas con la misma
    // evidencia tienen que llegar al mismo commitment.
    const a = merkleRoot([hoja(1), hoja(2), hoja(3)], sha256Pair);
    const b = merkleRoot([hoja(3), hoja(1), hoja(2)], sha256Pair);
    expect(a).toBe(b);
  });

  it("cambia si cambia un solo archivo", () => {
    const a = merkleRoot([hoja(1), hoja(2)], sha256Pair);
    const b = merkleRoot([hoja(1), hoja(9)], sha256Pair);
    expect(a).not.toBe(b);
  });

  it("distingue conjuntos que el estilo Bitcoin confundiría", () => {
    // Con duplicación de nodo impar, [A,B,C] y [A,B,C,C] dan el mismo root.
    // Subiendo el impar sin duplicar, no.
    const tres = merkleRoot([hoja(1), hoja(2), hoja(3)], sha256Pair);
    const cuatro = merkleRoot([hoja(1), hoja(2), hoja(3), hoja(3)], sha256Pair);
    expect(tres).not.toBe(cuatro);
  });

  it("siempre devuelve 64 caracteres hex, que es lo que el datum acepta", () => {
    for (const n of [1, 2, 3, 5, 8]) {
      const hojas = Array.from({ length: n }, (_, i) => hoja(i));
      expect(merkleRoot(hojas, sha256Pair)).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("un bundle vacío no tiene commitment", () => {
    expect(() => merkleRoot([], sha256Pair)).toThrow(/nada que anclar/);
  });

  it("rechaza una hoja que no sea SHA-256 en hex", () => {
    expect(() => merkleRoot(["no-es-un-hash"], sha256Pair)).toThrow(/SHA-256/);
    expect(() => merkleRoot([hoja(1).toUpperCase()], sha256Pair)).toThrow(/SHA-256/);
  });
});

describe("merkleProof", () => {
  // La promesa de M2-D4 P5: un revisor rehace SU archivo hasta la raíz sin
  // necesitar los demás archivos, solo sus hashes hermanos.
  const hojas = [hoja(1), hoja(2), hoja(3), hoja(4), hoja(5)];
  const root = merkleRoot(hojas, sha256Pair);

  it("el camino de cada hoja reconstruye la raíz anclada", () => {
    for (const h of hojas) {
      const camino = merkleProof(hojas, h, sha256Pair);
      expect(merkleRootFromProof(h, camino, sha256Pair)).toBe(root);
    }
  });

  it("un hash que no está en el bundle no tiene camino", () => {
    expect(() => merkleProof(hojas, hoja(99), sha256Pair)).toThrow(/no está en el bundle/);
  });

  it("el camino no sirve para otra hoja: el orden de combinación importa", () => {
    const camino = merkleProof(hojas, hoja(1), sha256Pair);
    expect(merkleRootFromProof(hoja(2), camino, sha256Pair)).not.toBe(root);
  });

  it("con una sola hoja el camino es vacío y la raíz es la hoja", () => {
    expect(merkleProof([hoja(1)], hoja(1), sha256Pair)).toEqual([]);
  });
});

// SPEC-404 (P-05) — `merkleRootFromProof` es literalmente "lo que corre el
// verificador" (su propio docstring), y era la única de las cuatro funciones
// sin una sola aserción: aceptaba una hoja o un hermano con cualquier forma.
describe("merkleRootFromProof — valida lo que verifica", () => {
  it("rechaza una hoja que no sea SHA-256 en hex", () => {
    expect(() => merkleRootFromProof("no-es-un-hash", [], sha256Pair)).toThrow(/SHA-256/);
  });

  it("rechaza un hermano del proof que no sea SHA-256 en hex", () => {
    expect(() =>
      merkleRootFromProof(hoja(1), [{ sibling: "no-es-un-hash", position: "right" }], sha256Pair)
    ).toThrow(/SHA-256/);
  });

  it("con proof vacío devuelve la hoja — sigue siendo el caso de una sola hoja", () => {
    expect(merkleRootFromProof(hoja(1), [], sha256Pair)).toBe(hoja(1));
  });

  it("el root de un bundle de 5 hojas es idéntico al de antes de esta spec", () => {
    // Ancla el valor: cualquier cambio a la construcción del árbol lo mueve, y
    // eso invalidaría los 180 eventos ya anclados contra la construcción de hoy.
    // Valor calculado con la implementación previa a SPEC-404, sin tocar la
    // función — esta spec no cambia el árbol (Alcance / NO-alcance).
    const hojas = [hoja(1), hoja(2), hoja(3), hoja(4), hoja(5)];
    expect(merkleRoot(hojas, sha256Pair)).toBe(
      "6501d4a0ed0060efc9f9370fe3738155fcff62c0f47b78d5ae2ac919ba53cdac"
    );
  });
});
