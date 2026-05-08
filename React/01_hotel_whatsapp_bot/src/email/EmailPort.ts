import { Reservation } from "@prisma/client";

export type SendBookingConfirmationInput = Readonly<{
  reservation: Reservation;
  locale: string;
}>;

export type EmailPort = Readonly<{
  sendBookingConfirmation(input: SendBookingConfirmationInput): Promise<void>;
}>;
