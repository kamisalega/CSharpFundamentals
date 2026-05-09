import { describe, expect, it } from "vitest";
import { transition, TransitionContext } from "./transitions";
import { FlowState } from "./FlowState";
import { Effect } from "./Effect";

const ctx: TransitionContext = {
  conversationId: "conv-1",
  phone: "whatsapp:+48123456789",
  slots: {},
  templateSids: {
    welcomeMenu: "HX_welcome",
    datePickerFlow: "HX_dates",
    guestsPickerFlow: "HX_guests",
    guestInfoFlow: "HX_guestinfo",
    roomDetailCard: "HX_roomcard",
    payCta: "HX_paycta",
    bookingConfirmed: "HX_confirmed",
  },
  flowIds: {
    datePicker: "FLOW_DATES",
    guestsPicker: "FLOW_GUESTS",
    guestInfo: "FLOW_GUESTINFO",
  },
};

describe("transition — BOOT", () => {
  it("inboundText → MENU_SHOWN + sendListPicker + persistFlowState", () => {
    const result = transition(
      FlowState.BOOT,
      { kind: "inboundText", text: "Bonjour" },
      ctx,
    );

    expect(result.next).toBe(FlowState.MENU_SHOWN);
    expect(result.effects).toHaveLength(2);

    expect(result.effects[0]?.kind).toBe("sendListPicker");
    expect(result.effects[1]?.kind).toBe("persistFlowState");
  });

  it("unknown event → stays BOOT, no effects", () => {
    const result = transition(FlowState.BOOT, { kind: "timeout" }, ctx);
    expect(result.next).toBe(FlowState.BOOT);
    expect(result.effects).toHaveLength(0);
  });
});

describe("transition — MENU_SHOWN", () => {
  it("menuSelection book_room → AWAITING_DATES + sendFlow", () => {
    const result = transition(
      FlowState.MENU_SHOWN,
      { kind: "menuSelection", selectionId: "book_room" },
      ctx,
    );
    expect(result.next).toBe(FlowState.AWAITING_DATES);
    const sendFlow = result.effects.find((e) => e.kind === "sendFlow");
    expect(sendFlow).toBeDefined();
    expect((sendFlow as any).flowId).toBe("FLOW_DATES");
  });

  it("timeout → FAILED", () => {
    const result = transition(FlowState.MENU_SHOWN, { kind: "timeout" }, ctx);
    expect(result.next).toBe(FlowState.FAILED);
  });

  it("unknown selection → stays MENU_SHOWN", () => {
    const result = transition(
      FlowState.MENU_SHOWN,
      { kind: "menuSelection", selectionId: "something_else" },
      ctx,
    );
    expect(result.next).toBe(FlowState.MENU_SHOWN);
  });
});

describe("transition — terminal states", () => {
  it.each([FlowState.CONFIRMED, FlowState.FAILED, FlowState.HUMAN_HANDOFF])(
    "%s ignores any event",
    (terminalState) => {
      const result = transition(
        terminalState,
        { kind: "inboundText", text: "hello" },
        ctx,
      );
      expect(result.next).toBe(terminalState);
      expect(result.effects).toHaveLength(0);
    },
  );
});

describe("transition — RECAP_SHOWN", () => {
  it("confirm_booking → PAYMENT_PENDING + holdReservation", () => {
    const richCtx: TransitionContext = {
      ...ctx,
      slots: {
        selectedRoomId: "room-42",
        checkIn: new Date("2026-06-01"),
        checkOut: new Date("2026-06-05"),
        guests: { adults: 2, children: 0 },
        breakfast: true,
        guestName: "Jean Dupont",
        guestEmail: "jean@example.com",
        guestPhone: "+33612345678",
      },
    };
    const result = transition(
      FlowState.RECAP_SHOWN,
      { kind: "menuSelection", selectionId: "confirm_booking" },
      richCtx,
    );
    expect(result.next).toBe(FlowState.PAYMENT_PENDING);
    const hold = result.effects.find((e) => e.kind === "holdReservation") as
      | Extract<Effect, { kind: "holdReservation" }>
      | undefined;
    expect(hold).toBeDefined();
    expect(hold!.roomId).toBe("room-42");
    expect(hold!.breakfast).toBe(true);
  });
});

describe("transition — PAYMENT_PENDING", () => {
  it("reservationHeld → stays PAYMENT_PENDING + createPaymentLink", () => {
    const result = transition(
      FlowState.PAYMENT_PENDING,
      { kind: "reservationHeld", reservationId: "res-1", total: 420 },
      ctx,
    );
    expect(result.next).toBe(FlowState.PAYMENT_PENDING);
    expect(
      result.effects.find((e) => e.kind === "createPaymentLink"),
    ).toBeDefined();
  });

  it("reservationFailed → FAILED", () => {});
});

describe("transition — PAYMENT_PENDING", () => {
  it("reservationHeld → stays PAYMENT_PENDING + createPaymentLink", () => {
    const result = transition(
      FlowState.PAYMENT_PENDING,
      { kind: "reservationHeld", reservationId: "res-1", total: 420 },
      ctx,
    );
    expect(result.next).toBe(FlowState.PAYMENT_PENDING);
    expect(
      result.effects.find((e) => e.kind === "createPaymentLink"),
    ).toBeDefined();
  });

  it("reservationFailed → FAILED", () => {
    const result = transition(
      FlowState.PAYMENT_PENDING,
      { kind: "reservationFailed", reason: "no availability" },
      ctx,
    );
    expect(result.next).toBe(FlowState.FAILED);
  });

  it("paymentFailed → HUMAN_HANDOFF", () => {
    const result = transition(
      FlowState.PAYMENT_PENDING,
      {
        kind: "paymentFailed",
        reservationCode: "RES-001",
        reason: "card declined",
      },
      ctx,
    );
    expect(result.next).toBe(FlowState.HUMAN_HANDOFF);
  });
});

describe("transition — PAID", () => {
  it("paymentSucceeded → CONFIRMED + sendTextTemplate + sendBookingConfirmEmail", () => {
    const result = transition(
      FlowState.PAID,
      { kind: "paymentSucceeded", reservationCode: "RES-001" },
      { ...ctx, slots: { reservationId: "res-1" } },
    );
    expect(result.next).toBe(FlowState.CONFIRMED);
    expect(
      result.effects.find((e) => e.kind === "sendTextTemplate"),
    ).toBeDefined();
    expect(
      result.effects.find((e) => e.kind === "sendBookingConfirmEmail"),
    ).toBeDefined();
  });
});
