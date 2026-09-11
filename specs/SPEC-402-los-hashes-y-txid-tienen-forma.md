# SPEC-402 — Los 36 hashes y TXID del contrato tienen forma

> **Origen:** [`AUDITORIA-2026-09-11-calidad-de-packages.md`](AUDITORIA-2026-09-11-calidad-de-packages.md)
> §P-03. Nivel 🟢. **Independiente.** No toca ningún criterio del SOM, pero **vale antes de
> mainnet**: es lo único que separa un "Verificado" real de uno que nadie validó.

## El problema, en una frase

**36 campos de hash y TXID están declarados `z.string()` pelado** en `packages/shared` — un `""`
pasa, un `"pendiente"` pasa, un SHA-256 en mayúscula pasa — mientras el mismo package ya tiene la
validación estricta escrita y la usa solo para lo que *entra*.

## Lo que ya existe y no se está usando

| Schema | Dónde | Qué exige | Se usa en |
|---|---|---|---|
| `commitmentSchema` | `stage-datum.ts` | `^[0-9a-f]{64}$` o `""` | el datum, y nada más |
| `hex64ParamSchema` | `params.ts` | `^[a-f0-9]{64}$` | path params (`fileHash`, `shareToken`) |

Las dos puertas de entrada están defendidas. La de salida no.

## Por qué importa más que un tipo lindo

Las reglas 16 y 17 hacen que estos campos **sean la prueba**: son lo único que sostiene las cuatro
afirmaciones del producto (D-026). Un `sha256Hash: ""` que llega al cliente se trunca a `HashChip` y
se renderiza como si fuera una huella; un `txid` vacío que no es `null` hace que la regla 17 —*sin
TXID, el estado es "Pendiente"*— pase de largo, porque `""` **no es** `null`.

La forma es además distinta por campo, y eso también hay que respetarlo: un SHA-256 es hex minúscula
de 64, y **un TXID de Cardano es hex de 64 también pero es case-sensitive y viaja verbatim**
(regla 16) — no se normaliza, solo se valida.

## Qué se cambia

Tres schemas nombrados en `shared`, y los 36 campos pasan a usarlos:

| Nombre | Forma | Para |
|---|---|---|
| `sha256HexSchema` | `^[0-9a-f]{64}$` | `sha256Hash`, `sha256`, `merkleRoot`, `masterHash`, `commitment`, `commitmentHash` |
| `txidSchema` | `^[0-9a-fA-F]{64}$` | `txid`, `signatureTxid` — **sin `.toLowerCase()`** |
| `outputRefSchema` | `^[0-9a-fA-F]{64}#\d+$` | `outputRef` |

`commitmentSchema` (que acepta `""`) se queda como está: el datum **necesita** el vacío, es su forma
de decir "todavía sin evidencia". El de las respuestas no lo acepta — ahí el vacío es `null`.

## Alcance / NO-alcance

- **Cubre:** los campos de hash/TXID/outputRef de los schemas de `packages/shared`.
- **NO cubre:** normalizar, truncar ni transformar nada. **Validar, no tocar** (regla 16).
- **NO cubre:** `apps/api`. Si un handler manda algo que no pasa, **eso es el hallazgo**: se
  investiga antes de ensanchar el schema.
- **NO cubre:** los hashes de `contracts/` ni el códec (van en `SPEC-408`).

## Invariantes

1. **Ningún campo que el producto presente como prueba se declara `z.string()` pelado.**
2. **Un TXID no se normaliza.** El schema acepta las dos cajas y devuelve lo que le dieron.
3. **`""` no es un hash.** Un campo que puede no tener valor se declara `.nullable()`; el vacío no
   es un valor válido en ninguno de los 36.
4. La forma vive en **un** schema por tipo de dato, no repetida 36 veces.

## Casos borde (definen los tests)

| Caso | Esperado |
|---|---|
| `sha256Hash: ""` | falla |
| `sha256Hash` en MAYÚSCULA | falla (el árbol de Merkle asume minúscula: `assertLeaf`) |
| `sha256Hash` de 63 o 65 caracteres | falla |
| `txid` en MAYÚSCULA | **pasa, y vuelve idéntico** — regla 16 |
| `txid: null` donde el `leftJoin` puede no encontrar | pasa |
| `outputRef: "abc#0"` | falla (el txid no es hex64) |
| `outputRef` con índice no numérico | falla |
| `evidenceRoot: ""` en el **datum** | sigue pasando — es otro schema y otro significado |

## Preguntas abiertas

**¿Se rompe alguna respuesta real?** Hay que correr los 335 tests de `apps/api` antes de dar la spec
por cerrada. El caso sospechoso es `certifierCertificateSchema.commitmentHash`, que es
`.nullable()`: si algún bundle viejo tiene `""` en vez de `null`, esta spec lo destapa — y esa es
una fila que hay que arreglar en la base, no un schema que haya que ensanchar.
