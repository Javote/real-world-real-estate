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
| **2A** | Grabar la **sesión A**: el comprador mirando una obra terminada (T01–T06) | el grabador de macOS; al final, `renombrar.sh A` | ~15 min |
| **2B** | Grabar la **sesión B**: nace un proyecto y recorre la FSM, hasta la firma (T07–T27). **De corrido, sin cortar la sesión** | ídem; al final, `renombrar.sh B` | ~60 min |
| **2C** | Grabar la **sesión C**: auditoría y el resto de las pantallas (T28–T31) | ídem; al final, `renombrar.sh C` | ~15 min |
| **3** | Recortar los 31 videos | QuickTime | ~30 min |
| **4** | Grabar la voz mirando cada video, con la frase en pantalla en su segundo | el **estudio** (una página local) | ~35 min |
| **5** | Unir todo, con subtítulos | `unir.sh` (o el estudio, si no hay ffmpeg) | ~10 min |
| **6** | Mirar el resultado y cerrar | — | ~25 min |

**Todas las herramientas están en [`scripts/video-walkthrough/`](../scripts/video-walkthrough/README.md)**
y se corren desde la raíz del repo, en la Terminal (Cmd+Espacio → "Terminal" → Enter):

```bash
cd ~/Documents/real-estate/real-world-real-estate
```

**Cuatro reglas que valen para todo el runbook:**

1. **La unidad es la toma, no el acto.** Son 31 tomas; cada una es un video `Txx.mov` y una voz
   `Txx.webm` con el mismo nombre. Todos los tiempos se cuentan desde el **0:00 de la toma ya
   recortada**, así que rehacer una no corre nada del resto.
2. **La sesión B va de corrido y en orden.** Cada toma deja la base en el estado que necesita la
   siguiente. Las sesiones A y C se pueden grabar otro día (C, siempre después de B).
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
| Admin | `admin@example.com` | **No** — solo para invitar al certifier en el corte de T08 |

La pantalla de login precarga el usuario de cada solapa pero **nunca la contraseña**: se tipea.

### 0.2 `preparar.sh` — ya corrido en esta Mac el 2026-09-28

```bash
bash scripts/video-walkthrough/preparar.sh
```

Crea `~/Movies/propnexus-walkthrough/` (donde cae todo) y `~/Movies/propnexus-evidencia/` con **los
tres archivos que se suben en T15** — `land-title-deed.pdf`, `site-survey-plan.jpg` y
`lot-location-map.png`, ficticios y marcados como tales, generados desde
`scripts/video-walkthrough/evidencia/`. Chequea 15 GB libres, Chrome, Node y ffmpeg, y corre el
verificador de producción (solo lectura: las cinco cuentas, lo que ve cada rol, el saldo de tADA).
Se puede volver a correr cuando quieras.

**Lo que dejó el 2026-09-28:** todo en verde, con un aviso esperable.

- **Las tres Torre Volumen tienen coordenadas de CABA** (Palermo, Belgrano, Colegiales), cargadas el
  2026-09-28 (D-097): el modo mapa de T02 muestra sus pines y los mapas de T03 y T13 se dibujan.
  Desde ese día todo proyecto nuevo nace con coordenadas: el alta las pide (T08).
- La cola del escribano está vacía: se llena en la pasada de calentamiento de la sesión B (1.3). Es
  lo esperado.

### 0.3 El grabador de macOS — una vez, a mano

- [ ] `Shift+Cmd+5` → **Opciones**:
  - [ ] **Temporizador:** ninguno.
  - [ ] **Micrófono:** ninguno.
  - [ ] **Mostrar clics del mouse: SÍ** ← los clics son lo que hace seguible el video.
- [ ] Modo: **Grabar toda la pantalla** (el ícono de pantalla con un círculo). Con Chrome en
      pantalla completa, toda la pantalla es la app. (La única excepción es T31, que lo explica ahí.)

Dónde se guarda no hace falta elegirlo: `sesion.sh` lo pone en la carpeta durante la sesión.

---

## Paso 1 · Antes de cada sesión

Se hace antes de la sesión A, antes de la B y antes de la C. Si grabás las tres seguidas, una vez.

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
- [ ] **Pestaña 1:** antes de la sesión A, **sin entrar y en castellano** (si se ve en inglés, toggle
      → ES). Antes de B o C: entrá con `buyer@`.
- [ ] **Antes de B o C**, si alguna pestaña se ve en castellano: recargala (`Cmd+R`). La sesión
      sobrevive a la recarga.

**Dos reglas que no se rompen:**

1. **Nunca abras una pestaña con un clic desde otra**: hereda la sesión de esa otra, y vas a estar
   grabando al certifier con la sesión del developer sin enterarte. Si hace falta una, `Cmd+T`.
2. **El idioma se cambia una sola vez, en cámara, en T01.** Después de T01, recargá las pestañas 2 a
   5 para que pasen a inglés (lo dice T01).

### 1.3 La pasada de calentamiento — menos de 15 min antes de la primera toma

- [ ] **Recorré a mano, sin grabar, las pantallas de las tomas de esta sesión**, con sus tablas del
      Paso 2 al lado. Despierta las pantallas, pone al día la reconciliación de lectura (D-077: sin
      esto, un TXID ya confirmado se ve "Pending") y es el ensayo de dónde está cada botón. **No
      hagas las acciones marcadas ⚠ irrepetible.**
- [ ] **Antes de la sesión B:** abrí una vez el dossier de la 1A (pestaña 1: `Units` → 1A →
      **"Dossier"**). Esa lectura lo compila y lo pone en la cola del escribano; sin eso, T25 no
      tiene qué firmar. Y corré otra vez el verificador:

  ```bash
  node scripts/video-walkthrough/verificar-produccion.mjs
  ```

- [ ] **La primera vez, un ensayo con las acciones** — la mejor inversión del día (~20 min y tADA de
      Preprod, que no es plata). **Solo T07–T10 y T15–T21**, sobre un proyecto llamado **`Ensayo`**:
  - crealo como en T08 e invitá al certifier como en su corte;
  - cargá una unidad, subí evidencia, observá, reanudá y certificá.
  - **No invites al investor (T11–T14) ni abras o firmes dossiers (T23–T27).** Una invitación
    aceptada le suma la unidad y el proyecto al investor para siempre (se verían en T02 y T13), y
    firmar el dossier de la 1A deja a T25 sin nada que firmar.
  - Queda un proyecto más en el listado del developer (T07) y una certificación más en el panel del
    certifier: no molestan.
