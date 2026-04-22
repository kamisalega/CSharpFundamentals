import { describe, expect, it } from "vitest";
import { calculateTotal } from "./pricing";

describe("pricing.calculateTotal", () => {
  it("counts 3 nights of 120€ without breakfast = 360€", () => {
    const total = calculateTotal({
      nightlyPrices: [1200, 1200, 1200],
      guests: { adults: 2, children: 0 },
      breakfast: false,
    });
    expect(total).toBe(3600);
  });

  it("Adds breakfast 12€/person/day for 2 adults for 3 nights", () => {
    const total = calculateTotal({
      nightlyPrices: [1200, 1200, 1200],
      guests: { adults: 2, children: 0 },
      breakfast: true,
    });
    expect(total).toBe(10800);
  });

  it("counts children the same way as adults for breakfast", () => {
    const total = calculateTotal({
      nightlyPrices: [10000],
      guests: { adults: 2, children: 1 },
      breakfast: true,
    });
    expect(total).toBe(13600);
  });

  it("takes into account different prices night by night (weekends are more expensive)", () => {
    const total = calculateTotal({
      nightlyPrices: [10000, 10000, 12000, 12000],
      guests: { adults: 2, children: 0 },
      breakfast: false,
    });
    expect(total).toBe(44000);
  });

  it("throws when the night list is empty", () => {
    expect(() =>
      calculateTotal({
        nightlyPrices: [],
        guests: { adults: 2, children: 0 },
        breakfast: false,
      }),
    ).toThrow(/empty/i);
  });

  it("throws at zero adults", () => {
    expect(() =>
      calculateTotal({
        nightlyPrices: [10000],
        guests: { adults: 0, children: 0 },
        breakfast: false,
      }),
    ).toThrow(/adult/i);
  });
  it("throws at zero adults", () => {
    expect(() =>
      calculateTotal({
        nightlyPrices: [10000],
        guests: { adults: 0, children: 0 },
        breakfast: false,
      }),
    ).toThrow(/adult/i);
  });

  it("throws at negative night price", () => {
    expect(() =>
      calculateTotal({
        nightlyPrices: [-100],
        guests: { adults: 2, children: 0 },
        breakfast: false,
      }),
    ).toThrow(/non-negative/i);
  });
});
