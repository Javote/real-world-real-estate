import type { AuditEntityType } from "@plataforma/shared";
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

/**
 * La marca que deja leer los guards de una ruta desde el router ya armado.
 *
 * `requireRole` y `requireProjectAccess` devuelven closures anónimas: una vez
 * montadas, el router sabe que hay tres funciones en la cadena y nada más — no
 * qué rol exigen ni sobre qué proyecto. Sin esto, la única forma de auditar la
 * matriz de permisos es leer los 18 archivos de rutas a ojo, que es exactamente
 * como se nos pasaron los dos agujeros de septiembre.
 *
 * Es una propiedad no enumerable con un símbolo global: no cambia el
 * comportamiento del middleware, no aparece en un spread ni en un `JSON.stringify`,
 * y no se puede pisar por accidente desde otro módulo. La lee
 * `test/route-guards.test.ts`, que es el único consumidor y la razón de que exista.
 */
export const GUARD = Symbol.for("propnexus.guard");

export type GuardDescriptor =
  | { kind: "authenticate" }
  | { kind: "authorize"; roles: UserRole[]; acceso: ReglaDeAcceso };

function marcar<T extends object>(fn: T, guard: GuardDescriptor): T {
  return Object.defineProperty(fn, GUARD, { value: guard, enumerable: false }) as T;
}

