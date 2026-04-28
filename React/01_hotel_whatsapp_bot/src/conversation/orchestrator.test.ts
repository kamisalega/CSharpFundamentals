import {
  AiError,
  AiProvider,
  ClassifyIntentArgs,
  GenerateReplyArgs,
  GenerateReplyOutput,
} from "@/ai/AiProvider";
import { IntentResponse } from "@/ai/schemas";
import {
  SendTextArgs,
  SendTextResult,
  WhatsAppClient,
} from "@/whatsapp/WhatsAppClient";
import { err, ok, Result } from "neverthrow";
import { Orchestrator, OrchestratorDeps } from "./Orchestrator";
import { resetTestDb, seedTestRoom, testPrisma } from "../../tests/helpers/testDb";
import { BookingService } from "@/booking/BookingService";
import { beforeEach, describe, expect, it } from "vitest";

class StubAiProvider implements AiProvider {
  private intentQueue: IntentResponse[] = [];
  private replyQueue: string[] = [];
  classifyIntentCallCount = 0;
  generateReplyCallCount = 0;
  lastGenerateReplyArgs: GenerateReplyArgs | undefined = undefined;

  enqueueIntent(intent: IntentResponse): void {
    this.intentQueue.push(intent);
  }

  enqueueReply(text: string): void {
    this.replyQueue.push(text);
  }

  async classifyIntent(
    _args: ClassifyIntentArgs,
  ): Promise<Result<IntentResponse, AiError>> {
    this.classifyIntentCallCount++;
    const intent = this.intentQueue.shift();
    if (!intent) {
      return err(
        new AiError({
          code: "PROVIDER_ERROR",
          message: "stub: brak intent w kolejce",
          attempts: 1,
        }),
      );
    }
    return ok(intent);
  }

  async generateReply(
    args: GenerateReplyArgs,
  ): Promise<Result<GenerateReplyOutput, AiError>> {
    this.generateReplyCallCount++;
    this.lastGenerateReplyArgs = args;
    const text = this.replyQueue.shift() ?? "Réponse de test.";
    return ok({ text, toolCalls: [] });
  }
}

class StubWhatsAppClient implements WhatsAppClient {
  readonly sent: Array<{ to: string; text: string }> = [];

  async sendText(args: SendTextArgs): Promise<SendTextResult> {
    this.sent.push({ to: args.to, text: args.text });
    return { messageId: `stub-${this.sent.length}` };
  }
}

// --- pomocnicy ---------------------------------------------------------------

const nullLogger = { info: () => {}, warn: () => {}, error: () => {} };
const FIXED_NOW = new Date("2026-04-28T10:00:00Z");
const FUTURE_CHECK_IN = new Date("2026-08-12T00:00:00Z");

function buildDeps(
  ai: StubAiProvider,
  whatsapp: StubWhatsAppClient,
): OrchestratorDeps {
  return {
    prisma: testPrisma,
    ai,
    whatsapp,
    booking: new BookingService(testPrisma),
    logger: nullLogger,
    now: () => FIXED_NOW,
  };
}

beforeEach(async () => {
  await resetTestDb();
});



