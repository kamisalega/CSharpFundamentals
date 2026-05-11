import { afterAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import Stripe from "stripe";
import { createStripeWebhookHandler } from "@/payments/stripeWebhookHandler";
import type { MessagingPort } from "@/channels/MessagingPort";
import type { EmailPort } from "@/email/EmailPort";
import { resetTestDb, seedTestRoom, testPrisma } from "../helpers/testDb";

const STRIPE_WEBHOOK_SECRET = "whsec_e2e_payment_failure_secret";

describe("twilio-payment-failure (E2E)", () => {
  let stripeHandler: ReturnType<typeof createStripeWebhookHandler>;
  let sendTemplate: Mock;
  let logger: { info: Mock; warn: Mock; error: Mock };

  beforeEach(async () => {
    await resetTestDb();
    vi.clearAllMocks();

    sendTemplate = vi.fn().mockResolvedValue({ messageId: "SM_noop" });
    const messaging: MessagingPort = {
      sendText: vi.fn().mockResolvedValue({ messageId: "SM_noop" }),
      sendTemplate,
      sendFlow: vi.fn().mockResolvedValue({ messageId: "SM_noop" }),
    };
    const email: EmailPort = {
      sendBookingConfirmation: vi.fn().mockResolvedValue(undefined),
    };

    logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const stripe = new Stripe("sk_test_placeholder", {
      httpClient: Stripe.createFetchHttpClient(),
    });
    stripeHandler = createStripeWebhookHandler({
      stripe,
      prisma: testPrisma,
      webhookSecret: STRIPE_WEBHOOK_SECRET,
      logger,
      getCorrelationId: () => "e2e-payment-fail",
      messaging,
      email,
      bookingConfirmedSid: "HXconfirmed",
    });
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  async function seedScenario(opts: { phone: string; reservationCode: string }) {
    const room = await seedTestRoom({
      from: new Date("2026-09-01T00:00:00.000Z"),
      days: 5,
    });
    const conversation = await testPrisma.conversation.create({
      data: {
        phone: opts.phone,
        channel: "TWILIO",
        state: "GREETING",
        flowState: "PAYMENT_PENDING",
      },
    });
    const reservation = await testPrisma.reservation.create({
      data: {
        code: opts.reservationCode,
        conversationId: conversation.id,
        roomId: room.id,
        checkIn: new Date("2026-09-01T00:00:00.000Z"),
        checkOut: new Date("2026-09-04T00:00:00.000Z"),
        adults: 2,
        children: 0,
        guestName: "Jean Dupont",
        guestEmail: "jean@example.com",
        guestPhone: opts.phone,
        total: 36000,
        status: "PENDING",
      },
    });
    await testPrisma.paymentLink.create({
      data: {
        reservationId: reservation.id,
        stripeSessionId: `cs_expired_${opts.reservationCode}`,
        url: `https://checkout.stripe.com/expired/${opts.reservationCode}`,
        expiresAt: new Date("2026-09-01T11:00:00.000Z"),
        status: "ACTIVE",
      },
    });
    return { conversation, reservation };
  }

  function buildStripeRequest(body: object): Request {
    const stripe = new Stripe("sk_test_placeholder", {
      httpClient: Stripe.createFetchHttpClient(),
    });
    const payload = JSON.stringify(body);
    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: STRIPE_WEBHOOK_SECRET,
      timestamp: Math.floor(Date.now() / 1000),
    });
    return new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": header },
      body: payload,
    });
  }

  it("checkout.session.expired → 200, rezerwacja pozostaje PENDING, brak wiadomości", async () => {
    const { reservation } = await seedScenario({
      phone: "+33611000055",
      reservationCode: "RES-FAIL-01",
    });

    const response = await stripeHandler.POST(
      buildStripeRequest({
        id: "evt_fail_001",
        object: "event",
        type: "checkout.session.expired",
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: `cs_expired_${reservation.code}`,
            object: "checkout.session",
            payment_status: "unpaid",
            status: "expired",
            metadata: {
              reservationId: reservation.id,
              reservationCode: reservation.code,
            },
          },
        },
      }),
    );

    expect(response.status).toBe(200);

    // Rezerwacja bez zmian
    const updated = await testPrisma.reservation.findUnique({
      where: { id: reservation.id },
    });
    expect(updated!.status).toBe("PENDING");

    // Żaden template nie został wysłany
    expect(sendTemplate).not.toHaveBeenCalled();

    // Logger odnotował nieobsługiwany typ zdarzenia
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "stripe.webhook.unhandled_event",
        type: "checkout.session.expired",
      }),
    );
  });

  it("checkout.session.expired nie tworzy ProcessedWebhookEvent → duplikat bezpieczny", async () => {
    const { reservation } = await seedScenario({
      phone: "+33611000056",
      reservationCode: "RES-FAIL-02",
    });

    const req = buildStripeRequest({
      id: "evt_fail_002",
      object: "event",
      type: "checkout.session.expired",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: `cs_expired_${reservation.code}`,
          object: "checkout.session",
          payment_status: "unpaid",
          status: "expired",
          metadata: { reservationId: reservation.id, reservationCode: reservation.code },
        },
      },
    });

    // Dwukrotne wysłanie tego samego zdarzenia
    await stripeHandler.POST(req);

    const req2 = buildStripeRequest({
      id: "evt_fail_002", // ten sam id
      object: "event",
      type: "checkout.session.expired",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: `cs_expired_${reservation.code}`,
          object: "checkout.session",
          payment_status: "unpaid",
          status: "expired",
          metadata: { reservationId: reservation.id, reservationCode: reservation.code },
        },
      },
    });
    const res2 = await stripeHandler.POST(req2);

    // Oba 200 — brak błędu przy duplikacie
    expect(res2.status).toBe(200);

    // Brak ProcessedWebhookEvent (handler nie zapisuje unhandled events)
    const events = await testPrisma.processedWebhookEvent.findMany({
      where: { source: "STRIPE" },
    });
    expect(events).toHaveLength(0);
  });

  it("nieprawidłowy podpis Stripe → 401", async () => {
    const response = await stripeHandler.POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "t=123,v1=tampered" },
        body: JSON.stringify({ type: "checkout.session.completed" }),
      }),
    );
    expect(response.status).toBe(401);
  });
});
