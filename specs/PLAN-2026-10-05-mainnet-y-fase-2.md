# Plan — mainnet, la Fase 2 completa y las features de M4, con dos desarrolladores

> **Propuesta, no mandato.** D-013 sigue vigente hasta que el dueño la revierta por escrito; nada
> de este plan se ejecuta antes de las decisiones del §1. El estado de cada ítem que nombra vive en
> [`README.md`](README.md), no acá. El orden y el acople de la migración son los de
> [`SPEC-611`](SPEC-611-la-migracion-fase-2.md): este plan los pone en un calendario, no los cambia.
>
> **Relación con [`RUNBOOK-mainnet-cutover.md`](RUNBOOK-mainnet-cutover.md):** el runbook es la
> secuencia completa de M4 y asume M3 aceptado y el validador recompilado. Este plan saca mainnet
> **sin tocar el validador**. Los puntos donde se aparta están en §2; si el dueño elige el runbook,
> la parte de mainnet de este plan se archiva.
>
> Precios relevados el **2026-10-05** (fuentes al final). Nivel: 🟡 en general, 🔴 en la wallet.

## Por qué son cinco semanas y no tres

El pedido original era mainnet en tres semanas. Sumarle la Fase 2 completa y cerrar las specs
pendientes no entra. Ninguna spec trae estimación: las de abajo son del 2026-10-05, calibradas con
`SPEC-601` y `SPEC-610`, que tardaron alrededor de un día cada una.

| Bloque | Specs | Días-dev |
|---|---|---|
| Mainnet: código, infraestructura, ensayo y runbook | este plan | ~6 |
| A0.2, A1 y A2 | `612`, `613`, `607` | ~6–8 |
| W2 | `609`, `614` | ~3 |
| Piloto `dossier` (A3 + W3) | `615` | ~2–3 |
| El resto, módulo por módulo, y borrar la forma vieja | `616`, `617` | ~8–10 |
| Features de M4 | `504`, `502`, `503`, `501` | ~6–9 |
| Lo suelto | `603` (el corte), `112` (VoiceOver manual) | ~2–3 |
| **Total** | | **~33–42** |

Dos personas dan ~10 días-dev por semana, y ~8 efectivos después del trabajo en pareja sobre lo 🔴,
las revisiones y las suites e2e. **Además, la migración es una cadena:**
A0 → A1 → A2 → W2 → piloto → A4/W4 → A5/W5 son ~17 días hábiles aunque haya dos personas. Con las
features de M4 y el alta de los pilotos al final, son cinco semanas.

**Mainnet se prepara en la semana 2 y, por defecto, sale en la semana 5**, el día 22, justo antes
de los pilotos. **La fecha es flexible** (dueño, 2026-10-05): puede adelantarse a cualquier día
desde el 10, porque no depende de la migración (§Qué tiene orden). El output 1 de M4 pide *"real data"*, no mainnet, pero el criterio 2
pide los ≥350 eventos y los TXIDs **en mainnet**, y el único uso real que los produce son los
pilotos. Salir antes no adelanta ningún criterio y cuesta ADA e infraestructura desde antes; salir
después obligaría a re-anclar lo de Preprod, sin uso real y con otros timestamps. Así, **las
semanas 1–4 no gastan nada en mainnet**, y el código que sale es el de la forma final. **Los
pilotos entran en la semana 5, sobre esa forma**, y las features de M4 nacen como módulos y no hay
que migrarlas (`SPEC-611` §El acople).

## Qué queda cerrado al final

