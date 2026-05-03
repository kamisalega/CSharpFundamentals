import { getAiProvider } from "@/ai";
import { BookingService } from "@/booking/BookingService";
import { getEnv } from "@/config/env";
import { Orchestrator } from "@/conversation/orchestrator";
import { prisma } from "@/db/prisma";
import { getCorrelationId } from "@/logging/correlationId";
import { logger } from "@/logging/logger";
import { createStripeService } from "@/payments/StripeService";
import { maskPhone } from "@/security/maskPII";
import { createRateLimiter } from "@/security/rateLimit";
import { createWebhookHandlers } from "@/whatsapp/webhookHandler";
import { createWhatsAppClient } from "@/whatsapp/WhatsAppClient";
import { Prisma } from "@prisma/client";
import { after } from "next/server";
import Stripe from "stripe";

const env = getEnv();

const orchestrator = new Orchestrator({
  prisma,
  ai: getAiProvider(env),
  whatsapp: createWhatsAppClient({
    baseUrl: "https://graph.facebook.com/v25.0",
    phoneNumberId: env.META_WHATSAPP_PHONE_ID,
    accessToken: env.META_WHATSAPP_ACCESS_TOKEN,
  }),
  booking: new BookingService(prisma),
  stripe: createStripeService({
    stripe: new Stripe(env.STRIPE_SECRET_KEY),
    prisma,
    baseUrl: env.APP_BASE_URL,
    sessionTtlMs: 30 * 60 * 1000,
  }),
  logger,
  now: () => new Date(),
});

const rateLimiter = createRateLimiter({
  capacity: 10,
  refillTokens: 10,
  refillIntervalMs: 60_000,
  namespace: "wa-webhook",
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
      from: maskPhone(message.from),
      messageId: message.messageId,
      length: message.text.length,
      correlationId: ctx.correlationId,
    });

    await orchestrator.handle({
      phone: message.from,
      text: message.text,
      whatsappMessageId: message.messageId,
      correlationId: ctx.correlationId,
    });
  },
  schedule: (fn) => after(fn),
  logger,
  getCorrelationId: () => getCorrelationId() ?? "unknown",
});

export const GET = handlers.GET;
export const POST = handlers.POST;
