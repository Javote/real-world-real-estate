# Runbook — grabar el video walkthrough

> Cubre el ítem **3.12** de `CLAUDE.md` §Lo que queda del plan y el **criterio 13** del SOM
> (`specs/README.md`). Es una grabación **manual**: pantalla primero, voz después, y un comando que
> une todo. **Se sigue de arriba hacia abajo, sin saltear pasos.** Cada casilla `[ ]` es algo que se
> hace y se tilda.
>
> Las tomas y la narración están verificadas contra el código de cada pantalla, y el estado de
> producción con `verificar-produccion.mjs` (2026-09-28). Las herramientas que hacen el trabajo
> repetitivo están en `scripts/video-walkthrough/`. El
> porqué de cada decisión, el estado de la base y lo que el video no muestra están en los
> **Anexos**, al final: **no hace falta leerlos para grabar.**

---

## El plan en una pantalla

| Paso | Qué | Con qué | Cuánto |
|---|---|---|---|
| **0** | Preparar la Mac, los archivos y chequear producción. **Una sola vez** | `preparar.sh` — **ya corrido en esta Mac el 2026-09-28** | ~5 min |
| **1** | Antes de cada sesión: la Mac, Render despierto, Chrome con las 5 pestañas | `sesion.sh` + `chrome.sh` | ~10 min (+ ensayo la primera vez) |
| **2A** | Grabar la **sesión A**: el comprador mirando una obra terminada (T01, una sola toma) | el grabador de macOS; al final, `renombrar.sh A` | ~5 min |
| **2B** | Grabar la **sesión B**: nace un proyecto y recorre la FSM, hasta la firma, y cierra en el audit log (T07–T28). **De corrido, sin cortar la sesión** | ídem; al final, `renombrar.sh B` | ~60 min |
| **3** | Recortar los 9 videos | QuickTime | ~30 min |
| **4** | Grabar la voz mirando cada video, con la frase en pantalla en su segundo | el **estudio** (una página local) | ~35 min |
| **5** | Unir todo, con subtítulos | `unir.sh` (o el estudio, si no hay ffmpeg) | ~10 min |
| **6** | Mirar el resultado y cerrar | — | ~25 min |

**Todas las herramientas están en [`scripts/video-walkthrough/`](../../scripts/video-walkthrough/README.md)**
y se corren desde la raíz del repo, en la Terminal (Cmd+Espacio → "Terminal" → Enter):

```bash
cd ~/Documents/real-estate/real-world-real-estate
```

**Cuatro reglas que valen para todo el runbook:**

1. **La unidad es la toma, no el acto.** Son 9 tomas (la sesión A es una sola, T01; la B va de T07 a T28, con T07, T09, T12, T18 y T23 que funden varias de las originales); cada una es un video `Txx.mov` y una voz
   `Txx.webm` con el mismo nombre. Todos los tiempos se cuentan desde el **0:00 de la toma ya
   recortada**, así que rehacer una no corre nada del resto.
2. **La sesión B va de corrido y en orden.** Cada toma deja la base en el estado que necesita la
   siguiente. La A se puede grabar otro día, pero **siempre antes de la B**: la B le suma Torres
   de Palermo al investor, que después aparecería en "Buy" (T01).
3. **Los datos que se ven no tienen que coincidir exacto** con los de este documento. Lo que el
   video tiene que mostrar es que cada rol entra a sus pantallas y que una etapa recorre la FSM
   (Pending → InProgress → Observed → InProgress → Completed). Si un número es otro, se sigue.
4. **Los textos entre comillas** ("Anchor evidence", "Observe"…) son los botones en inglés que vas a
   ver en pantalla: sirven para encontrarlos, no hay que decirlos.

---

## Paso 0 · Una sola vez

### 0.1 Las contraseñas — lo hace el técnico

- [ ] Pasarle a quien graba, **en privado** (no por un canal grupal ni en este documento), las dos
      contraseñas: la de los cuatro roles (`SEED_DEMO_PASSWORD` de `apps/api/.env`, la misma para
      todos) y la del admin (`SEED_ADMIN_PASSWORD`).

| Rol | Usuario | Sale en cámara |
|---|---|---|
| Investor | `buyer@example.com` | Sí |
| Developer | `developer@example.com` | Sí |
| Certifier | `verifier@example.com` | Sí |
| Notary | `notary@example.com` | Sí |
| Admin | `admin@example.com` | **No** — solo para invitar al certifier en el corte de T07 |

La pantalla de login precarga el usuario de cada solapa pero **nunca la contraseña**: se tipea.

### 0.2 `preparar.sh` — ya corrido en esta Mac el 2026-09-28

```bash
bash scripts/video-walkthrough/preparar.sh
```

Crea `~/Movies/propnexus-walkthrough/` (donde cae todo) y `~/Movies/propnexus-evidencia/` con **los
tres archivos que se suben en T09** — `land-title-deed.pdf`, `site-survey-plan.jpg` y
`lot-location-map.png`, ficticios y marcados como tales, generados desde
`scripts/video-walkthrough/evidencia/`. **Al lado van las portadas** (D-099), que no genera el script:
`portada-proyecto-16-9.png` e `imagen-vertical-proyecto.png`, copiadas a mano desde `~/Pictures` el
2026-09-30. La horizontal (16:9) se adjunta en T07. Chequea 15 GB libres, Chrome, Node y ffmpeg, y corre el
verificador de producción (solo lectura: las cinco cuentas, lo que ve cada rol, el saldo de tADA).
Se puede volver a correr cuando quieras.

**Lo que dejó el 2026-09-28:** todo en verde, con un aviso esperable.

- **Las tres Torre Volumen tienen coordenadas de CABA** (Palermo, Belgrano, Colegiales), cargadas el
  2026-09-28 (D-097): el modo mapa de T01 muestra sus pines y los mapas de T01 y T12 se dibujan.
  Desde ese día todo proyecto nuevo nace con coordenadas: el alta las pide (T07).
- La cola del escribano está vacía: se llena en la pasada de calentamiento de la sesión B (1.3). Es
  lo esperado.

### 0.3 El grabador de macOS — una vez, a mano

- [ ] `Shift+Cmd+5` → **Opciones**:
  - [ ] **Temporizador:** ninguno.
  - [ ] **Micrófono:** ninguno.
  - [ ] **Mostrar clics del mouse: SÍ** ← los clics son lo que hace seguible el video.
- [ ] Modo: **Grabar toda la pantalla** (el ícono de pantalla con un círculo). Con Chrome en
      pantalla completa, toda la pantalla es la app.

Dónde se guarda no hace falta elegirlo: `sesion.sh` lo pone en la carpeta durante la sesión.

---

## Paso 1 · Antes de cada sesión

Se hace antes de la sesión A y antes de la B. Si grabás las dos seguidas, una vez.

### 1.1 `sesion.sh`, en una Terminal aparte, que queda abierta

- [ ] Abrí **una Terminal nueva** (`Cmd+N` en la Terminal) y corré:

  ```bash
  cd ~/Documents/real-estate/real-world-real-estate && bash scripts/video-walkthrough/sesion.sh
  ```

  Esconde los íconos del escritorio, hace que las grabaciones caigan en
  `~/Movies/propnexus-walkthrough/`, ofrece cerrar Mail, Mensajes, WhatsApp, Slack y compañía
  (contestá `s`), chequea cargador y disco, **despierta Render** (en frío tarda más de un minuto) y
  queda haciendo un ping cada 10 minutos para que no se vuelva a dormir entre tomas. **`Ctrl-C` al
  terminar la sesión** devuelve todo a como estaba.

  > **No es el keep-warm que prohíbe D-040.** Lo prohibido es un cron: mantiene los servicios
  > despiertos 24/7 (~1460 h contra las 750 del plan Free) y los suspende cerca del día 15. Esto es
  > un loop atendido que dura la sesión. **Nunca lo pases a `crontab` ni a GitHub Actions.**

- [ ] A mano, lo que ningún script puede hacer:
  - [ ] **No molestar ON** (Centro de control → Concentración → No molestar).
  - [ ] **Resolución "Predeterminada"** (Configuración del Sistema → Pantallas). En "Más espacio" el
        texto sale chico.
  - [ ] **Wi-Fi estable, sin VPN.**

### 1.2 `chrome.sh` — el Chrome de la grabación, con las 5 pestañas

```bash
bash scripts/video-walkthrough/chrome.sh
```

Abre un Chrome **aparte del de todos los días** (perfil "PropNexus Demo", sin extensiones, con el
guardado de contraseñas y el traductor apagados) y **cinco pestañas en `/login`**, cada una con su
propia sesión:

