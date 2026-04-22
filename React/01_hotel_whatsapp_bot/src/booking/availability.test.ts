import { describe, expect, it } from "vitest";
import { eachNightBetween, validateStay } from "./availability";

describe("eachNightBetween", () => {
  it("return 3 nights for August 12-15 (checkout on the 15th)", () => {
    const nights = eachNightBetween(
      new Date("2026-08-12"),
      new Date("2026-08-15"),
    );
    expect(nights).toEqual([
      new Date("2026-08-12"),
      new Date("2026-08-13"),
      new Date("2026-08-14"),
    ]);
  });

  it("return one night for a 1-day stay", () => {
    const nights = eachNightBetween(
      new Date("2026-08-12"),
      new Date("2026-08-13"),
    );
    expect(nights).toHaveLength(1);
    expect(nights).toEqual([new Date("2026-08-12")]);
  });

  it("normalizes dates to midnight UTC (ignores hours)", () => {
    const nights = eachNightBetween(
      new Date("2026-08-12T15:30:00Z"),
      new Date("2026-08-13T08:00:00Z"),
    );
    expect(nights).toHaveLength(1);
    expect(nights).toEqual([new Date("2026-08-12T00:00:00Z")]);
  });
});

describe("validateStay", () => {
  const now = new Date("2026-08-01T00:00:00Z");
  it("accepts a valid date range", () => {
    expect(() =>
      validateStay({
        checkIn: new Date("2026-08-12"),
        checkOut: new Date("2026-08-15"),
        now,
      }),
    ).not.toThrow();
  });

  it("throws when checkOut == checkIn", () => {
    expect(() =>
      validateStay({
        checkIn: new Date("2026-08-15"),
        checkOut: new Date("2026-08-15"),
        now,
      }),
    ).toThrow(/checkOut/i);
  });

  it("throws when checkIn is in the past", () => {
    expect(() =>
      validateStay({
        checkIn: new Date("2026-07-30"),
        checkOut: new Date("2026-08-02"),
        now,
      }),
    ).toThrow(/past/i);
  });

  it("quits when stay > 30 nights", () => {
    expect(() =>
      validateStay({
        checkIn: new Date("2026-08-12"),
        checkOut: new Date("2026-09-12"),
        now,
      }),
    ).toThrow(/30/);
  });

  it("accepts stay = 30 nights (limit)", () => {
    expect(() =>
      validateStay({
        checkIn: new Date("2026-08-12"),
        checkOut: new Date("2026-09-11"),
        now,
      }),
    ).not.toThrow();
  });
});
