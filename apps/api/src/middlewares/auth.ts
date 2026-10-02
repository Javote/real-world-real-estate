import type { AuditEntityType } from "@plataforma/shared";
import type { NextFunction, Request, Response } from "express";
import type { Database, MembershipRole, UserRole } from "../db/types.js";
import { db } from "../lib/db.js";
import { verifyToken } from "../lib/jwt.js";
import {
  type ExpressionBuilder,
  type ExpressionWrapper,
  type SqlBool,
  sql
} from "../lib/kysely.js";

type Usuario = { id: string; email: string; role: UserRole };

type UsuarioLeido = Usuario | { rechazo: "User not active" | "Invalid token" };

declare global {
  namespace Express {
    interface Request {
      user?: Usuario;
      sesion?: { token: Usuario; usuario: Promise<UsuarioLeido> };
    }
  }
}

export const GUARD = Symbol.for("propnexus.guard");

export type GuardDescriptor =
  | { kind: "authenticate" }
  | { kind: "authorize"; roles: UserRole[]; acceso: ReglaDeAcceso };

function marcar<T extends object>(fn: T, guard: GuardDescriptor): T {
  return Object.defineProperty(fn, GUARD, { value: guard, enumerable: false }) as T;
}

export function leerGuard(fn: unknown): GuardDescriptor | null {
  if (typeof fn !== "function") return null;
  return (fn as unknown as Record<symbol, GuardDescriptor | undefined>)[GUARD] ?? null;
}

// Nunca rechaza: si la request corta antes de `authorize` (un 400 de `paramValidator`), nadie la
// espera, y una promesa rechazada sin manejar tira el proceso.
async function leerUsuario(id: string): Promise<UsuarioLeido> {
  try {
    const user = await db
      .selectFrom("User")
      .select(["id", "email", "role", "isActive"])
      .where("id", "=", id)
      .executeTakeFirst();

    if (!user?.isActive) return { rechazo: "User not active" };

    return { id: user.id, email: user.email, role: user.role };
  } catch {
    return { rechazo: "Invalid token" };
  }
}

// No espera a la base: `authorize` lee el usuario en paralelo con la regla y recién ahí escribe
// `req.user`.
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid token" });
  }

  let payload: ReturnType<typeof verifyToken>;
  try {
    payload = verifyToken(authHeader.slice("Bearer ".length));
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }

  req.sesion = {
    token: { id: payload.userId, email: payload.email, role: payload.role as UserRole },
    usuario: leerUsuario(payload.userId)
  };

  next();
}

Object.defineProperty(authenticate, GUARD, {
  value: { kind: "authenticate" } satisfies GuardDescriptor,
  enumerable: false
});

// Literal y no `Object.values` del enum: una membresía nueva no tiene que leer todo sin que nadie lo decida.
const ALL_MEMBERSHIPS = {
  developer: true,
  buyer: true,
  verifier: true
} satisfies Record<MembershipRole, true>;

export const ANY_MEMBERSHIP = Object.keys(ALL_MEMBERSHIPS) as MembershipRole[];

const TODOS_LOS_ROLES = {
  admin: true,
  developer: true,
  buyer: true,
  verifier: true,
  notary: true
} satisfies Record<UserRole, true>;

export const CUALQUIER_ROL = Object.keys(TODOS_LOS_ROLES) as UserRole[];

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

export type ProjectSource =
  | { param: string }
  | {
      via: EntidadConProyecto;
      param: string;
      en?: "path" | "body";
      nombre?: string;
    };

type EntidadConProyecto = "Stage" | "Evidence" | "EvidenceBundle" | "Unit" | "Contract";

// Una sola consulta: de qué proyecto es la entidad y si el usuario puede entrar. Sin fila, la
// entidad no existe (404); con fila y `permitido` en falso, 403.
async function accesoPorEntidad(
  via: EntidadConProyecto,
  key: string,
  user: Usuario,
  allowedMemberships: MembershipRole[]
): Promise<{ permitido: boolean } | undefined> {
  const permitido = (eb: ExpressionBuilder<Database, "Project">) =>
    eb
      .and([
        eb("Project.id", "is not", null),
        projectScope(eb, user.role, user.id, allowedMemberships)
      ])
      .as("permitido");

  const fila =
    via === "Contract"
      ? await db
          .selectFrom("Contract")
          .innerJoin("Unit", "Unit.id", "Contract.unitId")
          .leftJoin("Project", "Project.id", "Unit.projectId")
          .select((eb) => permitido(eb))
          .where("Contract.id", "=", key)
          .executeTakeFirst()
      : await db
          .selectFrom(via)
          .leftJoin("Project", "Project.id", `${via}.projectId`)
          .select((eb) => permitido(eb))
          .where(`${via}.id`, "=", key)
          .executeTakeFirst();

  return fila && { permitido: Boolean(fila.permitido) };
}

type Veredicto = { ok: true } | { ok: false; status: 400 | 403 | 404 | 500; message: string };

