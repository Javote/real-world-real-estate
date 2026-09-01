# CLAUDE.md

Lo transversal. Lo de cada frente vive en `apps/web/CLAUDE.md`, `apps/api/CLAUDE.md`,
`packages/cardano/CLAUDE.md` y `contracts/CLAUDE.md`, y se carga solo cuando tocás ese subárbol.

**Acá solo hay información vigente.** El porqué de cada decisión está en `DECISIONS.md`; el
argumento largo, en `specs/archive/`.

## Contexto

**PropNexus** (Catalyst 1400106) — plataforma de ventas inmobiliarias en pozo: estructura el ciclo
de obra en **stages**, organiza **evidencia** (planos, permisos, actas, certificados) y ancla
**huellas criptográficas** (SHA-256/Merkle) en **Cardano** con timestamps. Off-chain: documentos,
PII y lógica de negocio. On-chain: solo commitments y TXIDs — **nunca valor**. Cuatro roles con
superficie propia: investor (INV), developer (DEV), notary (NOT), certifier (CER).

**El problema real.** Hoy es imposible verificar el estado de los procesos de aprobación de una obra
en pozo: la evidencia está dispersa en canales informales y nada garantiza que lo que se muestra hoy
sea lo que existía ayer. Esa opacidad ya causó daño económico real a compradores.

**Lo que NO hace.** No certifica, no valida y no decide nada. Solo puede sostener cuatro
afirmaciones: *este archivo tiene este hash* · *se registró en este momento* · *declara provenir de
esta autoridad externa* · *esta persona atestiguó haberlo revisado*. Si escribís copy, modelo o
validador que afirme algo más, está mal (D-026).

---

# Estado, y lo próximo

**La instancia desplegada arranca en modo real contra Cardano Preprod** desde el 2026-08-31:
`AnchorPort listo en modo "real"` en los logs, con la wallet de servicio derivada de su clave.
**Todavía no ancló nada** — `OnChainEvent` tiene 0 filas en producción. Son dos afirmaciones
distintas y esta sección supo confundirlas: *arrancar* en real es configuración, *anclar* es prueba.
Lo que se hizo para llegar está en `DECISIONS.md` (D-075 → D-083) y en
`specs/PLAN-2026-08-31-anclaje-real.md`; los números medidos, en `specs/README.md`. Acá solo lo que
falta.

| # | Qué | Por qué ahí | Nivel |
|---|---|---|---|
| 0 | **Re-sembrar producción** | La base se reconstruyó vacía: hoy hay **0 usuarios** y nadie puede entrar. Lo corre el dueño porque el seed exige `SEED_ADMIN_PASSWORD` y `SEED_DEMO_PASSWORD` (D-047) | 🔴 *dueño* |
| 1 | **Publicar el reference script** en Preprod (D-083) | El validador viaja adjunto hasta que exista el UTxO. Se descubre al arrancar, así que después hay que reiniciar | 🟡 *operativo* |
| 2 | **Primer anclaje real de punta a punta** | Recién acá "arranca en real" pasa a "ancla de verdad", y ya sale con la transacción barata | 🟢 |
| 3 | **Defensa 3**: que el simulador devuelva `Pending` y no `Confirmed` | Alinea el simulador con el real, para que `Confirmed` signifique sin excepción *algo consultó la cadena*. La defensa 2 (`anchorMode`) ya está **rechazada** por D-080 | 🟡 *decide el dueño* |
| 4 | **7 superficies** (46/53) y los patrones M2-D4 (8/10) | Backlog de transcripción. El test ID que falta (D-070) no es deuda | 🟢 |
| 5 | **Correr el security review** | Criterio 11 del SOM: el P1 conocido está cerrado, pero el review nunca se corrió | 🟢 |
| 6 | **Mainnet** — runbook, habilitar la red, custodia de la clave | D-013 la hace **imposible por configuración**: es código, no solo procedimiento | 🔴 |

**Cerrados el 2026-09-01:** el reference script (D-083) y su cobertura contra un nodo real; `network`
e `issuingAuthority`, aplicadas en producción **sin dejar de tener un solo archivo de migración**
(D-085); y D-028, acotada por D-084 y D-086.

**El 0 bloquea todo lo demás**: sin cuentas no hay forma de entrar a la instancia, y el primer
anclaje real (2) se dispara desde la app. El 1 conviene antes que el 2 para que el primer anclaje ya
salga con la transacción barata, pero no lo bloquea: sin reference script todo funciona igual, más
caro.

