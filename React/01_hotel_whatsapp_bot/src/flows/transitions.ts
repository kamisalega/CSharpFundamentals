import { Effect } from "./Effect";
import { FlowEvent } from "./FlowEvent";
import { FlowSlots } from "./FlowSlots";
import { FlowState, TERMINAL_STATES } from "./FlowState";

export interface TransitionContext {
  conversationId: string;
  phone: string;
  locale: string;
  slots: FlowSlots;
  templateSids: TemplateSids;
  flowIds: FlowIds;
}

export interface TemplateSids {
  welcomeMenu: string;
  datePickerFlow: string;
  guestsPickerFlow: string;
  guestInfoFlow: string;
  roomDetailCard: string;
  payCta: string;
  bookingConfirmed: string;
}

export interface FlowIds {
  datePicker: string;
  guestsPicker: string;
  guestInfo: string;
}

export interface TransitionResult {
  next: FlowState;
  effects: Effect[];
}

export function transition(
  state: FlowState,
  event: FlowEvent,
  ctx: TransitionContext,
): TransitionResult {
  if (TERMINAL_STATES.has(state)) {
    return { next: state, effects: [] };
  }

  switch (state) {
    case FlowState.BOOT:
      return onBoot(event, ctx);

    case FlowState.MENU_SHOWN:
      return onMenuShown(event, ctx);

    case FlowState.AWAITING_DATES:
      return onAwaitingDates(event, ctx);

    case FlowState.AWAITING_GUESTS:
      return onAwaitingGuests(event, ctx);

    case FlowState.ROOM_LIST_SHOWN:
      return onRoomListShown(event, ctx);

    case FlowState.ROOM_DETAIL_SHOWN:
      return onRoomDetailShown(event, ctx);

    case FlowState.AWAITING_GUEST_INFO:
      return onAwaitingGuestInfo(event, ctx);

    case FlowState.AWAITING_EXTRAS:
      return onAwaitingExtras(event, ctx);

    case FlowState.RECAP_SHOWN:
      return onRecapShown(event, ctx);

    case FlowState.PAYMENT_PENDING:
      return onPaymentPending(event, ctx);

    case FlowState.PAID:
      return onPaid(event, ctx);

    default:
      return { next: state, effects: [] };
  }
}

function onBoot(event: FlowEvent, ctx: TransitionContext): TransitionResult {
  if (event.kind === "inboundText") {
    return {
      next: FlowState.MENU_SHOWN,
      effects: [
        {
          kind: "sendListPicker",
          to: ctx.phone,
          templateSid: ctx.templateSids.welcomeMenu,
          variables: {},
        },
        {
          kind: "persistFlowState",
          conversationId: ctx.conversationId,
          nextState: FlowState.MENU_SHOWN,
        },
      ],
    };
  }
  return { next: FlowState.BOOT, effects: [] };
}

function onMenuShown(
  event: FlowEvent,
  ctx: TransitionContext,
): TransitionResult {
  if (event.kind === "menuSelection" && event.selectionId === "book_room") {
    const flowToken = generateFlowToken();
    return {
      next: FlowState.AWAITING_DATES,
      effects: [
        {
          kind: "sendFlow",
          to: ctx.phone,
          flowId: ctx.flowIds.datePicker,
          flowToken,
          cta: "Choisir les dates",
          templateSid: ctx.templateSids.datePickerFlow,
        },
        {
          kind: "persistFlowState",
          conversationId: ctx.conversationId,
          nextState: FlowState.AWAITING_DATES,
          flowToken,
        },
      ],
    };
  }
  if (event.kind === "timeout") {
    return {
      next: FlowState.FAILED,
      effects: [
        {
          kind: "persistFlowState",
          conversationId: ctx.conversationId,
          nextState: FlowState.FAILED,
        },
      ],
    };
  }
  return { next: FlowState.MENU_SHOWN, effects: [] };
}

