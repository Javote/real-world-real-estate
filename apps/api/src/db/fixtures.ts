import bcrypt from "bcrypt";
import type { KyselyDb } from "../lib/kysely";
import { createId } from "./id";
import type { Database, MembershipRole, ProjectStatus, StageState, UserRole } from "./types";

// El elenco y los constructores del mundo, compartidos por el seed de
// desarrollo (`seed.ts`) y por los fixtures de la suite (`test/global-setup.ts`)
// — SPEC-015 §2.
//
// **Por qué existe este archivo.** Los dos describían el mismo dominio por
// separado, 500 líneas entre ambos, y derivaban sin que nadie se enterara: los
// fixtures NO tenían ningún usuario activo que no fuera developer o admin,
// mientras el seed sí los tenía. Esa ausencia es exactamente la razón por la
// que un `router.use(requireRole(...))` que contestaba 403 a toda la superficie
// del investor vivió sin que ningún test lo viera.
//
// **Lo que NO se unifica, a propósito.** Los dos mundos tienen intenciones
// distintas y forzarlos a ser el mismo sería peor:
//
//   · el seed arma un mundo DEMOSTRABLE, y corre por upsert contra una base que
//     ya puede tener datos (incluida Turso en pre-prod, donde no hay shell);
//   · los fixtures arman un mundo ADVERSO —un usuario inactivo, un developer
//     sin membresía, un proyecto sin miembros— que en una demo no pinta nada.
//
// Lo que sí comparten, y es lo que importa, son los constructores y la regla de
// que **todo rol tiene un representante activo**.

export interface Personaje {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  /** Solo los fixtures crean usuarios inactivos, para probar el rechazo. */
  isActive?: boolean;
}

/**
 * Inserta o actualiza los usuarios y devuelve sus ids por email.
 *
 * **La password SÍ se actualiza en el upsert.** El seed imprime estas
 * credenciales al terminar, así que tiene que garantizarlas: un `doNothing()`
 * dejaría una base ya existente con la password vieja mientras el log anuncia
 * la nueva — que es lo que pasó al subir el mínimo a 8 caracteres (D-046).
 */
export async function sembrarUsuarios(
  db: KyselyDb<Database>,
  elenco: readonly Personaje[]
): Promise<Map<string, string>> {
  const ahora = new Date();
  const porEmail = new Map<string, string>();

  for (const personaje of elenco) {
    const passwordHash = await bcrypt.hash(personaje.password, 10);

    const fila = await db
      .insertInto("User")
      .values({
        id: createId(),
        email: personaje.email,
        passwordHash,
        role: personaje.role,
        fullName: personaje.fullName,
        isActive: personaje.isActive ?? true,
        createdAt: ahora,
        updatedAt: ahora
      })
      .onConflict((oc) => oc.column("email").doUpdateSet({ passwordHash }))
      .returning("id")
      .executeTakeFirstOrThrow();

    porEmail.set(personaje.email, fila.id);
  }

  return porEmail;
}

export interface ProyectoSemilla {
  slug: string;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  totalUnits: number;
  status: ProjectStatus;
  /** Desfase en ms sobre el `createdAt`, para fijar el orden del listado. */
  offsetMs?: number;
  /** La organización desarrolladora (SPEC-220). Sin ella el proyecto es válido. */
  organizationId?: string;
}

export interface OrganizacionSemilla {
  slug: string;
  name: string;
  bio?: string;
  foundedYear?: number;
}

/** Inserta la organización si no existe y devuelve su id. */
export async function sembrarOrganizacion(
  db: KyselyDb<Database>,
  organizacion: OrganizacionSemilla
): Promise<string> {
  const ahora = new Date();

  await db
    .insertInto("Organization")
    .values({
      id: createId(),
      name: organizacion.name,
      slug: organizacion.slug,
      bio: organizacion.bio ?? null,
      foundedYear: organizacion.foundedYear ?? null,
      createdAt: ahora,
      updatedAt: ahora
    })
    .onConflict((oc) => oc.column("slug").doNothing())
    .execute();

  const fila = await db
    .selectFrom("Organization")
    .select("id")
    .where("slug", "=", organizacion.slug)
    .executeTakeFirstOrThrow();

  return fila.id;
}

