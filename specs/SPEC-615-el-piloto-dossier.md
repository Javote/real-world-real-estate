# SPEC-615 — A3 + W3: el piloto `dossier`, de punta a punta

> Fase 2, pasos A3 y W3 ([`SPEC-611`](SPEC-611-la-migracion-fase-2.md)); el estado, en
> [`specs/README.md`](README.md). Nivel 🟡: toca la firma, que ancla. El análisis completo del módulo
> está en [`AUDITORIA-2026-10-01`](AUDITORIA-2026-10-01-arquitectura-api-y-web.md) §8; acá va lo que
> se hace y cuándo está terminado. **Depende de A2 y de W2.**

## Por qué este

Es chico (9 endpoints, 6 pantallas), cruza tres roles (notary, investor, público), toca la cadena y
ya tuvo el bug de reclamar antes de anclar. Si la forma de la auditoría §2 y §3 funciona acá,
funciona en el resto. **Si no, acá se frena** (§La regla de salida).

## La superficie

| Lado | Qué |
|---|---|
| API | `notary.routes.ts`: `GET /kpis`, `GET /dossiers/pending`, `GET /dossiers/{id}`, `POST /dossiers/{id}/sign`, `POST /dossiers/{id}/reject`, `GET /signatures` · `investor.routes.ts`: `GET /units/{id}/dossier`, `GET …/dossier/export.pdf`, `POST …/dossier/share` · `public.routes.ts`: `GET /dossier/{shareToken}` · `domain/dossier.ts` |
| Web | `notary.index`, `notary.dossiers`, `notary.signed`, `notary.dossier.$dossierId`, `investor.unit.$unitId.dossier`, `public.dossier.$shareToken` · `PendingDossiersQueue`, `ShareDossierModal` |
| Arnés | `dossier.test.ts`, `dossier-unico-por-unidad`, `spec-211-limite-dossier-publico`, `orpc-client-notary`, `orpc-client-public`, `notary-coverage`, `dossier-recompile-coverage` · e2e `notary-certifier.spec.ts`, `investor-surface.spec.ts`, `walkthrough.spec.ts` |

## Decisiones que pide, antes de empezar

1. **El scope de proyecto del notary.** Hoy ve y firma cualquier dossier (`acceso: "soloRol"`). Con
   un escribano da igual; con los pilotos de M4 (dos developers, datos reales) hay que decidirlo. Si
   cambia, cambia la `MATRIZ`, y eso se hace en un commit propio, antes o después del piloto, nunca
   adentro.
2. **Cuándo se persiste la compilación.** Hoy los tres GET escriben `Dossier` (`masterHash`,
   `compiledAt`) y reconcilian contra Blockfrost. **La propuesta:** la fila nace cuando la unidad
   tiene investor (al aceptar la invitación), los GET calculan en memoria y no escriben, y el
   `masterHash` se fija al firmar.
3. **La evidencia de M3** (`SPEC-613` §La evidencia de M3): el piloto es el primer paso que cambia
   el OpenAPI.

## Alcance

**API (A3)**

- **`shared`**: `DOSSIER_TRANSITIONS` (`compiled → signed`, `compiled → rejected`,
  `rejected → compiled` cuando cambia el `masterHash`; `signed` terminal), el contrato de los 9
  endpoints con `meta` y errores (`DOSSIER_NOT_FOUND`, `DOSSIER_NOT_SIGNABLE`, `DOSSIER_CHANGED`,
  `DOSSIER_SIGNED`) y `DossierId` con marca.
- **`apps/api/src/modules/dossier/`**:
  - `rules.ts`, puro: `artefactosDe`, `completitud`, `masterHashDe`, `commitmentDeFirma`,
    `puedeFirmar`. Hoy está mezclado con las queries en `compileDossier`.
  - `queries.ts`: los insumos del dossier en una pasada, **y en lote para la cola** (se va el N+1 de
    `GET /dossiers/pending`, que llama a `compileDossier` por fila). Los KPIs con un `count` en SQL,
    no leyendo la tabla entera.
  - Casos de uso `firmar`, `rechazar`, `compartir`, `exportar`, con `anclarConReclamo` y `audit(trx)`
    (`SPEC-613`).
  - `router.ts`: una línea por procedimiento, de `Result` a error tipado. No importa `db`.
- **Se borran sus rutas de Express** y `domain/dossier.ts` se vacía en el módulo.
- **El endpoint de pantalla del investor**: la pantalla hace hoy tres requests en cascada
  (unidad → proyecto, más el dossier) cuando el dossier ya trae proyecto y unidad. Si hace falta un
  path nuevo, sale de M2-D5 o es una decisión (regla: ningún endpoint fuera de `docs/`); si no,
  se amplía la respuesta del que existe.

**Web (W3)**

- El layout `notary` ya tiene armazón (W1).
- `dossierQueries` en la fábrica (`SPEC-614`); cliente desde el contrato (`SPEC-609`).
- Las 6 pantallas con `loader` (`ensureQueryData`; si [`SPEC-614`](SPEC-614-la-fabrica-de-queries.md)
  Paso 2 ya les puso uno con `prefetchQuery`, se cambia el verbo) y `useSuspenseQuery`: sin `enabled`, sin `data?.`,
  sin `return null`. `pendingComponent` adentro del armazón, `errorComponent` y `notFoundComponent`
  (el loader hace `throw notFound()`). `validateSearch` con Zod donde hay estado en la URL.
- **La vista del dossier, un componente compartido** entre investor y notary (hoy es el clon más
  grande del repo, 57 líneas).

## Cuándo está terminado

1. **Los tests de HTTP del arnés pasan sin cambios.** La única excepción es la que cambie a propósito
   la decisión 2, y cada test que cambia se nombra en el commit.
2. `test/reclamar-antes-de-anclar.test.ts` pasa.
3. `modules/dossier/router.ts` no importa `db`, y **los GET no escriben** (un test lo fija contando
   escrituras).
4. Las 6 pantallas no tienen `enabled`, `return null` ni lectura a mano de `ApiError`, y **ninguna
   dibuja un error como su estado vacío** (`notary.index`, `notary.signed`, `notary.dossier.$dossierId`,
   `investor.unit.$unitId.dossier` y `public.dossier.$shareToken` lo hacen hoy).
5. La `MATRIZ` de `route-guards.test.ts` no cambia (salvo la decisión 1, en su propio commit).
6. Cero comentarios con fecha en lo migrado.
7. `pnpm verify:all` y `pnpm e2e` completo en verde.

## La regla de salida

Al terminar, se mide: líneas del módulo nuevo contra las que reemplaza (rutas + `domain/dossier.ts`
+ las 6 pantallas), y el dueño lo lee. **Si el módulo no queda claramente más chico y más legible, o
si migrar obligó a cambiar tests del arnés que no estaban previstos, se frena** y se vuelve a la vía
incremental de la serie `6xx`. Lo hecho en A0–A2 y W2 se queda.
