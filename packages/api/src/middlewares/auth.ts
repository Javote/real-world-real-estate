import { MembershipRole, UserRole } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";

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

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true
      }
    });

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
 * Se deriva del enum de Prisma en vez de escribir la lista a mano: una membresía
 * nueva en `schema.prisma` queda incluida sola, que es exactamente lo que hacía
 * el parámetro opcional que este valor reemplaza. La diferencia es que ahora el
 * que abre el permiso lo dice, y se puede grepear quién lo hace.
 */
export const ANY_MEMBERSHIP: MembershipRole[] = Object.values(MembershipRole);

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
 * Una lista vacía no acepta a nadie: `{ in: [] }` no matchea, y ese es el
 * sentido correcto de "no permití ninguna membresía".
 */
export async function canAccessProject(
  userId: string,
  role: UserRole,
  projectId: string,
  allowedMemberships: MembershipRole[]
) {
  if (role === "admin") return true;

  const membership = await prisma.projectMember.findFirst({
    where: {
      userId,
      projectId,
      membershipRole: { in: allowedMemberships }
    }
  });

  return Boolean(membership);
}
