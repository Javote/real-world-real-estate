# SPEC-111 — `ApiPort` contra el contrato: cuerpos tipados desde `shared` y un test que impide el drift

> **Origen:** [`SPEC-212`](SPEC-212-contrato-en-la-firma-de-la-ruta.md) §Alcance dejó fuera *"migrar
> los call sites de `apps/web` al cliente oRPC"*. **Reescrita 2026-09-20** después de medir: ese
> alcance ya no tiene sentido (ver §Por qué no el cliente oRPC). **Cerrada 2026-09-20.** Nivel 🟢:
> `port.ts` y un test nuevo, sin tocar backend, auth ni ninguna pantalla.

## El problema que queda, medido

`port.ts` es el único lugar del front que arma URLs, verbos, cuerpos y filtros — a mano. Los **tipos
de respuesta** ya no son un espejo: 32 de los 33 de `types.ts` se derivan de `packages/shared` con
`Serialized<T>` (`SPEC-109`). Lo que seguía sin ninguna garantía:

1. **Que el método pegue contra una ruta que existe**, con ese verbo. Renombrar una ruta en la API
   dejaba al front compilando y fallando con un 404.
2. **Que los cuerpos y filtros tengan la forma que la API espera.** 16 métodos armaban su cuerpo con
   un tipo escrito a mano (`createInvitation`, `createProject`, `updateUnit`, …) aunque el schema
   existe en `shared` (regla 6). Un campo obligatorio nuevo se descubría con un 400 en runtime.

Medido el 2026-09-20: los 64 métodos coincidían con el OpenAPI — **no había drift; faltaba lo que lo
detecta.**

## Lo que se hizo

- **`src/api/port.contract.test.ts` (nuevo, 71 tests).** Ejecuta cada método de `api` con un `fetch`
  falso, captura el request y lo cruza contra `specs/openapi/propnexus.openapi.json` (el documento
  que la API genera de sus procedimientos y cuya frescura fija `apps/api/test/openapi-freshness`).
  Verifica: que el origen sea `VITE_API_ORIGIN`; que verbo + path existan (gana la plantilla más
  literal: `/dossiers/pending` antes que `/dossiers/{id}`); que cada filtro esté declarado; que el
  cuerpo JSON exista, no traiga claves desconocidas y no le falte una obligatoria. `CASOS` está tipado
  como `Record<keyof Api, …>`: **agregar un método a `api` sin su caso no compila**, y un segundo test
  compara las claves en runtime.
- **Cuerpos y filtros tipados desde `packages/shared`** (`CreateInvitationInput`, `UpdateUnitInput`,
  `ProjectListQuery`, `NotificationQuery`, …). `jsonInit` pasó a ser genérico: cada call site declara
  el tipo del schema. Los tipos son `import type`: el front sigue sin cargar Zod en runtime.
- **Un bug real que encontró el test el primer día:** `downloadEvidence` armaba la URL **sin
  `API_BASE`** (funcionaba en dev por el proxy de Vite; en producción, con el web en otro origen,
  pegaba contra el sitio estático) y **no limpiaba la sesión ante un 401**, a diferencia de
  `exportUnitDossier`. Los dos binarios pasan ahora por un único `requestBlob`.

**Verificado que el test muerde**: renombrar `/notary/kpis` → `/notary/kpi` en `port.ts` lo pone rojo
(`GET /api/v1/notary/kpi no existe en el OpenAPI`); cambiar el filtro `city` → `ciudad`, también
(`el filtro "ciudad" no está declarado`).

## Por qué no el cliente oRPC (opciones B y C, descartadas)

El cliente que `SPEC-212` dejó vive solo en los tests de `apps/api`, tipado con
`typeof <router>` de la API: `apps/web` no puede importarlo (D-066 descartó Hono justamente por invertir
esa dependencia). Las dos vías reales costaban más de lo que ganaban sobre lo que ya había:

| | Costo | Por qué no |
|---|---|---|
| **B** — el contrato de las 84 rutas se muda a `shared` (`@orpc/contract`) y el front usa un cliente derivado | Reescribir la cabecera de 84 procedimientos (🟡) + Zod al bundle salvo `minifyContractRouter` | El beneficio nuevo sobre `SPEC-109` es chico: nada estaba roto |
| **C** — tipos desde el OpenAPI (`openapi-typescript`) | Un archivo generado de **5.352 líneas** + su frescura | El documento tiene 1 solo `components.schemas`: los tipos salen anónimos, peor que los `Serialized<…>` nombrados que ya hay |

**Además, el cliente oRPC no revive fechas** (probado): un `z.coerce.date()` viaja como string y el
cliente lo entrega como `string` aunque su tipo diga `Date`. Adoptarlo tal cual reintroduciría el bug
de `SPEC-109`; habría que envolverlo con `Serialized`.

## Lo que esta spec NO cierra, a propósito

**Que el TIPO de respuesta de un método sea el schema de esa ruta.** `request<ProjectDetail>(…)` sigue
siendo un emparejamiento a mano: si una ruta pasa a devolver otro schema, ningún test se entera. Es
lo único que B y C sí habrían cerrado. Si algún día duele, el camino es **B en una vertical piloto**
(`notary`, 6 rutas) para medir el costo real antes de decidir el resto — y el trabajo de esta spec no
se tira: los tipos de `shared` y el test sirven igual.

**Tampoco cubre** `uploadStageEvidence` en sus campos (es `FormData`: se contrasta path, verbo y que
la ruta declare cuerpo, no los campos) ni cambia ninguna pantalla.
