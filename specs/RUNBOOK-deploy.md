# Runbook — deploy, rollback e incidentes

> Criterio 14 del SOM. Cubre `apps/web` y `apps/api` en **Render free tier** (D-039, D-040,
> D-041), con la base en **Turso** (D-038). El artefacto de infraestructura es `render.yaml` en la
> raíz, y es la única fuente de verdad de la configuración: lo de acá explica **cómo se opera**, no
> qué dice el YAML.
>
> **Todo corre a $0/mes.** Eso impone cosas que no son negociables — están en §Limitaciones.

## 0 · Qué se despliega

| Servicio | Qué es | URL | Arranca con |
|---|---|---|---|
| `propnexus-api` | Express 5 sobre Node | `https://propnexus-api.onrender.com` | migraciones + `server.js` |
| `propnexus-web` | SPA estática (TanStack Router + Vite) | `https://propnexus-web.onrender.com` | servida desde CDN, sin proceso |
| base | SQLite gestionada | `libsql://…turso.io` | — |

**El web NO proxea nada.** Hasta D-065 era un servicio SSR sobre Nitro que reenviaba `/api/**`
desde su propio origen, y por eso no había CORS. Como **SPA estática** vive en otro origen y pega
a la URL absoluta de la API, así que:

- el navegador **sí** ve la URL de la API, y **sí** hay preflight de CORS;
- la API acepta al web por **lista blanca** (`WEB_ORIGIN`), nunca con `*`;
- `VITE_API_ORIGIN` es de **build time** — cambiarla exige *redeploy* del web, no un restart;
- `WEB_ORIGIN` es de **runtime** en la API: toma con un restart.

Las dos variables son el par que hace que la app funcione. Si falta una, el web carga y ninguna
request pasa. Ver §2.

## 1 · Alta por primera vez

Se hace una sola vez. Requiere cuentas en Render y Turso (las dos gratis, sin tarjeta).

### 1.1 · Base en Turso

```bash
turso auth login                                  # abre el browser
turso db create propnexus                         # free: 5 GB · 500M lecturas · 10M escrituras/mes
turso db show propnexus --url                     # → libsql://propnexus-<org>.<region>.turso.io
turso db tokens create propnexus                  # → el DATABASE_AUTH_TOKEN
```

Guardá los dos valores: van al dashboard de Render, **nunca al repo** (regla 12).

### 1.2 · Los dos servicios en Render

```bash
render login
```

En el dashboard: **New → Blueprint**, elegí el repo `Javote/real-world-real-estate`, rama `main`.
Render lee `render.yaml` y propone los dos servicios —**la API como servicio Node y el web como
static site** (D-065)—. Va a pedir los valores marcados `sync: false`:

| Servicio | Variable | Valor |
|---|---|---|
| `propnexus-api` | `DATABASE_URL` | el `libsql://…` de 1.1 |
| `propnexus-api` | `DATABASE_AUTH_TOKEN` | el token de 1.1 |
| `propnexus-api` | `WEB_ORIGIN` | **la URL del web, con esquema** — lista blanca de CORS |
| `propnexus-web` | `VITE_API_ORIGIN` | **la URL de la API, con esquema** |

`JWT_SECRET` **no se pide**: lo genera Render (`generateValue: true`). No lo pongas a mano y no lo
copies del `.env` local.

**Las dos URLs se cruzan, y ese cruce tiene un orden.** El web necesita saber dónde está la API
**en build time**; la API necesita saber dónde está el web para el CORS, pero eso es runtime y se
puede cargar después. Procedimiento seguro:

1. Dejá que **la API** despliegue primero y copiá su URL del dashboard.
2. Pegala en `VITE_API_ORIGIN` del web y disparale **Manual Deploy → Clear build cache & deploy**.
3. Copiá la URL del **web** y pegala en `WEB_ORIGIN` de la API. Esa sí toma con un restart.

Si Render tuvo que agregarle sufijo a un hostname porque el nombre estaba tomado, la URL real no es
la de la tabla: usá siempre la que muestra el dashboard.

**Síntoma de haberse salteado el paso 3:** la app carga, el login no responde y la consola del
browser muestra un error de CORS. No es la API caída — es que su lista blanca no tiene ese origen.

### 1.3 · Sembrar las cuentas de demo

El free tier **no da shell remota**, así que el seed se corre desde tu máquina contra Turso:

**El seed NO imprime las passwords que vinieron del entorno** — imprime `(desde
SEED_ADMIN_PASSWORD)`. Es deliberado, está fijado por el test *"NUNCA imprime una password que vino
del entorno"* (`apps/api/test/seed-credentials.test.ts`) y es la razón por la que este
procedimiento tiene **dos pasos**: si generás las passwords inline con `$(openssl …)`, nadie las ve
nunca y quedan cinco cuentas cuyas credenciales no conoce nadie — sin shell remota para arreglarlo.

