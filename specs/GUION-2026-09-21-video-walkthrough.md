# Guion — Video walkthrough (2026-09-21)

> Cubre el ítem **3.12** de `CLAUDE.md` §Lo que queda del plan y el **criterio 13** del SOM
> (`specs/README.md`). Es el guion de una grabación **manual**, no automatizada: el voice-over se
> agrega después, sobre el video ya montado.
>
> Los tiempos de espera salen de
> [`REPORTE-2026-09-10-prueba-de-volumen.md`](REPORTE-2026-09-10-prueba-de-volumen.md) §Cronología
> (180 anclajes reales contra Preprod). **El estado de los datos del §1.3 está medido contra la base
> de producción el 2026-09-21**, y la base ya quedó preparada para esta grabación (§1.3.1).

---

## 0. Cómo está armado

**Dos proyectos, y cada uno muestra lo que el otro no puede.**

| | Proyecto | Qué muestra |
|---|---|---|
| **El terminado** | `torre-volumen-3` — 10/10 etapas `Completed`, 61 eventos on-chain, unidad 1A vendida con contrato firmado | El **Acto 1** (lo que ve un comprador cuando todo está anclado) y el **Acto 5** (el dossier final y la firma del escribano). Un dossier solo significa algo sobre una obra terminada. |
| **El que nace** | El que se crea **en cámara** en T08, con sus 10 etapas en `Pending` | Los **Actos 2, 3 y 4**: el alta, la invitación, y **el recorrido completo de la FSM sobre una sola etapa**. |

| | Decisión | Por qué |
|---|---|---|
| **Idioma** | Abre en `es-AR` (default) y **se cambia a `en-US` en la pantalla de login, antes de entrar**. | Catalyst revisa en inglés, y el cambio en cámara muestra la localización como feature en vez de tener que explicarla. Los dos diccionarios están completos y la paridad la fuerza el compilador (`dictionary.ts:1155`). |
| **Entorno** | Producción: `propnexus-web.onrender.com`. Nunca local. | El video tiene que mostrar TXIDs reales en Preprod y la URL pública viva — parte de lo que sostiene el criterio 5. |
| **La FSM** | **Las cuatro aristas, sobre la misma etapa**, en cámara: subir evidencia → observar → reanudar → certificar. | Es la máquina de estados entera contada sobre un solo objeto: se entiende sin repetirla diez veces. Son ~3 min de cortes. |
| **Formato** | 31 tomas cortas, cortadas donde hay espera. Se unen al final sin re-encodear. | Cada acción on-chain tarda ~45 s y crear un proyecto bloquea ~6 min. Una toma continua es imposible. |

---

## 1. Lo que tiene que estar listo antes de grabar

### 1.1 Cuentas

Las cinco del seed. En cámara se usan cuatro (`admin` no tiene landing,
`apps/web/src/auth/roles.ts:16`; se usa solo desde la consola, §1.4):

| Rol en el video | Usuario | `User.id` | Password |
|---|---|---|---|
| Investor | `buyer@example.com` | `ng0gh91de5alybr5ihupbd11` | `SEED_DEMO_PASSWORD` de `apps/api/.env` |
| Developer | `developer@example.com` | `hnrykorp4aqul78oiy9bfe4h` | idem |
| Certifier | `verifier@example.com` | `k2knwiqp66xuv6ojp7iv48ep` | idem |
| Notary | `notary@example.com` | `vjfxjgdxgi3n6pu0a7j7z2pw` | idem |
| (consola) | `admin@example.com` | `jn0ejo6c287l4q0n9p5amqpr` | `SEED_ADMIN_PASSWORD` |

### 1.2 Archivos de evidencia

Tres archivos en una carpeta al alcance del selector, con nombres presentables (se ven en cámara):

- 1 PDF — ej. `municipal-permit.pdf`
- 2 JPG/PNG — ej. `foundation-01.jpg`, `foundation-02.jpg`

Los límites los fija `packages/shared/src/evidence-rules.ts` (tipo real por los primeros bytes, no
por `Content-Type`). Archivos chicos: el upload viaja a R2 pasando por Render.

### 1.3 El estado de la base — medido y **ya preparado** el 2026-09-21

| Proyecto | Etapas | Estados | Membresías | Unidades | Eventos |
|---|---|---|---|---|---|
| `torre-volumen-1` | 10 | 10 Completed | dev · verifier · **buyer** | 24, con precio y m² | 60 |
| `torre-volumen-2` | 10 | 10 Completed | dev · verifier · **buyer** | 18, con precio y m² | 60 |
| `torre-volumen-3` | 10 | 10 Completed | dev · verifier · buyer | 30, con precio y m²; **1A** sold → buyer, contrato USD 100.000 firmado | 61 |
| `torre-a` | 3 | 1 Completed, 2 InProgress | **ninguna** | — | 8, 1 `Failed` |
| `torre-pending-test` | 10 | 9 Pending, 1 InProgress | dev | — | 12 |
| `torre-belgrano` / `torre-demo-e2e` | 0 | — | dev | — | 0 |

**200 `OnChainEvent` en `Confirmed`, 1 en `Failed`** (ese único está en `torre-a`, que ya no se ve).
La reconciliación de D-077 corrió sobre todos: no hay eventos con TXID real mostrándose pendientes.

#### 1.3.1 Lo que ya se hizo sobre la base

- **`buyer@` sumado como miembro de Volumen 1 y 2.** Sin eso el listado "Buy" mostraba 2 proyectos y
  se veía flaco; ahora muestra 3, todos con sus 10 etapas ancladas.
