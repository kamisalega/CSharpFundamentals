const BREAKFAST_PRICE_CENTS = 1200;

export type Guests = Readonly<{
  adults: number;
  children: number;
}>;

export type PricingInput = Readonly<{
  nightlyPrices: readonly number[];
  guests: Guests;
  breakfast: boolean;
}>;

export function calculateTotal(input: PricingInput): number {
  const { nightlyPrices, guests, breakfast } = input;

  if (nightlyPrices.length === 0) {
    throw new Error("nightlyPrices must not be empty");
  }

  if (guests.adults < 1) {
    throw new Error("at least one adult required");
  }

  if (nightlyPrices.some((p) => p < 0)) {
    throw new Error("nightlyPrices must be non-negative");
  }

  const nightsTotal = nightlyPrices.reduce((sum, p) => sum + p, 0);

  if (!breakfast) {
    return nightsTotal;
  }

  const guestCount = guests.adults + guests.children;
  const breakfastTotal =
    BREAKFAST_PRICE_CENTS * guestCount * nightlyPrices.length;
  return nightsTotal + breakfastTotal;
}
