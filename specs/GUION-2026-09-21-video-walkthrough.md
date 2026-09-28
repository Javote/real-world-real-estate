# Guion — Video walkthrough (2026-09-21)

> Cubre el ítem **3.12** de `CLAUDE.md` §Lo que queda del plan y el **criterio 13** del SOM
> (`specs/README.md`). Es el guion de una grabación **manual**, no automatizada, pensada para repartirla entre
> quien graba la pantalla, quien graba la voz y quien arma el archivo final (§0.1). Video y voz se
> graban por separado, toma por toma, y se unen al final con un solo comando (§5).
>
> **Revisado el 2026-09-28 contra el código de cada pantalla.** Cada toma tiene sus marcas de tiempo
> (§4, pantalla) y su narración con los mismos tiempos (§8, voz). La revisión corrigió nueve cosas
> que el guion afirmaba y la app no hace, y adelantó la firma del escribano antes de la vista
> pública (§3.1).
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
| **Formato** | 31 tomas cortas, cortadas donde hay espera. Cada toma tiene su video y su audio por separado, con los mismos tiempos relativos a su 0:00: se unen de a pares y después se pegan en orden (§3, §5). | Cada acción on-chain tarda ~45 s y crear un proyecto bloquea ~6 min. Una toma continua es imposible. |

### 0.1 Quién hace qué — pensado para delegar

Cuatro trabajos. Los tres últimos **no necesitan saber nada del proyecto ni de programación**:
alcanza con este documento. Pueden ser la misma persona o cuatro distintas.

| Quién | Qué hace | Qué lee | Qué entrega |
|---|---|---|---|
| **Técnico** (quien conoce el repo) | Pasa las contraseñas **en privado** y está a mano durante la grabación | §1 | Las cuentas andando |
| **Quien graba la pantalla** | Prepara la Mac y Chrome, graba las 31 tomas y, en el corte de T08, invita al certifier desde la web | §1.2, §1.4, §1.5, §1.6, §2, §3, §4, §5.2 | `T01.mov` … `T31.mov`, recortados |
| **Quien graba la voz** | Lee la narración en inglés mirando cada toma ya recortada, una grabación por toma | §3 y §8 | `T01.m4a` … `T31.m4a` |
| **Quien arma el final** | Instala `ffmpeg`, revisa la carpeta y corre un comando | §3.1 y §5 | `walkthrough-final.mp4` |

**Los datos que se ven no tienen que coincidir exacto con este documento.** Los números, nombres y
fechas del §1.3 y del §4 son una referencia de lo que había el 2026-09-21. Lo que el video tiene que
mostrar es que **cada rol entra a sus pantallas** y que **una etapa recorre los estados de la FSM**
(Pending → InProgress → Observed → InProgress → Completed). Si un número es otro, se sigue grabando.

**Los textos en inglés entre comillas del §4** ("Anchor evidence", "Observe"…) son los botones que
vas a ver en pantalla: sirven para encontrarlos, no hay que decirlos.

---

## 1. Lo que tiene que estar listo antes de grabar

### 1.1 Cuentas

Las cinco del seed. En cámara se usan cuatro; la del `admin` se usa **fuera de cámara**, en la
pestaña 5, para invitar al certifier al proyecto nuevo (§1.4):

| Rol en el video | Usuario | `User.id` | Password |
|---|---|---|---|
| Investor | `buyer@example.com` | `ng0gh91de5alybr5ihupbd11` | `SEED_DEMO_PASSWORD` de `apps/api/.env` |
| Developer | `developer@example.com` | `hnrykorp4aqul78oiy9bfe4h` | idem |
| Certifier | `verifier@example.com` | `k2knwiqp66xuv6ojp7iv48ep` | idem |
| Notary | `notary@example.com` | `vjfxjgdxgi3n6pu0a7j7z2pw` | idem |
| Admin (fuera de cámara) | `admin@example.com` | `jn0ejo6c287l4q0n9p5amqpr` | `SEED_ADMIN_PASSWORD` |

**Quien graba no necesita el `.env`:** el técnico le pasa **en privado** (no por un canal grupal ni
en este documento) las dos contraseñas: la de los cuatro roles, que es la misma para todos, y la del admin. Ojo: la pantalla de
login pre-llena una contraseña que **no sirve** en producción (T01).

### 1.2 Archivos de evidencia

Tres archivos en una carpeta al alcance del selector, con nombres presentables (se ven en cámara):

- 1 PDF — ej. `municipal-permit.pdf`
- 2 JPG/PNG — ej. `foundation-01.jpg`, `foundation-02.jpg`

Los límites los fija `packages/shared/src/evidence-rules.ts` (tipo real por los primeros bytes, no
por `Content-Type`). Archivos chicos: el upload viaja a R2 pasando por Render.

### 1.3 El estado de la base — medido y **ya preparado** el 2026-09-21

> **Para el técnico.** Quien graba puede saltar al §1.4. Y los números son referencia (§0.1): no hace
> falta que coincidan.

| Proyecto | Etapas | Estados | Membresías | Unidades | Eventos |
|---|---|---|---|---|---|
| `torre-volumen-1` | 10 | 10 Completed | dev · verifier · **buyer** | 4 vendidas (de 24 declaradas) | 60 |
| `torre-volumen-2` | 10 | 10 Completed | dev · verifier · **buyer** | 4 vendidas (de 18 declaradas) | 60 |
| `torre-volumen-3` | 10 | 10 Completed | dev · verifier · buyer | 4 vendidas (de 30 declaradas); la **1A** → buyer, contrato USD 100.000 firmado | 61 |
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

**La base no tiene nada más pendiente para grabar.** Lo único que queda es invitar al certifier al
proyecto nuevo (§1.4), desde la web, durante el corte de T08.

#### 1.3.2 La organización desarrolladora — **hecho el 2026-09-21**

El commit `b0fbbc2` agregó el perfil del desarrollador (`SPEC-220`) con su migración `0010`. Al
2026-09-21, verificado contra producción:

- **`_migrations` llegó a `0010_organization.sql`** — Render la aplicó sola en el deploy del push.
- **La organización existe y cuelga de las tres obras Volumen**
  (`Organization.id = j4i5lufleuojlhgwen67rnj2`, "Grupo Alpine", fundada en 2005).
- **El endpoint responde en producción**: 3 obras entregadas, 21 años en el rubro, 12 unidades
  vendidas (17 desde el 2026-09-28, por las `7A`…`7E`), 1 comprador, y los tres proyectos repartidos en "Previous projects".
- **La pantalla se verificó renderizada contra producción**, no solo por API: el botón "Ver al
  desarrollador" aparece entre la documentación y el avance, y el perfil abre con la bio, las
  cuatro métricas y las tres cards —cada una con el chip "Grupo Alpine" sobre la portada, que es la
  deuda que `ProjectCard.developerName` arrastraba desde el principio.
- **Se les puso `city` y `country`** (`Buenos Aires` / `Argentina`): los tres tenían la ciudad en
  `NULL` y solo el `address`, así que sus cards salían sin ubicación — **en el perfil y también en
  el listado "Buy" de T02**, que arma la línea con `city, country`.

- **Las tres obras tienen unidades con precio y metros.** La prueba de volumen había dejado solo la
  1A, sin `priceMinorUnits` ni `sizeM2`, y las cards salían sin "From ..." ni rango de metros.
  Verificado en Turso el 2026-09-21: 4 filas de `Unit` por obra, las 12 `sold` y con precio y m²
  (solo la 1A tiene `investorId`, por eso el perfil dice 1 comprador). Volumen 1 — desde
  US$ 185.000, 62–140 m²; Volumen 2 — desde US$ 165.000, 55–120 m²; Volumen 3 — desde
  US$ 195.000, 68–150 m². Los 24 / 18 / 30 que muestran las cards son `Project.totalUnits`, las
  unidades declaradas, no filas cargadas. Mirar esto renderizado es lo que destapó el bug del "desde" dividido dos veces
  (`dc85535`). **Desde el 2026-09-28 el portfolio del buyer tiene seis unidades de Torre Volumen 3**
  (la 1A y las `7A`…`7E` de las muestras de reserva → escrow, todas con precio mayor a US$ 195.000,
  así que el "desde" de la card no cambió). Volumen 3 pasó a 9 filas de `Unit`, 9 vendidas.

*(El proyecto que se crea en cámara en T08 **no** va a tener organización, y está bien: su detalle
no dibuja el link. El perfil del desarrollador se ve una vez, sobre la obra terminada.)*

#### 1.3.3 Cómo quedaron las tres colas, verificado contra la API

| Cola | Estado hoy | Cuándo se llena |
|---|---|---|
| **Certifier** — "Assigned" | **vacía** (las 2 etapas de `torre-a` eran todo lo que tenía) | En **T15**: la evidencia que sube el developer pone esa etapa en `InProgress` y ahí aparece. Es la narrativa correcta — llega una etapa nueva para certificar, en vez de una cola preexistente sin explicación. |
| **Certifier** — KPIs e "Issued" | **30 certificadas, 30 certificados emitidos** con hash y TXID reales de la prueba de volumen | Ya está. El panel del certifier tiene historia real sin que haga falta preparar nada. |
| **Escribano** — "Pending review" | **vacía** (`[]`) | En **T23**, cuando el investor abre el dossier de 1A y eso lo compila. Se usa en **T25**. |

### 1.4 El certifier del proyecto nuevo — se invita **durante el corte de T08**, desde la web

El proyecto que se crea en cámara nace con **una sola membresía, la del developer que lo crea**
(`developer.routes.ts:222`). Sin el certifier, su etapa no aparece en la cola del certifier y el
Acto 4 no existe. Lo suma el **admin**, que invita al certifier; el certifier acepta (D-095,
SPEC-221). **Todo desde la web, sin comandos:** lo hace quien graba, fuera de cámara.

**El buyer no hace falta sumarlo:** lo suma el propio flujo. El developer lo invita en T11 y, al
aceptar en T12, la API le crea la membresía (`investor.routes.ts:705`).

Como crear el proyecto bloquea ~6 minutos igual, **ese corte es exactamente donde entra esto**. En
cuanto la pantalla de T08 vuelve sola (el proyecto ya existe):

1. **Pestaña 5 (admin)** → `/admin`. El proyecto recién creado aparece **primero** en "Proyectos";
   confirmá que es el nombre que tipeaste en T08.
2. En **"Invite a certifier"**: elegí **Verifier Demo** → **Invite**. Tiene que aparecer
   "Invitation sent" y, abajo, la invitación como **Pending**. (Para esa altura la app ya está en
   inglés; en castellano son "Invitar a un certifier", "Invitar", "Invitación enviada",
   "Pendiente".)
