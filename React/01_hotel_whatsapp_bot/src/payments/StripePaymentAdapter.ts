import {
  CheckoutLink,
  CreateCheckoutLinkInput,
  PaymentPort,
} from "./PaymentPort";
import { StripeService } from "./StripeService";

export function createStripePaymentAdapter(stripe: StripeService): PaymentPort {
  return {
    async createCheckoutLink(
      input: CreateCheckoutLinkInput,
    ): Promise<CheckoutLink> {
      return stripe.createCheckoutSession(input);
    },
  };
}
