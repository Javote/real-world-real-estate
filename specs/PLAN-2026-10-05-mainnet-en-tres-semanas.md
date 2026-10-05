# Plan — mainnet en tres semanas, con dos desarrolladores

> **Propuesta, no mandato.** D-013 sigue vigente hasta que el dueño la revierta por escrito; nada
> de este plan se ejecuta antes de las decisiones del §1. El estado de cada ítem que nombra vive en
> [`README.md`](README.md) §Antes de mainnet, no acá.
>
> **Relación con [`RUNBOOK-mainnet-cutover.md`](RUNBOOK-mainnet-cutover.md):** el runbook es la
> secuencia completa de M4 y asume M3 aceptado, `SPEC-501`–`SPEC-504` cerradas y el validador
> recompilado. Este plan es el camino corto: mainnet vivo en tres semanas **sin tocar el
> validador**. Los puntos donde se aparta están en §2; si el dueño elige el runbook, este plan se
> archiva.
>
> Precios relevados el **2026-10-05** (fuentes al final). Nivel: 🟡 en general, 🔴 en la wallet.

## Qué es "mainnet" al final de las tres semanas

| Entra | No entra |
|---|---|
| `propnexus-api-mainnet` y `propnexus-web-mainnet` vivos, con URL pública | Los pisos de M4 (≥350 eventos, ≥100 hashes, ≥10 contratos…): son meses de pilotos, no semanas |
| Direcciones del contrato y policy id de mainnet publicados | `SPEC-501`–`SPEC-504` (panel, disputas, NPS, completitud) |
| Un proyecto propio de punta a punta en mainnet, cada TXID verificado por Koios | Multisig, recuperación o unicidad on-chain (`SPEC-304`, `SPEC-305` Parte A) |
| Los 3 pilotos dados de alta y con su primer proyecto | La PWA (`SPEC-222`) y la Fase 2 (`SPEC-611`) |
| Runbook de mainnet: incidente de clave, wallet sin saldo, rollback sin cadena | |

**Preprod no se toca.** Sigue siendo pre-producción y la evidencia de M3 (criterios 12 y 15)
mientras Catalyst la revisa. Mainnet es un entorno nuevo al lado, con servicios, base, bucket,
wallet y key de Blockfrost propios.

## 1 · Las decisiones del día 1–2 (del dueño)

Si alguna no sale en dos días, el plan no llega a tres semanas.

| # | Decisión | Opciones | Recomendación |
|---|---|---|---|
| 1 | Revocar D-013 | ahora, en paralelo a la revisión de M3 · después de la aceptación (lo que dice el runbook) | Ahora, **solo si** Preprod queda intacto: los cambios de código son aditivos y `render-config.test.ts` defiende que los servicios de Preprod siguen en Preprod |
| 2 | Custodia de la clave del admin (`SPEC-304`, D-093) | dejarlo así · multisig M-de-N · VKH de recuperación | **Dejarlo así**, con la custodia del §3 y el control de detección del §4. Las otras dos cambian `spend`, `mint` y `packages/cardano`: no entran en tres semanas con revisión 🔴 |
| 3 | `SPEC-305` | A1 · A2 · ninguna · solo la Parte B | **Ninguna**, que la spec da como postura legítima: el camino alcanzable ya lo cerró `SPEC-301` y un duplicado es detectable on-chain. La Parte B es una línea, pero cambia el hash también en Preprod mientras M3 está en revisión |
| 4 | Aceptar el costo de D-057 | 2 ADA bloqueadas por etapa, sin burn | Aceptarlo: son ~$0,53 por etapa al precio de hoy (§7) |
| 5 | API de mainnet en Render free o paga | Free ($0) · Starter ($7/mes) | **Starter.** En free, un reinicio por health check perdió 4 anclajes en la prueba de volumen, y los pilotos esperarían ~1 min de cold start |
| 6 | Turso free o pago | Free (1 día de PITR) · Developer ($4,99/mes, 10 días) | **Developer.** La base es la fuente de verdad del registro (D-007): sin ella, los hashes on-chain no se pueden atribuir a nada |
| 7 | Asientos para los dos desarrolladores | Render Hobby (1 asiento) · Pro ($25/mes) · Sentry Developer (1 usuario) · Team ($26/mes) | **Un solo titular** de Render y Sentry: el deploy sale de `git push` a `main` y los secretos los carga una persona, que es lo que la custodia 🔴 pide de todos modos |
| 8 | Legal greenlight de counsel/notario (criterio 2 de M4) | — | **Pedirlo el día 1.** Es una firma externa y no la controlamos |

