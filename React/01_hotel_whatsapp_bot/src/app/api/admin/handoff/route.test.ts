import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/db/prisma", () => ({
  prisma: { conversation: { update: vi.fn() } },
}));

import { auth } from "@/auth";
import { prisma } from "@/db/prisma";
import { POST } from "./route";

const mockAuth = vi.mocked(auth);
const mockUpdate = vi.mocked(prisma.conversation.update);

const session = {
  user: { email: "admin@hotel.local" },
  expires: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
};

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/handoff", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(session as never);
    mockUpdate.mockResolvedValue({} as never);
  });

  it("zwraca 401 gdy brak sesji", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await POST(
      makeRequest({ conversationId: "c-1", paused: true }),
    );

    expect(res.status).toBe(401);
  });

  it("zwraca 400 gdy brak pola conversationId", async () => {
    const res = await POST(makeRequest({ paused: true }));

    expect(res.status).toBe(400);
  });

  it("zwraca 400 gdy paused nie jest boolean", async () => {
    const res = await POST(
      makeRequest({ conversationId: "c-1", paused: "yes" }),
    );

    expect(res.status).toBe(400);
  });

  it("zwraca 400 dla nieprawidłowego JSON", async () => {
    const req = new NextRequest("http://localhost/api/admin/handoff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json{",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("aktualizuje botPaused=true i zwraca 200", async () => {
    const res = await POST(
      makeRequest({ conversationId: "conv-abc", paused: true }),
    );

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "conv-abc" },
      data: { botPaused: true },
    });
  });

  it("aktualizuje botPaused=false (wznowienie bota)", async () => {
    const res = await POST(
      makeRequest({ conversationId: "conv-abc", paused: false }),
    );

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "conv-abc" },
      data: { botPaused: false },
    });
  });

  it("zwraca { ok: true } w body sukcesu", async () => {
    const res = await POST(
      makeRequest({ conversationId: "conv-abc", paused: true }),
    );
    const body = await res.json();

    expect(body).toEqual({ ok: true });
  });
});