const PASA: Veredicto = { ok: true };
const PROHIBIDO: Veredicto = { ok: false, status: 403, message: "Forbidden" };

function leerParam(req: Request, param: string, en: "path" | "body" = "path"): string | Veredicto {
  if (en === "body") {
    const valor = (req.body as Record<string, unknown> | undefined)?.[param];
    if (typeof valor !== "string" || !valor) {
      return {
        ok: false,
        status: 400,
        message: `Missing or invalid "${param}"`
      };
    }
    return valor;
  }

  const key = req.params[param];
  if (typeof key !== "string" || !key) {
    return {
      ok: false,
      status: 500,
      message: `Route misconfiguration: param "${param}" must be a single path value`
    };
  }
  return key;
}

async function evaluarProyecto(
  user: Usuario,
  req: Request,
  source: ProjectSource,
  allowedMemberships: MembershipRole[]
): Promise<Veredicto> {
  const key = leerParam(req, source.param, "via" in source ? source.en : "path");
  if (typeof key !== "string") return key;

  if ("via" in source) {
    const acceso = await accesoPorEntidad(source.via, key, user, allowedMemberships);

    if (!acceso) {
      return { ok: false, status: 404, message: `${source.nombre ?? source.via} not found` };
    }

    return acceso.permitido ? PASA : PROHIBIDO;
  }

  const allowed = await canAccessProject(user.id, user.role, key, allowedMemberships);
  return allowed ? PASA : PROHIBIDO;
}

export type OwnerSource =
  | { via: "Unit"; param: string }
  | { via: "Invitation"; param: string }
  | { via: "CertifierInvitation"; param: string }
  | { via: "ContractOfUnit"; param: string }
  | { via: "Contract"; param: string };

const NOMBRE_DE_ENTIDAD: Record<OwnerSource["via"], string> = {
  Unit: "Unit",
  Invitation: "Invitation",
  CertifierInvitation: "Invitation",
  ContractOfUnit: "Contract",
  Contract: "Contract"
};

async function cargarDueño(
  source: OwnerSource,
  key: string
): Promise<{ dueño: string | null; contra: "id" | "email" } | null> {
  if (source.via === "Unit") {
    const fila = await db
      .selectFrom("Unit")
      .select("investorId")
      .where("id", "=", key)
      .executeTakeFirst();
    return fila ? { dueño: fila.investorId, contra: "id" } : null;
  }

  if (source.via === "Invitation") {
    const fila = await db
      .selectFrom("Invitation")
      .select("investorEmail")
      .where("id", "=", key)
      .executeTakeFirst();
    return fila ? { dueño: fila.investorEmail, contra: "email" } : null;
  }

  if (source.via === "CertifierInvitation") {
    const fila = await db
      .selectFrom("CertifierInvitation")
      .select("certifierId")
      .where("id", "=", key)
      .executeTakeFirst();
    return fila ? { dueño: fila.certifierId, contra: "id" } : null;
  }

  const fila = await db
    .selectFrom("Contract")
    .select("investorId")
    .where(source.via === "Contract" ? "id" : "unitId", "=", key)
    .executeTakeFirst();
  return fila ? { dueño: fila.investorId, contra: "id" } : null;
}

async function evaluarDueño(user: Usuario, req: Request, source: OwnerSource): Promise<Veredicto> {
  const key = leerParam(req, source.param);
  if (typeof key !== "string") return key;

  const fila = await cargarDueño(source, key);

  if (!fila) {
    return { ok: false, status: 404, message: `${NOMBRE_DE_ENTIDAD[source.via]} not found` };
  }

  if (user.role === "admin") return PASA;

  return fila.dueño !== null && fila.dueño === user[fila.contra] ? PASA : PROHIBIDO;
}

export type ReglaSimple =
  | { proyecto: ProjectSource; membresias: MembershipRole[] }
  | { dueño: OwnerSource }
  | { scopeEnQuery: string }
  | "soloRol";

export type ReglaDeAcceso = ReglaSimple | { alguna: [ReglaSimple, ReglaSimple, ...ReglaSimple[]] };

async function evaluarSimple(user: Usuario, req: Request, regla: ReglaSimple): Promise<Veredicto> {
  if (regla === "soloRol") return PASA;

  if ("scopeEnQuery" in regla) return PASA;

  if ("proyecto" in regla) return evaluarProyecto(user, req, regla.proyecto, regla.membresias);
  return evaluarDueño(user, req, regla.dueño);
}

async function evaluarRegla(user: Usuario, req: Request, regla: ReglaDeAcceso): Promise<Veredicto> {
  if (typeof regla === "string" || !("alguna" in regla)) {
    return evaluarSimple(user, req, regla);
  }

  const veredictos = await Promise.all(regla.alguna.map((rama) => evaluarSimple(user, req, rama)));

  const roto = veredictos.find((v) => !v.ok && (v.status === 500 || v.status === 400));
  if (roto) return roto;

  if (veredictos.some((v) => v.ok)) return PASA;

  /* v8 ignore next -- @preserve: `alguna` exige dos ramas como mínimo (el tipo lo obliga), así que `veredictos[0]` siempre existe y el `?? PROHIBIDO` nunca corre */
  return veredictos.find((v) => !v.ok && v.status === 403) ?? veredictos[0] ?? PROHIBIDO;
}