## 2 · Dónde se aparta de `RUNBOOK-mainnet-cutover.md`

| El runbook dice | Este plan propone | Por qué |
|---|---|---|
| No ejecutar antes de que M3 esté entregado | Ejecutar en paralelo, sin tocar Preprod | Lo pide el dueño; el riesgo para la evidencia de M3 queda acotado por tests (decisión 1) |
| La clave de mainnet **no** es la simple: multisig o recuperación | La simple, con custodia y detección | Decisión 2. La clave nueva de mainnet ya da otro script hash; el código Aiken queda idéntico al que ancló los 180 eventos de Preprod |
| `SPEC-305` se recompila junto con la custodia | No se recompila | Decisión 3 |

**El primer mint en mainnet fija las decisiones 2 y 3 para siempre** (`SPEC-304`): hasta el día 11
se puede volver al runbook; después, no.

## 3 · Las tres semanas

**Dev A** se ocupa de la cadena (`packages/cardano`, la wallet). **Dev B**, de la infraestructura,
la API y la web. Todo lo 🔴 se hace en pareja: uno escribe y el otro revisa, y el revisor tiene que
poder explicar cada línea sin mirar el chat. Los dos sobre `main` (D-030), un commit por cambio y
cada uno con `verify:all` en verde.

### Semana 1 — decidir y preparar

| Días | Dev A | Dev B |
|---|---|---|
| 1–2 | Las decisiones del §1, escritas en `DECISIONS.md` (D-013 revisada; la de `SPEC-304`/`SPEC-305`) | Inventario de lo que asume Preprod: `REDES_PERMITIDAS` y `BLOCKFROST_URL` en `packages/cardano/src/factory.ts:7-13`, `CARDANO_NETWORK` en `render.yaml:182`, `VITE_EXPLORER_BASE` en `apps/web/src/lib/explorer.ts:1` (build time, una por build), el respaldo `?? "Preprod"` de `apps/api/src/domain/reconcile.ts:169`, y los docs de verificación |
| 3–5 | `Mainnet` en `REDES_PERMITIDAS` y su URL de Blockfrost, con dos guardas: exige `ANCHOR_MODE=real` y una base remota, y nunca se elige en local ni en CI. Tests en `packages/cardano` | Los servicios `-mainnet` en `render.yaml`. `apps/api/test/render-config.test.ts` defiende que los de Preprod siguen en Preprod y que los de mainnet son los únicos con `Mainnet` (D-076). Antes de pushear, reproducir `buildCommand` y `startCommand` literales |

En el mismo commit que habilita la red se reescriben D-013, la prohibición "No tocar mainnet" de
`CLAUDE.md` (por ejemplo: *"Mainnet solo en los servicios `-mainnet`; en local y en CI, nunca"*), la
fila de `README.md` §Fuera de alcance, y `specs/stack.md` §7 y §8.

### Semana 2 — ensayo con forma de mainnet, sobre Preprod

| Días | Dev A | Dev B |
|---|---|---|
| 6–8 | 🔴 **Clave de pago de mainnet** (D-078: clave, no seed), generada fresca y fuera del repo. El dueño la guarda offline en dos lugares; no vive en ninguna máquina de desarrollo. Derivar el VKH y verificar el script hash y la dirección que resultan | Base Turso nueva en Oregon (`aws-us-west-2`, misma región que Render: lo que `SPEC-603` busca, gratis), con delete protection. Bucket R2 nuevo. Proyecto Blockfrost mainnet. Proyectos de mainnet en Sentry y PostHog, y `service.name` propio en Grafana. **Sin seed de demo**: solo el admin con `SEED_ADMIN_PASSWORD` (D-047) y las cuentas reales de los pilotos |
| 9–10 | **Ensayo general:** los servicios `-mainnet`, apuntando a Preprod con una wallet de ensayo, y un proyecto entero recorrido por la UI, como en la prueba de volumen | Runbook de mainnet, como sección nueva de `RUNBOOK-deploy.md`: un rollback de código no deshace nada on-chain · clave comprometida · wallet sin saldo · quién aprueba volver a Preprod. Backup verificado (`stack.md` §8b) |

