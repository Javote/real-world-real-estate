# Runbook — pasar a producción (mainnet cutover para Milestone 4)

> Este runbook **asume que las specs de abajo ya están cerradas**. No es una lista de trabajo — es
> la secuencia operativa para el día en que sí lo estén. Complementa a
> [`RUNBOOK-deploy.md`](RUNBOOK-deploy.md) (deploy/rollback de Preprod, que no cambia) y a
> [`ESTADO-2026-09-22-catalyst-milestone-4.md`](archive/ESTADO-2026-09-22-catalyst-milestone-4.md) (qué pide
> Catalyst y qué falta).
>
> Mainnet sin recompilar el validador, junto con la Fase 2 y con presupuesto, es una propuesta
> aparte: [`PLAN-2026-10-05-mainnet-y-fase-2.md`](PLAN-2026-10-05-mainnet-y-fase-2.md).
> Se aparta de este runbook en tres puntos que decide el dueño (su §2).
>
> **El dueño eligió el plan en los tres (D-013 revisada y D-105, 2026-10-23), y gana sobre este
> runbook:** mainnet sale en paralelo a la revisión de M3, sin tocar Preprod; la clave de mainnet es
> la simple, con custodia y detección; y el validador no se recompila (`SPEC-305` no se hace).
> Donde abajo se lee esperar a M3, multisig, VKH de recuperación o recompilar `plutus.json` (§0 y
> los puntos 4 y 5 del §2), no aplica.

## 0 · Precondición: qué tiene que estar cerrado antes de tocar esto

| Bloque | Ítems | Dónde se verifica |
|---|---|---|
| **M3 entregado y aceptado** | Los 16 criterios del SOM | [`specs/README.md`](README.md) §"Listo" y §Lo que sigue |
| **Antes de mainnet** | Runbook de red, custodia de la clave admin, unicidad de hilo + tope de `evidence_root`, decisión sobre las 2 ADA bloqueadas, y el proveedor (idea Koios); forma de hashes/TXID, `outputRef` buscado y datum validado van antes, en la Fase 1 | [`specs/README.md`](README.md) §Antes de mainnet, `SPEC-304`, `SPEC-305`, `SPEC-402`, `SPEC-407`, `SPEC-408` |
| **Dominio nuevo de M4** | Panel de métricas, disputas, NPS, completitud | `SPEC-501`–`SPEC-504` |
| **Legal** | Greenlight de mainnet por counsel/notary (criterio 2 del SOM) — **es una firma humana, no un paso de este runbook** | Externo — bloqueante, se pide en paralelo a todo lo de arriba, no al final |

Si falta cualquiera de estos, **no seguir**: el ítem 3 (`SPEC-305`) y la decisión de custodia del
ítem 2 (`D-093`) cambian juntos el script hash — hacerlo en dos pasadas (compilar, publicar,
descubrir que la custodia obliga a recompilar) es mucho más caro que decidir antes de compilar.

## 1 · El alta (una sola vez)

Mainnet no reutiliza nada de Preprod: ni wallet, ni proyecto de Blockfrost, ni base, ni bucket, ni
proyectos de observabilidad. El código ya lo admite (D-013); esto es lo que se hace a mano, **y lo
hace el dueño**. El estado de cada paso vive en [`README.md`](README.md) §Antes de mainnet.

1. **Blockfrost**: proyecto **Mainnet**, con su key (empieza con `mainnet`). Confirmar en el
   dashboard que el plan admite un segundo proyecto además del de Preprod.
2. **La clave de pago 🔴** (D-078, D-105), en pareja y con la key del paso 1:

   ```bash
   CARDANO_NETWORK=Mainnet BLOCKFROST_API_KEY='<key mainnet>'      pnpm --filter @plataforma/cardano wallet:new
   ```

   Escribe `~/propnexus-wallet-mainnet.key` (600) y no la imprime; imprime la dirección (`addr1…`)
   y el admin. **La clave se guarda offline en dos lugares y no se queda en ninguna máquina de
   desarrollo**: se borra después de cargarla en Render. La dirección y el admin van a
   [`stack.md`](stack.md) §8b. No se rota: el admin del validador es su hash (D-093).
3. **Turso**: ✅ **hecho el 2026-10-30** — `propnexus-mainnet`, en el grupo `propnexus`
   (`aws-us-west-2`, el de Preprod), con delete protection y las migraciones aplicadas; las
   coordenadas, en [`stack.md`](stack.md) §8b. El `startCommand` las vuelve a correr en el primer
   arranque y no aplica ninguna: ya están registradas.
4. **R2**: bucket `propnexus-evidencia-mainnet`, con un token de tipo **Account**, como el de
   Preprod.
5. **Sentry, PostHog y Grafana**: los mismos proyectos que Preprod (dueño, 2026-10-31). Los planes
   free admiten uno, y con la API de Preprod suspendida no hay trazas de dos redes que mezclar. Si
   Preprod vuelve a prenderse, sus datos caen en los mismos proyectos.
