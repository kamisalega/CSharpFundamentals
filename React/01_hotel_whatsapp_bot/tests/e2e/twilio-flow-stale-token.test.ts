import { afterAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { BookingService } from "@/booking/BookingService";
import { createFlowDataExchangeHandlers } from "@/channels/twilio/TwilioFlowDataExchangeHandler";
import type { MessagingPort, FlowKey } from "@/channels/MessagingPort";
import type { EmailPort } from "@/email/EmailPort";
import type { PaymentPort } from "@/payments/PaymentPort";
import { createBookingServicePmsAdapter } from "@/pms/BookingServicePmsAdapter";
import { FlowConversationEngine } from "@/flows/FlowConversationEngine";
import { FlowState } from "@/flows/FlowState";
import type { TemplateSids, FlowIds } from "@/flows/transitions";
import { resetTestDb, testPrisma } from "../helpers/testDb";
import {
  TEST_PRIVATE_KEY_PEM,
  dateExchangeRequest,
  guestInfoExchangeRequest,
} from "../fixtures/flow-data-exchange";

const AUTH_TOKEN = "test-auth-e2e-stale-token-9999";
const FLOW_DATA_URL = "https://e2e.test/api/twilio/whatsapp/flow-data";

const TEST_TEMPLATE_SIDS: TemplateSids = {
  welcomeMenu: "HXwelcome",
  datePickerFlow: "HXdates",
  guestsPickerFlow: "HXguests",
  guestInfoFlow: "HXguestinfo",
  roomDetailCard: "HXroom",
  payCta: "HXpay",
  bookingConfirmed: "HXconfirmed",
};

const TEST_FLOW_IDS: FlowIds = {
  datePicker: "DATE_PICKER" as FlowKey,
  guestsPicker: "GUESTS_PICKER" as FlowKey,
  guestInfo: "GUEST_INFO" as FlowKey,
};

describe("twilio-flow-stale-token (E2E)", () => {
  let flowHandlers: ReturnType<typeof createFlowDataExchangeHandlers>;
  let flush: () => Promise<void>;
  let warnLogger: Mock;

  beforeEach(async () => {
    await resetTestDb();
    vi.clearAllMocks();

    let scheduledWork: Promise<void> = Promise.resolve();
    const schedule = (fn: () => void | Promise<void>) => {
      scheduledWork = Promise.resolve().then(() => fn());
    };
    flush = async () => {
      await scheduledWork;
      scheduledWork = Promise.resolve();
    };

    warnLogger = vi.fn();
    const logger = { info: vi.fn(), warn: warnLogger, error: vi.fn() };

    const messaging: MessagingPort = {
      sendText: vi.fn().mockResolvedValue({ messageId: "SM_noop" }),
      sendTemplate: vi.fn().mockResolvedValue({ messageId: "SM_noop" }),
      sendFlow: vi.fn().mockResolvedValue({ messageId: "SM_noop" }),
    };
    const email: EmailPort = {
      sendBookingConfirmation: vi.fn().mockResolvedValue(undefined),
    };
    const payments: PaymentPort = {
      createCheckoutLink: vi.fn().mockResolvedValue({
        url: "https://checkout.test/pay",
        sessionId: "cs_test",
      }),
    };

    const NOW = new Date("2026-05-15T12:00:00Z");
    const booking = new BookingService(testPrisma);
    const pms = createBookingServicePmsAdapter(booking, testPrisma);
    const ports = { messaging, pms, payments, email, prisma: testPrisma, now: () => NOW };
    const engine = new FlowConversationEngine();

    flowHandlers = createFlowDataExchangeHandlers({
      privateKeyPem: TEST_PRIVATE_KEY_PEM,
      authToken: AUTH_TOKEN,
      publicUrl: FLOW_DATA_URL,
      engine,
      ports,
      templateSids: TEST_TEMPLATE_SIDS,
      flowIds: TEST_FLOW_IDS,
      schedule,
      logger,
      getCorrelationId: () => "e2e-stale-token",
    });
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  const FLOW_OPTS = { authToken: AUTH_TOKEN, url: FLOW_DATA_URL };

  it("data_exchange z nieznanym flow_token → HTTP 200, DB bez zmian, warn zalogowany", async () => {
    const { request } = dateExchangeRequest(
      { check_in: "2026-06-01", check_out: "2026-06-04" },
      "nieznany-flow-token-xyz-12345",
      FLOW_OPTS,
    );

    const response = await flowHandlers.POST(request);
    await flush();

    // Handler akceptuje request i zwraca 200 z zaszyfrowaną odpowiedzią
    expect(response.status).toBe(200);

    // Baza danych nie ma żadnej konwersacji — token nie powoduje tworzenia nowych rekordów
    const conversations = await testPrisma.conversation.findMany();
    expect(conversations).toHaveLength(0);

    // Warn zalogowany gdy konwersacja nie istnieje
    expect(warnLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "twilio.flow.conversation_not_found",
        flowToken: "nieznany-flow-token-xyz-12345",
      }),
    );
  });

  it("data_exchange z wygasłym flow_token (istniejąca konwersacja w innym stanie) → 200, stan bez zmian", async () => {
    // Konwersacja istnieje, ale ma inny flowToken (stary token z poprzedniej sesji)
    const conv = await testPrisma.conversation.create({
      data: {
        phone: "+33611000077",
        channel: "TWILIO",
        state: "GREETING",
        flowState: FlowState.PAYMENT_PENDING,
        flowToken: "aktywny-token-abcdef",
        flowSlots: JSON.stringify({
          checkIn: "2026-07-01T00:00:00.000Z",
          checkOut: "2026-07-04T00:00:00.000Z",
        }),
      },
    });

    // Wysyłamy data_exchange ze STARYM tokenem (nie pasuje do aktywnego)
    const { request } = dateExchangeRequest(
      { check_in: "2026-06-01", check_out: "2026-06-04" },
      "stary-wygasly-token-xyz",
      FLOW_OPTS,
    );

    const response = await flowHandlers.POST(request);
    await flush();

    expect(response.status).toBe(200);

    // Stan konwersacji NIEZMIENIONY — stary token nie modyfikuje aktywnej konwersacji
    const updatedConv = await testPrisma.conversation.findUnique({
      where: { id: conv.id },
    });
    expect(updatedConv!.flowState).toBe(FlowState.PAYMENT_PENDING);
    expect(updatedConv!.flowToken).toBe("aktywny-token-abcdef");

    // Warn zalogowany (stary token nie pasuje do żadnej konwersacji)
    expect(warnLogger).toHaveBeenCalledWith(
      expect.objectContaining({ event: "twilio.flow.conversation_not_found" }),
    );
  });

  it("dokumentuje bug: EXTRAS data_exchange niemożliwy po GUEST_INFO — flowToken wyzerowany przez persistFlowState", async () => {
    // Seed konwersacji w AWAITING_EXTRAS ze sprawdzonym flowToken
    const guestInfoToken = "guest-info-token-123";
    await testPrisma.conversation.create({
      data: {
        phone: "+33611000078",
        channel: "TWILIO",
        state: "GREETING",
        flowState: FlowState.AWAITING_EXTRAS,
        // flowToken === NULL bo persistFlowState bez flowToken zeruje pole
        flowToken: null,
        flowSlots: JSON.stringify({
          guestName: "Marie Dupont",
          guestEmail: "marie@example.com",
        }),
      },
    });

    // EXTRAS data_exchange wysyłamy z tokenem który był w GUEST_INFO Flow
    // — ale konwersacja już nie ma tego tokenu (wyzerowany)
    const { request } = guestInfoExchangeRequest(
      { name: "Ignored", email: "ignored@test.com", phone: "+33600000000" },
      guestInfoToken,
      FLOW_OPTS,
    );

    const response = await flowHandlers.POST(request);
    await flush();

    // Handler zwraca 200 — request jest formalnie poprawny
    expect(response.status).toBe(200);

    // Konwersacja nadal w AWAITING_EXTRAS — EXTRAS nie został przetworzony
    const conv = await testPrisma.conversation.findFirst({
      where: { phone: "+33611000078" },
    });
    expect(conv!.flowState).toBe(FlowState.AWAITING_EXTRAS);

    // Warn zalogowany bo flowToken === null → findFirst zwraca null
    expect(warnLogger).toHaveBeenCalledWith(
      expect.objectContaining({ event: "twilio.flow.conversation_not_found" }),
    );
  });
});