| Pestaña | Rol | Atajo |
|---|---|---|
| 1 | Investor | `Cmd+1` |
| 2 | Developer | `Cmd+2` |
| 3 | Certifier | `Cmd+3` |
| 4 | Notary | `Cmd+4` |
| 5 | Admin — **fuera de cámara** | `Cmd+5` |

- [ ] **Pestañas 2 a 5:** entrá con cada rol (elegí la solapa, tipeá la contraseña, "Ingresar" /
      "Sign in"). En la 5 no hay solapa: tipeá `admin@example.com`.
- [ ] **La primera vez:** `Cmd` + `+` una vez, para el zoom al 110% (queda guardado).
- [ ] **Pestaña 1:** entrá con `buyer@`, igual que las otras. El video arranca ya adentro (T01).
- [ ] **Las cinco en inglés:** en una cualquiera, toggle del header → **EN**, y recargá las otras
      (`Cmd+R`). El idioma se guarda en el navegador y lo comparten las cinco; la sesión sobrevive a
      la recarga.

**Dos reglas que no se rompen:**

1. **Nunca abras una pestaña con un clic desde otra**: hereda la sesión de esa otra, y vas a estar
   grabando al certifier con la sesión del developer sin enterarte. Si hace falta una, `Cmd+T`.
2. **El idioma no se cambia en cámara.** Todo el video va en inglés desde el primer cuadro; el
   toggle ES | EN queda a la vista en el header y lo menciona la voz de T01.

### 1.3 La pasada de calentamiento — menos de 15 min antes de la primera toma

- [ ] **Recorré a mano, sin grabar, las pantallas de las tomas de esta sesión**, con sus tablas del
      Paso 2 al lado. Despierta las pantallas, pone al día la reconciliación de lectura (D-077: sin
      esto, un TXID ya confirmado se ve "Pending") y es el ensayo de dónde está cada botón. **No
      hagas las acciones marcadas ⚠ irrepetible.**
- [ ] **Antes de la sesión B:** abrí una vez el dossier de la 1A (pestaña 1: `Units` → 1A →
      **"Dossier"**). Esa lectura lo compila y lo pone en la cola del escribano; sin eso, T23 no
      tiene qué firmar. Y corré otra vez el verificador:

  ```bash
  node scripts/video-walkthrough/verificar-produccion.mjs
  ```

- [ ] **La primera vez, un ensayo con las acciones** — la mejor inversión del día (~20 min y tADA de
      Preprod, que no es plata). **Solo T07, la unidad y la evidencia de T09, y T18**, sobre un proyecto llamado **`Ensayo`**:
  - crealo como en T07 e invitá al certifier como en su corte;
  - cargá una unidad, subí evidencia, observá, reanudá y certificá.
  - **No invites al investor (T09–T12) ni abras o firmes dossiers (T23–T27).** Una invitación
    aceptada le suma la unidad y el proyecto al investor para siempre (se verían en T01 y T12), y
    firmar el dossier de la 1A deja a T23 sin nada que firmar.
  - Queda un proyecto más en el listado del developer (T07) y una certificación más en el panel del
    certifier: no molestan.
- [ ] **Al terminar el recorrido, dejá la app en inglés** (toggle → EN) y la pestaña 1 en
      `/investor/buy`, arriba de todo: ahí arranca T01.

### 1.4 Pantalla completa

- [ ] Pestaña donde arranca la sesión (A: `Cmd+1`; B: `Cmd+2`) → `Cmd+Ctrl+F`. Chrome ocupa
      toda la pantalla: sin pestañas, sin barra de direcciones, sin Dock.
- [ ] **El mouse lejos del borde de arriba**: si lo toca, baja la barra de Chrome.

**Para escribir una dirección en pantalla completa** (siempre fuera de cámara): `Cmd+L` muestra la
barra un momento → pegás → Enter.

### 1.5 El ciclo de cada toma — cinco pasos, 9 veces

1. **Dejá la pantalla como dice "Antes de grabar"** de la toma. Si pasó más de un minuto desde la
   última acción en esa pestaña, **recargala** (`Cmd+R`) y esperá que cargue.
2. **`Shift+Cmd+5` → Grabar.**
3. **Hacé la tabla de la toma**, fila por fila. Los tiempos son el objetivo, no un cronómetro: ±2 s
   está bien.
4. **Parar: `Cmd+Ctrl+Esc`** (en pantalla completa el botón de stop queda escondido).
5. **Hacé lo que dice "Después"** de la toma, y tildala.

**No renombres nada durante la sesión.** Al terminarla, `renombrar.sh` les pone `T01` (A) o `T07`, `T09`… (B) a
todas de una vez, en el orden en que se grabaron. **Si repetiste una toma, no borres nada**: el
script ve que sobran grabaciones, te las lista con hora y duración, y vos le decís cuáles
descartar (van a `descartadas/`, no se borran).

### 1.6 Cómo moverse adentro de una toma

- **Los "quieto" no se negocian.** Son el lugar donde después entra la frase que explica lo que se
  ve. Contá en voz baja ("mil uno, mil dos…"): el micrófono está apagado.
- **Navegá con la app, no con la barra de direcciones.** En desktop cada rol tiene una **barra
  lateral** a la izquierda (Investor: Menu · Favorites · Buy · Units · User; Developer: Panel ·
  Projects · Capital · Units · Progress; Certifier y Notary: Panel · … · Profile) y el header tiene
  la campana y el ícono de perfil.
- **Una toma termina** cuando empieza una espera (**⏸ CORTE**), cuando pasás de ~90 s, o cuando
  cambiás de rol. Por eso la B son 8 (T07, T09, T12, T18 y T23 funden varias de las originales). La A no tiene esperas y es una sola (T01).

### 1.7 Las tomas irrepetibles, y qué hacer si una sale mal

**T07, T09, T12, T18 y T23** mandan algo a la cadena y dejan la base en otro estado:
no hay "otra toma" de esas.

- **Un error de tipeo o un clic de más:** seguí. Se arregla recortando o la voz lo tapa.
- **Un error que se ve en pantalla** (mensaje rojo, pantalla equivocada): pará la grabación,
  resolvé fuera de cámara, y grabá **la acción siguiente** como una toma aparte. **Renombrá esa
  segunda mitad enseguida** en Finder como `T18b.mov` (con la toma que corresponda), así
  `renombrar.sh` no la cuenta. En el Paso 3 las unís.
- **Algo que rompe la historia** (certificaste antes de observar, aceptaste en otra unidad): la
  única salida limpia es **un proyecto nuevo desde T07**, con otro nombre — otros ~6 min de mints y
  ~15 min de tomas.

---

## Paso 2 · Grabar la pantalla

**Cada toma:** "Antes de grabar", la tabla, y "Después". El ciclo del Paso 1.5 envuelve a todas.

**El mapa completo**, para ubicarse. *Empieza en* es dónde cae la toma en el video final (±15 s).

| Toma | Empieza en | Pestaña | Qué | Pantalla | Video | Voz | |
|---|---|---|---|---|---|---|---|
| T01 | 0:00 | 1 · Investor | La sesión A entera, en una toma | `/investor/buy` → … → `/investor/unit/<1A>` → `/investor/buy` | 213 s | 90 s | |
| T07 | 3:33 | 2 · Developer | El panel y el proyecto nuevo, en una toma | `/developer` → … → `/developer/project/new` | 180 s | 60 s | ⚠ irrepetible |
| T09 | 6:33 | 2 · Developer | El proyecto, la unidad, la invitación y la evidencia, en una toma | `/developer` → … → `/developer/project/:id/upload` → cardanoscan | 195 s | 75 s | ⚠ irrepetible |
| T12 | 9:48 | 1 · Investor | Aceptar, la unidad y el contrato, en una toma | campana → `/investor/unit/<5B>` → `…/contract` | 104 s | 45 s | ⚠ irrepetible |
| T18 | 11:32 | 3 → 2 → 3 | Observar, reanudar y certificar, en una toma | `/certifier/stage/:id` → `/developer/progress` → `/certifier/issued` | 87 s | 40 s | ⚠ irrepetible |
| T23 | 12:59 | 1 → 4 | El dossier, compartirlo y la firma, en una toma | `/investor/unit/<1A>/dossier` → `/public/dossier/…` → `/notary/dossier/:id` | 98 s | 45 s | ⚠ irrepetible |
| T27 | 14:37 | incógnito | Verificado sin cuenta | `/public/dossier/:shareToken` | 16 s | 18 s | |
| T22 | 14:53 | 2 · Developer | El contrato del lado del developer | `/developer/project/:id/contracts` | 24 s | 14 s | |
| T28 | 15:17 | 2 · Developer | El círculo se cierra | `/developer/audit-log` | 53 s | 21 s | |
| | **16:10** | | **Total** | | **970 s ≈ 16 min** | | |