| Cerrado | Cerrado por decisión, sin código | Lo que no se cierra |
|---|---|---|
| Mainnet en vivo, con URL, direcciones del contrato y dashboards | `SPEC-304` y `SPEC-305` (§1, decisiones 2 y 3) | **`SPEC-222` (PWA):** el dueño decidió mergearla recién cuando Catalyst acepte M3 (2026-09-30), y esa fecha no la controlamos |
| La Fase 2 entera: `612`–`617` | `SPEC-605` y `SPEC-606` (condicionales) | Los pisos de M4 (≥350 eventos, ≥10 contratos, ≥120 wallets…): son meses de pilotos |
| `SPEC-603` | `SPEC-020` (MCP) | **`SPEC-112`** (la pasada manual con VoiceOver): no entra; va a la semana 6, una persona durante un día |
| `SPEC-501`–`SPEC-504` | | |
| Los 3 pilotos dados de alta | | |

**Preprod no se toca.** Sigue siendo pre-producción y la evidencia de M3 (criterios 12 y 15)
mientras Catalyst la revisa. Mainnet es un entorno nuevo al lado, con servicios, base, bucket,
wallet y key de Blockfrost propios.

## 1 · Las decisiones (del dueño)

Si las del día 1–2 no salen en dos días, el calendario se corre lo mismo que tarden.

### Para mainnet, el día 1–2

| # | Decisión | Opciones | Recomendación |
|---|---|---|---|
| 1 | Revocar D-013 | ahora, en paralelo a la revisión de M3 · después de la aceptación (lo que dice el runbook) | Ahora, **solo si** Preprod queda intacto: los cambios de código son aditivos y `render-config.test.ts` defiende que los servicios de Preprod siguen en Preprod |
| 2 | Custodia de la clave del admin (`SPEC-304`, D-093) | dejarlo así · multisig M-de-N · VKH de recuperación | **Dejarlo así**, con la custodia del §3 y el control de detección del §4. Las otras dos cambian `spend`, `mint` y `packages/cardano`, y no entran con revisión 🔴 |
| 3 | `SPEC-305` | A1 · A2 · ninguna · solo la Parte B | **Ninguna**, que la spec da como postura legítima: el camino alcanzable ya lo cerró `SPEC-301` y un duplicado es detectable on-chain. La Parte B es una línea, pero cambia el hash también en Preprod mientras M3 está en revisión |
| 4 | Aceptar el costo de D-057 | 2 ADA bloqueadas por etapa, sin burn | Aceptarlo: son ~$0,53 por etapa al precio de hoy (§7) |
| 5 | API de mainnet en Render free o paga | Free ($0) · Starter ($7/mes) | **Starter.** En free, un reinicio por health check perdió 4 anclajes en la prueba de volumen, y los pilotos esperarían ~1 min de cold start |
| 6 | Turso free o pago | Free (1 día de PITR) · Developer ($4,99/mes, 10 días) | **Developer.** La base es la fuente de verdad del registro (D-007): sin ella, los hashes on-chain no se pueden atribuir a nada |
| 7 | Asientos para los dos desarrolladores | Render Hobby (1 asiento) · Pro ($25/mes) · Sentry Developer (1 usuario) · Team ($26/mes) | **Un solo titular** de Render y Sentry: el deploy sale de `git push` a `main` y los secretos los carga una persona, que es lo que la custodia 🔴 pide de todos modos |
| 8 | Legal greenlight de counsel/notario (criterio 2 de M4) | — | **Pedirlo el día 1.** Es una firma externa y no la controlamos |

### Para la Fase 2, el día 1–2 (las de `SPEC-611` §Decisiones)

| # | Decisión | Antes de | Recomendación |
|---|---|---|---|
| 9 | La evidencia de M3: se congela o se regenera (`SPEC-613` §La evidencia de M3) | A3, día 11 | **Congelarla**: Catalyst está revisando ese documento. Una copia fechada en `specs/evidencia-m3/`, y `openapi-freshness` pasa a comparar contra un archivo vivo aparte |
| 10 | Si una notificación que falla frena la mutación (`SPEC-613` §Decisión que pide) | A1, día 3 | La spec no recomienda; hasta que se decida, `notify(trx)` conserva el comportamiento de hoy (*best effort*) |
| 11 | El scope de proyecto del notary (`SPEC-615`) | A3, día 11 | Con dos developers reales en los pilotos, conviene acotarlo. Si cambia, la `MATRIZ` cambia en un commit propio, nunca adentro del piloto |
| 12 | Cuándo se persiste la compilación del dossier (`SPEC-615`) | A3, día 11 | La propuesta de la spec: los GET no escriben y el `masterHash` se fija al firmar |
| 13 | Con qué se activa el chip *Evidence by stage* del investor (`SPEC-616`) | W4, día 16 | Ver la spec |
| 14 | Si hace falta UI de espera al crear un proyecto (18,5 s medidos) (`SPEC-616`) | W4, día 16 | Ver la spec |