### Semana 3 — salida controlada

| Día | Qué |
|---|---|
| 11 | **Go/no-go** (§5). Después de esto, las decisiones 2 y 3 quedan fijas |
| 12 | Fondear la wallet con lo de la semana (§7) y publicar el reference script (`RUNBOOK-deploy.md` paso 6), con restart de la API |
| 12–13 | Proyecto propio en mainnet de punta a punta. Cada TXID, contra Koios y Cardanoscan |
| 14–15 | Altas de los 3 pilotos: proyectos, contratos y evidencia. **Ninguna liberación antes de que exista `SPEC-503`, y ningún drill de fallback antes de `SPEC-502`** (§6). Se vigilan Sentry, el saldo de la wallet y la reconciliación de `Pending` |

**Lo que se congela estas tres semanas:** la Fase 2 (`SPEC-611`, de A1 en adelante), la PWA
(`SPEC-222`) y la pasada de `SPEC-112`. A0.2 (`SPEC-612`) se cierra solo si es corta; si no, se
pausa. `SPEC-603` sigue su curso para Preprod, sin bloquear nada de esto.

## 4 · El control que acompaña a "dejarlo así"

Con la clave caliente en Render, quien la robe puede anclar transiciones falsas, y el validador no
lo distingue. La detección no necesita un cron: un comando documentado, que se corre a mano cada
semana, compara las transacciones de la dirección de servicio (vía Koios) contra `OnChainEvent`.
Una tx que la base no conoce es un incidente.

## 5 · Go/no-go del día 11

- [ ] Decisiones del §1 escritas en `DECISIONS.md`, y D-013 revisada.
- [ ] `verify:all` verde; `render-config.test.ts` defiende las dos redes.
- [ ] Ensayo del día 9 completo: 10 etapas `Completed`, cada TXID `Confirmed` y verificado.
- [ ] La clave de mainnet guardada offline en dos lugares, y su VKH anotado en `stack.md` §8b.
- [ ] Base de mainnet sin cuentas demo; backup verificado.
- [ ] Runbook de mainnet escrito.
- [ ] Legal greenlight firmado, o el dueño decide por escrito salir sin él (en ese caso, sin pilotos).
- [ ] Pilotos confirmados para los días 14–15.

## 6 · Contra el texto oficial de M4

El texto de Catalyst (Milestone Module, releído el 2026-10-05) coincide palabra por palabra con la
transcripción de [`ESTADO-2026-09-22-catalyst-milestone-4.md`](archive/ESTADO-2026-09-22-catalyst-milestone-4.md).
**Estas tres semanas cubren la parte de infraestructura del output 2, y nada más.**

| M4 pide | Al final de las tres semanas | Qué falta, y dónde |
|---|---|---|
| Output 2 · URL de mainnet y direcciones del contrato publicadas | ✅ | — |
| Output 2 · dashboards operacionales | ✅ Sentry, Grafana y PostHog contra mainnet | — |
| Output 2 · playbooks de governance y operación | ◐ el runbook de mainnet (§3, semana 2) | La parte de governance: quién aprueba volver a Preprod y quién tiene acceso a la clave, y cómo se audita (`RUNBOOK-mainnet-cutover.md` §4) |
| Criterio 2 · ≥350 eventos on-chain y ≥100 hashes de documentos | ~60 del proyecto propio, más lo que avancen los pilotos | Uso real de los pilotos. El ADA está presupuestado en §7. **Con eventos de uso real, no con proyectos sintéticos para llegar al número** |
| Criterio 2 · valor de escrow simulado, reportado | ✗ | Un agregado, sin custodia (D-021) → `SPEC-501` |
| Criterio 2 · legal greenlight de counsel/notario | lo que tarde la firma | Externo, pedido el día 1 |
| Evidencia 2 · TXIDs de mainnet en explorador público | ✅ los del proyecto propio | Crece con los pilotos |
| Evidencia 2 · capturas de eventos, **wallets** y liberaciones | ✗ | Un panel de producto, no de Sentry → `SPEC-501` |
| Output 1 y criterio 1 · métricas del piloto | ✗ | `SPEC-504` → `SPEC-502` → `SPEC-503` → `SPEC-501`, en ese orden ([`ESTADO-2026-09-22`](archive/ESTADO-2026-09-22-catalyst-milestone-4.md) §Orden de ataque), desde la semana 4 |
| Output 1 · drill de fallback (inspección fallida → re-inspección/reembolso) | ✗ | `SPEC-502`. La re-inspección ya existe (`Observed`, D-020); el reembolso se registra como declaración, nunca como movimiento de valor |
| Outputs 3 y 4 · documentación, dossier notarial, closeout | ✗ | Después de correr los pilotos: el output 3 pide incorporar su feedback |

