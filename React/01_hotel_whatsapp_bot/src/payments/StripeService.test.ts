import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  resetTestDb,
  seedTestRoom,
  testPrisma,
} from "../../tests/helpers/testDb";
import Stripe from "stripe";
import { createStripeService, StripeService } from "./StripeService";
import { Reservation } from "@prisma/client";
import { server } from "../../tests/msw/server";
import { http, HttpResponse } from "msw";

const STRIPE_SESSIONS_URL = "https://api.stripe.com/v1/checkout/sessions";

function makeSessionFixture(overrides: Partial<{ id: string }> = {}) {
  return {
    id: overrides.id ?? "cs_test_123",
    object: "checkout.session",
    url: `https://checkout.stripe.com/c/pay/${overrides.id ?? "cs_test_123"}`,
    payment_status: "unpaid",
    status: "open",
    expires_at: 1780000000,
  };
}

describe("StripeService.createCheckoutSession", () => {
  const NOW = new Date("2026-08-01T10:00:00.000Z");

  let reservation!: Reservation;
  let service!: StripeService;

  beforeEach(async () => {
    await resetTestDb();

    const room = await seedTestRoom({
      basePrice: 12000,
      from: new Date("2026-08-12T00:00:00.000Z"),
      days: 3,
    });

    const conversation = await testPrisma.conversation.create({
      data: { phone: "+33600000001" },
    });

    reservation = await testPrisma.reservation.create({
      data: {
        code: "RES-TEST1",
        conversationId: conversation.id,
        roomId: room.id,
        checkIn: new Date("2026-08-12T00:00:00.000Z"),
        checkOut: new Date("2026-08-15T00:00:00.000Z"),
        adults: 2,
        children: 0,
        guestName: "Jean Dupont",
        guestEmail: "jean@example.com",
        guestPhone: "+33600000001",
        total: 36000,
        status: "PENDING",
      },
    });

    const stripe = new Stripe("sk_test_placeholder", {
      httpClient: Stripe.createFetchHttpClient(),
    });

    service = createStripeService({
      stripe,
      prisma: testPrisma,
      baseUrl: "https://hotel.example.com",
      sessionTtlMs: 30 * 60 * 1000,
    });
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("kiedy link wygasł, tworzy nową sesję i nadpisuje istniejący PaymentLink", async () => {
    const PAST = new Date("2026-07-01T10:00:00.000Z");
    let stripeCallCount = 0;

    server.use(
      http.post(STRIPE_SESSIONS_URL, () => {
        stripeCallCount++;
        return HttpResponse.json(
          makeSessionFixture({ id: `cs_test_call_${stripeCallCount}` }),
        );
      }),
    );

    await service.createCheckoutSession({ reservation, now: PAST });

    const result = await service.createCheckoutSession({
      reservation,
      now: NOW,
    });

    expect(stripeCallCount).toBe(2);

    const linkCount = await testPrisma.paymentLink.count({
      where: { reservationId: reservation.id },
    });
    expect(linkCount).toBe(1);

    const link = await testPrisma.paymentLink.findUnique({
      where: { reservationId: reservation.id },
    });
    expect(link!.stripeSessionId).toBe("cs_test_call_2");
    expect(link!.expiresAt.getTime()).toBe(NOW.getTime() + 30 * 60 * 1000);
    expect(result.sessionId).toBe("cs_test_call_2");
  });

  it("drugie wywołanie dla aktywnego linku zwraca ten sam URL bez ponownego wywołania Stripe", async () => {
    // Arrange
    let stripeCallCount = 0;
    server.use(
      http.post(STRIPE_SESSIONS_URL, () => {
        stripeCallCount++;
        return HttpResponse.json(makeSessionFixture());
      }),
    );

    // Act
    const first = await service.createCheckoutSession({
      reservation,
      now: NOW,
    });
    const second = await service.createCheckoutSession({
      reservation,
      now: NOW,
    });

    // Assert
    expect(second.url).toBe(first.url);
    expect(second.sessionId).toBe(first.sessionId);
    expect(stripeCallCount).toBe(1);

    const linkCount = await testPrisma.paymentLink.count({
      where: { reservationId: reservation.id },
    });
    expect(linkCount).toBe(1);
  });

  it("zapisuje PaymentLink w bazie z URL, stripeSessionId, expiresAt i statusem ACTIVE", async () => {
    // Arrange
    server.use(
      http.post(STRIPE_SESSIONS_URL, () =>
        HttpResponse.json(makeSessionFixture()),
      ),
    );

    // Act
    await service.createCheckoutSession({ reservation, now: NOW });

    // Assert
    const link = await testPrisma.paymentLink.findUnique({
      where: { reservationId: reservation.id },
    });

    expect(link).not.toBeNull();
    expect(link!.stripeSessionId).toBe("cs_test_123");
    expect(link!.url).toBe("https://checkout.stripe.com/c/pay/cs_test_123");
    expect(link!.status).toBe("ACTIVE");
    expect(link!.expiresAt.getTime()).toBe(NOW.getTime() + 30 * 60 * 1000);
  });

  it("tworzy sesję Stripe Checkout dla rezerwacji i zwraca URL i sessionId", async () => {
    // Arrange
    server.use(
      http.post(STRIPE_SESSIONS_URL, () =>
        HttpResponse.json(makeSessionFixture()),
      ),
    );

    // Act
    const result = await service.createCheckoutSession({
      reservation,
      now: NOW,
    });

    // Assert
    expect(result.url).toBe("https://checkout.stripe.com/c/pay/cs_test_123");
    expect(result.sessionId).toBe("cs_test_123");
  });

  it("wysyła do Stripe API poprawny payload z danymi rezerwacji", async () => {
    // Arrange
    let capturedBody: URLSearchParams | undefined;

    server.use(
      http.post(STRIPE_SESSIONS_URL, async ({ request }) => {
        capturedBody = new URLSearchParams(await request.text());
        return HttpResponse.json(makeSessionFixture({ id: "cs_test_456" }));
      }),
    );

    // Act
    await service.createCheckoutSession({ reservation, now: NOW });

    // Assert — payload
    expect(capturedBody).toBeDefined();
    expect(capturedBody!.get("mode")).toBe("payment");
    expect(capturedBody!.get("line_items[0][price_data][currency]")).toBe(
      "eur",
    );
    expect(capturedBody!.get("line_items[0][price_data][unit_amount]")).toBe(
      String(reservation.total),
    );
    expect(capturedBody!.get("line_items[0][quantity]")).toBe("1");
    expect(capturedBody!.get("metadata[reservationId]")).toBe(reservation.id);
    expect(capturedBody!.get("metadata[reservationCode]")).toBe(
      reservation.code,
    );
    expect(capturedBody!.get("success_url")).toBe(
      `https://hotel.example.com/booking/success?code=${reservation.code}`,
    );
    expect(capturedBody!.get("cancel_url")).toBe(
      `https://hotel.example.com/booking/cancel?code=${reservation.code}`,
    );

    // Assert — expires_at ≈ now + 30 min (tolerancja 2s)
    const expiresAt = Number(capturedBody!.get("expires_at"));
    const expected = Math.floor((NOW.getTime() + 30 * 60 * 1000) / 1000);
    expect(expiresAt).toBeGreaterThanOrEqual(expected - 2);
    expect(expiresAt).toBeLessThanOrEqual(expected + 2);
  });
});
