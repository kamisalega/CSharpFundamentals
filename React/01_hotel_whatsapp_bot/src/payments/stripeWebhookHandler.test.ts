import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetTestDb,
  seedTestRoom,
  testPrisma,
} from "../../tests/helpers/testDb";
import { createStripeWebhookHandler } from "./stripeWebhookHandler";
import Stripe from "stripe";

const TEST_WEBHOOK_SECRET = "whsec_test_secret_for_unit_tests";

describe("stripeWebhookHandler.POST", () => {
  let stripe!: Stripe;
  let handler!: ReturnType<typeof createStripeWebhookHandler>;

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

    handler = createStripeWebhookHandler({
      stripe,
      prisma: testPrisma,
      webhookSecret: TEST_WEBHOOK_SECRET,
      logger,
      getCorrelationId: () => "test-corr-id",
    });
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  function buildWebhookRequest(
    body: object,
    secret = TEST_WEBHOOK_SECRET,
  ): Request {
    const payload = JSON.stringify(body);
    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret,
      timestamp: Math.floor(Date.now() / 1000),
    });
    return new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": header },
      body: payload,
    });
  }

  function aCheckoutCompletedEvent(
    opts: Readonly<{
      id?: string;
      sessionId?: string;
      reservationId: string;
      reservationCode: string;
    }>,
  ) {
    return {
      id: opts.id ?? "evt_test_001",
      object: "event",
      type: "checkout.session.completed",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: opts.sessionId ?? "cs_test_123",
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

  it("odrzuca webhook z nieprawidłowym podpisem i zwraca 401", async () => {
    const request = new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=invalid" },
      body: "{}",
    });

    const response = await handler.POST(request);

    // Assert
    expect(response.status).toBe(401);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "stripe.webhook.signature.invalid" }),
    );
  });

  it("odrzuca webhook z podpisem złym kluczem i zwraca 401", async () => {
    // Arrange
    const request = buildWebhookRequest(
      { type: "checkout.session.completed" },
      "whsec_wrong_key",
    );

    const response = await handler.POST(request);

    expect(response.status).toBe(401);
  });

  it("przyjmuje webhook z nieznanym typem eventu i zwraca 200 bez efektów", async () => {
    // Arrange
    const request = buildWebhookRequest({
      id: "evt_unknown_001",
      object: "event",
      type: "customer.created",
      created: Math.floor(Date.now() / 1000),
      data: { object: {} },
    });

    const response = await handler.POST(request);

    expect(response.status).toBe(200);

    const count = await testPrisma.processedWebhookEvent.count();
    expect(count).toBe(0);
  });

  it("dla checkout.session.completed potwierdza rezerwację i PaymentLink", async () => {
    const room = await seedTestRoom({
      from: new Date("2026-08-12T00:00:00.000Z"),
      days: 3,
    });
    const conversation = await testPrisma.conversation.create({
      data: { phone: "+33601000001" },
    });
    const reservation = await testPrisma.reservation.create({
      data: {
        code: "RES-CONFIRM1",
        conversationId: conversation.id,
        roomId: room.id,
        checkIn: new Date("2026-08-12T00:00:00.000Z"),
        checkOut: new Date("2026-08-15T00:00:00.000Z"),
        adults: 2,
        children: 0,
        guestName: "Marie Curie",
        guestEmail: "marie@example.com",
        guestPhone: "+33601000001",
        total: 36000,
        status: "PENDING",
      },
    });
    await testPrisma.paymentLink.create({
      data: {
        reservationId: reservation.id,
        stripeSessionId: "cs_test_123",
        url: "https://checkout.stripe.com/c/pay/cs_test_123",
        expiresAt: new Date("2026-08-01T11:00:00.000Z"),
        status: "ACTIVE",
      },
    });

    const request = buildWebhookRequest(
      aCheckoutCompletedEvent({
        reservationId: reservation.id,
        reservationCode: reservation.code,
      }),
    );

    const response = await handler.POST(request);

    expect(response.status).toBe(200);

    const updatedReservation = await testPrisma.reservation.findUnique({
      where: { id: reservation.id },
    });
    expect(updatedReservation!.status).toBe("CONFIRMED");

    const updatedLink = await testPrisma.paymentLink.findUnique({
      where: { reservationId: reservation.id },
    });
    expect(updatedLink!.status).toBe("PAID");

    const processed = await testPrisma.processedWebhookEvent.findFirst({
      where: { source: "STRIPE", externalId: "evt_test_001" },
    });
    expect(processed).not.toBeNull();
  });

  it("drugi raz ten sam event zwraca 200 bez zmiany stanu i bez duplikatu w ProcessedWebhookEvent", async () => {
    const room = await seedTestRoom({
      from: new Date("2026-08-12T00:00:00.000Z"),
      days: 3,
    });
    const conversation = await testPrisma.conversation.create({
      data: { phone: "+33602000002" },
    });
    const reservation = await testPrisma.reservation.create({
      data: {
        code: "RES-REPLAY1",
        conversationId: conversation.id,
        roomId: room.id,
        checkIn: new Date("2026-08-12T00:00:00.000Z"),
        checkOut: new Date("2026-08-15T00:00:00.000Z"),
        adults: 2,
        children: 0,
        guestName: "Pierre Martin",
        guestEmail: "pierre@example.com",
        guestPhone: "+33602000002",
        total: 36000,
        status: "PENDING",
      },
    });
    await testPrisma.paymentLink.create({
      data: {
        reservationId: reservation.id,
        stripeSessionId: "cs_test_456",
        url: "https://checkout.stripe.com/c/pay/cs_test_456",
        expiresAt: new Date("2026-08-01T11:00:00.000Z"),
        status: "ACTIVE",
      },
    });

    const event = aCheckoutCompletedEvent({
      id: "evt_replay_001",
      reservationId: reservation.id,
      reservationCode: reservation.code,
    });

    await handler.POST(buildWebhookRequest(event));

    const response2 = await handler.POST(buildWebhookRequest(event));

    expect(response2.status).toBe(200);

    const processedCount = await testPrisma.processedWebhookEvent.count({
      where: { source: "STRIPE", externalId: "evt_replay_001" },
    });
    expect(processedCount).toBe(1);

    const updatedReservation = await testPrisma.reservation.findUnique({
      where: { id: reservation.id },
    });
    expect(updatedReservation!.status).toBe("CONFIRMED");
  });

  it("dla eventu bez metadata zwraca 200 i zapisuje event jako przetworzony", async () => {
    // Arrange
    const request = buildWebhookRequest({
      id: "evt_no_meta_001",
      object: "event",
      type: "checkout.session.completed",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: "cs_test_no_meta",
          object: "checkout.session",
          payment_status: "paid",
          status: "complete",
          metadata: null,
        },
      },
    });

    // Act
    const response = await handler.POST(request);

    // Assert
    expect(response.status).toBe(200);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "stripe.webhook.metadata.invalid" }),
    );

    // Event zapisany — Stripe nie będzie ponownie próbował
    const processed = await testPrisma.processedWebhookEvent.findFirst({
      where: { source: "STRIPE", externalId: "evt_no_meta_001" },
    });
    expect(processed).not.toBeNull();

   
    const reservationCount = await testPrisma.reservation.count();
    expect(reservationCount).toBe(0);
  });
});