- [ ] **Al terminar el recorrido, dejá la app en castellano** (toggle → ES). *(Solo antes de la
      sesión A: si quedó en inglés, T01 arranca en inglés y se pierde el primer gesto del video.)*

### 1.4 Pantalla completa

- [ ] Pestaña donde arranca la sesión (A: `Cmd+1`; B y C: `Cmd+2`) → `Cmd+Ctrl+F`. Chrome ocupa
      toda la pantalla: sin pestañas, sin barra de direcciones, sin Dock.
- [ ] **El mouse lejos del borde de arriba**: si lo toca, baja la barra de Chrome.

**Para escribir una dirección en pantalla completa** (siempre fuera de cámara): `Cmd+L` muestra la
barra un momento → pegás → Enter.

### 1.5 El ciclo de cada toma — cinco pasos, 31 veces

1. **Dejá la pantalla como dice "Antes de grabar"** de la toma. Si pasó más de un minuto desde la
   última acción en esa pestaña, **recargala** (`Cmd+R`) y esperá que cargue.
2. **`Shift+Cmd+5` → Grabar.**
3. **Hacé la tabla de la toma**, fila por fila. Los tiempos son el objetivo, no un cronómetro: ±2 s
   está bien.
4. **Parar: `Cmd+Ctrl+Esc`** (en pantalla completa el botón de stop queda escondido).
5. **Hacé lo que dice "Después"** de la toma, y tildala.

**No renombres nada durante la sesión.** Al terminarla, `renombrar.sh` les pone `T01`, `T02`… a
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
  cambiás de rol. Por eso son 31.

### 1.7 Las tomas irrepetibles, y qué hacer si una sale mal

**T08, T11, T12, T15, T18, T19, T20 y T25** mandan algo a la cadena y dejan la base en otro estado:
no hay "otra toma" de esas.

- **Un error de tipeo o un clic de más:** seguí. Se arregla recortando o la voz lo tapa.
- **Un error que se ve en pantalla** (mensaje rojo, pantalla equivocada): pará la grabación,
  resolvé fuera de cámara, y grabá **la acción siguiente** como una toma aparte. **Renombrá esa
  segunda mitad enseguida** en Finder como `T15b.mov` (con la toma que corresponda), así
  `renombrar.sh` no la cuenta. En el Paso 3 las unís.
- **Algo que rompe la historia** (certificaste antes de observar, aceptaste en otra unidad): la
  única salida limpia es **un proyecto nuevo desde T08**, con otro nombre — otros ~6 min de mints y
  ~15 min de tomas.

---

## Paso 2 · Grabar la pantalla

**Cada toma:** "Antes de grabar", la tabla, y "Después". El ciclo del Paso 1.5 envuelve a todas.

**El mapa completo**, para ubicarse. *Empieza en* es dónde cae la toma en el video final (±15 s).

| Toma | Empieza en | Pestaña | Qué | Pantalla | Video | Voz | |
|---|---|---|---|---|---|---|---|
| T01 | 0:00 | 1 · Investor | Login, y el cambio de idioma | `/login` → `/investor/buy` | 22 s | 13 s | |
| T02 | 0:22 | 1 · Investor | Buy | `/investor/buy` | 35 s | 15 s | |
| T03 | 0:57 | 1 · Investor | El proyecto por dentro | `/project/<torre-volumen-3>` | 45 s | 16 s | |
| T04 | 1:42 | 1 · Investor | Quién construye | `/project/<torre-volumen-3>/developer` | 40 s | 25 s | |
| T05 | 2:22 | 1 · Investor | Hasta la prueba | `…/progress` → `…/stage/:stageId` | 45 s | 27 s | |
| T06 | 3:07 | 1 · Investor | Favoritos | `/investor/favorites` | 10 s | 4 s | |
| T07 | 3:17 | 2 · Developer | El panel | `/developer` → `/developer/projects` | 30 s | 12 s | |
| T08 | 3:47 | 2 · Developer | Proyecto nuevo | `/developer/project/new` | 40 s | 30 s | ⚠ irrepetible |
| T09 | 4:27 | 2 · Developer | El proyecto ya creado | `/developer/project/:id` → `/developer/progress` | 30 s | 15 s | |
| T10 | 4:57 | 2 · Developer | Unidades | `/developer/project/:id/units` | 32 s | 10 s | |
| T11 | 5:29 | 2 · Developer | La invitación | `/developer/project/:id/invite` | 25 s | 8 s | ⚠ irrepetible |
| T12 | 5:54 | 1 · Investor | Aceptar | campana → `/investor/notifications` | 35 s | 15 s | ⚠ irrepetible |
| T13 | 6:29 | 1 · Investor | El portfolio | `/investor/units` → `/investor/unit/<5A>` | 35 s | 23 s | |
| T14 | 7:04 | 1 · Investor | El contrato como registro | `/investor/unit/<5A>/contract` | 25 s | 13 s | |
| T15 | 7:29 | 2 · Developer | Subir evidencia | `/developer/project/:id/upload` | 40 s | 20 s | ⚠ irrepetible |
| T16 | 8:09 | 2 · Developer | La prueba, y afuera de la app | AnchoringSuccessModal → cardanoscan | 26 s | 11 s | |
| T17 | 8:35 | 1 · Investor | El mismo anclaje, del otro lado | `/investor/unit/<5A>/notifications` → `/investor/unit/<5A>` | 35 s | 16 s | |
| T18 | 9:10 | 3 · Certifier | Observar | `/certifier` → `/certifier/assigned` → `/certifier/stage/:id` | 40 s | 17 s | ⚠ irrepetible |
| T19 | 9:50 | 2 · Developer | Reanudar | `/developer/progress` | 20 s | 11 s | ⚠ irrepetible |
| T20 | 10:10 | 3 · Certifier | Certificar | `/certifier/stage/:id` | 20 s | 7 s | ⚠ irrepetible |
| T21 | 10:30 | 3 · Certifier | El certificado | `/certifier/issued` | 15 s | 5 s | |
| T22 | 10:45 | 2 · Developer | El contrato del lado del developer | `/developer/project/:id/contracts` | 25 s | 14 s | |
| T23 | 11:10 | 1 · Investor | El dossier | `/investor/unit/<1A>/dossier` | 40 s | 24 s | |
| T24 | 11:50 | 1 · Investor | Compartir | "Share" → modal | 15 s | 8 s | |
| T25 | 12:05 | 4 · Notary | La firma | `/notary` → `/notary/dossiers` → `/notary/dossier/:id` | 35 s | 19 s | ⚠ irrepetible |
| T26 | 12:40 | 4 · Notary | El historial | `/notary/signed` | 15 s | 11 s | |
| T27 | 12:55 | incógnito | Verificado sin cuenta | `/public/dossier/:shareToken` | 25 s | 18 s | |
| T28 | 13:20 | 2 · Developer | El círculo se cierra | `/developer/audit-log` | 45 s | 21 s | |
| T29 | 14:05 | 2 · Developer | El resto del developer | documentation → investors → capital → units → progress | 75 s | 23 s | |
| T30 | 15:20 | las cuatro | Perfiles y menú | los cuatro `/…/profile` + `/investor/menu` | 60 s | 13 s | |
| T31 | 16:20 | 1 · Investor | Responsive | DevTools → Device Toolbar | 30 s | 13 s | |
| | **16:50** | | **Total** | | **1010 s ≈ 17 min** | | |

