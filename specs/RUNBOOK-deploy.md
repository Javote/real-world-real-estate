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
Hoy se corre a mano; el paso natural es un cron de GitHub Actions contra ese mismo endpoint.

En Preprod un bloque tarda ~20 s, así que reconciliar inmediatamente después de anclar suele devolver
`confirmados: 0`. No es un error: es que todavía no confirmó. Volvé a correrlo.

## 2 · Deploy de todos los días

Push a `main`. Render reconstruye **los dos servicios en cada push**, toque lo que toque.

**Los `buildFilter` están declarados y no filtran.** Medido el 2026-08-27: el commit `ee357df` tocó
solo tres `.md` —sin `render.yaml` de por medio— y disparó deploys nuevos en los dos servicios, con
`trigger = new_commit`, que es justo el caso donde deberían aplicar. Los filtros están bien
registrados del lado de Render (`render services --output json` los muestra) y ninguna de las tres
excepciones que documenta Render —cambios al blueprint, deploys manuales, cambios de
configuración— corresponde. **Causa sin determinar.**

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

Logs: **Dashboard → el servicio → Logs** (o `render logs -r <service>`). No hay shell: lo que no se
loguee no se puede ir a mirar. Es la razón por la que D-042 hace que la API **reviente al arrancar**
en vez de fallar en una request.

## 5 · Antes de una demo, revisión o grabación

Las dos URLs duermen. Calentarlas a mano, ~2 minutos antes:

```bash
curl -s -o /dev/null https://propnexus-api.onrender.com/health
curl -s -o /dev/null https://propnexus-web.onrender.com/
```

**No automatices esto con un cron.** Un keep-warm periódico mantiene los dos servicios despiertos
24/7 (~1460 h contra las 750 del plan) y los suspende cerca del día 15 — o sea que el truco para
evitar un cold start de un minuto termina causando una caída de dos semanas. Está prohibido por
D-040, no olvidado.

## Limitaciones aceptadas (leer antes de prometer algo)

1. **Cold start de ~1 min** tras 15 min de inactividad. Se acepta a cambio de $0 (D-040).
2. **La evidencia persiste en R2** (§1.4), no en el filesystem. Cerró D-051 —que pasó al archivo
   por D-068— y con ella el bloqueo que pesaba sobre el primer anclaje: un hash anclado ahora tiene un archivo detrás, que es
   lo que la regla 17 exige. El filesystem sigue siendo efímero y sigue estando bien que lo sea —
   `UPLOAD_DIR` es solo el staging de Multer y la ruta borra el temporal apenas R2 confirma.
   Lo que sí hay que vigilar es el techo de **10 GB** del free tier.
3. **750 instance-hours/mes compartidas** entre los dos servicios. Con spin-down normal sobra
   (~1500 visitas frías); con keep-warm no alcanza.
4. **Sin worker de confirmaciones.** Los background workers de Render no tienen free tier: cuando
   exista el pipeline de anclaje, se dispara desde un cron de GitHub Actions contra un endpoint
   autenticado — **nunca un `setInterval` dentro de la API**, que deja de contar cuando el servicio
   duerme (D-003, D-040).
5. **Sin telemetría ni monitoreo todavía** (criterios 9 y 14). Los logs de Render son lo único que
   hay.