3. **Pestaña 3 (certifier)** → recargá `/certifier` (`Cmd+R`). Arriba aparece **"Invitations to
   certify"** con el proyecto nuevo → **Accept**. La sección desaparece.

- [ ] Invitación aceptada: en la pestaña 5, recargando, "Miembros" muestra a Verifier Demo como
      certifier.

### 1.5 Las pasadas de calentamiento

**Render Free duerme el servicio a los 15 minutos de inactividad**, y el primer request después
tarda ~50 s. Este guion tiene un corte de **6 minutos** (T08) y ocho de **un minuto**: si te
distraés entre tomas, la siguiente abre con un spinner de casi un minuto y hay que repetirla. Por eso
el calentamiento no es una sola cosa al principio, son tres.

#### 1.5.1 La pasada completa — **obligatoria, menos de 15 min antes de la primera toma**

Recorré a mano, sin grabar, todas las pantallas del guion. Hace cuatro cosas:

1. **Despierta los dos servicios.** Medido hoy: 9,4 s con el servicio tibio; en frío, mucho más.
2. **Deja la reconciliación de lectura al día** (D-077), que es lo que pasa los `OnChainEvent` de
   `Pending` a `Confirmed`. Sin esto, pantallas con TXID real y confirmado muestran "Pendiente".
3. **Compila el dossier de 1A.** La base tiene hoy **cero** filas en `Dossier`: la de 4B se borró y
   la de 1A no existe hasta que alguien abre `/investor/unit/<1A>/dossier`. Si no lo abrís antes, la
   cola del escribano sale vacía en T25. *(El orden del guion lo resuelve solo —T23 la compila antes
   de que T25 la necesite— pero no dejes que dependa de eso.)*
4. **Es el ensayo de las tomas.** Recorré cada toma del §4 con su tabla al lado, sin las acciones
   irrepetibles (§3.2): así sabés dónde está cada botón antes de que corra el grabador.

- [ ] Recorrida completa hecha, dossier de 1A compilado.
- [ ] **Al terminar la recorrida, dejá la app en castellano** (toggle de idioma → Español). El idioma
      queda guardado en el navegador: si la recorrida terminó en inglés, T01 arrancaría en inglés y
      se pierde el primer gesto del video.

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
- [ ] Antes de **T27**, que abre en una ventana de incógnito sin nada cacheado.

### 1.6 Espacio en disco

Grabando la pantalla completa (2880×1800) son **~200-300 MB por minuto**; el crudo de este guion
son ~20-25 minutos, y el montaje suma ~3 GB más (`unidas/` y el archivo final). **Contar con 15 GB
libres.** El 2026-09-21, después de limpiar, esta Mac quedó con **33 GB** libres: alcanza. Chequealo
igual el día de la grabación.

```bash
df -h /
```

El disco llegó a 99% el 2026-09-18 (`CLAUDE.md` §Worktrees). Lo primero que se puede borrar sin
perder nada, porque se vuelve a llenar solo, son ~2,8 GB (medido el 2026-09-21):

```bash
rm -rf ~/.npm ~/Library/pnpm/store ~/.cache/uv ~/.cache/puppeteer
```

El resto hay que buscarlo a mano (Configuración del Sistema → General → Almacenamiento). **No
borres** `~/Library/Caches/ms-playwright` (el navegador de los tests) ni las imágenes de Docker del
repo (`CLAUDE.md` §Worktrees).

---

## 2. Setup de la máquina

### 2.1 macOS — esta Mac: MacBook Pro 15" Intel (2018), macOS Sequoia 15.7

Pantalla Retina de 2880×1800; en "Predeterminada" se ve como 1440×900. La app de ajustes se llama
**Configuración del Sistema**.

Pegá esto en la Terminal (Cmd+Espacio → "Terminal" → Enter). Esconde los íconos del escritorio; se
revierte en el §7:

```bash
defaults write com.apple.finder CreateDesktop false && killall Finder
```

- [ ] **No molestar ON** (Centro de control, arriba a la derecha → Concentración → No molestar). Un
      banner arruina la toma.
- [ ] Mail, Mensajes, WhatsApp, Slack y todo lo que no sea Chrome y QuickTime, **cerrado** (`Cmd+Q`
      en cada uno). No molestar no silencia todo, y cada app abierta le saca aire a la grabación. Docker Desktop sobre todo.
- [ ] **Cargador enchufado.** Esta máquina baja la velocidad con el grabador activo y la batería a
      medias, y el video sale a los saltos.
- [ ] Resolución en **"Predeterminada"** (Configuración del Sistema → Pantallas). Si está en "Más
      espacio", el texto sale chico en el video.
- [ ] **Wi-Fi estable, sin VPN.** Cada acción en cadena espera a la red.
- [ ] **Espacio libre** (§1.6): 15 GB. El disco es de 250 GB y suele andar justo.

### 2.2 Chrome

**Cómo crear el perfil:** clic en el círculo de la cuenta, arriba a la derecha → **Agregar** →
**Continuar sin una cuenta** → nombre `PropNexus Demo` → Listo. Se abre una ventana nueva: todo lo de
abajo se hace **en esa ventana**. Contraseñas: Configuración → Autocompletar → Administrador de
contraseñas → "Ofrecer guardar contraseñas" apagado.

- [ ] **Perfil nuevo** `PropNexus Demo`: sin extensiones, sin historial, sin autofill.
- [ ] Guardado de contraseñas **desactivado** (si no, el bubble "¿Guardar contraseña?" aparece en
      cuatro tomas distintas).
- [ ] **Traductor de Google desactivado:** Configuración → Idiomas → "Usar el Traductor de Google"
      apagado. Si no, cuando la app pasa a inglés Chrome ofrece "¿Traducir esta página?" en medio de
      la toma.
- [ ] Zoom de página al **110%** (`Cmd` + `+`). Se aplica por sitio: hacelo una vez dentro de la app.
- [ ] **Pantalla completa y sin barra de herramientas — lo que deja el video limpio.** En la ventana
      del perfil: menú **Ver** → **destildá "Mostrar siempre la barra de herramientas…"** (el
      nombre exacto cambia un poco según la versión de Chrome) → después `Cmd+Ctrl+F`. Chrome
      ocupa toda la pantalla y no se ven pestañas, ni la barra de direcciones, ni la barra de menú,
      ni el Dock: solo la app. **Se entra a pantalla completa al final**, con las pestañas del §2.3 ya
      armadas.
- [ ] **El mouse lejos del borde de arriba.** Si toca el borde, baja la barra de menú y la de
      Chrome. Si pasa en medio de una toma, se recorta en el montaje.

**Para escribir una dirección en pantalla completa** (fuera de cámara): `Cmd+L` muestra la barra de
direcciones un momento → pegás → Enter. Para cambiar de pestaña no hace falta verla (§2.3).

### 2.3 Las pestañas — el truco que ahorra media grabación

La sesión vive en `sessionStorage` (`apps/web/src/auth/session.ts:11`), que es **por pestaña**: los
cuatro roles pueden estar logueados a la vez y se cambia de rol con `Cmd+Opt+→`.

| Pestaña | Rol |
|---|---|
| 1 | Investor (`buyer@`) |
| 2 | Developer (`developer@`) |
| 3 | Certifier (`verifier@`) |
| 4 | Notary (`notary@`) |
| 5 | Admin (`admin@`) — **fuera de cámara**, solo para el §1.4 |

**Antes de T01, en este orden:**

0. Cerrá todas las pestañas que hayan quedado de la recorrida del §1.5.1, y todavía **sin**
   pantalla completa.
1. Pestaña **1**: `propnexus-web.onrender.com/login` **sin entrar**, y **en castellano**. Si aparece
   en inglés, tocá el toggle de idioma para volver a Español.
2. Pestañas **2, 3, 4 y 5**, en ese orden: `Cmd+T` → escribí `propnexus-web.onrender.com/login` →
   entrá con su usuario (la contraseña se tipea, §1.1). El admin no tiene solapa: en la 5 tipeá
   `admin@example.com` en "Usuario". Se ven en castellano: está bien.
3. Volvé a la pestaña 1 (`Cmd+1`), entrá en pantalla completa (§2.2) y grabás **T01**: el primer
   gesto es el toggle → inglés, y recién después el login.
4. **Después de T01, fuera de cámara:** pasá por las pestañas 2, 3, 4 y 5 y recargá cada una (`Cmd+R`).
   El idioma se lee al abrir la página: sin recargar, siguen en castellano. La sesión sobrevive a la
   recarga.

Cuando el guion dice "[DEV]" o "pestaña 2", solo cambiás de pestaña (`Cmd+Opt+→` / `Cmd+Opt+←`).

**Dos reglas que no se pueden romper:**

1. **Cada pestaña se abre con `Cmd+T` en blanco.** Una abierta haciendo clic en un link desde otra
   **hereda una copia de la sesión de esa otra**, y vas a estar grabando al certifier con la sesión
   del developer sin enterarte.
2. **El idioma se cambia una sola vez, en cámara, en T01.** Vive en
   `localStorage['propnexus.lang']` (`apps/web/src/i18n/locale.ts:5`): compartido por todas las
   pestañas pero leído al montar — por eso el paso 4 de arriba.

### 2.4 El grabador

**`Shift+Cmd+5`, el capturador que trae macOS.** Cero instalación, encoder por hardware de Intel, no
funde la CPU. OBS solo haría falta para webcam o audio del sistema, y no hay ninguno.

`Shift+Cmd+5` → **Opciones**:

- [ ] Guardar en `~/Movies/propnexus-walkthrough/`. La carpeta se crea una vez, pegando en la
      Terminal `mkdir -p ~/Movies/propnexus-walkthrough`; después, en Opciones → **Otra
      ubicación…** → Películas → `propnexus-walkthrough`.
- [ ] Temporizador: **ninguno**
- [ ] Micrófono: **ninguno**
- [ ] **Mostrar clics del mouse: SÍ** ← los clics son lo que hace seguible el video
- [ ] Modo: **Grabar toda la pantalla** (el ícono de pantalla con un círculo). Con Chrome en pantalla
      completa, toda la pantalla es la app: las 31 tomas encuadran idénticas sin seleccionar nada.

**Para grabar una toma:** `Shift+Cmd+5` → **Grabar** → hacés la toma → para cortar,
**`Cmd+Ctrl+Esc`** (en pantalla completa el botón de stop queda escondido en la barra de menú). El
archivo aparece en la carpeta: renombralo ya (§3). Los primeros y últimos segundos, con el atajo, se
recortan en el montaje.

---

## 3. Cómo se corta: actos vs. tomas

**Los 6 actos son estructura narrativa y sesiones de trabajo, no unidades de grabación.** Lo que
se graba son **31 tomas**, y cada toma es un archivo de video y un archivo de audio.

