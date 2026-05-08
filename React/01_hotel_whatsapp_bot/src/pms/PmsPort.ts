import type { Reservation } from "@prisma/client";

export type AvailableRoom = Readonly<{
  roomId: string;
  roomName: string;
  available: boolean;
  total: number;
  nights: readonly Date[];
}>;

export type SearchAvailabilityInput = Readonly<{
  checkIn: Date;
  checkOut: Date;
  guests: { adults: number; children: number };
  now: Date;
}>;

export type HoldReservationInput = Readonly<{
  conversationId: string;
  roomId: string;
  checkIn: Date;
  checkOut: Date;
  guests: { adults: number; children: number };
  breakfast: boolean;
  guest: Readonly<{ name: string; email: string; phone: string }>;
  now: Date;
}>;

export type PmsPort = Readonly<{
  searchAvailability(input: SearchAvailabilityInput): Promise<AvailableRoom[]>;
  holdReservation(input: HoldReservationInput): Promise<Reservation>;
  getReservation(id: string): Promise<Reservation | null>;
  cancelReservation(code: string): Promise<Reservation>;
}>;
