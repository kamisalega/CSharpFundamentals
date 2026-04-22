import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  resetTestDb,
  seedTestRoom,
  testPrisma,
} from "../../tests/helpers/testDb";
import { BookingService } from "./BookingService";

describe("BookingService.quote", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("returns the price of 3 nights at €120 = €360 for a free room", async () => {
    const room = await seedTestRoom({
      basePrice: 12000,
      from: new Date("2026-08-12"),
      days: 60,
    });

    const service = new BookingService(testPrisma);
    const quote = await service.quote({
      roomId: room.id,
      checkIn: new Date("2026-08-12"),
      checkOut: new Date("2026-08-15"),
      guests: { adults: 2, children: 0 },
      breakfast: false,
      now: new Date("2026-08-01"),
    });

    expect(quote.total).toBe(36000);
    expect(quote.nights).toHaveLength(3);
    expect(quote.available).toBe(true);
  });

  it("includes breakfast in the price", async () => {
    const room = await seedTestRoom({
      basePrice: 12000,
      from: new Date("2026-08-12"),
      days: 60,
    });

    const service = new BookingService(testPrisma);
    const quote = await service.quote({
      roomId: room.id,
      checkIn: new Date("2026-08-12"),
      checkOut: new Date("2026-08-15"),
      guests: { adults: 2, children: 0 },
      breakfast: true,
      now: new Date("2026-08-01"),
    });

    expect(quote.total).toBe(43200);
  });

  it("reports unavailability when a night is already booked", async () => {
    const room = await seedTestRoom({
      basePrice: 12000,
      from: new Date("2026-08-12"),
      days: 60,
    });

    const conv = await testPrisma.conversation.create({
      data: { phone: "+33600000000" },
    });

    const blocker = await testPrisma.reservation.create({
      data: {
        code: "RES-BLOCK",
        conversationId: conv.id,
        roomId: room.id,
        checkIn: new Date("2026-08-13"),
        checkOut: new Date("2026-08-14"),
        adults: 2,
        children: 0,
        guestName: "Blocker",
        guestEmail: "b@b.com",
        guestPhone: "+33600000000",
        total: 12000,
        status: "PENDING",
      },
    });

    await testPrisma.roomNight.create({
      data: {
        roomId: room.id,
        date: new Date("2026-08-13"),
        reservationId: blocker.id,
      },
    });

    const service = new BookingService(testPrisma);
    const quote = await service.quote({
      roomId: room.id,
      checkIn: new Date("2026-08-12"),
      checkOut: new Date("2026-08-15"),
      guests: { adults: 2, children: 0 },
      breakfast: true,
      now: new Date("2026-08-01"),
    });

    expect(quote.available).toBe(false);
  });

  it("throws for an unknown room", async () => {
    const service = new BookingService(testPrisma);

    await expect(
      service.quote({
        roomId: "non-existent",
        checkIn: new Date("2026-08-12"),
        checkOut: new Date("2026-08-15"),
        guests: { adults: 2, children: 0 },
        breakfast: false,
        now: new Date("2026-08-01"),
      }),
    ).rejects.toThrow(/not found/i);
  });

  it("delegates date validation to validateStay (past → throw)", async () => {
    const room = await seedTestRoom({
      from: new Date("2026-08-12"),
      days: 60,
    });
    const service = new BookingService(testPrisma);

    await expect(
      service.quote({
        roomId: room.id,
        checkIn: new Date("2026-07-30"),
        checkOut: new Date("2026-08-02"),
        guests: { adults: 2, children: 0 },
        breakfast: false,
        now: new Date("2026-08-01"),
      }),
    ).rejects.toThrow(/past/i);
  });
});

