import Stripe from "stripe";
import { getEnv } from "@/config/env";
import { prisma } from "@/db/prisma";
import { getCorrelationId } from "@/logging/correlationId";
import { logger } from "@/logging/logger";
import { createStripeWebhookHandler } from "@/payments/stripeWebhookHandler";

export const runtime = "nodejs";

const env = getEnv();

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

const handler = createStripeWebhookHandler({
  stripe,
  prisma,
  webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  logger,
  getCorrelationId: () => getCorrelationId() ?? "unknown",
});

export const POST = handler.POST;
