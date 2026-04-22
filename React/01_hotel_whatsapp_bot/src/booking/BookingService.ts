import { Prisma, PrismaClient, Reservation } from "@prisma/client";
import { eachNightBetween, validateStay } from "./availability";
import { calculateTotal } from "./pricing";
import { randomBytes } from "crypto";

const RESERVATION_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateReservationCode(): string {
  const bytes = randomBytes(5);
  let code = "";
  for (let i = 0; i < 5; i++) {
    const byte = bytes[i] ?? 0;
    code += RESERVATION_CODE_CHARS[byte % RESERVATION_CODE_CHARS.length];
  }
  return `RES-${code}`;
}

export type QuoteInput = Readonly<{
  roomId: string;
  checkIn: Date;
  checkOut: Date;
  guests: { adults: number; children: number };
  breakfast: boolean;
  now: Date;
}>;

export type Quote = Readonly<{
  roomId: string;
  nights: readonly Date[];
  nightlyPrices: readonly number[];
  total: number;
  available: boolean;
}>;

export type HoldInput = Readonly<{
  conversationId: string;
  roomId: string;
  checkIn: Date;
  checkOut: Date;
  guests: { adults: number; children: number };
  breakfast: boolean;
  guest: Readonly<{ name: string; email: string; phone: string }>;
  now: Date;
}>;

export class BookingService {
  constructor(private readonly prisma: PrismaClient) {}

  async quote(input: QuoteInput): Promise<Quote> {
    validateStay(input);
    const room = await this.prisma.room.findUnique({
      where: { id: input.roomId },
    });
    if (!room) {
      throw new Error(`Room ${input.roomId} not found`);
    }
    const nights = eachNightBetween(input.checkIn, input.checkOut);
    const ratePlans = await this.prisma.ratePlan.findMany({
      where: { roomId: input.roomId, date: { in: [...nights] } },
    });

    const priceByDate = new Map<number, number>();

    for (const rp of ratePlans) {
      priceByDate.set(rp.date.getTime(), rp.price);
    }
    const nightlyPrices: number[] = [];
    for (const n of nights) {
      const price = priceByDate.get(n.getTime());
      if (price === undefined) {
        return {
          roomId: input.roomId,
          nights,
          nightlyPrices: [],
          total: 0,
          available: false,
        };
      }
      nightlyPrices.push(price);
    }

    const bookedNights = await this.prisma.roomNight.findMany({
      where: { roomId: input.roomId, date: { in: [...nights] } },
    });

    const available = bookedNights.length === 0;

    const total = available
      ? calculateTotal({
          nightlyPrices,
          guests: input.guests,
          breakfast: input.breakfast,
        })
      : 0;

    return { roomId: input.roomId, nights, nightlyPrices, total, available };
  }

  async hold(input: HoldInput): Promise<Reservation> {
    const quote = await this.quote({
      roomId: input.roomId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guests: input.guests,
      breakfast: input.breakfast,
      now: input.now,
    });

    if (!quote.available) {
      throw new Error("Room not available");
    }

    const code = generateReservationCode();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const reservation = await tx.reservation.create({
          data: {
            code,
            conversationId: input.conversationId,
            roomId: input.roomId,
            checkIn: input.checkIn,
            checkOut: input.checkOut,
            adults: input.guests.adults,
            children: input.guests.children,
            guestName: input.guest.name,
            guestEmail: input.guest.email,
            guestPhone: input.guest.phone,
            total: quote.total,
            status: "PENDING",
          },
        });

        await tx.roomNight.createMany({
          data: quote.nights.map((date) => ({
            roomId: input.roomId,
            date,
            reservationId: reservation.id,
          })),
        });
        return reservation;
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new Error("Room not available - already booked");
      }
      throw e;
    }
  }

  async confirm(code: string): Promise<Reservation> {
    return this.prisma.reservation.update({
      where: { code },
      data: { status: "CONFIRMED" },
    });
  }

  async cancel(code: string): Promise<Reservation> {
    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.update({
        where: { code },
        data: { status: "CANCELLED" },
      });

      await tx.roomNight.deleteMany({
        where: { reservationId: reservation.id },
      });

      return reservation;
    
    });
  }
}
