import { prisma } from "@/db/prisma";
import { isShuttingDown } from "@/lifecycle/shutdown";
import { getRedisClient } from "@/redis";

export const revalidate = 0;

export async function GET() {
  if (isShuttingDown()) {
    return Response.json(
      { db: "down", redis: "down", reason: "draining" },
      { status: 503 },
    );
  }

  const [dbResult, redisResult] = await Promise.allSettled([
    Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 1_000),
      ),
    ]),
    Promise.race([
      getRedisClient().ping(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 500),
      ),
    ]),
  ]);

  const db = dbResult.status === "fulfilled" ? "ok" : "down";
  const redis = redisResult.status === "fulfilled" ? "ok" : "down";

  if (db === "ok" && redis === "ok") {
    return Response.json({ db, redis });
  }

  return Response.json({ db, redis }, { status: 503 });
}
