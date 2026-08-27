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
2. **R2 → Manage API Tokens → Create API Token**, permiso **Object Read & Write**, alcance
   limitado a ese bucket. Cloudflare muestra el par **una sola vez**:
   `Access Key ID` + `Secret Access Key`. Guardalos.
3. Anotá el **endpoint**: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`. El `<ACCOUNT_ID>` está
   en la misma pantalla del token.

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

## 2 · Deploy de todos los días

Push a `main`. Render construye por servicio y solo el que corresponda: los `buildFilter` de
`render.yaml` hacen que un commit de `docs/` o `specs/` no reconstruya nada, lo que además cuida el
presupuesto de horas.

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
2. **La evidencia persiste en R2** (§1.4), no en el filesystem. Cierra D-051 y con eso el
   bloqueo que pesaba sobre el primer anclaje: un hash anclado ahora tiene un archivo detrás, que es
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