### Para cerrar lo condicional, el día 1–2

| # | Spec | Recomendación |
|---|---|---|
| 15 | `SPEC-605` (outbox + worker; contradice D-077) | Cerrarla como **no se hace**: D-077 sigue vigente y ningún disparador de su §Cuándo ocurrió. El diseño queda en `archive/` |
| 16 | `SPEC-606` (la sesión por pestaña) | Cerrarla como **no se hace**: la spec misma dice que hoy nada está roto |
| 17 | `SPEC-020` (servidores MCP) | Se postergó hoy sin disparador: cerrarla como no se hace, o dejarla postergada a propósito |

### Para M4, antes de la semana 4

| # | Decisión | Recomendación |
|---|---|---|
| 18 | **Qué cuenta como wallet única** (`SPEC-501`) | Ver §6. Es la única que cambia el producto |
| 19 | Si los ≥800.000 USDM son una conversión al armar el reporte o los contratos se denominan en USDM (`SPEC-501`) | La conversión no toca el dominio; la otra cambia `Contract.currency` |
| 20 | Qué evento dispara la encuesta NPS (`SPEC-503`) | La propuesta de la spec: la primera liberación |
| 21 | Completitud: promedio simple o ponderado (`SPEC-504`) | La propuesta de la spec: simple |

## 2 · Dónde se aparta de `RUNBOOK-mainnet-cutover.md`

| El runbook dice | Este plan propone | Por qué |
|---|---|---|
| No ejecutar antes de que M3 esté entregado | Ejecutar en paralelo, sin tocar Preprod | Lo pide el dueño; el riesgo para la evidencia de M3 queda acotado por tests (decisión 1) y por congelarla (decisión 9) |
| La clave de mainnet **no** es la simple: multisig o recuperación | La simple, con custodia y detección | Decisión 2. La clave nueva de mainnet ya da otro script hash; el código Aiken queda idéntico al que ancló los 180 eventos de Preprod |
| `SPEC-305` se recompila junto con la custodia | No se recompila | Decisión 3 |
| Los pilotos esperan a `SPEC-501`–`SPEC-504` | Esperan a `502` y `503`; `501` puede llegar después | `501` solo agrega números para el reporte |

**El primer mint en mainnet fija las decisiones 2 y 3 para siempre** (`SPEC-304`): hasta el día 22
se puede volver al runbook; después, no.

## Qué tiene orden y qué no

El calendario del §3 es una forma de repartir el trabajo. **Lo obligatorio es esto**; todo lo demás
se puede mover.

### Las cadenas: cada paso espera al anterior

**La migración** (`SPEC-611` §El acople):

```
A0.2 (612) → A1 (613) → A2 (607) → 609 ─┐
                                        ├─→ piloto: A3 + W3 (615) → regla de salida → A4 + W4 (616) → A5 + W5 (617)
                  614 ──────────────────┘
```

- `614` no espera a la API: se hace en cualquier momento antes del piloto.
- A3 y W3 van juntos; A4 y W4 avanzan en paralelo, módulo por módulo, y cada pantalla espera a su
  módulo de la API.
- Nada de A4 arranca antes de que el dueño apruebe el piloto.

**Mainnet:**

```
decisiones 1–8 → código (factory + render.yaml) → clave 🔴 + infra → ensayo → go/no-go → salida → proyecto propio → pilotos
```

