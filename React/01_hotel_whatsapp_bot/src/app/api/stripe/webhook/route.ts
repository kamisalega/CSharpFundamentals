import Stripe from "stripe";
import { getEnv } from "@/config/env";
import { prisma } from "@/db/prisma";
import { getCorrelationId } from "@/logging/correlationId";
import { logger } from "@/logging/logger";
import { createStripeWebhookHandler } from "@/payments/stripeWebhookHandler";
import { createTwilioMessagingAdapter } from "@/channels/twilio/TwilioMessagingAdapter";
import { createNoopEmailAdapter } from "@/email/NoopEmailAdapter";
import type { MessagingPort, TemplateKey } from "@/channels/MessagingPort";

export const runtime = "nodejs";

const env = getEnv();

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

function buildMessaging(): MessagingPort {
  if (
    !env.TWILIO_ACCOUNT_SID ||
    !env.TWILIO_AUTH_TOKEN ||
    !env.TWILIO_WHATSAPP_FROM
  ) {
    return {
      sendText: async () => ({ messageId: "noop" }),
      sendTemplate: async () => ({ messageId: "noop" }),
      sendFlow: async () => ({ messageId: "noop" }),
    };
  }

  const contentSidMap: Record<TemplateKey, string> = {
    WELCOME_MENU: env.TWILIO_CONTENT_SID_WELCOME_MENU ?? "",
    DATE_PICKER_FLOW: env.TWILIO_CONTENT_SID_DATE_PICKER_FLOW ?? "",
    GUESTS_PICKER_FLOW: env.TWILIO_CONTENT_SID_GUESTS_PICKER_FLOW ?? "",
    GUEST_INFO_FLOW: env.TWILIO_CONTENT_SID_GUEST_INFO_FLOW ?? "",
    ROOM_DETAIL_CARD: env.TWILIO_CONTENT_SID_ROOM_DETAIL_CARD ?? "",
    PAY_CTA: env.TWILIO_CONTENT_SID_PAY_CTA ?? "",
    BOOKING_CONFIRMED: env.TWILIO_CONTENT_SID_BOOKING_CONFIRMED ?? "",
  };

  return createTwilioMessagingAdapter({
    accountSid: env.TWILIO_ACCOUNT_SID,
    authToken: env.TWILIO_AUTH_TOKEN,
    from: env.TWILIO_WHATSAPP_FROM,
    contentSidMap,
  });
}

const handler = createStripeWebhookHandler({
  stripe,
  prisma,
  webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  logger,
  getCorrelationId: () => getCorrelationId() ?? "unknown",
  messaging: buildMessaging(),
  email: createNoopEmailAdapter(),
  bookingConfirmedSid: env.TWILIO_CONTENT_SID_BOOKING_CONFIRMED,
});

export const POST = handler.POST;