### Sesión A · El comprador mira una obra terminada (T01)

Abre por el final del producto: **`torre-volumen-3`**, con sus 10 etapas certificadas. Es el
contraste contra el que después se entiende el proyecto que nace vacío.

- [ ] Paso 1 hecho. Las cinco pestañas logueadas y **en inglés**; la 1 en `/investor/buy`, arriba de
      todo. Pantalla completa.

#### T01 · La sesión A entera — 3:33 · ✓ grabada el 2026-10-01

**Decisión del dueño, 2026-10-01:** la sesión A dejó de ser seis tomas (T01–T06) y es **un solo
recorrido continuo**, grabado y elegido por él (`Grabación de pantalla 2026-10-01 a la(s) 12.14.05
a.m..mov`, 3:33). No tiene esperas on-chain, así que no hacía falta cortarla. T02–T06 ya no existen;
la sesión B conserva su numeración (T07–T28). La narración también es del dueño (4.3).

Lo que hace la toma, medido sobre el video (cuadros cada 3 s, ±3 s):

| Tiempo | Pantalla |
|---|---|
| 0:00 | "Buy", arriba de todo |
| 0:06 | La campana → "Updates" |
| 0:12 | "Profile", con el toggle ES \| EN |
| 0:24 | "Buy" otra vez |
| 0:30 | La pill **"Map"**: los pines y la card de cada Torre Volumen |
| 0:57 | La pill **"Search"**: `Buenos Aires` |
| 1:12 | La pill **"Filters"** |
| 1:18 | La lista de "Buy" |
| 1:27 | El corazón de Torre Volumen 3, y "My favorites" (1:30); se saca y queda vacío (1:36) |
| 1:42 | El detalle de Torre Volumen 3 |
| 1:51 | "Verified documentation", y el modal de un documento (2:00) |
| 2:09 | "Progress" y "View developer" |
| 2:12 | "Grupo Alpine": bio, las cuatro tarjetas, "Previous projects" (2:24) |
| 2:36 | De vuelta al detalle de la obra |
| 2:39 | **"Units"**: "My units" |
| 2:51 | El detalle de la **1A** |
| 3:03 | "Evidence by stage" → el modal **"Terminaciones"** (Merkle root, TXID) |
| 3:12 | "My contract and payments" |
| 3:21 | "Buy", "Profile" y "Buy" otra vez, hasta el final (3:33) |

**Fin de la sesión A.**

- [ ] `bash scripts/video-walkthrough/renombrar.sh A` → confirmá con `s`. Queda `T01.mov`.
- [ ] Si la sesión B no sigue ya: `Ctrl-C` en la Terminal de `sesion.sh` (Paso 6.1).

### Sesión B · Nace un proyecto, recorre la FSM, se firma el dossier y cierra en el audit log (T07–T28)

**De corrido, en orden, sin cortar la sesión.** Son ~60 minutos, de los cuales ~15 son esperas.

- [ ] Paso 1 hecho, **incluido el dossier de la 1A compilado** y el verificador en verde (1.3).
- [ ] Las cinco pestañas logueadas y en inglés (1.2). Pestaña 2 al frente, en `/developer`.
- [ ] Una nota abierta (Notas o TextEdit) para pegar el link de T23.

**La sesión B en bloques.** Un bloque es lo que va de corrido entre una espera de la cadena y la
siguiente (⛓ = manda algo a la cadena; ⚠ = irrepetible).

| Bloque | Tomas | Pestañas | Termina en |
|---|---|---|---|
| 1 | T07 ⛓⚠ | 2 | ⏸ ~6 min (los 10 mints). **Fuera de cámara:** 5 Admin invita al certifier, 3 acepta |
| 2 | T09 ⛓⚠ (unidad, invitación y evidencia) | 2 | ⏸ ~1-2 min adentro de la toma (la evidencia), cortada |
| 3 | T12 ⛓⚠ (aceptar, la unidad y el contrato) | 1 | — |
| 5 | T18 ⛓⚠ (observar, reanudar, certificar) | 3 → 2 → 3 | — (las esperas, cortadas) |
| 8 | T23 ⛓⚠ (el dossier, compartirlo y la firma) | 1 → 4 | — (la espera, cortada) |
| 9 | T27 → T22 · T28 | incógnito → 2 | Fin |

**Se puede grabar en tomas largas** (decisión del dueño, 2026-10-01, como la sesión A): una
grabación por bloque, sin parar en las esperas de ~1 min. **Parar solo en la espera de T07**: son
6 minutos y en ese rato sale el admin, que no va en cámara. Con tomas largas **no se corre
`renombrar.sh B`** (los archivos son menos que las tomas): se dejan con su nombre y se parten en
`T07.mov` … `T28.mov` mirando los cuadros, como se midió T01 — se le pide a Claude.

#### Acto 2 · Developer

##### T07 · El panel y el proyecto nuevo — 3:00 · ⚠ irrepetible · ✓ grabada el 2026-10-01

**Decisión del dueño, 2026-10-01:** como la sesión A, el bloque 1 se grabó de corrido y con su
propia narración (`Grabación de pantalla 2026-10-01 a la(s) 2.55.07 a.m..mov`, 3:00). Funde las
viejas T07 (el panel) y T07 (el alta), y el proyecto se llama **"Torres de Palermo"**, no "Torre
Núñez". **Se grabó sin pantalla completa** (se ven la barra de menú y las de Chrome).

Lo que hace la toma, medido sobre el video (cuadros cada 2 s, ±2 s):

| Tiempo | Pantalla |
|---|---|
| 0:00 | "Developer panel" |
| 0:06 | **"Projects"**: "My projects" y scroll por las tres Torre Volumen |
| 0:20 | **"Capital"**: "Capital raised", US$ 1,540,000, "By project" |
| 0:30 | **"Progress"**: "Construction progress", etapa por etapa |
| 0:46 | De vuelta en el panel: las tarjetas |
| 0:56 | **"Investors"**: "Buyer Demo" |
| 1:06 | **"Documentation"**: "Verified on blockchain", los documentos |
| 1:22 | De vuelta en el panel |
| 1:28 | **"Audit log"** |
| 1:44 | De vuelta en el panel → **"New project"** (1:52) |
| 1:54 | "Project name": `Torres de Palermo` |
| 2:00 | El mapa: el pin marcado (2:04) |
| 2:16 | "Number of units": 15 |
| 2:20 | "Stage template": las diez etapas |
| 2:26 | "Estimated delivery date": 28/02/2028 |
| 2:42 | "Cover image": el selector de macOS → `portada-proyecto-16-9.png` |
| 2:54 | Clic en **"Create project"**, y el botón cargando hasta el final (3:00) |

**⏸ CORTE ~6 min.** El request no vuelve hasta que los 10 mints terminaron: son secuenciales dentro
del handler (`developer.routes.ts:266`) y cada uno es su propia transacción (D-083 — el validador
rechaza acuñar más de un hilo por tx). **No cierres la pestaña ni la recargues.**

**Después — durante esos 6 minutos, fuera de cámara: invitar al certifier.** El proyecto nuevo nace
con una sola membresía, la del developer. Sin el certifier, su etapa no llega a la cola del
certifier y no hay Acto 4. (Al investor no hace falta sumarlo: lo suma la invitación de T09.)

1. **Esperá a que la pestaña 2 vuelva sola** al detalle de "Torres de Palermo": recién ahí el proyecto
   existe.
2. **`Cmd+5` (admin)** → recargá `/admin` (`Cmd+R`). El proyecto nuevo aparece **primero** en
   "Projects": confirmá que es "Torres de Palermo".
3. En **"Invite a certifier"**: elegí **Verifier Demo** → **"Invite"**. Tiene que aparecer
   "Invitation sent." y, abajo, la invitación como **"Pending"**.
4. **`Cmd+3` (certifier)** → recargá `/certifier`. Arriba aparece **"Invitations to certify"** con
   Torres de Palermo → **"Accept"**. La sección desaparece.
5. **`Cmd+5`** → recargá: en "Members", Verifier Demo figura como certifier.
6. **`Cmd+2`** para volver al developer, y seguí con T09.

- [ ] Certifier invitado y aceptado.

##### T09 · El proyecto, la unidad, la invitación y la evidencia — 3:15 · ⚠ irrepetible · ✓ grabada el 2026-10-01