- **`torre-a` quedó inaccesible desde el front, sin salir de la base.** Confundía: tiene 3 etapas con
  nombres viejos (`Cimentación`, `Estructura`, `Terminaciones`), anteriores al `DEFAULT_STAGE_CATALOG`
  de 10, y encima el único evento `Failed` de toda la base. Se le borraron las 3 filas de
  `ProjectMember` —que es el mecanismo real de visibilidad: el listado del investor, el del developer,
  la cola del certifier y el panel de capital están todos scopeados por membresía—, se desvinculó la
  unidad 4B (`investorId → NULL`, `status → available`), porque "My units" se lista por `investorId`
  y no por membresía (`investor.routes.ts:224`), y se borró su fila `Dossier`, que si no seguiría en
  la cola del escribano. **Todo reversible**, con el SQL de acá abajo.
- **El Acto 5 se mudó a la unidad 1A de `torre-volumen-3`.** El dossier **se compila en cada lectura**
  (`domain/dossier.ts:41`, M2-D5 §3: el hash se computa al momento del fetch), no está guardado, así
  que cualquier unidad vendida con contrato genera el suyo. El de 1A es mejor que el que tenía 4B:
  10 etapas `Completed` con TXID cada una contra 1 de 3.

**Rollback de `torre-a`**, si algún día hay que volver atrás (`turso db shell propnexus < este.sql`):

```sql
INSERT INTO ProjectMember (id, userId, projectId, membershipRole, createdAt) VALUES
  ('d703n50ggfir59g0wnl2hf8a','hnrykorp4aqul78oiy9bfe4h','m99yzb4h5poi0078rcqpbj6d','developer',1788447379597),
  ('s6iuiow6lsyi6h57itt7m8k3','ng0gh91de5alybr5ihupbd11','m99yzb4h5poi0078rcqpbj6d','buyer',1788447379598),
  ('ejsq8ei1ufnuz1uk0ura1564','k2knwiqp66xuv6ojp7iv48ep','m99yzb4h5poi0078rcqpbj6d','verifier',1788447379599);

UPDATE Unit SET investorId = 'ng0gh91de5alybr5ihupbd11', status = 'sold'
  WHERE id = 'f3qugedzwjnzhkwth5kqwf3n';

-- La fila de Dossier la regenera `compileDossier` en la próxima lectura, pero con otro id.
-- Este INSERT conserva el id y el masterHash originales.
INSERT INTO Dossier (id, unitId, masterHash, compiledAt, shareToken, status, signedById, signedAt, rejectionNote) VALUES
  ('wjji7ls3xm5nro9ehxxur7tp','f3qugedzwjnzhkwth5kqwf3n',
   '8426e9e08fae94ce5de2c38fd0cf8c95ee1f0c181db77f48447dab09de5f8a3e',
   1788447381415, NULL, 'compiled', NULL, NULL, NULL);
```

- **Los tres `torre-volumen-*` pasaron de `planning` a `completed`.** Figuraban como
  "Pre-construction" teniendo las 10 etapas certificadas: incoherente en cámara y sin sentido para el
  filtro de T02. Ahora el filtro tiene dos valores reales — los tres Volumen en **"Delivered"** y el
  proyecto que nace en el Acto 2 en **"Pre-construction"**. Verificado con el token del investor:
  los tres devuelven `completed` con 10/10 etapas `Completed`.

**Ids de producción, para no volver a buscarlos:**

| Qué | Tabla | Id |
|---|---|---|
| `torre-volumen-1` | `Project` | `hxcqj668u7joqdsfy0prgc01` |
| `torre-volumen-2` | `Project` | `i322kibxr6jfed4dwp4btpg9` |
| `torre-volumen-3` | `Project` | `tzmy0pvqctu5vk9l85zzc2t6` |
| `torre-a` (oculto) | `Project` | `m99yzb4h5poi0078rcqpbj6d` |
| unidad `4B` de `torre-a` (desvinculada) | `Unit` | `f3qugedzwjnzhkwth5kqwf3n` |
| dossier de la `4B` (borrado) | `Dossier` | `wjji7ls3xm5nro9ehxxur7tp` |
| membresía developer de `torre-a` | `ProjectMember` | `d703n50ggfir59g0wnl2hf8a` |
| membresía buyer de `torre-a` | `ProjectMember` | `s6iuiow6lsyi6h57itt7m8k3` |
| membresía verifier de `torre-a` | `ProjectMember` | `ejsq8ei1ufnuz1uk0ura1564` |

Los tres `User.id` que hacen falta están en el §1.1. **El rollback también quedó en
`specs/RUNBOOK-deploy.md` §5.1.**

**La base no tiene nada más pendiente para grabar.** Lo único que queda son las dos membresías del
proyecto nuevo (§1.4), que se corren durante el corte de T08.

#### 1.3.2 La organización desarrolladora — **hecho el 2026-09-21**

El commit `b0fbbc2` agregó el perfil del desarrollador (`SPEC-220`) con su migración `0010`. Al
2026-09-21, verificado contra producción:

- **`_migrations` llegó a `0010_organization.sql`** — Render la aplicó sola en el deploy del push.
- **La organización existe y cuelga de las tres obras Volumen**
  (`Organization.id = j4i5lufleuojlhgwen67rnj2`, "Grupo Alpine", fundada en 2005).
- **El endpoint responde en producción**: 3 obras entregadas, 21 años en el rubro, 12 unidades
  vendidas, 1 comprador, y los tres proyectos repartidos en "Previous projects".
