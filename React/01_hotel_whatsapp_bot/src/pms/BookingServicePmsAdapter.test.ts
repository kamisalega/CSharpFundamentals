import { BookingService } from "@/booking/BookingService";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  resetTestDb,
  seedTestRoom,
  testPrisma,
} from "../../tests/helpers/testDb";
import { createBookingServicePmsAdapter } from "./BookingServicePmsAdapter";

const NOW = new Date("2026-08-01T00:00:00.000Z");
const CHECK_IN = new Date("2026-08-12T00:00:00.000Z");
const CHECK_OUT = new Date("2026-08-15T00:00:00.000Z");

describe("BookingServicePmsAdapter", () => {
  let booking: BookingService;

  beforeEach(async () => {
    await resetTestDb();
    booking = new BookingService(testPrisma);
  });

  afterAll(() => testPrisma.$disconnect);

  it("searchAvailability returns available rooms with correct total", async () => {
    await seedTestRoom({ basePrice: 12000, from: CHECK_IN, days: 3 });
    const adapter = createBookingServicePmsAdapter(booking, testPrisma);
    const rooms = await adapter.searchAvailability({
      checkIn: CHECK_IN,
      checkOut: CHECK_OUT,
      guests: { adults: 2, children: 0 },
      now: NOW,
    });

    expect(rooms).toHaveLength(1);
    expect(rooms[0]!.available).toBe(true);
    expect(rooms[0]!.total).toBe(36000);
  });

  it("searchAvailability returns available: false when room is unavailable", async () => {
    await seedTestRoom({ basePrice: 12000, from: CHECK_IN, days: 3 });
    const adapter = createBookingServicePmsAdapter(booking, testPrisma);

    const rooms = await adapter.searchAvailability({
      checkIn: new Date("2026-09-01T00:00:00.000Z"),
      checkOut: new Date("2026-09-03T00:00:00.000Z"),
      guests: { adults: 1, children: 0 },
      now: NOW,
    });

    expect(rooms[0]!.available).toBe(false);
  });

  it("getReservation returns null for unknown id", async () => {
    const adapter = createBookingServicePmsAdapter(booking, testPrisma);
    const result = await adapter.getReservation("non-existent-id");
    expect(result).toBeNull();
  });
});