**Decisión del dueño, 2026-10-01:** el bloque 2 se grabó de corrido y extendido: después de invitar
siguió con la evidencia, porque nada de eso espera a la cadena (aceptar solo pide la invitación
`pending` en la base). Funde las viejas T09, T10, T11, T15 y T16. **La unidad es la 5B, no la 5A:**
en la primera toma la invitación salió a `investor@example.com` —el placeholder del campo—, que no
es ninguna cuenta; la 5A quedó reservada a ese email y se regrabó el tramo con la 5B. T09 se armó
con tres pedazos (en `originales/`): la primera toma hasta 0:48, el tramo de la 5B (1:05) y la
primera toma desde la vuelta al detalle hasta el final.

Lo que hace la toma, medido sobre el video (cuadros cada 3 s, ±3 s):

| Tiempo | Pantalla |
|---|---|
| 0:00 | "Developer panel" |
| 0:06 | "My projects": Torres de Palermo, "Planning" |
| 0:12 | El detalle de Torres de Palermo: 0%, Capital —, Investors 0 |
| 0:21 | **"Progress"**: las tres Torre Volumen completas |
| 0:33 | Torres de Palermo: "Overall Progress 0%", las diez etapas "Pending" |
| 0:45 | "My projects" → el detalle (0:48) |
| 0:54 | **"Manage units"**: `5B`, piso 5, 85 m² → "Add" (1:06) |
| 1:09 | La 5B "Available", "Total 2" (la 5A, reservada, también se ve) |
| 1:21 | De vuelta al detalle → **"Invite investor"** (1:24) |
| 1:27 | `buyer@example.com`, la **5B** (1:33), `185000` (1:36) |
| 1:42 | Clic en **"Send invitation"** |
| 1:45 | "Manage units": la 5B "Reserved" |
| 1:54 | De vuelta al detalle → **"Upload evidence"** (2:01) |
| 2:04 | El chip **1**: "1. Adquisición del terreno" |
| 2:07 | El selector de macOS: los tres archivos (2:28 en la lista) |
| 2:34 | Clic en **"Anchor evidence"**: "Anchoring…" |
| 2:40 | El modal **"Evidence anchored"**: Merkle root y txid |
| 2:46 | **"View on explorer"** → cardanoscan, la transacción (2:52) |
| 3:01 | De vuelta en el modal → "Done" (3:10), hasta el final (3:15) |

#### Acto 3 · Investor

##### T12 · Aceptar, la unidad y el contrato — 1:44 · ⚠ irrepetible · ✓ grabada el 2026-10-01

**Grabada de corrido como `buyer@`** (pestaña 1): funde las viejas T12, T13 y T14. Se cortó al
final de "My contract and payments": lo que seguía era T17, y **"Evidence by stage" no respondió**
— los chips 1–10 no se pueden tocar aunque la etapa 1 tiene evidencia anclada (se ve en la galería
y en "News"). Bug abierto; T17 sale del video hasta arreglarlo.

Lo que hace la toma, medido sobre el video (cuadros cada 3 s, ±3 s):

| Tiempo | Pantalla |
|---|---|
| 0:00 | "Menu", con la campana marcada |
| 0:09 | **"Updates"**: "Project invitation · Torres de Palermo · 5B" |
| 0:21 | **"View invitation"**: el modal, "This invitation is anchored on chain" |
| 0:30 | **"Accept invitation"**: "Accepting…" |
| 0:33 | El detalle de la **5B** |
| 0:42 | La galería: la portada y las fotos de evidencia (0:51) |
| 0:57 | El mapa |
| 1:03 | "Unit details", "My unit progress", "News" (1:09) |
| 1:15 | **"View my unit in the building"**: la 5B resaltada |
| 1:27 | Scroll hasta "Contract and payments" |
| 1:36 | **"My contract and payments"**: US$ 185,000, firmado el 1 de octubre, hasta el final (1:44) |

#### Acto 4 · Las cuatro aristas de la FSM ← el núcleo

**Todo sobre la misma etapa: la 1, "Land acquisition", de Torres de Palermo**, para que se lea como un
solo objeto recorriendo una máquina de estados y no como cuatro cosas sueltas.

##### T18 · Observar, reanudar y certificar — 1:27 · ⚠ irrepetible · ✓ grabada el 2026-10-01

**Las cuatro aristas que faltaban, en una toma armada con cuatro grabaciones** (en `originales/`):
observar (pestaña 3, recortada en 0:36: seguía el spinner "Sending…"), reanudar (pestaña 2,
entera), certificar (pestaña 3, recortada en 0:16: seguía "Certifying…") y el certificado
emitido (pestaña 3, entera). Funde las viejas T18, T19, T20 y T21. La observación fue `Please
attach the signed version`.

Lo que hace la toma, medido sobre el video (cuadros cada 2 s, ±2 s):

| Tiempo | Pantalla |
|---|---|
| 0:00 | "Certifier panel": "Assigned 1", Torres de Palermo · Adquisición del terreno |
| 0:08 | **"Certify stage"**: la etapa 1 y los tres archivos del developer |
| 0:16 | **"Observe"**: el diálogo; se escribe la observación (0:18) |
| 0:30 | **"Send"**: "Sending…" |
| 0:36 | "Developer panel" → **"Progress"** (0:42): "Observed stages", la etapa 1 **Observed** |
| 0:52 | **"Resume stage"** |
| 0:56 | "Certifier panel" → la etapa (1:04) → **"Certify"** (1:06): "Certifying…" |
| 1:12 | "Certifier panel": "Assigned 0", "Certified 31" |
| 1:18 | **"Issued"**: Torres de Palermo, "Certified", arriba de todo, hasta el final (1:27) |

#### Acto 5 · Dossier y escribano

**Volvemos a `torre-volumen-3`, unidad 1A** — la entregada. Un dossier final solo significa algo
sobre una obra terminada.

##### T23 · El dossier, compartirlo y la firma — 1:38 · ⚠ irrepetible · ✓ grabada el 2026-10-01

**Dos grabaciones** (en `originales/`): el investor (pestaña 1, entera) y el notary (pestaña 4).
Funde las viejas T23, T24, T25 y T26. El investor, además de "Share", tocó **"Open view"**: la
vista pública se ve antes de la firma, todavía en "Pending" (la de después de firmar sigue siendo
T27). **En la del notary se abrió el Diccionario de macOS** justo después de "Verify and sign"
(un toque fuerte del trackpad): se cortaron esos 3,6 s (26,4 → 30,0 de la grabación), y el video
pasa de "Signing…" al panel con el dossier firmado.

Lo que hace la toma, medido sobre el video (cuadros cada 3 s, ±3 s):

| Tiempo | Pantalla |
|---|---|
| 0:00 | "Menu" (investor) |
| 0:06 | **"Units"**: la **1A** de Torre Volumen 3 |
| 0:12 | El detalle de la 1A, scroll hasta "Dossier" (0:21) |
| 0:24 | **"Dossier"**: "Cryptographic certification", el hash en "Pending", completitud 100%, "Artifacts" (0:30) |
| 0:36 | **"Share"**: "Share dossier · Read-only link" → **"Open view"** (0:45) |
| 0:51 | **"Public dossier"**: el hash en "Pending", los artefactos (scroll hasta 1:05) |
| 1:06 | "Notary panel": "Pending dossiers 1", la 1A |
| 1:15 | **"Dossier review"** de la 1A: cada artefacto "Verified" |
| 1:27 | **"Verify and sign"**: "Signing…" (1:30) |
| 1:32 | "Notary panel": "Pending dossiers 0", **"Signed 1"**, hasta el final (1:38) |

##### T27 · Verificado sin cuenta — 25 s

**✓ Grabada el 2026-10-01 (0:16).** Arranca en el panel del notary ("Signed 1"), abre la ventana de
incógnito y pega el link: "Dossier público" ya **firmado**. Arranca en castellano —incógnito no
recuerda el idioma— y pasa a inglés a los ~11 s.


**Antes de grabar:** una **ventana de incógnito**, armada así: `Cmd+Shift+N` → `Cmd+L` →
pegá el link de T23 (de la nota) → Enter → `Cmd` + `+` hasta 110% (incógnito no recuerda el zoom) →
`Cmd+Ctrl+F`. **Es el plano más fuerte del producto
entero**: tiene que verse que no hay sesión — sin barra lateral, sin campana, sin perfil.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00–0:06 | **Quieto.** | "Public dossier", solo el toggle de idioma en el header. |
| 0:07–0:14 | **Quieto**, el mouse sobre el hash. | "Dossier hash" con el badge **"Signed"**. |
| 0:15–0:25 | Scroll lento. | La barra de avance, los hashes y el texto "This dossier records hashes and timestamps. It does not certify…". |

Al terminar, **cerrá la ventana de incógnito entera**.

