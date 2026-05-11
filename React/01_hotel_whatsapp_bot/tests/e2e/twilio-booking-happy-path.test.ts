import { afterAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { Prisma } from "@prisma/client";
import Stripe from "stripe";
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
import { createStripeWebhookHandler } from "@/payments/stripeWebhookHandler";
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
  aTwilioListReply,
} from "../fixtures/twilio-webhook";
import {
  TEST_PRIVATE_KEY_PEM,
  dateExchangeRequest,
  decryptFlowResponse,
  guestInfoExchangeRequest,
  guestsExchangeRequest,
  initRequest,
} from "../fixtures/flow-data-exchange";

const PHONE = "+33611000099";
const AUTH_TOKEN = "test-auth-e2e-happy-path-1234";
const WEBHOOK_URL = "https://e2e.test/api/twilio/whatsapp/webhook";
const FLOW_DATA_URL = "https://e2e.test/api/twilio/whatsapp/flow-data";
const STRIPE_WEBHOOK_SECRET = "whsec_e2e_happy_path_secret";

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

// Skopiowane z route.ts — mapowanie TwilioInboundMessage na FlowEvent
function toFlowEvent(msg: TwilioInboundMessage): FlowEvent | null {
  if (msg.buttonPayload) return { kind: "menuSelection", selectionId: msg.buttonPayload };
  if (msg.body.trim().length > 0) return { kind: "inboundText", text: msg.body };
  return null;
}

// Skopiowane z route.ts — odtwarzanie dat ze stringów JSON
function reviveDateSlots(slots: FlowSlots): FlowSlots {
  return {
    ...slots,
    ...(slots.checkIn ? { checkIn: new Date(slots.checkIn as unknown as string) } : {}),
    ...(slots.checkOut ? { checkOut: new Date(slots.checkOut as unknown as string) } : {}),
  };
}