- **La pantalla se verificó renderizada contra producción**, no solo por API: el botón "Ver al
  desarrollador" aparece entre la documentación y el avance, y el perfil abre con la bio, las
  cuatro métricas y las tres cards —cada una con el chip "Grupo Alpine" sobre la portada, que es la
  deuda que `ProjectCard.developerName` arrastraba desde el principio.
- **Se les puso `city` y `country`** (`Buenos Aires` / `Argentina`): los tres tenían la ciudad en
  `NULL` y solo el `address`, así que sus cards salían sin ubicación — **en el perfil y también en
  el listado "Buy" de T02**, que arma la línea con `city, country`.

- **Las tres obras tienen unidades con precio y metros.** La prueba de volumen había dejado solo la
  1A, sin `priceMinorUnits` ni `sizeM2`, y las cards salían sin "From ..." ni rango de metros. Ya
  cargadas, re-medido contra producción el 2026-09-21: Volumen 1 — 24 unidades, desde US$ 185.000,
  62–140 m²; Volumen 2 — 18, desde US$ 165.000, 55–120 m²; Volumen 3 — 30, desde US$ 195.000,
  68–150 m². Mirar esto renderizado es lo que destapó el bug del "desde" dividido dos veces
  (`dc85535`). **El portfolio del buyer sigue siendo solo la 1A**, que es lo que necesita T13.

*(El proyecto que se crea en cámara en T08 **no** va a tener organización, y está bien: su detalle
no dibuja el link. El perfil del desarrollador se ve una vez, sobre la obra terminada.)*

#### 1.3.3 Cómo quedaron las tres colas, verificado contra la API

| Cola | Estado hoy | Cuándo se llena |
|---|---|---|
| **Certifier** — "Assigned" | **vacía** (las 2 etapas de `torre-a` eran todo lo que tenía) | En **T15**: la evidencia que sube el developer pone esa etapa en `InProgress` y ahí aparece. Es la narrativa correcta — llega una etapa nueva para certificar, en vez de una cola preexistente sin explicación. |
| **Certifier** — KPIs e "Issued" | **30 certificadas, 30 certificados emitidos** con hash y TXID reales de la prueba de volumen | Ya está. El panel del certifier tiene historia real sin que haga falta preparar nada. |
| **Escribano** — "Pending review" | **vacía** (`[]`) | En **T23**, cuando el investor abre el dossier de 1A y eso lo compila. |

### 1.4 Las dos membresías del proyecto nuevo — se corren **durante el corte de T08**

El proyecto que se crea en cámara nace con **una sola membresía, la del developer que lo crea**
(`developer.routes.ts:222`). Sin el `verifier`, su etapa no aparece en la cola del certifier y el
Acto 4 no existe. Y no hay pantalla para arreglarlo: `POST /projects/:id/members` es admin-only
(`projects.routes.ts:442`).

Como crear el proyecto bloquea ~6 minutos igual, **ese corte es exactamente donde entran estos
comandos** — no hay que preparar nada el día antes.

```bash
set -a && . ./apps/api/.env && set +a
API=https://propnexus-api.onrender.com/api/v1

TOKEN=$(curl -s -X POST $API/auth/login -H 'content-type: application/json' \
  -d "{\"email\":\"admin@example.com\",\"password\":\"$SEED_ADMIN_PASSWORD\"}" \
  | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

# El proyecto recién creado (o miralo en la URL de su pantalla de detalle)
PID=$(turso db shell propnexus \
  "SELECT id FROM Project ORDER BY createdAt DESC LIMIT 1" | tail -1 | tr -d ' ')

for U in k2knwiqp66xuv6ojp7iv48ep:verifier ng0gh91de5alybr5ihupbd11:buyer; do
  curl -s -X POST $API/projects/$PID/members \
    -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
    -d "{\"userId\":\"${U%%:*}\",\"membershipRole\":\"${U##*:}\"}" -w " %{http_code}\n"
done
```

- [ ] Los dos devolvieron `201`.

### 1.5 Las pasadas de calentamiento

**Render Free duerme el servicio a los 15 minutos de inactividad**, y el primer request después
tarda ~50 s. Este guion tiene un corte de **6 minutos** (T08) y ocho de **un minuto**: si te
distraés entre tomas, la siguiente abre con un spinner de casi un minuto y hay que repetirla. Por eso
el calentamiento no es una sola cosa al principio, son tres.

#### 1.5.1 La pasada completa — **obligatoria, menos de 15 min antes de la primera toma**

Recorré a mano, sin grabar, todas las pantallas del guion. Hace tres cosas:

1. **Despierta los dos servicios.** Medido hoy: 9,4 s con el servicio tibio; en frío, mucho más.
2. **Deja la reconciliación de lectura al día** (D-077), que es lo que pasa los `OnChainEvent` de
   `Pending` a `Confirmed`. Sin esto, pantallas con TXID real y confirmado muestran "Pendiente".
3. **Compila el dossier de 1A.** La base tiene hoy **cero** filas en `Dossier`: la de 4B se borró y
   la de 1A no existe hasta que alguien abre `/investor/unit/<1A>/dossier`. Si no lo abrís antes, la
   cola del escribano sale vacía en T26. *(El orden del guion lo resuelve solo —T23 la compila antes
   de que T26 la necesite— pero no dejes que dependa de eso.)*

- [ ] Recorrida completa hecha, dossier de 1A compilado.

#### 1.5.2 El keep-alive — **solo durante la sesión de grabación**