### Sesión A · El comprador mira una obra terminada (T01–T06)

Abre por el final del producto: **`torre-volumen-3`**, con sus 10 etapas certificadas. Es el
contraste contra el que después se entiende el proyecto que nace vacío.

- [ ] Paso 1 hecho. Pestaña 1 en `/login`, **en castellano y sin entrar**. Pantalla completa.

#### T01 · Login, y el cambio de idioma — 22 s

**Antes de grabar:** pestaña 1, `/login`, **en castellano** (Paso 1.2), sin entrar. La solapa "Inversor"
viene seleccionada y el usuario `buyer@example.com` ya precargado.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00–0:03 | **Quieto.** | El login en castellano. |
| 0:03 | Clic en **EN** del toggle de idioma (arriba a la derecha). | Todo pasa a inglés: "Real-estate traceability, anchored on blockchain". |
| 0:04–0:07 | **Quieto.** | La pantalla en inglés. |
| 0:07 | Clic en la solapa **"Investor"** (ya está elegida: el clic es para que se vea). | "Username" con `buyer@example.com`. |
| 0:09–0:14 | Clic en **"Password"** y tipeá la contraseña (Paso 0.1). | Solo puntos. |
| 0:15 | Clic en **"Sign in"**. | "Signing in…" |
| 0:16–0:22 | **Quieto** sobre lo que carga. | "Buy" con las tres cards de Torre Volumen. |

**Ensayalo antes.** La solapa precarga solo el usuario; la contraseña es la de `SEED_DEMO_PASSWORD`,
no la local. Un "Invalid credentials" en la primera toma es la peor apertura posible.

**Después:** fuera de cámara, recargá las pestañas 2 a 5 (`Cmd+2` → `Cmd+R`, `Cmd+3` → `Cmd+R`…) para
que pasen a inglés, y volvé con `Cmd+1`. *(Si todavía no las abriste porque la sesión B es otro día,
no hace falta: se abren ya en inglés.)*

#### T02 · Buy — 35 s

**Antes de grabar:** `/investor/buy`, arriba de todo (donde terminó T01).

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00–0:11 | **Quieto**, el mouse recorre lento las tres cards. | Torre Volumen 1, 2 y 3 con su pill "Delivered" y su cantidad de unidades. |
| 0:12 | Clic en la pill **"Search"**. | El campo "Search by zone…". |
| 0:13–0:16 | Tipeá `Buenos Aires`. | Las tres siguen (las tres están en Buenos Aires). |
| 0:17 | Borrá lo tipeado y clic en la pill **"Filters"**. | El diálogo "Filters": "Project status" y "Sort by". |
| 0:18–0:20 | Clic en **"Delivered"**, después cerrá el diálogo. | La lista filtrada. |
| 0:21 | Clic en la pill **"Map"**. | El mapa con los pines de las tres obras. |
| 0:22–0:27 | **Quieto.** Si los pines se tapan entre sí, hacé zoom con la rueda. | Los pines. |
| 0:28 | Clic en el pin de **Torre Volumen 3**. | Su popover. |
| 0:30 | Clic en **"View project"**. | — |
| 0:31–0:35 | **Quieto** sobre lo que carga. | El detalle de Torre Volumen 3. |

#### T03 · El proyecto por dentro — 45 s

**Antes de grabar:** `/project/<torre-volumen-3>`, arriba de todo (donde terminó T02).

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
de `GET /projects/:id` no los da. Ver Anexo B.)*

#### T04 · Quién construye — 40 s

**Antes de grabar:** `/project/<torre-volumen-3>/developer` (donde terminó T03).

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
(D-094), no un faltante — Anexo B.)*

#### T05 · Hasta la prueba — 45 s

