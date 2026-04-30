import { logger } from "@/logging/logger";
import { prisma } from "@/db/prisma";

let shuttingDown = false;

export function isShuttingDown(): boolean {
  return shuttingDown;
}

export function setupGracefulShutdown(): void {
  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ event: "process.shutdown", signal });

    await prisma.$disconnect().catch(() => {});
    logger.flush();
    process.exit(0);
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}