**Por qué la toma y no el acto.** Adentro de un acto hay esperas de 1 a 6 minutos (cada acción que
va a la cadena tarda). Un acto grabado de corrido tendría que recortarse por dentro y la voz ya no
caería donde dice el guion. Con la toma como unidad, **cada archivo empieza en 0:00 y todos los
tiempos del §4 y del §8 son relativos a ese 0:00**: si rehacés una toma, no se corre nada más.

**La forma de trabajar, entonces:**

1. **Pantalla primero, por acto.** Grabás las tomas de un acto en una sentada (el Acto 1 se puede
   grabar otro día; los Actos 2 a 5 van **en una sola sesión y en orden**, porque cada toma deja la
   base en el estado que necesita la siguiente — §3.2).
2. **Recortás cada toma** para que el 0:00 sea el primer cuadro útil (§5.2) y quede cerca de su
   duración del §3.1.
3. **Voz después, mirando la toma ya recortada**, una grabación por toma (§8.0). Los tiempos del §8
   son los mismos que los del §4, así que la frase entra cuando ves en el video lo que la columna
   "Entra cuando ves" describe.
4. **Montaje:** un comando (§5.4). Recorta el silencio del principio de cada audio y lo hace entrar
   en el **segundo 0:01** de su toma, así que no hace falta arrancar audio y video al mismo tiempo.

Una toma termina cuando pasa lo primero de estas tres:

1. **Empieza una espera.** Marcadas **⏸ CORTE** abajo.
2. **Pasás de los ~90 segundos.** Más que eso y un error tipeando te hace repetir mucho.
3. **Cambiás de rol.** El corte en el cambio de pestaña es invisible en el montaje.

**Cada archivo se renombra apenas termina la toma**, con el nombre exacto: `T01.mov`, `T02.mov`…
`T31.mov`. El capturador de macOS guarda como "Grabación de pantalla 2026-…": clic en el archivo →
Enter → escribir `T01` → Enter. Dos dígitos, T mayúscula, nada más: el montaje del §5 empareja video
y audio por ese nombre y los ordena por él. **Si repetís una toma, el archivo nuevo reemplaza al
viejo con el mismo nombre** — no dejes `T05 copia.mov` dando vueltas.

**Ritmo:** los tiempos del §4 son el objetivo, no un cronómetro: ±2 s por paso está bien. Lo que no
se negocia son los **quietos** (las filas que dicen "quieto"): son el lugar donde entra la frase que
explica lo que se ve. Si grabás al ritmo natural de uso, después la voz no tiene dónde caer.
**Contá los quietos en voz baja** ("mil uno, mil dos…") — el micrófono está apagado.

### 3.1 El mapa de tomas — la tabla que comparten los tres

**Una toma = un archivo de video + un archivo de audio, con el mismo nombre.** `T07.mov` y `T07.m4a`
van juntos; el script del §5 los une de a pares y después pega las 31 en orden.

- **Video** es lo que tiene que durar la toma **ya recortada**. ±10 s está bien.
- **Voz** es lo que dura la narración, sumando sus frases. Siempre es menor que el video: entre
  frase y frase hay imagen sola, a propósito.
- **Empieza en** es dónde cae la toma en el video final. Es aproximado: el montaje agrega medio
  segundo por toma, así que al final se corre unos 15 s.
- Si igual una voz sale más larga que su video, no se rompe nada: el script congela el último
  cuadro hasta que termine. Si es más corta, completa con silencio.
- **Irrepetible** quiere decir que la toma cambia la base (manda algo a la cadena). Si sale mal,
  **no se puede volver a grabar** sin rehacer todo desde T08 — ver §3.2.

| Toma | Empieza en | Pestaña | Qué | Pantalla | Video | Voz | |
|---|---|---|---|---|---|---|---|
| T01 | 0:00 | 1 · Investor | Login, y el cambio de idioma | `/login` → `/investor/buy` | 22 s | 13 s | |
| T02 | 0:22 | 1 · Investor | Buy | `/investor/buy` | 35 s | 17 s | |
| T03 | 0:57 | 1 · Investor | El proyecto por dentro | `/project/<torre-volumen-3>` | 45 s | 16 s | |
| T04 | 1:42 | 1 · Investor | Quién construye | `/project/<torre-volumen-3>/developer` | 40 s | 25 s | |
| T05 | 2:22 | 1 · Investor | Hasta la prueba | `…/progress` → `…/stage/:stageId` | 45 s | 27 s | |
| T06 | 3:07 | 1 · Investor | Favoritos | `/investor/favorites` | 10 s | 4 s | |
| T07 | 3:17 | 2 · Developer | El panel | `/developer` → `/developer/projects` | 30 s | 12 s | |
| T08 | 3:47 | 2 · Developer | Proyecto nuevo | `/developer/project/new` | 36 s | 25 s | ⚠ irrepetible |
| T09 | 4:23 | 2 · Developer | El proyecto ya creado | `/developer/project/:id` → `/developer/progress` | 30 s | 15 s | |
| T10 | 4:53 | 2 · Developer | Unidades | `/developer/project/:id/units` | 32 s | 10 s | |
| T11 | 5:25 | 2 · Developer | La invitación | `/developer/project/:id/invite` | 25 s | 8 s | ⚠ irrepetible |
| T12 | 5:50 | 1 · Investor | Aceptar | campana → `/investor/notifications` | 35 s | 15 s | ⚠ irrepetible |
| T13 | 6:25 | 1 · Investor | El portfolio | `/investor/units` → `/investor/unit/<5A>` | 35 s | 22 s | |
| T14 | 7:00 | 1 · Investor | El contrato como registro | `/investor/unit/<5A>/contract` | 25 s | 13 s | |
| T15 | 7:25 | 2 · Developer | Subir evidencia | `/developer/project/:id/upload` | 40 s | 20 s | ⚠ irrepetible |
| T16 | 8:05 | 2 · Developer | La prueba, y afuera de la app | AnchoringSuccessModal → cardanoscan | 26 s | 11 s | |
| T17 | 8:31 | 1 · Investor | El mismo anclaje, del otro lado | `/investor/unit/<5A>/notifications` → `/investor/unit/<5A>` | 35 s | 16 s | |
| T18 | 9:06 | 3 · Certifier | Observar | `/certifier` → `/certifier/assigned` → `/certifier/stage/:id` | 40 s | 17 s | ⚠ irrepetible |
| T19 | 9:46 | 2 · Developer | Reanudar | `/developer/progress` | 20 s | 11 s | ⚠ irrepetible |
| T20 | 10:06 | 3 · Certifier | Certificar | `/certifier/stage/:id` | 20 s | 7 s | ⚠ irrepetible |
| T21 | 10:26 | 3 · Certifier | El certificado | `/certifier/issued` | 15 s | 5 s | |
| T22 | 10:41 | 2 · Developer | El contrato del lado del developer | `/developer/project/:id/contracts` | 25 s | 14 s | |
| T23 | 11:06 | 1 · Investor | El dossier | `/investor/unit/<1A>/dossier` | 40 s | 24 s | |
| T24 | 11:46 | 1 · Investor | Compartir | "Share" → modal | 15 s | 8 s | |
| T25 | 12:01 | 4 · Notary | La firma | `/notary` → `/notary/dossiers` → `/notary/dossier/:id` | 35 s | 19 s | ⚠ irrepetible |
| T26 | 12:36 | 4 · Notary | El historial | `/notary/signed` | 15 s | 11 s | |
| T27 | 12:51 | incógnito | Verificado sin cuenta | `/public/dossier/:shareToken` | 25 s | 18 s | |
| T28 | 13:16 | 2 · Developer | El círculo se cierra | `/developer/audit-log` | 45 s | 21 s | |
| T29 | 14:01 | 2 · Developer | El resto del developer | documentation → investors → capital → units → progress | 75 s | 23 s | |
| T30 | 15:16 | las cuatro | Perfiles y menú | los cuatro `/…/profile` + `/investor/menu` | 60 s | 13 s | |
| T31 | 16:16 | 1 · Investor | Responsive | DevTools → Device Toolbar | 30 s | 13 s | |
| | **16:46** | | **Total** | | **1006 s ≈ 17 min** | | |

**Cambio de orden respecto de la versión del 2026-09-21:** la firma del escribano (antes T26-T27)
pasó **antes** de la vista pública (antes T25). Así la vista pública de T27 muestra el dossier
**ya firmado**, con su badge "Signed", en vez de "Pending": es el plano más fuerte del video y
ahora cierra el acto con la prueba completa.

### 3.2 Las tomas irrepetibles, y qué hacer si una sale mal

T08, T11, T12, T15, T18, T19, T20 y T25 mandan algo a la cadena y dejan la base en otro estado. No
hay "otra toma" de esas: la etapa ya no está `Pending`, la invitación ya se aceptó.

- **Un error de tipeo o un clic de más:** seguí. Se arregla recortando (§5.2) o la voz lo tapa.
- **Un error que se ve en pantalla** (mensaje rojo, pantalla equivocada): pará la grabación,
  resolvé fuera de cámara y grabá **la acción siguiente** como una toma nueva con el mismo nombre.
  El recorte une las dos mitades.
- **Algo que rompe la historia** (certificaste antes de observar, aceptaste la invitación en otra
  unidad): la única salida limpia es **un proyecto nuevo desde T08** (otros ~6 min de mints más
  los ~8 min del Acto 2 al 4). Por eso conviene hacer el **ensayo del §1.5.1 completo, incluidas
  las acciones**, sobre un proyecto de prueba — cuesta tADA de Preprod, que no es plata, y deja un
  proyecto más en el listado del developer (T07), que se puede tapar con el encuadre.

---

## 4. El guion de pantalla, toma por toma — para quien graba

**Cómo leer cada toma:**

- **Arranca en** es la pantalla que tiene que estar quieta **antes** de apretar grabar. Todo lo que
  sea tipear una URL (`Cmd+L`) se hace ahí, fuera de cámara.
- **Tiempo** es el segundo de la toma **ya recortada**, contando desde 0:00.
- **Lo que tiene que verse** es lo que la voz va a nombrar. Si no se ve, la frase queda colgando.
- Los textos entre comillas son los literales en inglés que vas a ver en pantalla: sirven para
  encontrarlos, no hay que decirlos.
- **Navegá con la app, no con la barra de direcciones:** en desktop cada rol tiene una **barra
  lateral** a la izquierda (Investor: Menu · Favorites · Buy · Units · User; Developer: Panel ·
  Projects · Capital · Units · Progress; Certifier y Notary: Panel · … · Profile) y el header tiene
  la campana y el ícono de perfil. Los clics se ven en el video; un `Cmd+L`, no.

