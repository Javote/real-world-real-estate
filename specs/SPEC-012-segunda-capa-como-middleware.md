# SPEC-012 — La segunda capa de autorización pasa a ser middleware

> Rebanada **0e** de `specs/README.md`. Superficie **🔴**: toca la ruta de
> `canAccessProject`, así que se revisa línea por línea.
>
> **Origen:** D-053 borró `scripts/check-project-access.py`, que era lo único que gritaba cuando un
> endpoint se olvidaba de la segunda capa. Esta rebanada reemplaza esa red por una forma que no la
> necesita.

## El problema, en una frase

La **capa 1** (rol global) es un middleware y se lee en la firma de la ruta; la **capa 2**
(membresía en el proyecto) es una función que devuelve un booleano y hay que acordarse de llamarla
*adentro* del handler y de chequear el resultado. Un endpoint nuevo que se la olvide **funciona
perfecto** y sirve datos de un proyecto a quien no es miembro: no falta ningún argumento, así que no
lo ve el compilador, ni un test, ni el CI. Falla en silencio, y el síntoma es que alguien ve de más.

```ts
// capa 1 — se ve
router.post("/projects/:id/evidence", requireRole("developer"), handler)

// capa 2 — no se ve: está enterrada en el cuerpo, y su ausencia es invisible
router.get("/projects/:id/evidence", async (req, res) => {
  const allowed = await canAccessProject(req.user!.id, req.user!.role, req.params.id, ANY_MEMBERSHIP);
  if (!allowed) return res.status(403).json({ message: "Forbidden" });
  …
})
```

## Alcance

**12 call sites** de `canAccessProject`, en dos formas:

| Forma | Cuántos | Dónde está el `projectId` | Rutas |
|---|---|---|---|
| **A · directa** | 7 | en el path (`/projects/:id/…`) | `projects` ×2, `milestones` ×2, `evidence` ×3 |
| **B · indirecta** | 5 | en una entidad que hay que cargar | `/milestones/:id` ×3, `/evidence/:id` ×2 |

Los otros 15 endpoints de la API no entran: son admin-only o filtran por `projectScope` dentro del
query (`GET /projects`), y eso no cambia.

## Diseño

```ts
requireProjectAccess(source, allowedMemberships)
```

**`source` cubre las dos formas y nada más:**

```ts
type ProjectSource =
  | { param: string }                                  // A: el path YA trae el projectId
  | { via: "Stage" | "Evidence"; param: string };   // B: cargar la entidad y sacarle projectId
```

`via` es una unión de literales y no un genérico sobre el schema **a propósito**: son dos tablas,
sumar una tercera es una palabra, y a cambio el tipo se lee sin resolver nada mental.

**`allowedMemberships` es un parámetro obligatorio, no rest args.** Con `...memberships`, omitirlo
compila y significa "lista vacía" — que falla cerrado, pero en silencio. D-042 estableció que en
esta función omitir el argumento tiene que ser **un error de compilación**, y eso se conserva:
`requireProjectAccess({ param: "id" })` no compila.

## Invariantes

1. **Ningún endpoint con alcance de proyecto llama a `canAccessProject` desde su handler.** Después
   de esta rebanada, el único llamador de `canAccessProject` es el middleware. Es lo que vuelve
   visible el olvido: la segunda capa está en la firma o no está.
2. **La regla de visibilidad sigue existiendo una sola vez** (D-043): el middleware llama a
   `canAccessProject`, que aplica `projectScope`. No se reimplementa nada.
3. **El bypass de `admin` no se toca** — vive en `projectScope` y en ningún otro lado.
4. **Los códigos de respuesta no cambian**, uno por uno:
   - forma A, sin acceso (o proyecto inexistente) → **403**
   - forma B, entidad inexistente → **404** con el mismo mensaje de hoy (`"Stage not found"`,
     `"Evidence not found"`)
   - forma B, entidad existente sin acceso → **403**
   - sin `req.user` → **401**
5. **`allowedMemberships` de cada ruta es idéntico al de hoy.** Ninguna ruta se abre ni se cierra:
   las de lectura siguen con `ANY_MEMBERSHIP`, las de escritura con `["developer"]`. Esta rebanada
   **no redefine permisos**, solo mueve dónde se aplican.

## Casos borde

| Caso | Qué pasa | Por qué |
|---|---|---|
| `req.params[param]` vacío o ausente | **500** | Es un error de programación —la ruta declaró un `source` que no matchea su path—, no una request inválida. Falla ruidoso y del lado del servidor |
| Entidad de la forma B existe, pero su proyecto no | 403 | `canAccessProject` sobre un proyecto inexistente es `false` incluso para admin (D-043) |
| `allowedMemberships` vacío | 403 siempre | `projectScope` devuelve una condición que nunca matchea. Es el sentido correcto de "no permití ninguna membresía" |
| `POST /projects/:id/evidence` sin acceso | 403 **y el archivo no se sube** | Ver §Cambio de comportamiento |

## Cambio de comportamiento (uno, deliberado)

`POST /projects/:id/evidence` hoy corre **Multer primero** y chequea acceso después, así que un
request prohibido escribe el archivo en disco y el handler tiene que borrarlo a mano (regla 10). Con
el middleware antes de Multer, **el archivo nunca se escribe**: misma respuesta 403, sin escritura y
sin rama de limpieza. El `source` es `{ param: "id" }`, que no necesita el body, así que el orden es
seguro.

La limpieza de huérfanos **no se borra**: sigue haciendo falta para los rechazos que ocurren después
de Multer (validación de tipo/tamaño y errores de la ruta).

## Lo que esta rebanada NO hace

- **No cambia el 404 de la forma B por un 403.** Hoy un no-miembro distingue "no existe" de "existe
  y no podés verlo", lo que en teoría permite enumerar IDs. Los IDs son cuid2, así que no es
  explotable en la práctica, y **cambiar semántica de seguridad dentro de un refactor es como se
  cuelan los bugs**. Queda anotado como deuda aparte.
- **No evita la doble consulta de la forma B.** El middleware carga la entidad para sacar el
  `projectId` y el handler la vuelve a cargar. Es un lookup por PK, y guardar la entidad en `req`
  metería una caché adentro del middleware 🔴 — mezclar performance con autorización es
  exactamente lo que no conviene en este archivo. Si alguna vez pesa (cada query contra Turso es un
  round trip), se resuelve entonces, con medición.
- **No toca `GET /projects`**, que scopea en el query con `projectScope`.

## Definición de terminado

- [x] `requireProjectAccess` en `apps/api/src/middlewares/auth.ts`
- [x] Los 12 call sites convertidos; **cero** `canAccessProject` en `src/routes/`
- [x] Tests: los 4 códigos de la invariante 4, en las dos formas, y que omitir `allowedMemberships`
      no compile
- [x] Las 76 pruebas existentes de la API pasan **sin editarlas** — es la prueba de que el
      comportamiento no cambió
- [x] `pnpm verify` verde

**Cerrada 2026-08-23.** 12 call sites convertidos, 12 tests nuevos, y las 76 pruebas previas pasan
sin editarse — que es la prueba de que el comportamiento no cambió. El diff se lee con
`git diff -w`: buena parte del ruido es reindentado por pasar las rutas a firma multilínea.
