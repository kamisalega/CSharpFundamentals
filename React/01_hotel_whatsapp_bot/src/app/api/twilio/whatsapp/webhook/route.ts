import { BookingService } from "@/booking/BookingService";
import { createTwilioMessagingAdapter } from "@/channels/twilio/TwilioMessagingAdapter";
import {
  createTwilioWebhookHandlers,
  type TwilioIdempotencyStore,
} from "@/channels/twilio/TwilioWebhookHandler";
import { type TwilioInboundMessage } from "@/channels/twilio/TwilioWebhookSchema";
import { getEnv } from "@/config/env";
import { prisma } from "@/db/prisma";
import { createNoopEmailAdapter } from "@/email/NoopEmailAdapter";
import { flowIds } from "@/flows/flowIds.generated";
import { FlowConversationEngine } from "@/flows/FlowConversationEngine";
import { type FlowEvent } from "@/flows/FlowEvent";
import { type FlowSlots } from "@/flows/FlowSlots";
import { FlowState } from "@/flows/FlowState";
import { interpretEffects } from "@/flows/EffectInterpreter";
import { type TransitionContext, type TemplateSids } from "@/flows/transitions";
import { getCorrelationId } from "@/logging/correlationId";
import { logger } from "@/logging/logger";
import { createStripePaymentAdapter } from "@/payments/StripePaymentAdapter";
import { createStripeService } from "@/payments/StripeService";
import { createBookingServicePmsAdapter } from "@/pms/BookingServicePmsAdapter";
import { maskPhone } from "@/security/maskPII";
import { createRateLimiter } from "@/security/rateLimit";
import { Prisma } from "@prisma/client";
import { after } from "next/server";
import Stripe from "stripe";

const env = getEnv();

function requireTwilioEnv() {
  const missing: string[] = [];
  if (!env.TWILIO_ACCOUNT_SID) missing.push("TWILIO_ACCOUNT_SID");
  if (!env.TWILIO_AUTH_TOKEN) missing.push("TWILIO_AUTH_TOKEN");
  if (!env.TWILIO_WHATSAPP_FROM) missing.push("TWILIO_WHATSAPP_FROM");
  if (!env.TWILIO_WEBHOOK_PUBLIC_URL) missing.push("TWILIO_WEBHOOK_PUBLIC_URL");
  if (missing.length > 0) {
    throw new Error(`Twilio env vars missing: ${missing.join(", ")}`);
  }
  return {
    accountSid: env.TWILIO_ACCOUNT_SID!,
    authToken: env.TWILIO_AUTH_TOKEN!,
    from: env.TWILIO_WHATSAPP_FROM!,
    publicUrl: env.TWILIO_WEBHOOK_PUBLIC_URL!,
  };
}

const twilio = requireTwilioEnv();

const messaging = createTwilioMessagingAdapter({
  accountSid: twilio.accountSid,
  authToken: twilio.authToken,
  from: twilio.from,
  contentSidMap: {
    WELCOME_MENU: env.TWILIO_CONTENT_SID_WELCOME_MENU ?? "",
    DATE_PICKER_FLOW: env.TWILIO_CONTENT_SID_DATE_PICKER_FLOW ?? "",
    GUESTS_PICKER_FLOW: env.TWILIO_CONTENT_SID_GUESTS_PICKER_FLOW ?? "",
    GUEST_INFO_FLOW: env.TWILIO_CONTENT_SID_GUEST_INFO_FLOW ?? "",
    ROOM_DETAIL_CARD: env.TWILIO_CONTENT_SID_ROOM_DETAIL_CARD ?? "",
    PAY_CTA: env.TWILIO_CONTENT_SID_PAY_CTA ?? "",
    BOOKING_CONFIRMED: env.TWILIO_CONTENT_SID_BOOKING_CONFIRMED ?? "",
  },
});

const booking = new BookingService(prisma);

const ports = {
  messaging,
  pms: createBookingServicePmsAdapter(booking, prisma),
  payments: createStripePaymentAdapter(
    createStripeService({
      stripe: new Stripe(env.STRIPE_SECRET_KEY),
      prisma,
      baseUrl: env.APP_BASE_URL,
      sessionTtlMs: 30 * 60 * 1000,
    }),
  ),
  email: createNoopEmailAdapter(),
  prisma,
  now: () => new Date(),
};

