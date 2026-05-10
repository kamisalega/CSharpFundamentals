import { afterAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { createStripeWebhookHandler } from "./stripeWebhookHandler";
import Stripe from "stripe";
import { resetTestDb, seedTestRoom, testPrisma } from "../../tests/helpers/testDb";
import { MessagingPort } from "@/channels/MessagingPort";
import { EmailPort } from "@/email/EmailPort";


const TEST_WEBHOOK_SECRET = "whsec_dispatch_test_secret";
const BOOKING_CONFIRMED_SID = "HXtest_booking_confirmed_sid";

describe("stripe-webhook — channel-aware dispatch", () => {
  let stripe!: Stripe;
  let handler!: ReturnType<typeof createStripeWebhookHandler>;
  let sendTemplate!: Mock<MessagingPort['sendTemplate']>;
  let sendBookingConfirmation!: Mock<EmailPort['sendBookingConfirmation']>;

  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(async () => {
    await resetTestDb();
    vi.clearAllMocks();

    stripe = new Stripe("sk_test_placeholder", {
      httpClient: Stripe.createFetchHttpClient(),
    });

    sendTemplate = vi.fn().mockResolvedValue({ messageId: "SM_test_dispatch" });
    sendBookingConfirmation = vi.fn().mockResolvedValue(undefined);

    const messaging: MessagingPort = {
      sendText: vi.fn().mockResolvedValue({ messageId: "SM_noop" }),
      sendTemplate,
      sendFlow: vi.fn().mockResolvedValue({ messageId: "SM_noop" }),
    };

    const email: EmailPort = {
      sendBookingConfirmation
    };

    handler = createStripeWebhookHandler({
      stripe,
      prisma: testPrisma,
      webhookSecret: TEST_WEBHOOK_SECRET,
      logger,
      getCorrelationId: () => "test-dispatch-corr-id",
      messaging,
      email,
      bookingConfirmedSid: BOOKING_CONFIRMED_SID,
    });
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  function buildRequest(body: object): Request {
    const payload = JSON.stringify(body);
    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: TEST_WEBHOOK_SECRET,
      timestamp: Math.floor(Date.now() / 1000),
    });
    return new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": header },
      body: payload,
    });
  }

  function aCheckoutCompleted(opts: {
    id?: string;
    reservationId: string;
    reservationCode: string;
  }) {
    return {
      id: opts.id ?? "evt_dispatch_001",
      object: "event",
      type: "checkout.session.completed",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: "cs_dispatch_test",
          object: "checkout.session",
          payment_status: "paid",
          status: "complete",
          metadata: {
            reservationId: opts.reservationId,
            reservationCode: opts.reservationCode,
          },
        },
      },
    };
  }

  async function seedTwilioScenario(opts: {
    phone: string;
    reservationCode: string;
    channel?: string;
  }) {
    const room = await seedTestRoom({
      from: new Date("2026-09-01T00:00:00.000Z"),
      days: 3,
    });
    const conversation = await testPrisma.conversation.create({
      data: {
        phone: opts.phone,
        channel: opts.channel ?? "TWILIO",
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
        stripeSessionId: `cs_${opts.reservationCode}`,
        url: `https://checkout.stripe.com/c/pay/cs_${opts.reservationCode}`,
        expiresAt: new Date("2026-09-01T10:00:00.000Z"),
        status: "ACTIVE",
      },
    });
    return { conversation, reservation };
  }

  it("kanał TWILIO → sendTemplate wywołany z BOOKING_CONFIRMED_SID i reservationCode jako {{1}}", async () => {
    const { reservation } = await seedTwilioScenario({
      phone: "+33611000001",
      reservationCode: "RES-TWILIO-01",
      channel: "TWILIO",
    });

    const response = await handler.POST(
      buildRequest(
        aCheckoutCompleted({
          reservationId: reservation.id,
          reservationCode: reservation.code,
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(sendTemplate).toHaveBeenCalledOnce();
    expect(sendTemplate).toHaveBeenCalledWith({
      to: "+33611000001",
      templateSid: BOOKING_CONFIRMED_SID,
      variables: { "1": "RES-TWILIO-01" },
    });
  });

  it("kanał META → sendTemplate NIE jest wywoływany", async () => {
    const { reservation } = await seedTwilioScenario({
      phone: "+33611000002",
      reservationCode: "RES-META-01",
      channel: "META",
    });

    const response = await handler.POST(
      buildRequest(
        aCheckoutCompleted({
          reservationId: reservation.id,
          reservationCode: reservation.code,
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(sendTemplate).not.toHaveBeenCalled();
  });

  it("kanał TWILIO → rezerwacja zmienia status na CONFIRMED", async () => {
    const { reservation } = await seedTwilioScenario({
      phone: "+33611000003",
      reservationCode: "RES-TWILIO-02",
    });

    await handler.POST(
      buildRequest(
        aCheckoutCompleted({
          reservationId: reservation.id,
          reservationCode: reservation.code,
        }),
      ),
    );

    const updated = await testPrisma.reservation.findUnique({
      where: { id: reservation.id },
    });
    expect(updated!.status).toBe("CONFIRMED");
  });

  it("kanał TWILIO → sendBookingConfirmation wywołany z rezerwacją i locale", async () => {
    const { reservation } = await seedTwilioScenario({
      phone: "+33611000004",
      reservationCode: "RES-TWILIO-03",
    });

    await handler.POST(
      buildRequest(
        aCheckoutCompleted({
          reservationId: reservation.id,
          reservationCode: reservation.code,
        }),
      ),
    );

    expect(sendBookingConfirmation).toHaveBeenCalledOnce();
    expect(sendBookingConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: "fr",
        reservation: expect.objectContaining({
          code: "RES-TWILIO-03",
          status: "CONFIRMED",
        }),
      }),
    );
  });

  it("kanał META → sendBookingConfirmation wywołany (email dla obu kanałów)", async () => {
    const { reservation } = await seedTwilioScenario({
      phone: "+33611000005",
      reservationCode: "RES-META-02",
      channel: "META",
    });

    await handler.POST(
      buildRequest(
        aCheckoutCompleted({
          reservationId: reservation.id,
          reservationCode: reservation.code,
        }),
      ),
    );

    expect(sendBookingConfirmation).toHaveBeenCalledOnce();
  });

  it("bookingConfirmedSid brakuje → sendTemplate pominięty, warn zalogowany", async () => {
    const messagingNoSid: MessagingPort = {
      sendText: vi.fn().mockResolvedValue({ messageId: "SM_noop" }),
      sendTemplate: vi.fn().mockResolvedValue({ messageId: "SM_noop" }),
      sendFlow: vi.fn().mockResolvedValue({ messageId: "SM_noop" }),
    };

    const handlerNoSid = createStripeWebhookHandler({
      stripe,
      prisma: testPrisma,
      webhookSecret: TEST_WEBHOOK_SECRET,
      logger,
      getCorrelationId: () => "test-no-sid",
      messaging: messagingNoSid,
      email: { sendBookingConfirmation: vi.fn().mockResolvedValue(undefined) },
      bookingConfirmedSid: undefined,
    });

    const { reservation } = await seedTwilioScenario({
      phone: "+33611000006",
      reservationCode: "RES-NOSID-01",
      channel: "TWILIO",
    });

    const response = await handlerNoSid.POST(
      buildRequest(
        aCheckoutCompleted({
          reservationId: reservation.id,
          reservationCode: reservation.code,
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(messagingNoSid.sendTemplate).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "stripe.webhook.twilio.confirmation_skipped",
      }),
    );
  });

  it("błąd w sendTemplate nie przerywa odpowiedzi 200", async () => {
    sendTemplate.mockRejectedValueOnce(new Error("Twilio is down"));

    const { reservation } = await seedTwilioScenario({
      phone: "+33611000007",
      reservationCode: "RES-TWILIO-ERR-01",
    });

    const response = await handler.POST(
      buildRequest(
        aCheckoutCompleted({
          reservationId: reservation.id,
          reservationCode: reservation.code,
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "stripe.webhook.twilio.confirmation_failed",
        error: "Twilio is down",
      }),
    );
  });
});