#### Acto 6 · El developer cierra: el contrato y el audit log

##### T22 · El contrato del lado del developer — 25 s

**✓ Grabada el 2026-10-01 (0:24).** Panel → "My projects" → Torres de Palermo (10%, US$ 185K, 1
investor) → **"Contracts"** (0:18): la 5B de Buyer Demo, "Recorded on chain" y su txid.


**Antes de grabar:** pestaña 2, `/developer/project/<nuevo>`.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00 | Clic en **"Contracts"**. | — |
| 0:01–0:08 | **Quieto**, el mouse sobre las tres tarjetas. | "Contracts 1", "Agreed amount", "Anchored 1". |
| 0:09–0:25 | **Quieto**, el mouse sobre la fila. | "Unit 5B · US$ 185,000", "Signed on …", **"Recorded on chain"** y el txid. |

Los tres StatCard son hechos del registro, no un flujo de pagos — D-070.

**Movida al final el 2026-10-01:** antes iba entre las viejas T21 y T23, y obligaba a pasar por la pestaña 2
solo para esta toma. El contrato existe desde T12, así que acá dice lo mismo y el developer queda
con sus dos tomas seguidas. Las herramientas siguen el orden de este mapa, no el número.


##### T28 · El círculo se cierra — 45 s

**✓ Grabada el 2026-10-01 (0:53).** Panel → **"Audit log"** (0:08) → filtro **"stage"** (0:14) →
**"signature"** (0:22) → **"All"** (0:30) → el txid de "Certified the stage" (0:38): "Blockchain
verification" → **cardanoscan** (0:46) hasta el final. Se grabó después de arreglar el audit log
para que muestre el tx de cada transición (`754f51c`).


**Antes de grabar:** pestaña 2 (`Cmd+2`), `/developer`. Recargá antes de grabar.

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

**Fin de la sesión B y de la grabación de pantalla.**

- [ ] `bash scripts/video-walkthrough/renombrar.sh B` → confirmá con `s`. Quedan `T07.mov` … `T28.mov`.
- [ ] Cerrá la sesión (Paso 6.1).

*Hasta el 2026-09-30 había una sesión C con tres tomas más (el resto del developer, los perfiles y
la vista de teléfono). El dueño las sacó: ninguna agregaba un paso al flujo. Ver Anexo A.*

---

## Paso 3 · Recortar los 9 videos

**Por qué importa:** todos los tiempos —los de la pantalla y los de la voz— se cuentan desde el
0:00 de la toma **recortada**. Un recorte a ojo corre la voz.

**Por cada `Txx.mov`:**

1. Doble clic → se abre en QuickTime.
2. **`Cmd+T`** (Recortar).
3. **Punta amarilla izquierda:** justo antes de la **primera acción** de la tabla de la toma (si la
   tabla arranca con "quieto", en el primer cuadro limpio después de apretar grabar).
4. **Punta amarilla derecha:** después del último "quieto", antes de que se vea el atajo de parar.
5. **Recortar** → **`Cmd+S`**. No re-encodea: es instantáneo.
6. Mirá la duración: tiene que quedar cerca de la columna **Video** del mapa (±10 s).

**Si una toma quedó partida** (`T18.mov` y `T18b.mov`, Paso 1.7): recortá `T18` hasta antes del
error y `T18b` desde la acción siguiente; abrí `T18.mov` → Edición → **Agregar clip al final…** →
`T18b.mov` → `Cmd+S`. Después borrá `T18b.mov`.

- [ ] T01
- [ ] T07, T09
- [ ] T12
- [ ] T18
- [ ] T23, T27
- [ ] T22, T28

---

## Paso 4 · Grabar la voz, en el estudio

**El estudio** es una página que corre en esta Mac: reproduce cada toma sin sonido, muestra **la
frase que toca, en su segundo, con la cuenta regresiva de la siguiente**, graba el micrófono y
guarda `Txx.webm` directo en la carpeta. La voz queda sincronizada con el video por construcción:
no hay que arrancar nada a la vez ni guardar a mano.

### 4.1 Preparar

1. **Lugar:** una habitación chica y con muebles (el eco de un ambiente vacío se nota). Ventanas
   cerradas, aire y ventilador apagados.
2. **Micrófono:** unos auriculares con micrófono (los de celular sirven) suenan mejor que el de la
   notebook. Enchufalos **antes** de abrir el estudio.
3. En la Terminal:

   ```bash
   node scripts/video-walkthrough/estudio/servidor.mjs
   ```

   Abre Chrome en `http://127.0.0.1:8765`. **Dejá la Terminal abierta**; `Ctrl-C` lo apaga.
4. La primera vez Chrome pide permiso para el micrófono: **Permitir**. Elegí los auriculares en el
   selector de abajo y hablá: la barrita verde tiene que moverse.

### 4.2 El ciclo de cada toma de voz

1. A la izquierda, las 9 tomas: **"falta voz"** en amarillo, **"✓ voz"** en verde. Arranca sola en
   la primera que falta.
2. **Espacio** → cuenta 3, 2, 1 → el video arranca y graba.
3. **Leé la frase grande cuando aparece.** Debajo, en gris, la próxima con su cuenta regresiva
   ("Próxima en 4 s"). Entre frase y frase, silencio: es a propósito.
4. Al terminar el video, para y guarda solo.
5. **E** para escucharla sobre el video. ¿Mal? **Espacio** otra vez: la nueva reemplaza a la
   anterior.
6. **S** para la siguiente.

**Ritmo:** más lento de lo que te parece natural. Cada frase tiene lugar de sobra hasta la
siguiente (está medido a 2,3 palabras por segundo).

**El texto sale de este runbook** (4.3, abajo): si alguien corrige una frase acá, el estudio la
muestra corregida al recargar la página. Si alguien lo edita: nada que la pantalla no muestre, nada
fuera de D-026 (la plataforma no certifica, no valida y no decide), **"stage", nunca "milestone"**
(D-067), y **no cambies el formato de las tablas**, que es lo que el estudio lee.

*(Sin el estudio, se puede grabar con QuickTime → Archivo → Nueva grabación de audio, una por toma,
guardada como `Txx.m4a` en la carpeta, mirando la toma en otra ventana. El Paso 5 recorta el
silencio del principio y hace entrar la primera frase en 0:01. Es más lento y más propenso a
errores: usalo solo si el estudio no anda.)*

### 4.3 El texto, toma por toma (English)

#### Acto 1 · Investor (T01)

##### T01 · La sesión A entera — video 213 s

*(Texto del dueño, 2026-10-01, pensado en castellano y pasado al inglés. Los tiempos salen del
video, ±3 s.)*

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Buy", arriba de todo | This is the investor's screen. |
| 0:06 | "Updates" | In the top bar, we have our notifications… |
| 0:12 | "Profile" | …our profile settings, and the language toggle. |
| 0:24 | "Buy" otra vez | For each project, we see its location and its status. |
| 0:30 | La pill "Map" | We can search for projects on a map… |
| 0:57 | La pill "Search" | …or by keyword… |
| 1:12 | El diálogo "Filters" | …and filter them by several criteria. |
| 1:26 | El corazón | We can save any project to our favorites… |
| 1:30 | "My favorites" | …and find them later in the sidebar on the left. |
| 1:42 | El detalle de Torre Volumen 3 | Inside a project, we see its name, a cover image, its status and its location. |
| 1:51 | "Verified documentation" | We can also see its documents, each one with its fingerprint anchored on Cardano. |
| 2:00 | El modal de un documento | Each document can be opened and downloaded. |
| 2:09 | "Progress" | Below, the project's progress, stage by stage. |
| 2:15 | "Grupo Alpine" | This is the developer's profile: a description, their track record, and their projects. |
| 2:24 | "Previous projects" | Each project shows its price, its floor area and its status. |
| 2:39 | "My units" | "Units" takes us to the units we've bought. |
| 2:51 | El detalle de la 1A | Each unit has its image gallery, its location and its details… |
| 2:57 | "My unit progress" | …its progress, and the purchase amount. |
| 3:03 | El modal "Terminaciones" | We can also follow every stage, all the way down to the proof behind each one: its Merkle root and its transaction. |
| 3:12 | "My contract and payments" | And the contract, with its total amount and its signing date. |
| 3:21 | "Buy" | "Buy" takes us back to the screen we saw at the start, with the projects on sale. |

#### Acto 2 · Developer (T07, T09)

##### T07 · El panel y el proyecto nuevo — video 180 s