const engine = new FlowConversationEngine();

const rateLimiter = createRateLimiter({
  capacity: 10,
  refillTokens: 10,
  refillIntervalMs: 60_000,
  namespace: "twilio-webhook",
});

const idempotency: TwilioIdempotencyStore = {
  async recordIfNew(externalId) {
    try {
      await prisma.processedWebhookEvent.create({
        data: { source: "TWILIO", externalId },
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
};

const handlers = createTwilioWebhookHandlers({
  authToken: twilio.authToken,
  publicUrl: twilio.publicUrl,
  rateLimiter,
  idempotency,
  process: async (msg, ctx) => {
    logger.info({
      event: "twilio.message.received",
      from: maskPhone(msg.from),
      messageSid: msg.messageSid,
      messageType: msg.messageType,
      correlationId: ctx.correlationId,
    });
    await processMessage(msg, ctx);
  },
  schedule: (fn) => after(fn),
  logger,
  getCorrelationId: () => getCorrelationId() ?? "unknown",
});

async function processMessage(
  msg: TwilioInboundMessage,
  ctx: Readonly<{ correlationId: string }>,
): Promise<void> {
  const conv = await prisma.conversation.upsert({
    where: { phone: msg.from },
    create: {
      phone: msg.from,
      channel: "TWILIO",
      state: "GREETING",
      flowState: FlowState.BOOT,
    },
    update: {},
  });

  if (conv.channel === "META") {
    logger.warn({
      event: "twilio.webhook.wrong_channel",
      phone: maskPhone(msg.from),
      correlationId: ctx.correlationId,
    });
    return;
  }

  const event = toFlowEvent(msg);
  if (!event) {
    logger.info({
      event: "twilio.webhook.ignored_message_type",
      messageType: msg.messageType,
      correlationId: ctx.correlationId,
    });
    return;
  }

  const currentState = (conv.flowState as FlowState | null) ?? FlowState.BOOT;
  const slots = reviveDateSlots(
    conv.flowSlots ? (JSON.parse(conv.flowSlots) as FlowSlots) : {},
  );

  const transitionCtx: TransitionContext = {
    conversationId: conv.id,
    phone: msg.from,
    locale: conv.locale,
    slots,
    templateSids: buildTemplateSids(),
    flowIds,
  };

  const result = engine.dispatch(currentState, event, transitionCtx);
  await interpretEffects(
    result.effects,
    result.next,
    transitionCtx,
    engine,
    ports,
  );

  logger.info({
    event: "twilio.message.processed",
    from: maskPhone(msg.from),
    fromState: currentState,
    toState: result.next,
    correlationId: ctx.correlationId,
  });
}

function toFlowEvent(msg: TwilioInboundMessage): FlowEvent | null {
  if (msg.buttonPayload) {
    return { kind: "menuSelection", selectionId: msg.buttonPayload };
  }
  if (msg.body.trim().length > 0) {
    return { kind: "inboundText", text: msg.body };
  }
  return null;
}

function buildTemplateSids(): TemplateSids {
  return {
    welcomeMenu: env.TWILIO_CONTENT_SID_WELCOME_MENU ?? "",
    datePickerFlow: env.TWILIO_CONTENT_SID_DATE_PICKER_FLOW ?? "",
    guestsPickerFlow: env.TWILIO_CONTENT_SID_GUESTS_PICKER_FLOW ?? "",
    guestInfoFlow: env.TWILIO_CONTENT_SID_GUEST_INFO_FLOW ?? "",
    roomDetailCard: env.TWILIO_CONTENT_SID_ROOM_DETAIL_CARD ?? "",
    payCta: env.TWILIO_CONTENT_SID_PAY_CTA ?? "",
    bookingConfirmed: env.TWILIO_CONTENT_SID_BOOKING_CONFIRMED ?? "",
  };
}

function reviveDateSlots(slots: FlowSlots): FlowSlots {
  return {
    ...slots,
    ...(slots.checkIn ? { checkIn: new Date(slots.checkIn as unknown as string) } : {}),
    ...(slots.checkOut ? { checkOut: new Date(slots.checkOut as unknown as string) } : {}),
  };
}

export const POST = handlers.POST;