### Acto 1 · El problema y la promesa — Investor (T01-T06, ≈3 min)

Abre por el final del producto: **`torre-volumen-3`**, con sus 10 etapas certificadas. Es el
contraste contra el que después se entiende el proyecto que nace vacío.

#### T01 · Login, y el cambio de idioma — 22 s

**Arranca en:** pestaña 1, `/login`, **en castellano** (§2.3), sin entrar. La solapa "Inversor"
viene seleccionada y el usuario `buyer@example.com` ya precargado.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00–0:03 | **Quieto.** | El login en castellano. |
| 0:03 | Clic en **EN** del toggle de idioma (arriba a la derecha). | Todo pasa a inglés: "Real-estate traceability, anchored on blockchain". |
| 0:04–0:07 | **Quieto.** | La pantalla en inglés. |
| 0:07 | Clic en la solapa **"Investor"** (ya está elegida: el clic es para que se vea). | "Username" con `buyer@example.com`. |
| 0:09–0:14 | Clic en **"Password"** y tipeá la contraseña (§1.1). | Solo puntos. |
| 0:15 | Clic en **"Sign in"**. | "Signing in…" |
| 0:16–0:22 | **Quieto** sobre lo que carga. | "Buy" con las tres cards de Torre Volumen. |

**Ensayalo antes.** La solapa precarga solo el usuario; la contraseña es la de `SEED_DEMO_PASSWORD`,
no la local. Un "Invalid credentials" en la primera toma es la peor apertura posible.

#### T02 · Buy — 35 s

**Arranca en:** `/investor/buy`, arriba de todo (donde terminó T01).

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00–0:11 | **Quieto**, el mouse recorre lento las tres cards. | Torre Volumen 1, 2 y 3 con su pill "Delivered" y su cantidad de unidades. |
| 0:12 | Clic en la pill **"Search"**. | El campo "Search by zone…". |
| 0:13–0:16 | Tipeá `Buenos Aires`. | Las tres siguen (las tres están en Buenos Aires). |
| 0:17 | Borrá lo tipeado y clic en la pill **"Filters"**. | El diálogo "Filters": "Project status" y "Sort by". |
| 0:18–0:20 | Clic en **"Delivered"**, después cerrá el diálogo. | La lista filtrada. |
| 0:21 | Clic en la pill **"Map"**. | El mapa con los pines de las obras. |
| 0:22–0:27 | **Quieto.** Si los pines se tapan entre sí, hacé zoom con la rueda. | Los pines. |
| 0:28 | Clic en el pin de **Torre Volumen 3**. | Su popover. |
| 0:30 | Clic en **"View project"**. | — |
| 0:31–0:35 | **Quieto** sobre lo que carga. | El detalle de Torre Volumen 3. |

#### T03 · El proyecto por dentro — 45 s

**Arranca en:** `/project/<torre-volumen-3>`, arriba de todo (donde terminó T02).

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00–0:03 | **Quieto.** | Portada y nombre. |
| 0:03 | Clic en la portada (**"Open gallery"**), pasá una foto con la flecha y cerrá (`Esc`). *Si la obra no tiene fotos, quedate quieto hasta 0:08.* | La galería a pantalla completa. |
| 0:09 | Clic en el **corazón** ("Save to favorites"). | El corazón se llena. |
| 0:10–0:12 | **Quieto.** | "Completion: …" y "Location". |
| 0:13 | Clic en **"Location"**. | El mapa a pantalla completa. |
| 0:14–0:16 | **Quieto**, y cerrá (`Esc`). | El pin de la obra. |
| 0:17 | Scroll hasta **"Verified documentation"**. | — |
| 0:18–0:26 | **Quieto**, el mouse sobre el hash de un documento. | Cada documento con su hash y su badge "Verified". |
| 0:27 | Scroll un poco más. | El botón **"View developer"** y, abajo, "Progress" con la timeline y "Current stage". |
| 0:28–0:39 | **Quieto** sobre la timeline. | Las 10 etapas en verde. |
| 0:40 | Clic en **"View developer"**. | — |
| 0:41–0:45 | **Quieto** sobre lo que carga. | El perfil del desarrollador. |

*(La card del developer con rating y el "Price from" que M2-D1 pide acá no se dibujan: el contrato
de `GET /projects/:id` no los da. Ver §6.)*

#### T04 · Quién construye — 40 s

**Arranca en:** `/project/<torre-volumen-3>/developer` (donde terminó T03).

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00–0:03 | **Quieto.** | "Grupo Alpine" y su bio. |
| 0:04 | Clic en **"See more"**. | La bio entera. |
| 0:05–0:07 | **Quieto.** | — |
| 0:08–0:20 | El mouse pasa lento por las cuatro tarjetas, ~3 s cada una. | "Projects delivered", "Years in business", "Units sold", "Buyers". |
| 0:21 | Scroll hasta **"Previous projects"**. | Las tres obras entregadas, cada card con su "From …", su rango de m² y su avance. |
| 0:22–0:33 | **Quieto**, scroll lento por las tres cards. | — |
| 0:34 | Scroll hasta **"Active projects"**. | "No active projects." (el proyecto que nace en T08 no tiene organización: está bien). |
| 0:36 | Scroll arriba y clic en **"Back to development"** (la flecha del header). | — |
| 0:38–0:40 | **Quieto.** | El detalle de la obra otra vez. |

*(Lo que la captura muestra y la pantalla no: el pill de rating "4.8 / 5.0". Es una decisión
(D-094), no un faltante — §6.)*

#### T05 · Hasta la prueba — 45 s

**Arranca en:** `/project/<torre-volumen-3>`, con scroll hasta la sección "Progress" (donde
terminó T04, bajando fuera de cámara).

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00 | Clic en **"View full progress"**. | — |
| 0:01–0:10 | Scroll lento por la lista **"Stages"**. | Las 10 etapas, "Stage 1 of 10"… cada una con su pill "Completed". |
| 0:11 | Clic en una etapa del medio (ej. **"Foundations"**). | — |
| 0:12–0:16 | **Quieto.** | Nombre, "Stage 4 of 10", fecha de certificación y el badge **"Verified"**. |
| 0:17 | Scroll hasta **"Supporting documentation"** (y "Photographic evidence" si tiene fotos). | — |
| 0:18–0:25 | **Quieto**, el mouse sobre un hash. | Cada archivo con su hash. |
| 0:26 | Clic en **"View stage milestone"**. | El modal: "Verified documents", "Package Merkle root", "Bundle files", "Merkle path". |
| 0:27–0:35 | **Quieto**, el mouse sobre el "Package Merkle root". | — |
| 0:36 | Clic en el **txid** del modal. | "Blockchain verification", "Anchoring date", "View in explorer". |
| 0:37–0:43 | **Quieto.** No abras el explorer: eso se guarda para T16. | — |
| 0:44 | Cerrá los modales (`Esc`, `Esc`). | El detalle de la etapa. |

#### T06 · Favoritos — 10 s

**Arranca en:** el detalle de la etapa (donde terminó T05).

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00 | Clic en **"Favorites"** en la barra lateral. | — |
| 0:01–0:10 | **Quieto.** | "My favorites · 1 saved projects" con Torre Volumen 3, la que guardaste en T03. |

### Acto 2 · Nace un proyecto — Developer (T07-T11, ≈2½ min)

#### T07 · El panel — 30 s

**Arranca en:** pestaña 2, `/developer`, arriba de todo.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00–0:03 | **Quieto.** | "Developer panel", "Welcome, …". |
| 0:04–0:15 | El mouse pasa lento por los KPIs. | "Active projects", "Capital raised", "Total units", "Average progress", "Verified documents · anchored on chain". |
| 0:16–0:19 | **Quieto.** | "Development management": "Investors", "Documentation", "Audit log". |
| 0:20 | Clic en **"Projects"** en la barra lateral. | "My projects · 7 projects". |
| 0:21–0:30 | Scroll lento. | Las cards. Si `Torre A`, `Torre Demo E2E` o `Torre Pending Test` molestan, quedate sobre las de arriba — **no los borres**, tienen eventos on-chain colgando. |

#### T08 · Proyecto nuevo — 36 s · ⚠ irrepetible

**Arranca en:** `/developer/projects` (donde terminó T07).

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00 | Clic en **"New"**. | "New project · Set up the basic data". |
| 0:02–0:06 | "Project name": tipeá `Torre Núñez`. | — |
| 0:07–0:12 | "Location": tipeá `Av. del Libertador 7200, Buenos Aires`. | — |
| 0:13–0:17 | "Number of units": clic en **+** hasta 12. | — |
| 0:18–0:23 | "Estimated delivery date": elegí una fecha a dos o tres años. | — |
| 0:24–0:30 | **Quieto**, el mouse sobre la lista de etapas. | "Standard template (10 stages)" y las diez: "1. Land acquisition" … "10. Final works and subdivision". |
| 0:31 | Clic en **"Create project"**. | El botón cargando. |
| 0:32–0:36 | **Quieto.** | — |

**⏸ CORTE ~6 min.** El request no vuelve hasta que los 10 mints terminaron: son secuenciales dentro
del handler (`developer.routes.ts:266`) y cada uno es su propia transacción (D-083 — el validador
rechaza acuñar más de un hilo por tx). **Esperá a que la pantalla vuelva sola** (no cierres la
pestaña ni recargues): cae en el detalle del proyecto nuevo. Mientras, fuera de cámara, hacé el
§1.4 (el admin invita al certifier y el certifier acepta). Sin eso no hay Acto 4.

#### T09 · El proyecto ya creado — 30 s

**Arranca en:** `/developer/project/<nuevo>`, que es donde la app te deja sola al terminar T08. Si
pasaron más de un par de minutos, recargá (`Cmd+R`) antes de grabar (§1.5.3).

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00–0:03 | **Quieto.** | "Torre Núñez" con su pill de estado. |
| 0:04–0:12 | El mouse pasa por las cuatro acciones y las tres tarjetas. | "Manage units", "Invite investor", "Upload evidence", "Contracts"; "Progress 0%", "Capital —", "Investors 0". |
| 0:13 | Clic en **"Progress"** en la barra lateral. | "Construction progress". |
| 0:14–0:17 | Scroll hasta la card de **Torre Núñez**. | "Overall Progress: 0%". |
| 0:18–0:30 | **Quieto**, scroll lento por "Stage Detail". | Las diez filas, "Stage 1/10" … "Stage 10/10", todas con pill **"Pending"**. |

**El contraste con T05 es el punto:** diez etapas declaradas y ancladas, ninguna empezada.

#### T10 · Unidades — 32 s