- **La salida no depende de la migración.** Puede ir cualquier día desde que el ensayo está hecho.
  Si entre el ensayo y la salida entró código que toca la API, el go/no-go repite un ensayo corto
  sobre ese código.
- **El primer mint es irreversible:** fija las decisiones 2 y 3 (`SPEC-304`).

**Las features de M4:**

```
A2 → 504 · 502 · 503 (en cualquier orden entre ellas) → 501
```

- Esperan a A2 para nacer como módulos y no tener que migrarlas después (`SPEC-611`). Si se
  hicieran antes, funcionan igual, pero hay que migrarlas en A4.
- `501` va última porque consume a las otras tres, y espera la decisión 18 (qué es una wallet).

**Los pilotos** esperan cuatro cosas: mainnet en vivo con el proyecto propio recorrido, `502` en
producción (el drill de fallback la usa), el legal greenlight y su propia disponibilidad. `503`
tiene que estar antes de **la primera liberación**, no antes del alta.

### Las decisiones, cada una antes de su paso

| Decisión | Antes de |
|---|---|
| 1–8 (mainnet) | el código de mainnet |
| 10 (`notify`) | A1 |
| 9, 11 y 12 (evidencia de M3, scope del notary, compilación del dossier) | el piloto (A3) |
| 13 y 14 (chip del investor, espera al crear proyecto) | W4 |
| 18–21 (M4) | la spec de M4 que cada una afecta |
| 15–17 (cerrar `605`, `606`, `020`) | nada: se cierran cuando sea |

### Sin orden: en cualquier momento

- El corte de `603`.
- El runbook de mainnet, su parte de governance y el comando de detección del §4.
- La pasada manual de `112`.
- Cerrar por decisión `304`, `305`, `605`, `606` y `020`.
- Pedir el legal greenlight y confirmar a los pilotos (cuanto antes, porque no los controlamos).

**Fuera de nuestro control:** `SPEC-222` se mergea recién cuando Catalyst acepte M3.

## 3 · Las cinco semanas

**Dev A** se ocupa de la API: los pasos A de la migración y lo de `packages/cardano`. **Dev B**, de
la web (los pasos W) y de la infraestructura de mainnet. Todo lo 🔴 se hace en pareja: uno escribe
y el otro revisa, y el revisor tiene que poder explicar cada línea sin mirar el chat. Los dos sobre
`main` (D-030), un commit por cambio y cada uno con `verify:all` en verde. **El calendario no tiene
margen:** lo que se corre empuja a la semana 6, no comprime el ensayo ni el piloto.

### Semana 1 — decidir y arrancar

| Días | Dev A | Dev B |
|---|---|---|
| 1–2 | Las decisiones del §1 con el dueño, escritas en `DECISIONS.md` y en cada spec. Cierra A0.2 (`612`) | El corte de `603` en Render. Inventario de lo que asume Preprod: `REDES_PERMITIDAS` y `BLOCKFROST_URL` en `packages/cardano/src/factory.ts:7-13`, `CARDANO_NETWORK` en `render.yaml:182`, `VITE_EXPLORER_BASE` en `apps/web/src/lib/explorer.ts:1` (build time, una por build), el respaldo `?? "Preprod"` de `apps/api/src/domain/reconcile.ts:169`, y los docs de verificación |
| 3–5 | A1 (`613`) | `Mainnet` en `REDES_PERMITIDAS` con dos guardas: exige `ANCHOR_MODE=real` y una base remota, y nunca se elige en local ni en CI. Los servicios `-mainnet` en `render.yaml`, con `render-config.test.ts` defendiendo que los de Preprod siguen en Preprod (D-076). Antes de pushear, reproducir `buildCommand` y `startCommand` literales. Dev A revisa lo de `packages/cardano` |

En el mismo commit que habilita la red se reescriben D-013, la prohibición "No tocar mainnet" de
`CLAUDE.md` (por ejemplo: *"Mainnet solo en los servicios `-mainnet`; en local y en CI, nunca"*), la
fila de `README.md` §Fuera de alcance, y `specs/stack.md` §7 y §8.