### Lo que el texto oficial pone en riesgo y estas semanas no resuelven

- **≥120 wallets únicas.** `SPEC-501` define la wallet única como *"wallets CIP-30 distintas que
  firmaron al menos una transacción anclada"*. Pero hoy **toda** transacción la firma el admin
  (D-058) y no hay co-firma CIP-30 (D-009): on-chain hay una sola wallet. Ninguna versión del plan
  llega a 120 sin una de dos cosas, y las dos son del dueño: redefinir qué cuenta como wallet (la
  pregunta abierta de `SPEC-501`), o que los compradores conecten una wallet, que es un cambio de
  producto. Hay que decidirlo antes de abrir pilotos a escala, no al armar el reporte.
- **≥800.000 USDM en valor.** Sigue abierta la pregunta de `SPEC-501`: si es una conversión al
  armar el reporte, o si los contratos se denominan en USDM (en ese caso, `Contract.currency`
  cambia).
- **≥10 contratos firmados, ≥15 liberaciones, ≥120 compradores y NPS ≥70.** Son metas comerciales
  de los pilotos, no de ingeniería: dependen de cuántos compradores reales traigan los dos
  developers.

## 7 · Presupuesto

### Infraestructura, por mes

Preprod sigue en free tier ($0). La tabla es lo que **agrega** mainnet.

| Servicio | Para qué | Plan más barato | Recomendado | Nota |
|---|---|---|---|---|
| Render · workspace | — | Hobby **$0** (1 asiento, 25 servicios, 5 GB de tráfico y después $0,15/GB) | Hobby $0 | Pro sale $25/mes, si los dos necesitan el dashboard |
| Render · API mainnet | web service | Free **$0** (512 MB, 0,1 CPU, se duerme) | Starter **$7** (512 MB, 0,5 CPU, siempre prendido) | Decisión 5 |
| Render · web mainnet | static site | **$0** | $0 | Solo cobra tráfico, dentro de los 5 GB |
| Turso | base de mainnet | Free **$0** (5 GB, 500M lecturas, 10M escrituras, 1 día de PITR) | Developer **$4,99** (9 GB, 2.500M lecturas, 25M escrituras, 10 días de PITR) | Decisión 6. El plan es por organización y cubre también las bases de Preprod |
| Cloudflare R2 | evidencia | **$0** (10 GB, 1M ops clase A, 10M clase B, egress gratis) | $0 | Después, $0,015/GB-mes |
| Blockfrost | provider | Starter **$0** (50.000 requests/día) | $0 | **A confirmar en el dashboard:** si Starter no admite el proyecto de mainnet además del de Preprod, Hobby sale €29/mes (≈ $32,49) |
| Sentry | errores | Developer **$0** (5.000 errores/mes, 1 usuario) | $0 | Team sale $26/mes, si los dos necesitan acceso |
| Grafana Cloud | traces y métricas | Free **$0** (10k series, 50 GB de traces, 3 usuarios, 14 días) | $0 | |
| PostHog | web vitals | Free **$0** (1M eventos/mes) | $0 | |
| GitHub Actions | CI | **$0** (repo público) | $0 | |
| Dominio | — | ninguno (`onrender.com`) | — | Opcional |
| **Total por mes** | | **$0** | **$11,99** | **$44,48** si Blockfrost pide Hobby · **$62,99** con asientos para los dos (Render Pro + Sentry Team) |

### ADA, medido en la prueba de volumen

Los tres números salen de `REPORTE-2026-09-10-prueba-de-volumen.md` y de `RUNBOOK-deploy.md` paso 6;
se asume que las fees de mainnet son las mismas, porque Preprod sigue sus parámetros de protocolo.