Generalas y **guardalas primero**:

```bash
ADMIN_PW=$(openssl rand -base64 24)
DEMO_PW=$(openssl rand -base64 24)
echo "admin@example.com  → $ADMIN_PW"    # ← copialas al gestor de passwords AHORA
echo "los otros cuatro   → $DEMO_PW"
```

Recién entonces, **en esa misma shell** (las variables solo existen ahí):

```bash
DATABASE_URL='libsql://propnexus-<org>.<region>.turso.io' \
DATABASE_AUTH_TOKEN="$(turso db tokens create propnexus)" \
SEED_ADMIN_PASSWORD="$ADMIN_PW" \
SEED_DEMO_PASSWORD="$DEMO_PW" \
JWT_SECRET=cualquier-cosa-el-seed-no-firma-nada \
pnpm --filter @plataforma/api db:seed
```

`$(turso db tokens create propnexus)` evita copiar y pegar el token. Los tokens son **aditivos**:
crear uno nuevo no invalida el que ya está en Render. Lo que sí rompe la API desplegada es
`turso db tokens invalidate`, que los mata **todos** de una — no lo corras.

**Las passwords son obligatorias contra Turso y el seed revienta sin ellas** (D-047): las
credenciales del seed local están publicadas en el repo, y sembrarlas en una instancia desplegada
deja una cuenta admin de credenciales conocidas. Las que guardaste en el paso 1 son las que se le
pasan a un reviewer.

Las migraciones **no** hay que correrlas a mano: van en el `startCommand` de la API y son
idempotentes (tabla `_migrations`).

### 1.4 · El bucket de evidencia en Cloudflare R2

R2 free: **10 GB de almacenamiento y egress $0** — esto último es la razón de R2 y no de S3.

El driver ya existe y es el mismo que se prueba contra MinIO en local (D-011): acá no se escribe
código, se crean un bucket y un par de claves.

1. Dashboard de Cloudflare → **R2** → *Create bucket* → nombre **`propnexus-evidencia`**
   (tiene que coincidir con `S3_BUCKET` de `render.yaml`). Location *Automatic*.
2. **R2 → Manage API Tokens → Create API Token**, de tipo **Account**, permiso **Object Read &
   Write**, alcance limitado a ese bucket.

   **Account y no User, y no es un detalle.** Un token de usuario *"inherits your personal
   permissions and becomes inactive if your user is removed from the account"*: ataría la
   persistencia de toda la evidencia a que esa persona conserve su acceso. El de cuenta *"remains
   valid until manually revoked"*. Y **Object** Read & Write, no *Admin*: la API no crea ni borra
   buckets, de ahí `S3_CREATE_BUCKET=false`.

   Cloudflare muestra el par **una sola vez**: `Access Key ID` + `Secret Access Key`.

3. Anotá el **endpoint**. Cloudflare da el *jurisdiction-specific endpoint* ya armado: **usá ese,
   verbatim**. Si el bucket quedó en una jurisdicción (EU, por ejemplo) la URL lleva ese segmento en
   el medio y la forma genérica `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` **no funciona**.

En la misma pantalla Cloudflare entrega además un **token para su API REST**. Ese **no** va a
Render: el driver habla S3 y se autentica con el par de claves. Cargarlo sería un secreto de más en
el entorno, con más permisos de los necesarios y sin que nada lo lea.

**Probá contra R2 ANTES de desplegar.** El mismo test de integración que corre contra MinIO sirve
apuntado a R2, y es la única forma de saber que las credenciales andan sin arriesgar la API:

```bash
S3_TEST=1 \
S3_ENDPOINT='https://<ACCOUNT_ID>.r2.cloudflarestorage.com' \
S3_BUCKET=propnexus-evidencia \
S3_ACCESS_KEY_ID='<access key>' \
S3_SECRET_ACCESS_KEY='<secret>' \
S3_REGION=auto S3_FORCE_PATH_STYLE=false S3_CREATE_BUCKET=false \
pnpm --filter @plataforma/api exec vitest run test/storage-s3.test.ts
```

Las dos últimas variables **no son redundantes**: los defaults del código apuntan a MinIO
(`us-east-1` y path-style) y R2 quiere `auto` y virtual-hosted-style.

**⚠ El orden es obligatorio, no una recomendación.** `STORAGE_DRIVER=s3` sin las `S3_*` hace que la
API **no arranque** — `required()` en `storage.ts` tira, y por D-042 eso es a propósito: falla al
arrancar y no en el primer upload, con un usuario esperando. O sea que las credenciales van al
dashboard de Render **antes** de que el `render.yaml` con `STORAGE_DRIVER=s3` llegue a `main`. Si se
invierte el orden, la API queda caída hasta que se carguen.

Al sincronizar el Blueprint, Render pide los tres nuevos `sync: false`: `S3_ENDPOINT`,
`S3_ACCESS_KEY_ID` y `S3_SECRET_ACCESS_KEY`.

