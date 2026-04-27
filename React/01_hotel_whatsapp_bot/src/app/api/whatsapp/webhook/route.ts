import { getEnv } from "@/config/env";
import { prisma } from "@/db/prisma";
import { getCorrelationId } from "@/logging/correlationId";
import { logger } from "@/logging/logger";
import { createTokenBucketLimiter } from "@/security/rateLimit";
import { createWebhookHandlers } from "@/whatsapp/webhookHandler";
import { Prisma } from "@prisma/client";
import { after } from "node:test";

const env = getEnv();

const rateLimiter = createTokenBucketLimiter({
  capacity: 10,
  refillTokens: 10,
  refillIntervalMs: 60_000,
});

const handlers = createWebhookHandlers({
  appSecret: env.META_WHATSAPP_APP_SECRET,
  verifyToken: env.META_WHATSAPP_VERIFY_TOKEN,
  rateLimiter,
  idempotency: {
    async recordIfNew(externalId) {
      try {
        await prisma.processedWebhookEvent.create({
          data: { source: "META", externalId },
        });
        return { isNew: true };
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          return { isNew: false };
        }
        throw err;
      }
    },
  },
  process: async (message, ctx) => {
    logger.info({
      event: "whatsapp.message.received",
      from: message.from,
      messageId: message.messageId,
      length: message.text.length,
      correlationId: ctx.correlationId,
    });
  },
  schedule: (fn) => after(fn),
  logger,
  getCorrelationId: () => getCorrelationId() ?? "unknown",
});

export const GET = handlers.GET;
export const POST = handlers.POST;