### Semana 2 — A2, y mainnet preparado

| Días | Dev A | Dev B |
|---|---|---|
| 6 | A2 (`607`) | `614` |
| 7 | A2 · 🔴 en pareja con B: **clave de pago de mainnet** (D-078: clave, no seed), generada fresca y fuera del repo. El dueño la guarda offline en dos lugares; no vive en ninguna máquina de desarrollo | 🔴 la clave, en pareja. Base Turso nueva en Oregon (`aws-us-west-2`), con delete protection; bucket R2 nuevo; proyecto Blockfrost mainnet; proyectos de mainnet en Sentry y PostHog, y `service.name` propio en Grafana. **Todo en planes gratis hasta la salida.** **Sin seed de demo:** solo el admin con `SEED_ADMIN_PASSWORD` (D-047) |
| 8–9 | A2 | **Ensayo general:** los servicios `-mainnet` apuntando a Preprod con una wallet de ensayo, y un proyecto entero recorrido por la UI. Runbook de mainnet como sección nueva de `RUNBOOK-deploy.md`: un rollback de código no deshace nada on-chain · clave comprometida · wallet sin saldo · quién aprueba volver a Preprod. Backup verificado (`stack.md` §8b) |
| 10 | Cierra A2 | La parte de governance del runbook (quién aprueba volver a Preprod, quién accede a la clave y cómo se audita, `RUNBOOK-mainnet-cutover.md` §4) y el comando de detección del §4 |

### Semana 3 — el piloto y la regla de salida

| Días | Dev A | Dev B |
|---|---|---|
| 11–13 | A3: el módulo `dossier` de la API (`615`) | `609` (W2: el cliente sale del contrato) |
| 13–14 | `504` como módulo nuevo | W3: las pantallas del dossier (`615`) |
| 15 | **La regla de salida de `SPEC-611`:** el dueño revisa el piloto. Si el módulo no quedó claramente más chico y más legible, la migración se frena acá y las semanas 4–5 se usan para M4 y los pilotos (el plan termina en la semana 4) | ídem |

### Semana 4 — el resto de la migración

| Días | Dev A | Dev B |
|---|---|---|
| 16–20 | A4 (`616`): los 7 módulos restantes de la API, en el orden de la spec | W4 (`616`): las pantallas del rol de cada módulo, siguiendo a A |

### Semana 5 — una sola forma, mainnet en vivo y los pilotos

| Días | Dev A | Dev B |
|---|---|---|
| 21 | A5 (`617`) | W5 (`617`) |
| 22 | `502` (disputas), con sus tests de rechazo | **Go/no-go de mainnet** (§5). Re-ensayo corto sobre el código de la semana 5, paso de Render y Turso a los planes pagos, fondear el tramo de la salida (§7), publicar el reference script (`RUNBOOK-deploy.md` paso 6) y reiniciar la API. **Mainnet en vivo** |
| 23 | `502` | El proyecto propio en mainnet, de punta a punta, con cada TXID contra Koios y Cardanoscan |
| 24 | Cierra `502` | `503` (NPS) |
| 25 | `501` (panel del piloto) | Cierra `503`. **Gate de los pilotos** (§5): fondear su tramo y darlos de alta (proyectos, contratos y evidencia). El drill de fallback, con `502` ya en producción |

**La semana 5 es la más cargada.** Si algo se corre, el alta de los pilotos pasa al día 26; el
go/no-go y el proyecto propio no se comprimen. `112` va a la semana 6.

## 4 · El control que acompaña a "dejarlo así"

Con la clave caliente en Render, quien la robe puede anclar transiciones falsas, y el validador no
lo distingue. La detección no necesita un cron: un comando documentado, que se corre a mano cada
semana, compara las transacciones de la dirección de servicio (vía Koios) contra `OnChainEvent`.
Una tx que la base no conoce es un incidente.

## 5 · Los dos gates