**Arranca en:** `/developer/project/<nuevo>` (fuera de cámara: barra lateral "Projects" → Torre
Núñez).

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00 | Clic en **"Manage units"**. | — |
| 0:01–0:04 | **Quieto.** | "Total 0", "Sold 0", "Reserved 0", "Available 0" y "You have not added units yet." |
| 0:05–0:08 | "Unit label": tipeá `5A`. | — |
| 0:09–0:13 | "Floor": clic en **+** hasta 5. | — |
| 0:14–0:19 | "Surface (m²)": tipeá `85`. | — |
| 0:20 | Clic en **"Add"**. | — |
| 0:21–0:32 | **Quieto.** | La card "5A · Floor 5 · 85 m²", "Available", "Unassigned"; arriba, "Total 1", "Available 1". |

#### T11 · La invitación — 25 s · ⚠ irrepetible

**Arranca en:** "Manage units" de Torre Núñez (donde terminó T10).

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00 | Clic en la flecha **"Back"** del header, y en **"Invite investor"**. | "Invite investor · Assign a unit". |
| 0:02–0:07 | "Email": tipeá `buyer@example.com`. | — |
| 0:08–0:11 | "Assigned unit": elegí **5A**. | — |
| 0:12–0:16 | "Amount": tipeá `185000`. | — |
| 0:17 | Clic en **"Send invitation"**. | El botón cargando. |
| 0:18–0:25 | **Quieto.** | — |

**⏸ CORTE ~1 min.** No hay campo de nombre: la invitación es email, unidad y monto.

### Acto 3 · La invitación llega — Investor (T12-T14, ≈1½ min)

#### T12 · Aceptar — 35 s · ⚠ irrepetible

**Arranca en:** pestaña 1, en "My favorites" (donde terminó T06). Antes de grabar, recargá
(`Cmd+R`) para que la campana muestre la invitación.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00–0:02 | **Quieto.** | La campana del header con su contador. |
| 0:03 | Clic en la **campana**. | "Updates · Progress on your units". |
| 0:04–0:09 | **Quieto.** | Arriba, fijada, la card "Project invitation · Torre Núñez · 5A" con "View invitation →". |
| 0:10 | Clic en **"View invitation →"**. | El modal. |
| 0:11–0:23 | **Quieto**, el mouse baja lento por el modal. | "Project", "Assigned unit", "Total amount", "Estimated handover", "Terms" y **"This invitation is anchored on-chain"**. |
| 0:24 | Clic en **"Accept invitation"**. | "Accepting…" |
| 0:25–0:35 | **Quieto.** | — |

**⏸ CORTE ~1 min.** Aceptar es lo que crea el contrato de la unidad.

#### T13 · El portfolio — 35 s

**Arranca en:** "Updates", ya con la invitación aceptada.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00 | Clic en **"Units"** en la barra lateral. | "My units · What you bought". |
| 0:01–0:09 | Scroll lento. | Siete unidades: seis de Torre Volumen 3 (1A y 7A…7E) y la 5A de Torre Núñez. |
| 0:10 | Clic en la **5A**. | El detalle de la unidad. |
| 0:11–0:13 | **Quieto.** | — |
| 0:14 | Clic en **"Open map"**. | El mapa a pantalla completa. |
| 0:15–0:18 | **Quieto**, y cerrá (`Esc`). | — |
| 0:19 | Clic en **"View my unit in the building"**. | La grilla del edificio con **"Your unit"** resaltada y "Floor 5 · 5A · 85 m²". |
| 0:20–0:31 | **Quieto.** | Abajo, "Schematic view for reference. Final plans are in the dossier." |
| 0:32 | Cerrá (`Esc`) y scroll hasta **"Unit details"**. | Project, Unit, Floor, Surface, Total investment, Status. |
| 0:33–0:35 | **Quieto.** | — |

#### T14 · El contrato como registro — 25 s

**Arranca en:** el detalle de la 5A (donde terminó T13), con scroll hasta la sección "Contract
and payments" ("Amount: US$ 185,000") hecho antes de apretar grabar.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00 | Clic en **"View contract and payments"**. | "My contract and payments · 5A". |
| 0:01–0:12 | **Quieto.** | "Contract summary": "Total amount" y "Signing date". |
| 0:13–0:25 | **Quieto**, el mouse sobre la sección de abajo. | "Recorded schedule": **"No releases recorded yet."** — es lo correcto, no un bug (§6). |

### Acto 4 · El ciclo de prueba: las cuatro aristas de la FSM (T15-T22, ≈3½ min) ← el núcleo

**Todo sobre la misma etapa: la 1, "Land acquisition", de Torre Núñez**, para que se lea como un
solo objeto recorriendo una máquina de estados y no como cuatro cosas sueltas.

#### T15 · Subir evidencia — 40 s · ⚠ irrepetible

**Arranca en:** pestaña 2, `/developer/project/<nuevo>` (fuera de cámara: "Projects" → Torre
Núñez). **Antes de grabar**, abrí una vez el selector de archivos y navegá hasta la carpeta del
§1.2, así la próxima vez abre ahí.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00 | Clic en **"Upload evidence"**. | "Upload evidence · Anchor files on blockchain". |
| 0:02–0:04 | **Quieto.** | "Select stage" con los diez chips. |
| 0:05 | Clic en el chip de la etapa **1**. | "Selected stage": "Land acquisition", pill **"Pending"**. |
| 0:06–0:08 | **Quieto.** | — |
| 0:09 | Clic en **"Drag files or tap to select"**. | El selector de macOS. |
| 0:10–0:15 | Elegí los tres archivos (`Cmd`+clic) → **"Abrir"**. | — |
| 0:16–0:22 | **Quieto.** | Los tres archivos en la lista. |
| 0:23–0:27 | "Notes (optional)": tipeá `Title deed and site survey.` | — |
| 0:28 | Clic en **"Anchor evidence"**. | "Anchoring…" |
| 0:29–0:40 | **Quieto.** | — |