| Concepto | Valor medido |
|---|---|
| Fee promedio por transacción | 39,83 ADA / 180 tx = **0,221 ADA** |
| Bloqueado por etapa, sin burn (D-057) | **2 ADA** |
| Reference script, una vez por red (D-083) | **~11 ADA** bloqueados |
| Proyecto de 10 etapas con el tour completo de la FSM (60 tx) | 13,3 de fees + 20 bloqueados = **~33 ADA** |

| Para qué | ADA | USD (ADA a $0,266) |
|---|---|---|
| **Semana 3:** reference script + proyecto propio + 3 pilotos con un proyecto cada uno, todos con el tour completo | 11 + 4 × 33 = 143 → con 25% de margen, **~180** | **~$48** |
| **Hasta el piso de M4** (≥350 eventos, incluye la semana 3), si cada etapa hace el camino feliz (4 tx por etapa → 88 etapas) | 77 de fees + 176 bloqueados + 11 = 264 → con margen, **~330** | **~$88** |
| Lo mismo, si cada etapa hace el tour completo (6 tx por etapa → 59 etapas) | 77 + 118 + 11 = 206 → con margen, **~260** | **~$69** |
| **Por cada proyecto nuevo, después** | ~33 | ~$9 |

**Fondear con poco.** La wallet se carga con lo de la semana 3, no con lo de M4: lo que queda en
una clave caliente es lo que se pierde si se compromete.

### Total

| | USD | ARS (USD a $1.520) |
|---|---|---|
| **Las tres semanas**, recomendado (un mes de infra + ADA de la semana 3) | **~$60** | ~$91.000 |
| Las tres semanas, mínimo absoluto (todo free + ADA de la semana 3) | ~$48 | ~$73.000 |
| **Por mes, después** | $11,99 + ~$9 por proyecto nuevo | ~$18.000 + ~$14.000 por proyecto |
| ADA total hasta el piso de M4 | $69–$88 | $105.000–$134.000 |

No incluye horas de los dos desarrolladores, el legal greenlight ni un dominio propio.

## 8 · Riesgos

| Riesgo | Mitigación |
|---|---|
| Las decisiones del §1 tardan más de dos días | El plan se corre una semana por cada semana de demora, sin comprimir el ensayo |
| El legal greenlight no llega en la semana 3 | Mainnet sale igual con el proyecto propio; los pilotos esperan la firma |
| Blockfrost Starter no admite los dos proyectos | Hobby a €29/mes, o la idea de Koios (`README.md` §Antes de mainnet, ítem 8), que todavía no está medida para Plutus V3 |
| El precio de ADA sube | El presupuesto en ADA no cambia; en dólares escala lineal. A $0,50, la semana 3 sale ~$90 |
| La disponibilidad de los pilotos en la semana 3 | No la controlamos: confirmarla el día 1 |
| Cambios en `main` mientras Catalyst revisa Preprod | Los cambios son aditivos y `render-config.test.ts` defiende la red de cada servicio |

## Fuentes de los precios (2026-10-05)

- Render: [render.com/pricing](https://render.com/pricing.md) — workspaces, compute y tráfico.
- Turso: [turso.tech/pricing](https://turso.tech/pricing).
- Cloudflare R2: [developers.cloudflare.com/r2/pricing](https://developers.cloudflare.com/r2/pricing/).
- Blockfrost: [blockfrost.dev — Plans and billing](https://blockfrost.dev/overview/plans-and-billing)
  (no publica los números en texto; los de Hobby y Developer vienen de fuentes secundarias y se
  confirman en el dashboard).
- Sentry: Developer y Team, de [costbench.com](https://costbench.com/software/developer-tools/sentry/free-plan/)
  y [last9.io](https://last9.io/blog/sentry-pricing/).
- Grafana Cloud: [last9.io — Grafana Cloud pricing](https://last9.io/blog/grafana-cloud-pricing/).
- PostHog: [posthog.com/pricing](https://posthog.com/pricing).
- ADA: $0,266 y ARS 405 (CoinGecko, 2026-10-05). USD: ARS 1.520 (USDC en CoinGecko). EUR: USD
  1,1204 (Frankfurter, 2026-10-05).
