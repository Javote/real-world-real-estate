import "dotenv/config";
import bcrypt from "bcrypt";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { passwordDeDemo, paraMostrar } from "./credentials";
import { milestones, projectMembers, projects, users } from "./schema";
import { createClient } from "../lib/libsql-client";

const client = createClient({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
  authToken: process.env.DATABASE_AUTH_TOKEN
});
const db = drizzle(client, { schema: { users, projects, projectMembers, milestones } });

async function main() {
  // Los defaults locales son los que documenta el README. Los de los tres roles
  // de demo comparten variable: el que importa de verdad es el admin.
  const adminPlano = passwordDeDemo("SEED_ADMIN_PASSWORD", "admin123");
  const demoPlano = (defaultLocal: string) => passwordDeDemo("SEED_DEMO_PASSWORD", defaultLocal);

  const adminPassword = await bcrypt.hash(adminPlano, 10);
  const developerPassword = await bcrypt.hash(demoPlano("developer123"), 10);
  const buyerPassword = await bcrypt.hash(demoPlano("buyer123"), 10);
  const verifierPassword = await bcrypt.hash(demoPlano("verifier123"), 10);

  // La password SÍ se actualiza en cada upsert: el seed imprime estas
  // credenciales al terminar, así que tiene que garantizarlas. Un
  // `onConflictDoNothing` dejaría una base ya existente con la password vieja
  // mientras el log anuncia la nueva — lo que pasó al subir el mínimo a 8
  // caracteres (D-046).
  const [admin] = await db
    .insert(users)
    .values({
      email: "admin@example.com",
      passwordHash: adminPassword,
      role: "admin",
      fullName: "Admin Demo"
    })
    .onConflictDoUpdate({ target: users.email, set: { passwordHash: adminPassword } })
    .returning();

  const [developer] = await db
    .insert(users)
    .values({
      email: "developer@example.com",
      passwordHash: developerPassword,
      role: "developer",
      fullName: "Developer Demo"
    })
    .onConflictDoUpdate({ target: users.email, set: { passwordHash: developerPassword } })
    .returning();

  const [buyer] = await db
    .insert(users)
    .values({
      email: "buyer@example.com",
      passwordHash: buyerPassword,
      role: "buyer",
      fullName: "Buyer Demo"
    })
    .onConflictDoUpdate({ target: users.email, set: { passwordHash: buyerPassword } })
    .returning();

  const [verifier] = await db
    .insert(users)
    .values({
      email: "verifier@example.com",
      passwordHash: verifierPassword,
      role: "verifier",
      fullName: "Verifier Demo"
    })
    .onConflictDoUpdate({ target: users.email, set: { passwordHash: verifierPassword } })
    .returning();

  // Proyecto y membresías: `onConflictDoNothing` — igual que `update: {}` de
  // Prisma, una base ya sembrada no cambia estos datos. Se relee por si el
  // insert no devolvió fila (conflicto).
  await db
    .insert(projects)
    .values({
      name: "Torre A",
      slug: "torre-a",
      address: "Av. Santa Fe 3200",
      city: "Buenos Aires",
      country: "Argentina",
      totalUnits: 48,
      status: "in_progress"
    })
    .onConflictDoNothing({ target: projects.slug });

  const [project] = await db.select().from(projects).where(eq(projects.slug, "torre-a"));

  await db
    .insert(projectMembers)
    .values({ userId: developer.id, projectId: project.id, membershipRole: "developer" })
    .onConflictDoNothing({
      target: [projectMembers.userId, projectMembers.projectId, projectMembers.membershipRole]
    });

  await db
    .insert(projectMembers)
    .values({ userId: buyer.id, projectId: project.id, membershipRole: "buyer" })
    .onConflictDoNothing({
      target: [projectMembers.userId, projectMembers.projectId, projectMembers.membershipRole]
    });

  await db
    .insert(projectMembers)
    .values({ userId: verifier.id, projectId: project.id, membershipRole: "verifier" })
    .onConflictDoNothing({
      target: [projectMembers.userId, projectMembers.projectId, projectMembers.membershipRole]
    });

  await db
    .insert(milestones)
    .values({
      projectId: project.id,
      name: "Cimentación",
      sequenceOrder: 1,
      state: "Completed",
      scopeUnitCount: 48
    })
    .onConflictDoNothing({ target: [milestones.projectId, milestones.sequenceOrder] });

  await db
    .insert(milestones)
    .values({
      projectId: project.id,
      name: "Estructura",
      sequenceOrder: 2,
      state: "InProgress",
      scopeUnitCount: 48
    })
    .onConflictDoNothing({ target: [milestones.projectId, milestones.sequenceOrder] });

  const mostrar = paraMostrar;

  console.log("Seed completado");
  console.log(`Admin: admin@example.com / ${mostrar("SEED_ADMIN_PASSWORD", "admin123")}`);
  console.log(`Developer: developer@example.com / ${mostrar("SEED_DEMO_PASSWORD", "developer123")}`);
  console.log(`Buyer: buyer@example.com / ${mostrar("SEED_DEMO_PASSWORD", "buyer123")}`);
  console.log(`Verifier: verifier@example.com / ${mostrar("SEED_DEMO_PASSWORD", "verifier123")}`);
  console.log("Project slug: torre-a");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    client.close();
  });
