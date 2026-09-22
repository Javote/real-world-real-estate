# Runbook — pasar a producción (mainnet cutover para Milestone 4)

> Este runbook **asume que las specs de abajo ya están cerradas**. No es una lista de trabajo — es
> la secuencia operativa para el día en que sí lo estén. Complementa a
> [`RUNBOOK-deploy.md`](RUNBOOK-deploy.md) (deploy/rollback de Preprod, que no cambia) y a
> [`ESTADO-2026-09-22-catalyst-milestone-4.md`](ESTADO-2026-09-22-catalyst-milestone-4.md) (qué pide
> Catalyst y qué falta). **No ejecutar nada de acá mientras M3 no esté entregado** — D-013 sigue
> vigente hasta que el dueño la revierta explícitamente.

## 0 · Precondición: qué tiene que estar cerrado antes de tocar esto

| Bloque | Ítems | Dónde se verifica |
|---|---|---|
| **M3 entregado** | 3.12 (video), 3.13 (pilotos), 3.14 (muestras reserva→escrow), 3.15 (cobertura ≥95%) | `CLAUDE.md` raíz §Lo que queda del plan |
| **Antes de mainnet (7 ítems)** | Runbook de red (#1), custodia de la clave admin (#2), unicidad de hilo + tope de `evidence_root` (#3), forma de hashes/TXID (#4), `outputRef` buscado (#5), datum validado (#6), decisión sobre las 2 ADA bloqueadas (#7) | `CLAUDE.md` raíz §Antes de mainnet, `SPEC-304`, `SPEC-305`, `SPEC-402`, `SPEC-407`, `SPEC-408` |
| **Dominio nuevo de M4** | Panel de métricas, disputas, NPS, completitud | `SPEC-501`–`SPEC-504` |
| **Legal** | Greenlight de mainnet por counsel/notary (criterio 2 del SOM) — **es una firma humana, no un paso de este runbook** | Externo — bloqueante, se pide en paralelo a todo lo de arriba, no al final |

Si falta cualquiera de estos, **no seguir**: el ítem 3 (`SPEC-305`) y la decisión de custodia del
ítem 2 (`D-093`) cambian juntos el script hash — hacerlo en dos pasadas (compilar, publicar,
descubrir que la custodia obliga a recompilar) es mucho más caro que decidir antes de compilar.

## 1 · Infraestructura nueva (una sola vez, antes de tocar código)

Mainnet no reutiliza nada de Preprod — ni wallet, ni proyecto Blockfrost, ni base:

1. **Cuenta Blockfrost en mainnet** — proyecto nuevo, `BLOCKFROST_API_KEY` distinta a la de Preprod.
2. **Wallet de servicio nueva**, fondeada con ADA real. La clave (`SERVICE_WALLET_PRIVATE_KEY`,
   superficie 🔴) sale del proceso resuelto en el ítem 2 de "antes de mainnet" (`D-093`,
   `SPEC-304`) — multisig M-de-N o segundo VKH de recuperación, **no** la clave simple que usa
   Preprod. Si esa decisión eligió multisig o recuperación, el script Aiken cambia y hay que
   recompilar y commitear `plutus.json` antes de este paso (regla 11).
3. **Base Turso nueva** para mainnet — no comparte filas con la de Preprod. Aplica la migración
   completa desde cero con `db:migrate` (D-063 ya no aplica en el sentido de "editar": es una base
   nueva, así que corre todo el historial de `migrations/*.sql` tal cual).
4. **Servicios Render nuevos** (`propnexus-api-mainnet`, `propnexus-web-mainnet` o el naming que se
   decida) — no se reconfigura el Blueprint de Preprod in-place: los dos entornos conviven mientras
   haga falta demostrar Preprod a un revisor. `render.yaml` necesita una segunda definición o un
   segundo Blueprint; decidir cuál antes de este paso (afecta si es un archivo nuevo o parámetros).

## 2 · Los 7 ítems de "antes de mainnet", en el orden que importa

**No los 7 tienen spec de código: 5 sí (`SPEC-304`, `SPEC-305`, `SPEC-402`, `SPEC-407`, `SPEC-408`)
y 2 son decisión + config, sin `SPEC-NNN` propia (ítem 1: habilitar la red, `D-013`; ítem 7: las 2
ADA bloqueadas, `D-057`).** El orden no es el numérico de la tabla de `CLAUDE.md` — es por qué
depende de qué:

**Primero, los tres que son off-chain puro y no tocan el script hash — sin riesgo, sin decisión del
dueño pendiente, se cierran y despliegan en Preprod ya, sin esperar al cutover:**

1. **`SPEC-402`** — los 36 hashes/TXID de `packages/shared` dejan de ser `z.string()` pelado. Más
   estricto, no más laxo: no rompe nada que ya funcione en Preprod.
2. **`SPEC-407`** — el `outputRef` del recibo se busca, no se supone `#0`. Un fix en
   `packages/cardano`, no en el validador.
3. **`SPEC-408`** — el datum que vuelve de la cadena se valida en las dos puertas de lectura.
   Se apoya en la forma que fija `402`, por eso va después.

**Segundo, los dos que SÍ comparten el mismo redeploy del validador — decidir y compilar juntos, una
sola vez, porque la custodia puede cambiar el parámetro que el script Aiken toma como VKH del
admin, y `SPEC-305` toca el mismo archivo:**

4. **Ítem 2 — custodia de la clave admin** (`D-093`, `SPEC-304`). Es la decisión primero: dejarlo
   como está, multisig M-de-N, o un segundo VKH de recuperación. Si sale "dejarlo como está", este
   ítem es documentar el riesgo aceptado, no código — pero **la decisión tiene que estar tomada**
   antes del punto 5.
5. **`SPEC-305`** — unicidad del hilo + tope de `evidence_root`, implementado en la **misma**
   recompilación de Aiken que ya incorporó (o no) el cambio de custodia del punto 4. Un solo
   `plutus.json` nuevo, commiteado una vez (regla 11), no dos.

**En paralelo a todo lo anterior, una firma del dueño que no bloquea código de nadie — pero tiene
que estar cerrada antes de escalar pilotos:**

6. **Ítem 7 — las 2 ADA bloqueadas por etapa** (`D-057`). Confirmar que el dueño la revisó con el
   número real de la prueba de volumen (`~99.8 ADA` por proyecto de 10 etapas,
   `REPORTE-2026-09-10-prueba-de-volumen.md`) antes de medir 30+ proyectos reales de golpe en
   mainnet. No bloquea empezar a trabajar en 1-5; bloquea abrir pilotos a escala.

**Al final, el switch real, después de todo lo anterior y del legal greenlight firmado:**

7. **Ítem 1 — habilitar la red.** Este mismo runbook, más `CARDANO_NETWORK=Mainnet` en el
   `render.yaml` de los servicios nuevos del paso 1.4. D-013 se revierte con un commit explícito que
   el dueño apruebe — no es un flag que se cambia de paso, es el último.

## 3 · Encender el anclaje real en mainnet

Mismo procedimiento que `PLAN-2026-08-31-anclaje-real.md` usó para Preprod, con dos diferencias:

- **`ANCHOR_MODE=real` y `CARDANO_NETWORK=Mainnet` se cargan juntos**, nunca uno antes que el otro —
  D-075 asegura que una configuración a medio cargar solo inhabilita el puerto, no tumba la API, así
  que el riesgo operativo es bajo, pero cargarlos separados generaría una ventana confusa de logs.
- **El primer anclaje de prueba se hace sobre un proyecto de scratch, no sobre el primer piloto
  real** — mismo motivo que el incidente de `torre-a` documentado en `apps/api/CLAUDE.md`: hay que
  confirmar que el hilo se abre bien (mint) antes de que la primera transición real de un piloto
  dependa de eso.

**Verificar, antes de anunciar la URL pública:**

```bash
# el mismo smoke test que valida instrumentación en Preprod, contra el binario compilado real
node --require dist/src/instrumentation.js dist/src/server.js
```

Y una transacción de prueba resuelta contra Blockfrost mainnet, confirmada independientemente en un
explorador público (Cardanoscan/Koios) — mismo patrón que la lista de TXIDs de M3
(`EVIDENCIA-2026-09-11-lista-formal-de-txids.md`), esta vez sobre mainnet.

## 4 · Publicar lo que el criterio 2 exige

- **URL mainnet** — la de los servicios Render nuevos del paso 1.4, publicada donde Catalyst la
  pueda leer (evidencia del milestone, no el README del repo únicamente).
- **Direcciones de contrato** — derivadas del `plutus.json` recompilado (paso 2), nunca
  hardcodeadas (regla 11 — esto no cambia entre Preprod y mainnet, solo cambia el valor).
- **Dashboards operacionales** — reencender Sentry/OTel→Grafana/PostHog contra proyectos nuevos de
  mainnet (no reusar los de Preprod: mezclaría trazas de dos redes). Capturar screenshots formales
  el mismo día que se abran los pilotos, mismo patrón que
  `EVIDENCIA-2026-09-11-monitoring-screenshots.md`.
- **Governance/ops playbooks** — documento nuevo, corto, con: quién puede aprobar un cambio de
  `CARDANO_NETWORK` de vuelta a `Preprod` (rollback de red, no solo de código), quién tiene acceso a
  la clave del admin y cómo se audita ese acceso, y el procedimiento de incident response para un
  anclaje fallido en mainnet (mismo triage que Preprod, pero con la escalada a "avisar a los
  pilotos" agregada — en Preprod nadie real depende del anclaje).

## 5 · Correr los pilotos reales

**No arranca hasta que los pasos 1-4 estén cerrados y el legal greenlight esté firmado.** El
contenido operativo (recontactar, onboarding, drills de fallback) sale de `M1-D3-PilotPlan.pdf` y
del ítem 3.13/3.14 de M3, ahora a escala de mainnet:

1. Onboarding de 1 notary + 2 developers reales (output 1), con al menos 1 proyecto real cada uno.
2. Ejecutar el flujo completo: contrato firmado → evidencia → certificación → release, hasta
   alcanzar los pisos del criterio 1 (≥10 contratos, ≥20 bundles, ≥15 releases, ≥120 wallets).
3. **Ejercitar el drill de fallback a propósito** (output 1: inspección fallida → re-inspección o
   reembolso) — no esperar a que ocurra solo. Abrir una disputa real con `SPEC-502`, resolverla, y
   que quede en la métrica de `disputeRate`.
4. Disparar la encuesta NPS (`SPEC-503`) en el momento definido, y juntar respuestas suficientes
   para que el número declarado tenga una nota de tamaño de muestra defendible.
5. Medir completitud (`SPEC-504`) y volcar todo en el panel de `SPEC-501` para armar el reporte.

## 6 · Documentación y dossier (output 3)

- **Whitepaper v1.1, API, user guides** — se escriben **después** de correr los pilotos, no antes:
  el output 3 pide incorporar feedback real, y escribirlo antes sería inventar el feedback.
- **Dossier verificado por notario, ≥1 unidad** — ejecutar el flujo ya construido
  (`notary.dossier.$dossierId.tsx`, P8 de M2-D4) sobre una unidad real de uno de los pilotos, en
  mainnet. No es código nuevo — es el mismo paso que ya se demostró en Preprod, repetido con valor
  real de por medio.

## 7 · Cierre (output 4, baja prioridad)

Cuando 1-6 estén cerrados: armar el Closeout Report (PDF) con las métricas de `SPEC-501`, las
capturas de dashboards del paso 4, la lista de TXIDs mainnet y el dossier del paso 6. El video de
cierre es la única pieza sin equivalente de código en todo este runbook — grabación y edición,
sin dependencias técnicas.

## Riesgos específicos de este cutover

| Riesgo | Por qué es distinto de Preprod | Mitigación |
|---|---|---|
| El primer anclaje real en mainnet falla por wallet sin fondos | Mainnet no tiene faucet — un error de cálculo de fees cuesta ADA real | Fondear con margen (mirar el costo real medido en la prueba de volumen de Preprod, ~99.8 ADA/proyecto, y multiplicar por los pilotos previstos) antes del primer mint |
| Un piloto real dispara el drill de fallback antes de que `SPEC-502` esté testeado en producción | A diferencia de Preprod, hay una persona real esperando una resolución | No abrir pilotos hasta que `SPEC-502` tenga sus propios tests de rechazo en verde, igual que cualquier ruta 🟡 |
| La clave del admin (paso 2.5) queda en un estado a medio decidir cuando el primer piloto ya está corriendo | Cambiar de custodia después de mintear hilos reales es un cambio de script hash con hilos ya vivos — mismo problema que describe `SPEC-305` para Preprod, pero con reputación real en juego | Cerrar la decisión de custodia **antes** de abrir el primer piloto, no en paralelo |