describe("Orchestrator.handle - New Conversation", () => {
  it("creates a Conversation, saves INBOUND and OUTBOUND for a new number", async () => {
    const ai = new StubAiProvider();
    const whatsapp = new StubWhatsAppClient();
    ai.enqueueIntent({ intent: "greet", confidence: 0.9 });
    ai.enqueueReply("Bonjour!");

    await new Orchestrator(buildDeps(ai, whatsapp)).handle({
      phone: "+33612345678",
      text: "Salut",
      whatsappMessageId: "wamid.001",
      correlationId: "corr-001",
    });

    const conv = await testPrisma.conversation.findUnique({
      where: { phone: "+33612345678" },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    expect(conv).not.toBeNull();
    expect(conv!.state).toBe("COLLECT_DATES");
    expect(conv!.messages).toHaveLength(2);
    expect(conv!.messages[0]!.direction).toBe("INBOUND");
    expect(conv!.messages[1]!.direction).toBe("OUTBOUND");
    expect(whatsapp.sent[0]!.text).toBe("Bonjour!");
  });
});

describe("Orchestrator.handle — botPaused", () => {
  it("gdy botPaused=true zapisuje tylko INBOUND, nie woła AI ani WhatsApp", async () => {
    await testPrisma.conversation.create({
      data: { phone: "+33612345678", botPaused: true },
    });
    const ai = new StubAiProvider();
    const whatsapp = new StubWhatsAppClient();

    await new Orchestrator(buildDeps(ai, whatsapp)).handle({
      phone: "+33612345678",
      text: "Bonjour encore",
      whatsappMessageId: "wamid.002",
      correlationId: "corr-002",
    });

    const messages = await testPrisma.message.findMany({
      where: { conversation: { phone: "+33612345678" } },
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]!.direction).toBe("INBOUND");
    expect(ai.classifyIntentCallCount).toBe(0);
    expect(whatsapp.sent).toHaveLength(0);
  });
});

describe("Orchestrator.handle — błąd AI", () => {
  it("gdy classifyIntent zwraca error → stan ERROR, wysyła fallback po francusku", async () => {
    const ai = new StubAiProvider();
    const whatsapp = new StubWhatsAppClient();

    await new Orchestrator(buildDeps(ai, whatsapp)).handle({
      phone: "+33612345678",
      text: "xyz",
      whatsappMessageId: "wamid.003",
      correlationId: "corr-003",
    });

    const conv = await testPrisma.conversation.findUnique({
      where: { phone: "+33612345678" },
    });

    expect(conv!.state).toBe("ERROR");
    expect(whatsapp.sent).toHaveLength(1);
    expect(whatsapp.sent[0]!.text).toContain("problème technique");
  });
});

describe("Orchestrator.handle — collect_dates → SHOW_OFFERS", () => {
  it("zapisuje checkIn/checkOut/adults w DB i przekazuje toolResults do AI", async () => {
    await seedTestRoom({ from: FUTURE_CHECK_IN, days: 10 });
    const ai = new StubAiProvider();
    const whatsapp = new StubWhatsAppClient();
    ai.enqueueIntent({
      intent: "collect_dates",
      confidence: 0.95,
      slots: { checkIn: "2026-08-12", checkOut: "2026-08-15", adults: 2 },
    });
    ai.enqueueReply("Voici nos offres:");

    await new Orchestrator(buildDeps(ai, whatsapp)).handle({
      phone: "+33612345678",
      text: "Du 12 au 15 août pour 2 adultes",
      whatsappMessageId: "wamid.004",
      correlationId: "corr-004",
    });

    const conv = await testPrisma.conversation.findUnique({
      where: { phone: "+33612345678" },
    });

    expect(conv!.state).toBe("SHOW_OFFERS");
    expect(conv!.adults).toBe(2);
    expect(conv!.checkIn).not.toBeNull();
    expect(conv!.checkOut).not.toBeNull();
    expect(ai.lastGenerateReplyArgs?.toolResults).toHaveLength(1);
    expect(ai.lastGenerateReplyArgs?.toolResults[0]?.name).toBe(
      "check_availability",
    );
  });
});

describe("Orchestrator.handle — handoff_request", () => {
  it("ustawia HUMAN_HANDOFF, botPaused=true i wysyła statyczną wiadomość", async () => {
    const ai = new StubAiProvider();
    const whatsapp = new StubWhatsAppClient();
    ai.enqueueIntent({ intent: "handoff_request", confidence: 0.99 });

    await new Orchestrator(buildDeps(ai, whatsapp)).handle({
      phone: "+33612345678",
      text: "Je veux parler à quelqu'un",
      whatsappMessageId: "wamid.005",
      correlationId: "corr-005",
    });

    const conv = await testPrisma.conversation.findUnique({
      where: { phone: "+33612345678" },
    });

    expect(conv!.state).toBe("HUMAN_HANDOFF");
    expect(conv!.botPaused).toBe(true);
    expect(ai.generateReplyCallCount).toBe(0);
    expect(whatsapp.sent[0]!.text).toContain("agent");
  });
});

describe("Orchestrator.handle — licznik unknown", () => {
  it("2 unknown z rzędu → HUMAN_HANDOFF i botPaused", async () => {
    const ai = new StubAiProvider();
    const whatsapp = new StubWhatsAppClient();
    const phone = "+33612345678";
    const orch = new Orchestrator(buildDeps(ai, whatsapp));

    // Runda 1: unknown → zostaje w GREETING, AI odpowiada
    ai.enqueueIntent({ intent: "unknown", confidence: 0.1 });
    ai.enqueueReply("Pardon?");
    await orch.handle({
      phone,
      text: "???",
      whatsappMessageId: "m1",
      correlationId: "c1",
    });

    // Runda 2: unknown → unknownCount=2 → HUMAN_HANDOFF (statyczna wiadomość, bez AI reply)
    ai.enqueueIntent({ intent: "unknown", confidence: 0.1 });
    await orch.handle({
      phone,
      text: "???",
      whatsappMessageId: "m2",
      correlationId: "c2",
    });

    const conv = await testPrisma.conversation.findUnique({ where: { phone } });

    expect(conv!.state).toBe("HUMAN_HANDOFF");
    expect(conv!.botPaused).toBe(true);
    expect(ai.generateReplyCallCount).toBe(1); // tylko runda 1 wołała generateReply
  });
});

describe("Orchestrator.handle — happy path do PAYMENT_SENT", () => {
  it("pełna ścieżka: dates → select_room → guest_info → extras → confirm → rezerwacja w DB", async () => {
    const room = await seedTestRoom({ from: FUTURE_CHECK_IN, days: 10 });
    const ai = new StubAiProvider();
    const whatsapp = new StubWhatsAppClient();
    const orch = new Orchestrator(buildDeps(ai, whatsapp));
    const phone = "+33612345678";

    ai.enqueueIntent({
      intent: "collect_dates",
      confidence: 0.95,
      slots: { checkIn: "2026-08-12", checkOut: "2026-08-15", adults: 2 },
    });
    ai.enqueueReply("Voici nos chambres.");
    await orch.handle({
      phone,
      text: "12-15 août, 2 adultes",
      whatsappMessageId: "m1",
      correlationId: "c1",
    });

    ai.enqueueIntent({
      intent: "select_room",
      confidence: 0.9,
      slots: { roomId: room.id },
    });
    ai.enqueueReply("Votre nom?");
    await orch.handle({
      phone,
      text: "La Supérieure",
      whatsappMessageId: "m2",
      correlationId: "c2",
    });

    ai.enqueueIntent({
      intent: "collect_guest_info",
      confidence: 0.95,
      slots: { guestName: "Jean Dupont", guestEmail: "jean@example.com" },
    });
    ai.enqueueReply("Petit-déjeuner?");
    await orch.handle({
      phone,
      text: "Jean Dupont, jean@example.com",
      whatsappMessageId: "m3",
      correlationId: "c3",
    });

    ai.enqueueIntent({ intent: "offer_extras", confidence: 0.9 });
    ai.enqueueReply("Récapitulatif:");
    await orch.handle({
      phone,
      text: "Non merci",
      whatsappMessageId: "m4",
      correlationId: "c4",
    });

    ai.enqueueIntent({ intent: "confirm_booking", confidence: 0.99 });
    ai.enqueueReply("Réservation confirmée!");
    await orch.handle({
      phone,
      text: "Je confirme",
      whatsappMessageId: "m5",
      correlationId: "c5",
    });

    const conv = await testPrisma.conversation.findUnique({
      where: { phone },
      include: { messages: true },
    });
    const reservations = await testPrisma.reservation.findMany({
      where: { conversationId: conv!.id },
    });

    expect(conv!.state).toBe("PAYMENT_SENT");
    expect(reservations).toHaveLength(1);
    expect(reservations[0]!.guestName).toBe("Jean Dupont");
    expect(reservations[0]!.code).toMatch(/^RES-/);
    expect(conv!.messages).toHaveLength(10); 
  });
});
