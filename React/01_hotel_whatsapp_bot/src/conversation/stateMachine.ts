import { Intent } from "@/ai/schemas";

export const CONVERSATION_STATES = [
  "GREETING",
  "COLLECT_DATES",
  "SHOW_OFFERS",
  "SELECT_ROOM",
  "COLLECT_GUEST_INFO",
  "OFFER_EXTRAS",
  "SUMMARY",
  "PAYMENT_SENT",
  "CONFIRMED",
  "MANAGE_EXISTING",
  "HUMAN_HANDOFF",
  "ERROR",
] as const;

export type ConversationState = (typeof CONVERSATION_STATES)[number];

export type ConversationContext = Readonly<{
  hasCheckIn: boolean;
  hasCheckOut: boolean;
  hasGuestCount: boolean;
  hasSelectedRoom: boolean;
  hasGuestName: boolean;
  hasGuestEmail: boolean;
  unknownCount: number;
}>;

export type SystemEvent =
  | { readonly kind: "intent"; readonly intent: Intent }
  | { readonly kind: "reservation_held" }
  | { readonly kind: "payment_confirmed" }
  | { readonly kind: "ai_failed" };

export type Transition = Readonly<{
  next: ConversationState;
}>;

export const MAX_UNKNOWNS_BEFORE_HANDOFF = 2;

const TERMINAL_STATES: ReadonlySet<ConversationState> = new Set([
  "CONFIRMED",
  "HUMAN_HANDOFF",
]);

export function isTerminal(state: ConversationState): boolean {
  return TERMINAL_STATES.has(state);
}

function hasDates(ctx: ConversationContext): boolean {
  return ctx.hasCheckIn && ctx.hasCheckOut && ctx.hasGuestCount;
}

function hasGuestInfo(ctx: ConversationContext): boolean {
  return ctx.hasGuestName && ctx.hasGuestEmail;
}

export function transition(
  current: ConversationState,
  event: SystemEvent,
  ctx: ConversationContext,
): Transition {
  if (TERMINAL_STATES.has(current)) return { next: current };

  if (event.kind === "payment_confirmed") {
    return { next: current === "PAYMENT_SENT" ? "CONFIRMED" : current };
  }
  if (event.kind === "ai_failed") return { next: "ERROR" };
  if (event.kind === "reservation_held") return { next: current };

  const { intent } = event;

  if (intent === "handoff_request") return { next: "HUMAN_HANDOFF" };
  if (intent === "manage_existing") return { next: "MANAGE_EXISTING" };
  if (intent === "faq") return { next: current };
  if (intent === "unknown") {
    return {
      next:
        ctx.unknownCount >= MAX_UNKNOWNS_BEFORE_HANDOFF
          ? "HUMAN_HANDOFF"
          : current,
    };
  }

  switch (current) {
    case "GREETING":
      if (intent === "greet") return { next: "COLLECT_DATES" };
      if (intent === "collect_dates") {
        return { next: hasDates(ctx) ? "SHOW_OFFERS" : "COLLECT_DATES" };
      }
      return { next: "COLLECT_DATES" };

    case "COLLECT_DATES":
      if (intent === "collect_dates") {
        return { next: hasDates(ctx) ? "SHOW_OFFERS" : "COLLECT_DATES" };
      }
      if (intent === "modify_slots") return { next: "COLLECT_DATES" };
      return { next: current };

    case "SHOW_OFFERS":
      if (intent === "select_room") {
        return {
          next: ctx.hasSelectedRoom ? "COLLECT_GUEST_INFO" : "SELECT_ROOM",
        };
      }
      if (intent === "modify_slots") return { next: "COLLECT_DATES" };
      return { next: current };

    case "SELECT_ROOM":
      if (intent === "select_room") {
        return {
          next: ctx.hasSelectedRoom ? "COLLECT_GUEST_INFO" : "SELECT_ROOM",
        };
      }
      if (intent === "modify_slots") return { next: "COLLECT_DATES" };
      return { next: current };

    case "COLLECT_GUEST_INFO":
      if (intent === "collect_guest_info") {
        return {
          next: hasGuestInfo(ctx) ? "OFFER_EXTRAS" : "COLLECT_GUEST_INFO",
        };
      }
      if (intent === "modify_slots") return { next: "SHOW_OFFERS" };
      return { next: current };

    case "OFFER_EXTRAS":
      if (intent === "offer_extras" || intent === "request_summary") {
        return { next: "SUMMARY" };
      }
      if (intent === "modify_slots") return { next: "SHOW_OFFERS" };
      return { next: current };

    case "SUMMARY":
      if (intent === "confirm_booking") return { next: "PAYMENT_SENT" };
      if (intent === "request_summary") return { next: "SUMMARY" };
      if (intent === "modify_slots") return { next: "COLLECT_DATES" };
      return { next: current };

    case "PAYMENT_SENT":
      return { next: current };

    case "MANAGE_EXISTING":
      if (intent === "greet") return { next: "GREETING" };
      return { next: current };

    case "ERROR":
      if (intent === "greet" || intent === "collect_dates") {
        return { next: "COLLECT_DATES" };
      }
      return { next: current };

    default:
      return { next: current };
  }
}
