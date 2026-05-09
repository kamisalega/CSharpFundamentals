import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FlowConversationEngine,
  TransitionContext,
} from "./FlowConversationEngine";
import {
  resetTestDb,
  seedTestRoom,
  testPrisma,
} from "../../tests/helpers/testDb";
import { interpretEffects } from "./EffectInterpreter";
import { FlowState } from "./FlowState";

const engine = new FlowConversationEngine();

const NOW = new Date("2026-06-01T10:00:00.000Z");
const CHECK_IN = new Date("2026-06-10T00:00:00.000Z");
const CHECK_OUT = new Date("2026-06-14T00:00:00.000Z");

function makeCtx(
  overrides: Partial<TransitionContext> = {},
): TransitionContext {
  return {
    conversationId: "conv-1",
    phone: "whatsapp:+48123456789",
    locale: "fr",
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
    ...overrides,
  };
}

function makePorts() {
  return {
    messaging: {
      sendTemplate: vi.fn().mockResolvedValue({ messageId: "msg-1" }),
      sendFlow: vi.fn().mockResolvedValue({ messageId: "msg-2" }),
      sendText: vi.fn().mockResolvedValue({ messageId: "msg-3" }),
    },
    pms: {
      searchAvailability: vi.fn().mockResolvedValue([]),
      holdReservation: vi.fn(),
      getReservation: vi.fn(),
      cancelReservation: vi.fn(),
    },
    payments: {
      createCheckoutLink: vi.fn().mockResolvedValue({
        url: "https://pay.example.com/cs_test",
        sessionId: "cs_test",
      }),
    },
    email: {
      sendBookingConfirmation: vi.fn().mockResolvedValue(undefined),
    },
    prisma: testPrisma,
    now: () => new Date("2026-06-01T10:00:00Z"),
  };
}

beforeEach(async () => {
  await resetTestDb();
  vi.clearAllMocks();
});

afterAll(() => testPrisma.$disconnect);

describe("interpretEffects — persistFlowState", () => {
  it("commits flowState to DB", async () => {
    const conv = await testPrisma.conversation.create({
      data: { phone: "+48111", channel: "TWILIO" },
    });
    const ctx = makeCtx({ conversationId: conv.id });

    await interpretEffects(
      [
        {
          kind: "persistFlowState",
          conversationId: conv.id,
          nextState: FlowState.MENU_SHOWN,
        },
      ],
      FlowState.MENU_SHOWN,
      ctx,
      engine,
      makePorts(),
    );

    const updated = await testPrisma.conversation.findUniqueOrThrow({
      where: { id: conv.id },
    });
    expect(updated.flowState).toBe("MENU_SHOWN");
  });

  it("commits flowToken when provided", async () => {
    const conv = await testPrisma.conversation.create({
      data: { phone: "+48112", channel: "TWILIO" },
    });
    const ctx = makeCtx({ conversationId: conv.id });

    await interpretEffects(
      [
        {
          kind: "persistFlowState",
          conversationId: conv.id,
          nextState: FlowState.AWAITING_DATES,
          flowToken: "tok-abc",
        },
      ],
      FlowState.AWAITING_DATES,
      ctx,
      engine,
      makePorts(),
    );

    const updated = await testPrisma.conversation.findUniqueOrThrow({
      where: { id: conv.id },
    });
    expect(updated.flowToken).toBe("tok-abc");
  });

  it("multiple persistFlowState effects → single DB write, last state wins", async () => {
    const conv = await testPrisma.conversation.create({
      data: { phone: "+48113", channel: "TWILIO" },
    });
    const ctx = makeCtx({ conversationId: conv.id });

    await interpretEffects(
      [
        {
          kind: "persistFlowState",
          conversationId: conv.id,
          nextState: FlowState.PAYMENT_PENDING,
        },
        {
          kind: "persistFlowState",
          conversationId: conv.id,
          nextState: FlowState.PAYMENT_PENDING,
          mergedSlots: { reservationId: "res-1", totalAmount: 42000 },
        },
      ],
      FlowState.PAYMENT_PENDING,
      ctx,
      engine,
      makePorts(),
    );

    const updated = await testPrisma.conversation.findUniqueOrThrow({
      where: { id: conv.id },
    });
    expect(updated.flowState).toBe("PAYMENT_PENDING");
    const slots = JSON.parse(updated.flowSlots!);
    expect(slots.reservationId).toBe("res-1");
    expect(slots.totalAmount).toBe(42000);
  });
});

