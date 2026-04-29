import { randomBytes, randomUUID } from "crypto";
import { Session } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { buildCsp } from "./security/csp";
import { auth } from "./auth";

export async function handleProxy(
  request: NextRequest,
  session: Session | null,
): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/admin")) {
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (pathname.startsWith("/admin")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  const correlationId = request.headers.get("x-correlation-id") ?? randomUUID();
  const nonce = randomBytes(16).toString("base64url");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-correlation-id", correlationId);
  requestHeaders.set("x-csp-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-correlation-id", correlationId);

  const cspHeaderName =
    process.env.NODE_ENV === "production"
      ? "Content-Security-Policy"
      : "Content-Security-Policy-Report-Only";
  response.headers.set(cspHeaderName, buildCsp(nonce));

  return response;
}

export const proxy = auth(async (req) => handleProxy(req, req.auth ?? null));

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
