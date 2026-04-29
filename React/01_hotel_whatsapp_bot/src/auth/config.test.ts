import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VerifiedUser } from "./verifyCredentials";

vi.mock("@/db/prisma", () => ({ prisma: {} }));
vi.mock("./verifyCredentials");

import { verifyCredentials } from "./verifyCredentials";
import { authorize } from "./config";

const mockVerify = vi.mocked(verifyCredentials);

describe("authorize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("zwraca null gdy verifyCredentials zwraca null", async () => {
    mockVerify.mockResolvedValue(null);

    const result = await authorize({ email: "x@x.com", password: "wrong" });

    expect(result).toBeNull();
  });

  it("zwraca usera gdy verifyCredentials zwraca użytkownika", async () => {
    const user: VerifiedUser = { id: "cuid-1", email: "admin@hotel.local" };
    mockVerify.mockResolvedValue(user);

    const result = await authorize({
      email: "admin@hotel.local",
      password: "admin123",
    });

    expect(result).toEqual({ id: "cuid-1", email: "admin@hotel.local" });
  });

  it("przekazuje credentials do verifyCredentials", async () => {
    mockVerify.mockResolvedValue(null);
    const credentials = { email: "x@x.com", password: "pass" };

    await authorize(credentials);

    expect(mockVerify).toHaveBeenCalledWith({}, credentials);
  });
});