> **Esto NO es el keep-warm que prohíbe D-040.** Lo prohibido es un cron: mantiene los dos servicios
> despiertos 24/7 (~1460 h contra las 750 del plan Free) y los suspende cerca del día 15 — el truco
> para evitar un cold start de un minuto termina causando una caída de dos semanas
> (`RUNBOOK-deploy.md` §5). Esto es un loop a mano, atendido, que dura las dos o tres horas de la
> grabación y se apaga cuando terminás. **Si alguna vez te tienta pasarlo a `crontab` o a un workflow
> de GitHub Actions, no: eso es exactamente lo que D-040 prohíbe.**

Un ping cada 10 minutos alcanza para que ninguno de los dos servicios se duerma entre tomas. Abrilo
en una terminal aparte **antes de la primera toma** y dejalo:

```bash
while true; do
  curl -s -o /dev/null https://propnexus-api.onrender.com/health
  curl -s -o /dev/null https://propnexus-web.onrender.com/
  sleep 600
done
```

- [ ] Keep-alive corriendo.
- [ ] **Y `Ctrl-C` cuando terminás de grabar.** Lo que se enciende se apaga: si no, queda pegándole
      a producción indefinidamente.

#### 1.5.3 El recalentado de acto

Aun con el keep-alive, después de un corte largo conviene **abrir la pantalla siguiente una vez,
fuera de cámara, antes de apretar grabar**. Cuesta tres segundos y es la diferencia entre una toma
limpia y una que arranca con un esqueleto de carga. Hacelo sí o sí:

- [ ] Antes de **T09** (venís del corte de 6 minutos de T08).
- [ ] Al empezar cada acto, si hubo pausa de por medio.
- [ ] Antes de **T25**, que abre en una ventana de incógnito sin nada cacheado.

### 1.6 Espacio en disco

~150-250 MB por minuto a 2560×1440; el crudo de este guion son ~20-25 minutos. **Contar con 6 GB.**

```bash
df -h /
```

El disco llegó a 99% el 2026-09-18 (`CLAUDE.md` §Worktrees). Si aprieta: `~/.npm`,
`~/Library/pnpm/store`, `~/.cache/puppeteer` se repueblan solos.

---

## 2. Setup de la máquina

### 2.1 macOS

```bash
# Escritorio sin iconos (se revierte con `true` al terminar)
defaults write com.apple.finder CreateDesktop false && killall Finder
```

- [ ] **No molestar ON** (Centro de control → Concentración). Un banner arruina la toma.
- [ ] Dock en auto-ocultar (`Cmd+Opt+D`).
- [ ] **Cargador enchufado.** Esta máquina throttlea con el encoder activo y la batería a medias.
- [ ] Cerrar todo lo demás, Docker Desktop sobre todo.

### 2.2 Chrome

- [ ] **Perfil nuevo** `PropNexus Demo`: sin extensiones, sin historial, sin autofill.
- [ ] Barra de favoritos oculta (`Cmd+Shift+B`).
- [ ] Guardado de contraseñas **desactivado** (si no, el bubble "¿Guardar contraseña?" aparece en
      cuatro tomas distintas).
- [ ] Zoom de página al **110%** (`Cmd+`+).
- [ ] Ventana de tamaño fijo, para que las 31 tomas encuadren igual:

```bash
osascript -e 'tell application "Google Chrome" to set bounds of front window to {0, 25, 1280, 825}'
```

### 2.3 Las cuatro pestañas — el truco que ahorra media grabación

La sesión vive en `sessionStorage` (`apps/web/src/auth/session.ts:11`), que es **por pestaña**: los
cuatro roles pueden estar logueados a la vez y se cambia de rol con `Cmd+Opt+→`.

| Pestaña | Rol |
|---|---|
| 1 | Investor (`buyer@`) |
| 2 | Developer (`developer@`) |
| 3 | Certifier (`verifier@`) |
| 4 | Notary (`notary@`) |

**Dos reglas que no se pueden romper:**

1. **Cada pestaña se abre con `Cmd+T` en blanco.** Una abierta haciendo clic en un link desde otra
   **hereda una copia de la sesión de esa otra**, y vas a estar grabando al certifier con la sesión
   del developer sin enterarte.
2. **Poné el idioma en inglés en la pestaña 1 antes de abrir las otras tres.** El locale vive en
   `localStorage['propnexus.lang']` (`apps/web/src/i18n/locale.ts:5`), compartido por el origen pero
   leído al montar: las pestañas ya abiertas necesitan reload.

### 2.4 El grabador

**`Shift+Cmd+5`, el capturador que trae macOS.** Cero instalación, encoder por hardware de Intel, no
funde la CPU de una 2017. OBS solo haría falta para webcam o audio del sistema, y no hay ninguno.

`Shift+Cmd+5` → **Opciones**:

- [ ] Guardar en `~/Movies/propnexus-walkthrough/`
- [ ] Temporizador: **ninguno**
- [ ] Micrófono: **ninguno**
- [ ] **Mostrar clics del mouse: SÍ** ← sin narración, los clics son lo que hace seguible el video
- [ ] **Recordar última selección: SÍ** ← lo que garantiza que las 31 tomas encuadren idéntico
- [ ] Modo: **Grabar porción seleccionada**, arrastrada sobre la ventana de Chrome

---

## 3. Cómo se corta: actos vs. tomas

**Los 6 actos son estructura narrativa, no unidades de grabación.** Sirven para el voice-over. Lo que
se graba son **31 tomas**.

Una toma termina cuando pasa lo primero de estas tres:

1. **Empieza una espera.** Marcadas **⏸ CORTE** abajo.
2. **Pasás de los ~90 segundos.** Más que eso y un error tipeando te hace repetir mucho.
3. **Cambiás de rol.** El corte en el cambio de pestaña es invisible en el montaje.