**Antes de grabar:** `/project/<torre-volumen-3>`, con scroll hasta la sección "Progress" (donde
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

**Antes de grabar:** el detalle de la etapa (donde terminó T05).

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00 | Clic en **"Favorites"** en la barra lateral. | — |
| 0:01–0:10 | **Quieto.** | "My favorites · 1 saved projects" con Torre Volumen 3, la que guardaste en T03. |

**Fin de la sesión A.**

- [ ] `bash scripts/video-walkthrough/renombrar.sh A` → confirmá con `s`. Quedan `T01.mov` … `T06.mov`.
- [ ] Si la sesión B no sigue ya: `Ctrl-C` en la Terminal de `sesion.sh` (Paso 6.1).

### Sesión B · Nace un proyecto, recorre la FSM y se firma el dossier (T07–T27)

**De corrido, en orden, sin cortar la sesión.** Son ~60 minutos, de los cuales ~15 son esperas.

- [ ] Paso 1 hecho, **incluido el dossier de la 1A compilado** y el verificador en verde (1.3).
- [ ] Las cinco pestañas logueadas y en inglés (1.2). Pestaña 2 al frente, en `/developer`.
- [ ] Una nota abierta (Notas o TextEdit) para pegar el link de T24.

#### Acto 2 · Developer

##### T07 · El panel — 30 s

**Antes de grabar:** pestaña 2, `/developer`, arriba de todo.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00–0:03 | **Quieto.** | "Developer panel", "Welcome, …". |
| 0:04–0:15 | El mouse pasa lento por los KPIs. | "Active projects", "Capital raised", "Total units", "Average progress", "Verified documents · anchored on chain". |
| 0:16–0:19 | **Quieto.** | "Development management": "Investors", "Documentation", "Audit log". |
| 0:20 | Clic en **"Projects"** en la barra lateral. | "My projects · 6 projects" (7 si hiciste el ensayo). |
| 0:21–0:30 | Scroll lento. | Las tres Torre Volumen arriba; abajo `Torre Pending Test`, `Torre Demo E2E` y `Torre Belgrano`. Si molestan, quedate sobre las de arriba — **no los borres**. |

##### T08 · Proyecto nuevo — 40 s · ⚠ irrepetible

**Antes de grabar:** `/developer/projects` (donde terminó T07).

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00 | Clic en **"New"**. | "New project · Set up the basic data". |
| 0:02–0:06 | "Project name": tipeá `Torre Núñez`. | — |
| 0:07–0:12 | "Location": tipeá `Av. del Libertador 7200, Buenos Aires`. | — |
| 0:13–0:16 | **Quieto**: la dirección se busca sola. | "Looking up the address…", y el mapa se mueve hasta Núñez con el pin. Abajo, "Lot marked: -34.5…, -58.4…". |
| 0:17 | Clic en el mapa, sobre la manzana, para ajustar el pin. | El pin salta ahí; las coordenadas cambian. |
| 0:18–0:19 | **Quieto.** | — |
| 0:20–0:23 | "Number of units": clic en **+** hasta 12. | — |
| 0:24–0:28 | "Estimated delivery date": elegí una fecha a dos o tres años. | — |
| 0:29–0:34 | **Quieto**, el mouse sobre la lista de etapas. | "Standard template (10 stages)" y las diez: "1. Land acquisition" … "10. Final works and subdivision". |
| 0:35 | Clic en **"Create project"**. | El botón cargando. |
| 0:36–0:40 | **Quieto.** | — |

*Si en 0:16 dice "We couldn't find that address" o "The address lookup isn't available", no pasa
nada: el clic de 0:17 marca el lote igual. Sin lote marcado, "Create project" no se habilita (D-097).*

**⏸ CORTE ~6 min.** El request no vuelve hasta que los 10 mints terminaron: son secuenciales dentro
del handler (`developer.routes.ts:266`) y cada uno es su propia transacción (D-083 — el validador
rechaza acuñar más de un hilo por tx). **No cierres la pestaña ni la recargues.**

**Después — durante esos 6 minutos, fuera de cámara: invitar al certifier.** El proyecto nuevo nace
con una sola membresía, la del developer. Sin el certifier, su etapa no llega a la cola del
certifier y no hay Acto 4. (Al investor no hace falta sumarlo: lo suma la invitación de T11.)

1. **Esperá a que la pestaña 2 vuelva sola** al detalle de "Torre Núñez": recién ahí el proyecto
   existe.
2. **`Cmd+5` (admin)** → recargá `/admin` (`Cmd+R`). El proyecto nuevo aparece **primero** en
   "Projects": confirmá que es "Torre Núñez".
3. En **"Invite a certifier"**: elegí **Verifier Demo** → **"Invite"**. Tiene que aparecer
   "Invitation sent." y, abajo, la invitación como **"Pending"**.
4. **`Cmd+3` (certifier)** → recargá `/certifier`. Arriba aparece **"Invitations to certify"** con
   Torre Núñez → **"Accept"**. La sección desaparece.
5. **`Cmd+5`** → recargá: en "Members", Verifier Demo figura como certifier.
6. **`Cmd+2`** para volver al developer, y seguí con T09.

- [ ] Certifier invitado y aceptado.

##### T09 · El proyecto ya creado — 30 s

**Antes de grabar:** `/developer/project/<nuevo>`, que es donde la app te deja sola al terminar T08. Si
pasaron más de un par de minutos, recargá (`Cmd+R`) antes de grabar.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00–0:03 | **Quieto.** | "Torre Núñez" con su pill de estado. |
| 0:04–0:12 | El mouse pasa por las cuatro acciones y las tres tarjetas. | "Manage units", "Invite investor", "Upload evidence", "Contracts"; "Progress 0%", "Capital —", "Investors 0". |
| 0:13 | Clic en **"Progress"** en la barra lateral. | "Construction progress". |
| 0:14–0:17 | Scroll hasta la card de **Torre Núñez**. | "Overall Progress: 0%". |
| 0:18–0:30 | **Quieto**, scroll lento por "Stage Detail". | Las diez filas, "Stage 1/10" … "Stage 10/10", todas con pill **"Pending"**. |

**El contraste con T05 es el punto:** diez etapas declaradas y ancladas, ninguna empezada.

##### T10 · Unidades — 32 s

**Antes de grabar:** `/developer/project/<nuevo>` (fuera de cámara: barra lateral "Projects" → Torre
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

##### T11 · La invitación — 25 s · ⚠ irrepetible

**Antes de grabar:** "Manage units" de Torre Núñez (donde terminó T10).

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00 | Clic en la flecha **"Back"** del header, y en **"Invite investor"**. | "Invite investor · Assign a unit". |
| 0:02–0:07 | "Email": tipeá `buyer@example.com`. | — |
| 0:08–0:11 | "Assigned unit": elegí **5A**. | — |
| 0:12–0:16 | "Amount": tipeá `185000`. | — |
| 0:17 | Clic en **"Send invitation"**. | El botón cargando. |
| 0:18–0:25 | **Quieto.** | — |

**⏸ CORTE ~1 min.** No hay campo de nombre: la invitación es email, unidad y monto.

#### Acto 3 · Investor

##### T12 · Aceptar — 35 s · ⚠ irrepetible

**Antes de grabar:** pestaña 1, en cualquier pantalla del investor ("My favorites" si la sesión A
fue recién). Antes de grabar, recargá
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

##### T13 · El portfolio — 35 s

**Antes de grabar:** "Updates", ya con la invitación aceptada.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00 | Clic en **"Units"** en la barra lateral. | "My units · What you bought". |
| 0:01–0:09 | Scroll lento. | Siete unidades: seis de Torre Volumen 3 (1A y 7A…7E) y la 5A de Torre Núñez. |
| 0:10 | Clic en la **5A**. | El detalle de la unidad. |
| 0:11–0:13 | **Quieto.** | El detalle de la 5A. |
| 0:14 | Clic en **"Open map"**. | El mapa a pantalla completa, con el pin que marcaste en T08. |
| 0:15–0:18 | **Quieto**, y cerrá (`Esc`). | — |
| 0:19 | Clic en **"View my unit in the building"**. | La grilla del edificio con **"Your unit"** resaltada y "Floor 5 · 5A · 85 m²". |
| 0:20–0:31 | **Quieto.** | Abajo, "Schematic view for reference. Final plans are in the dossier." |
| 0:32 | Cerrá (`Esc`) y scroll hasta **"Unit details"**. | Project, Unit, Floor, Surface, Total investment, Status. |
| 0:33–0:35 | **Quieto.** | — |

##### T14 · El contrato como registro — 25 s

**Antes de grabar:** el detalle de la 5A (donde terminó T13), con scroll hasta la sección "Contract
and payments" ("Amount: US$ 185,000") hecho antes de apretar grabar.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00 | Clic en **"View contract and payments"**. | "My contract and payments · 5A". |
| 0:01–0:12 | **Quieto.** | "Contract summary": "Total amount" y "Signing date". |
| 0:13–0:25 | **Quieto**, el mouse sobre la sección de abajo. | "Recorded schedule": **"No releases recorded yet."** — es lo correcto, no un bug (Anexo B). |

#### Acto 4 · Las cuatro aristas de la FSM ← el núcleo

**Todo sobre la misma etapa: la 1, "Land acquisition", de Torre Núñez**, para que se lea como un
solo objeto recorriendo una máquina de estados y no como cuatro cosas sueltas.

##### T15 · Subir evidencia — 40 s · ⚠ irrepetible

**Antes de grabar:** pestaña 2, `/developer/project/<nuevo>` (fuera de cámara: "Projects" → Torre
Núñez). **Antes de grabar**, abrí una vez el selector de archivos y navegá hasta
`~/Movies/propnexus-evidencia/` (Paso 0.2), así la próxima vez abre ahí.

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

##### T16 · La prueba, y afuera de la app — 26 s

**Antes de grabar:** el modal **"Evidence anchored"** ya abierto (se abre solo al terminar T15).

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00–0:07 | **Quieto**, el mouse sobre el "Merkle root". | "Evidence anchored", "Merkle root", el txid. |
| 0:08 | Clic en **"View on explorer"**. | Se abre cardanoscan (preprod) en otra pestaña. |
| 0:09–0:12 | Esperá que cargue. | — |
| 0:13–0:26 | **Quieto** sobre el hash de la transacción. **El plano más importante del video: el hash existe fuera de PropNexus.** | El TXID en cardanoscan. |

Al terminar, fuera de cámara: **cerrá esa pestaña** (`Cmd+W`), volvé a la pestaña 2 y clic en
**"Done"**.

##### T17 · El mismo anclaje, del otro lado — 35 s

**Antes de grabar:** pestaña 1, `/investor/unit/<5A>/notifications` (fuera de cámara: "Units" → 5A →
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

##### T18 · Observar — 40 s · ⚠ irrepetible

**Antes de grabar:** pestaña 3, `/certifier`. Recargá antes de grabar.

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

##### T19 · Reanudar — 20 s · ⚠ irrepetible

**Antes de grabar:** pestaña 2, `/developer`. Recargá antes de grabar.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00 | Clic en **"Progress"** en la barra lateral. | — |
| 0:01–0:08 | **Quieto.** | Arriba, "Observed stages": "Torre Núñez · Land acquisition" con pill **"Observed"**. |
| 0:09 | Clic en **"Resume stage"**. | El botón cargando. |
| 0:10–0:20 | **Quieto.** | — |

**⏸ CORTE ~1 min.** → arista **`Observed → InProgress`**. Esta sí es una acción deliberada del
developer: el backend no la dispara solo, a propósito. *(La pantalla no muestra el texto de la
observación: no lo digas en la voz.)*

##### T20 · Certificar — 20 s · ⚠ irrepetible

**Antes de grabar:** pestaña 3, `/certifier/stage/<id>` (el mismo de T18). Recargá antes de grabar: la
pill tiene que decir "In progress".

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00–0:04 | **Quieto.** | Pill "In progress", la evidencia. |
| 0:05 | Clic en **"Certify"**. | "Certifying…" |
| 0:06–0:20 | **Quieto.** | — |

**⏸ CORTE ~1 min.** → arista **`InProgress → Completed`**. La máquina de estados, entera.

##### T21 · El certificado — 15 s

**Antes de grabar:** la pantalla de la etapa, ya certificada.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00–0:02 | **Quieto.** | La pill "Certified". |
| 0:03 | Clic en **"Issued"** en la barra lateral. | "Issued certificates · Technical history". |
| 0:04–0:15 | **Quieto**, el mouse sobre la primera fila. | "Land acquisition", pill "Certified", su hash y su txid. |

##### T22 · El contrato del lado del developer — 25 s

**Antes de grabar:** pestaña 2, `/developer/project/<nuevo>`.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00 | Clic en **"Contracts"**. | — |
| 0:01–0:08 | **Quieto**, el mouse sobre las tres tarjetas. | "Contracts 1", "Agreed amount", "Anchored 1". |
| 0:09–0:25 | **Quieto**, el mouse sobre la fila. | "Unit 5A · US$ 185,000", "Signed on …", **"Recorded on chain"** y el txid. |

Los tres StatCard son hechos del registro, no un flujo de pagos — D-070.

#### Acto 5 · Dossier y escribano

**Volvemos a `torre-volumen-3`, unidad 1A** — la entregada. Un dossier final solo significa algo
sobre una obra terminada.

##### T23 · El dossier — 40 s

**Antes de grabar:** pestaña 1, `/investor/units`.

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

##### T24 · Compartir — 15 s

**Antes de grabar:** el dossier de 1A, arriba de todo.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00 | Clic en **"Share"**. | El modal "Share dossier". |
| 0:01–0:09 | **Quieto.** | "Read-only link. Whoever has it sees the hashes, not the platform." y el "Link". |
| 0:10 | Clic en **"Copy"** del link. | "Copied". |
| 0:11–0:15 | **Quieto**, y cerrá con **"Close"**. | — |

Fuera de cámara: **pegá el link en una nota** — lo usás en T27. No aprietes "Open view": abriría la
vista con esta misma ventana.

##### T25 · La firma — 35 s · ⚠ irrepetible

**Antes de grabar:** pestaña 4, `/notary`. Recargá antes de grabar.

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

##### T26 · El historial — 15 s

**Antes de grabar:** "Dossier review" de la 1A, ya firmado.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00–0:04 | **Quieto.** | Pill "Signed" y el **"Signature TXID"**. |
| 0:05 | Clic en **"Signed"** en la barra lateral. | "Signed dossiers · Signature history". |
| 0:06–0:15 | **Quieto**, el mouse sobre la primera fila. | El hash del dossier y el txid de la firma. |

##### T27 · Verificado sin cuenta — 25 s

**Antes de grabar:** una **ventana de incógnito**, armada así: `Cmd+Shift+N` → `Cmd+L` →
pegá el link de T24 (de la nota) → Enter → `Cmd` + `+` hasta 110% (incógnito no recuerda el zoom) →
`Cmd+Ctrl+F`. **Es el plano más fuerte del producto
entero**: tiene que verse que no hay sesión — sin barra lateral, sin campana, sin perfil.

| Tiempo | Acción | Lo que tiene que verse |
|---|---|---|
| 0:00–0:06 | **Quieto.** | "Public dossier", solo el toggle de idioma en el header. |
| 0:07–0:14 | **Quieto**, el mouse sobre el hash. | "Dossier hash" con el badge **"Signed"**. |
| 0:15–0:25 | Scroll lento. | La barra de avance, los hashes y el texto "This dossier records hashes and timestamps. It does not certify…". |

Al terminar, **cerrá la ventana de incógnito entera**.

**Fin de la sesión B.**

- [ ] `bash scripts/video-walkthrough/renombrar.sh B` → confirmá con `s`. Quedan `T07.mov` … `T27.mov`.

### Sesión C · Auditoría y el resto de las pantallas (T28–T31)

Siempre **después** de la sesión B: el audit log de T28 muestra lo que pasó en ella.

- [ ] Paso 1 hecho (si pasó tiempo desde la B). Pestañas 1 a 4 logueadas y en inglés. Pestaña 2 al
      frente, en `/developer`.

#### T28 · El círculo se cierra — 45 s

**Antes de grabar:** pestaña 2, `/developer`.

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

**Antes de grabar:** `/developer` (fuera de cámara: "Panel" en la barra lateral).

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

**Antes de grabar:** pestaña 2, `/developer/progress` (donde terminó T29).

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

**Antes de grabar:** pestaña 1, `/investor/menu`, con DevTools abiertas (`Cmd+Opt+I`) y la Device
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

**Fin de la grabación de pantalla.**

- [ ] `bash scripts/video-walkthrough/renombrar.sh C` → confirmá con `s`. Quedan `T28.mov` … `T31.mov`.
- [ ] Cerrá la sesión (Paso 6.1).

---

## Paso 3 · Recortar los 31 videos

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

**Si una toma quedó partida** (`T15.mov` y `T15b.mov`, Paso 1.7): recortá `T15` hasta antes del
error y `T15b` desde la acción siguiente; abrí `T15.mov` → Edición → **Agregar clip al final…** →
`T15b.mov` → `Cmd+S`. Después borrá `T15b.mov`.

- [ ] T01–T06
- [ ] T07–T11
- [ ] T12–T14
- [ ] T15–T22
- [ ] T23–T27
- [ ] T28–T31

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

1. A la izquierda, las 31 tomas: **"falta voz"** en amarillo, **"✓ voz"** en verde. Arranca sola en
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

#### Acto 1 · Investor (T01–T06)

##### T01 · Login, y el cambio de idioma — video 22 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | El login en castellano | PropNexus opens in Spanish, the default locale. |
| 0:05 | La pantalla pasa a inglés | The language toggle lives on the login screen itself. Both dictionaries are complete, so the whole interface switches. |
| 0:14 | Se tipea la contraseña | We sign in as the investor. |

##### T02 · Buy — video 35 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | Las tres cards | The investor's listing. Every list here is scoped by project membership: users only see the projects they belong to. |
| 0:13 | El campo de búsqueda | Search by area, filter by status… |
| 0:21 | El mapa (o la lista) | …and every view runs over that same scoped set. |

##### T03 · El proyecto por dentro — video 45 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | La portada | Project detail: gallery, estimated completion, and the location on a full-screen map. |
| 0:18 | Los documentos | The documentation section: every file with its own SHA-256 fingerprint and its anchoring badge. |
| 0:28 | "View developer" y la timeline | Then, who builds it, and how far along it is. |

##### T04 · Quién construye — video 40 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Grupo Alpine" | The developer behind it. |
| 0:08 | Las cuatro tarjetas | None of these four numbers is a stored column. Projects delivered, units sold and buyers are counted from the records; years in business is derived from the founding year. |
| 0:23 | "Previous projects" | Only the name, the bio and that year are declared. Each project card aggregates its own units for the starting price and the size range. |

##### T05 · Hasta la prueba — video 45 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | La lista de etapas | Ten stages, all ten completed, each with its own on-chain record. |
| 0:12 | El badge "Verified" | Inside a stage, the badge is backed by the transaction of its current state. |
| 0:19 | Los hashes de los archivos | Every file shows its SHA-256. |
| 0:26 | El modal de la etapa | The stage milestone groups them under the Merkle root of the bundle they were anchored in, with each file's path to that root. |
| 0:37 | "Blockchain verification" | And the transaction behind it, with its anchoring date. |

##### T06 · Favoritos — video 10 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "My favorites" | Favorites: the project saved a minute ago, one click away. |

#### Acto 2 · Developer (T07–T11)

##### T07 · El panel — video 30 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Developer panel" | Now the developer. |
| 0:04 | Los KPIs | These counters — projects, capital, units, progress, and documents anchored on chain — are aggregates over the same membership-scoped queries. |
| 0:20 | "My projects" | And the developer's projects. |

##### T08 · Proyecto nuevo — video 40 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | El formulario vacío | A new project. Typing the address moves the pin on the map, and a click fine-tunes it: no project is created without a location. |
| 0:14 | El pin en el mapa | Creating it writes the ten stages in a single database transaction, then mints one on-chain thread per stage, one at a time. The validator rejects more than one thread per transaction, so they can't be batched. |
| 0:35 | El clic en "Create project" | That's why this step takes a few minutes. |

##### T09 · El proyecto ya creado — video 30 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Torre Núñez" | The new project, at zero percent. |
| 0:05 | Las cuatro acciones | Four actions: units, invitations, evidence, and contracts. |
| 0:18 | Las diez etapas "Pending" | Its ten stages already exist, all pending. Their order, and the moment they were declared, were anchored before any work began. |

##### T10 · Unidades — video 32 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | Los contadores en cero | Unit inventory, starting empty. |
| 0:05 | Se tipea "5A" | We add unit 5A: its floor and its surface. |
| 0:21 | La card de la 5A | It appears available and unassigned, and the counters follow. |

##### T11 · La invitación — video 25 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Invite investor" | The invitation: the buyer's email, the unit, and the amount. |
| 0:17 | El clic en "Send invitation" | Sending it reserves the unit for that buyer. |

#### Acto 3 · Investor (T12–T14)

##### T12 · Aceptar — video 35 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | La campana | Back to the investor. The invitation arrives as a notification, pinned at the top. |
| 0:11 | El modal | Project, unit, total amount, estimated handover — and the invitation itself is anchored on-chain. |
| 0:24 | El clic en "Accept invitation" | Accepting it is what writes the contract. |

##### T13 · El portfolio — video 35 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "My units" | The portfolio now holds units in two very different situations: six in a delivered building, and one just bought off-plan. |
| 0:14 | El mapa | Inside the new one: the location its developer marked… |
| 0:19 | El esquema del edificio | …and the building schematic, with this unit highlighted on its floor. It's labelled as a reference view: the final plans live in the dossier. |

##### T14 · El contrato como registro — video 25 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Contract summary" | The contract screen is a record, not an action surface: the agreed amount and the signing date. |
| 0:13 | "No releases recorded yet." | No release button, by design. Payments happen outside the platform, which never holds funds. |

#### Acto 4 · La FSM (T15–T22)

##### T15 · Subir evidencia — video 40 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Upload evidence" | Evidence upload, against a stage that is still pending. |
| 0:09 | El selector de archivos | The file type is checked from its first bytes, not from the content type the browser declares. |
| 0:28 | El clic en "Anchor evidence" | And there's no separate start button: the first evidence on a pending stage is the transition to in progress. |

##### T16 · La prueba, y afuera de la app — video 26 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Evidence anchored" | The files are hashed, combined into a Merkle root, and that root goes into a Cardano transaction. |
| 0:13 | Cardanoscan | Here it is on a public explorer, outside PropNexus. |

##### T17 · El mismo anclaje, del otro lado — video 35 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Unit updates" | The same upload, from the investor's side: the update arrives on the unit. |
| 0:14 | El modal de la etapa | Every file's hash, and the package Merkle root — the same number the developer just saw. One role produces it; another can check it. |

##### T18 · Observar — video 40 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Certifier panel" | The certifier. The new stage has just entered the queue, because work on it started. |
| 0:13 | "Evidence uploaded by the developer" | Inside, the evidence the developer uploaded, file by file, with its hash. |
| 0:24 | El modal "Observe stage" | Observing sends the stage back with a note. That transition is anchored too. |

##### T19 · Reanudar — video 20 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Observed stages" | The developer sees the stage come back as observed. |
| 0:09 | El clic en "Resume stage" | Resuming is a deliberate action: it's the one transition the backend never fires on its own. |

##### T20 · Certificar — video 20 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | La pill "In progress" | The stage is back in progress. |
| 0:05 | El clic en "Certify" | Certifying closes it. Four transitions, each one recorded on-chain. |

##### T21 · El certificado — video 15 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | La pill "Certified" | Certified. |
| 0:04 | "Issued certificates" | Each certificate, with its hash and the transaction that anchors it. |

##### T22 · El contrato del lado del developer — video 25 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | Las tres tarjetas | The same contract, from the developer's side. |
| 0:09 | La fila de la 5A | Which unit, how much, when it was signed, and the transaction that records it. These counters are facts from the registry, not a payment flow. |

#### Acto 5 · Dossier y escribano (T23–T27)

##### T23 · El dossier — video 40 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | El detalle de la 1A | Back to the delivered building: unit 1A, and its dossier. |
| 0:06 | "Cryptographic certification" | It records hashes and timestamps. It doesn't certify the construction. |
| 0:13 | La barra de avance | The dossier is compiled on read: its hash is computed at fetch time, over every anchored artifact listed below, in a fixed order. If anything it commits to changed, the hash would change with it. |

##### T24 · Compartir — video 15 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Share dossier" | Sharing generates a read-only link with its own token. Whoever has it sees the hashes, not the platform. |

##### T25 · La firma — video 35 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Notary panel" | The notary. Opening the dossier is what put it in this queue. |
| 0:11 | "Dossier review" | The review shows the same dossier hash, and its artifacts. |
| 0:21 | El texto de abajo | The disclaimer says what a signature means: that these hashes were reviewed at this moment — not that the documents are authentic. |

##### T26 · El historial — video 15 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Signature TXID" | Once signed, the hash is frozen, and the signature has its own transaction. |
| 0:08 | "Signed dossiers" | The notary's history: each dossier hash next to the transaction of its signature. |

##### T27 · Verificado sin cuenta — video 25 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Public dossier" | The public route takes that token and nothing else: a private window, no account, no session. |
| 0:09 | El badge "Signed" | Anyone with the link — a bank, another notary — sees the dossier hash and the notary's signature, without being a user of the platform. |

#### Acto 6 · Auditoría y resto (T28–T31)

##### T28 · El círculo se cierra — video 45 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Audit log" | The audit log. Every step in this video is here: the project, the invitation, the evidence, the observation, the certification, the signature. |
| 0:14 | La lista, bajando | Each one with its actor, role, category and timestamp. |
| 0:21 | El filtro "stage" | Filterable by category… |
| 0:32 | "Blockchain verification" | …and each transaction opens with its anchoring date and a link to the public explorer. |

##### T29 · El resto del developer — video 75 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | "Documentation" | The rest of the developer's surface. Supporting documentation, each file with its anchoring status. |
| 0:16 | "Investors" | The investor directory, with each investor's units and amount. |
| 0:31 | "Capital raised" | Capital raised, month by month and by project — as recorded in the contracts, not as funds held. |
| 0:47 | "Units" | The unit inventory, and its occupancy. |
| 1:01 | "Construction progress" | And construction progress, across every development. |

##### T30 · Perfiles y menú — video 60 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | El perfil del developer | Each role has its own profile, with notification preferences by category. |
| 0:14 | El perfil del certifier | The certifier… |
| 0:27 | El perfil del escribano | …the notary… |
| 0:40 | El perfil del investor | …and the investor. |
| 0:51 | "Menu" | Plus a menu that gathers the investor's sections in one place. |

##### T31 · Responsive — video 30 s

| Tiempo | Entra cuando ves | Texto |
|---|---|---|
| 0:01 | El teléfono emulado | The design is mobile-first. At phone width, the sidebar becomes a bottom navigation bar, with Buy in the middle. |
| 0:15 | El detalle de la unidad | Every screen in this video works in a single column. |

- [ ] En el estudio, las 31 tomas dicen "✓ voz".

---

## Paso 5 · Unir todo

- [ ] En la carpeta están `T01.mov` … `T31.mov` y las 31 voces (el estudio lo muestra: todas en
      verde).

**Con ffmpeg** (esta Mac lo tiene) — más rápido:

```bash
bash scripts/video-walkthrough/unir.sh
```

Una línea por toma (`T01: video 22 s, voz T01.webm -> queda en 22 s`) y al final **`LISTO:
…/walkthrough-final.mp4 (+ walkthrough-final.srt)`**. Son unos minutos, con la Mac enchufada.

**Sin ffmpeg** — desde el estudio, botón **"Armar el video final"** (abajo a la izquierda). Arma el
video en tiempo real (~17 min): **no cambies de pestaña ni minimices Chrome** mientras corre. Deja
`walkthrough-final.mp4` y `walkthrough-final.srt` en la carpeta.

**Qué hacen los dos, para que sepas qué esperar:**

- Cada toma dura **lo que dure el más largo** entre video y voz, más medio segundo: si la voz es más
  larga, la imagen se congela en el último cuadro; si es más corta, el resto va en silencio.
- Todas quedan en 1920×1200; T31 (el teléfono) sale centrada sobre fondo blanco.
- **`walkthrough-final.srt`** son los subtítulos en inglés, sacados del texto del Paso 4.3 con los
  tiempos reales de cada toma. Se suben junto al video (YouTube los acepta tal cual).

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
| **El que nace** | El que se crea **en cámara** en T08, con sus 10 etapas en `Pending` | El alta, la invitación, y **el recorrido completo de la FSM sobre una sola etapa**. |

| | Decisión | Por qué |
|---|---|---|
| **Idioma** | Abre en `es-AR` (default) y **se cambia a `en-US` en el login, antes de entrar**. | Catalyst revisa en inglés, y el cambio en cámara muestra la localización como feature. Los dos diccionarios están completos y la paridad la fuerza el compilador (`dictionary.ts`). |
| **Entorno** | Producción: `propnexus-web.onrender.com`. Nunca local. | El video tiene que mostrar TXIDs reales en Preprod y la URL pública viva — parte de lo que sostiene el criterio 5. |
| **La FSM** | **Las cuatro aristas, sobre la misma etapa**: subir evidencia → observar → reanudar → certificar. | Es la máquina de estados entera contada sobre un solo objeto. |
| **Tomas** | 31 tomas cortas, cortadas donde hay espera, con video y audio por separado. | Cada acción on-chain tarda ~45 s y crear un proyecto bloquea ~6 min. Una toma continua es imposible, y con la toma como unidad los tiempos de pantalla y voz se cuentan desde el mismo 0:00. |
| **Orden del final** | La firma del escribano (T25) va **antes** de la vista pública (T27). | La vista pública muestra el dossier **ya firmado**, con su badge "Signed". Cambió el 2026-09-28. |

**Los tiempos de espera** salen de
[`REPORTE-2026-09-10-prueba-de-volumen.md`](REPORTE-2026-09-10-prueba-de-volumen.md) §Cronología
(180 anclajes reales contra Preprod). **La cobertura:** las 31 tomas recorren todas las rutas de
`apps/web/src/routes` salvo `/admin`, que se usa fuera de cámara.

## Anexo B · Lo que el video no muestra, y por qué

Para no prometer en audio algo que la pantalla no hace:

- **Lo que la versión del 2026-09-21 prometía y la app no hace** (verificado contra el código el
  2026-09-28, y ya sacado del Paso 2 y del Paso 4 — no lo vuelvas a poner):
  - la invitación **no tiene campo de nombre**: es email, unidad y monto (T11);
  - ~~el alta de proyecto no tiene vista previa de mapa (T08)~~ — **ahora sí** (D-097, 2026-09-28): la
    dirección mueve el pin y un clic lo ajusta;
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
  uno de los cuatro roles del SOM; se usa fuera de cámara para invitar al certifier (corte de T08). No lo
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
| `torre-pending-test` | 10 | 9 Pending, 1 InProgress | dev | — | 12 |
| `torre-belgrano` / `torre-demo-e2e` | 0 | — | dev | — | 0 |

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

- **Los tres `torre-volumen-*` pasaron de `planning` a `completed`.** Figuraban como
  "Pre-construction" teniendo las 10 etapas certificadas: incoherente en cámara y sin sentido para el
  filtro de T02. Ahora el filtro tiene dos valores reales — los tres Volumen en **"Delivered"** y el
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
proyecto nuevo, desde la web, durante el corte de T08.

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

### C.3 Cómo quedaron las tres colas, verificado contra la API

| Cola | Estado hoy | Cuándo se llena |
|---|---|---|
| **Certifier** — "Assigned" | **vacía** (las 2 etapas de `torre-a` eran todo lo que tenía) | En **T15**: la evidencia que sube el developer pone esa etapa en `InProgress` y ahí aparece. Es la narrativa correcta — llega una etapa nueva para certificar, en vez de una cola preexistente sin explicación. |
| **Certifier** — KPIs e "Issued" | **30 certificadas, 30 certificados emitidos** con hash y TXID reales de la prueba de volumen | Ya está. El panel del certifier tiene historia real sin que haga falta preparar nada. |
| **Escribano** — "Pending review" | **vacía** (`[]`) | En **T23**, cuando el investor abre el dossier de 1A y eso lo compila. Se usa en **T25**. |
