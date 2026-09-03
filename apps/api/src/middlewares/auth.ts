import type { NextFunction, Request, Response } from "express";
import type { Database, MembershipRole, UserRole } from "../db/types";
import { db } from "../lib/db";
import { verifyToken } from "../lib/jwt";
import { type ExpressionBuilder, type ExpressionWrapper, type SqlBool, sql } from "../lib/kysely";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
      };
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid token" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const payload = verifyToken(token);

    const user = await db
      .selectFrom("User")
      .select(["id", "email", "role", "isActive"])
      .where("id", "=", payload.userId)
      .executeTakeFirst();

    if (!user?.isActive) {
      return res.status(401).json({ message: "User not active" });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
}

/**
 * "Cualquier membresía sirve" — para los endpoints de lectura, donde alcanza con
 * ser miembro del proyecto.
 *
 * La lista se escribe a mano **a propósito**, y el `satisfies` la obliga a estar
 * completa: agregar una membresía a `db/types.ts` sin tocar esto **no compila**.
 *
 * La primera versión hacía `Object.values(MembershipRole)`, que se mantenía sola
 * y por eso mismo estaba mal: una membresía nueva quedaba con lectura de todos
 * los proyectos por herencia, sin que nadie lo decidiera. No es hipotético — el
 * dominio tiene cuatro roles (investor, developer, notary, certifier) y este enum
 * tiene tres, con los nombres viejos: `notary` va a entrar, y cuando entre el
 * compilador va a pedir que alguien diga qué puede leer.
 *
 * Ampliar un permiso tiene que ser un acto deliberado; el trabajo de escribir un
 * renglón es exactamente el punto.
 */
const ALL_MEMBERSHIPS = {
  developer: true,
  buyer: true,
  verifier: true
} satisfies Record<MembershipRole, true>;

export const ANY_MEMBERSHIP = Object.keys(ALL_MEMBERSHIPS) as MembershipRole[];

/**
 * Segunda capa de autorización: rol global (`requireRole`) + membresía por
 * proyecto. `admin` bypasea membresías; el resto solo ve proyectos donde es
 * miembro. La matriz completa está en M2-D1 §4.
 *
 * `allowedMemberships` es OBLIGATORIO y no puede volver a ser opcional (D-042):
 * omitirlo aceptaba cualquier membresía, así que quien quiso decir "solo
 * developer" y se olvidó del argumento obtenía "cualquier miembro", en silencio.
 * Un default fail-open en la función 🔴 por excelencia. Para abrir a cualquier
 * miembro está `ANY_MEMBERSHIP`, que hay que escribir.
 *
 * Una lista vacía no acepta a nadie: `projectScope` devuelve una condición que
 * nunca matchea, y ese es el sentido correcto de "no permití ninguna membresía".
 */
export async function canAccessProject(
  userId: string,
  role: UserRole,
  projectId: string,
  allowedMemberships: MembershipRole[]
) {
  const project = await db
    .selectFrom("Project")
    .select("id")
    .where("id", "=", projectId)
    .where((eb) => projectScope(eb, role, userId, allowedMemberships))
    .executeTakeFirst();

  return project !== undefined;
}

/**
 * **La segunda capa de autorización, como middleware** (SPEC-012, regla 5).
 *
 * `requireRole` está en la cadena o no está, así que olvidarlo se ve leyendo la
 * ruta. `canAccessProject` era una función que había que acordarse de llamar
 * *adentro* del handler, y de chequearle el booleano: un endpoint que se la
 * olvidaba **funcionaba perfecto** y servía datos de un proyecto a quien no era
 * miembro. No lo veía el compilador, ni un test, ni el CI. Esto pone las dos
 * capas en el mismo lugar y de la misma forma — la firma de la ruta.
 *
 * Hubo un escáner (`scripts/check-project-access.py`) que gritaba ante el
 * olvido; se borró con el harness (D-053) porque eran 147 líneas parcheando un
 * problema de forma. Esta es la forma.
 *
 * `allowedMemberships` es un parámetro **obligatorio y posicional**, no rest
 * args, y eso es deliberado: con `...memberships` omitirlo compilaría y
 * significaría lista vacía — que falla cerrado, pero en silencio. D-042 fijó que
 * en esta función omitir el argumento sea un **error de compilación**, y se
 * conserva. Para abrir a cualquier miembro está `ANY_MEMBERSHIP`, que hay que
 * escribir.
 *
 * No reimplementa nada: delega en `canAccessProject` → `projectScope`, que sigue
 * siendo la única definición de "qué proyectos puede ver este usuario" (D-043),
 * con el bypass de `admin` adentro.
 */