Nombrá los archivos `T01-...`, `T02-...`: el montaje del §5 depende del orden alfabético.

**Ritmo:** pausá 1-2 segundos quieto sobre cada hash, TXID o badge. Si grabás al ritmo natural de
uso, después no vas a tener dónde meter la frase que lo explica.

---

## 4. El guion, toma por toma

Los textos entre comillas son los literales en inglés que vas a ver en pantalla.

### Acto 1 · El problema y la promesa — Investor (T01-T06, ≈4 min)

Abre por el final del producto: **`torre-volumen-3`**, con sus 10 etapas certificadas y 61 eventos
on-chain. Es el contraste contra el que después se entiende el proyecto que nace vacío.

- [ ] **T01 · Login, y el cambio de idioma** — `/login`
      Abrís en castellano. Primer gesto del video: el toggle de idioma del header (está en la
      pantalla de login misma, `login.tsx:99`) → inglés. Recién ahí, login con `buyer@`. Cae solo
      en "Buy".
      **⚠ La password que la pantalla pre-llena NO sirve contra producción.** `ROLE_PRESETS`
      (`login.tsx:20`) trae `buyer123`, que es el default local; producción usa
      `SEED_DEMO_PASSWORD` de `apps/api/.env`, que es otra. Verificado el 2026-09-21: apretar
      "Ingresar" con el preset da **"Credenciales inválidas"**. Borrá el campo y tipeá la password
      buena — y ensayalo antes de grabar, porque un error de credenciales en la primera toma del
      video es la peor apertura posible.

- [ ] **T02 · Buy** — `/investor/buy`
      Los 3 proyectos, buscador por zona, filtros por estado, modo mapa con los popovers.

- [ ] **T03 · El proyecto por dentro** — `/project/<torre-volumen-3>`
      Galería, el toggle de favorito, fecha estimada de entrega, ubicación con mapa a pantalla
      completa, la sección de documentación con el hash de cada archivo, y la timeline de progreso
      con su porcentaje y el link a la pantalla de progreso. Abajo, **"View developer"**, que es de
      donde sale la toma siguiente.
      *(La card del developer con rating y el "Price from" que M2-D1 pide acá siguen sin dibujarse:
      el contrato de `GET /projects/:id` no los da — `project.$projectId.index.tsx:30`. Ver §6.)*

- [ ] **T04 · Quién construye** — `/project/<torre-volumen-3>/developer` ← **pantalla nueva**
      El perfil del desarrollador: nombre de la organización, su bio, y **cuatro métricas que no
      son campos guardados sino cuentas sobre el registro** — obras entregadas, unidades vendidas,
      compradores y años en el rubro. Abajo, sus obras previas y sus obras en curso, cada card con
      su "desde", su rango de metros y su avance.
      **Por qué está acá y no la tenías la semana pasada:** las capturas 59 y 60 de M2-D2 la
      diseñan, M2-D5 nunca la listó y nadie la había construido. Se encontró auditando el catálogo
      de capturas contra las rutas el 2026-09-21, y se construyó el mismo día (`SPEC-220`).
      **Lo que la captura muestra y la pantalla no:** el pill de rating "4.8 / 5.0". Es una decisión
      (D-094), no un faltante — §6.

- [ ] **T05 · Hasta la prueba** — `/project/<torre-volumen-3>/progress` → `…/stage/:stageId`
      **Las 10 etapas, las 10 en verde** — el plano que justifica todo lo demás. Después, adentro de
      una: evidencia con GPS y timestamp, documentación con su VerificationBadge, el hash del
      documento.

- [ ] **T06 · Favoritos** — `/investor/favorites`

### Acto 2 · Nace un proyecto — Developer (T07-T11, ≈3 min)

- [ ] **T07 · El panel** — `/developer` → `/developer/projects`
      KPI grid, incluido el contador de eventos anclados on-chain. Después "My projects".
      **Acá se ven los 7 proyectos**, incluidos `Torre A`, `Torre Demo E2E` y `Torre Pending Test`
      (el developer sigue siendo miembro de todos; solo el investor dejó de ver `torre-a`). Si te
      molestan en cámara, encuadrá el scroll sobre los de arriba — **no los borres**, tienen eventos
      on-chain colgando.

- [ ] **T08 · Proyecto nuevo** — `/developer/project/new`
      Nombre presentable (ej. `Torre Núñez`), ubicación con preview de mapa, cantidad de unidades,
      fecha estimada, **Stage template "Standard, 10 stages"** → Crear.
      **⏸ CORTE ~6 min.** El request no vuelve hasta que los 10 mints terminaron: son secuenciales
      dentro del handler (`developer.routes.ts:266`) y cada uno es su propia transacción de Cardano
      (D-083 — el validador rechaza acuñar más de un hilo por tx).
      **Durante este corte corré los comandos del §1.4.** Sin eso no hay Acto 4.

- [ ] **T09 · El proyecto ya creado** — `/developer/projects` → `/developer/project/:id`
      Aparece primero en la lista; adentro, las 4 action cards y las 3 stat cards.
      **El contraste con T05 es el punto:** diez etapas declaradas y ancladas, todas todavía en
      `Pending`. Se ven como chips grises vacíos porque darles contenido está fuera de alcance a
      propósito (`CLAUDE.md` §Fuera de alcance) — no te detengas ahí.

- [ ] **T10 · Unidades** — `/developer/project/:id/units`
      Arranca vacío, que es justo lo que querés para mostrar el alta: stats en cero, **"Add unit"**
      con la `5A` (piso y m² con sus steppers), y el listado ya poblado con su pill.