function onAwaitingDates(
  event: FlowEvent,
  ctx: TransitionContext,
): TransitionResult {
  if (event.kind === "flowSubmitted" && isDatePayload(event.payload)) {
    const { checkIn, checkOut } = event.payload;
    const flowToken = generateFlowToken();
    return {
      next: FlowState.AWAITING_GUESTS,
      effects: [
        {
          kind: "sendFlow",
          to: ctx.phone,
          flowId: ctx.flowIds.guestsPicker,
          flowToken,
          cta: "Choisir les voyageurs",
          templateSid: ctx.templateSids.guestsPickerFlow,
        },
        {
          kind: "persistFlowState",
          conversationId: ctx.conversationId,
          nextState: FlowState.AWAITING_GUESTS,
          flowToken,
          mergedSlots: { checkIn, checkOut },
        },
      ],
    };
  }
  return { next: FlowState.AWAITING_DATES, effects: [] };
}

function onAwaitingGuests(
  event: FlowEvent,
  ctx: TransitionContext,
): TransitionResult {
  if (event.kind === "flowSubmitted" && isGuestsPayload(event.payload)) {
    const { adults, children } = event.payload;
    return {
      next: FlowState.ROOM_LIST_SHOWN,
      effects: [
        {
          kind: "searchAvailability",
          checkIn: ctx.slots.checkIn!,
          checkOut: ctx.slots.checkOut!,
          guests: { adults, children },
        },
        {
          kind: "persistFlowState",
          conversationId: ctx.conversationId,
          nextState: FlowState.ROOM_LIST_SHOWN,
          mergedSlots: { guests: { adults, children } },
        },
      ],
    };
  }
  return { next: FlowState.AWAITING_GUESTS, effects: [] };
}

function onRoomListShown(
  event: FlowEvent,
  ctx: TransitionContext,
): TransitionResult {
  if (event.kind === "menuSelection") {
    return {
      next: FlowState.ROOM_DETAIL_SHOWN,
      effects: [
        {
          kind: "sendCard",
          to: ctx.phone,
          templateSid: ctx.templateSids.roomDetailCard,
          variables: { roomId: event.selectionId },
        },
        {
          kind: "persistFlowState",
          conversationId: ctx.conversationId,
          nextState: FlowState.ROOM_DETAIL_SHOWN,
          mergedSlots: { selectedRoomId: event.selectionId },
        },
      ],
    };
  }
  return { next: FlowState.ROOM_LIST_SHOWN, effects: [] };
}

function onRoomDetailShown(
  event: FlowEvent,
  ctx: TransitionContext,
): TransitionResult {
  if (event.kind === "menuSelection" && event.selectionId === "confirm_room") {
    const flowToken = generateFlowToken();
    return {
      next: FlowState.AWAITING_GUEST_INFO,
      effects: [
        {
          kind: "sendFlow",
          to: ctx.phone,
          flowId: ctx.flowIds.guestInfo,
          flowToken,
          cta: "Remplir mes informations",
          templateSid: ctx.templateSids.guestInfoFlow,
        },
        {
          kind: "persistFlowState",
          conversationId: ctx.conversationId,
          nextState: FlowState.AWAITING_GUEST_INFO,
          flowToken,
        },
      ],
    };
  }
  if (event.kind === "menuSelection" && event.selectionId === "back_to_list") {
    return {
      next: FlowState.ROOM_LIST_SHOWN,
      effects: [
        {
          kind: "persistFlowState",
          conversationId: ctx.conversationId,
          nextState: FlowState.ROOM_LIST_SHOWN,
        },
      ],
    };
  }
  return { next: FlowState.ROOM_DETAIL_SHOWN, effects: [] };
}

function onAwaitingGuestInfo(
  event: FlowEvent,
  ctx: TransitionContext,
): TransitionResult {
  if (event.kind === "flowSubmitted" && isGuestInfoPayload(event.payload)) {
    const { name, email, phone } = event.payload;
    return {
      next: FlowState.AWAITING_EXTRAS,
      effects: [
        {
          kind: "persistFlowState",
          conversationId: ctx.conversationId,
          nextState: FlowState.AWAITING_EXTRAS,
          mergedSlots: {
            guestName: name,
            guestEmail: email,
            guestPhone: phone,
          },
        },
      ],
    };
  }
  return { next: FlowState.AWAITING_GUEST_INFO, effects: [] };
}

function onAwaitingExtras(
  event: FlowEvent,
  ctx: TransitionContext,
): TransitionResult {
  if (event.kind === "flowSubmitted" && isExtrasPayload(event.payload)) {
    return {
      next: FlowState.RECAP_SHOWN,
      effects: [
        {
          kind: "persistFlowState",
          conversationId: ctx.conversationId,
          nextState: FlowState.RECAP_SHOWN,
          mergedSlots: { breakfast: event.payload.breakfast },
        },
      ],
    };
  }
  return { next: FlowState.AWAITING_EXTRAS, effects: [] };
}

