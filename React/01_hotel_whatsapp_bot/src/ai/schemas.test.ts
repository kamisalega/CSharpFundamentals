import { describe, expect, it } from "vitest";
import { intentResponseSchema, toolCallSchema } from "./schemas";

describe("intentResponseSchema", () => {
    it("accepts a known intent with confidence in [0, 1]", () => {
      const raw = { intent: "collect_dates", confidence: 0.92 };

      const result = intentResponseSchema.safeParse(raw);

      expect(result.success).toBe(true);
    });

    it("accepts optional slots when provided", () => {
      const raw = {
        intent: "collect_dates",
        confidence: 0.8,
        slots: { checkIn: "2026-08-12", guests: 2 },
      };

      const result = intentResponseSchema.safeParse(raw);

      expect(result.success).toBe(true);
    });

    it("rejects confidence > 1", () => {
      const raw = { intent: "greet", confidence: 1.5 };

      const result = intentResponseSchema.safeParse(raw);

      expect(result.success).toBe(false);
    });

    it("rejects confidence < 0", () => {
      const raw = { intent: "greet", confidence: -0.1 };

      const result = intentResponseSchema.safeParse(raw);

      expect(result.success).toBe(false);
    });

    it("rejects an unknown intent string", () => {
      const raw = { intent: "haxx_the_planet", confidence: 0.9 };

      const result = intentResponseSchema.safeParse(raw);

      expect(result.success).toBe(false);
    });
  });

  describe("toolCallSchema", () => {
    it("accepts check_availability with valid ISO dates and positive guests", () => {
      const raw = {
        name: "check_availability",
        args: { checkIn: "2026-08-12", checkOut: "2026-08-15", guests: 2 },
      };

      const result = toolCallSchema.safeParse(raw);

      expect(result.success).toBe(true);
    });

    it("rejects check_availability with malformed date", () => {
      const raw = {
        name: "check_availability",
        args: { checkIn: "12-08-2026", checkOut: "2026-08-15", guests: 2 },
      };

      const result = toolCallSchema.safeParse(raw);

      expect(result.success).toBe(false);
    });

    it("rejects check_availability with non-positive guests", () => {
      const raw = {
        name: "check_availability",
        args: { checkIn: "2026-08-12", checkOut: "2026-08-15", guests: 0 },
      };

      const result = toolCallSchema.safeParse(raw);

      expect(result.success).toBe(false);
    });

    it("accepts send_payment_link with reservationId", () => {
      const raw = {
        name: "send_payment_link",
        args: { reservationId: "RES-ABC123" },
      };

      const result = toolCallSchema.safeParse(raw);

      expect(result.success).toBe(true);
    });

    it("rejects an unknown tool name", () => {
      const raw = { name: "delete_database", args: {} };

      const result = toolCallSchema.safeParse(raw);

      expect(result.success).toBe(false);
    });
  });