# Cómo se trabaja acá

**El diseño ya está decidido. El trabajo es transcribirlo, no inventarlo.**

`docs/` tiene 70 capturas y un backlog de 53 superficies donde cada una ya trae su path, sus
componentes, sus endpoints y sus test IDs. No hay nada que diseñar y no hay reunión que tener.

## El loop, por pantalla

```
1. abrir la captura           docs/milestone-2-diseno/M2-D2-Screenshots-catalog/<N>-*.png
2. abrir su fila              docs/milestone-3-implementacion/UI-implementation-plan.md  (M2-D5)
3. transcribir                los componentes que la fila nombra, ninguno más
4. endpoints                  los de la fila; si no existen, se crean con la forma que la fila pide
5. test IDs                   los de la fila, literales
6. pnpm verify
7. commit                     con el ID de M2-D5 entre corchetes
```

**Las capturas se leen.** Son PNG y se abren con la herramienta de lectura: no hay que adivinar
espaciados ni colores mirando prosa.

## Las cinco reglas del loop

1. **Cuando la prosa y la captura difieren, gana la captura.** M2-D3 describe; M2-D2 muestra.
   **Excepción (D-074):** el `GradientHeader` autenticado es siempre logo + campana + perfil +
   idioma. Si la captura omite el logo o las utilidades, no se transcribe esa omisión.
2. **Ningún componente que M2-D3 no defina.** Si hace falta uno nuevo, es una decisión nueva, no un
   archivo nuevo.
3. **Ningún estado que M2-D3 no liste.** *"Never invent new statuses; choose the closest semantic
   mapping."*
4. **Ninguna superficie sin sus test IDs.** Una pantalla sin `data-testid` no está terminada — es
   evidencia que pide el SOM, no un lujo.
5. **Los tokens no se eligen, se transcriben.** El hex de M2-D3 es normativo.

## Antes de empezar una superficie

| Vas a tocar | Leé primero |
|---|---|
| Cualquier pantalla | su captura + su fila de M2-D5 + `M2-D1` (permisos del rol) |
| Algo que muestre hash, TXID o Merkle root | `M2-D4` — los 10 patrones son **normativos** |
| Un componente | su ficha en `M2-D3 §Component Library` |
| Un endpoint | `M2-D5` §4-6 (path, test IDs, work stream) + `M2-D6` §9 |
| Un validador | `M1-D1` §Workflow + D-020 (FSM) + D-021 (nunca valor) |
| El modelo de datos | `M1-D2` + `M2-D1` §4 (matriz de permisos) + D-029 |

No leas los cuatro entregables por costumbre: son ~25k tokens. Abrí lo que la fila pide.

---

## Jerarquía de precedencia

- **Obligaciones (el *qué*): manda `docs/`.** Ninguna decisión puede reducir lo que debemos.
  **`docs/` es inmutable** — ni para corregir un error evidente (D-022).
- **Implementación (el *cómo*): `DECISIONS.md` > `CLAUDE.md` > `specs/`.**

Un desvío solo es legítimo si (a) el entregable se contradice internamente, (b) es un error de
redacción, o (c) seguirlo al pie contradiría una verdad del producto declarada por el dueño.
**Nunca por conveniencia ni por preferencia técnica.** Los desvíos vigentes están listados en
`DECISIONS.md`.

Ante contradicción entre documentos: gana el de mayor precedencia y el otro se corrige **en el mismo
commit**. Si la contradicción es con código, avisá antes de "arreglar" nada.

**Y antes de declarar que un entregable está mal: verificá que estás mirando el entregable.** Ya nos
pasó decidir contra una transcripción errónea (ver Trampas).

---

# Reglas duras (innegociables)

1. **Datos primero:** dinero jamás en float — montos en unidades enteras mínimas (lovelace como
   `bigint`; fiat en centavos). Timestamps en UTC. IDs opacos.
2. **Cero PII on-chain o en logs:** ni nombres, ni emails, ni URLs internas, ni nombres de archivo en
   metadata, datums o logs. Solo hashes y refs opacas. Strings de metadata ≤ 64 bytes.
3. **El hash es el ticket de entrada a la cadena de prueba** (D-027). Si un archivo tiene
   `sha256Hash`, termina anclado — o se muestra "Pendiente", **nunca** "Verificado".
4. **Passwords solo con bcrypt** (cost 10, D-046). Jamás loguear ni devolver `passwordHash`.
5. **Autorización en dos capas, siempre:** rol global (`requireRole`) + membresía por proyecto
   (`requireProjectAccess`). La matriz completa está en M2-D1 §4.
