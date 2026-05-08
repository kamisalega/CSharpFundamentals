import { Reservation } from "@prisma/client";

export type CreateCheckoutLinkInput = Readonly<{
  reservation: Reservation;
  now: Date;
}>;

export type CheckoutLink = Readonly<{
  url: string;
  sessionId: string;
}>;

export type PaymentPort = Readonly<{
  createCheckoutLink(input: CreateCheckoutLinkInput): Promise<CheckoutLink>;
}>;
