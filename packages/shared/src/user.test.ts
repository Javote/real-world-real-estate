import { describe, expect, it } from "vitest";
import {
  createUserSchema,
  updateUserSchema,
  userMutationResultSchema,
  userSummarySchema
} from "./user";

describe("createUserSchema", () => {
  it("acepta un alta válida", () => {
    expect(
      createUserSchema.safeParse({
        email: "dev@example.com",
        password: "una password larga",
        role: "developer",
        fullName: "Ana Desarrolladora"
      }).success
    ).toBe(true);
  });

  it("rechaza un email inválido, un rol fuera del dominio y una password corta", () => {
    expect(
      createUserSchema.safeParse({
        email: "no-es-email",
        password: "una password larga",
        role: "developer",
        fullName: "Ana"
      }).success
    ).toBe(false);
    expect(
      createUserSchema.safeParse({
        email: "dev@example.com",
        password: "una password larga",
        role: "superadmin",
        fullName: "Ana"
      }).success
    ).toBe(false);
    expect(
      createUserSchema.safeParse({
        email: "dev@example.com",
        password: "corta",
        role: "developer",
        fullName: "Ana"
      }).success
    ).toBe(false);
  });
});

describe("updateUserSchema", () => {
  it("todo es opcional, incluida la password", () => {
    expect(updateUserSchema.safeParse({}).success).toBe(true);
    expect(updateUserSchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it("si viene password, igual respeta la política", () => {
    expect(updateUserSchema.safeParse({ password: "x" }).success).toBe(false);
  });
});

describe("userSummarySchema", () => {
  const fila = {
    id: "u1",
    email: "dev@example.com",
    role: "developer" as const,
    fullName: "Ana",
    isActive: true,
    createdAt: new Date().toISOString()
  };

  it("acepta la fila sin passwordHash", () => {
    expect(userSummarySchema.safeParse(fila).success).toBe(true);
  });

  it("rechaza si trae passwordHash — es strictObject (regla 4)", () => {
    expect(userSummarySchema.safeParse({ ...fila, passwordHash: "$2b$10$..." }).success).toBe(
      false
    );
  });
});

describe("userMutationResultSchema", () => {
  it("no lleva createdAt — el RETURNING real nunca lo trae", () => {
    const fila = {
      id: "u1",
      email: "dev@example.com",
      role: "developer" as const,
      fullName: "Ana",
      isActive: true
    };
    expect(userMutationResultSchema.safeParse(fila).success).toBe(true);
    expect(
      userMutationResultSchema.safeParse({ ...fila, createdAt: new Date().toISOString() }).success
    ).toBe(false);
  });
});
