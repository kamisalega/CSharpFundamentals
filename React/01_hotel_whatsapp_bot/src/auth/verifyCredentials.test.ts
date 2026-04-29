import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetTestDb, testPrisma } from "../../tests/helpers/testDb";
import bcrypt from "bcryptjs";
import { verifyCredentials } from "./verifyCredentials";

describe("verifyCredentials", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  async function seedAdmin(email: string, password: string) {
    const passwordHash = await bcrypt.hash(password, 4); // cost 4 — szybko w testach
    return testPrisma.adminUser.create({ data: { email, passwordHash } });
  }

  it("zwraca null gdy email nie istnieje w bazie", async () => {
    const result = await verifyCredentials(testPrisma, {
      email: "nieznany@hotel.local",
      password: "admin123",
    });

    expect(result).toBeNull();
  });

  it("zwraca null gdy hasło nie pasuje", async () => {
    await seedAdmin("admin@hotel.local", "admin123");

    const result = await verifyCredentials(testPrisma, {
      email: "admin@hotel.local",
      password: "bledne-haslo",
    });

    expect(result).toBeNull();
  });

  it("zwraca { id, email } dla prawidłowych danych", async () => {
    const user = await seedAdmin("admin@hotel.local", "admin123");

    const result = await verifyCredentials(testPrisma, {
      email: "admin@hotel.local",
      password: "admin123",
    });

    expect(result).toEqual({ id: user.id, email: "admin@hotel.local" });
  });

  it("zwraca null dla pustego emaila (walidacja Zod)", async () => {
    const result = await verifyCredentials(testPrisma, {
      email: "",
      password: "admin123",
    });

    expect(result).toBeNull();
  });

  it("zwraca null dla hasła dłuższego niż 72 znaki", async () => {
    const result = await verifyCredentials(testPrisma, {
      email: "admin@hotel.local",
      password: "a".repeat(73),
    });

    expect(result).toBeNull();
  });
});