/** El lado lector de `GUARD`. Devuelve `null` para middleware sin marcar. */
export function leerGuard(fn: unknown): GuardDescriptor | null {
  if (typeof fn !== "function") return null;
  return (fn as unknown as Record<symbol, GuardDescriptor | undefined>)[GUARD] ?? null;
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid token" });
  }

  try {
    // SPEC-208 (B-12): `.slice(7)` en vez de `.split(" ")[1]` — el `startsWith`
    // de arriba ya garantiza el prefijo `"Bearer "` (7 caracteres), así que
    // esto es `string` siempre, nunca `undefined`.
    const token = authHeader.slice("Bearer ".length);
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

// `authenticate` no es una closure de fábrica: se marca acá, una vez declarada.
Object.defineProperty(authenticate, GUARD, {
  value: { kind: "authenticate" } satisfies GuardDescriptor,
  enumerable: false
});

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
 * "Cualquier usuario autenticado" — para las rutas donde el rol global no acota
 * nada porque la regla real es otra (la membresía en el proyecto) o porque el
 * recurso es del propio usuario.
 *
 * Se escribe **a mano**, con `satisfies`, por el mismo motivo que
 * `ALL_MEMBERSHIPS`: un `Object.values` sobre el enum se mantendría solo, que
 * suena mejor y es peor. Con `notary` entrando al dominio en septiembre, un rol
 * nuevo habría quedado leyendo todas estas rutas sin que nadie lo decidiera.
 * Acá agregar un rol al dominio **no compila** hasta que alguien pase por este
 * renglón y decida.
 */
const TODOS_LOS_ROLES = {
  admin: true,
  developer: true,
  buyer: true,
  verifier: true,
  notary: true
} satisfies Record<UserRole, true>;

export const CUALQUIER_ROL = Object.keys(TODOS_LOS_ROLES) as UserRole[];

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
   * schema a propósito — sumar una tabla es una palabra, y a cambio el tipo se
   * lee sin resolver nada mental.
   *
   * `Unit` y `Contract` entraron el 2026-09-04 al migrar la superficie del
   * developer: `PATCH /developer/units/:id` y
   * `POST /developer/contracts/:id/releases/:stageNum` resolvían el proyecto a
   * mano adentro del handler, con once líneas que hacían exactamente esto.
   * `Contract` es el único que necesita un join —el `projectId` está en la
   * unidad, no en el contrato—; los demás lo tienen en su propia fila.
   */
  | {
      via: "Stage" | "Evidence" | "EvidenceBundle" | "Unit" | "Contract";
      param: string;
      /**
       * De dónde sale el id. `"path"` por default. `"body"` existe para
       * `POST /developer/documents`, que recibe el `evidenceId` en el cuerpo:
       * era la última ruta que hacía la segunda capa **a mano** justamente
       * porque el guard solo miraba el path.
       *
       * La diferencia no es cosmética. Un param de path ausente es la **ruta mal
       * declarada** (500, error de programación); un campo de body ausente es
       * **input del cliente** (400). Se distinguen porque el modo de falla es
       * distinto y confundirlos convierte un error de cliente en una página de
       * error 5xx del monitoreo.
       */
      en?: "path" | "body";
      /**
       * El nombre que sale en el 404, cuando el cliente conoce la entidad por
       * otro nombre. `POST /developer/documents` decía `"Document not found"`
       * antes de declarar su regla, y lo sigue diciendo: para esa superficie la
       * evidencia **es** un documento (M2-D5 fila 46), y filtrar el nombre de la
       * tabla al cliente sería un cambio hacia atrás.
       */
      nombre?: string;
    };

/** El `projectId` de la entidad que nombra el `via`, o `null` si no existe. */
async function proyectoDeLaEntidad(
  via: "Stage" | "Evidence" | "EvidenceBundle" | "Unit" | "Contract",
  key: string
): Promise<string | null> {
  if (via === "Contract") {
    const fila = await db
      .selectFrom("Contract")
      .innerJoin("Unit", "Unit.id", "Contract.unitId")
      .select("Unit.projectId as projectId")
      .where("Contract.id", "=", key)
      .executeTakeFirst();
    return fila?.projectId ?? null;
  }

  const fila = await db
    .selectFrom(via)
    .select("projectId")
    .where("id", "=", key)
    .executeTakeFirst();
  return fila?.projectId ?? null;
}

/**
 * El veredicto de una regla, **sin escribir la respuesta**.
 *
 * Existe porque `authorize` necesita poder *evaluar* una regla y recién después
 * decidir: una disyunción (`alguna`) tiene que poder probar la segunda rama
 * cuando la primera dice que no, y un middleware que ya contestó 403 no deja
 * probar nada. Los guards sueltos son ahora una cáscara fina sobre estos mismos
 * evaluadores — **la regla no está escrita dos veces**.
 */
type Veredicto = { ok: true } | { ok: false; status: 400 | 403 | 404 | 500; message: string };

const PASA: Veredicto = { ok: true };
const PROHIBIDO: Veredicto = { ok: false, status: 403, message: "Forbidden" };

/**
 * `req.params[x]` es `string | string[]` en Express 5: path-to-regexp v8 admite
 * parámetros repetidos (`:id+`), que dan un array. Ninguna ruta de esta API
 * declara uno, así que un array acá significa que alguien cambió el path y el
 * guard no sabe sobre cuál de los ids autorizar — **elegir el primero en
 * silencio sería exactamente el bug que no queremos en la capa de
 * autorización**. Igual que un parámetro ausente: no es una request inválida, es
 * la ruta mal declarada. Error de programación, 5xx, y ruidoso.
 */
function leerParam(req: Request, param: string, en: "path" | "body" = "path"): string | Veredicto {
  if (en === "body") {
    const valor = (req.body as Record<string, unknown> | undefined)?.[param];
    if (typeof valor !== "string" || !valor) {
      // Input del cliente, no ruta mal declarada: 400 y con `code`, para que el
      // front lo distinga de los 400 de Zod que devuelven `error.flatten()`.
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
  user: NonNullable<Request["user"]>,
  req: Request,
  source: ProjectSource,
  allowedMemberships: MembershipRole[]
): Promise<Veredicto> {
  const key = leerParam(req, source.param, "via" in source ? source.en : "path");
  if (typeof key !== "string") return key;

  let projectId: string;

  if ("via" in source) {
    const encontrado = await proyectoDeLaEntidad(source.via, key);

    // Mismo 404 y mismo mensaje que devolvía el handler antes de este cambio.
    // Ojo: esto deja distinguir "no existe" de "existe y no podés verlo", que
    // en teoría permite enumerar ids. Se conserva **a propósito** — cambiar
    // semántica de seguridad adentro de un refactor es como se cuelan los
    // bugs. Está anotado como deuda aparte en SPEC-012.
    if (encontrado === null) {
      return { ok: false, status: 404, message: `${source.nombre ?? source.via} not found` };
    }

    projectId = encontrado;
  } else {
    projectId = key;
  }

  const allowed = await canAccessProject(user.id, user.role, projectId, allowedMemberships);
  return allowed ? PASA : PROHIBIDO;
}

/**
 * La tercera capa: **el recurso es de quien lo pide.**
 *
 * `requireRole` contesta "¿este rol puede tocar esta superficie?" y
 * `requireProjectAccess` contesta "¿es miembro de este proyecto?". Ninguna de las
 * dos contesta la que rige la superficie del investor: *¿esta unidad, esta
 * invitación, este contrato son suyos?* — el aislamiento cross-rol de M2-D1
 * §Cross-role data isolation.
 *
 * **Por qué es un middleware, contra lo que decía el comentario que reemplaza.**
 * `investor.routes.ts` justificaba tenerlo adentro de cada handler con que "el
 * dato que decide sale de la fila, no del token". Es cierto y no alcanza:
 * `requireProjectAccess` ya carga una fila para averiguar el `projectId` cuando
 * el path trae un `stageId` o un `evidenceId`, y nadie lo bajó al handler por
 * eso. Lo que sí trae el chequeo suelto es el modo de falla de siempre — una
 * ruta nueva que se olvida el `if` compila, pasa el happy path y sirve la unidad
 * de otro. Es exactamente el agujero de `GET /evidence/:bundleId/files`, y la
 * respuesta es la misma que dio D-042: que se lea en la firma.
 *
 * **El bypass de `admin` vive acá y en ningún otro lado**, igual que en
 * `projectScope` (D-043). Los nueve call sites lo repetían con la misma línea
 * (`req.user!.role !== "admin" && fila.x !== req.user!.id`), que es una regla de
 * autorización copiada nueve veces: la clase de cosa que coincide por casualidad
 * hasta el día que no.
 *
 * **Un dueño `null` no es "de nadie, pasá":** una unidad sin `investorId` es una
 * unidad sin vender, y para un no-admin es 403 como cualquier otra ajena. Es el
 * mismo resultado que daba la comparación suelta (`null !== id`), explícito acá
 * para que no dependa de cómo se comporta `!==` con `null`.
 */
export type OwnerSource =
  /** La unidad es del investor: `Unit.investorId`. */
  | { via: "Unit"; param: string }
  /** La invitación es para su email: `Invitation.investorEmail`. */
  | { via: "Invitation"; param: string }
  /**
   * La invitación a certificar es del certifier invitado:
   * `CertifierInvitation.certifierId` (SPEC-221). Por id, no por email: el
   * certifier ya tiene cuenta cuando se lo invita.
   */
  | { via: "CertifierInvitation"; param: string }
  /**
   * El contrato de una unidad. El path trae el **`unitId`**, no el id del
   * contrato — `GET /investor/contracts/:unitId` busca por unidad, así que la
   * fila se resuelve por esa columna y no por la clave primaria.
   */
  | { via: "ContractOfUnit"; param: string }
  /**
   * El contrato por su **propio id**: `GET /contracts/:contractId/releases`.
   * Convive con `ContractOfUnit` a propósito — son dos búsquedas distintas
   * sobre la misma tabla, y fundirlas en una obligaría a adivinar por cuál de
   * las dos columnas buscar según el nombre del param.
   */
  | { via: "Contract"; param: string };

/** El nombre que sale en el 404. `ContractOfUnit` es un Contract para el cliente. */
const NOMBRE_DE_ENTIDAD: Record<OwnerSource["via"], string> = {
  Unit: "Unit",
  Invitation: "Invitation",
  CertifierInvitation: "Invitation",
  ContractOfUnit: "Contract",
  Contract: "Contract"
};

/**
 * Carga el dueño de la fila. Ramas explícitas y no una query armada con nombres
 * de tabla en variables: son tres, y a cambio se lee sin resolver nada mental
 * (mismo criterio que `ProjectSource`).
 *
 * `contra` dice con qué campo del token se compara — la invitación viaja al
 * **email**, porque existe antes de que el investor tenga cuenta.
 */
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

async function evaluarDueño(
  user: NonNullable<Request["user"]>,
  req: Request,
  source: OwnerSource
): Promise<Veredicto> {
  const key = leerParam(req, source.param);
  if (typeof key !== "string") return key;

  const fila = await cargarDueño(source, key);

  // Mismo 404 y mismo mensaje que devolvía cada handler. Y la misma deuda
  // declarada de `requireProjectAccess`: desde afuera se distingue "no existe"
  // de "existe y no es tuyo". Se conserva a propósito.
  if (!fila) {
    return { ok: false, status: 404, message: `${NOMBRE_DE_ENTIDAD[source.via]} not found` };
  }

  if (user.role === "admin") return PASA;

  return fila.dueño !== null && fila.dueño === user[fila.contra] ? PASA : PROHIBIDO;
}

/**
 * **La regla de acceso de una ruta, como dato** (`PLAN-2026-09-04-guard-unico`).
 *
 * Las tres capas dejaron de ser tres llamadas encadenadas y pasaron a ser un
 * objeto con campos obligatorios, por una razón puntual: **hoy nada obliga a
 * declarar la pertenencia**. Una ruta del investor escrita con
 * `requireRole("admin", "buyer")` y nada más compila, pasa el happy path y sirve
 * la unidad de otro. D-042 resolvió eso para las membresías haciendo que omitir
 * el argumento no compile, y esa jugada no se puede repetir con middlewares
 * sueltos: **la ausencia de una llamada no es un tipo**.
 *
 * `"soloRol"` es la pieza que hace el trabajo. No fuerza a acertar —alguien
 * apurado lo escribe sin pensar— pero convierte una **ausencia** en una
 * **afirmación**, y esa es toda la diferencia en revisión: una ausencia es
 * invisible en un diff, una afirmación es algo que alguien firmó.
 *
 * **`scopeEnQuery` existe porque `"soloRol"` podía mentir.** Al migrar las 87
 * rutas quedaron 45 en `"soloRol"`, y 27 de ellas **sí tenían** regla de fila:
 * la aplicaba el handler adentro del query (`where userId = ...`,
 * `projectScope(...)`). Decir "esta ruta no tiene regla de fila" cuando la tiene
 * es peor que no decir nada, porque se lee como una revisión hecha. Ahora esas
 * rutas declaran **cuál** es el filtro, en texto: no lo verifica el compilador
 * —el handler podría no aplicarlo— pero deja de poder pasar por "acá no hay
 * nada que mirar", y el texto es grepeable contra el `where` de al lado.
 *
 * La diferencia práctica está en la matriz: una ruta de listado que quedó en
 * `"soloRol"` ahora **destaca**, y `GET /developer/audit-log` —que devuelve el
 * AuditLog entero sin acotar por proyecto— es exactamente lo que esta partición
 * hizo visible.
 *
 * `alguna` existe porque una cadena de middlewares es un AND y hay reglas que
 * son un OR: `GET /contracts/:contractId/releases` la ve el dueño del contrato
 * **o** cualquier miembro del proyecto. Con los guards sueltos eso no se podía
 * expresar y quedaba autorizando adentro del handler.
 */
export type ReglaSimple =
  | { proyecto: ProjectSource; membresias: MembershipRole[] }
  | { dueño: OwnerSource }
  /**
   * Hay regla de fila y **la aplica el handler**, en su propio query. El string
   * dice cuál: `"Unit.investorId = usuario"`, `"projectScope(developer)"`. Cubre
   * tanto los listados que se acotan como los chequeos por fila hechos con una
   * query scopeada.
   */
  | { scopeEnQuery: string }
  /** No hay regla de fila. El rol global es toda la regla. */
  | "soloRol";

/**
 * La disyunción **no anida**, y el tipo lo impide: `alguna` toma reglas simples
 * y pide al menos dos.
 *
 * Es una restricción deliberada, no una limitación que quedó. Con
 * `ReglaDeAcceso[]` recursivo, los cuatro consumidores del tipo —el evaluador,
 * el `describir` de la matriz, el chequeo de membresías vacías y el de
 * `scopeEnQuery` sin nombrar— tenían que recursionar, y eso es complejidad
 * repartida en cuatro lugares para expresar algo que **nadie necesita**: un
 * `alguna` adentro de un `alguna` se aplana a uno solo. Pedir dos ramas mínimo
 * cierra el otro caso absurdo, la disyunción de una sola cosa, que es una regla
 * simple escrita raro.
 *
 * Hoy la usa **una** ruta (`GET /contracts/:contractId/releases`) y eso también
 * es información: la disyunción existe porque *dueño de un contrato* y *miembro
 * del proyecto* son dos vínculos desconectados en el modelo —aceptar una
 * invitación NO crea `ProjectMember`, verificado en
 * `POST /investor/invitations/:id/accept`—. Si algún día aceptar creara la
 * membresía, esta regla colapsaría a un `proyecto` solo y `alguna` se podría
 * borrar. Mientras tanto, es la forma honesta de decirlo.
 */
export type ReglaDeAcceso = ReglaSimple | { alguna: [ReglaSimple, ReglaSimple, ...ReglaSimple[]] };

async function evaluarSimple(
  user: NonNullable<Request["user"]>,
  req: Request,
  regla: ReglaSimple
): Promise<Veredicto> {
  if (regla === "soloRol") return PASA;

  // `scopeEnQuery` no autoriza acá: es una **declaración** de que el handler lo
  // hace en su query. El guard la deja pasar igual que `"soloRol"` — lo que
  // cambia es lo que la ruta afirma, no lo que el guard ejecuta.
  if ("scopeEnQuery" in regla) return PASA;

  if ("proyecto" in regla) return evaluarProyecto(user, req, regla.proyecto, regla.membresias);
  return evaluarDueño(user, req, regla.dueño);
}

async function evaluarRegla(
  user: NonNullable<Request["user"]>,
  req: Request,
  regla: ReglaDeAcceso
): Promise<Veredicto> {
  if (typeof regla === "string" || !("alguna" in regla)) {
    return evaluarSimple(user, req, regla);
  }

  const veredictos: Veredicto[] = [];
  for (const rama of regla.alguna) {
    veredictos.push(await evaluarSimple(user, req, rama));
  }

  // El 500 gana sobre todo, incluso sobre una rama que pasa: una ruta mal
  // declarada tiene que ser ruidosa, y taparla con el OK de la otra rama sería
  // esconder un error de programación en la capa de autorización.
  const roto = veredictos.find((v) => !v.ok && (v.status === 500 || v.status === 400));
  if (roto) return roto;

  if (veredictos.some((v) => v.ok)) return PASA;

  // Ninguna rama pasó. Se prefiere 403 sobre 404: si una rama dice "no es tuyo"
  // y la otra "no existe", contestar 404 filtraría que el recurso no existe para
  // quien tampoco tenía permiso de saberlo.
  return veredictos.find((v) => !v.ok && v.status === 403) ?? veredictos[0] ?? PROHIBIDO;
}

/**
 * El guard único: rol global **y** regla de acceso, los dos obligatorios.
 *
 * Se construye sobre los mismos evaluadores que usan `requireRole`,
 * `requireProjectAccess` y `requireOwnership`: no reimplementa ninguna regla, y
 * el bypass de `admin` sigue viviendo en `projectScope` (D-043) y en
 * `evaluarDueño`, en un solo lugar cada uno.
 */
export function authorize(regla: { roles: UserRole[]; acceso: ReglaDeAcceso }) {
  return marcar(
    async (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!regla.roles.includes(req.user.role)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const veredicto = await evaluarRegla(req.user, req, regla.acceso);
      if (!veredicto.ok) {
        return res.status(veredicto.status).json({ message: veredicto.message });
      }

      return next();
    },
    { kind: "authorize", roles: regla.roles, acceso: regla.acceso }
  );
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

/**
 * **El scope del audit log**, como condición de Kysely.
 *
 * `GET /developer/audit-log` devolvía la tabla `AuditLog` **entera**, sin acotar
 * por proyecto, con `actorName` y `actorRole` de cada usuario del sistema: un
 * developer con membresía en un proyecto veía los eventos de todos los demás.
 * Es la regla 5 sin su segunda capa. Lo destapó etiquetar la ruta al partir
 * `"soloRol"` (D-088), no un reporte.
 *
 * **El entregable ya lo tenía decidido y no era una decisión de producto
 * abierta:** M2-D1 §4 — *"developer sees project-scoped events"* — y M2-D4 §P6 —
 * *"all events scoped to that developer's projects"*.
 *
 * **Por qué es esto y no una columna `projectId` en `AuditLog`.** La columna
 * sería mejor forma: la pregunta se contestaría sin joins y no habría manera de
 * que un `entityType` nuevo quede afuera del mapeo. Pero pide una migración
 * sobre una base desplegada —la primera desde que Turso está vivo (D-063)— y un
 * backfill que para varias filas viejas no tiene respuesta. Se resuelve por
 * query ahora y **la columna queda anotada como la forma que corresponde** el
 * día que se toque el esquema por otro motivo.
 *
 * **Fail-closed a propósito:** un `entityType` que no esté en este mapeo no se
 * muestra. Si mañana alguien audita una entidad nueva y se olvida de sumarla
 * acá, el síntoma es "no aparece en el audit log" y no "la ve todo el mundo".
 * `User` está afuera **por diseño**: crear usuarios o cambiar roles no pertenece
 * a ningún proyecto, y esos eventos son del admin, que bypasea todo esto.
 */
/** El scope de un `AuditEntityType`, dada la subquery de "mis proyectos". */
type AuditEntityScope = (
  eb: ExpressionBuilder<Database, "AuditLog">,
  misProyectos: ReturnType<ExpressionBuilder<Database, "AuditLog">["selectFrom"]>
) => ExpressionWrapper<Database, "AuditLog", SqlBool>;

/** El evento apunta a una fila de `tabla` que cae en uno de mis proyectos. */
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

/**
 * Un scope por `AuditEntityType`, **salvo `User`** — excluida con
 * `Exclude<...>`, no por omisión: crear usuarios o cambiar roles no pertenece
 * a ningún proyecto, y esos eventos son del admin, que bypasea todo esto más
 * arriba. `satisfies Record<...>` es lo que hace que agregar un
 * `AuditEntityType` sin decidir acá su scope **no compile** — mismo argumento
 * que `ALL_MEMBERSHIPS`/`TODOS_LOS_ROLES`, arriba en este archivo.
 */
const AUDIT_ENTITY_SCOPES = {
  // El proyecto mismo: el id del evento ES el projectId.
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
  // El dossier cuelga de la unidad, no del proyecto.
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
  // Y la atestación de pago cuelga del contrato, que cuelga de la unidad.
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

  // Los proyectos del usuario, como subquery: reusa `projectScope` para que la
  // regla de membresía siga viviendo en un solo lugar (D-043).
  const misProyectos = eb
    .selectFrom("Project")
    .select("Project.id")
    .where((e) => projectScope(e, role, userId, allowedMemberships));

  return eb.or(Object.values(AUDIT_ENTITY_SCOPES).map((scope) => scope(eb, misProyectos)));
}