**Mainnet en vivo, día 22:**

- [ ] Decisiones 1–8 escritas en `DECISIONS.md`, y D-013 revisada.
- [ ] `verify:all` verde; `render-config.test.ts` defiende las dos redes.
- [ ] Ensayo del día 9 completo: 10 etapas `Completed`, cada TXID `Confirmed` y verificado.
- [ ] Re-ensayo del día 22 sobre el código ya migrado: un mint y una transición, confirmados.
- [ ] La clave de mainnet guardada offline en dos lugares, y su VKH anotado en `stack.md` §8b.
- [ ] Base de mainnet sin cuentas demo; backup verificado.
- [ ] Runbook de mainnet escrito.

**Pilotos, día 25:**

- [ ] La Fase 2 cerrada, o frenada por la regla de salida y escrito por qué.
- [ ] `502` y `503` en producción, con sus tests en verde.
- [ ] Decisiones 18–21 tomadas.
- [ ] Legal greenlight firmado. Sin él, mainnet sigue solo con el proyecto propio.
- [ ] Pilotos confirmados para esos días.

## 6 · Contra el texto oficial de M4

El texto de Catalyst (Milestone Module, releído el 2026-10-05) coincide palabra por palabra con la
transcripción de [`ESTADO-2026-09-22-catalyst-milestone-4.md`](archive/ESTADO-2026-09-22-catalyst-milestone-4.md).

| M4 pide | Al final de las cinco semanas | Qué falta |
|---|---|---|
| Output 2 · URL de mainnet y direcciones del contrato publicadas | ✅ desde el día 22 | — |
| Output 2 · dashboards operacionales | ✅ Sentry, Grafana y PostHog contra mainnet | — |
| Output 2 · playbooks de governance y operación | ✅ el runbook de mainnet y su parte de governance (semana 2) | — |
| Criterio 2 · ≥350 eventos on-chain y ≥100 hashes de documentos | ~60 del proyecto propio, más el arranque de los pilotos | Uso real de los pilotos. **Con eventos de uso real, no con proyectos sintéticos para llegar al número** |
| Criterio 2 · valor de escrow simulado, reportado | ✅ en `501`, como agregado sin custodia (D-021) | — |
| Criterio 2 · legal greenlight de counsel/notario | lo que tarde la firma | Externo, pedido el día 1 |
| Evidencia 2 · TXIDs de mainnet en explorador público | ✅ | Crece con los pilotos |
| Evidencia 2 · capturas de eventos, **wallets** y liberaciones | ◐ el panel de `501` | Las wallets, según la decisión 18 |
| Output 1 y criterio 1 · métricas del piloto | ✅ `501`–`504` construidas | Los números, que salen de correr los pilotos |
| Output 1 · drill de fallback (inspección fallida → re-inspección/reembolso) | ✅ `502`. La re-inspección ya existe (`Observed`, D-020); el reembolso se registra como declaración, nunca como movimiento de valor | Ejercitarlo con un piloto |
| Outputs 3 y 4 · documentación, dossier notarial, closeout | ✗ | Después de correr los pilotos: el output 3 pide incorporar su feedback |

### Lo que el texto oficial pone en riesgo y este plan no resuelve

- **≥120 wallets únicas.** `SPEC-501` define la wallet única como *"wallets CIP-30 distintas que
  firmaron al menos una transacción anclada"*. Pero hoy **toda** transacción la firma el admin
  (D-058) y no hay co-firma CIP-30 (D-009): on-chain hay una sola wallet. No se llega a 120 sin una
  de dos cosas, y las dos son del dueño: redefinir qué cuenta como wallet, o que los compradores
  conecten una wallet, que es un cambio de producto que no está en este calendario.
- **≥800.000 USDM en valor** (decisión 19).
- **≥10 contratos firmados, ≥15 liberaciones, ≥120 compradores y NPS ≥70.** Son metas comerciales
  de los pilotos, no de ingeniería: dependen de cuántos compradores reales traigan los dos
  developers.

