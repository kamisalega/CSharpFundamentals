import { BookingService } from "@/booking/BookingService";
import { PrismaClient } from "@prisma/client";
import {
  AvailableRoom,
  HoldReservationInput,
  PmsPort,
  SearchAvailabilityInput,
} from "./PmsPort";

export function createBookingServicePmsAdapter(
  booking: BookingService,
  prisma: PrismaClient,
): PmsPort {
  async function searchAvailability(
    input: SearchAvailabilityInput,
  ): Promise<AvailableRoom[]> {
    const rooms = await prisma.room.findMany({
      select: { id: true, name: true },
    });
    const results: AvailableRoom[] = [];
    for (const room of rooms) {
      const quote = await booking.quote({
        roomId: room.id,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        guests: input.guests,
        breakfast: false,
        now: input.now,
      });
      results.push({
        roomId: room.id,
        roomName: room.name,
        available: quote.available,
        total: quote.total,
        nights: quote.nights,
      });
    }
    return results;
  }

  return {
    searchAvailability,
    holdReservation: (input: HoldReservationInput) => booking.hold(input),
    getReservation: (id: string) =>
      prisma.reservation.findUnique({ where: { id } }),
    cancelReservation: (code: string) => booking.cancel(code),
  };
}
