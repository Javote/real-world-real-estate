# contracts — validadores Aiken

> Se carga solo al tocar este subárbol. Las reglas duras (nunca custodiar valor, cero PII,
> metadata ≤64 bytes, blueprint commiteado) están en el `CLAUDE.md` de la raíz.

Aiken **v1.1.21** · **Plutus V3** (D-019) · stdlib v3.0.0 · `aiken-lang/fuzz` v2.1.1. Fuera del
workspace pnpm (D-054). Autonomía 🟡: el LLM propone, el humano revisa línea por línea.

```
lib/propnexus/fsm.ak     núcleo puro: tipos, tabla de transiciones, reglas del datum (48 tests)
validators/stage.ak      el validador: spend + mint, lo que necesita la tx           (54 tests)
plutus.json              blueprint — se commitea tras cada build
```

**El validador es cáscara delgada sobre el núcleo puro** (D-008): si una regla se puede escribir
sin mirar la transacción, va en `fsm.ak`.

- **La FSM** (D-020): `Pending → InProgress → Completed` (terminal), con `InProgress ⇄ Observed`.
  La misma tabla vive en `packages/shared` (`STAGE_TRANSITIONS`); se cambian juntas y las dos suites
  prueban los 16 pares.
- **El datum** es la entidad `Milestone` de M1-D2 menos todo lo legible: refs opacas ≤32 bytes,
  `sequence_order`, `validation_critical`, `state`, `evidence_root` (32 bytes o vacío),
  `completed_at`. Un stage crítico no llega a `Completed` sin commitment de 32 bytes.
- **Firma un solo `admin`** (D-058): la cadena prueba secuencia y momento, no atestiguación (D-026).
  Quién pidió cada transición lo decide `authorize()` en la API.
- **El hilo es un NFT por stage** con asset name = `stage_ref`, y **no hay burn**. La unicidad por
  stage no la garantiza el validador (solo una acuñación por tx): la sostiene `retryStageMint`
  contra la cadena (`SPEC-301`); cerrarla on-chain cambia el script hash (`SPEC-305`).
- **La clave del `admin` no es rotable** (D-093, `SPEC-304`): es parámetro del script.
- **El `stage_ref` es el cuid2 en bytes**: el validador acepta cualquier id de 1 a 32 bytes, pero
  con hilos ya acuñados no se puede cambiar de criterio.

**Coverage.** `aiken check` no mide líneas: el criterio 2 se demuestra con cada punto de rechazo
contra su test, medido por los dos scripts de abajo. La tabla y la corrida vigente están en
[`aiken-coverage-report.md`](../specs/evidencia-m3/1-repo-ci-tests/aiken-coverage-report.md). Los
negativos van `test ... fail` porque los `expect` abortan.

## Trampas

- **`aiken` no imprime diagnósticos si stdout no es un TTY**: `aiken check | tail` da exit 1 sin
  ninguna línea de error. Corrélo en una terminal o en un pty.
- **Los `use` van todos arriba del archivo**, incluso los de tests: a mitad de archivo es error de
  parseo.
- **Un módulo de `lib/` no puede llamarse igual que un validador** (por eso es `fsm.ak` y no
  `stage.ak`).
- **`use aiken/fuzz` pide declarar `aiken-lang/fuzz` en `aiken.toml`**: no viene con stdlib aunque
  sus tests lo usen. El error es `unknown module: 'aiken/fuzz'`.
- **La sintaxis cambia entre versiones**: verificá contra `aiken --version` antes de asumir stdlib.
- **No recuperes `contracts/reference/` del historial**: describía otra FSM (D-056).

## Comandos

```bash
pnpm contracts:check      # aiken check
pnpm contracts:build      # regenera plutus.json — commitealo (el CI verifica que esté al día)
aiken fmt                 # el CI corre 'aiken fmt --check'
aiken check -m <patrón>   # solo los tests cuyo nombre matchee
node contracts/scripts/rechazos-mutantes.mjs   # desde la raíz: cada chequeo tiene un test que lo mata
node contracts/scripts/rechazos-trazas.mjs     # cada `expect` contra el test que aborta en él
```
