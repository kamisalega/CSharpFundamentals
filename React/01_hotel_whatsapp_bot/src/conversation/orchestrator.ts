import { AiProvider, ConversationMessage, ToolResult } from "@/ai/AiProvider";
import { BookingService } from "@/booking/BookingService";
import { WhatsAppClient } from "@/whatsapp/WhatsAppClient";
import { PrismaClient } from "@prisma/client";
import {
  ConversationContext,
  ConversationState,
  SystemEvent,
  transition,
} from "./stateMachine";
import { sanitizeUserMessage } from "@/ai/sanitize";

export type OrchestratorLogger = Readonly<{
  info: (obj: object) => void;
  warn: (obj: object) => void;
  error: (obj: object) => void;
}>;

export type HandleArgs = Readonly<{
  phone: string;
  text: string;
  whatsappMessageId: string;
  correlationId: string;
}>;

export type OrchestratorDeps = Readonly<{
  prisma: PrismaClient;
  ai: AiProvider;
  whatsapp: WhatsAppClient;
  booking: BookingService;
  logger: OrchestratorLogger;
  now: () => Date;
}>;

const STATIC_FALLBACK =
  "Nous rencontrons un problème technique. Veuillez réessayer dans un instant.";
const STATIC_HANDOFF =
  "Un agent va prendre en charge votre conversation. Veuillez patienter.";
const HISTORY_LIMIT = 10;

type ConvSlots = Readonly<{
  checkIn: Date | null;
  checkOut: Date | null;
  adults: number | null;
  children: number | null;
  selectedRoomId: string | null;
  guestName: string | null;
  guestEmail: string | null;
  unknownCount: number;
}>;