6. **Todo body se valida con Zod**, y el schema vive en `packages/shared` **antes** que el endpoint.
7. **Toda mutación relevante escribe `AuditLog`** (append-only) con actor, entidad, acción, timestamp.
8. **Idempotencia en todo lo que toca chain:** re-ejecutar un anclaje o una migración no duplica
   efectos.
9. **La FSM del stage es una sola** (D-020), en `packages/shared` y espejada en Aiken. Si cambia una,
   cambian las dos en el mismo commit.
10. **Uploads:** solo `application/pdf`, `image/jpeg`, `image/png`; máximo `MAX_FILE_SIZE_MB`. Si un
    upload falla la validación después de escribirse, **borrar el archivo huérfano**.
11. **`contracts/plutus.json` se commitea** tras cada `aiken build`; direcciones derivadas del
    blueprint, jamás hardcodeadas.
12. **Secrets solo por env.** Si ves una seed o una key commiteada: frená y avisá.
13. **Ningún validador custodia ni transfiere valor** (D-021).
14. **Cero strings hardcodeados en la UI** (D-025). Todo texto sale del diccionario; moneda, fecha y
    decimales con `Intl.*`. Default `es-AR` con voseo.
15. **El backend devuelve claves de traducción, nunca copy** (M2-D4 §8.2).
16. **Los hashes viajan completos al cliente.** La truncación 6+4 es de presentación y la hace
    `HashChip`. Los TXID son case-sensitive y viajan verbatim.
17. **Nunca mostrar una señal de prueba que no puedas sustanciar** (M2-D4 §6.2). Sin TXID, el estado
    es "Pendiente".

# Prohibiciones

- No inventar componentes, estados, endpoints ni superficies fuera de `docs/` — proponer, no improvisar.
- **Nunca "milestone" para una etapa de obra: es `stage`** (D-067). El riesgo sigue vivo porque los
  entregables usan la palabra y el código ya no. **Excepción:** los test IDs de M2-D5 se transcriben
  literales, incluso `INV-STAGE-MILESTONE-001`.
- No abrir un modal de verificación automáticamente (M2-D4 §6.3). Toda superficie de prueba es
  iniciada por el usuario; la única excepción es `AnchoringSuccessModal`.
- En el front, no hacer `fetch` fuera de `ApiPort`.
- No importar Lucid/Blockfrost fuera de `packages/cardano` (D-014).
- No migrar lógica de negocio on-chain: el backend es fuente de verdad del **registro** (D-007).
- No tocar mainnet: `CARDANO_NETWORK=Preprod` siempre (D-013).
- **No editar migraciones aplicadas** — con la condición de D-063: mientras la única base sea local,
  el esquema se corrige editando el archivo y borrando la base. Con Turso vivo, se termina.
- No tocar `contracts/build/` ni editar `aiken.lock` a mano.
- No commitear `.env`, `apps/api/.data/` (las bases locales), `uploads/` ni artefactos de build.
- No "arreglar" tests cambiando contratos de API o esquema de DB para que pasen.
- **No editar nada dentro de `docs/`** (D-022).

---

# Estructura

```
apps/api          Express 5 + Kysely      → servicio en Render
apps/web          TanStack Router + Vite  → static site en Render (SPA + PWA)
packages/shared   contrato Zod (oRPC)     → lo importan los dos
packages/cardano  AnchorPort              → lo importa la API
contracts/        Aiken · Plutus V3       → no se hostea, toolchain aparte
```

`packages/shared` es lo único que vuelve el drift **imposible** en vez de prohibido. `contracts/` no
está en el workspace pnpm a propósito: otro toolchain, otro lockfile, otra caché.

Tres `.md` en la raíz: **`README.md`** (entrada humana), **`CLAUDE.md`** (este) y **`DECISIONS.md`**
(las restricciones). El mapa de desarrollo en `specs/README.md`; los entregables en `docs/`, mapeados
en `specs/entregables.md`.

| Qué | Dónde |
|---|---|
| Obligaciones, la vara de aceptación | `docs/` (inmutable) |
| Qué archivo de `docs/` es qué entregable | `specs/entregables.md` |
| Qué obliga una decisión | `DECISIONS.md` |
| Por qué se decidió (argumento largo) | `specs/archive/` |
| Reglas y trampas de un frente | `<frente>/CLAUDE.md` |
| Invariantes de una rebanada | `specs/SPEC-NNN` |
| Stack, versiones e infraestructura | `specs/stack.md` |
| Deploy, rollback e incidentes | `specs/RUNBOOK-deploy.md` |

