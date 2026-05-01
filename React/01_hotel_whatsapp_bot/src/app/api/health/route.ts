import { isShuttingDown } from "@/lifecycle/shutdown";

export const dynamic = "force-dynamic";

export function GET() {
  if (isShuttingDown()) {
    return new Response("draining", { status: 503 });
  }
  return Response.json({ status: "ok" });
}