- [ ] **T11 · La invitación** — `/developer/project/:id/invite`
      Email de `buyer@`, nombre, unidad 5A, monto → enviar.
      **⏸ CORTE ~1 min.**

### Acto 3 · La invitación llega — Investor (T12-T14, ≈2 min)

- [ ] **T12 · Aceptar** — campana del header → `/investor/notifications`
      La invitación aparece **pineada, con acento violeta**, con el tag de anclada on-chain. Abrís
      el modal: proyecto, unidad asignada, monto total, entrega estimada, resumen del cronograma →
      Aceptar. *(Aceptar es lo que crea el contrato de la unidad.)*
      **⏸ CORTE ~1 min.**

- [ ] **T13 · El portfolio** — `/investor/units` → `/investor/unit/<5A>`
      **Ahora tiene dos unidades, y no podrían ser más distintas:** la 1A de Torre Volumen 3,
      entregada, y la 5A recién comprada sobre pozo. Entrás a la 5A: galería, mapa a pantalla
      completa, y **BuildingSchematic** — la grilla del edificio con la unidad propia resaltada.

- [ ] **T14 · El contrato como registro** — `/investor/unit/<5A>/contract`
      Resumen del contrato con su HashChip y el cronograma registrado.
      **La sección de releases por etapa muestra su estado vacío** ("No releases recorded yet.").
      Es correcto, no es un bug — §6.

### Acto 4 · El ciclo de prueba: las cuatro aristas de la FSM (T15-T22, ≈5 min) ← el núcleo

**Todo sobre la misma etapa** —la 1 o la 2 del proyecto nuevo, las dos nacen en `Pending`— para que
se lea como un solo objeto recorriendo una máquina de estados y no como cuatro cosas sueltas.

- [ ] **T15 · Subir evidencia** — [DEV] `/developer/project/:id/upload`
      Selector de etapa → la etapa elegida, que se ve **`Pending`**. Arrastrás los tres archivos
      ("Drag files or tap to select · PDF, JPG or PNG"), notas, **"Anchor evidence"**.
      **⏸ CORTE ~1 min.** → arista **`Pending → InProgress`**.
      **No es un botón aparte:** la primera evidencia sobre una etapa `Pending` **es** la señal de
      que el trabajo empezó, y la transición la dispara sola el backend
      (`developer-evidencia.routes.ts:487`, M1-D2c *"Pending → InProgress: work initiated"*).

- [ ] **T16 · La prueba, y afuera de la app** — AnchoringSuccessModal
      **"Merkle root"** + TXID + "View on explorer" → cardanoscan preprod en otra pestaña.
      **El plano más importante del video: el hash existe fuera de PropNexus.**

- [ ] **T17 · El mismo anclaje, del otro lado** — [INV] `/investor/unit/<5A>/notifications` → el
      modal de la etapa
      La novedad de progreso le llega al comprador; abrís la etapa y ahí están los hashes por
      archivo y el **"Package Merkle root"** — el mismo que el developer acaba de ver.
      **Un rol lo produce, otro lo verifica, y es el mismo número.**

- [ ] **T18 · Observar** — [CER] `/certifier` → `/certifier/assigned` → `/certifier/stage/:id`
      El panel con su carga, la cola ("Stages assigned for certification") y adentro **"Evidence
      uploaded by the developer"** — lo de T15. **"Observe"** → modal "Observe stage" con las
      observaciones → **"Send"**.
      **⏸ CORTE ~1 min.** → arista **`InProgress → Observed`**.

- [ ] **T19 · Reanudar** — [DEV] `/developer/progress`
      La etapa vuelve como observada, con la nota del certifier → **"Resume stage"**.
      **⏸ CORTE ~1 min.** → arista **`Observed → InProgress`**.
      *(Esta sí es una acción deliberada del developer: el backend no la dispara solo, a propósito.)*

- [ ] **T20 · Certificar** — [CER] `/certifier/stage/:id` → **"Certify"**
      **⏸ CORTE ~1 min.** → arista **`InProgress → Completed`**. La máquina de estados, entera.

- [ ] **T21 · El certificado** — [CER] `/certifier/issued`
      "Issued certificates": el certificado con su hash, su TXID y su pill.

- [ ] **T22 · El contrato del lado del developer** — [DEV] `/developer/project/:id/contracts`
      El contrato como registro: quién, qué unidad, cuánto, cuándo se firmó, y **"Recorded on
      chain"**. Los tres StatCard son hechos del registro (cuántos contratos, cuánto suman, cuántos
      anclados), no un flujo de pagos — D-070.

### Acto 5 · El cierre: dossier y escribano (T23-T27, ≈3 min)

**Volvemos a `torre-volumen-3`, unidad 1A** — la entregada. Un dossier final solo significa algo
sobre una obra terminada, y es la única unidad de la base que lo está.

- [ ] **T23 · El dossier** — [INV] `/investor/unit/<1A>/dossier`
      "Cryptographic certification" con el **"Dossier hash"**, "Dossier completeness" con su barra de
      progreso, "Project and unit" con la fecha de compilación, y **"Artifacts"** — la lista de todo
      lo que ese hash compromete, cada ítem con el suyo. Arriba, "Share" y "Export PDF".
      *(M2-D1 describe tres secciones separadas —timeline de etapas, trazabilidad, índice de
      documentos—; la implementación las unifica en `Artifacts`, que es una sola lista canónica
      porque el orden es parte del compromiso, `domain/dossier.ts:23`.)*
      *(Esta lectura es la que compila y persiste el dossier: antes de abrirlo, la cola del escribano
      está vacía.)*