*(Texto del dueño, 2026-10-01, pensado en castellano y pasado al inglés. Los tiempos salen del
video, ±2 s. La frase de 2:26 no estaba en su lista: cubre la fecha de entrega, que se ve cargar.)*

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Developer panel" | This is the developer panel. |
| 0:06 | "My projects" | From the sidebar on the left, we can open our projects. |
| 0:20 | "Capital raised" | Under Capital, we see the total raised and the number of investors. |
| 0:30 | "Construction progress" | In Progress, we follow each project, stage by stage. |
| 0:46 | El panel otra vez | Back on the panel, these cards show the key metrics. |
| 0:56 | "Investors" | Below, we can list all our investors. |
| 1:06 | "Documentation" | We can see all the anchored evidence. |
| 1:28 | "Audit log" | And we can see the audit log. |
| 1:44 | El panel, antes de "New project" | Let's create a new project. |
| 1:54 | "Project name" | We choose a name. |
| 2:00 | El mapa | We can enter the exact address, or use the map. |
| 2:16 | "Number of units" | We choose the number of units. |
| 2:20 | "Stage template" | We confirm the stage template: the standard ten stages. |
| 2:26 | El calendario | We set the estimated delivery date. |
| 2:42 | El selector de archivos | We attach the project's cover image. |
| 2:54 | El clic en "Create project" | And we click Create project. |

##### T09 · El proyecto, la unidad, la invitación y la evidencia — video 195 s

*(Frases simples, a pedido del dueño, sobre lo que se ve en cada tramo. Los tiempos salen del
video, ±3 s.)*

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Developer panel" | Back on the developer panel. |
| 0:06 | "My projects" | Our new project is already listed. |
| 0:12 | El detalle del proyecto | It starts at zero percent. |
| 0:21 | "Construction progress" | In Progress, the delivered towers are complete. |
| 0:33 | Las diez etapas "Pending" | The new project has ten stages, all pending. |
| 0:45 | "My projects" | Let's open the project again. |
| 0:52 | "Manage units" | First, we add a unit. |
| 0:57 | Se tipea "5B" | Unit 5B, on the fifth floor, 85 square meters. |
| 1:09 | La card de la 5B | It shows up as available. |
| 1:21 | "Invite investor" | Now we invite a buyer. |
| 1:27 | El email | We enter the buyer's email… |
| 1:33 | "Assigned unit" | …the unit… |
| 1:36 | "Amount" | …and the amount. |
| 1:42 | El clic en "Send invitation" | We send the invitation. |
| 1:45 | "Manage units" | Unit 5B is now reserved. |
| 1:55 | El detalle, antes de "Upload evidence" | Now we upload evidence for the first stage. |
| 2:04 | El chip 1 | We select stage one. |
| 2:07 | El selector de archivos | We choose the files. |
| 2:28 | Los tres archivos en la lista | Three documents, ready to anchor. |
| 2:34 | "Anchoring…" | We click Anchor evidence. |
| 2:40 | "Evidence anchored" | The evidence is anchored on Cardano. |
| 2:46 | El clic en "View on explorer" | We can check it on the explorer. |
| 2:52 | Cardanoscan | This is the transaction on Cardanoscan. |
| 3:01 | El modal otra vez | Back in the app. |
| 3:10 | El clic en "Done" | Done. |

#### Acto 3 · Investor (T12)

##### T12 · Aceptar, la unidad y el contrato — video 104 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Menu" | Now we switch to the investor. |
| 0:06 | La campana | A new notification arrives. |
| 0:09 | "Project invitation" | It's an invitation to buy unit 5B. |
| 0:21 | El modal de la invitación | We open the invitation: the project, the unit and the amount. |
| 0:27 | "This invitation is anchored on chain" | The invitation is anchored on chain. |
| 0:30 | "Accepting…" | We accept it. |
| 0:34 | El detalle de la 5B | Unit 5B is now ours. |
| 0:42 | La galería | The gallery shows the cover and the evidence images. |
| 0:57 | El mapa | Its location on the map. |
| 1:03 | "Unit details" | The unit details and its progress. |
| 1:09 | "News" | The news: the invitation, the stage in progress, and the anchored evidence. |
| 1:15 | El edificio | Its place in the building. |
| 1:27 | "Contract and payments" | Below, the contract and payments. |
| 1:36 | "My contract and payments" | The contract: the total amount and the signing date. |

#### Acto 4 · La FSM (T18)

##### T18 · Observar, reanudar y certificar — video 87 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Certifier panel" | Now the certifier. |
| 0:04 | "Assigned stages" | One stage is assigned for review. |
| 0:08 | "Certify stage" | Stage one, with the evidence uploaded by the developer. |
| 0:16 | El diálogo "Observe" | Something is missing, so we observe the stage. |
| 0:21 | Se escribe la observación | We write what the developer needs to fix. |
| 0:30 | "Sending…" | We send the observation. |
| 0:36 | "Developer panel" | Back to the developer. |
| 0:42 | "Observed stages" | The stage now shows as observed. |
| 0:49 | "Resume stage" | We resume the stage. |
| 0:56 | "Certifier panel" | The certifier reviews it again. |
| 1:04 | "Certify stage" | This time, we certify the stage. |
| 1:07 | "Certifying…" | The certification goes on chain. |
| 1:12 | "Assigned 0" | The stage leaves the queue. |
| 1:18 | "Issued certificates" | And it appears among the issued certificates. |

#### Acto 5 · Dossier y escribano (T23, T27)

##### T23 · El dossier, compartirlo y la firma — video 98 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Menu" | Back with the investor, on the delivered tower. |
| 0:06 | "My units" | Unit 1A, in Torre Volumen 3. |
| 0:12 | El detalle de la 1A | Its details and its progress. |
| 0:21 | "Dossier" | At the end, the dossier. |
| 0:24 | El hash "Pending" | The dossier hash is still pending: nobody has signed it yet. |
| 0:30 | "Artifacts" | It lists every anchored artifact. |
| 0:36 | "Share dossier" | We can share it with a read-only link. |
| 0:45 | "Open view" | Anyone with the link can open it. |
| 0:51 | "Public dossier" | The public view, without logging in. |
| 0:57 | Los artefactos | The same hashes, still waiting for a signature. |
| 1:06 | "Notary panel" | Now the notary. |
| 1:09 | "Dossiers pending review" | One dossier is waiting for review. |
| 1:15 | "Dossier review" | The notary reviews every artifact. |
| 1:26 | "Verify and sign" (subtítulo arriba) | And signs the dossier. |
| 1:29 | "Signing…" (subtítulo arriba) | The signature goes on chain. |
| 1:32 | "Signed 1" | The dossier is now signed. |

##### T27 · Verificado sin cuenta — video 16 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Notary panel" | The dossier is now signed. |
| 0:04 | La ventana de incógnito | Anyone can check it, without an account. |
| 0:08 | "Dossier público" | This is the shared link, in a private window. |
| 0:11 | "Signed" | It now shows as signed, with its hash. |

##### T22 · El contrato del lado del developer — video 24 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Developer panel" | Back with the developer. |
| 0:06 | "My projects" | We open the project. |
| 0:12 | El detalle de Torres de Palermo | Ten percent done, and its first buyer. |
| 0:18 | "Contracts" | The contract for unit 5B, recorded on chain. |

##### T28 · El círculo se cierra — video 53 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Developer panel" | Finally, the audit log. |
| 0:08 | "Audit log" | Every action, with who did it and its transaction. |
| 0:14 | El filtro "stage" | We can filter by stage… |
| 0:22 | El filtro "signature" | …or by signatures. |
| 0:30 | "All" | Back to all events. |
| 0:38 | "Blockchain verification" | Each transaction can be verified… |
| 0:46 | Cardanoscan | …on Cardanoscan, outside the app. |

- [ ] En el estudio, las 9 tomas dicen "✓ voz".

---

## Paso 5 · Unir todo

- [ ] En la carpeta están `T01.mov` y `T07.mov` … `T28.mov` y las 9 voces (el estudio lo muestra: todas en
      verde).

**Con ffmpeg** (esta Mac lo tiene) — más rápido:

```bash
bash scripts/video-walkthrough/unir.sh
```

**Sale con la voz y con los subtítulos dibujados** (decisión del dueño, 2026-10-01: las dos
versiones son "solo subtítulos" —`subtitular.sh`, abajo— y "voz con subtítulos" —esta—): usa los
videos de `subtituladas/`, y si falta alguno lo arma primero.

Una línea por toma (`T01: video 22 s, voz T01.webm -> queda en 22 s`) y al final **`LISTO:
…/walkthrough-final.mp4 (+ walkthrough-final.srt)`**. Son unos minutos, con la Mac enchufada.

