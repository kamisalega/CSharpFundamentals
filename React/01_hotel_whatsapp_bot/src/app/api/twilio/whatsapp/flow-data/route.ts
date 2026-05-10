import { BookingService } from "@/booking/BookingService";
import { createTwilioMessagingAdapter } from "@/channels/twilio/TwilioMessagingAdapter";
import { createFlowDataExchangeHandlers } from "@/channels/twilio/TwilioFlowDataExchangeHandler";
import { getEnv } from "@/config/env";
import { prisma } from "@/db/prisma";
import { createNoopEmailAdapter } from "@/email/NoopEmailAdapter";
import { flowIds } from "@/flows/flowIds.generated";
import { FlowConversationEngine } from "@/flows/FlowConversationEngine";
import { interpretEffects } from "@/flows/EffectInterpreter";
import { getCorrelationId } from "@/logging/correlationId";
import { logger } from "@/logging/logger";
import { createStripePaymentAdapter } from "@/payments/StripePaymentAdapter";
import { createStripeService } from "@/payments/StripeService";
import { createBookingServicePmsAdapter } from "@/pms/BookingServicePmsAdapter";
import { after } from "next/server";
import Stripe from "stripe";

const env = getEnv();

function requireTwilioFlowEnv() {
  const missing: string[] = [];
  if (!env.TWILIO_ACCOUNT_SID) missing.push("TWILIO_ACCOUNT_SID");
  if (!env.TWILIO_AUTH_TOKEN) missing.push("TWILIO_AUTH_TOKEN");
  if (!env.TWILIO_WHATSAPP_FROM) missing.push("TWILIO_WHATSAPP_FROM");
  if (!env.TWILIO_FLOW_PRIVATE_KEY) missing.push("TWILIO_FLOW_PRIVATE_KEY");
  if (missing.length > 0) {
    throw new Error(`Twilio Flow env vars missing: ${missing.join(", ")}`);
  }
  return {
    accountSid: env.TWILIO_ACCOUNT_SID!,
    authToken: env.TWILIO_AUTH_TOKEN!,
    from: env.TWILIO_WHATSAPP_FROM!,
    privateKeyPem: env.TWILIO_FLOW_PRIVATE_KEY!,
  };
}

const twilio = requireTwilioFlowEnv();

const PUBLIC_URL = `${env.APP_BASE_URL}/api/twilio/whatsapp/flow-data`;

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
const engine = new FlowConversationEngine();

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

const handlers = createFlowDataExchangeHandlers({
  privateKeyPem: twilio.privateKeyPem,
  authToken: twilio.authToken,
  publicUrl: PUBLIC_URL,
  engine,
  ports,
  templateSids: {
    welcomeMenu: env.TWILIO_CONTENT_SID_WELCOME_MENU ?? "",
    datePickerFlow: env.TWILIO_CONTENT_SID_DATE_PICKER_FLOW ?? "",
    guestsPickerFlow: env.TWILIO_CONTENT_SID_GUESTS_PICKER_FLOW ?? "",
    guestInfoFlow: env.TWILIO_CONTENT_SID_GUEST_INFO_FLOW ?? "",
    roomDetailCard: env.TWILIO_CONTENT_SID_ROOM_DETAIL_CARD ?? "",
    payCta: env.TWILIO_CONTENT_SID_PAY_CTA ?? "",
    bookingConfirmed: env.TWILIO_CONTENT_SID_BOOKING_CONFIRMED ?? "",
  },
  flowIds,
  schedule: (fn) => after(fn),
  logger,
  getCorrelationId: () => getCorrelationId() ?? "unknown",
});

export const POST = handlers.POST;