function safeDate(v: unknown): Date | undefined {
  if (typeof v !== "string") return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

function safePosInt(v: unknown): number | undefined {
  return typeof v === "number" && Number.isInteger(v) && v > 0 ? v : undefined;
}

function safeNonNegInt(v: unknown): number | undefined {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : undefined;
}

function safeStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

function mergeSlots(
  base: ConvSlots,
  slots: Record<string, unknown> | undefined,
): ConvSlots {
  return {
    checkIn: safeDate(slots?.["checkIn"]) ?? base.checkIn,
    checkOut: safeDate(slots?.["checkOut"]) ?? base.checkOut,
    adults: safePosInt(slots?.["adults"]) ?? base.adults,
    children: safeNonNegInt(slots?.["children"]) ?? base.children,
    selectedRoomId: safeStr(slots?.["roomId"]) ?? base.selectedRoomId,
    guestName: safeStr(slots?.["guestName"]) ?? base.guestName,
    guestEmail: safeStr(slots?.["guestEmail"]) ?? base.guestEmail,
    unknownCount: base.unknownCount,
  };
}

function toConvCtx(
  slots: ConvSlots,
  unknownCount: number,
): ConversationContext {
  return {
    hasCheckIn: slots.checkIn !== null,
    hasCheckOut: slots.checkOut !== null,
    hasGuestCount: (slots.adults ?? 0) > 0,
    hasSelectedRoom: slots.selectedRoomId !== null,
    hasGuestName: (slots.guestName?.trim().length ?? 0) > 0,
    hasGuestEmail: (slots.guestEmail?.trim().length ?? 0) > 0,
    unknownCount,
  };
}

export class Orchestrator {
  constructor(private readonly deps: OrchestratorDeps) {}

  async handle({
    phone,
    text,
    whatsappMessageId,
    correlationId,
  }: HandleArgs): Promise<void> {
    const conv = await this.deps.prisma.conversation.upsert({
      where: { phone },
      create: { phone },
      update: {},
    });

    if (conv.botPaused) {
      await this.deps.prisma.message.create({
        data: {
          conversationId: conv.id,
          whatsappMessageId,
          direction: "INBOUND",
          body: text,
        },
      });
      this.deps.logger.info({
        event: "orchestrator.bot_paused",
        conversationId: conv.id,
        correlationId,
      });
      return;
    }

    const history = await this.deps.prisma.message.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: "asc" },
      take: HISTORY_LIMIT,
    });

    await this.deps.prisma.message.create({
      data: {
        conversationId: conv.id,
        whatsappMessageId,
        direction: "INBOUND",
        body: text,
      },
    });

    const conversationContext: ConversationMessage[] = history.map((m) => ({
      role:
        m.direction === "INBOUND" ? ("user" as const) : ("assistant" as const),
      content: m.body,
    }));

    const sanitized = sanitizeUserMessage(text);
    const currentState = conv.state as ConversationState;
    const baseSlots: ConvSlots = {
      checkIn: conv.checkIn,
      checkOut: conv.checkOut,
      adults: conv.adults,
      children: conv.children,
      selectedRoomId: conv.selectedRoomId,
      guestName: conv.guestName,
      guestEmail: conv.guestEmail,
      unknownCount: conv.unknownCount,
    };

    const intentResult = await this.deps.ai.classifyIntent({
      userMessage: sanitized,
      conversationContext,
      correlationId,
    });

    if (intentResult.isErr()) {
      this.deps.logger.error({
        event: "orchestrator.ai_classify_failed",
        code: intentResult.error.code,
        correlationId,
      });
      const ctx = toConvCtx(baseSlots, baseSlots.unknownCount);
      const { next } = transition(currentState, { kind: "ai_failed" }, ctx);
      await this.sendStatic(
        conv.id,
        phone,
        STATIC_FALLBACK,
        next,
        baseSlots.unknownCount,
      );
      return;
    }

    const intentResponse = intentResult.value;
    const rawSlots =
      intentResponse.slots !== undefined
        ? (intentResponse.slots as Record<string, unknown>)
        : undefined;
    const merged = mergeSlots(baseSlots, rawSlots);

    let unknownCount = baseSlots.unknownCount;
    if (intentResponse.intent === "unknown") {
      unknownCount += 1;
    } else if (intentResponse.intent !== "faq") {
      unknownCount = 0;
    }

    const ctx = toConvCtx(merged, unknownCount);
    const event: SystemEvent = {
      kind: "intent",
      intent: intentResponse.intent,
    };
    const { next: nextState } = transition(currentState, event, ctx);

    if (nextState === "HUMAN_HANDOFF") {
      await this.deps.prisma.conversation.update({
        where: { id: conv.id },
        data: { state: nextState, botPaused: true, unknownCount },
      });
      await this.deps.whatsapp.sendText({ to: phone, text: STATIC_HANDOFF });
      await this.deps.prisma.message.create({
        data: {
          conversationId: conv.id,
          direction: "OUTBOUND",
          body: STATIC_HANDOFF,
        },
      });
      return;
    }

    if (nextState === "ERROR") {
      await this.sendStatic(
        conv.id,
        phone,
        STATIC_FALLBACK,
        nextState,
        unknownCount,
      );
      return;
    }

    const toolResults: ToolResult[] = [];

    if (nextState === "SHOW_OFFERS" && merged.checkIn && merged.checkOut) {
      const rooms = await this.deps.prisma.room.findMany();
      for (const room of rooms) {
        try {
          const quote = await this.deps.booking.quote({
            roomId: room.id,
            checkIn: merged.checkIn,
            checkOut: merged.checkOut,
            guests: {
              adults: merged.adults ?? 1,
              children: merged.children ?? 0,
            },
            breakfast: false,
            now: this.deps.now(),
          });
          toolResults.push({
            name: "check_availability",
            result: {
              roomId: room.id,
              roomName: room.name,
              available: quote.available,
              total: quote.total,
            },
          });
        } catch {
          this.deps.logger.warn({
            event: "orchestrator.quote_failed",
            roomId: room.id,
            correlationId,
          });
        }
      }
    }

    if (
      nextState === "PAYMENT_SENT" &&
      merged.checkIn &&
      merged.checkOut &&
      merged.selectedRoomId &&
      merged.guestName &&
      merged.guestEmail
    ) {
      try {
        const reservation = await this.deps.booking.hold({
          conversationId: conv.id,
          roomId: merged.selectedRoomId,
          checkIn: merged.checkIn,
          checkOut: merged.checkOut,
          guests: {
            adults: merged.adults ?? 1,
            children: merged.children ?? 0,
          },
          breakfast: false,
          guest: { name: merged.guestName, email: merged.guestEmail, phone },
          now: this.deps.now(),
        });
        toolResults.push({
          name: "hold_reservation",
          result: {
            reservationCode: reservation.code,
            reservationId: reservation.id,
          },
        });
      } catch {
        this.deps.logger.error({
          event: "orchestrator.hold_failed",
          correlationId,
        });
      }
    }

    const replyResult = await this.deps.ai.generateReply({
      intent: intentResponse,
      toolResults,
      conversationContext,
      correlationId,
    });

    const replyText =
      replyResult.isOk() && replyResult.value.text
        ? replyResult.value.text
        : STATIC_FALLBACK;

    await this.deps.whatsapp.sendText({ to: phone, text: replyText });

    const shouldClearDates = nextState === "COLLECT_DATES";
    const shouldClearRoom =
      nextState === "COLLECT_DATES" || nextState === "SHOW_OFFERS";

    await this.deps.prisma.$transaction([
      this.deps.prisma.conversation.update({
        where: { id: conv.id },
        data: {
          state: nextState,
          unknownCount,
          checkIn: shouldClearDates ? null : merged.checkIn,
          checkOut: shouldClearDates ? null : merged.checkOut,
          adults: shouldClearDates ? null : merged.adults,
          children: shouldClearDates ? null : merged.children,
          selectedRoomId: shouldClearRoom ? null : merged.selectedRoomId,
          guestName: merged.guestName,
          guestEmail: merged.guestEmail,
        },
      }),
      this.deps.prisma.message.create({
        data: {
          conversationId: conv.id,
          direction: "OUTBOUND",
          body: replyText,
        },
      }),
    ]);
  }

  private async sendStatic(
    conversationId: string,
    phone: string,
    message: string,
    nextState: ConversationState,
    unknownCount: number,
  ): Promise<void> {
    await this.deps.prisma.conversation.update({
      where: { id: conversationId },
      data: { state: nextState, unknownCount },
    });
    await this.deps.whatsapp.sendText({ to: phone, text: message });
    await this.deps.prisma.message.create({
      data: { conversationId, direction: "OUTBOUND", body: message },
    });
  }
}