**Sin ffmpeg** — desde el estudio, botón **"Armar el video final"** (abajo a la izquierda). Arma el
video en tiempo real (~14 min): **no cambies de pestaña ni minimices Chrome** mientras corre. Deja
`walkthrough-final.mp4` y `walkthrough-final.srt` en la carpeta.

**Qué hacen los dos, para que sepas qué esperar:**

- Cada toma dura **lo que dure el más largo** entre video y voz, más medio segundo: si la voz es más
  larga, la imagen se congela en el último cuadro; si es más corta, el resto va en silencio.
- Todas quedan en 1920×1200.
- **`walkthrough-final.srt`** son los subtítulos en inglés, sacados del texto del Paso 4.3 con los
  tiempos reales de cada toma. Se suben junto al video (YouTube los acepta tal cual).

**La otra versión: sin voz, con subtítulos dibujados** (decisión del dueño, 2026-10-01). No necesita
las voces, así que se puede armar apenas están los videos:

```bash
bash scripts/video-walkthrough/subtitular.sh          # todas: walkthrough-subtitulado.mp4 (+ .srt)
bash scripts/video-walkthrough/subtitular.sh T09      # una sola, para revisarla: subtituladas/T09.mp4
```

Cada frase del Paso 4.3 queda en pantalla desde su segundo hasta que entra la siguiente, para que
siempre haya un subtítulo. Van abajo; si en algún tramo tapan algo que importa (un botón en el momento de
tocarlo), en la columna "Entra cuando ves" se agrega *(subtítulo arriba)* y esa frase se dibuja
arriba. Si una frase sale antes o después de su pantalla, se corrige el tiempo en
4.3 y se vuelve a correr: el estudio de voz lee la misma tabla.

**Si algo falla:** `FALLÓ Txx` quiere decir que ese archivo está dañado o a medio guardar: abrilo en
QuickTime; si no reproduce, rehacelo. **Para rehacer una toma**, reemplazá el archivo y volvé a
correr el mismo comando: rehace todo.

---

## Paso 6 · Revisar y cerrar

### 6.1 Cerrar la sesión — el mismo día que grabás

- [ ] En la Terminal de `sesion.sh`: **`Ctrl-C`**. Apaga el keep-alive, devuelve los íconos del
      escritorio y la carpeta de las capturas de pantalla.
- [ ] No molestar OFF.
- [ ] El Chrome de la grabación: `Cmd+Ctrl+F` para salir de pantalla completa y `Cmd+Q`.
- [ ] **Terminada la sesión B**, opcional:
      `node scripts/video-walkthrough/verificar-produccion.mjs --despues` confirma que el dossier de la
      1A quedó firmado.

### 6.2 Mirar el resultado

- [ ] Abrí `walkthrough-final.mp4` y miralo **entero** una vez:
  - [ ] Las tomas están en orden (el mapa del Paso 2).
  - [ ] La voz corresponde a la pantalla.
  - [ ] Ninguna toma muestra una contraseña, una pantalla de error, el admin o un banner de
        notificación.
- [ ] ¿Una toma mal? Rehacé ese archivo (video en el Paso 3, voz en el estudio) y volvé al Paso 5.

**iMovie solo si hace falta agregar títulos o transiciones**, y al final: re-renderiza todo y tarda
bastante más.

### 6.3 Guardar y entregar

- [ ] Guardá `walkthrough-final.mp4` y `walkthrough-final.srt` fuera de la carpeta de trabajo (y
      `unidas/`, si puede hacer falta rehacer una toma).
- [ ] Recién después, mové o borrá el crudo (son varios GB).
- [ ] Marcá **3.12** en `CLAUDE.md` §Lo que queda del plan y el **criterio 13** en
      `specs/README.md`, en el mismo commit que publique el video.

---

## Anexo A · Por qué está armado así

**Dos proyectos, y cada uno muestra lo que el otro no puede.**

| | Proyecto | Qué muestra |
|---|---|---|
| **El terminado** | `torre-volumen-3` — 10/10 etapas `Completed`, unidad 1A vendida con contrato firmado | Sesión A (lo que ve un comprador cuando todo está anclado) y el final de la B (el dossier y la firma del escribano). Un dossier solo significa algo sobre una obra terminada. |
| **El que nace** | El que se crea **en cámara** en T07, con sus 10 etapas en `Pending` | El alta, la invitación, y **el recorrido completo de la FSM sobre una sola etapa**. |

| | Decisión | Por qué |
|---|---|---|
| **Idioma** | **Todo en `en-US` desde el primer cuadro**, ya logueado; el toggle ES \| EN queda a la vista en el header y la voz de T01 lo nombra. | Catalyst revisa en inglés. Hasta el 2026-09-30 el cambio se hacía en cámara, en el login; el dueño lo sacó para abrir ya adentro. Los dos diccionarios están completos y la paridad la fuerza el compilador (`dictionary.ts`). |
| **Entorno** | Producción: `propnexus-web.onrender.com`. Nunca local. | El video tiene que mostrar TXIDs reales en Preprod y la URL pública viva — parte de lo que sostiene el criterio 5. |
| **La FSM** | **Las cuatro aristas, sobre la misma etapa**: subir evidencia → observar → reanudar → certificar. | Es la máquina de estados entera contada sobre un solo objeto. |
| **Tomas** | 9 tomas: la sesión A es un recorrido continuo (T01, decisión del dueño del 2026-10-01: no tiene esperas) y la B son 8 tomas (T07, T09, T12, T18 y T23 funden varias, grabadas de corrido el mismo día), cortadas donde hay espera, con video y audio por separado. | Cada acción on-chain tarda ~45 s y crear un proyecto bloquea ~6 min. Una toma continua es imposible, y con la toma como unidad los tiempos de pantalla y voz se cuentan desde el mismo 0:00. |
| **Orden del final** | La firma del escribano (T23) va **antes** de la vista pública (T27). | La vista pública muestra el dossier **ya firmado**, con su badge "Signed". Cambió el 2026-09-28. |

**Los tiempos de espera** salen de
[`REPORTE-2026-09-10-prueba-de-volumen.md`](../REPORTE-2026-09-10-prueba-de-volumen.md) §Cronología
(180 anclajes reales contra Preprod). **La cobertura:** el recorrido completo del flujo —comprar,
crear un proyecto, las cuatro aristas de la FSM, el dossier, la firma y la vista pública— y cierra
en el audit log. **Desde el 2026-09-30 (decisión del dueño) el video no pasa por** la documentación,
los inversores, el capital, las unidades y el progreso del developer, los perfiles de los cuatro
roles ni la vista de teléfono (las viejas T29–T31): son pantallas secundarias y ninguna agrega un
paso al flujo. "Audit logs persisted" tiene además su propia evidencia, en
`specs/evidencia-m3/3-preprod/reservation-to-escrow-audit-log.jpg`.

## Anexo B · Lo que el video no muestra, y por qué

Para no prometer en audio algo que la pantalla no hace:

- **Lo que la versión del 2026-09-21 prometía y la app no hace** (verificado contra el código el
  2026-09-28, y ya sacado del Paso 2 y del Paso 4 — no lo vuelvas a poner):
  - la invitación **no tiene campo de nombre**: es email, unidad y monto (T09);
  - ~~el alta de proyecto no tiene vista previa de mapa (T07)~~ — **ahora sí** (D-097, 2026-09-28): la
    dirección mueve el pin y un clic lo ajusta;
  - el detalle de etapa **no muestra GPS ni hora de captura** de las fotos (la pantalla de etapa, que la sesión A ya no recorre);
  - el contrato del investor **no muestra hash**: total, fecha de firma y el cronograma (T12); el
    txid del contrato está del lado del developer (T22);
  - "Observed stages" del developer **no muestra la nota del certifier** (T18);
  - el detalle del proyecto del developer **no lista las etapas**: las diez `Pending` se ven en
    "Progress" (T09);
  - las novedades de la unidad **no abren el modal de la etapa**: llevan al detalle de la unidad, y
    el modal sale de "Evidence by stage" (T17, fuera del video: no responde, bug abierto 2026-10-01);
  - el KPI del panel del developer cuenta **documentos anclados**, no eventos (T07).