- [ ] **T24 · Compartir** — **"Share"** → modal "Share dossier"
      Copiás el link de solo lectura. El `shareToken` se genera recién acá.

- [ ] **T25 · Verificado sin cuenta** — **ventana de incógnito** → `/public/dossier/:shareToken`
      Un banco o un escribano abre el dossier **sin tener usuario en la plataforma**.
      **Es el plano más fuerte del producto entero.** Incógnito y no una pestaña más: tiene que
      verse que no hay sesión.

- [ ] **T26 · La firma** — [NOT] `/notary` → `/notary/dossiers` → `/notary/dossier/:id`
      El panel con sus KPIs y la cola ("Pending review and signing"); adentro, "Dossier review" con
      el "Dossier hash", los artefactos y el disclaimer → **"Verify and sign"**.
      **⏸ CORTE ~1 min.**

- [ ] **T27 · El historial** — [NOT] `/notary/signed`
      "Signed dossiers": el hash del dossier y el **"Signature TXID"**.

### Acto 6 · La auditoría y el resto de las superficies (T28-T31, ≈3 min)

- [ ] **T28 · El círculo se cierra** — [DEV] `/developer/audit-log`
      Filtros (All / stage / document / signature / certifier), y ahí están **todos los eventos de
      los Actos 2 a 5**, cada uno con su rol, su categoría y su TXID: "Created the project", "Sent an
      invitation", "Accepted the invitation", "Uploaded and anchored stage evidence", "Observed the
      stage", "Certified the stage", "Signed the dossier". Abrís el TxidModal ("Blockchain
      verification" → "Anchoring date" → "View in explorer").
      **Este es el cierre del video: todo lo que hiciste, indexado y anclado.**

- [ ] **T29 · El resto del developer** — `/developer/documentation` → `/developer/capital` →
      `/developer/units` → `/developer/progress` → `/developer/investors`. ~15 s cada una.

- [ ] **T30 · Perfiles y menú** — `/developer/profile`, `/certifier/profile`, `/notary/profile`,
      `/investor/profile`, `/investor/menu`. Preferencias de notificación por categoría, credenciales
      del escribano y del certificador, el menú agregador del investor.

- [ ] **T31 · Responsive** — DevTools → Device Toolbar (`Cmd+Shift+M`) → preset iPhone o Pixel
      El diseño es mobile-first (M2-D3): en móvil aparece la **BottomNav de 5 solapas** que en
      desktop es sidebar. **Encuadre:** grabá solo la región del viewport emulado, si no entra todo
      el chrome de DevTools alrededor.

**Cobertura:** las 31 tomas recorren **las 43 rutas** de `apps/web/src/routes` — 42 más la que se sumó el 2026-09-21 (`SPEC-220`).

---

## 5. Montaje

1. **Recortar el tiempo muerto de cada toma, en QuickTime.** Abrís el `.mov`, `Cmd+T` (Trim),
   arrastrás las puntas, `Cmd+S`. Instantáneo: no re-encodea.
2. **Unir, sin re-encodear.** Todas las tomas comparten tamaño y códec (por eso el §2.4 fija
   "Recordar última selección"), así que se concatenan por copia:

```bash
cd ~/Movies/propnexus-walkthrough
printf "file '%s'\n" "$PWD"/T*.mov > lista.txt
ffmpeg -f concat -safe 0 -i lista.txt -c copy walkthrough.mov
```

   En esta máquina son segundos. Si no tenés `ffmpeg`: `brew install ffmpeg`.
3. **iMovie solo al final y solo si querés títulos o transiciones.** Re-renderiza todo y en una Intel
   2017 son ~20 minutos por pasada.

**No agregues el voice-over hasta que el corte esté aprobado.** Si el orden cambia después de
grabado el audio, hay que regrabar el audio entero.

---

## 6. Lo que el video no muestra, y por qué

Vale tenerlo escrito antes del voice-over, para no prometer en audio algo que la pantalla no hace:

- **No hay PWA instalable.** `index.html` no linkea el manifest, no hay service worker registrado y
  `apps/web/public/manifest.json` sigue siendo el boilerplate de Create TanStack App ("Create
  TanStack App Sample"). Chrome no va a ofrecer instalar. T31 muestra el layout responsive, que sí
  existe. **`CLAUDE.md` §Estructura describe el front como "SPA + PWA": el código no lo sostiene hoy,
  y la contradicción queda reportada acá sin tocar nada** (`CLAUDE.md` §Jerarquía de precedencia: si
  la contradicción es con código, se avisa antes de "arreglar").
- **No hay botón de liberar pagos.** D-070 lo sacó a propósito: este producto no administra fondos,
  refleja y respalda lo que pasa afuera (D-026). El endpoint
  `POST /developer/contracts/:id/releases/:stageNum` existe en el backend como deuda declarada y el
  `ApiPort` ni lo expone. Por eso T14 muestra el estado vacío de releases y T22 muestra el contrato
  como registro.
- **El rol `admin` no tiene interfaz** (`apps/web/src/auth/roles.ts:16`). No es uno de los cuatro
  roles del SOM, así que no falta nada, pero no lo menciones en el audio.
- **No hay pantalla para sumar un certifier o un escribano a un proyecto.**
  `POST /projects/:id/members` es admin-only y no tiene superficie. Es la razón del §1.4: el proyecto
  creado en cámara necesita dos comandos de consola para que el Acto 4 exista.
- **`torre-a` sigue en la base pero sin membresías.** No se borró porque tiene 8 eventos on-chain
  colgando. El developer todavía la ve en su listado (T07); el investor, el certifier y el escribano,
  no.
- **El rating del desarrollador no existe, y es una decisión (D-094).** Las capturas 59-60 muestran
  un pill "4.8 / 5.0 · 127 investors" junto al nombre de la organización. **La pantalla se construyó
  entera (T04) menos ese pill.** Un rating es una afirmación sobre la calidad de un tercero, y D-026
  limita lo que la plataforma sostiene a cuatro afirmaciones, todas sobre documentos y atestaciones:
  no hay reseñas, no hay quién las firme y no hay de dónde recalcularlo, así que el número solo
  podría escribirse a mano. Mismo caso que el botón de liberar pagos (D-070). **El conteo de
  compradores sí se muestra**, como una métrica más — es un hecho del registro, no una nota de
  calidad. En el detalle de obra (T03) falta por la misma razón la card del developer con estrellas,
  y además el "Price from", que es otra deuda distinta: el contrato de `GET /projects/:id` no agrega
  el mínimo de las unidades, aunque el perfil sí lo hace. **No menciones el rating en el audio.**

---

## 7. Al terminar

```bash
defaults write com.apple.finder CreateDesktop true && killall Finder
```

- [ ] Desactivar No molestar.
- [ ] Mover el crudo fuera del disco principal o borrarlo (son varios GB).
- [ ] Marcar 3.12 en `CLAUDE.md` §Lo que queda del plan y el criterio 13 en `specs/README.md`, en el
      mismo commit que publique el video.

---

## 8. Voice-over script (English)

> Se graba **aparte**, después del corte, y se monta encima. Numerado por toma.
>
> **El registro es técnico y de UX, no de producto.** Quien lo va a escuchar ya conoce el proyecto:
> esto existe para mostrar que la implementación existe, así que cada línea describe qué hace la
> pantalla, qué escribe y qué se ancla — no qué problema resuelve la plataforma.
>
> **Dos reglas al editarlo.** No afirmar nada fuera de D-026: la plataforma no certifica, no valida y
> no decide. Y **"stage", nunca "milestone"** para una etapa de obra (D-067).
>
> **Al grabarlo:** un archivo por acto, 1 segundo de silencio al principio y al final, y leelo lento
> — el video pausa 1-2 segundos sobre cada hash para que la voz entre ahí.

### Act 1 (T01–T06)

**T01.** The language toggle sits on the login screen itself. Both dictionaries are complete and the
locale persists client-side, so this is a full switch, not a partial one.

**T02.** The listing is scoped by project membership — each role only ever queries what it belongs
to. Search, status filters and the map view run over that same scoped set.

**T03.** Project detail: gallery, estimated handover, location, the documentation section — every
file with its own hash — and the progress timeline.

**T04.** The developer behind it. None of these four numbers is a stored column: projects delivered,
units sold and buyers are counted from the records themselves, and years in business is derived from
the founding year. Only the name, the bio and that year are declared — everything else is the
registry counting itself. Below, their delivered and active projects, each card aggregating its own
units for the price and the size range.

**T05.** Ten stages. Inside one, every file carries its own SHA-256 and the Merkle root of the bundle
it was anchored in. Photographs carry their coordinates and their capture time.

**T06.** Favourites.

### Act 2 (T07–T11)

**T07.** The developer surface. These counters are aggregates over the same membership-scoped
queries.

**T08.** New project: name, location, unit count, delivery date, ten-stage template. Creating it
writes the ten stages in a single database transaction, then mints one on-chain thread per stage,
one at a time — the validator rejects more than one thread per transaction, so they can't be
batched. That's why this takes a few minutes.

**T09.** Ten stages declared and anchored before any work exists.

**T10.** Unit inventory: add, edit, status per unit.

**T11.** The invitation form — email, assigned unit, amount.

### Act 3 (T12–T14)

**T12.** The invitation arrives as a pinned notification. Accepting it is what writes the contract.

**T13.** The portfolio. Gallery, full-screen map, and the building schematic that highlights this
unit's position in the grid.

**T14.** The contract screen is a record, not an action surface: there's no release button here, by
design.

### Act 4 (T15–T22)

**T15.** Evidence upload against a Pending stage. File type is checked by reading the first bytes,
not the content type the client declares. And uploading the first evidence *is* the transition —
there's no separate button for it.

**T16.** The files are hashed, combined into a Merkle root, and that root goes into a Cardano
transaction. Here's the transaction id on a public explorer.

**T17.** The same Merkle root, read from the investor's side.

**T18.** The certifier's queue lists stages in progress or observed. Observing returns it with a
note.

**T19.** Resuming is a deliberate developer action — this edge is the one that isn't automatic.

**T20.** And certifying closes the stage. Four transitions, each one recorded on-chain.

**T21.** The certificate, with its hash and transaction id.

**T22.** The contract from the developer's side.

### Act 5 (T23–T27)

**T23.** The dossier is compiled on read, not stored. The hash is computed at fetch time over the
anchored artefacts, so if what it commits to changes, the hash changes with it.

**T24.** Sharing mints a token.

**T25.** The public route takes that token and no session — private window, no account.

**T26.** Notary review, and the signature. Once signed the hash is frozen: recomputing it would leave
the signature pointing at something that no longer exists.

**T27.** Dossier hash and signature transaction id.

### Act 6 (T28–T31)

**T28.** The audit log — actor, role, category, timestamp and transaction id per row, filterable.

**T29.** Documentation, capital, inventory, progress, investors.

**T30.** A profile surface per role.

**T31.** Mobile-first: at the breakpoint the sidebar becomes a bottom navigation bar.
