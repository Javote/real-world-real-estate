import { describe, expect, it } from "vitest";
import {
  addProjectMemberSchema,
  createDeveloperProjectSchema,
  createProjectSchema,
  developerProfileSchema,
  developerProjectCreateResultSchema,
  developerProjectDetailSchema,
  developerProjectListItemSchema,
  MEMBERSHIP_ROLES,
  PROJECT_STATUSES,
  projectDetailSchema,
  projectListItemSchema,
  projectListQuerySchema,
  projectMemberSchema,
  projectMemberWithUserSchema,
  projectSchema,
  updateProjectSchema
} from "./project";

const proyecto = {
  id: "p1",
  name: "Torre Norte",
  slug: "torre-norte",
  address: null,
  city: "CABA",
  country: "AR",
  latitude: null,
  longitude: null,
  totalUnits: 10,
  estimatedDelivery: null,
  status: "planning" as const,
  organizationId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const stage = {
  id: "s1",
  projectId: "p1",
  name: "Cimentación",
  sequenceOrder: 1,
  state: "Pending" as const,
  validationCritical: true,
  certifiedAt: null,
  certifiedById: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const anchor = {
  id: "e1",
  projectId: "p1",
  stageId: "s1",
  evidenceId: null,
  referenceId: null,
  eventIndex: 0,
  eventType: "STAGE_CREATED" as const,
  fromState: null,
  toState: "Pending" as const,
  commitment: null,
  status: "Confirmed" as const,
  txid: "a".repeat(64),
  network: "Preprod",
  outputRef: "abc#0",
  blockTimestamp: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

describe("projectListQuerySchema", () => {
  it("un status inválido es 400, no un filtro ignorado", () => {
    expect(projectListQuerySchema.safeParse({ status: "activo" }).success).toBe(false);
    for (const status of PROJECT_STATUSES) {
      expect(projectListQuerySchema.safeParse({ status }).success).toBe(true);
    }
  });

  it("un bbox mal formado es 400", () => {
    expect(projectListQuerySchema.safeParse({ bbox: "1,2,3" }).success).toBe(false);
    expect(projectListQuerySchema.safeParse({ bbox: "-1.5,2,3.2,4" }).success).toBe(true);
  });
});

describe("createProjectSchema y updateProjectSchema", () => {
  it("createProjectSchema acepta el mínimo con defaults", () => {
    const result = createProjectSchema.safeParse({ name: "Torre Norte", slug: "torre-norte" });
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe("planning");
    expect(result.data?.totalUnits).toBe(0);
  });

  it("updateProjectSchema tiene todos los campos opcionales", () => {
    expect(updateProjectSchema.safeParse({}).success).toBe(true);
  });
});

describe("addProjectMemberSchema", () => {
  it("acepta los tres roles de membresía", () => {
    for (const membershipRole of MEMBERSHIP_ROLES) {
      expect(addProjectMemberSchema.safeParse({ userId: "u1", membershipRole }).success).toBe(true);
    }
  });
});

describe("createDeveloperProjectSchema", () => {
  it("rechaza latitude/longitude/status — esta superficie no los pide", () => {
    expect(
      createDeveloperProjectSchema.safeParse({
        name: "Torre Norte",
        slug: "torre-norte",
        latitude: -34.6
      }).success
    ).toBe(false);
    expect(
      createDeveloperProjectSchema.safeParse({ name: "Torre Norte", slug: "torre-norte" }).success
    ).toBe(true);
  });
});

describe("projectSchema y sus extensiones", () => {
  it("acepta la fila completa, con organizationId nullable", () => {
    expect(projectSchema.safeParse(proyecto).success).toBe(true);
  });

  it("projectListItemSchema y projectDetailSchema extienden con stages/members", () => {
    expect(projectListItemSchema.safeParse({ ...proyecto, stages: [stage] }).success).toBe(true);
    expect(
      projectDetailSchema.safeParse({ ...proyecto, stages: [stage], members: [] }).success
    ).toBe(true);
  });
});

describe("projectMemberWithUserSchema y projectMemberSchema", () => {
  it("el primero embebe el usuario, el segundo no", () => {
    const miembro = {
      id: "pm1",
      userId: "u1",
      projectId: "p1",
      membershipRole: "developer" as const,
      createdAt: new Date().toISOString()
    };
    expect(projectMemberSchema.safeParse(miembro).success).toBe(true);
    expect(
      projectMemberWithUserSchema.safeParse({
        ...miembro,
        user: { id: "u1", email: "dev@example.com", fullName: "Ana", role: "developer" }
      }).success
    ).toBe(true);
  });
});

describe("developerProjectListItemSchema", () => {
  it("priceFromMinorUnits es null si no hay moneda única", () => {
    expect(
      developerProjectListItemSchema.safeParse({
        ...proyecto,
        stageCount: 10,
        progress: 30,
        priceFromMinorUnits: null,
        priceCurrency: null
      }).success
    ).toBe(true);
  });
});

describe("developerProfileSchema", () => {
  it("acepta un developer sin organización declarada todavía", () => {
    expect(
      developerProfileSchema.safeParse({
        organization: null,
        stats: {
          projectsDelivered: 0,
          unitsSold: 0,
          investors: 0,
          yearsInBusiness: null
        },
        previousProjects: [],
        activeProjects: []
      }).success
    ).toBe(true);
  });

  it("sin rating ni conteo de inversores en el pill (D-094) — no está en el schema", () => {
    expect(
      developerProfileSchema.safeParse({
        organization: null,
        stats: {
          projectsDelivered: 0,
          unitsSold: 0,
          investors: 0,
          yearsInBusiness: null,
          rating: 4.8
        },
        previousProjects: [],
        activeProjects: []
      }).success
    ).toBe(false);
  });
});

describe("developerProjectDetailSchema", () => {
  it("trae stages y evidenceCount", () => {
    expect(
      developerProjectDetailSchema.safeParse({ ...proyecto, stages: [stage], evidenceCount: 3 })
        .success
    ).toBe(true);
  });
});

describe("developerProjectCreateResultSchema", () => {
  it("cada stage del template trae su mint, aunque haya fallado (D-059)", () => {
    expect(
      developerProjectCreateResultSchema.safeParse({
        ...proyecto,
        stages: [{ ...stage, anchor: { ...anchor, status: "Failed" as const } }]
      }).success
    ).toBe(true);
  });
});