- **No hay PWA instalable.** `index.html` no linkea el manifest, no hay service worker registrado y
  `apps/web/public/manifest.json` sigue siendo el boilerplate de Create TanStack App ("Create
  TanStack App Sample"). Chrome no va a ofrecer instalar. **La PWA la decidió D-065 y nunca se hizo:** queda especificada en
  [`SPEC-222`](../SPEC-222-la-pwa-que-d-065-decidio.md), postergada a después del video. No la
  menciones en el audio.
- **No hay botón de liberar pagos.** D-070 lo sacó a propósito: este producto no administra fondos,
  refleja y respalda lo que pasa afuera (D-026). El endpoint
  `POST /developer/contracts/:id/releases/:stageNum` existe en el backend como deuda declarada y el
  `ApiPort` ni lo expone. Por eso T12 muestra el estado vacío de releases y T22 muestra el contrato
  como registro.
- **La pantalla del admin (`/admin`) no sale en el video.** El admin es la salvaguarda (D-095), no
  uno de los cuatro roles del SOM; se usa fuera de cámara para invitar al certifier (corte de T07). No lo
  menciones en el audio.
- **`torre-a` sigue en la base pero sin membresías.** No se borró porque tiene 8 eventos on-chain
  colgando. No la ve ningún rol: todos los listados, incluido el del developer (T07,
  `misProyectos` en `developer.routes.ts`), están scopeados por membresía.
- **El rating del desarrollador no existe, y es una decisión (D-094).** Las capturas 59-60 muestran
  un pill "4.8 / 5.0 · 127 investors" junto al nombre de la organización. **La pantalla se construyó
  entera (T01) menos ese pill.** Un rating es una afirmación sobre la calidad de un tercero, y D-026
  limita lo que la plataforma sostiene a cuatro afirmaciones, todas sobre documentos y atestaciones:
  no hay reseñas, no hay quién las firme y no hay de dónde recalcularlo, así que el número solo
  podría escribirse a mano. Mismo caso que el botón de liberar pagos (D-070). **El conteo de
  compradores sí se muestra**, como una métrica más — es un hecho del registro, no una nota de
  calidad. En el detalle de obra (T01) falta por la misma razón la card del developer con estrellas,
  y además el "Price from", que es otra deuda distinta: el contrato de `GET /projects/:id` no agrega
  el mínimo de las unidades, aunque el perfil sí lo hace. **No menciones el rating en el audio.**

## Anexo C · El estado de la base — para el técnico

**Medido y ya preparado el 2026-09-21.**

> **Para el técnico.** Quien graba no necesita esto. Y los números son referencia: no hace
> falta que coincidan.

| Proyecto | Etapas | Estados | Membresías | Unidades | Eventos |
|---|---|---|---|---|---|
| `torre-volumen-1` | 10 | 10 Completed | dev · verifier · **buyer** | 4 vendidas (de 24 declaradas) | 60 |
| `torre-volumen-2` | 10 | 10 Completed | dev · verifier · **buyer** | 4 vendidas (de 18 declaradas) | 60 |
| `torre-volumen-3` | 10 | 10 Completed | dev · verifier · buyer | 4 vendidas (de 30 declaradas); la **1A** → buyer, contrato USD 100.000 firmado | 61 |
| `torre-a` | 3 | 1 Completed, 2 InProgress | **ninguna** | — | 8, 1 `Failed` |
| `torre-pending-test` | 10 | 9 Pending, 1 InProgress | **ninguna** (desde 2026-09-30) | — | 12 |
| `torre-belgrano` / `torre-demo-e2e` | 0 | — | **ninguna** (desde 2026-09-30) | — | 0 |

**200 `OnChainEvent` en `Confirmed`, 1 en `Failed`** (ese único está en `torre-a`, que ya no se ve).
La reconciliación de D-077 corrió sobre todos: no hay eventos con TXID real mostrándose pendientes.

### C.1 Lo que ya se hizo sobre la base

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

- **Las tres torres de prueba quedaron ocultas, sin salir de la base (2026-09-30, decisión del
  dueño).** `Torre Pending Test`, `Torre Demo E2E` y `Torre Belgrano` eran restos de pruebas: se
  veían en "My projects" (T07), y la primera —la única con etapas— también en "Construction
  progress" (T09). Ninguna se usa en el video ni en tests. Se borró su única fila de `ProjectMember`
  (la del developer); no tenían unidades, dossiers ni otras membresías. Verificado después: cero
  membresías sobre las tres. **Reversible:**

```sql
INSERT INTO ProjectMember (id, userId, projectId, membershipRole, createdAt) VALUES
  ('bhq459or64jfaj1jhquqyrp2','hnrykorp4aqul78oiy9bfe4h','p8tdmsdzy65grxsvoq193ggq','developer',1788558804765),
  ('zh9stzpfkco3xudketmhfnhb','hnrykorp4aqul78oiy9bfe4h','fovu60gxv23hgz6904lrwhi0','developer',1788889738196),
  ('igcb1kvk96siv17iau1daeie','hnrykorp4aqul78oiy9bfe4h','orw3r1lusy8pxnv23c1xp2qd','developer',1788907996251);
```

- **Los tres `torre-volumen-*` pasaron de `planning` a `completed`.** Figuraban como
  "Pre-construction" teniendo las 10 etapas certificadas: incoherente en cámara y sin sentido para el
  filtro de T01. Ahora el filtro tiene dos valores reales — los tres Volumen en **"Delivered"** y el
  proyecto que nace en el Acto 2 en **"Pre-construction"**. Verificado con el token del investor:
  los tres devuelven `completed` con 10/10 etapas `Completed`.

**Coordenadas — cargadas el 2026-09-28 (D-097), por la API como admin.** Ningún proyecto quedó sin
punto. Todos en CABA:

| Proyecto | Latitud, longitud | De dónde sale |
|---|---|---|
| Torre Volumen 1 | -34.5781, -58.4265 | Palermo |
| Torre Volumen 2 | -34.562, -58.458 | Belgrano |
| Torre Volumen 3 | -34.574, -58.449 | Colegiales |
| `torre-a` | -34.589249, -58.410067 | su dirección real, Av. Santa Fe 3200 (geocodificada) |
| Torre Pending Test | -34.5889, -58.4306 | Palermo Soho (declara solo "Palermo") |
| Torre Demo E2E | -34.5826, -58.439 | Palermo Hollywood (declara solo "Palermo") |
| Torre Belgrano | -34.569, -58.47 | Belgrano R (declara solo "Belgrano") |

**Portadas — cargadas el 2026-09-30 (D-099), por la API como developer** (`PUT
/developer/projects/:id/cover`, queda en el `AuditLog`). Las dos imágenes son de
`~/Pictures`, tres y tres:

| Proyecto | Portada |
|---|---|
| Torre Volumen 3 (la de la sesión A) | `portada-proyecto-16-9.png` (horizontal) |
| Torre Volumen 1 | `portada-proyecto-16-9.png` (horizontal) |
| Torre Pending Test | `portada-proyecto-16-9.png` (horizontal) |
| Torre Volumen 2 | `imagen-vertical-proyecto.png` (vertical, la card la recorta al centro) |
| Torre Demo E2E | `imagen-vertical-proyecto.png` (vertical) |
| Torre Belgrano | `imagen-vertical-proyecto.png` (vertical) |

`torre-a` no tiene: sigue oculta. El proyecto que nace en T07 recibe la suya en cámara.

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

Los `User.id`: buyer `ng0gh91de5alybr5ihupbd11`, developer `hnrykorp4aqul78oiy9bfe4h`,
verifier `k2knwiqp66xuv6ojp7iv48ep`, notary `vjfxjgdxgi3n6pu0a7j7z2pw`, admin
`jn0ejo6c287l4q0n9p5amqpr`. **El rollback también quedó en
`specs/RUNBOOK-deploy.md` §5.1.**

**La base no tiene nada más pendiente para grabar.** Lo único que queda es invitar al certifier al
proyecto nuevo, desde la web, durante el corte de T07.

### C.2 La organización desarrolladora — **hecho el 2026-09-21**

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
  el listado "Buy" de T01**, que arma la línea con `city, country`.

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

*(El proyecto que se crea en cámara en T07 **no** va a tener organización, y está bien: su detalle
no dibuja el link. El perfil del desarrollador se ve una vez, sobre la obra terminada.)*

### C.3 Cómo quedaron las tres colas, verificado contra la API

| Cola | Estado hoy | Cuándo se llena |
|---|---|---|
| **Certifier** — "Assigned" | **vacía** (las 2 etapas de `torre-a` eran todo lo que tenía) | En **T09**: la evidencia que sube el developer pone esa etapa en `InProgress` y ahí aparece. Es la narrativa correcta — llega una etapa nueva para certificar, en vez de una cola preexistente sin explicación. |
| **Certifier** — KPIs e "Issued" | **30 certificadas, 30 certificados emitidos** con hash y TXID reales de la prueba de volumen | Ya está. El panel del certifier tiene historia real sin que haga falta preparar nada. |
| **Escribano** — "Pending review" | **vacía** (`[]`) | En la **pasada de calentamiento de la sesión B** (Paso 1.3), cuando se abre el dossier de 1A y eso lo compila. Se usa en **T25**. |