### 1.5 · Anclaje real en Preprod

Opcional: la instancia funciona con `ANCHOR_MODE=simulated`, que es el default. Esto la pasa a
anclar de verdad en Cardano Preprod.

1. **Blockfrost** — cuenta gratis, proyecto **Preprod**, copiar la key (empieza con `preprod`).
2. **La wallet de servicio**, con el generador del repo:

   ```bash
   BLOCKFROST_API_KEY='<key preprod>' pnpm --filter @plataforma/cardano wallet:new
   ```

   Escribe la **clave de pago** en `~/propnexus-wallet-preprod.key` con permisos `600` y **no la
   imprime**; imprime la dirección y el admin, que son públicos. Se niega a pisar un archivo
   existente.

   Es una clave de pago y no una seed (D-078): **una sola clave, una sola vez**. La dirección se
   deriva de ella, así que no hay una segunda variable que pueda quedar desincronizada.

   ⚠ **No se rota.** El admin del validador es el hash de esta clave: reemplazarla deja
   inalcanzables los hilos ya anclados, sin ningún error visible.

3. **Fondear la dirección que imprimió el generador** desde el
   [faucet](https://docs.cardano.org/cardano-testnets/tools/faucet) — **Preprod**, no Preview. Un
   anclaje cuesta ~0,17 tADA y el reference script del paso 6 inmoviliza ~11 tADA, así que alcanza
   de sobra.

   **El faucet pide una dirección, no una clave.** Tiene que ser exactamente la que el servicio
   mira; el arranque de la API la vuelve a imprimir (`Wallet de servicio: addr_test1…`) para poder
   compararla sin derivar nada a mano.

   Verificar el saldo sin necesitar la key, contra Koios:

   ```bash
   curl -s -X POST https://preprod.koios.rest/api/v1/address_info \
     -H 'Content-Type: application/json' -d '{"_addresses":["addr_test1..."]}'
   ```

4. **Probar en local antes de tocar el deploy**, que es el orden que ya usamos con R2:

   ```bash
   export BLOCKFROST_API_KEY='<key>'
   export SERVICE_WALLET_PRIVATE_KEY="$(cat ~/propnexus-wallet-preprod.key)"
   DATABASE_URL='file:./apps/api/.data/dev.db' JWT_SECRET=local \
   ANCHOR_MODE=real CARDANO_NETWORK=Preprod PORT=8788 \
   node apps/api/dist/src/server.js
   ```

   La línea a mirar es `AnchorPort listo en modo "real"`. Si dice `simulated`, la variable no llegó;
   si el proceso murió, el error dice qué falta (D-042).

5. **En Render**, sobre `propnexus-api`: `BLOCKFROST_API_KEY` y `SERVICE_WALLET_PRIVATE_KEY`. Son de
   runtime y toman con un restart. `ANCHOR_MODE` **ya no se toca a mano**: el Blueprint lo declara
   con `value: real`, así que un cambio en el dashboard lo pisa el próximo re-sync.

   **Si falta alguno de los dos, la API levanta igual** con el anclaje inhabilitado (D-075). El
   arranque lo dice —`AnchorPort listo en modo "disabled"`, con el motivo en la línea de arriba— y
   todo anclaje rechaza, así que nunca escribe un TXID que no exista. Es el estado seguro, no el
   estado bueno: hasta cargarlos, la plataforma registra pero no prueba.

6. **Publicar el validador como reference script** (D-083). Se hace **una vez por red**, en cuanto
   la wallet esté fondeada, y no depende de los pasos anteriores:

   ```bash
   BLOCKFROST_API_KEY='<key>' \
   SERVICE_WALLET_PRIVATE_KEY="$(cat ~/propnexus-wallet-preprod.key)" \
   pnpm --filter @plataforma/cardano ref:publish
   ```

   Deja un UTxO con el validador adentro en la dirección de la wallet. A partir de ahí cada
   transacción de hilo lo **referencia** en vez de llevarlo: de 2890 a 599 bytes, de 0,2976 a 0,2317
   tADA. **Es idempotente**: correrlo dos veces no publica dos veces ni gasta de nuevo.

   Inmoviliza ~11 tADA — el mínimo que Cardano exige para un UTxO con un script adentro, no valor
   (D-021). Quedan en la wallet y se recuperan con una transacción deliberada.

   ⚠ **Después hay que reiniciar la API.** El reference script se descubre al arrancar el proceso:
   una instancia ya levantada sigue adjuntando el validador hasta el próximo deploy o restart. No
   rompe nada, paga de más.

**Verificar un anclaje contra la cadena**, sin la key, con el TXID que devuelve el endpoint:

```bash
curl -s -X POST https://preprod.koios.rest/api/v1/tx_metadata \
  -H 'Content-Type: application/json' -d '{"_tx_hashes":["<txid>"]}'
```

La metadata trae la etiqueta `1904` con `h` (el SHA-256) y `r` (una referencia **opaca**, nunca el
nombre del archivo ni PII — regla 2).

**El anclaje nace `Pending` y hay que reconciliarlo.** Anclar deja el evento en `Pending` porque en
ese momento la transacción está *enviada*, no confirmada, y la regla 17 prohíbe afirmar una prueba
sin sustanciarla. Quien la promueve a `Confirmed` es:

```bash
curl -s -X POST https://propnexus-api.onrender.com/api/v1/evidence/reconcile \
  -H "Authorization: Bearer <token de admin>"      # → {"revisados":N,"confirmados":M}
```

Consulta `/txs/{hash}` en Blockfrost por cada pendiente con TXID y confirma los que ya entraron en
un bloque. Es idempotente: dispararlo de más no cuesta nada, y un evento sin TXID no se toca —ahí no
hay nada que consultar—.

**Hay que dispararlo desde afuera, y no es pereza:** un `setInterval` dentro de la API deja de contar
cuando Render duerme el servicio a los 15 minutos, y el free tier no tiene workers (D-003 · D-040).
Lo dispara un cron de GitHub Actions contra ese mismo endpoint (`.github/workflows/reconcile.yml`,
todos los días a las 06:00 UTC), que además falla si encuentra hilos sospechosos. También se puede
correr a mano, y cada pantalla que muestra un anclaje reconcilia lo suyo al leer (D-077).

En Preprod un bloque tarda ~20 s, así que reconciliar inmediatamente después de anclar suele devolver
`confirmados: 0`. No es un error: es que todavía no confirmó. Volvé a correrlo.

## 2 · Deploy de todos los días

Push a `main`. Hasta el 2026-09-22, Render reconstruía **los dos servicios en cada push**, tocara lo
que tocara.

**Los `buildFilter` estaban declarados y no filtraban.** Medido el 2026-08-27: el commit `ee357df`
tocó solo tres `.md` —sin `render.yaml` de por medio— y disparó deploys nuevos en los dos servicios,
con `trigger = new_commit`, que es justo el caso donde deberían aplicar. Medido otra vez el
2026-09-22, sobre los últimos 100 deploys de la API: **57 eran de commits que el filtro excluye**
(38 de solo `.md`, 17 de solo `apps/web`).

**La hipótesis, aplicada el 2026-09-22: el `rootDir: .`** que tenían los dos servicios. La doc de
Render dice que con un root directory *"Render only triggers an autodeploy if your changes affect
files anywhere under that directory"*, y con `.` todo el repo cae adentro. No dice explícitamente
si eso se combina con el `buildFilter` por "y" o por "o". Se sacó el `rootDir` y se sumaron
`ignoredPaths` (`.md`, tests, configs de test). **Cómo se sabe si funcionó:** el próximo commit de
solo `.md` no tiene que aparecer en `render deploys list`. Si aparece, la hipótesis cae. Ojo: un
campo que se borra del Blueprint puede no borrarse del servicio (ya pasó con `NODE_ENV`, ver
`render.yaml`); verificar con la API de Render que `rootDir` haya quedado vacío.

**La web instalaba dos veces.** En un static site, Render corre su propio `pnpm install` de todo el
workspace antes del `buildCommand` (12,8 s de los ~33 s del deploy), así que el `--filter` no
ahorraba nada y la caché se volvía a llenar con las dependencias de la API. Desde el 2026-09-22 la
web declara `SKIP_INSTALL_DEPS=true` y la única instalación es la del `buildCommand`. La API no lo
necesita: en un web service Render no instala por su cuenta.

### El deploy que coincide con el apagado por inactividad — 2026-09-22

**Todo deploy fallido de la API de las últimas semanas tiene la misma causa, y no es el código.** En
el plan free, Render duerme el servicio cuando pasan **15 minutos sin ningún request HTTP**, y al
dormirlo manda `SIGTERM` a **todas** sus instancias, incluida la que se está deployando. Si un deploy
arranca 13-15 minutos después del último request, el apagado le cae en medio del arranque: la
instancia nueva muere, Render sigue escaneando un puerto que ya no existe hasta el timeout de 15
minutos, el deploy termina `update_failed`, y **la API queda caída ~18 minutos**.

Verificado en tres de los cinco `update_failed` de los últimos 100 deploys, leyendo los logs con
instancia y tipo (`render logs … --output json`): entre el `Your service is live` anterior y el
`SIGTERM` hay **cero requests y exactamente 15:00 minutos**, las tres veces (`b10afdf`: 19:45:51 →
20:00:51; `d69d059`: 16:57:45 → 17:12:45; `9054681`: 17:34:50 → 17:49:50). Los deploys "lentos"
(>400 s) no son otro problema: son los que quedaron en cola detrás de uno de estos.

**No depende del tipo de commit.** Que fallaran más los de solo `.md` era una coincidencia de
horario: el commit de documentación suele llegar un rato después del de código, justo en la
ventana de los 13-15 minutos. De los cinco fallidos, uno era de código de la API.

**Cómo evitarlo, en orden de costo:**

1. **Antes de pushear, un request a la API** (`curl -s https://propnexus-api.onrender.com/health`):
   reinicia el contador de 15 minutos, y el deploy (~2,5 min) termina con margen.
2. **Deployar menos**: el `buildFilter` de arriba.
3. **Un ping periódico** (cada <15 min) que no deje dormir el servicio. También sacaría el
   arranque en frío de la primera visita. **Decisión del dueño:** el plan free da 750 horas por mes
   **por workspace**, y en el mismo workspace hay otro servicio free (`agente-chat-alumni-api`).
   Uno solo despierto todo el mes son ~720 h: si el otro también consume, se pasan y Render
   suspende los dos hasta fin de mes.

**Esto corrige dos diagnósticos anteriores de este repo**, que atribuían el mismo síntoma a otra
cosa: el incidente del 2026-09-04 (`ef8e55e`, "arrancó bien catorce minutos antes") y el del
2026-09-22 (`f3296ed`, atribuido a "un Blockfrost lento"). Los dos son este patrón. Detalle en
`apps/api/CLAUDE.md` §Trampas verificadas.

### "No open HTTP ports detected on 0.0.0.0, continuing to scan…"

Aparece en **todos** los deploys, ~10 s después de `API listening`, y no es un error. La API abre el
puerto antes de inicializar el `AnchorPort` (a propósito, desde el 2026-09-22). Pero inicializarlo
en modo `real` importa Lucid, que **bloquea el event loop**: medido en local, 2,1 s de un solo bloque
en una máquina de 12 núcleos, y en el 0,1 CPU del plan free son ~38 s. Mientras dura, el proceso no
contesta. Render declara `live` en el mismo segundo en que aparece `AnchorPort listo`.

Lo que cuesta: minutos de build y un reinicio en frío por commit. Ya **no** cuesta evidencia — desde
R2, un redeploy no se lleva nada (§1.4). Antes de asumir que un commit de documentación es gratis,
verificá: no lo es.

**Un push que llega con el servicio suspendido se pierde, y reanudar no lo recupera del todo.**
Medido el 2026-08-31: con los dos servicios suspendidos a mano se pusheó `c435274`; al reanudar, el
web quedó en el commit nuevo y **la API se quedó cuatro commits atrás**, los dos `live` y sin ningún
error en los logs. Mirar el estado no lo mostraba: había que mirar el commit.

**La asimetría es lo peligroso, no el atraso.** Producción quedó con el front nuevo hablándole a la
API vieja, y como los schemas de `packages/shared` son `z.strictObject`, un campo que falta rompe el
parse entero: una pantalla que venía andando dejó de andar sin que nada en Render dijera nada.

Es la contracara del `buildFilter`: ya sabíamos que Render a veces deploya **de más**, y ahora
sabemos que a veces deploya **de menos**. Las dos llevan a la misma regla.

> **Después de reanudar un servicio, verificá el commit de cada uno — no que digan `live`.**
>
> ```bash
> render deploys list <srv-id> --output json --confirm < /dev/null | \
>   python3 -c 'import sys,json; y=json.load(sys.stdin)[0]; print(y["status"], (y.get("commit") or {}).get("id","")[:7])'
> ```
>
> Si alguno quedó atrás, el arreglo es un redeploy y nada más — no hay estado que reparar:
> `render deploys create <srv-id> --output json --confirm`. Construye desde `main`, y si el build
> falla Render deja viva la versión actual, así que no hay ventana de caída.
>
> El `< /dev/null` no es adorno: sin él, la CLI se come el stdin y dentro de un `for` devuelve vacío.

**GitHub Actions no despliega** (D-010, núcleo preservado por D-039). La puerta es el único juez de
si un cambio puede pushearse; Render solo reacciona a lo que ya pasó por ahí.

**Un `sync: false` nuevo, agregado a un servicio que ya existe, NO aparece solo en el dashboard.**
§1.2 y §1.4 describen que Render "pide" los valores — eso es cierto para el asistente interactivo
**New → Blueprint** (alta por primera vez) y para un **Sync** manual disparado desde la pestaña
Blueprints del dashboard. Un push normal a `main` que agrega una `sync: false` nueva a un servicio
ya desplegado **no** dispara ese diálogo: la variable no se crea sola, ni vacía ni con ningún valor
—confirmado el 2026-09-07 con `SENTRY_DSN`/`OTEL_EXPORTER_OTLP_*`/`VITE_POSTHOG_*`—. Hay que ir a
**el servicio → Environment → Add Environment Variable** y crearla a mano, con el mismo `key` exacto
que declara `render.yaml`. Una vez creada así, Render la trata como cualquier otra `sync: false`: no
la pisa un sync futuro.

Verificación post-deploy, en este orden:

```bash
curl -s https://propnexus-api.onrender.com/health                 # {"ok":true}
curl -s -o /dev/null -w '%{http_code}\n' https://propnexus-web.onrender.com/   # 200, el index de la SPA

# El login va DIRECTO a la API (no hay proxy). Con `Origin` del web, para
# comprobar de paso que la lista blanca de CORS lo acepta:
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  https://propnexus-api.onrender.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://propnexus-web.onrender.com' \
  -d '{"email":"nadie@example.com","password":"incorrecta"}'      # 401
```

**Ese último es el canario y no es opcional.** Un `502` ahí significa que se perdió el
`credentials: "omit"` de las route rules y el camino de error más común de la app está roto (D-050).

## 3 · Rollback

Render guarda los deploys anteriores: **Dashboard → el servicio → Deploys → Rollback** en el último
que estuvo verde. Es instantáneo y no toca la base.

**La base no rollbackea con el servicio.** Si el problema fue una migración, el rollback del código
deja el esquema adelantado. Por eso D-012 exige cambios **aditivos** entre deploys: una migración
que solo agrega es compatible con el código viejo. Si alguna vez hay que revertir una migración, es
una migración nueva que deshace — nunca editar la aplicada (bloqueado por hook).

Turso free trae **1 día de point-in-time restore**:

```bash
turso db shell propnexus                          # inspección
turso db create propnexus-restore --from-db propnexus --timestamp <ISO-8601>
```

Restaurar crea una base **nueva**: se apunta `DATABASE_URL` a ella y se redeploya. No se pisa la
original hasta estar seguro.

## 4 · Incidentes

| Síntoma | Causa más probable | Qué hacer |
|---|---|---|
| Primera request tarda ~1 min | Spin-down a los 15 min. **Es esperado** (D-040) | Nada. Antes de una demo, calentar a mano (§5) |
| La API no arranca, log dice `JWT_SECRET` | La variable quedó vacía | D-042: es el comportamiento buscado. Regenerar en el dashboard y redeploy |
| Todos los logins dan 429 | `TRUST_PROXY_HOPS` distinto de 1 | Con 0 detrás del proxy, todos los clientes comparten balde (D-045). Ponerlo en 1 y restart |
| `POST` de login devuelve **502** | Se perdió `credentials: "omit"` en las route rules | D-050. Revisar `apps/web/vite.config.ts` y **rebuild del web** (es build time) |
| El web carga pero toda llamada falla | `VITE_API_ORIGIN` mal o apuntando a una URL vieja | Es build time: corregir la variable y **Clear build cache & deploy** |
| El web carga y la consola dice CORS | Falta el origen del web en `WEB_ORIGIN` de la API | Es runtime: corregir la variable y **restart** de la API |
| Evidencia subida que desapareció | Con R2 ya no debería pasar | Sí es incidente. Revisar que `STORAGE_DRIVER=s3` esté puesto: con `disk` vuelve al filesystem efímero y se pierde |
| La API no arranca, log dice `STORAGE_DRIVER=s3 exige …` | Falta una `S3_*` | D-042, y es a propósito. Cargar la variable en el dashboard y restart (§1.4) |
| Servicio suspendido a mitad de mes | Se agotaron las 750 h | Alguien puso un keep-warm. Sacarlo (§Limitaciones) |
| Un servicio quedó en un commit viejo, los dos `live` y sin errores | El push llegó con el servicio suspendido | Reanudar no lo recupera. `render deploys create <srv-id>` (§2) |
| Pantallas que andaban empiezan a fallar al parsear | Front y API en commits distintos | Mismo caso de arriba. Los `z.strictObject` de `packages/shared` lo vuelven duro: un campo que falta rompe el parse entero |
| `ERR_PNPM_OUTDATED_LOCKFILE` en el build | Se tocó un `package.json` sin `pnpm install` | La puerta lo atrapa antes; si llegó acá, `pnpm install` y commitear el lockfile |
| `Port scan timeout reached, no open ports detected` y después `Timed Out` | El build salió bien y el proceso **nunca escuchó**. El `startCommand` es `migrate && server` | Leé las tres líneas de arranque en orden (abajo). Render tarda ~15 min en darlo por muerto y en free tier **la instancia vieja ya se cerró**: es caída, no degradación |
| `Error: Cannot find module '@paquete-de-otel-o-similar'` justo después de un log de `instrumentation` | Un `require()` tardío (patrón de `instrumentation.ts`) usa un paquete que no está en `dependencies` — resolvía como transitiva en local, no en una instalación limpia | Declarar el paquete como dependencia directa; el smoke test de CI (`.github/workflows/ci.yml`) ya lo agarra antes de pushear — ver `apps/api/CLAUDE.md` §Trampas verificadas 2026-09-08 |
| Deploy `update_in_progress` colgado 5+ min, log corta justo después de `[instrumentation] Sentry activo` | Visto una vez el 2026-09-08, causa no determinada — la instancia vieja ya había recibido `SIGTERM` y la API estaba caída de verdad (confirmado con `curl`, timeout total) | Cancelar el deploy colgado (dashboard o `render deploys cancel`) y disparar uno nuevo con `render deploys create <srv-id>`. El segundo intento, con los mismos env vars, arrancó limpio en ~1 minuto — no se pudo reproducir, tratado como blip transitorio de la plataforma hasta que se repita |

### Leer un arranque en los logs

El `startCommand` tiene dos pasos y cada uno anuncia principio y fin. Miralos en orden — dónde se
corta el log dice dónde se colgó el proceso:

```
[migrate] conectando a la base                       ← migrate arrancó
[migrate] sin migraciones pendientes                 ← migrate terminó (o "N migración(es) aplicada(s)")
[arranque] migraciones listas, levantando la API     ← server.js arrancó
AnchorPort listo en modo "real"                      ← el puerto de anclaje resolvió
API listening on http://localhost:10000              ← escuchando: acá el deploy pasa a live
```

Un arranque sano imprime las cinco en unos 5 segundos. Si falta la segunda, la base no responde y
`conTecho` va a cortar a los 120s con `la base no respondió en 120s`. Si están las tres primeras y no
la última, el problema es del servidor, no de la migración.

**Esto existe por el incidente del 2026-09-04**, cuando ninguna de las líneas se imprimía: un arranque
colgado en la migración y uno colgado en el servidor se veían exactamente igual —un log vacío— y la
API estuvo ~18 minutos caída por un commit de solo documentación. Detalle en `apps/api/CLAUDE.md`
§Trampas verificadas. **Corregido el 2026-09-22:** ese arranque no se colgó, lo apagó Render por
inactividad (§2, "El deploy que coincide con el apagado por inactividad"). Los logs de arranque
siguen valiendo por lo que dicen: sin ellos no se habría podido ver.

Logs: **Dashboard → el servicio → Logs** (o `render logs -r <service>`). No hay shell: lo que no se
loguee no se puede ir a mirar. Es la razón por la que D-042 hace que la API **reviente al arrancar**
en vez de fallar en una request.

**Incidente del 2026-09-07, dos fallas seguidas en el mismo push.** Al instrumentar Sentry/OTel
(`instrumentation.ts`, precargado con `node --require`), dos deploys seguidos fallaron: primero
`--require` sin `./` (resuelve como paquete de `node_modules`, no como archivo — `MODULE_NOT_FOUND`
al arrancar); después, al arreglar eso, `NODE_ENV: production` declarado como env var del servicio
rompió el **build** (`pnpm install` saltea `devDependencies` con esa variable puesta, y
`packages/cardano` se quedó sin `@types/node`). El segundo synced siguió fallando incluso después de
sacar la declaración del Blueprint — Render lo siguió mandando en el entorno del build igual. El fix
real fue hacer el `buildCommand` inmune a lo que traiga el entorno (`NODE_ENV=development` inline
antes de `pnpm install`), no depender de qué variables tiene declaradas el Blueprint. Detalle técnico
completo y los tests que lo cierran en `apps/api/CLAUDE.md` §Trampas verificadas.
**La lección que generaliza:** cualquier cambio a `render.yaml` en un servicio ya desplegado se
reproduce local con el comando **literal** —build y arranque, en ese orden, con `NODE_ENV=production`
exportado a mano para simular el entorno real de Render— antes de pushear. `pnpm verify` en verde no
prueba que el deploy vaya a arrancar.

## 5 · Antes de una demo, revisión o grabación

Las dos URLs duermen. Calentarlas a mano, ~2 minutos antes:

```bash
curl -s -o /dev/null https://propnexus-api.onrender.com/health
curl -s -o /dev/null https://propnexus-web.onrender.com/
```

**No automatices esto con un cron.** Un keep-warm periódico mantiene los dos servicios despiertos
24/7 (~1460 h contra las 750 del plan) y los suspende cerca del día 15 — o sea que el truco para
evitar un cold start de un minuto termina causando una caída de dos semanas. Está prohibido por
D-040, no olvidado. Un loop a mano y atendido, que dure lo que dura una grabación y se corte al
terminar, es otra cosa y está bien.

### 5.1 · Revertir la preparación de datos del 2026-09-21

El 2026-09-21 se preparó la base para grabar el video walkthrough (criterio 13 del SOM). Tres
cambios, todos sobre datos de demo y ninguno sobre esquema:

1. **`buyer@example.com` sumado como miembro** de `torre-volumen-1` y `torre-volumen-2`, para que su
   listado deje de mostrar dos proyectos solos.
2. **Los tres `torre-volumen-*` pasados de `planning` a `completed`**, que es lo que corresponde a
   sus 10 etapas certificadas.
3. **`torre-a` vuelto inaccesible desde el front, sin salir de la base.** Tiene 3 etapas con nombres
   anteriores al `DEFAULT_STAGE_CATALOG` de 10 y el único `OnChainEvent` en `Failed` de toda la base,
   así que confundía en cámara. **No se borró: tiene 8 eventos on-chain colgando.** Se le quitaron
   las 3 membresías —que es el mecanismo real de visibilidad, porque el listado del investor, el del
   developer, la cola del certifier y el panel de capital están todos scopeados por membresía—, se
   desvinculó su unidad `4B` (`My units` se lista por `Unit.investorId`, no por membresía) y se borró
   su fila `Dossier`, que si no seguía apareciendo en la cola del escribano.

**El rollback del punto 3**, que es el único con pérdida de información si no queda escrito:

```sql
INSERT INTO ProjectMember (id, userId, projectId, membershipRole, createdAt) VALUES
  ('d703n50ggfir59g0wnl2hf8a','hnrykorp4aqul78oiy9bfe4h','m99yzb4h5poi0078rcqpbj6d','developer',1788447379597),
  ('s6iuiow6lsyi6h57itt7m8k3','ng0gh91de5alybr5ihupbd11','m99yzb4h5poi0078rcqpbj6d','buyer',1788447379598),
  ('ejsq8ei1ufnuz1uk0ura1564','k2knwiqp66xuv6ojp7iv48ep','m99yzb4h5poi0078rcqpbj6d','verifier',1788447379599);

UPDATE Unit SET investorId = 'ng0gh91de5alybr5ihupbd11', status = 'sold'
  WHERE id = 'f3qugedzwjnzhkwth5kqwf3n';

-- `compileDossier` regenera esta fila sola en la próxima lectura, pero con otro id.
-- Este INSERT conserva el id y el masterHash originales.
INSERT INTO Dossier (id, unitId, masterHash, compiledAt, shareToken, status, signedById, signedAt, rejectionNote) VALUES
  ('wjji7ls3xm5nro9ehxxur7tp','f3qugedzwjnzhkwth5kqwf3n',
   '8426e9e08fae94ce5de2c38fd0cf8c95ee1f0c181db77f48447dab09de5f8a3e',
   1788447381415, NULL, 'compiled', NULL, NULL, NULL);
```

Se aplica con `turso db shell propnexus < archivo.sql`. **Esto no es una migración y no va en
`apps/api/migrations/`**: ahí se aplicaría solo, en cada arranque, contra cualquier base.

Los puntos 1 y 2 se revierten por API como admin — `DELETE` de las dos membresías nuevas no tiene
endpoint (se hace por `turso db shell`), y el estado vuelve con
`PATCH /api/v1/projects/:id {"status":"planning"}`.

## Limitaciones aceptadas (leer antes de prometer algo)

1. **Cold start de ~1 min** tras 15 min de inactividad. Se acepta a cambio de $0 (D-040).
2. **La evidencia persiste en R2** (§1.4), no en el filesystem. Cerró D-051 —que pasó al archivo
   por D-068— y con ella el bloqueo que pesaba sobre el primer anclaje: un hash anclado ahora tiene un archivo detrás, que es
   lo que la regla 17 exige. El filesystem sigue siendo efímero y sigue estando bien que lo sea —
   `UPLOAD_DIR` es solo el staging de Multer y la ruta borra el temporal apenas R2 confirma.
   Lo que sí hay que vigilar es el techo de **10 GB** del free tier.
3. **750 instance-hours/mes compartidas** entre los dos servicios. Con spin-down normal sobra
   (~1500 visitas frías); con keep-warm no alcanza.
4. **Sin worker de confirmaciones.** Los background workers de Render no tienen free tier: la
   reconciliación se dispara desde un cron de GitHub Actions contra un endpoint autenticado
   (`reconcile.yml`, diario) y al leer — **nunca un `setInterval` dentro de la API**, que deja de
   contar cuando el servicio duerme (D-003, D-040).
5. **Monitoreo: encendido desde el 2026-09-08.** Sentry (errores, back+front),
   OpenTelemetry→Grafana Cloud (traces del backend) y PostHog (analítica web, sin PII) están
   instrumentados (`apps/api/src/instrumentation.ts`, `apps/web/src/lib/observability.ts`) y
   verificados con datos reales en producción (capturas en `specs/EVIDENCIA-2026-09-11-monitoring-screenshots.md`).
   Sin `SENTRY_DSN`/`OTEL_EXPORTER_OTLP_ENDPOINT` quedan apagados sin romper nada. Render Metrics Stream (infra nativa: CPU/RAM del
   contenedor) es de plan Pro+, no está en free — el dashboard gratis de Render alcanza para
   mirarlo, solo no se puede exportar a Grafana Cloud sin subir de plan.