/** Inserta el proyecto si no existe y devuelve su id. */
export async function sembrarProyecto(
  db: KyselyDb<Database>,
  proyecto: ProyectoSemilla
): Promise<string> {
  const ahora = new Date(Date.now() + (proyecto.offsetMs ?? 0));

  await db
    .insertInto("Project")
    .values({
      id: createId(),
      name: proyecto.name,
      slug: proyecto.slug,
      address: proyecto.address ?? null,
      city: proyecto.city ?? null,
      country: proyecto.country ?? null,
      totalUnits: proyecto.totalUnits,
      organizationId: proyecto.organizationId ?? null,
      status: proyecto.status,
      createdAt: ahora,
      updatedAt: ahora
    })
    // `doNothing()`: no reconcilia, solo evita el choque. Una base ya sembrada
    // no cambia estos datos.
    .onConflict((oc) => oc.column("slug").doNothing())
    .execute();

  const fila = await db
    .selectFrom("Project")
    .select("id")
    .where("slug", "=", proyecto.slug)
    .executeTakeFirstOrThrow();

  return fila.id;
}

export async function sembrarMembresias(
  db: KyselyDb<Database>,
  projectId: string,
  membresias: readonly { userId: string; membershipRole: MembershipRole }[]
): Promise<void> {
  if (membresias.length === 0) return;

  await db
    .insertInto("ProjectMember")
    .values(
      membresias.map((m) => ({
        id: createId(),
        userId: m.userId,
        projectId,
        membershipRole: m.membershipRole,
        createdAt: new Date()
      }))
    )
    .onConflict((oc) => oc.columns(["userId", "projectId", "membershipRole"]).doNothing())
    .execute();
}

export async function sembrarStages(
  db: KyselyDb<Database>,
  projectId: string,
  stages: readonly {
    name: string;
    sequenceOrder: number;
    state: StageState;
  }[]
): Promise<void> {
  const ahora = new Date();

  for (const stage of stages) {
    await db
      .insertInto("Stage")
      .values({
        id: createId(),
        projectId,
        name: stage.name,
        sequenceOrder: stage.sequenceOrder,
        state: stage.state,
        // D-061: todo stage es validation-critical.
        validationCritical: true,
        createdAt: ahora,
        updatedAt: ahora
      })
      .onConflict((oc) => oc.columns(["projectId", "sequenceOrder"]).doNothing())
      .execute();
  }
}

/**
 * Una unidad vendida con su contrato. Nacen juntos porque el contrato es el
 * resultado de aceptar la invitación (M3-SC-01): una unidad `sold` sin contrato
 * es un estado que el dominio no produce, y sembrarlo así engañaría a los
 * tests.
 */
export async function sembrarUnidadVendida(
  db: KyselyDb<Database>,
  input: {
    projectId: string;
    investorId: string;
    unitReference: string;
    floor: number;
    sizeM2: number;
    priceMinorUnits: number;
    currency: string;
  }
): Promise<{ unitId: string; contractId: string }> {
  const ahora = new Date();

  // SPEC-215: `doNothing()` + `executeTakeFirstOrThrow()` es una
  // contradicción — `doNothing` por definición no devuelve fila cuando la
  // fila ya existe, así que sobre una base ya sembrada esto tiraba
  // `NoResultError` y dejaba el seed a medio aplicar (`sembrarUsuarios`, antes
  // en la secuencia, ya había corrido). Mismo patrón que `sembrarProyecto`:
  // se tolera el conflicto insertando sin `returning`, y se relee por la
  // clave natural — así el id es el mismo en la primera corrida y en la
  // décima.
  await db
    .insertInto("Unit")
    .values({
      id: createId(),
      projectId: input.projectId,
      unitReference: input.unitReference,
      status: "sold",
      floor: input.floor,
      sizeM2: input.sizeM2,
      priceMinorUnits: input.priceMinorUnits,
      currency: input.currency,
      investorId: input.investorId,
      createdAt: ahora,
      updatedAt: ahora
    })
    .onConflict((oc) => oc.columns(["projectId", "unitReference"]).doNothing())
    .execute();

  const unidad = await db
    .selectFrom("Unit")
    .select("id")
    .where("projectId", "=", input.projectId)
    .where("unitReference", "=", input.unitReference)
    .executeTakeFirstOrThrow();

  await db
    .insertInto("Contract")
    .values({
      id: createId(),
      unitId: unidad.id,
      investorId: input.investorId,
      totalMinorUnits: input.priceMinorUnits,
      currency: input.currency,
      signedAt: ahora,
      createdAt: ahora
    })
    .onConflict((oc) => oc.column("unitId").doNothing())
    .execute();

  const contrato = await db
    .selectFrom("Contract")
    .select("id")
    .where("unitId", "=", unidad.id)
    .executeTakeFirstOrThrow();

  return { unitId: unidad.id, contractId: contrato.id };
}
