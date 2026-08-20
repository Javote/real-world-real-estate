# contracts — validadores Aiken

> Se carga solo al tocar este subárbol. Las reglas duras (nunca custodiar valor, cero PII,
> metadata ≤64 bytes, blueprint commiteado) están en el `CLAUDE.md` de la raíz.

Aiken **v1.1.21** · **Plutus V3** (D-019) · stdlib v3.0.0.
Aislado del workspace pnpm (D-001): **corre en paralelo y no bloquea a nadie.** Es el track ideal
para un árbol propio (`scripts/worktree.sh create contracts`).

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

- **0 tests.** El criterio 2 del SOM pide **≥95% de coverage** y es el único criterio duro sin plan
  B. Es la prioridad del track: un test por transición válida y **uno por cada inválida**
  (`Completed → *` debe fallar siempre; `Pending → Completed` directo, también).
- **`milestone.ak` y `milestone2.ak` son casi idénticos** — mismo validador, dos estilos.
  Consolidación pendiente, default conservar `milestone.ak` (D-017).
- **`aiken.toml` conserva naming de scaffold**: `name = "j/milestone-fsm"`, `repository.user = "j"`,
  `version = "0.0.0"` — que además incumple D-015 (entero incremental). Corregir junto con el
  rename de D-023 (`milestone.ak` → `stage.ak`).
- **`reference/` es material de diseño de Fase B** (D-008): no compila necesariamente y no se
  despliega. No lo toques sin decisión previa.
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
