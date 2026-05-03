import { describe, expect, it } from "vitest";
import { ConversationContext, MAX_UNKNOWNS_BEFORE_HANDOFF, transition } from "./stateMachine";

const emptyCtx: ConversationContext = {
    hasCheckIn: false,
    hasCheckOut: false,
    hasGuestCount: false,
    hasSelectedRoom: false,
    hasGuestName: false,
    hasGuestEmail: false,
    unknownCount: 0,
  };

  const fullDatesCtx: ConversationContext = {
    ...emptyCtx,
    hasCheckIn: true,
    hasCheckOut: true,
    hasGuestCount: true,
  };

  const fullGuestCtx: ConversationContext = {
    ...fullDatesCtx,
    hasSelectedRoom: true,
    hasGuestName: true,
    hasGuestEmail: true,
  };


describe("stateMachine.transition — happy path", () => {
  it("with GREETING + intent greet → COLLECT_DATES (after greeting we ask for dates)", () => {
    const result = transition(
      "GREETING",
      { kind: "intent", intent: "greet" },
      emptyCtx,
    );

    expect(result.next).toBe("COLLECT_DATES");
  });

  it("from COLLECT_DATES + collect_dates with all dates → SHOW_OFFERS", () => {
    const result = transition(
      "COLLECT_DATES",
      { kind: "intent", intent: "collect_dates" },
      fullDatesCtx,
    );

    expect(result.next).toBe("SHOW_OFFERS");
  });

  it("from COLLECT_DATES + collect_dates without a set of dates → we stay in COLLECT_DATES", () => {
    const result = transition(
      "COLLECT_DATES",
      { kind: "intent", intent: "collect_dates" },
      { ...emptyCtx, hasCheckIn: true },
    );

    expect(result.next).toBe("COLLECT_DATES");
  });

  it("from SHOW_OFFERS + select_room with the selected room → COLLECT_GUEST_NAME", () => {
    const result = transition(
      "SHOW_OFFERS",
      { kind: "intent", intent: "select_room" },
      { ...fullDatesCtx, hasSelectedRoom: true },
    );

    expect(result.next).toBe("COLLECT_GUEST_NAME");
  });

  it("with SHOW_OFFERS + select_room without selected room → SELECT_ROOM", () => {
    const result = transition(
      "SHOW_OFFERS",
      { kind: "intent", intent: "select_room" },
      fullDatesCtx,
    );

    expect(result.next).toBe("SELECT_ROOM");
  });

  it("with SELECT_ROOM + select_room with selected room → COLLECT_GUEST_NAME", () => {
    const result = transition(
      "SELECT_ROOM",
      { kind: "intent", intent: "select_room" },
      { ...fullDatesCtx, hasSelectedRoom: true },
    );

    expect(result.next).toBe("COLLECT_GUEST_NAME");
  });

  it("with COLLECT_GUEST_NAME + collect_guest_info without name → stay in COLLECT_GUEST_NAME", () => {
    const result = transition(
      "COLLECT_GUEST_NAME",
      { kind: "intent", intent: "collect_guest_info" },
      { ...fullDatesCtx, hasSelectedRoom: true },
    );

    expect(result.next).toBe("COLLECT_GUEST_NAME");
  });

  it("with COLLECT_GUEST_NAME + collect_guest_info with name → COLLECT_GUEST_EMAIL", () => {
    const result = transition(
      "COLLECT_GUEST_NAME",
      { kind: "intent", intent: "collect_guest_info" },
      { ...fullDatesCtx, hasSelectedRoom: true, hasGuestName: true },
    );

    expect(result.next).toBe("COLLECT_GUEST_EMAIL");
  });

  it("with COLLECT_GUEST_EMAIL + collect_guest_info without email → stay in COLLECT_GUEST_EMAIL", () => {
    const result = transition(
      "COLLECT_GUEST_EMAIL",
      { kind: "intent", intent: "collect_guest_info" },
      { ...fullDatesCtx, hasSelectedRoom: true, hasGuestName: true },
    );

    expect(result.next).toBe("COLLECT_GUEST_EMAIL");
  });

  it("with COLLECT_GUEST_EMAIL + collect_guest_info with email → OFFER_EXTRAS", () => {
    const result = transition(
      "COLLECT_GUEST_EMAIL",
      { kind: "intent", intent: "collect_guest_info" },
      fullGuestCtx,
    );

    expect(result.next).toBe("OFFER_EXTRAS");
  });

  it("z OFFER_EXTRAS + offer_extras → SUMMARY", () => {
    const result = transition(
      "OFFER_EXTRAS",
      { kind: "intent", intent: "offer_extras" },
      fullGuestCtx,
    );

    expect(result.next).toBe("SUMMARY");
  });

  it("z OFFER_EXTRAS + request_summary → SUMMARY (gość pomija dodatki)", () => {
    const result = transition(
      "OFFER_EXTRAS",
      { kind: "intent", intent: "request_summary" },
      fullGuestCtx,
    );

    expect(result.next).toBe("SUMMARY");
  });

  it("z SUMMARY + confirm_booking → PAYMENT_SENT", () => {
    const result = transition(
      "SUMMARY",
      { kind: "intent", intent: "confirm_booking" },
      fullGuestCtx,
    );

    expect(result.next).toBe("PAYMENT_SENT");
  });

  it("z PAYMENT_SENT + system event payment_confirmed → CONFIRMED", () => {
    const result = transition(
      "PAYMENT_SENT",
      { kind: "payment_confirmed" },
      fullGuestCtx,
    );

    expect(result.next).toBe("CONFIRMED");
  });
});