describe("interpretEffects — messaging", () => {
  it("sendListPicker calls messaging.sendTemplate with correct SID", async () => {
    const conv = await testPrisma.conversation.create({
      data: { phone: "+48221", channel: "TWILIO" },
    });
    const ports = makePorts();
    const ctx = makeCtx({ conversationId: conv.id });

    await interpretEffects(
      [
        {
          kind: "sendListPicker",
          to: ctx.phone,
          templateSid: "HX_welcome",
          variables: {},
        },
        {
          kind: "persistFlowState",
          conversationId: conv.id,
          nextState: FlowState.MENU_SHOWN,
        },
      ],
      FlowState.MENU_SHOWN,
      ctx,
      engine,
      ports,
    );

    expect(ports.messaging.sendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ to: ctx.phone, templateSid: "HX_welcome" }),
    );
  });

  it("sendFlow calls messaging.sendFlow with flowId and flowToken", async () => {
    const conv = await testPrisma.conversation.create({
      data: { phone: "+48222", channel: "TWILIO" },
    });
    const ports = makePorts();
    const ctx = makeCtx({ conversationId: conv.id });

    await interpretEffects(
      [
        {
          kind: "sendFlow",
          to: ctx.phone,
          flowId: "FLOW_DATES",
          flowToken: "tok-xyz",
          cta: "Choisir les dates",
          templateSid: "HX_dates",
        },
        {
          kind: "persistFlowState",
          conversationId: conv.id,
          nextState: FlowState.AWAITING_DATES,
          flowToken: "tok-xyz",
        },
      ],
      FlowState.AWAITING_DATES,
      ctx,
      engine,
      ports,
    );

    expect(ports.messaging.sendFlow).toHaveBeenCalledWith(
      expect.objectContaining({ flowId: "FLOW_DATES", flowToken: "tok-xyz" }),
    );
  });
});

describe("interpretEffects — holdReservation", () => {
  it("success → reservationHeld → createPaymentLink called → sendCtaButton enqueued", async () => {
    const room = await seedTestRoom({ from: CHECK_IN, days: 4 });
    const conv = await testPrisma.conversation.create({
      data: { phone: "+48331", channel: "TWILIO" },
    });

    const reservation = await testPrisma.reservation.create({
      data: {
        code: "RES-001",
        conversationId: conv.id,
        roomId: room.id,
        checkIn: CHECK_IN,
        checkOut: CHECK_OUT,
        adults: 2,
        children: 0,
        guestName: "Jean Dupont",
        guestEmail: "jean@example.com",
        guestPhone: "+33612345678",
        total: 42000,
        status: "HELD",
      },
    });

    const ports = makePorts();
    ports.pms.holdReservation.mockResolvedValue(reservation);

    const richCtx = makeCtx({
      conversationId: conv.id,
      slots: {
        selectedRoomId: room.id,
        checkIn: CHECK_IN,
        checkOut: CHECK_OUT,
        guests: { adults: 2, children: 0 },
        breakfast: false,
        guestName: "Jean Dupont",
        guestEmail: "jean@example.com",
        guestPhone: "+33612345678",
      },
    });

    const { effects } = engine.dispatch(
      FlowState.RECAP_SHOWN,
      { kind: "menuSelection", selectionId: "confirm_booking" },
      richCtx,
    );

    await interpretEffects(
      effects,
      FlowState.PAYMENT_PENDING,
      richCtx,
      engine,
      ports,
    );

    expect(ports.pms.holdReservation).toHaveBeenCalled();
    expect(ports.payments.createCheckoutLink).toHaveBeenCalledWith(
      expect.objectContaining({
        reservation: expect.objectContaining({ id: reservation.id }),
      }),
    );
    expect(ports.messaging.sendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        templateSid: "HX_paycta",
        variables: expect.objectContaining({
          url: "https://pay.example.com/cs_test",
        }),
      }),
    );

    const updated = await testPrisma.conversation.findUniqueOrThrow({
      where: { id: conv.id },
    });
    expect(updated.flowState).toBe("PAYMENT_PENDING");
  });

  it("failure → FAILED in DB, no payment link created", async () => {
    const conv = await testPrisma.conversation.create({
      data: { phone: "+48332", channel: "TWILIO" },
    });
    const ports = makePorts();
    ports.pms.holdReservation.mockRejectedValue(new Error("room unavailable"));

    const richCtx = makeCtx({
      conversationId: conv.id,
      slots: {
        selectedRoomId: "room-x",
        checkIn: CHECK_IN,
        checkOut: CHECK_OUT,
        guests: { adults: 2, children: 0 },
        breakfast: false,
        guestName: "Jean",
        guestEmail: "j@e.com",
        guestPhone: "+33612",
      },
    });

    const { effects } = engine.dispatch(
      FlowState.RECAP_SHOWN,
      { kind: "menuSelection", selectionId: "confirm_booking" },
      richCtx,
    );

    await interpretEffects(
      effects,
      FlowState.PAYMENT_PENDING,
      richCtx,
      engine,
      ports,
    );

    expect(ports.payments.createCheckoutLink).not.toHaveBeenCalled();

    const updated = await testPrisma.conversation.findUniqueOrThrow({
      where: { id: conv.id },
    });
    expect(updated.flowState).toBe("FAILED");
  });
});

