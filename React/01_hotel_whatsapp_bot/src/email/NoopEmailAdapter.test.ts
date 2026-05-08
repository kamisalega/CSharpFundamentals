import { Reservation } from "@prisma/client";
import { createNoopEmailAdapter } from "./NoopEmailAdapter";
import { describe, expect, it } from "vitest";

const RESERVATION: Reservation = {
  id: "res-1",
  code: "RES-ABCDE",
  conversationId: "conv-1",
  roomId: "room-1",
  checkIn: new Date("2026-08-12T00:00:00.000Z"),
  checkOut: new Date("2026-08-15T00:00:00.000Z"),
  adults: 2,
  children: 0,
  guestName: "Marie Dupont",
  guestEmail: "marie@example.com",
  guestPhone: "+33611111111",
  total: 36000,
  status: "PENDING",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("NoopEmailAdapter", () => {
  it("resolves without throwing", async () => {
    const adapter = createNoopEmailAdapter();
    await expect(
      adapter.sendBookingConfirmation({
        reservation: RESERVATION,
        locale: "fr",
      }),
    ).resolves.toBeUndefined();
  });
});