6. **Render: New → Blueprint**, rama `main`, *Blueprint path* `render.mainnet.yaml`. El asistente
   pide cada `sync: false`: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, las tres `S3_*`,
   `BLOCKFROST_API_KEY`, `SERVICE_WALLET_PRIVATE_KEY`, `SENTRY_DSN` y las dos `OTEL_*` en la API;
   `VITE_API_ORIGIN`, `VITE_SENTRY_DSN` y las dos `VITE_POSTHOG_*` en la web. `WEB_ORIGIN` y
   `VITE_API_ORIGIN` son las URLs de los servicios nuevos, con esquema: si todavía no se conocen,
   se cargan después, con un restart de la API y un redeploy de la web.
7. **El arranque**: `AnchorPort listo en modo "real"` en el log y la dirección `addr1…` del paso 2.
   Si dice `disabled`, la línea de arriba dice por qué (D-075).
8. **El admin, y nadie más**: sin cuentas de demo ni credenciales de Preprod (D-106). La
   password, nueva, del gestor de passwords; `read -s` para que no quede en el historial:

   ```bash
   read -s SEED_ADMIN_PASSWORD && export SEED_ADMIN_PASSWORD
   DATABASE_URL=libsql://propnexus-mainnet-javote.aws-us-west-2.turso.io \
   DATABASE_AUTH_TOKEN="$(cat ~/propnexus-turso-mainnet.token)" \
   SEED_ADMIN_EMAIL='<email del admin>' \
     pnpm --filter @plataforma/api db:seed:admin
   ```

   Developer, notary, certifier e investors los crea ese admin desde la app. **Hecho de otra forma
   el 2026-10-31** (D-106): las cinco cuentas con los emails de Preprod y passwords nuevas.
9. **Fondear el tramo de la salida** (~55 ADA, plan §7) y **publicar el reference script**, una
   vez por red (D-083):

   ```bash
   CARDANO_NETWORK=Mainnet BLOCKFROST_API_KEY='<key mainnet>'    SERVICE_WALLET_PRIVATE_KEY="$(cat ~/propnexus-wallet-mainnet.key)"      pnpm --filter @plataforma/cardano ref:publish
   ```

   Inmoviliza ~11 ADA. **Después, reiniciar la API**: el reference script se descubre al arrancar.

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
   número real de la prueba de volumen (`~33 ADA` por proyecto de 10 etapas: los ~99.8 ADA de
   `REPORTE-2026-09-10-prueba-de-volumen.md` son de los 3 proyectos juntos) antes de medir 30+ proyectos reales de golpe en
   mainnet. No bloquea empezar a trabajar en 1-5; bloquea abrir pilotos a escala.

**Al final, el switch real, después de todo lo anterior y del legal greenlight firmado:**

7. **Ítem 1 — habilitar la red.** D-013 se revisó el 2026-10-23 y `render.mainnet.yaml` ya declara
   `CARDANO_NETWORK=Mainnet`: lo que queda es el alta del §1.

## 3 · Encender el anclaje real en mainnet

Mismo procedimiento que `PLAN-2026-08-31-anclaje-real.md` usó para Preprod, con dos diferencias:

- **`ANCHOR_MODE=real` y `CARDANO_NETWORK=Mainnet` se cargan juntos**, nunca uno antes que el otro —
  D-075 asegura que una configuración a medio cargar solo inhabilita el puerto, no tumba la API, así
  que el riesgo operativo es bajo, pero cargarlos separados generaría una ventana confusa de logs.
- **El primer anclaje de prueba se hace sobre un proyecto de scratch, no sobre el primer piloto
  real** — mismo motivo que el incidente de `torre-a` documentado en `specs/archive/CLAUDE-subarboles-hasta-2026-10-01.md`: hay que
  confirmar que el hilo se abre bien (mint) antes de que la primera transición real de un piloto
  dependa de eso.

**Verificar, antes de anunciar la URL pública:**

```bash
# el mismo smoke test que valida instrumentación en Preprod, contra el binario compilado real
node --import ./dist/src/instrumentation.js dist/src/server.js
```

Y una transacción de prueba resuelta contra Blockfrost mainnet, confirmada independientemente en un
explorador público (Cardanoscan/Koios) — mismo patrón que la lista de TXIDs de M3
(`EVIDENCIA-2026-09-11-lista-formal-de-txids.md`), esta vez sobre mainnet.

## 4 · Publicar lo que el criterio 2 exige

- **URL mainnet** — la de los servicios Render nuevos del §1, publicada donde Catalyst la
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
| El primer anclaje real en mainnet falla por wallet sin fondos | Mainnet no tiene faucet — un error de cálculo de fees cuesta ADA real | Fondear con margen (mirar el costo real medido en la prueba de volumen de Preprod, ~33 ADA por proyecto de 10 etapas —los ~99.8 del reporte son de los 3 proyectos juntos—, y multiplicar por los pilotos previstos) antes del primer mint |
| Un piloto real dispara el drill de fallback antes de que `SPEC-502` esté testeado en producción | A diferencia de Preprod, hay una persona real esperando una resolución | No abrir pilotos hasta que `SPEC-502` tenga sus propios tests de rechazo en verde, igual que cualquier ruta 🟡 |
| La clave del admin (paso 2.5) queda en un estado a medio decidir cuando el primer piloto ya está corriendo | Cambiar de custodia después de mintear hilos reales es un cambio de script hash con hilos ya vivos — mismo problema que describe `SPEC-305` para Preprod, pero con reputación real en juego | Cerrar la decisión de custodia **antes** de abrir el primer piloto, no en paralelo |