describe("interpretEffects — searchAvailability", () => {
  it("stores rooms in flowSlots JSON", async () => {
    const conv = await testPrisma.conversation.create({
      data: { phone: "+48551", channel: "TWILIO" },
    });
    const ports = makePorts();
    const rooms = [
      {
        roomId: "r-1",
        roomName: "Deluxe",
        available: true,
        total: 42000,
        nights: [],
      },
    ];
    ports.pms.searchAvailability.mockResolvedValue(rooms);

    const ctx = makeCtx({ conversationId: conv.id });

    await interpretEffects(
      [
        {
          kind: "searchAvailability",
          checkIn: CHECK_IN,
          checkOut: CHECK_OUT,
          guests: { adults: 2, children: 0 },
        },
        {
          kind: "persistFlowState",
          conversationId: conv.id,
          nextState: FlowState.ROOM_LIST_SHOWN,
        },
      ],
      FlowState.ROOM_LIST_SHOWN,
      ctx,
      engine,
      ports,
    );

    const updated = await testPrisma.conversation.findUniqueOrThrow({
      where: { id: conv.id },
    });
    const slots = JSON.parse(updated.flowSlots!);
    expect(slots.availableRooms).toHaveLength(1);
    expect(slots.availableRooms[0].roomId).toBe("r-1");
  });

  it("empty availability stores empty array in flowSlots", async () => {
    const conv = await testPrisma.conversation.create({
      data: { phone: "+48552", channel: "TWILIO" },
    });
    const ports = makePorts();
    ports.pms.searchAvailability.mockResolvedValue([]);

    const ctx = makeCtx({ conversationId: conv.id });

    await interpretEffects(
      [
        {
          kind: "searchAvailability",
          checkIn: CHECK_IN,
          checkOut: CHECK_OUT,
          guests: { adults: 2, children: 0 },
        },
        {
          kind: "persistFlowState",
          conversationId: conv.id,
          nextState: FlowState.ROOM_LIST_SHOWN,
        },
      ],
      FlowState.ROOM_LIST_SHOWN,
      ctx,
      engine,
      ports,
    );

    const updated = await testPrisma.conversation.findUniqueOrThrow({
      where: { id: conv.id },
    });
    const slots = JSON.parse(updated.flowSlots!);
    expect(slots.availableRooms).toEqual([]);
  });
});
