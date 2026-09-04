# PLAN 2026-09-04 — un guard único de autorización

Acordado con el dueño el 2026-09-04, en la conversación que siguió a `requireOwnership`. Reemplaza
las tres llamadas encadenadas (`requireRole` + `requireProjectAccess` + `requireOwnership`) por
**una sola con campos obligatorios**.

Vive acá y no en una memoria porque es un refactor de la capa 🟡 que toca 87 firmas, se hace por
etapas y tiene un punto de control con el dueño en el medio: quien lo retome tiene que poder seguirlo
sin el chat.

## Por qué ahora, y por qué NO por prolijidad

Hay que ser preciso con el motivo, porque dos razones que suenan bien no alcanzan para justificar
tocar la zona más sensible del repo.

**No es porque las tres hagan lo mismo.** No lo hacen: el rol sale del token sin tocar la base, el
proyecto y el dueño cargan una fila. Y un objeto con tres campos preserva esa distinción igual que
tres funciones.

**No es porque se lea mejor.** Se lee bien hoy, y la matriz de `test/route-guards.test.ts` ya da la
regla completa de cada ruta en una línea. La prolijidad sola no paga esto.

**Es porque hoy nada obliga a declarar la pertenencia.** Una ruta nueva del investor escrita con
`requireRole("admin", "buyer")` y nada más **compila, pasa el happy path y sirve la unidad de otro**.
Es el agujero de `GET /evidence/:bundleId/files` con la forma intacta, y la razón por la que existió
`requireOwnership`.

D-042 resolvió esto para las membresías haciendo que omitir el argumento **no compile**. Con
middlewares sueltos esa jugada no se puede repetir para la regla entera: *la ausencia de una llamada
no es un tipo*. No hay firma que se pueda escribir para que "te faltó un middleware" sea un error.

Un guard único de campos obligatorios sí. No fuerza a acertar —alguien apurado escribe la variante
laxa sin pensar— pero **convierte una ausencia en una afirmación**, y esa es toda la diferencia en
revisión: una ausencia es invisible en un diff, una afirmación es algo que alguien firmó y que el
revisor puede discutir.

**Y de yapa, la disyunción deja de ser una excepción.** `GET /contracts/:contractId/releases` no
entra en una cadena de middlewares porque su regla es *dueño **o** miembro del proyecto* y una cadena
es un AND. Como **dato** se escribe sin drama, y se cae la excepción que hoy está documentada en
`apps/api/CLAUDE.md` §La tercera capa.

## Por qué es seguro recién ahora

Este repo tiene una regla propia: **no cambiar semántica de seguridad adentro de un refactor**
(`SPEC-012` §Lo que NO hace). Es como se cuelan los bugs, y hasta el 2026-09-03 este refactor habría
sido exactamente eso — 87 firmas tocadas y nada más que la lectura atenta para saber si algo cambió.

La matriz de `test/route-guards.test.ts` cambia la categoría del problema: un refactor que no cambia
comportamiento tiene que dejar **los 265 tests en verde** y producir una matriz **equivalente ruta
por ruta**. Se vuelve verificable en vez de confiable. El orden en que se hicieron las cosas —matriz
primero, `requireOwnership` después, unificación al final— es lo que lo habilita, y no fue casualidad.

## La forma propuesta

Es una hipótesis, no una conclusión: se valida contra la primera superficie y se corrige ahí si no
cierra.

```ts
type ReglaDeAcceso =
  | { proyecto: ProjectSource; membresias: MembershipRole[] }
  | { dueño: OwnerSource }
  | { alguna: ReglaDeAcceso[] }   // la disyunción: dueño O miembro
  | "soloRol";                    // el rol global ES toda la regla

authorize({ roles: UserRole[]; acceso: ReglaDeAcceso })
```

**Los dos campos son obligatorios.** `"soloRol"` es la pieza que hace el trabajo: es la afirmación
explícita de que esta ruta no tiene regla por fila. Escribirlo es barato; omitirlo no compila.

`authorize` se construye **encima** de los tres guards actuales, que dejan de exportarse y pasan a
ser internos. No se reimplementa ninguna regla: el bypass de `admin` sigue viviendo en `projectScope`
y en `requireOwnership`, y el `satisfies Record<MembershipRole, true>` de `ANY_MEMBERSHIP` sigue
donde está.

## La secuencia

Un commit por paso, cada uno con `pnpm verify:all` en verde y la matriz actualizada.

| # | Paso | Criterio de cierre |
|---|---|---|
| 1 | `authorize` y sus tipos, sobre los tres actuales. **Ninguna ruta migrada.** | Compila, 265 en verde, matriz sin cambios |
| 2 | Migrar **investor** (14 rutas) | Matriz equivalente ruta por ruta · **punto de control con el dueño** |
| 3 | `developer` (22), `projects`/`stages`/`evidence` (26), `certifier` (6), `notary` (6), el resto | Un commit por superficie |
| 4 | `/contracts/:contractId/releases` pasa a `alguna: [...]` | Deja de ser la excepción documentada |
| 5 | Cerrar la decisión en `DECISIONS.md` y corregir `SPEC-012`, que describe la forma anterior | En el mismo commit que el último paso |

**Investor va primero a propósito:** es la superficie que acaba de cambiar, la que tiene los tests más
frescos (`test/require-ownership.test.ts`, 13 casos) y la única que ejercita las tres capas juntas.

## Cuándo frenar

El punto de control del paso 2 existe para poder abandonar barato. Se frena y se replantea si:

- **`"soloRol"` se vuelve un cajón de sastre.** Si al migrar investor aparece que la mitad de las
  rutas lo llevan "porque sí", la afirmación no afirma nada y el refactor no compró lo que decía.
- **La matriz de una superficie migrada no se puede dejar equivalente** sin cambiar comportamiento.
  Ahí el refactor ya dejó de ser un refactor.
- **La firma se vuelve más larga de leer que las tres llamadas.** El objetivo es que la regla se lea
  en un lugar, no que entre en una línea; pero si leerla cuesta más que hoy, perdimos.

## Qué NO hace

- **No cambia ninguna regla de autorización.** Ni una ruta gana o pierde acceso. Si alguna lo hace,
  es un bug del refactor, no una mejora.
- **No toca `projectScope`,** que es la regla como condición de Kysely para colecciones (D-043). Los
  listados siguen acotándose ahí: eso es scope, no autorización.
- **No unifica el 404/403.** La deuda declarada en `SPEC-012` —desde afuera se distingue "no existe"
  de "no es tuyo"— se conserva tal cual. Cambiar semántica de seguridad adentro de un refactor es
  precisamente lo que este plan no hace.
- **No agrega revocación de tokens** ni toca nada de `lib/jwt.ts`.