describe("stateMachine.transition — priorytety i rozgałęzienia", () => {
  it("handoff_request z GREETING → HUMAN_HANDOFF", () => {
    const result = transition(
      "GREETING",
      { kind: "intent", intent: "handoff_request" },
      emptyCtx,
    );

    expect(result.next).toBe("HUMAN_HANDOFF");
  });

  it("handoff_request z SHOW_OFFERS → HUMAN_HANDOFF", () => {
    const result = transition(
      "SHOW_OFFERS",
      { kind: "intent", intent: "handoff_request" },
      fullDatesCtx,
    );

    expect(result.next).toBe("HUMAN_HANDOFF");
  });

  it("handoff_request z SUMMARY → HUMAN_HANDOFF", () => {
    const result = transition(
      "SUMMARY",
      { kind: "intent", intent: "handoff_request" },
      fullGuestCtx,
    );

    expect(result.next).toBe("HUMAN_HANDOFF");
  });

  it("manage_existing z GREETING → MANAGE_EXISTING", () => {
    const result = transition(
      "GREETING",
      { kind: "intent", intent: "manage_existing" },
      emptyCtx,
    );

    expect(result.next).toBe("MANAGE_EXISTING");
  });

  it("manage_existing z COLLECT_GUEST_NAME → MANAGE_EXISTING", () => {
    const result = transition(
      "COLLECT_GUEST_NAME",
      { kind: "intent", intent: "manage_existing" },
      fullDatesCtx,
    );

    expect(result.next).toBe("MANAGE_EXISTING");
  });
});



describe("stateMachine.transition — modify_slots cofa flow", () => {
  it("modify_slots z SHOW_OFFERS → COLLECT_DATES", () => {
    const result = transition(
      "SHOW_OFFERS",
      { kind: "intent", intent: "modify_slots" },
      fullDatesCtx,
    );

    expect(result.next).toBe("COLLECT_DATES");
  });

  it("modify_slots from COLLECT_GUEST_NAME → SHOW_OFFERS", () => {
    const result = transition(
      "COLLECT_GUEST_NAME",
      { kind: "intent", intent: "modify_slots" },
      { ...fullDatesCtx, hasSelectedRoom: true },
    );

    expect(result.next).toBe("SHOW_OFFERS");
  });

  it("modify_slots from COLLECT_GUEST_EMAIL → SHOW_OFFERS", () => {
    const result = transition(
      "COLLECT_GUEST_EMAIL",
      { kind: "intent", intent: "modify_slots" },
      { ...fullDatesCtx, hasSelectedRoom: true, hasGuestName: true },
    );

    expect(result.next).toBe("SHOW_OFFERS");
  });

  it("modify_slots z SUMMARY → COLLECT_DATES (pełny reset)", () => {
    const result = transition(
      "SUMMARY",
      { kind: "intent", intent: "modify_slots" },
      fullGuestCtx,
    );

    expect(result.next).toBe("COLLECT_DATES");
  });
});



describe("stateMachine.transition — unknown counter and handoff threshold", () => {
  it("unknown below threshold → state does not change", () => {
    const result = transition(
      "COLLECT_DATES",
      { kind: "intent", intent: "unknown" },
      { ...emptyCtx, unknownCount: 0 },
    );

    expect(result.next).toBe("COLLECT_DATES");
  });

  it("unknown exactly at the threshold MAX_UNKNOWNS_BEFORE_HANDOFF → HUMAN_HANDOFF", () => {
    const result = transition(
      "COLLECT_DATES",
      { kind: "intent", intent: "unknown" },
      { ...emptyCtx, unknownCount: MAX_UNKNOWNS_BEFORE_HANDOFF },
    );

    expect(result.next).toBe("HUMAN_HANDOFF");
  });

  it("unknown above threshold → HUMAN_HANDOFF", () => {
    const result = transition(
      "SHOW_OFFERS",
      { kind: "intent", intent: "unknown" },
      { ...fullDatesCtx, unknownCount: MAX_UNKNOWNS_BEFORE_HANDOFF + 5 },
    );

    expect(result.next).toBe("HUMAN_HANDOFF");
  });
});