function veredictoPara(
  user: Usuario,
  req: Request,
  regla: { roles: UserRole[]; acceso: ReglaDeAcceso }
): Promise<Veredicto> {
  if (!regla.roles.includes(user.role)) return Promise.resolve(PROHIBIDO);
  return evaluarRegla(user, req, regla.acceso);
}

export function authorize(regla: { roles: UserRole[]; acceso: ReglaDeAcceso }) {
  return marcar(
    async (req: Request, res: Response, next: NextFunction) => {
      let veredicto: Veredicto;

      if (req.user) {
        veredicto = await veredictoPara(req.user, req, regla);
      } else if (req.sesion) {
        const { token, usuario } = req.sesion;

        // La regla corre con lo que dice el token mientras la base confirma al usuario.
        const anticipado = veredictoPara(token, req, regla);
        anticipado.catch(() => {});

        const leido = await usuario;
        if ("rechazo" in leido) {
          return res.status(401).json({ message: leido.rechazo });
        }

        req.user = leido;
        veredicto =
          leido.role === token.role && leido.email === token.email
            ? await anticipado
            : await veredictoPara(leido, req, regla);
      } else {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!veredicto.ok) {
        return res.status(veredicto.status).json({ message: veredicto.message });
      }

      return next();
    },
    { kind: "authorize", roles: regla.roles, acceso: regla.acceso }
  );
}

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

type AuditEntityScope = (
  eb: ExpressionBuilder<Database, "AuditLog">,
  misProyectos: ReturnType<ExpressionBuilder<Database, "AuditLog">["selectFrom"]>
) => ExpressionWrapper<Database, "AuditLog", SqlBool>;

function viaProyecto(
  tabla: "Stage" | "Evidence" | "Invitation" | "CertifierInvitation" | "Unit" | "ProjectMember"
): AuditEntityScope {
  return (eb, misProyectos) =>
    eb.and([
      eb("AuditLog.entityType", "=", tabla),
      eb.exists(
        eb
          .selectFrom(tabla)
          .select(sql.lit(1).as("one"))
          .whereRef(`${tabla}.id`, "=", "AuditLog.entityId")
          .where(`${tabla}.projectId`, "in", misProyectos)
      )
    ]);
}

const AUDIT_ENTITY_SCOPES = {
  Project: (eb, misProyectos) =>
    eb.and([
      eb("AuditLog.entityType", "=", "Project"),
      eb("AuditLog.entityId", "in", misProyectos)
    ]),
  Stage: viaProyecto("Stage"),
  Evidence: viaProyecto("Evidence"),
  Invitation: viaProyecto("Invitation"),
  CertifierInvitation: viaProyecto("CertifierInvitation"),
  Unit: viaProyecto("Unit"),
  ProjectMember: viaProyecto("ProjectMember"),
  Dossier: (eb, misProyectos) =>
    eb.and([
      eb("AuditLog.entityType", "=", "Dossier"),
      eb.exists(
        eb
          .selectFrom("Dossier")
          .innerJoin("Unit", "Unit.id", "Dossier.unitId")
          .select(sql.lit(1).as("one"))
          .whereRef("Dossier.id", "=", "AuditLog.entityId")
          .where("Unit.projectId", "in", misProyectos)
      )
    ]),
  PaymentAttestation: (eb, misProyectos) =>
    eb.and([
      eb("AuditLog.entityType", "=", "PaymentAttestation"),
      eb.exists(
        eb
          .selectFrom("PaymentAttestation")
          .innerJoin("Contract", "Contract.id", "PaymentAttestation.contractId")
          .innerJoin("Unit", "Unit.id", "Contract.unitId")
          .select(sql.lit(1).as("one"))
          .whereRef("PaymentAttestation.id", "=", "AuditLog.entityId")
          .where("Unit.projectId", "in", misProyectos)
      )
    ])
} satisfies Record<Exclude<AuditEntityType, "User">, AuditEntityScope>;

export function auditScope(
  eb: ExpressionBuilder<Database, "AuditLog">,
  role: UserRole,
  userId: string,
  allowedMemberships: MembershipRole[]
): ExpressionWrapper<Database, "AuditLog", SqlBool> {
  if (role === "admin") return eb(sql.lit(1), "=", sql.lit(1));

  const misProyectos = eb
    .selectFrom("Project")
    .select("Project.id")
    .where((e) => projectScope(e, role, userId, allowedMemberships));

  return eb.or(Object.values(AUDIT_ENTITY_SCOPES).map((scope) => scope(eb, misProyectos)));
}