function onRecapShown(
  event: FlowEvent,
  ctx: TransitionContext,
): TransitionResult {
  if (
    event.kind === "menuSelection" &&
    event.selectionId === "confirm_booking"
  ) {
    return {
      next: FlowState.PAYMENT_PENDING,
      effects: [
        {
          kind: "holdReservation",
          conversationId: ctx.conversationId,
          roomId: ctx.slots.selectedRoomId!,
          checkIn: ctx.slots.checkIn!,
          checkOut: ctx.slots.checkOut!,
          guests: ctx.slots.guests!,
          breakfast: ctx.slots.breakfast ?? false,
          guest: {
            name: ctx.slots.guestName!,
            email: ctx.slots.guestEmail!,
            phone: ctx.slots.guestPhone!,
          },
        },
        {
          kind: "persistFlowState",
          conversationId: ctx.conversationId,
          nextState: FlowState.PAYMENT_PENDING,
        },
      ],
    };
  }
  return { next: FlowState.RECAP_SHOWN, effects: [] };
}

function onPaymentPending(
  event: FlowEvent,
  ctx: TransitionContext,
): TransitionResult {
  if (event.kind === "reservationHeld") {
    return {
      next: FlowState.PAYMENT_PENDING,
      effects: [
        {
          kind: "createPaymentLink",
          reservationId: event.reservationId,
        },
        {
          kind: "persistFlowState",
          conversationId: ctx.conversationId,
          nextState: FlowState.PAYMENT_PENDING,
          mergedSlots: {
            reservationId: event.reservationId,
            totalAmount: event.total,
          },
        },
      ],
    };
  }
  if (event.kind === "reservationFailed") {
    return {
      next: FlowState.FAILED,
      effects: [
        {
          kind: "persistFlowState",
          conversationId: ctx.conversationId,
          nextState: FlowState.FAILED,
        },
      ],
    };
  }
  if (event.kind === "paymentSucceeded") {
    return {
      next: FlowState.PAID,
      effects: [
        {
          kind: "persistFlowState",
          conversationId: ctx.conversationId,
          nextState: FlowState.PAID,
        },
      ],
    };
  }
  if (event.kind === "paymentFailed") {
    return {
      next: FlowState.HUMAN_HANDOFF,
      effects: [
        {
          kind: "persistFlowState",
          conversationId: ctx.conversationId,
          nextState: FlowState.HUMAN_HANDOFF,
        },
      ],
    };
  }
  return { next: FlowState.PAYMENT_PENDING, effects: [] };
}

function onPaid(event: FlowEvent, ctx: TransitionContext): TransitionResult {
  if (event.kind === "paymentSucceeded") {
    return {
      next: FlowState.CONFIRMED,
      effects: [
        {
          kind: "sendTextTemplate",
          to: ctx.phone,
          templateSid: ctx.templateSids.bookingConfirmed,
          variables: { "1": event.reservationCode },
        },
        {
          kind: "sendBookingConfirmEmail",
          reservationId: ctx.slots.reservationId!,
        },
        {
          kind: "persistFlowState",
          conversationId: ctx.conversationId,
          nextState: FlowState.CONFIRMED,
        },
      ],
    };
  }
  return { next: FlowState.PAID, effects: [] };
}

function isDatePayload(p: unknown): p is { checkIn: Date; checkOut: Date } {
  return (
    typeof p === "object" && p !== null && "checkIn" in p && "checkOut" in p
  );
}

function isGuestsPayload(
  p: unknown,
): p is { adults: number; children: number } {
  return (
    typeof p === "object" && p !== null && "adults" in p && "children" in p
  );
}

function isGuestInfoPayload(
  p: unknown,
): p is { name: string; email: string; phone: string } {
  return (
    typeof p === "object" &&
    p !== null &&
    "name" in p &&
    "email" in p &&
    "phone" in p
  );
}

function isExtrasPayload(p: unknown): p is { breakfast: boolean } {
  return typeof p === "object" && p !== null && "breakfast" in p;
}

function generateFlowToken(): string {
  return crypto.randomUUID();
}
