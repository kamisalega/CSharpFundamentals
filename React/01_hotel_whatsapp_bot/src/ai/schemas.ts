import { z } from "zod";

export const intentEnum = z.enum([
  "greet",
  "collect_dates",
  "modify_slots",
  "select_room",
  "collect_guest_info",
  "offer_extras",
  "request_summary",
  "confirm_booking",
  "manage_existing",
  "faq",
  "handoff_request",
  "unknown",
]);

export type Intent = z.infer<typeof intentEnum>;

export const intentResponseSchema = z.object({
  intent: intentEnum,
  confidence: z.number().min(0).max(1),
  slots: z.record(z.string(), z.unknown()).optional(),
});

export type IntentResponse = z.infer<typeof intentResponseSchema>;

const isoDate = z.iso.date();
const positiveInt = z.number().int().positive();

export const toolCallSchema = z.discriminatedUnion("name", [
  z.object({
    name: z.literal("check_availability"),
    args: z.object({
      checkIn: isoDate,
      checkOut: isoDate,
      guests: positiveInt,
    }),
  }),
  z.object({
    name: z.literal("get_pricing"),
    args: z.object({
      roomId: z.string().min(1),
      checkIn: isoDate,
      checkOut: isoDate,
      guests: positiveInt,
      withBreakfast: z.boolean(),
    }),
  }),
  z.object({
    name: z.literal("hold_reservation"),
    args: z.object({
      roomId: z.string().min(1),
      checkIn: isoDate,
      checkOut: isoDate,
      guests: positiveInt,
    }),
  }),
  z.object({
    name: z.literal("send_payment_link"),
    args: z.object({
      reservationId: z.string().min(1),
    }),
  }),
  z.object({
    name: z.literal("escalate_to_human"),
    args: z.object({
      reason: z.string().min(1),
    }),
  }),
]);

export type ToolCall = z.infer<typeof toolCallSchema>;
export type ToolName = ToolCall["name"];