describe("twilio-booking-happy-path (E2E)", () => {
  let webhookHandlers: ReturnType<typeof createTwilioWebhookHandlers>;
  let flowHandlers: ReturnType<typeof createFlowDataExchangeHandlers>;
  let stripeHandler: ReturnType<typeof createStripeWebhookHandler>;
  let flush: () => Promise<void>;
  let sendTemplate: Mock;
  let sendFlow: Mock;
  let sendBookingConfirmation: Mock;
  let roomId: string;

  beforeEach(async () => {
    await resetTestDb();
    vi.clearAllMocks();

    // --- Seed: pokój dostępny przez 10 dni od 2026-06-01 ---
    const room = await seedTestRoom({
      name: "Suite Méditerranée",
      capacity: 2,
      basePrice: 15000,
      from: new Date("2026-06-01T00:00:00.000Z"),
      days: 10,
    });
    roomId = room.id;

    // --- Schedule deterministyczny: flush() czeka na zakończenie async pracy ---
    let scheduledWork: Promise<void> = Promise.resolve();
    const schedule = (fn: () => void | Promise<void>) => {
      scheduledWork = Promise.resolve().then(() => fn());
    };
    flush = async () => {
      await scheduledWork;
      scheduledWork = Promise.resolve();
    };

    // --- Porty ---
    sendTemplate = vi.fn().mockResolvedValue({ messageId: "SM_template" });
    sendFlow = vi.fn().mockResolvedValue({ messageId: "SM_flow" });
    const messaging: MessagingPort = {
      sendText: vi.fn().mockResolvedValue({ messageId: "SM_text" }),
      sendTemplate,
      sendFlow,
    };

    sendBookingConfirmation = vi.fn().mockResolvedValue(undefined);
    const email: EmailPort = { sendBookingConfirmation };

    const booking = new BookingService(testPrisma);
    const pms = createBookingServicePmsAdapter(booking, testPrisma);

    // PaymentPort mock — tworzy też PaymentLink w DB (Stripe webhook handler go potrzebuje)
    const payments: PaymentPort = {
      createCheckoutLink: vi.fn().mockImplementation(
        async ({ reservation }: { reservation: { id: string; code: string } }) => {
          const sessionId = `cs_e2e_${reservation.code}`;
          const url = `https://checkout.stripe.test/${sessionId}`;
          await testPrisma.paymentLink.upsert({
            where: { reservationId: reservation.id },
            create: {
              reservationId: reservation.id,
              stripeSessionId: sessionId,
              url,
              expiresAt: new Date("2026-12-31"),
              status: "ACTIVE",
            },
            update: {},
          });
          return { url, sessionId };
        },
      ),
    };

    const NOW = new Date("2026-05-15T12:00:00Z");
    const ports = { messaging, pms, payments, email, prisma: testPrisma, now: () => NOW };
    const engine = new FlowConversationEngine();

    // --- Idempotency przez testPrisma ---
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

    const rateLimiter = createTokenBucketLimiter({
      capacity: 100,
      refillTokens: 100,
      refillIntervalMs: 60_000,
      now: () => Date.now(),
    });

    // --- Webhook handler (logika process skopiowana z route.ts) ---
    webhookHandlers = createTwilioWebhookHandlers({
      authToken: AUTH_TOKEN,
      publicUrl: WEBHOOK_URL,
      rateLimiter,
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

        const currentState =
          (conv.flowState as FlowState | null) ?? FlowState.BOOT;
        const rawSlots = conv.flowSlots
          ? (JSON.parse(conv.flowSlots) as FlowSlots)
          : {};
        const slots = reviveDateSlots(rawSlots);

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
      getCorrelationId: () => "e2e-webhook",
    });

    // --- Flow data exchange handler ---
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
      getCorrelationId: () => "e2e-flow",
    });

    // --- Stripe handler ---
    const stripe = new Stripe("sk_test_placeholder", {
      httpClient: Stripe.createFetchHttpClient(),
    });
    stripeHandler = createStripeWebhookHandler({
      stripe,
      prisma: testPrisma,
      webhookSecret: STRIPE_WEBHOOK_SECRET,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      getCorrelationId: () => "e2e-stripe",
      messaging,
      email,
      bookingConfirmedSid: "HXconfirmed",
    });
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("przeprowadza pełną rozmowę rezerwacyjną aż do statusu CONFIRMED", async () => {
    const FLOW_OPTS = { authToken: AUTH_TOKEN, url: FLOW_DATA_URL };
    let sid = 0;
    const nextSid = () => `SM-e2e-${String(++sid).padStart(3, "0")}`;

    // =====================================================================
    // Krok 1: Inbound text → MENU_SHOWN
    // =====================================================================
    const res1 = await webhookHandlers.POST(
      aTwilioInboundText({ phone: PHONE, messageSid: nextSid(), body: "Bonjour" })
        .toRequest({ authToken: AUTH_TOKEN, url: WEBHOOK_URL }),
    );
    await flush();

    expect(res1.status).toBe(200);
    const conv1 = await testPrisma.conversation.findFirstOrThrow({ where: { phone: PHONE } });
    expect(conv1.flowState).toBe(FlowState.MENU_SHOWN);
    expect(sendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ templateSid: "HXwelcome" }),
    );

    // =====================================================================
    // Krok 2: Wybranie "book_room" → AWAITING_DATES
    // =====================================================================
    sendTemplate.mockClear();
    sendFlow.mockClear();

    const res2 = await webhookHandlers.POST(
      aTwilioButtonReply({ phone: PHONE, messageSid: nextSid(), buttonPayload: "book_room" })
        .toRequest({ authToken: AUTH_TOKEN, url: WEBHOOK_URL }),
    );
    await flush();

    expect(res2.status).toBe(200);
    const conv2 = await testPrisma.conversation.findFirstOrThrow({ where: { phone: PHONE } });
    expect(conv2.flowState).toBe(FlowState.AWAITING_DATES);
    expect(conv2.flowToken).toBeTruthy();
    expect(sendFlow).toHaveBeenCalledTimes(1);

    const datePickerToken = conv2.flowToken!;

    // =====================================================================
    // Krok 3: Flow INIT DATE_PICKER → odpowiedź z predefiniowanymi datami
    // =====================================================================
    const { request: req3, aesKey: key3 } = initRequest("DATE_PICKER", datePickerToken, FLOW_OPTS);
    const res3 = await flowHandlers.POST(req3);

    expect(res3.status).toBe(200);
    const body3 = await res3.json() as { encrypted_flow_data: string; initial_vector: string };
    const decrypted3 = decryptFlowResponse(body3, key3) as {
      screen: string;
      data: { min_date: string; check_in: string; check_out: string };
    };
    expect(decrypted3.screen).toBe("DATE_PICKER");
    expect(decrypted3.data.min_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(decrypted3.data.check_in).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // =====================================================================
    // Krok 4: data_exchange DATE_PICKER → AWAITING_GUESTS
    // =====================================================================
    sendFlow.mockClear();

    const { request: req4 } = dateExchangeRequest(
      { check_in: "2026-06-01", check_out: "2026-06-04" },
      datePickerToken,
      FLOW_OPTS,
    );
    const res4 = await flowHandlers.POST(req4);
    await flush();

    expect(res4.status).toBe(200);
    const conv4 = await testPrisma.conversation.findFirstOrThrow({ where: { phone: PHONE } });
    expect(conv4.flowState).toBe(FlowState.AWAITING_GUESTS);
    expect(conv4.flowToken).toBeTruthy();
    expect(conv4.flowToken).not.toBe(datePickerToken); // nowy token dla GUESTS_PICKER

    const slots4 = JSON.parse(conv4.flowSlots!) as Record<string, unknown>;
    expect(String(slots4["checkIn"])).toContain("2026-06-01");
    expect(String(slots4["checkOut"])).toContain("2026-06-04");
    expect(sendFlow).toHaveBeenCalledTimes(1);

    const guestsPickerToken = conv4.flowToken!;

    // =====================================================================
    // Krok 5: Flow INIT GUESTS_PICKER → odpowiedź z predefiniowanymi gośćmi
    // =====================================================================
    const { request: req5, aesKey: key5 } = initRequest("GUESTS_PICKER", guestsPickerToken, FLOW_OPTS);
    const res5 = await flowHandlers.POST(req5);

    expect(res5.status).toBe(200);
    const body5 = await res5.json() as { encrypted_flow_data: string; initial_vector: string };
    const decrypted5 = decryptFlowResponse(body5, key5) as {
      screen: string;
      data: { adults: number; children: number };
    };
    expect(decrypted5.screen).toBe("GUESTS_PICKER");
    expect(decrypted5.data.adults).toBe(2);

    // =====================================================================
    // Krok 6: data_exchange GUESTS_PICKER → ROOM_LIST_SHOWN
    // =====================================================================
    const { request: req6 } = guestsExchangeRequest(
      { adults: 2, children: 0 },
      guestsPickerToken,
      FLOW_OPTS,
    );
    const res6 = await flowHandlers.POST(req6);
    await flush();

    expect(res6.status).toBe(200);
    const conv6 = await testPrisma.conversation.findFirstOrThrow({ where: { phone: PHONE } });
    expect(conv6.flowState).toBe(FlowState.ROOM_LIST_SHOWN);

    const slots6 = JSON.parse(conv6.flowSlots!) as { availableRooms?: { roomId: string; available: boolean }[] };
    expect(slots6.availableRooms).toBeDefined();
    expect(Array.isArray(slots6.availableRooms)).toBe(true);
    const seededRoom = slots6.availableRooms!.find((r) => r.roomId === roomId);
    expect(seededRoom).toBeDefined();
    expect(seededRoom!.available).toBe(true);

    // =====================================================================
    // Krok 7: Wybór pokoju z listy → ROOM_DETAIL_SHOWN
    // =====================================================================
    sendTemplate.mockClear();

    const res7 = await webhookHandlers.POST(
      aTwilioListReply({ phone: PHONE, messageSid: nextSid(), selectionId: roomId })
        .toRequest({ authToken: AUTH_TOKEN, url: WEBHOOK_URL }),
    );
    await flush();

    expect(res7.status).toBe(200);
    const conv7 = await testPrisma.conversation.findFirstOrThrow({ where: { phone: PHONE } });
    expect(conv7.flowState).toBe(FlowState.ROOM_DETAIL_SHOWN);
    expect(sendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ templateSid: "HXroom" }),
    );

    // =====================================================================
    // Krok 8: Potwierdzenie wyboru pokoju → AWAITING_GUEST_INFO
    // =====================================================================
    sendFlow.mockClear();

    const res8 = await webhookHandlers.POST(
      aTwilioButtonReply({ phone: PHONE, messageSid: nextSid(), buttonPayload: "confirm_room" })
        .toRequest({ authToken: AUTH_TOKEN, url: WEBHOOK_URL }),
    );
    await flush();

    expect(res8.status).toBe(200);
    const conv8 = await testPrisma.conversation.findFirstOrThrow({ where: { phone: PHONE } });
    expect(conv8.flowState).toBe(FlowState.AWAITING_GUEST_INFO);
    expect(conv8.flowToken).toBeTruthy();
    expect(sendFlow).toHaveBeenCalledTimes(1);

    const guestInfoToken = conv8.flowToken!;

    // =====================================================================
    // Krok 9: Flow INIT GUEST_INFO
    // =====================================================================
    const { request: req9, aesKey: key9 } = initRequest("GUEST_INFO", guestInfoToken, FLOW_OPTS);
    const res9 = await flowHandlers.POST(req9);

    expect(res9.status).toBe(200);
    const body9 = await res9.json() as { encrypted_flow_data: string; initial_vector: string };
    const decrypted9 = decryptFlowResponse(body9, key9) as { screen: string };
    expect(decrypted9.screen).toBe("GUEST_INFO");

    // =====================================================================
    // Krok 10: data_exchange GUEST_INFO → AWAITING_EXTRAS
    // =====================================================================
    const { request: req10 } = guestInfoExchangeRequest(
      { name: "Marie Dupont", email: "marie@example.com", phone: "+33600000001" },
      guestInfoToken,
      FLOW_OPTS,
    );
    const res10 = await flowHandlers.POST(req10);
    await flush();

    expect(res10.status).toBe(200);
    const conv10 = await testPrisma.conversation.findFirstOrThrow({ where: { phone: PHONE } });
    expect(conv10.flowState).toBe(FlowState.AWAITING_EXTRAS);

    const slots10 = JSON.parse(conv10.flowSlots!) as Record<string, unknown>;
    expect(slots10["guestName"]).toBe("Marie Dupont");
    expect(slots10["guestEmail"]).toBe("marie@example.com");

    // =====================================================================
    // Krok 11: Przejście do RECAP_SHOWN
    //
    // UWAGA: EXTRAS data_exchange przez flow-data jest zepsute w obecnej
    // implementacji — persistFlowState bez flowToken ustawia go na NULL,
    // więc kolejny data_exchange nie znajdzie konwersacji po flowToken.
    // Testujemy to zachowanie w twilio-flow-stale-token.test.ts.
    // Tu przechodzimy ręcznie, żeby móc przetestować dalsze kroki.
    // =====================================================================
    await testPrisma.conversation.update({
      where: { id: conv10.id },
      data: {
        flowState: FlowState.RECAP_SHOWN,
        flowSlots: JSON.stringify({
          ...JSON.parse(conv10.flowSlots ?? "{}"),
          breakfast: true,
        }),
      },
    });

    // =====================================================================
    // Krok 12: Potwierdzenie rezerwacji → PAYMENT_PENDING + rezerwacja + link płatności
    // =====================================================================
    sendTemplate.mockClear();

    const res12 = await webhookHandlers.POST(
      aTwilioButtonReply({ phone: PHONE, messageSid: nextSid(), buttonPayload: "confirm_booking" })
        .toRequest({ authToken: AUTH_TOKEN, url: WEBHOOK_URL }),
    );
    await flush();

    expect(res12.status).toBe(200);
    const conv12 = await testPrisma.conversation.findFirstOrThrow({ where: { phone: PHONE } });
    expect(conv12.flowState).toBe(FlowState.PAYMENT_PENDING);

    const reservation = await testPrisma.reservation.findFirst({
      where: { conversationId: conv12.id },
    });
    expect(reservation).not.toBeNull();
    expect(reservation!.status).toBe("PENDING");
    expect(reservation!.guestName).toBe("Marie Dupont");

    const paymentLink = await testPrisma.paymentLink.findUnique({
      where: { reservationId: reservation!.id },
    });
    expect(paymentLink).not.toBeNull();

    expect(sendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ templateSid: "HXpay" }),
    );

    // =====================================================================
    // Krok 13: Stripe checkout.session.completed → CONFIRMED + template + email
    // =====================================================================
    sendTemplate.mockClear();

    const stripe = new Stripe("sk_test_placeholder", {
      httpClient: Stripe.createFetchHttpClient(),
    });
    const stripePayload = JSON.stringify({
      id: "evt_e2e_happy_001",
      object: "event",
      type: "checkout.session.completed",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: paymentLink!.stripeSessionId,
          object: "checkout.session",
          payment_status: "paid",
          status: "complete",
          metadata: {
            reservationId: reservation!.id,
            reservationCode: reservation!.code,
          },
        },
      },
    });
    const stripeHeader = stripe.webhooks.generateTestHeaderString({
      payload: stripePayload,
      secret: STRIPE_WEBHOOK_SECRET,
      timestamp: Math.floor(Date.now() / 1000),
    });
    const stripeRequest = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": stripeHeader },
      body: stripePayload,
    });

    const res13 = await stripeHandler.POST(stripeRequest);

    expect(res13.status).toBe(200);

    const updatedReservation = await testPrisma.reservation.findUnique({
      where: { id: reservation!.id },
    });
    expect(updatedReservation!.status).toBe("CONFIRMED");

    expect(sendTemplate).toHaveBeenCalledWith({
      to: PHONE,
      templateSid: "HXconfirmed",
      variables: { "1": reservation!.code },
    });

    expect(sendBookingConfirmation).toHaveBeenCalledOnce();
    expect(sendBookingConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: "fr",
        reservation: expect.objectContaining({ code: reservation!.code }),
      }),
    );
  });
});
