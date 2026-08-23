# contracts — validadores Aiken

> Se carga solo al tocar este subárbol. Las reglas duras (nunca custodiar valor, cero PII,
> metadata ≤64 bytes, blueprint commiteado) están en el `CLAUDE.md` de la raíz.

Aiken **v1.1.21** · **Plutus V3** (D-019) · stdlib v3.0.0.
Aislado del workspace pnpm (D-001): **corre en paralelo y no bloquea a nadie.** Es el track ideal
para trabajarlo por separado del resto del workspace.

## La FSM canónica (D-020)

```
Pending → InProgress → Completed        (Completed es TERMINAL)
             ↑↓
          Observed                       (remediación, no estado final)
```

Sale textual del entregable original de M1 (`3-milestone-lifecycle.puml`). `Observed` es el camino
de remediación: se observa para que el developer corrija y vuelva a `InProgress`. El estado en
datos se llama `Completed` —no `Certified`, porque la plataforma no certifica (D-026)— y la
etiqueta visible sale del diccionario i18n.

**Una sola tabla de transiciones, espejada 1:1 con el backend.** Si cambia una, cambian las dos en
el mismo commit.

## Por qué existe un validador si la plataforma no controla nada

**No controla el mundo real: controla al operador.** Con anclaje por metadata suelto (D-006),
quien tenga la wallet de servicio puede publicar cualquier secuencia —contradictoria, fuera de
orden, inventada a posteriori— y la cadena la acepta. Con state-thread (D-008), cada transición
debe gastar el UTxO anterior: la secuencia queda encadenada y **ni nosotros podemos falsificarla
después**. Para un producto cuya tesis es "verificá sin confiar en la plataforma", esa distinción
*es* el producto.

**Consecuencia:** el validador se justifica solo donde importa la integridad de la **secuencia**
(stages `validation_critical`). Para un artefacto suelto sin secuencia, la metadata alcanza.

## Estado y deuda

- **0 tests, y es la prioridad del track.** El criterio 2 del SOM pide **≥95% de coverage** y es el
  único criterio duro sin plan B: un test por transición válida y **uno por cada inválida**
  (`Completed → *` debe fallar siempre; `Pending → Completed` directo, también), más uno por cada
  punto de rechazo del validador (`cardano/transaction.placeholder` para armar la tx).
  **Ojo: `aiken check` no mide coverage de líneas** —solo tiene `--property-coverage`, que es la
  distribución de labels en property tests—, así que el ≥95% hay que demostrarlo con una tabla que
  mapee cada punto de rechazo del validador contra el test que lo ejercita.
- **Hubo un `contracts/reference/` con 353 líneas que el compilador no leía** (`aiken` solo mira
  `validators/` y `lib/`) y que describía **otra** máquina de estados: `Certified` en vez de
  `Completed`, salida del estado terminal, firmantes por rol. Se borró entero en **D-056**. Si
  encontrás una spec vieja que lo menciona, o pensás en recuperarlo del historial: no lo promuevas,
  trae la FSM equivocada adentro.
- **Tres decisiones abiertas, y las tres cambian el hash del script** (por eso son decisión, no
  refactor — el desarrollo está en D-056):
  1. **No hay thread token.** El validador exige 1 input y 1 output en la dirección del script,
     pero nada ata *cuál* UTxO es el hilo legítimo: se pueden abrir hilos paralelos con datums
     inventados. Hoy se mitiga off-chain guardando el `OutputReference` del hilo real, así que la
     propiedad on-chain que promete D-008 no está.
  2. **Un solo `admin` firma todo**, contra los cuatro roles del dominio y la co-firma CIP-30 de
     D-009.
  3. **El datum lleva `project_name` legible** (contra la regla 2: solo hashes y refs opacas) y
     `milestone_id: Int` sin mapeo definido al id de la base, que es cuid2 (contra la regla 1: UUID).
- **Rename pendiente**: `milestone.ak` → `stage.ak` y `MilestoneDatum` → `StageDatum` (D-023).
  Renombrar tipos y campos no cambia el hash —el datum se codifica por posición— pero sí el
  blueprint; hacerlo antes de que haya nada desplegado.
- **La sintaxis de Aiken cambia entre versiones**: verificá contra la pineada (`aiken --version`)
  antes de asumir stdlib.

## Autonomía

🟡 amarillo: el LLM propone, el humano revisa línea por línea antes de integrar. Bajó de rojo por
D-021 — no hay fondos en riesgo.

## Comandos

```bash
pnpm contracts:check      # aiken check (compila + tests)
pnpm contracts:build      # regenera plutus.json — commitealo (el CI verifica que esté al día)
aiken fmt                 # el CI corre 'aiken fmt --check'
aiken check -m <patrón>   # solo los tests que matcheen
```
