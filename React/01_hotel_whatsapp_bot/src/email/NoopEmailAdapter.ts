import { logger } from "@/logging/logger";
import { EmailPort, SendBookingConfirmationInput } from "./EmailPort";

export function createNoopEmailAdapter(): EmailPort {
  return {
    async sendBookingConfirmation(
      input: SendBookingConfirmationInput,
    ): Promise<void> {
      logger.info({
        event: "email.send.noop",
        reservationId: input.reservation.id,
        reservationCode: input.reservation.code,
        locale: input.locale,
      });
    },
  };
}
