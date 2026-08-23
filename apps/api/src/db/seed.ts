import "dotenv/config";
import bcrypt from "bcrypt";
import { db } from "../lib/db";
import { paraMostrar, passwordDeDemo } from "./credentials";
import { createId } from "./id";

async function main() {
  // Los defaults locales son los que documenta el README. Los de los tres roles
  // de demo comparten variable: el que importa de verdad es el admin.
  const adminPlano = passwordDeDemo("SEED_ADMIN_PASSWORD", "admin123");
  const demoPlano = (defaultLocal: string) => passwordDeDemo("SEED_DEMO_PASSWORD", defaultLocal);

  const adminPassword = await bcrypt.hash(adminPlano, 10);
  const developerPassword = await bcrypt.hash(demoPlano("developer123"), 10);
  const buyerPassword = await bcrypt.hash(demoPlano("buyer123"), 10);
  const verifierPassword = await bcrypt.hash(demoPlano("verifier123"), 10);
  const notaryPassword = await bcrypt.hash(demoPlano("notary123"), 10);

  const now = new Date();

  // La password SÍ se actualiza en cada upsert: el seed imprime estas
  // credenciales al terminar, así que tiene que garantizarlas. Un
  // `doNothing()` dejaría una base ya existente con la password vieja mientras
  // el log anuncia la nueva — lo que pasó al subir el mínimo a 8 caracteres
  // (D-046).
  await db
    .insertInto("User")
    .values({
      id: createId(),
      email: "admin@example.com",
      passwordHash: adminPassword,
      role: "admin",
      fullName: "Admin Demo",
      isActive: true,
      createdAt: now,
      updatedAt: now
    })
    .onConflict((oc) => oc.column("email").doUpdateSet({ passwordHash: adminPassword }))
    .returningAll()
    .executeTakeFirstOrThrow();

  const developer = await db
    .insertInto("User")
    .values({
      id: createId(),
      email: "developer@example.com",
      passwordHash: developerPassword,
      role: "developer",
      fullName: "Developer Demo",
      isActive: true,
      createdAt: now,
      updatedAt: now
    })
    .onConflict((oc) => oc.column("email").doUpdateSet({ passwordHash: developerPassword }))
    .returningAll()
    .executeTakeFirstOrThrow();

  const buyer = await db
    .insertInto("User")
    .values({
      id: createId(),
      email: "buyer@example.com",
      passwordHash: buyerPassword,
      role: "buyer",
      fullName: "Buyer Demo",
      isActive: true,
      createdAt: now,
      updatedAt: now
    })
    .onConflict((oc) => oc.column("email").doUpdateSet({ passwordHash: buyerPassword }))
    .returningAll()
    .executeTakeFirstOrThrow();

  const verifier = await db
    .insertInto("User")
    .values({
      id: createId(),
      email: "verifier@example.com",
      passwordHash: verifierPassword,
      role: "verifier",
      fullName: "Verifier Demo",
      isActive: true,
      createdAt: now,
      updatedAt: now
    })
    .onConflict((oc) => oc.column("email").doUpdateSet({ passwordHash: verifierPassword }))
    .returningAll()
    .executeTakeFirstOrThrow();

  // El rol notary (SPEC-011) no tiene membresía de proyecto todavía: esta
  // rebanada solo agrega el rol para que el login/landing lo reconozca, sin
  // tocar ProjectMember (queda para cuando el notario tenga dossiers que revisar).
  await db
    .insertInto("User")
    .values({
      id: createId(),
      email: "notary@example.com",
      passwordHash: notaryPassword,
      role: "notary",
      fullName: "Notary Demo",
      isActive: true,
      createdAt: now,
      updatedAt: now
    })
    .onConflict((oc) => oc.column("email").doUpdateSet({ passwordHash: notaryPassword }))
    .returningAll()
    .executeTakeFirstOrThrow();

  // Proyecto y membresías: `doNothing()` — no reconcilia, solo evita el choque,
  // una base ya sembrada no cambia estos datos.
  await db
    .insertInto("Project")
    .values({
      id: createId(),
      name: "Torre A",
      slug: "torre-a",
      address: "Av. Santa Fe 3200",
      city: "Buenos Aires",
      country: "Argentina",
      totalUnits: 48,
      status: "in_progress",
      createdAt: now,
      updatedAt: now
    })
    .onConflict((oc) => oc.column("slug").doNothing())
    .execute();

  const project = await db
    .selectFrom("Project")
    .selectAll()
    .where("slug", "=", "torre-a")
    .executeTakeFirstOrThrow();

  await db
    .insertInto("ProjectMember")
    .values({
      id: createId(),
      userId: developer.id,
      projectId: project.id,
      membershipRole: "developer",
      createdAt: now
    })
    .onConflict((oc) => oc.columns(["userId", "projectId", "membershipRole"]).doNothing())
    .execute();

  await db
    .insertInto("ProjectMember")
    .values({
      id: createId(),
      userId: buyer.id,
      projectId: project.id,
      membershipRole: "buyer",
      createdAt: now
    })
    .onConflict((oc) => oc.columns(["userId", "projectId", "membershipRole"]).doNothing())
    .execute();

  await db
    .insertInto("ProjectMember")
    .values({
      id: createId(),
      userId: verifier.id,
      projectId: project.id,
      membershipRole: "verifier",
      createdAt: now
    })
    .onConflict((oc) => oc.columns(["userId", "projectId", "membershipRole"]).doNothing())
    .execute();

  await db
    .insertInto("Milestone")
    .values({
      id: createId(),
      projectId: project.id,
      name: "Cimentación",
      sequenceOrder: 1,
      state: "Completed",
      validationCritical: true,
      scopeType: "project_wide",
      scopeUnitCount: 48,
      createdAt: now,
      updatedAt: now
    })
    .onConflict((oc) => oc.columns(["projectId", "sequenceOrder"]).doNothing())
    .execute();

  await db
    .insertInto("Milestone")
    .values({
      id: createId(),
      projectId: project.id,
      name: "Estructura",
      sequenceOrder: 2,
      state: "InProgress",
      validationCritical: true,
      scopeType: "project_wide",
      scopeUnitCount: 48,
      createdAt: now,
      updatedAt: now
    })
    .onConflict((oc) => oc.columns(["projectId", "sequenceOrder"]).doNothing())
    .execute();

  const mostrar = paraMostrar;

  console.log("Seed completado");
  console.log(`Admin: admin@example.com / ${mostrar("SEED_ADMIN_PASSWORD", "admin123")}`);
  console.log(
    `Developer: developer@example.com / ${mostrar("SEED_DEMO_PASSWORD", "developer123")}`
  );
  console.log(`Buyer: buyer@example.com / ${mostrar("SEED_DEMO_PASSWORD", "buyer123")}`);
  console.log(`Verifier: verifier@example.com / ${mostrar("SEED_DEMO_PASSWORD", "verifier123")}`);
  console.log(`Notary: notary@example.com / ${mostrar("SEED_DEMO_PASSWORD", "notary123")}`);
  console.log("Project slug: torre-a");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    db.destroy();
  });