# Stack

| Frente | Con qué | Decisión |
|---|---|---|
| **web** | TanStack Router + Vite (SPA, sin SSR) · React 19 · Tailwind v4 · shadcn/ui · Lucide · PWA | D-065, D-024 |
| **api** | Express 5 + oRPC + Zod + JWT + bcrypt(10) + Multer + helmet, base `/api/v1` | D-066, D-054 |
| **shared** | Zod — el contrato único. El schema va acá **antes** que el endpoint | D-012, D-066 |
| **db** | Kysely · SQLite en dev · Turso en prod · una sola migración | D-038, D-063 |
| **cardano** | `AnchorPort` con adaptadores `simulated` y real (Lucid Evolution) | D-014, D-060 |
| **contracts** | Aiken v1.1.21 · Plutus V3 · stdlib v3.0.0 · blueprint commiteado | D-019, D-058 |
| red | **Preprod siempre**; mainnet fuera de alcance | D-013 |

El inventario completo —versiones reales, qué corre y qué está solo decidido— vive en
`specs/stack.md` y solo ahí (D-034).

---

# Niveles de autonomía

| Nivel | Qué cubre | Cómo se trabaja |
|---|---|---|
| 🟢 Verde | Componentes según M2-D3, superficies según M2-D5, tests, docs, seeds | El LLM implementa directo |
| 🟡 Amarillo | Migraciones, auth/permisos/guards, `packages/cardano`, archivos/S3, CI/deploy, **validadores Aiken** | El LLM propone; revisión humana línea por línea |
| 🔴 Rojo | Claves y firmas, `SERVICE_WALLET_PRIVATE_KEY`, hashing y construcción de commitments | El humano lidera; el revisor debe poder explicar cada línea sin mirar el chat |

Si dudás del nivel, es el más alto de los dos.

# Commits y ramas

`<tipo>(<scope>): <descripción en imperativo, minúscula, sin punto final> [<REF>]`

- **Tipos:** `feat` · `fix` · `refactor` · `test` · `docs` · `chore` · `perf` · `db`
- **Scopes:** `web` · `api` · `db` · `shared` · `cardano` · `contracts` · `ci` · `repo`
- **REF:** el ID de M2-D5 cuando aplique (`[M3-FE-18]`, `[INV-BUY-LIST-001]`) o la decisión (`[D-065]`)

Un commit = un cambio lógico · el cuerpo explica el *por qué* · `BREAKING CHANGE:` si rompe contrato
de API o esquema on-chain. **`main` es la rama de integración y no hay PRs** (D-030).

**Testear, commitear y pushear son una sola unidad de trabajo.** `pnpm verify:all` en verde →
`git commit` → `git push`, siempre juntos y en ese orden. No se junta trabajo local "para pushear al
final", y no se commitea sin el verde.

**Por qué es regla y no gusto:** un commit local no existe para nadie más, y el remoto queda
afirmando un estado que no es el real — el mismo modo de falla que el push contra un servicio
suspendido y que el TXID simulado en producción. **No falla: miente.** Si pushear tiene una
consecuencia que el dueño debería saber —acá el deploy automático de Render, que el `buildFilter`
no filtra—, se pushea igual y se avisa; no se retiene el push por eso.

**La documentación viaja con el código que la causa, en el mismo commit.** Un cambio que altera cómo
se opera, se configura o se despliega algo llega con su documentación adentro — no en un `docs(...)`
posterior. Un `docs(...)` suelto es legítimo solo cuando el cambio **es** documentación: sanear algo
desactualizado, cerrar una decisión, escribir una trampa recién aprendida.

**Por qué es regla y no gusto:** el 2026-08-27 el commit de R2 salió sin cerrar D-051, y durante tres
commits `DECISIONS.md` afirmó que la evidencia era efímera mientras la evidencia ya vivía en R2. La
ventana entre el código y su documentación es una ventana en la que el repo miente, y quien lea en
el medio no tiene forma de saberlo.

# Comandos

```bash
pnpm install                      # bootstrap del workspace
pnpm dev                          # web + api en paralelo
pnpm verify                       # app TS: lint + typecheck + tests + build
pnpm contracts:verify             # Aiken: fmt + check + build
pnpm verify:all                   # las dos, encadenadas
pnpm lint:fix                     # Biome arregla lo mecánico

pnpm --filter @plataforma/api test:s3         # storage contra MinIO real
pnpm --filter @plataforma/cardano test:yaci   # anclaje contra un nodo Cardano real
docker compose -f compose.dev.yml up -d       # solo si querés la infra levantada aparte
```

