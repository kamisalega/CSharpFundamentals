import { Session } from "next-auth";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { handleProxy } from "./proxy";

vi.mock("@/auth", () => ({
  auth: (fn: unknown) => fn,
}));

function req(path: string, headers?: Record<string, string>) {
  return new NextRequest(`http://localhost${path}`, {
    headers: new Headers(headers),
  });
}

const session: Session = {
  user: { email: "admin@hotel.local" },
  expires: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
};

describe("handleProxy — ochrona /admin/*", () => {
  it("redirectuje do /login gdy brak sesji", async () => {
    const res = await handleProxy(req("/admin/conversations"), null);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("przepuszcza request gdy sesja istnieje", async () => {
    const res = await handleProxy(req("/admin/conversations"), session);

    expect(res.status).toBe(200);
  });
});

describe("handleProxy — ochrona /api/admin/*", () => {
  it("zwraca 401 gdy brak sesji", async () => {
    const res = await handleProxy(req("/api/admin/handoff"), null);

    expect(res.status).toBe(401);
  });

  it("przepuszcza request gdy sesja istnieje", async () => {
    const res = await handleProxy(req("/api/admin/handoff"), session);

    expect(res.status).toBe(200);
  });
});

describe("handleProxy — publiczne ścieżki", () => {
  it("nie blokuje /api/whatsapp/webhook", async () => {
    const res = await handleProxy(req("/api/whatsapp/webhook"), null);

    expect(res.status).toBe(200);
  });

  it("nie blokuje /api/stripe/webhook", async () => {
    const res = await handleProxy(req("/api/stripe/webhook"), null);

    expect(res.status).toBe(200);
  });

  it("nie blokuje /login", async () => {
    const res = await handleProxy(req("/login"), null);

    expect(res.status).toBe(200);
  });
});

describe("handleProxy — correlationId", () => {
  it("ustawia x-correlation-id w odpowiedzi gdy brak nagłówka", async () => {
    const res = await handleProxy(req("/api/whatsapp/webhook"), null);

    expect(res.headers.get("x-correlation-id")).toBeTruthy();
  });

  it("zachowuje istniejący x-correlation-id z requestu", async () => {
    const res = await handleProxy(
      req("/api/whatsapp/webhook", { "x-correlation-id": "abc-123" }),
      null,
    );

    expect(res.headers.get("x-correlation-id")).toBe("abc-123");
  });
});

describe("handleProxy — CSP (Report-Only w środowisku testowym)", () => {
  it("ustawia nagłówek Content-Security-Policy-Report-Only", async () => {
    const res = await handleProxy(req("/api/whatsapp/webhook"), null);

    expect(res.headers.get("content-security-policy-report-only")).toBeTruthy();
  });

  it("CSP zawiera nonce w script-src i style-src", async () => {
    const res = await handleProxy(req("/api/whatsapp/webhook"), null);
    const csp = res.headers.get("content-security-policy-report-only") ?? "";

    expect(csp).toMatch(/script-src 'self' 'nonce-[\w-]+'/);
    expect(csp).toMatch(/style-src 'self' 'nonce-[\w-]+'/);
  });

  it("każdy request dostaje unikalny nonce", async () => {
    const res1 = await handleProxy(req("/"), null);
    const res2 = await handleProxy(req("/"), null);

    const csp1 = res1.headers.get("content-security-policy-report-only");
    const csp2 = res2.headers.get("content-security-policy-report-only");

    expect(csp1).not.toBe(csp2);
  });
});

describe("handleProxy — propagacja nonce do layout", () => {
  it("ustawia x-csp-nonce w headerach requestu", async () => {
    const res = await handleProxy(req("/"), null);
    const csp = res.headers.get("content-security-policy-report-only") ?? "";

    const match = /nonce-([\w-]+)'/.exec(csp);
    expect(match).not.toBeNull();
    expect(match![1]).toHaveLength(22); 
  });
});