**⏸ CORTE ~1 min.** → arista **`Pending → InProgress`**. No es un botón aparte: la primera
evidencia sobre una etapa `Pending` **es** la señal de que el trabajo empezó, y la transición la
dispara el backend (`developer-evidencia.routes.ts:487`, M1-D2c *"Pending → InProgress: work
initiated"*). **Quedate fuera de cámara hasta que se abra solo el modal "Evidence anchored".**

#### T16 · La prueba, y afuera de la app — 26 s

**Arranca en:** el modal **"Evidence anchored"** ya abierto (se abre solo al terminar T15).

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00–0:07 | **Quieto**, el mouse sobre el "Merkle root". | "Evidence anchored", "Merkle root", el txid. |
| 0:08 | Clic en **"View on explorer"**. | Se abre cardanoscan (preprod) en otra pestaña. |
| 0:09–0:12 | Esperá que cargue. | — |
| 0:13–0:26 | **Quieto** sobre el hash de la transacción. **El plano más importante del video: el hash existe fuera de PropNexus.** | El TXID en cardanoscan. |

Al terminar, fuera de cámara: **cerrá esa pestaña** (`Cmd+W`), volvé a la pestaña 2 y clic en
**"Done"**.

#### T17 · El mismo anclaje, del otro lado — 35 s

**Arranca en:** pestaña 1, `/investor/unit/<5A>/notifications` (fuera de cámara: "Units" → 5A →
sección "News" → **"View all"**). Recargá antes de grabar.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00–0:05 | **Quieto.** | "Unit updates · Updates for 5A": "Evidence anchored: Land acquisition" arriba. |
| 0:06 | Clic en esa novedad. | Te lleva al detalle de la 5A. |
| 0:07–0:10 | Scroll hasta **"Evidence by stage"**. | "Tap a milestone to view anchored evidence" y los chips de las 10 etapas. |
| 0:11–0:12 | **Quieto.** | — |
| 0:13 | Clic en el chip de la etapa **1**. | El modal "Stage milestone". |
| 0:14–0:32 | **Quieto**, el mouse sobre el "Package Merkle root" y después sobre los hashes. | "Package Merkle root", txid, "Bundle files" con el hash de cada archivo, "Merkle path". |
| 0:33 | Cerrá (`Esc`). | — |

**Un rol lo produce, otro lo verifica, y es el mismo número** que el de T16.

#### T18 · Observar — 40 s · ⚠ irrepetible

**Arranca en:** pestaña 3, `/certifier`. Recargá antes de grabar.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00–0:06 | **Quieto.** | "Certifier panel": "Assigned 1", "Certified 30", "Observed", "Total stages"; y "Assigned stages" con "Stage 1: Land acquisition". |
| 0:07 | Clic en **"Assigned"** en la barra lateral. | "Assigned · Stages assigned for certification". |
| 0:08–0:11 | **Quieto.** | La misma etapa. |
| 0:12 | Clic en la etapa. | "Certify stage · Stage 1", pill "In progress". |
| 0:13–0:22 | **Quieto**, scroll lento. | "Evidence uploaded by the developer": los tres archivos de T15 con su hash. |
| 0:23 | Clic en **"Observe"**. | El modal "Observe stage". |
| 0:24–0:32 | En "Observations" tipeá `The site survey is missing the surveyor's signature.` | — |
| 0:33 | Clic en **"Send"**. | "Sending…" |
| 0:34–0:40 | **Quieto.** | — |

**⏸ CORTE ~1 min.** → arista **`InProgress → Observed`**.

#### T19 · Reanudar — 20 s · ⚠ irrepetible

**Arranca en:** pestaña 2, `/developer`. Recargá antes de grabar.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00 | Clic en **"Progress"** en la barra lateral. | — |
| 0:01–0:08 | **Quieto.** | Arriba, "Observed stages": "Torre Núñez · Land acquisition" con pill **"Observed"**. |
| 0:09 | Clic en **"Resume stage"**. | El botón cargando. |
| 0:10–0:20 | **Quieto.** | — |

**⏸ CORTE ~1 min.** → arista **`Observed → InProgress`**. Esta sí es una acción deliberada del
developer: el backend no la dispara solo, a propósito. *(La pantalla no muestra el texto de la
observación: no lo digas en la voz.)*

#### T20 · Certificar — 20 s · ⚠ irrepetible

**Arranca en:** pestaña 3, `/certifier/stage/<id>` (el mismo de T18). Recargá antes de grabar: la
pill tiene que decir "In progress".

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00–0:04 | **Quieto.** | Pill "In progress", la evidencia. |
| 0:05 | Clic en **"Certify"**. | "Certifying…" |
| 0:06–0:20 | **Quieto.** | — |

**⏸ CORTE ~1 min.** → arista **`InProgress → Completed`**. La máquina de estados, entera.

#### T21 · El certificado — 15 s

**Arranca en:** la pantalla de la etapa, ya certificada.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00–0:02 | **Quieto.** | La pill "Certified". |
| 0:03 | Clic en **"Issued"** en la barra lateral. | "Issued certificates · Technical history". |
| 0:04–0:15 | **Quieto**, el mouse sobre la primera fila. | "Land acquisition", pill "Certified", su hash y su txid. |

#### T22 · El contrato del lado del developer — 25 s

**Arranca en:** pestaña 2, `/developer/project/<nuevo>`.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00 | Clic en **"Contracts"**. | — |
| 0:01–0:08 | **Quieto**, el mouse sobre las tres tarjetas. | "Contracts 1", "Agreed amount", "Anchored 1". |
| 0:09–0:25 | **Quieto**, el mouse sobre la fila. | "Unit 5A · US$ 185,000", "Signed on …", **"Recorded on chain"** y el txid. |

Los tres StatCard son hechos del registro, no un flujo de pagos — D-070.

### Acto 5 · El cierre: dossier y escribano (T23-T27, ≈2 min)

**Volvemos a `torre-volumen-3`, unidad 1A** — la entregada. Un dossier final solo significa algo
sobre una obra terminada.

#### T23 · El dossier — 40 s

**Arranca en:** pestaña 1, `/investor/units`.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00 | Clic en la **1A** (Torre Volumen 3). | Su detalle. |
| 0:01–0:03 | Scroll hasta el final y clic en **"Dossier"**. | — |
| 0:04–0:12 | **Quieto.** | "Share", "Export PDF"; **"Cryptographic certification"** con su texto y el **"Dossier hash"** con badge "Pending" (todavía no lo firmó nadie). |
| 0:13–0:18 | Scroll lento. | "My unit progress" y "Dossier completeness" con su barra. |
| 0:19–0:22 | Scroll. | "Project and unit", "Compiled on …". |
| 0:23–0:40 | Scroll lento por **"Artifacts"**. | Cada ítem con su hash y su badge. |

*(Esta lectura es la que compila y persiste el dossier: antes de abrirlo, la cola del escribano
está vacía. M2-D1 describe tres secciones separadas; la implementación las unifica en `Artifacts`,
una sola lista canónica, porque el orden es parte del compromiso — `domain/dossier.ts:23`.)*

#### T24 · Compartir — 15 s

**Arranca en:** el dossier de 1A, arriba de todo.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00 | Clic en **"Share"**. | El modal "Share dossier". |
| 0:01–0:09 | **Quieto.** | "Read-only link. Whoever has it sees the hashes, not the platform." y el "Link". |
| 0:10 | Clic en **"Copy"** del link. | "Copied". |
| 0:11–0:15 | **Quieto**, y cerrá con **"Close"**. | — |

Fuera de cámara: **pegá el link en una nota** — lo usás en T27. No aprietes "Open view": abriría la
vista con esta misma ventana.

#### T25 · La firma — 35 s · ⚠ irrepetible

**Arranca en:** pestaña 4, `/notary`. Recargá antes de grabar.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00–0:05 | **Quieto.** | "Notary panel": "Pending dossiers 1", "Verified", "Signed", "Units under review"; abajo, "Dossiers pending review" con la 1A. |
| 0:06 | Clic en **"Dossiers"** en la barra lateral. | "Dossiers · Pending review and signing". |
| 0:07–0:09 | **Quieto.** | — |
| 0:10 | Clic en el dossier de la 1A. | "Dossier review". |
| 0:11–0:20 | **Quieto**, scroll lento. | Pill "Pending", "Dossier hash", "Dossier artifacts". |
| 0:21–0:26 | **Quieto** sobre el texto de abajo. | "Signing records that you reviewed these hashes at this moment. It does not certify…" |
| 0:27 | Clic en **"Verify and sign"**. | "Signing…" |
| 0:28–0:35 | **Quieto.** | — |

**⏸ CORTE ~1 min.**

#### T26 · El historial — 15 s

**Arranca en:** "Dossier review" de la 1A, ya firmado.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00–0:04 | **Quieto.** | Pill "Signed" y el **"Signature TXID"**. |
| 0:05 | Clic en **"Signed"** en la barra lateral. | "Signed dossiers · Signature history". |
| 0:06–0:15 | **Quieto**, el mouse sobre la primera fila. | El hash del dossier y el txid de la firma. |

#### T27 · Verificado sin cuenta — 25 s

**Arranca en:** una **ventana de incógnito** (`Cmd+Shift+N`) con el link de T24 ya cargado, zoom en
110% y en pantalla completa (`Cmd+Ctrl+F`), igual que la otra. **Es el plano más fuerte del producto
entero**: tiene que verse que no hay sesión — sin barra lateral, sin campana, sin perfil.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00–0:06 | **Quieto.** | "Public dossier", solo el toggle de idioma en el header. |
| 0:07–0:14 | **Quieto**, el mouse sobre el hash. | "Dossier hash" con el badge **"Signed"**. |
| 0:15–0:25 | Scroll lento. | La barra de avance, los hashes y el texto "This dossier records hashes and timestamps. It does not certify…". |

Al terminar, **cerrá la ventana de incógnito entera**.

### Acto 6 · La auditoría y el resto de las superficies (T28-T31, ≈3½ min)

#### T28 · El círculo se cierra — 45 s

**Arranca en:** pestaña 2, `/developer`.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00 | Clic en **"Audit log"**. | "Audit log · Events anchored on-chain". |
| 0:01–0:20 | Scroll lento. | Los eventos de los Actos 2 a 5, cada uno con su rol, su categoría y su txid: "Signed the dossier", "Certified the stage", "Changed the stage state", "Observed the stage", "Uploaded and anchored stage evidence", "Accepted the invitation", "Sent an invitation", "Agreed to certify the project", "Created the project". |
| 0:21 | Clic en el filtro **"stage"**. | Solo los de etapa. |
| 0:22–0:25 | **Quieto.** | — |
| 0:26 | Clic en **"signature"**. | La firma. |
| 0:27–0:30 | **Quieto**, y clic en **"All"**. | — |
| 0:31 | Clic en el **txid** de un evento. | "Blockchain verification", "Anchoring date", "View in explorer". |
| 0:32–0:43 | **Quieto.** | — |
| 0:44 | Cerrá (`Esc`). | — |

**Este es el cierre narrativo del video: todo lo que hiciste, indexado y anclado.**

#### T29 · El resto del developer — 75 s

**Arranca en:** `/developer` (fuera de cámara: "Panel" en la barra lateral).

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00 | Clic en **"Documentation"**. | "Documentation": "Verified on blockchain", "Pending verification", y la lista "Verified documents". |
| 0:01–0:14 | Scroll lento. | Cada documento con su hash y su badge. |
| 0:15 | Clic en **"Back to panel"** y en **"Investors"**. | "Investors · … registered investors". |
| 0:16–0:29 | **Quieto**, scroll lento. | Las cards de inversores, con sus unidades y su inversión. |
| 0:30 | Clic en **"Capital"** en la barra lateral. | "Capital raised": "Total raised", "Monthly evolution", "By project". |
| 0:31–0:45 | Scroll lento. | Las barras por mes y el reparto por proyecto. |
| 0:46 | Clic en **"Units"**. | "Units · … total units, … sold", la ocupación por proyecto. |
| 0:47–0:59 | Scroll lento. | — |
| 1:00 | Clic en **"Progress"**. | "Construction progress": "Completed", "In progress", "Pending"; las timelines. |
| 1:01–1:15 | Scroll lento. | Torre Núñez con su primera etapa ya completa. |

#### T30 · Perfiles y menú — 60 s

**Arranca en:** pestaña 2, `/developer/progress` (donde terminó T29).

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00 | Clic en el **ícono de perfil** del header. | "Profile" del developer: nombre, "Role", "Notification preferences". |
| 0:01–0:12 | **Quieto**, el mouse sobre las preferencias. | "Stage progress", "New documents", "Releases", "Notary signatures", "Certifications". |
| 0:13 | `Cmd+3` y clic en **"Profile"** en la barra lateral. | El perfil del certifier. |
| 0:14–0:25 | **Quieto.** | Su nombre y "Role: Certifier". |
| 0:26 | `Cmd+4` y clic en **"Profile"**. | El perfil del escribano. |
| 0:27–0:38 | **Quieto.** | "Role: Notary". |
| 0:39 | `Cmd+1` y clic en **"User"** en la barra lateral. | "Profile · Account & preferences" del investor. |
| 0:40–0:49 | Apagá y volvé a prender una preferencia. | El toggle cambiando. |
| 0:50 | Clic en **"Menu"**. | "Menu · Everything yours, in one place". |
| 0:51–1:00 | **Quieto**, el mouse por las cuatro entradas. | "Browse developments", "Your units and their progress", "Projects you saved", "Updates from your developments". |

**Ojo con los atajos:** acá se salta de pestaña con `Cmd+3`, `Cmd+4`, `Cmd+1` y no con
`Cmd+Opt+→`, que desde la 4 te llevaría a la 5 (el admin, que no sale en el video).

#### T31 · Responsive — 30 s

**Arranca en:** pestaña 1, `/investor/menu`, con DevTools abiertas (`Cmd+Opt+I`) y la Device
Toolbar (`Cmd+Shift+M`) en un preset de iPhone o Pixel. **Encuadre — la única toma que no es
pantalla completa:** en `Shift+Cmd+5` elegí **Grabar porción seleccionada** y arrastrá el recuadro
justo sobre el teléfono emulado, sin el panel de DevTools. El montaje la centra sola sobre fondo
blanco.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00–0:05 | **Quieto.** | El menú en ancho de teléfono y, abajo, la **BottomNav de 5 solapas** con "Buy" al centro. |
| 0:06 | Tap en **"Buy"**. | El listado en una columna. |
| 0:07–0:14 | Scroll lento. | — |
| 0:15 | Tap en **"Units"**, y en la 5A. | El detalle de la unidad en una columna. |
| 0:16–0:30 | Scroll lento. | — |

**Cobertura:** las 31 tomas recorren **todas las rutas** de `apps/web/src/routes` salvo `/admin`,
que se usa fuera de cámara (§6).

---

## 5. Montaje — para quien arma el archivo final

**No hace falta saber editar video.** Son tres pasos: recortar, revisar que estén todos los archivos,
y pegar un comando en la Terminal.

### 5.1 Una sola vez: instalar `ffmpeg`

Abrí **Terminal** (Cmd+Espacio → escribí "Terminal" → Enter) y pegá:

```bash
ffmpeg -version
```

Si responde con texto que empieza por `ffmpeg version`, ya está: pasá al §5.2. **En esta Mac ya está
instalado** (ffmpeg 8.0.1, por Homebrew), y el comando del §5.4 se probó acá el 2026-09-21.

**Solo si el montaje se hace en otra Mac** y dice `command not found`: pegá esto entero. Baja ffmpeg
ya compilado desde evermeet.cx, sin Homebrew; sirve para Mac Intel y, vía Rosetta, para Apple Silicon.

```bash
mkdir -p ~/bin && cd ~/bin \
  && curl -L -o ffmpeg.zip https://evermeet.cx/ffmpeg/getrelease/zip \
  && curl -L -o ffprobe.zip https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip \
  && unzip -o ffmpeg.zip && unzip -o ffprobe.zip && rm ffmpeg.zip ffprobe.zip \
  && echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zprofile \
  && export PATH="$HOME/bin:$PATH" && ffmpeg -version | head -1
```

Tiene que terminar mostrando `ffmpeg version …`.

### 5.2 Recortar cada video, en QuickTime

Por cada `Txx.mov`: abrirlo con doble clic → **Cmd+T** (Recortar) → arrastrar las puntas amarillas
para sacar lo que sobra al principio y al final (el clic en "detener grabación", esperas, spinners)
→ **Recortar** → **Cmd+S**. No re-encodea: es instantáneo.

**Dónde cortar:** el principio va justo antes de la primera acción de la tabla del §4 (el 0:00 de
la toma), porque todos los tiempos —los de la pantalla y los de la voz— se cuentan desde ahí. El
video debería quedar cerca de su **Video** del §3.1. Si quedó mucho más largo, casi siempre es una
espera que se puede sacar.

### 5.3 Revisar la carpeta antes de unir

En `~/Movies/propnexus-walkthrough/` tiene que haber, **con estos nombres exactos**:

- `T01.mov` … `T31.mov` — los 31 videos (los hace quien graba la pantalla)
- `T01.m4a` … `T31.m4a` — los 31 audios (los hace quien graba la voz)

Dos ceros a la izquierda (`T01`, no `T1`), T mayúscula, sin espacios ni texto extra. Si un audio
falta, el script no se frena: esa toma sale muda y te avisa.

### 5.4 Unir todo — un solo comando

Pegá esto entero en la Terminal y Enter:

```bash
CARPETA="${CARPETA:-$HOME/Movies/propnexus-walkthrough}"
cd "$CARPETA" || { echo "No existe la carpeta $CARPETA"; exit 1; }
mkdir -p unidas
if ffmpeg -hide_banner -encoders 2>/dev/null | grep -q h264_videotoolbox; then
  codec=(-c:v h264_videotoolbox -b:v 10M)
else
  codec=(-c:v libx264 -preset veryfast -crf 20)
fi
for video in T[0-9][0-9].mov; do
  toma="${video%.mov}"
  dv=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$video")
  if [ -f "$toma.m4a" ]; then
    da=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$toma.m4a")
    audio=(-i "$toma.m4a")
    voz="silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,adelay=1000:all=1,"
  else
    echo "  (aviso) $toma no tiene audio: va en silencio"
    da=0
    audio=(-f lavfi -i anullsrc=r=48000:cl=stereo)
    voz=""
  fi
  dur=$(awk -v a="$dv" -v b="$da" 'BEGIN { m = (a > b ? a : b); printf "%.2f", m + 0.5 }')
  echo "$toma: video ${dv%.*} s, audio ${da%.*} s -> queda en ${dur%.*} s"
  ffmpeg -y -loglevel error -i "$video" "${audio[@]}" -filter_complex \
    "[0:v]scale=1920:1200:force_original_aspect_ratio=decrease,pad=1920:1200:(ow-iw)/2:(oh-ih)/2:color=white,fps=30,format=yuv420p,tpad=stop_mode=clone:stop_duration=600[v];[1:a]${voz}aresample=48000,aformat=channel_layouts=stereo,apad[a]" \
    -map "[v]" -map "[a]" -t "$dur" \
    "${codec[@]}" -c:a aac -b:a 192k "unidas/$toma.mp4" \
    || { echo "FALLÓ $toma — mandale este mensaje a quien te pasó el guion"; exit 1; }
done
printf "file '%s'\n" "$PWD"/unidas/T[0-9][0-9].mp4 > unidas/lista.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i unidas/lista.txt -c copy walkthrough-final.mp4 \
  && echo "LISTO: $PWD/walkthrough-final.mp4"
```

Va a mostrar una línea por toma (`T01: video 24 s, audio 16 s -> queda en 24 s`) y al final
**`LISTO: …/walkthrough-final.mp4`**. En esta Mac son unos minutos: re-encodea cada toma una vez, para que todas queden del mismo tamaño (1920×1200) antes de pegarlas. Dejá la Mac enchufada.

**Qué hace, para que sepas qué esperar:**
- **Hace entrar la voz en el segundo 0:01 de cada toma:** recorta el silencio del principio de cada
  audio y le agrega un segundo exacto. Por eso quien graba la voz no tiene que arrancar audio y
  video al mismo tiempo (§8.0). *(Probado el 2026-09-28 con un audio de 2,3 s de silencio antes del
  sonido: el sonido quedó en 0:01,1.)*
- Une el video y el audio de cada toma. Dura **lo que dure el más largo de los dos**: si la voz es
  más larga, la imagen se queda quieta en el último cuadro hasta que termina; si es más corta, el
  resto va en silencio.
- Deja cada toma unida en la subcarpeta `unidas/` (útil para revisar una sola).
- Pega las 31 **en el orden de los nombres** y deja `walkthrough-final.mp4` en la carpeta.

**Si rehacés una toma** (video o audio), reemplazá el archivo y volvé a pegar el mismo comando: rehace
todo desde cero.

**Si aparece `FALLÓ Txx`**, lo más probable es que ese `.mov` o `.m4a` esté dañado o a medio
guardar: abrilo en QuickTime para ver si reproduce. Si reproduce y sigue fallando, mandá la salida
de la Terminal a quien te pasó el guion.

### 5.5 Revisar el resultado

Abrí `walkthrough-final.mp4` y miralo entero una vez: que las tomas estén en orden, que la voz
corresponda a la pantalla, y que ninguna muestre una contraseña o una pantalla de error.

**iMovie solo si hace falta agregar títulos o transiciones**, y al final: re-renderiza todo y tarda bastante
más que el comando de arriba.

---

## 6. Lo que el video no muestra, y por qué

Vale tenerlo escrito antes del voice-over, para no prometer en audio algo que la pantalla no hace:

- **Lo que la versión del 2026-09-21 prometía y la app no hace** (verificado contra el código el
  2026-09-28, y ya sacado del §4 y del §8 — no lo vuelvas a poner):
  - la invitación **no tiene campo de nombre**: es email, unidad y monto (T11);
  - el alta de proyecto **no tiene vista previa de mapa** (T08);
  - el detalle de etapa **no muestra GPS ni hora de captura** de las fotos (T05);
  - el contrato del investor **no muestra hash**: total, fecha de firma y el cronograma (T14); el
    txid del contrato está del lado del developer (T22);
  - "Observed stages" del developer **no muestra la nota del certifier** (T19);
  - los perfiles **no muestran credenciales** del escribano ni del certifier: nombre, rol y
    preferencias (T30);
  - el detalle del proyecto del developer **no lista las etapas**: las diez `Pending` se ven en
    "Progress" (T09);
  - las novedades de la unidad **no abren el modal de la etapa**: llevan al detalle de la unidad, y
    el modal sale de "Evidence by stage" (T17);
  - el KPI del panel del developer cuenta **documentos anclados**, no eventos (T07).

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
- **La pantalla del admin (`/admin`) no sale en el video.** El admin es la salvaguarda (D-095), no
  uno de los cuatro roles del SOM; se usa fuera de cámara para invitar al certifier (§1.4). No lo
  menciones en el audio.
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
- [ ] Salir de pantalla completa (`Cmd+Ctrl+F`) y volver a tildar Ver → "Mostrar siempre la barra de
      herramientas…", si la usabas.
- [ ] Mover el crudo fuera del disco principal o borrarlo (son varios GB). **Antes, guardar
      `walkthrough-final.mp4`**, y la carpeta `unidas/` si puede hacer falta rehacer una toma.
- [ ] Parar el keep-alive (§1.5.2) con `Ctrl-C`.
- [ ] Marcar 3.12 en `CLAUDE.md` §Lo que queda del plan y el criterio 13 en `specs/README.md`, en el
      mismo commit que publique el video.

---

## 8. Voice-over script (English) — para quien graba la voz

> **Una grabación por toma, con el nombre de la toma:** `T01.m4a`, `T02.m4a`… hasta `T31.m4a`. No
> importa en qué orden las grabes: el montaje las ordena por el nombre.
>
> **Los tiempos son los mismos del §4**, contados desde el 0:00 de la toma recortada. La primera
> frase de cada toma entra siempre en **0:01**: el montaje recorta el silencio del principio de tu
> grabación y la hace caer ahí, así que no importa cuánto tardaste en empezar a hablar. Las frases
> siguientes van **en el momento que dice su tiempo** — para eso grabás mirando el video (§8.0).
>
> **El registro es técnico y de UX, no de producto.** Quien lo va a escuchar ya conoce el proyecto:
> cada línea describe qué hace la pantalla, qué escribe y qué se ancla — no qué problema resuelve la
> plataforma. **Dos reglas al editarlo:** no afirmar nada fuera de D-026 (la plataforma no
> certifica, no valida y no decide), y **"stage", nunca "milestone"** para una etapa de obra (D-067).
> **Y una tercera, que es la que se había roto:** no nombrar nada que la pantalla no muestre. Cada
> frase de abajo está chequeada contra el código de su pantalla (2026-09-28).

### 8.0 Cómo grabar la voz, paso a paso

1. **Lugar:** una habitación chica y con muebles (el eco de un ambiente vacío se nota). Ventanas
   cerradas, aire y ventilador apagados.
2. **Micrófono:** unos auriculares con micrófono (los de celular sirven) suenan mejor que el
   micrófono de la notebook. Enchufalos antes de abrir QuickTime.
3. Abrí **QuickTime Player** → menú **Archivo → Nueva grabación de audio**. Al lado del botón rojo
   hay una flechita **⌄**: elegí ahí el micrófono de los auriculares y **Calidad: Máxima**.
4. Abrí también **la toma que vas a narrar** (`T05.mov`, ya recortada) en otra ventana de
   QuickTime, **con el volumen en cero**, y dejala en 0:00. Poné las dos ventanas una al lado de la
   otra.
5. Por cada toma:
   1. Botón rojo de la grabación de audio.
   2. Play en el video (barra espaciadora, con la ventana del video al frente).
   3. Cuando el contador del video marca **0:01**, leé la primera frase.
   4. Cada frase siguiente, cuando el contador llega a su tiempo (o cuando ves lo que dice
      "Entra cuando ves", que es lo mismo y a veces más fácil de seguir).
   5. Cuando termina el video, stop en el audio.
6. **Archivo → Guardar…** → nombre **exacto** `T05` (QuickTime agrega `.m4a` solo) → en la carpeta
   `~/Movies/propnexus-walkthrough/` → Guardar.
7. Si te equivocás, grabá la toma entera otra vez y guardala con el mismo nombre, reemplazando la
   anterior. No hace falta editar nada.

**No hace falta sincronizar el arranque:** el silencio antes de la primera frase se recorta solo.
Lo que sí importa es **la distancia entre frases**, y esa sale bien si leés mirando el video.

**Ritmo:** leé más lento de lo que te parece natural. Cada frase tiene lugar de sobra hasta la
siguiente; si terminás antes, está bien. **No respires fuerte ni hagas ruido antes de la primera
frase:** el recorte del silencio lo tomaría como el comienzo.

### Acto 1 · Investor (T01–T06)

#### T01 · Login, y el cambio de idioma — video 22 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | El login en castellano | PropNexus opens in Spanish, the default locale. |
| 0:05 | La pantalla pasa a inglés | The language toggle lives on the login screen itself. Both dictionaries are complete, so the whole interface switches. |
| 0:14 | Se tipea la contraseña | We sign in as the investor. |

#### T02 · Buy — video 35 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | Las tres cards | The investor's listing. Every list here is scoped by project membership: users only see the projects they belong to. |
| 0:13 | El campo de búsqueda | Search by area, filter by status… |
| 0:21 | El mapa | …or switch to the map. It's the same scoped set in every view. |

#### T03 · El proyecto por dentro — video 45 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | La portada | Project detail: gallery, estimated completion, and the location on a full-screen map. |
| 0:18 | Los documentos | The documentation section: every file with its own SHA-256 fingerprint and its anchoring badge. |
| 0:28 | "View developer" y la timeline | Then, who builds it, and how far along it is. |

#### T04 · Quién construye — video 40 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Grupo Alpine" | The developer behind it. |
| 0:08 | Las cuatro tarjetas | None of these four numbers is a stored column. Projects delivered, units sold and buyers are counted from the records; years in business is derived from the founding year. |
| 0:23 | "Previous projects" | Only the name, the bio and that year are declared. Each project card aggregates its own units for the starting price and the size range. |

#### T05 · Hasta la prueba — video 45 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | La lista de etapas | Ten stages, all ten completed, each with its own on-chain record. |
| 0:12 | El badge "Verified" | Inside a stage, the badge is backed by the transaction of its current state. |
| 0:19 | Los hashes de los archivos | Every file shows its SHA-256. |
| 0:26 | El modal de la etapa | The stage milestone groups them under the Merkle root of the bundle they were anchored in, with each file's path to that root. |
| 0:37 | "Blockchain verification" | And the transaction behind it, with its anchoring date. |

#### T06 · Favoritos — video 10 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "My favorites" | Favorites: the project saved a minute ago, one click away. |

### Acto 2 · Developer (T07–T11)

#### T07 · El panel — video 30 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Developer panel" | Now the developer. |
| 0:04 | Los KPIs | These counters — projects, capital, units, progress, and documents anchored on chain — are aggregates over the same membership-scoped queries. |
| 0:20 | "My projects" | And the developer's projects. |

#### T08 · Proyecto nuevo — video 36 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | El formulario vacío | A new project: name, location, units, delivery date, and the standard ten-stage template. |
| 0:08 | Se tipea la ubicación | Creating it writes the ten stages in a single database transaction, then mints one on-chain thread per stage, one at a time. The validator rejects more than one thread per transaction, so they can't be batched. |
| 0:31 | El clic en "Create project" | That's why this step takes a few minutes. |

#### T09 · El proyecto ya creado — video 30 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Torre Núñez" | The new project, at zero percent. |
| 0:05 | Las cuatro acciones | Four actions: units, invitations, evidence, and contracts. |
| 0:18 | Las diez etapas "Pending" | Its ten stages already exist, all pending. Their order, and the moment they were declared, were anchored before any work began. |

#### T10 · Unidades — video 32 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | Los contadores en cero | Unit inventory, starting empty. |
| 0:05 | Se tipea "5A" | We add unit 5A: its floor and its surface. |
| 0:21 | La card de la 5A | It appears available and unassigned, and the counters follow. |

#### T11 · La invitación — video 25 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Invite investor" | The invitation: the buyer's email, the unit, and the amount. |
| 0:17 | El clic en "Send invitation" | Sending it reserves the unit for that buyer. |

### Acto 3 · Investor (T12–T14)

#### T12 · Aceptar — video 35 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | La campana | Back to the investor. The invitation arrives as a notification, pinned at the top. |
| 0:11 | El modal | Project, unit, total amount, estimated handover — and the invitation itself is anchored on-chain. |
| 0:24 | El clic en "Accept invitation" | Accepting it is what writes the contract. |

#### T13 · El portfolio — video 35 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "My units" | The portfolio now holds units in two very different situations: six in a delivered building, and one just bought off-plan. |
| 0:14 | El mapa | Inside the new one: its location… |
| 0:19 | El esquema del edificio | …and the building schematic, with this unit highlighted on its floor. It's labelled as a reference view: the final plans live in the dossier. |

#### T14 · El contrato como registro — video 25 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Contract summary" | The contract screen is a record, not an action surface: the agreed amount and the signing date. |
| 0:13 | "No releases recorded yet." | No release button, by design. Payments happen outside the platform, which never holds funds. |

### Acto 4 · La FSM (T15–T22)

#### T15 · Subir evidencia — video 40 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Upload evidence" | Evidence upload, against a stage that is still pending. |
| 0:09 | El selector de archivos | The file type is checked from its first bytes, not from the content type the browser declares. |
| 0:28 | El clic en "Anchor evidence" | And there's no separate start button: the first evidence on a pending stage is the transition to in progress. |

#### T16 · La prueba, y afuera de la app — video 26 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Evidence anchored" | The files are hashed, combined into a Merkle root, and that root goes into a Cardano transaction. |
| 0:13 | Cardanoscan | Here it is on a public explorer, outside PropNexus. |

#### T17 · El mismo anclaje, del otro lado — video 35 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Unit updates" | The same upload, from the investor's side: the update arrives on the unit. |
| 0:14 | El modal de la etapa | Every file's hash, and the package Merkle root — the same number the developer just saw. One role produces it; another can check it. |

#### T18 · Observar — video 40 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Certifier panel" | The certifier. The new stage has just entered the queue, because work on it started. |
| 0:13 | "Evidence uploaded by the developer" | Inside, the evidence the developer uploaded, file by file, with its hash. |
| 0:24 | El modal "Observe stage" | Observing sends the stage back with a note. That transition is anchored too. |

#### T19 · Reanudar — video 20 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Observed stages" | The developer sees the stage come back as observed. |
| 0:09 | El clic en "Resume stage" | Resuming is a deliberate action: it's the one transition the backend never fires on its own. |

#### T20 · Certificar — video 20 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | La pill "In progress" | The stage is back in progress. |
| 0:05 | El clic en "Certify" | Certifying closes it. Four transitions, each one recorded on-chain. |

#### T21 · El certificado — video 15 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | La pill "Certified" | Certified. |
| 0:04 | "Issued certificates" | Each certificate, with its hash and the transaction that anchors it. |

#### T22 · El contrato del lado del developer — video 25 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | Las tres tarjetas | The same contract, from the developer's side. |
| 0:09 | La fila de la 5A | Which unit, how much, when it was signed, and the transaction that records it. These counters are facts from the registry, not a payment flow. |

### Acto 5 · Dossier y escribano (T23–T27)

#### T23 · El dossier — video 40 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | El detalle de la 1A | Back to the delivered building: unit 1A, and its dossier. |
| 0:06 | "Cryptographic certification" | It records hashes and timestamps. It doesn't certify the construction. |
| 0:13 | La barra de avance | The dossier is compiled on read: its hash is computed at fetch time, over every anchored artifact listed below, in a fixed order. If anything it commits to changed, the hash would change with it. |

#### T24 · Compartir — video 15 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Share dossier" | Sharing generates a read-only link with its own token. Whoever has it sees the hashes, not the platform. |

#### T25 · La firma — video 35 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Notary panel" | The notary. Opening the dossier is what put it in this queue. |
| 0:11 | "Dossier review" | The review shows the same dossier hash, and its artifacts. |
| 0:21 | El texto de abajo | The disclaimer says what a signature means: that these hashes were reviewed at this moment — not that the documents are authentic. |

#### T26 · El historial — video 15 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Signature TXID" | Once signed, the hash is frozen, and the signature has its own transaction. |
| 0:08 | "Signed dossiers" | The notary's history: each dossier hash next to the transaction of its signature. |

#### T27 · Verificado sin cuenta — video 25 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Public dossier" | The public route takes that token and nothing else: a private window, no account, no session. |
| 0:09 | El badge "Signed" | Anyone with the link — a bank, another notary — sees the dossier hash and the notary's signature, without being a user of the platform. |

### Acto 6 · Auditoría y resto (T28–T31)

#### T28 · El círculo se cierra — video 45 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Audit log" | The audit log. Every step in this video is here: the project, the invitation, the evidence, the observation, the certification, the signature. |
| 0:14 | La lista, bajando | Each one with its actor, role, category and timestamp. |
| 0:21 | El filtro "stage" | Filterable by category… |
| 0:32 | "Blockchain verification" | …and each transaction opens with its anchoring date and a link to the public explorer. |

#### T29 · El resto del developer — video 75 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Documentation" | The rest of the developer's surface. Supporting documentation, each file with its anchoring status. |
| 0:16 | "Investors" | The investor directory, with each investor's units and amount. |
| 0:31 | "Capital raised" | Capital raised, month by month and by project — as recorded in the contracts, not as funds held. |
| 0:47 | "Units" | The unit inventory, and its occupancy. |
| 1:01 | "Construction progress" | And construction progress, across every development. |

#### T30 · Perfiles y menú — video 60 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | El perfil del developer | Each role has its own profile, with notification preferences by category. |
| 0:14 | El perfil del certifier | The certifier… |
| 0:27 | El perfil del escribano | …the notary… |
| 0:40 | El perfil del investor | …and the investor. |
| 0:51 | "Menu" | Plus a menu that gathers the investor's sections in one place. |

#### T31 · Responsive — video 30 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | El teléfono emulado | The design is mobile-first. At phone width, the sidebar becomes a bottom navigation bar, with Buy in the middle. |
| 0:15 | El detalle de la unidad | Every screen in this video works in a single column. |
