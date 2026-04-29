import { Session } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "./auth";
import { randomUUID } from "crypto";

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
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-correlation-id", correlationId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-correlation-id", correlationId);
  return response;
}

export const proxy = auth(async (req) => handleProxy(req, req.auth ?? null));

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
