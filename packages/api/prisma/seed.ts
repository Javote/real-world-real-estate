import "dotenv/config";
import bcrypt from "bcrypt";
import {
  MembershipRole,
  MilestoneState,
  PrismaClient,
  ProjectStatus,
  UserRole
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("admin123", 10);
  const developerPassword = await bcrypt.hash("developer123", 10);
  const buyerPassword = await bcrypt.hash("buyer123", 10);
  const verifierPassword = await bcrypt.hash("verifier123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    // La password SÍ se actualiza: el seed imprime estas credenciales al
    // terminar, así que tiene que garantizarlas. Con `update: {}` una base ya
    // existente conservaba la vieja mientras el seed anunciaba la nueva — que es
    // lo que pasó al subir el mínimo a 8 caracteres (D-046).
    update: { passwordHash: adminPassword },
    create: {
      email: "admin@example.com",
      passwordHash: adminPassword,
      role: UserRole.admin,
      fullName: "Admin Demo"
    }
  });

  const developer = await prisma.user.upsert({
    where: { email: "developer@example.com" },
    // La password SÍ se actualiza: el seed imprime estas credenciales al
    // terminar, así que tiene que garantizarlas. Con `update: {}` una base ya
    // existente conservaba la vieja mientras el seed anunciaba la nueva — que es
    // lo que pasó al subir el mínimo a 8 caracteres (D-046).
    update: { passwordHash: developerPassword },
    create: {
      email: "developer@example.com",
      passwordHash: developerPassword,
      role: UserRole.developer,
      fullName: "Developer Demo"
    }
  });

  const buyer = await prisma.user.upsert({
    where: { email: "buyer@example.com" },
    // La password SÍ se actualiza: el seed imprime estas credenciales al
    // terminar, así que tiene que garantizarlas. Con `update: {}` una base ya
    // existente conservaba la vieja mientras el seed anunciaba la nueva — que es
    // lo que pasó al subir el mínimo a 8 caracteres (D-046).
    update: { passwordHash: buyerPassword },
    create: {
      email: "buyer@example.com",
      passwordHash: buyerPassword,
      role: UserRole.buyer,
      fullName: "Buyer Demo"
    }
  });

  const verifier = await prisma.user.upsert({
    where: { email: "verifier@example.com" },
    // La password SÍ se actualiza: el seed imprime estas credenciales al
    // terminar, así que tiene que garantizarlas. Con `update: {}` una base ya
    // existente conservaba la vieja mientras el seed anunciaba la nueva — que es
    // lo que pasó al subir el mínimo a 8 caracteres (D-046).
    update: { passwordHash: verifierPassword },
    create: {
      email: "verifier@example.com",
      passwordHash: verifierPassword,
      role: UserRole.verifier,
      fullName: "Verifier Demo"
    }
  });

  const project = await prisma.project.upsert({
    where: { slug: "torre-a" },
    update: {},
    create: {
      name: "Torre A",
      slug: "torre-a",
      address: "Av. Santa Fe 3200",
      city: "Buenos Aires",
      country: "Argentina",
      totalUnits: 48,
      status: ProjectStatus.in_progress
    }
  });

  await prisma.projectMember.upsert({
    where: {
      userId_projectId_membershipRole: {
        userId: developer.id,
        projectId: project.id,
        membershipRole: MembershipRole.developer
      }
    },
    update: {},
    create: {
      userId: developer.id,
      projectId: project.id,
      membershipRole: MembershipRole.developer
    }
  });

  await prisma.projectMember.upsert({
    where: {
      userId_projectId_membershipRole: {
        userId: buyer.id,
        projectId: project.id,
        membershipRole: MembershipRole.buyer
      }
    },
    update: {},
    create: {
      userId: buyer.id,
      projectId: project.id,
      membershipRole: MembershipRole.buyer
    }
  });

  await prisma.projectMember.upsert({
    where: {
      userId_projectId_membershipRole: {
        userId: verifier.id,
        projectId: project.id,
        membershipRole: MembershipRole.verifier
      }
    },
    update: {},
    create: {
      userId: verifier.id,
      projectId: project.id,
      membershipRole: MembershipRole.verifier
    }
  });

  await prisma.milestone.upsert({
    where: {
      projectId_sequenceOrder: {
        projectId: project.id,
        sequenceOrder: 1
      }
    },
    update: {},
    create: {
      projectId: project.id,
      name: "Cimentación",
      sequenceOrder: 1,
      state: MilestoneState.Completed,
      scopeUnitCount: 48
    }
  });

  await prisma.milestone.upsert({
    where: {
      projectId_sequenceOrder: {
        projectId: project.id,
        sequenceOrder: 2
      }
    },
    update: {},
    create: {
      projectId: project.id,
      name: "Estructura",
      sequenceOrder: 2,
      state: MilestoneState.InProgress,
      scopeUnitCount: 48
    }
  });

  console.log("Seed completado");
  console.log("Admin: admin@example.com / admin123");
  console.log("Developer: developer@example.com / developer123");
  console.log("Buyer: buyer@example.com / buyer123");
  console.log("Verifier: verifier@example.com / verifier123");
  console.log("Project slug: torre-a");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
