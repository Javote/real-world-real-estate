import { NextFunction, Request, Response } from "express";
import { type ExpressionBuilder, type ExpressionWrapper, sql, type SqlBool } from "../lib/kysely";
import { verifyToken } from "../lib/jwt";
import { db } from "../lib/db";
import type { Database, MembershipRole, UserRole } from "../db/types";

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

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
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

    if (!user || !user.isActive) {
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
