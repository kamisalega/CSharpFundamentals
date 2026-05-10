import { Prisma, PrismaClient } from "@prisma/client";
import Stripe from "stripe";
import type { MessagingPort } from "@/channels/MessagingPort";
import type { EmailPort } from "@/email/EmailPort";

export type StripeWebhookLogger = Readonly<{
  info: (obj: object) => void;
  warn: (obj: object) => void;
  error: (obj: object) => void;
}>;

export type StripeWebhookDeps = Readonly<{
  stripe: Stripe;
  prisma: PrismaClient;
  webhookSecret: string;
  logger: StripeWebhookLogger;
  getCorrelationId: () => string;
  messaging: MessagingPort;
  email: EmailPort;
  bookingConfirmedSid: string | undefined;
}>;

export function createStripeWebhookHandler(deps: StripeWebhookDeps) {
  async function POST(request: Request): Promise<Response> {
    const correlationId = deps.getCorrelationId();
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");

    let event: Stripe.Event;
    try {
      event = deps.stripe.webhooks.constructEvent(
        rawBody,
        signature ?? "",
        deps.webhookSecret,
      );
    } catch {
      deps.logger.warn({
        event: "stripe.webhook.signature.invalid",
        correlationId,
      });
      return new Response(null, { status: 401 });
    }

    if (event.type !== "checkout.session.completed") {
      deps.logger.info({
        event: "stripe.webhook.unhandled_event",
        type: event.type,
        correlationId,
      });
      return new Response(null, { status: 200 });
    }

    return handleCheckoutCompleted(event, correlationId);
  }

  async function handleCheckoutCompleted(
    event: Stripe.Event,
    correlationId: string,
  ): Promise<Response> {
    try {
      await deps.prisma.processedWebhookEvent.create({
        data: { source: "STRIPE", externalId: event.id },
      });
    } catch (e) {
      if (isPrismaUniqueError(e)) {
        deps.logger.info({
          event: "stripe.webhook.duplicate",
          stripeEventId: event.id,
          correlationId,
        });
        return new Response(null, { status: 200 });
      }
      throw e;
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const reservationId = session.metadata?.["reservationId"];
    const reservationCode = session.metadata?.["reservationCode"];

    if (!reservationId || !reservationCode) {
      deps.logger.error({
        event: "stripe.webhook.metadata.invalid",
        stripeEventId: event.id,
        correlationId,
      });
      return new Response(null, { status: 200 });
    }

    const [updatedReservation] = await deps.prisma.$transaction([
      deps.prisma.reservation.update({
        where: { code: reservationCode },
        data: { status: "CONFIRMED" },
      }),
      deps.prisma.paymentLink.update({
        where: { reservationId },
        data: { status: "PAID" },
      }),
    ]);

    const conversation = await deps.prisma.conversation.findUnique({
      where: { id: updatedReservation.conversationId },
    });

    if (conversation) {
      if (conversation.channel === "TWILIO") {
        if (deps.bookingConfirmedSid) {
          try {
            await deps.messaging.sendTemplate({
              to: conversation.phone,
              templateSid: deps.bookingConfirmedSid,
              variables: { "1": reservationCode },
            });
            deps.logger.info({
              event: "stripe.webhook.twilio.confirmation_sent",
              reservationCode,
              correlationId,
            });
          } catch (err) {
            deps.logger.error({
              event: "stripe.webhook.twilio.confirmation_failed",
              reservationCode,
              correlationId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        } else {
          deps.logger.warn({
            event: "stripe.webhook.twilio.confirmation_skipped",
            reason: "bookingConfirmedSid not configured",
            reservationCode,
            correlationId,
          });
        }
      }

      try {
        await deps.email.sendBookingConfirmation({
          reservation: updatedReservation,
          locale: conversation.locale,
        });
      } catch (err) {
        deps.logger.error({
          event: "stripe.webhook.email.confirmation_failed",
          reservationCode,
          correlationId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    deps.logger.info({
      event: "stripe.webhook.processed",
      stripeEventId: event.id,
      reservationCode,
      correlationId,
    });

    return new Response(null, { status: 200 });
  }

  return { POST };
}

function isPrismaUniqueError(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
  );
}