describe("BookingService.hold", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  async function makeConv(phone = "+33611111111") {
    return testPrisma.conversation.create({ data: { phone } });
  }

  it("creates a PENDING + 3 RoomNight reservation for 3 nights", async () => {
    const room = await seedTestRoom({
      from: new Date("2026-08-12"),
      days: 60,
    });

    const conv = await makeConv();

    const service = new BookingService(testPrisma);
    const reservation = await service.hold({
      conversationId: conv.id,
      roomId: room.id,
      checkIn: new Date("2026-08-12"),
      checkOut: new Date("2026-08-15"),
      guests: { adults: 2, children: 0 },
      breakfast: false,
      guest: {
        name: "Marie Dupont",
        email: "marie@example.com",
        phone: "+33611111111",
      },
      now: new Date("2026-08-01"),
    });

    expect(reservation.status).toBe("PENDING");
    expect(reservation.code).toMatch(/^RES-[A-Z0-9]{5}$/);
    expect(reservation.total).toBe(36000);

    const nights = await testPrisma.roomNight.findMany({
      where: { reservationId: reservation.id },
    });

    expect(nights).toHaveLength(3);
  });

  it("blocks double-booking - a second hold on overlapping dates throws", async () => {
    const room = await seedTestRoom({
      from: new Date("2026-08-12"),
      days: 60,
    });

    const c1 = await makeConv("+33611111111");
    const c2 = await makeConv("+33622222222");

    const service = new BookingService(testPrisma);
    await service.hold({
      conversationId: c1.id,
      roomId: room.id,
      checkIn: new Date("2026-08-12"),
      checkOut: new Date("2026-08-15"),
      guests: { adults: 2, children: 0 },
      breakfast: false,
      guest: {
        name: "A",
        email: "a@a.com",
        phone: "+33611111111",
      },
      now: new Date("2026-08-01"),
    });

    await expect(
      service.hold({
        conversationId: c2.id,
        roomId: room.id,
        checkIn: new Date("2026-08-13"),
        checkOut: new Date("2026-08-16"),
        guests: { adults: 1, children: 0 },
        breakfast: false,
        guest: { name: "B", email: "b@b.com", phone: "+33622222222" },
        now: new Date("2026-08-01"),
      }),
    ).rejects.toThrow(/not available/i);
  });

  it("throws for a date in the past (delegate to validateStay)", async () => {
    const room = await seedTestRoom({
      from: new Date("2026-08-12"),
      days: 60,
    });
    const conv = await makeConv();
    const service = new BookingService(testPrisma);

    await expect(
      service.hold({
        conversationId: conv.id,
        roomId: room.id,
        checkIn: new Date("2026-07-30"),
        checkOut: new Date("2026-08-02"),
        guests: { adults: 2, children: 0 },
        breakfast: false,
        guest: { name: "M", email: "m@m.com", phone: "+33611111111" },
        now: new Date("2026-08-01"),
      }),
    ).rejects.toThrow(/past/i);
  });

  it("generates unique codes between reservations", async () => {
    const room = await seedTestRoom({
      from: new Date("2026-08-12"),
      days: 60,
    });
    const conv = await makeConv();
    const service = new BookingService(testPrisma);

    const r1 = await service.hold({
      conversationId: conv.id,
      roomId: room.id,
      checkIn: new Date("2026-08-12"),
      checkOut: new Date("2026-08-13"),
      guests: { adults: 1, children: 0 },
      breakfast: false,
      guest: { name: "A", email: "a@a.com", phone: "+33611111111" },
      now: new Date("2026-08-01"),
    });
    const r2 = await service.hold({
      conversationId: conv.id,
      roomId: room.id,
      checkIn: new Date("2026-08-14"),
      checkOut: new Date("2026-08-15"),
      guests: { adults: 1, children: 0 },
      breakfast: false,
      guest: { name: "A", email: "a@a.com", phone: "+33611111111" },
      now: new Date("2026-08-01"),
    });

    expect(r1.code).not.toBe(r2.code);
  });
});

describe("BookService.confirm", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  async function makeConv(phone = "+33611111111") {
    return testPrisma.conversation.create({ data: { phone } });
  }

  async function holdReservation() {
    const room = await seedTestRoom({
      from: new Date("2026-08-12"),
      days: 60,
    });
    const conv = await makeConv();
    const service = new BookingService(testPrisma);
    const reservation = await service.hold({
      conversationId: conv.id,
      roomId: room.id,
      checkIn: new Date("2026-08-12"),
      checkOut: new Date("2026-08-15"),
      guests: { adults: 2, children: 0 },
      breakfast: false,
      guest: {
        name: "Marie",
        email: "m@m.com",
        phone: "+33611111111",
      },
      now: new Date("2026-08-01"),
    });
    return { service, reservation, room };
  }

  it("transitions PENDING → CONFIRMED for a valid code", async () => {
    const { service, reservation } = await holdReservation();
    const confirmed = await service.confirm(reservation.code);

    expect(confirmed.status).toBe("CONFIRMED");
    expect(confirmed.id).toBe(reservation.id);
  });

  it("is idempotent - confirming twice returns the same reservation", async () => {
    const { service, reservation } = await holdReservation();

    const first = await service.confirm(reservation.code);
    const second = await service.confirm(reservation.code);

    expect(second.id).toBe(first.id);
    expect(second.status).toBe("CONFIRMED");

    const all = await testPrisma.reservation.findMany({
      where: { code: reservation.code },
    });

    expect(all).toHaveLength(1);
  });
});

describe("BookService.cancel", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  async function makeConv(phone = "+33611111111") {
    return testPrisma.conversation.create({ data: { phone } });
  }

  async function holdReservation(phone = "+33611111111") {
    const room = await seedTestRoom({
      from: new Date("2026-08-12"),
      days: 60,
    });
    const conv = await makeConv(phone);
    const service = new BookingService(testPrisma);
    const reservation = await service.hold({
      conversationId: conv.id,
      roomId: room.id,
      checkIn: new Date("2026-08-12"),
      checkOut: new Date("2026-08-15"),
      guests: { adults: 2, children: 0 },
      breakfast: false,
      guest: { name: "A", email: "a@a.com", phone },
      now: new Date("2026-08-01"),
    });
    return { service, reservation, room };
  }

  it("releases dates - another guest can hold the same nights after cancel", async () => {
    const { service, reservation, room } =
      await holdReservation("+33611111111");
    const c2 = await makeConv("+33622222222");
    await service.cancel(reservation.code);
    const cancelled = await testPrisma.reservation.findUniqueOrThrow({
      where: { code: reservation.code },
    });

    expect(cancelled.status).toBe("CANCELLED");

    const releasedNights = await testPrisma.roomNight.findMany({
      where: { reservationId: reservation.id },
    });

    expect(releasedNights).toHaveLength(0);

    const second = await service.hold({
      conversationId: c2.id,
      roomId: room.id,
      checkIn: new Date("2026-08-12"),
      checkOut: new Date("2026-08-15"),
      guests: { adults: 2, children: 0 },
      breakfast: false,
      guest: { name: "B", email: "b@b.com", phone: "+33622222222" },
      now: new Date("2026-08-01"),
    });

    expect(second.status).toBe("PENDING");
  });

  it("is idempotent - cancelling twice is safe", async () => {
    const { service, reservation } = await holdReservation();

    const first = await service.cancel(reservation.code);
    const second = await service.cancel(reservation.code);

    expect(second.id).toBe(first.id);
    expect(second.status).toBe("CANCELLED");
  });
});