**TypeScript y Aiken no se mezclan:** distinto toolchain, distintos artefactos, distintos modos de
falla. El CI los corre como dos jobs en paralelo. Los dos últimos comandos **no corren en CI** (no
levanta infraestructura): se corren a mano.

Los comandos por frente (`db:migrate`, `db:seed`, `e2e`) están en el `CLAUDE.md` de cada uno.

---

# Trampas transversales

Sección viva: agregá acá el mismo día que te muerda una. Las de cada frente van en su `CLAUDE.md`.

- **Las capturas de M2-D2 tienen datos mock, no datos de diseño.** M2-D1 lo dice: *"the maquette uses
  mock blockchain interactions"*. Lo normativo de una captura es la **estructura** —layout,
  componentes, jerarquía, estados—; los valores no. La captura 55 muestra tres unidades del mismo
  proyecto en tres stages distintos y casi nos hace modelar stages por unidad, cuando el dominio dice
  que un desarrollo tiene un solo trámite (D-029).
- **Antes de concluir que un entregable está mal, verificá que estás mirando el entregable.** Cuatro
  `.puml` regenerados desde los PDF de M1 tenían las flechas de la FSM invertidas, y durante una
  sesión entera creímos que el entregable estaba mal. El paquete canónico es
  `M1-D2-Architecture-and-Data-Models/`, hasheado en la Proof of Achievement.
- **Grepear solo `*.md` esconde entregables.** Una búsqueda con `--include="*.md"` concluyó que algo
  no aparecía en `docs/`; estaba en un `.csv`. Grepeá sin filtro de extensión.
- **Los códigos de entregable se reinician en cada milestone y colisionan**: `M1-D1` es el whitepaper,
  `M2-D1` es el mapa de arquitectura de información. Al citar, usá siempre la forma completa
  (`M2-D1 §4`). Y `M2-D5`/`M2-D6` son entregables de **Milestone 2** aunque vivan en la carpeta de M3.
- **Los PDF de este repo no se leen con la herramienta de lectura** (falta `pdftoppm`). Las capturas
  PNG sí. Para un PDF: `qlmanage -t -s 1800 -o <dir> archivo.pdf`.
- **Un verificador que vive dentro del corpus que verifica se encuentra a sí mismo.** Un guardia que
  matcheaba la mención de `docs/` se bloqueó al escribirse. **Antes de agregar un verificador,
  preguntá si el problema no se arregla mejor cambiando la forma de lo verificado** (D-053).
- **Editar un `package.json` sin correr `pnpm install` produce un verde falso.** Lo atrapa
  `pnpm install --frozen-lockfile` en CI, y alcanza. Un verde sobre el entorno equivocado es peor que
  un rojo.
- **`pnpm.overrides` vive en `package.json` y pnpm 10+ dejó de leerlo.** El pin
  `"packageManager": "pnpm@9.15.0"` es lo único que hoy lo sostiene: un pnpm más nuevo instalado en
  la máquina delega a 9.15.0 y el override se aplica igual —lo prueba la línea 8 de `pnpm-lock.yaml`
  y que `@types/express` resuelva a 5.0.6—, pero avisa `The "pnpm" field in package.json is no longer
  read by pnpm`. **Ese warning no es ruido: es la cuenta regresiva.** El día que se suba el pin a
  pnpm 10+, los overrides se ignoran **en silencio** y sin romper el build; hay que moverlos a
  `pnpm-workspace.yaml` en el mismo commit que sube la versión.
- **`pnpm verify` corre contra el entorno de test, no contra el que declara `render.yaml`.** Entre
  los dos no había nada, y una regresión de configuración solo se veía en los logs del deploy.
  Lo cierra `apps/api/test/render-config.test.ts` (D-076). **Si agregás una lectura de `env.*`
  nueva, declarala en `render.yaml` o el test se pone rojo** — que es el punto.
- **Las capturas del developer no coinciden en el header.** Documentación (46) va sin logo, Audit
  log (49) va con logo, ninguna trae campana ni idioma, y M2-D3 dice *never omit the logo*. No se
  transcribe captura por captura: D-074 unifica. Si una pantalla nueva "sigue la captura" y saca el
  logo, está mal.
