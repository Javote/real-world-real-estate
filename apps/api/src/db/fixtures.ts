import bcrypt from "bcrypt";
import type { KyselyDb } from "../lib/kysely.js";
import { createId } from "./id.js";
import type { Database, MembershipRole, ProjectStatus, StageState, UserRole } from "./types.js";

export interface Personaje {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  isActive?: boolean;
}

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
  offsetMs?: number;
  organizationId?: string;
}

export interface OrganizacionSemilla {
  slug: string;
  name: string;
  bio?: string;
  foundedYear?: number;
}

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
        validationCritical: true,
        createdAt: ahora,
        updatedAt: ahora
      })
      .onConflict((oc) => oc.columns(["projectId", "sequenceOrder"]).doNothing())
      .execute();
  }
}

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
