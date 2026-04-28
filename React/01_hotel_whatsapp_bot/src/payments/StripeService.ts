import { PrismaClient, Reservation } from "@prisma/client";
import Stripe from "stripe";

export type StripeServiceConfig = Readonly<{
  stripe: Stripe;
  prisma: PrismaClient;
  baseUrl: string;
  sessionTtlMs: number;
}>;

export type CreateCheckoutSessionInput = Readonly<{
  reservation: Reservation;
  now: Date;
}>;

export type CheckoutSession = Readonly<{
  url: string;
  sessionId: string;
}>;

export type StripeService = Readonly<{
  createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CheckoutSession>;
}>;

function isLinkUsable(
  link: Readonly<{ status: string; expiresAt: Date }> | null,
  now: Date,
): boolean {
  return link !== null && link.status === "ACTIVE" && link.expiresAt > now;
}

export function createStripeService(
  config: StripeServiceConfig,
): StripeService {
  async function createCheckoutSession({
    reservation,
    now,
  }: CreateCheckoutSessionInput): Promise<CheckoutSession> {
    const existing = await config.prisma.paymentLink.findUnique({
      where: { reservationId: reservation.id },
    });

    if (isLinkUsable(existing, now)) {
      return { url: existing!.url, sessionId: existing!.stripeSessionId };
    }

    const session = await config.stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: `Réservation ${reservation.code}` },
            unit_amount: reservation.total,
          },
          quantity: 1,
        },
      ],
      success_url: `${config.baseUrl}/booking/success?code=${reservation.code}`,
      cancel_url: `${config.baseUrl}/booking/cancel?code=${reservation.code}`,
      metadata: {
        reservationId: reservation.id,
        reservationCode: reservation.code,
      },
      expires_at: Math.floor((now.getTime() + config.sessionTtlMs) / 1000),
    });

    if (!session.url) {
      throw new Error("Stripe session URL is missing from response");
    }

    const expiresAt = new Date(now.getTime() + config.sessionTtlMs);

    await config.prisma.paymentLink.upsert({
      where: { reservationId: reservation.id },
      create: {
        reservationId: reservation.id,
        stripeSessionId: session.id,
        url: session.url,
        expiresAt,
        status: "ACTIVE",
      },
      update: {
        stripeSessionId: session.id,
        url: session.url,
        expiresAt,
        status: "ACTIVE",
      },
    });

    return { url: session.url, sessionId: session.id };
  }

  return { createCheckoutSession };
}