describe("stateMachine.transition - system events", () => {
  it("payment_confirmed w PAYMENT_SENT → CONFIRMED", () => {
    const result = transition(
      "PAYMENT_SENT",
      { kind: "payment_confirmed" },
      fullGuestCtx,
    );

    expect(result.next).toBe("CONFIRMED");
  });

  it("payment confirmed outside PAYMENT SENT → no effect", () => {
    const result = transition(
      "SUMMARY",
      { kind: "payment_confirmed" },
      fullGuestCtx,
    );

    expect(result.next).toBe("SUMMARY");
  });

  it("ai_failed from working state → ERROR", () => {
    const result = transition("COLLECT_DATES", { kind: "ai_failed" }, emptyCtx);

    expect(result.next).toBe("ERROR");
  });

  it("ai_failed z SHOW_OFFERS → ERROR", () => {
    const result = transition(
      "SHOW_OFFERS",
      { kind: "ai_failed" },
      fullDatesCtx,
    );

    expect(result.next).toBe("ERROR");
  });
});


describe("stateMachine.transition — terminal states and neutral intents", () => {
  it("faq from SHOW_OFFERS → status unchanged", () => {
    const result = transition(
      "SHOW_OFFERS",
      { kind: "intent", intent: "faq" },
      fullDatesCtx,
    );

    expect(result.next).toBe("SHOW_OFFERS");
  });

  it("faq from COLLECT_GUEST_NAME → status unchanged", () => {
    const result = transition(
      "COLLECT_GUEST_NAME",
      { kind: "intent", intent: "faq" },
      { ...fullDatesCtx, hasSelectedRoom: true },
    );

    expect(result.next).toBe("COLLECT_GUEST_NAME");
  });

  it("HUMAN_HANDOFF jest terminalny — intent greet nic nie zmienia", () => {
    const result = transition(
      "HUMAN_HANDOFF",
      { kind: "intent", intent: "greet" },
      emptyCtx,
    );

    expect(result.next).toBe("HUMAN_HANDOFF");
  });

  it("HUMAN_HANDOFF is terminal - handoff_request does nothing", () => {
    const result = transition(
      "HUMAN_HANDOFF",
      { kind: "intent", intent: "handoff_request" },
      emptyCtx,
    );

    expect(result.next).toBe("HUMAN_HANDOFF");
  });

  it("CONFIRMED jest terminalny — collect_dates nic nie zmienia", () => {
    const result = transition(
      "CONFIRMED",
      { kind: "intent", intent: "collect_dates" },
      fullGuestCtx,
    );

    expect(result.next).toBe("CONFIRMED");
  });

  it("CONFIRMED jest terminalny — payment_confirmed nic nie zmienia", () => {
    const result = transition(
      "CONFIRMED",
      { kind: "payment_confirmed" },
      fullGuestCtx,
    );

    expect(result.next).toBe("CONFIRMED");
  });

  it("HUMAN_HANDOFF jest terminalny — intent greet nic nie zmienia", () => {
    const result = transition(
      "HUMAN_HANDOFF",
      { kind: "intent", intent: "greet" },
      emptyCtx,
    );

    expect(result.next).toBe("HUMAN_HANDOFF");
  });

  it("HUMAN_HANDOFF jest terminalny — handoff_request nic nie zmienia", () => {
    const result = transition(
      "HUMAN_HANDOFF",
      { kind: "intent", intent: "handoff_request" },
      emptyCtx,
    );

    expect(result.next).toBe("HUMAN_HANDOFF");
  });

  it("CONFIRMED jest terminalny — collect_dates nic nie zmienia", () => {
    const result = transition(
      "CONFIRMED",
      { kind: "intent", intent: "collect_dates" },
      fullGuestCtx,
    );

    expect(result.next).toBe("CONFIRMED");
  });

  it("CONFIRMED jest terminalny — payment_confirmed nic nie zmienia", () => {
    const result = transition(
      "CONFIRMED",
      { kind: "payment_confirmed" },
      fullGuestCtx,
    );

    expect(result.next).toBe("CONFIRMED");
  });
});
