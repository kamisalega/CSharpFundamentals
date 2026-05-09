import { MessagingPort } from "@/channels/MessagingPort";
import { EmailPort } from "@/email/EmailPort";
import { PaymentPort } from "@/payments/PaymentPort";
import { PmsPort } from "@/pms/PmsPort";
import { PrismaClient } from "@prisma/client";
import { Effect } from "./Effect";
import { FlowState } from "./FlowState";
import { TransitionContext } from "./transitions";
import { FlowConversationEngine } from "./FlowConversationEngine";
import { FlowSlots } from "./FlowSlots";
import { FlowEvent } from "./FlowEvent";

export type InterpreterPorts = Readonly<{
  messaging: MessagingPort;
  pms: PmsPort;
  payments: PaymentPort;
  email: EmailPort;
  prisma: PrismaClient;
  now: () => Date;
}>;

export async function interpretEffects(
  initialEffects: Effect[],
  liveState: FlowState, 
  ctx: TransitionContext,
  engine: FlowConversationEngine,
  ports: InterpreterPorts,
): Promise<void> {
  const effectQueue: Effect[] = [...initialEffects];
  let currentState = liveState;
  const accumulatedSlots: Partial<FlowSlots> = {};

  type PendingPersist = Extract<Effect, { kind: "persistFlowState" }>;
  let pendingPersist: PendingPersist | null = null;

  while (effectQueue.length > 0) {
    const effect = effectQueue.shift()!;

    switch (effect.kind) {
      case "sendListPicker":
        await ports.messaging.sendTemplate({
          to: effect.to,
          templateSid: effect.templateSid,
          variables: effect.variables,
        });
        break;

      case "sendFlow":
        await ports.messaging.sendFlow({
          to: effect.to,
          flowId: effect.flowId,
          flowToken: effect.flowToken,
          cta: effect.cta,
        });
        break;

      case "sendCard":
        await ports.messaging.sendTemplate({
          to: effect.to,
          templateSid: effect.templateSid,
          variables: effect.variables,
        });
        break;

      case "sendCtaButton":
        await ports.messaging.sendTemplate({
          to: effect.to,
          templateSid: effect.templateSid,
          variables: { ...effect.variables, url: effect.url },
        });
        break;
      case "sendTextTemplate":
        await ports.messaging.sendTemplate({
          to: effect.to,
          templateSid: effect.templateSid,
          variables: effect.variables,
        });
        break;

      case "searchAvailability": {
        const rooms = await ports.pms.searchAvailability({
          checkIn: effect.checkIn,
          checkOut: effect.checkOut,
          guests: effect.guests,
          now: ports.now(),
        });
        accumulatedSlots.availableRooms = rooms;
        break;
      }

      case "holdReservation": {
        let feedbackEvent: FlowEvent;

        try {
          const reservation = await ports.pms.holdReservation({
            conversationId: effect.conversationId,
            roomId: effect.roomId,
            checkIn: effect.checkIn,
            checkOut: effect.checkOut,
            guests: effect.guests,
            breakfast: effect.breakfast,
            guest: effect.guest,
            now: ports.now(),
          });
          feedbackEvent = {
            kind: "reservationHeld",
            reservationId: reservation.id,
            total: reservation.total,
          };
        } catch (err) {
          feedbackEvent = {
            kind: "reservationFailed",
            reason: err instanceof Error ? err.message : "unknown error",
          };
        }

        const result = engine.dispatch(currentState, feedbackEvent, {
          ...ctx,
          slots: { ...ctx.slots, ...accumulatedSlots },
        });
        currentState = result.next;
        effectQueue.push(...result.effects);
        break;
      }

      case "createPaymentLink": {
        const reservation = await ports.prisma.reservation.findUniqueOrThrow({
          where: { id: effect.reservationId },
        });
        const link = await ports.payments.createCheckoutLink({
          reservation,
          now: ports.now(),
        });
        accumulatedSlots.paymentUrl = link.url;
        effectQueue.push({
          kind: "sendCtaButton",
          to: ctx.phone,
          templateSid: ctx.templateSids.payCta,
          url: link.url,
          variables: { "1": formatCents(reservation.total) },
        });
        break;
      }

      case "sendBookingConfirmEmail": {
        const reservation = await ports.prisma.reservation.findUniqueOrThrow({
          where: { id: effect.reservationId },
        });
        await ports.email.sendBookingConfirmation({
          reservation,
          locale: ctx.locale,
        });
        break;
      }

      case "persistFlowState": {
        pendingPersist = effect;
        Object.assign(accumulatedSlots, effect.mergedSlots ?? {});
        break;
      }
    }
  }
  if (pendingPersist !== null) {
    const persist = pendingPersist;
    await ports.prisma.$transaction(async (tx) => {
      await tx.conversation.update({
        where: { id: ctx.conversationId },
        data: {
          flowState: persist.nextState,
          flowToken: persist.flowToken ?? null,
          flowSlots: JSON.stringify({ ...ctx.slots, ...accumulatedSlots }),
          lastInboundAt: ports.now(),
        },
      });
    });
  }
}

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}
