import { afterAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { Prisma } from "@prisma/client";
import { BookingService } from "@/booking/BookingService";
import { createFlowDataExchangeHandlers } from "@/channels/twilio/TwilioFlowDataExchangeHandler";
import {
  createTwilioWebhookHandlers,
  type TwilioIdempotencyStore,
} from "@/channels/twilio/TwilioWebhookHandler";
import type { TwilioInboundMessage } from "@/channels/twilio/TwilioWebhookSchema";
import type { MessagingPort, FlowKey } from "@/channels/MessagingPort";
import type { EmailPort } from "@/email/EmailPort";
import type { PaymentPort } from "@/payments/PaymentPort";
import { createBookingServicePmsAdapter } from "@/pms/BookingServicePmsAdapter";
import { interpretEffects } from "@/flows/EffectInterpreter";
import { FlowConversationEngine } from "@/flows/FlowConversationEngine";
import type { FlowEvent } from "@/flows/FlowEvent";
import type { FlowSlots } from "@/flows/FlowSlots";
import { FlowState } from "@/flows/FlowState";
import type { TransitionContext, TemplateSids, FlowIds } from "@/flows/transitions";
import { createTokenBucketLimiter } from "@/security/rateLimit";
import { resetTestDb, seedTestRoom, testPrisma } from "../helpers/testDb";
import {
  aTwilioButtonReply,
  aTwilioInboundText,
} from "../fixtures/twilio-webhook";
import {
  TEST_PRIVATE_KEY_PEM,
  dateExchangeRequest,
  guestsExchangeRequest,
  initRequest,
} from "../fixtures/flow-data-exchange";

const PHONE = "+33611000088";
const AUTH_TOKEN = "test-auth-e2e-no-avail-5678";
const WEBHOOK_URL = "https://e2e.test/api/twilio/whatsapp/webhook";
const FLOW_DATA_URL = "https://e2e.test/api/twilio/whatsapp/flow-data";

const TEST_TEMPLATE_SIDS: TemplateSids = {
  welcomeMenu: "HXwelcome",
  datePickerFlow: "HXdates",
  guestsPickerFlow: "HXguests",
  guestInfoFlow: "HXguestinfo",
  roomDetailCard: "HXroom",
  payCta: "HXpay",
  bookingConfirmed: "HXconfirmed",
};

const TEST_FLOW_IDS: FlowIds = {
  datePicker: "DATE_PICKER" as FlowKey,
  guestsPicker: "GUESTS_PICKER" as FlowKey,
  guestInfo: "GUEST_INFO" as FlowKey,
};

function toFlowEvent(msg: TwilioInboundMessage): FlowEvent | null {
  if (msg.buttonPayload) return { kind: "menuSelection", selectionId: msg.buttonPayload };
  if (msg.body.trim().length > 0) return { kind: "inboundText", text: msg.body };
  return null;
}

function reviveDateSlots(slots: FlowSlots): FlowSlots {
  return {
    ...slots,
    ...(slots.checkIn ? { checkIn: new Date(slots.checkIn as unknown as string) } : {}),
    ...(slots.checkOut ? { checkOut: new Date(slots.checkOut as unknown as string) } : {}),
  };
}

describe("twilio-no-availability (E2E)", () => {
  let webhookHandlers: ReturnType<typeof createTwilioWebhookHandlers>;
  let flowHandlers: ReturnType<typeof createFlowDataExchangeHandlers>;
  let flush: () => Promise<void>;
  let sendTemplate: Mock;
  let sendFlow: Mock;

  beforeEach(async () => {
    await resetTestDb();
    vi.clearAllMocks();

    // Pokój dostępny dopiero od LIPCA — user prosi o CZERWIEC → brak dostępności
    await seedTestRoom({
      name: "Suite Côte d'Azur",
      capacity: 2,
      basePrice: 12000,
      from: new Date("2026-07-01T00:00:00.000Z"),
      days: 10,
    });

    let scheduledWork: Promise<void> = Promise.resolve();
    const schedule = (fn: () => void | Promise<void>) => {
      scheduledWork = Promise.resolve().then(() => fn());
    };
    flush = async () => {
      await scheduledWork;
      scheduledWork = Promise.resolve();
    };

    sendTemplate = vi.fn().mockResolvedValue({ messageId: "SM_template" });
    sendFlow = vi.fn().mockResolvedValue({ messageId: "SM_flow" });
    const messaging: MessagingPort = {
      sendText: vi.fn().mockResolvedValue({ messageId: "SM_text" }),
      sendTemplate,
      sendFlow,
    };
    const email: EmailPort = {
      sendBookingConfirmation: vi.fn().mockResolvedValue(undefined),
    };
    const payments: PaymentPort = {
      createCheckoutLink: vi.fn().mockResolvedValue({
        url: "https://checkout.test/pay",
        sessionId: "cs_test",
      }),
    };

    const NOW = new Date("2026-05-15T12:00:00Z");
    const booking = new BookingService(testPrisma);
    const pms = createBookingServicePmsAdapter(booking, testPrisma);
    const ports = { messaging, pms, payments, email, prisma: testPrisma, now: () => NOW };
    const engine = new FlowConversationEngine();

    const idempotency: TwilioIdempotencyStore = {
      async recordIfNew(externalId) {
        try {
          await testPrisma.processedWebhookEvent.create({
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

    webhookHandlers = createTwilioWebhookHandlers({
      authToken: AUTH_TOKEN,
      publicUrl: WEBHOOK_URL,
      rateLimiter: createTokenBucketLimiter({
        capacity: 100,
        refillTokens: 100,
        refillIntervalMs: 60_000,
        now: () => Date.now(),
      }),
      idempotency,
      process: async (msg) => {
        const conv = await testPrisma.conversation.upsert({
          where: { phone: msg.from },
          create: {
            phone: msg.from,
            channel: "TWILIO",
            state: "GREETING",
            flowState: FlowState.BOOT,
          },
          update: {},
        });
        if (conv.channel === "META") return;
        const event = toFlowEvent(msg);
        if (!event) return;
        const currentState = (conv.flowState as FlowState | null) ?? FlowState.BOOT;
        const slots = reviveDateSlots(
          conv.flowSlots ? (JSON.parse(conv.flowSlots) as FlowSlots) : {},
        );
        const ctx: TransitionContext = {
          conversationId: conv.id,
          phone: msg.from,
          locale: conv.locale,
          slots,
          templateSids: TEST_TEMPLATE_SIDS,
          flowIds: TEST_FLOW_IDS,
        };
        const result = engine.dispatch(currentState, event, ctx);
        await interpretEffects(result.effects, result.next, ctx, engine, ports);
      },
      schedule,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      getCorrelationId: () => "e2e-no-avail-webhook",
    });

    flowHandlers = createFlowDataExchangeHandlers({
      privateKeyPem: TEST_PRIVATE_KEY_PEM,
      authToken: AUTH_TOKEN,
      publicUrl: FLOW_DATA_URL,
      engine,
      ports,
      templateSids: TEST_TEMPLATE_SIDS,
      flowIds: TEST_FLOW_IDS,
      schedule,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      getCorrelationId: () => "e2e-no-avail-flow",
    });
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("searchAvailability zwraca pokoje niedostępne gdy brak rate planów na żądane daty", async () => {
    const FLOW_OPTS = { authToken: AUTH_TOKEN, url: FLOW_DATA_URL };
    let sid = 0;
    const nextSid = () => `SM-noavail-${String(++sid).padStart(3, "0")}`;

    // Krok 1: Inbound text → MENU_SHOWN
    await webhookHandlers.POST(
      aTwilioInboundText({ phone: PHONE, messageSid: nextSid(), body: "Bonjour" })
        .toRequest({ authToken: AUTH_TOKEN, url: WEBHOOK_URL }),
    );
    await flush();

    // Krok 2: book_room → AWAITING_DATES
    await webhookHandlers.POST(
      aTwilioButtonReply({ phone: PHONE, messageSid: nextSid(), buttonPayload: "book_room" })
        .toRequest({ authToken: AUTH_TOKEN, url: WEBHOOK_URL }),
    );
    await flush();

    const conv2 = await testPrisma.conversation.findFirstOrThrow({ where: { phone: PHONE } });
    const datePickerToken = conv2.flowToken!;

    // Krok 3: data_exchange DATE_PICKER z datami CZERWCOWYMI → AWAITING_GUESTS
    const { request: req3 } = dateExchangeRequest(
      { check_in: "2026-06-01", check_out: "2026-06-04" },
      datePickerToken,
      FLOW_OPTS,
    );
    await flowHandlers.POST(req3);
    await flush();

    const conv3 = await testPrisma.conversation.findFirstOrThrow({ where: { phone: PHONE } });
    const guestsPickerToken = conv3.flowToken!;

    // Krok 4: INIT GUESTS_PICKER (pomijamy — tylko sprawdzamy krytyczny krok)
    const { request: initReq } = initRequest("GUESTS_PICKER", guestsPickerToken, FLOW_OPTS);
    await flowHandlers.POST(initReq);

    // Krok 5: data_exchange GUESTS_PICKER → ROOM_LIST_SHOWN
    const { request: req5 } = guestsExchangeRequest(
      { adults: 2, children: 0 },
      guestsPickerToken,
      FLOW_OPTS,
    );
    const res5 = await flowHandlers.POST(req5);
    await flush();

    expect(res5.status).toBe(200);

    const convFinal = await testPrisma.conversation.findFirstOrThrow({ where: { phone: PHONE } });
    expect(convFinal.flowState).toBe(FlowState.ROOM_LIST_SHOWN);

    // availableRooms są w slots — pokój istnieje ale available: false (brak rate planów na czerwiec)
    const slots = JSON.parse(convFinal.flowSlots!) as {
      availableRooms?: { roomId: string; available: boolean; total: number }[];
    };
    expect(Array.isArray(slots.availableRooms)).toBe(true);
    const allUnavailable = slots.availableRooms!.every((r) => !r.available);
    expect(allUnavailable).toBe(true);

    // Silnik nie wysłał żadnej wiadomości z listą pokojów (brak efektu sendListPicker w ROOM_LIST_SHOWN)
    expect(sendTemplate).not.toHaveBeenCalledWith(
      expect.objectContaining({ templateSid: "HXroom" }),
    );
  });
});