export type ProjectSource =
  /** El path ya trae el id del proyecto: `/projects/:id/evidence`. */
  | { param: string }
  /**
   * El path trae el id de otra entidad y hay que cargarla para saber de qué
   * proyecto es: `/stages/:id`. Unión de literales y no un genérico sobre el
   * schema a propósito — son dos tablas, sumar una tercera es una palabra, y a
   * cambio el tipo se lee sin resolver nada mental.
   */
  | { via: "Stage" | "Evidence" | "EvidenceBundle"; param: string };

export function requireProjectAccess(source: ProjectSource, allowedMemberships: MembershipRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const key = req.params[source.param];

    // `req.params[x]` es `string | string[]` en Express 5: path-to-regexp v8
    // admite parámetros repetidos (`:id+`), que dan un array. Ninguna ruta de
    // esta API declara uno, así que un array acá significa que alguien cambió
    // el path y este middleware no sabe sobre cuál de los ids autorizar —
    // **elegir el primero en silencio sería exactamente el bug que no queremos
    // en la capa de autorización**. Igual que un parámetro ausente: no es una
    // request inválida, es la ruta mal declarada. Error de programación, 5xx, y
    // ruidoso.
    if (typeof key !== "string" || !key) {
      return res.status(500).json({
        message: `Route misconfiguration: param "${source.param}" must be a single path value`
      });
    }

    let projectId: string;

    if ("via" in source) {
      const fila =
        source.via === "Stage"
          ? await db
              .selectFrom("Stage")
              .select("projectId")
              .where("id", "=", key)
              .executeTakeFirst()
          : source.via === "Evidence"
            ? await db
                .selectFrom("Evidence")
                .select("projectId")
                .where("id", "=", key)
                .executeTakeFirst()
            : await db
                .selectFrom("EvidenceBundle")
                .select("projectId")
                .where("id", "=", key)
                .executeTakeFirst();

      // Mismo 404 y mismo mensaje que devolvía el handler antes de este cambio.
      // Ojo: esto deja distinguir "no existe" de "existe y no podés verlo", que
      // en teoría permite enumerar ids. Se conserva **a propósito** — cambiar
      // semántica de seguridad adentro de un refactor es como se cuelan los
      // bugs. Está anotado como deuda aparte en SPEC-012.
      if (!fila) {
        return res.status(404).json({ message: `${source.via} not found` });
      }

      projectId = fila.projectId;
    } else {
      projectId = key;
    }

    const allowed = await canAccessProject(
      req.user.id,
      req.user.role,
      projectId,
      allowedMemberships
    );

    if (!allowed) {
      return res.status(403).json({ message: "Forbidden" });
    }

    next();
  };
}

/**
 * La misma regla, como condición de Kysely, para cuando la pregunta es sobre
 * una colección y no sobre un proyecto puntual. Requiere un `ExpressionBuilder`
 * ya parado sobre una query que tiene `"Project"` en scope (única forma de
 * referenciar `Project.id` sin alias — no hay Relational Query API acá, así que
 * no hay riesgo del alias interno que Drizzle le ponía a `db.query.*`, D-048).
 *
 * Es la **única** definición de "qué proyectos puede ver este usuario":
 * `canAccessProject` la aplica a un id y `GET /projects` la aplica al listado
 * completo. Antes eran dos implementaciones independientes —la función acá y un
 * query a mano en la ruta— que daban el mismo resultado por casualidad y solo
 * una tenía tests. Dos copias de una regla de autorización divergen en
 * silencio, y ésta es de las que no avisan cuando divergen: el síntoma es que
 * alguien ve de más.
 *
 * El bypass de `admin` (matriz de M2-D1 §4) vive acá y en ningún otro lado.
 * Se implementa como `EXISTS` correlacionado contra `Project.id` en vez de un
 * `IN (SELECT projectId FROM ...)`: así un usuario con dos membresías sobre el
 * mismo proyecto no lo duplica en el resultado (D-043).
 */
export function projectScope(
  eb: ExpressionBuilder<Database, "Project">,
  role: UserRole,
  userId: string,
  allowedMemberships: MembershipRole[]
): ExpressionWrapper<Database, "Project", SqlBool> {
  if (role === "admin") return eb(sql.lit(1), "=", sql.lit(1));

  if (allowedMemberships.length === 0) return eb(sql.lit(1), "=", sql.lit(0));

  return eb.exists(
    eb
      .selectFrom("ProjectMember")
      .select(sql.lit(1).as("one"))
      .whereRef("ProjectMember.projectId", "=", "Project.id")
      .where("ProjectMember.userId", "=", userId)
      .where("ProjectMember.membershipRole", "in", allowedMemberships)
  );
}