## 7 · Presupuesto

La migración y las features de M4 no agregan gastos: lo único que cuesta plata es mainnet.

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
| Sentry | errores y web vitals | Developer **$0** (5.000 errores/mes, 5M spans/mes, 1 usuario) | $0 | Team sale $26/mes, si los dos necesitan acceso |
| Grafana Cloud | traces y métricas | Free **$0** (10k series, 50 GB de traces, 3 usuarios, 14 días) | $0 | |
| PostHog | web analytics | Free **$0** (1M eventos/mes) | $0 | |
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
| **La salida, día 22:** reference script + proyecto propio | 11 + 33 = 44 → con 25% de margen, **~55** | **~$15** |
| **Los pilotos, semana 5:** 3 proyectos con el tour completo | 3 × 33 = 99 → con margen, **~125** | **~$33** |
| **Hasta el piso de M4** (≥350 eventos, incluye lo anterior), si cada etapa hace el camino feliz (4 tx por etapa → 88 etapas) | 77 de fees + 176 bloqueados + 11 = 264 → con margen, **~330** | **~$88** |
| Lo mismo, si cada etapa hace el tour completo (6 tx por etapa → 59 etapas) | 77 + 118 + 11 = 206 → con margen, **~260** | **~$69** |
| **Por cada proyecto nuevo, después** | ~33 | ~$9 |

**Fondear con poco.** La wallet se carga por tramos (la salida, después los pilotos), no con todo
lo de M4: lo que queda en una clave caliente es lo que se pierde si se compromete.

### Total

| | USD | ARS (USD a $1.520) |
|---|---|---|
| **Semanas 1–4** | **$0** | $0 |
| **Las cinco semanas**, recomendado (un mes de infra desde la semana 5 + la salida + los pilotos) | **~$60** | ~$91.000 |
| Las cinco semanas, mínimo absoluto (todo free + el mismo ADA) | ~$48 | ~$73.000 |
| **Por mes, después** | $11,99 + ~$9 por proyecto nuevo | ~$18.000 + ~$14.000 por proyecto |
| ADA total hasta el piso de M4 | $69–$88 | $105.000–$134.000 |

No incluye horas de los dos desarrolladores, el legal greenlight ni un dominio propio.

## 8 · Riesgos

| Riesgo | Mitigación |
|---|---|
| Las decisiones del §1 tardan más de dos días | El calendario se corre lo mismo que tarden, sin comprimir el ensayo ni el piloto |
| La migración se corre (el camino crítico no tiene margen) | Lo que no entra pasa a la semana 6. Los pilotos esperan a la forma final, no la apuran |
| El piloto `dossier` no convence (regla de salida) | La migración se frena el día 15, A0–A2 y W2 no se pierden, y el plan termina en la semana 4 |
| El legal greenlight no llega en la semana 5 | Mainnet sale igual con el proyecto propio; los pilotos esperan la firma |
| El ensayo de la semana 2 corrió sobre código que la migración cambió después | El re-ensayo del día 22, sobre el código final, es parte del go/no-go |
| La semana 5 junta la salida, A5/W5, `502`, `503` y los pilotos | El ensayo ya está hecho en la semana 2; lo que se corre empuja el alta de los pilotos, nunca el go/no-go |
| Blockfrost Starter no admite los dos proyectos | Hobby a €29/mes, o la idea de Koios (`README.md` §Antes de mainnet, ítem 8), que todavía no está medida para Plutus V3 |
| El precio de ADA sube | El presupuesto en ADA no cambia; en dólares escala lineal. A $0,50, la salida y los pilotos salen ~$90 |
| La disponibilidad de los pilotos en la semana 5 | No la controlamos: confirmarla el día 1 |
| Cambios en `main` mientras Catalyst revisa Preprod | Los cambios son aditivos, `render-config.test.ts` defiende la red de cada servicio, y la evidencia de M3 se congela antes de A3 (decisión 9) |

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
