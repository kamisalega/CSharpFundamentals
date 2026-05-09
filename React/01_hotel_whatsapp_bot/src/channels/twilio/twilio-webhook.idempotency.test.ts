import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTwilioWebhookHandlers,
  type TwilioIdempotencyStore,
} from "@/channels/twilio/TwilioWebhookHandler";
import { createTokenBucketLimiter } from "@/security/rateLimit";
import { Prisma } from "@prisma/client";
import { resetTestDb, testPrisma } from "../../../tests/helpers/testDb";
import { aTwilioInboundText } from "../../../tests/fixtures/twilio-webhook";

const AUTH_TOKEN = "idempotency-auth-token-1234567890";
const PUBLIC_URL = "https://test.example.com/api/twilio/whatsapp/webhook";

function makeIdempotency(): TwilioIdempotencyStore {
  return {
    async recordIfNew(externalId) {
      try {
        await testPrisma.processedWebhookEvent.create({
          data: { source: "TWILIO", externalId },
        });
        return { isNew: true };
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          return { isNew: false };
        }
        throw err;
      }
    },
  };
}

describe("twilio-webhook idempotency (integration)", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("replaying the same MessageSid does not call process a second time", async () => {
    const process = vi.fn();
    const { POST } = createTwilioWebhookHandlers({
      authToken: AUTH_TOKEN,
      publicUrl: PUBLIC_URL,
      rateLimiter: createTokenBucketLimiter({
        capacity: 10,
        refillTokens: 10,
        refillIntervalMs: 60_000,
        now: () => Date.now(),
      }),
      idempotency: makeIdempotency(),
      process,
      schedule: (fn) => void fn(),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      getCorrelationId: () => "corr-idem-1",
    });

    const fixture = aTwilioInboundText({
      phone: "+33611111111",
      messageSid: "SM-idem-001",
      body: "Bonjour",
    });
    const req1 = fixture.toRequest({ authToken: AUTH_TOKEN, url: PUBLIC_URL });
    const req2 = fixture.toRequest({ authToken: AUTH_TOKEN, url: PUBLIC_URL });

    const resp1 = await POST(req1);
    const resp2 = await POST(req2);

    expect(resp1.status).toBe(200);
    expect(resp2.status).toBe(200);
    expect(process).toHaveBeenCalledTimes(1);

    const events = await testPrisma.processedWebhookEvent.findMany({
      where: { source: "TWILIO", externalId: "SM-idem-001" },
    });
    expect(events).toHaveLength(1);
  });

  it("different MessageSids from the same phone are both processed", async () => {
    const process = vi.fn();
    const { POST } = createTwilioWebhookHandlers({
      authToken: AUTH_TOKEN,
      publicUrl: PUBLIC_URL,
      rateLimiter: createTokenBucketLimiter({
        capacity: 10,
        refillTokens: 10,
        refillIntervalMs: 60_000,
        now: () => Date.now(),
      }),
      idempotency: makeIdempotency(),
      process,
      schedule: (fn) => void fn(),
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      getCorrelationId: () => "corr-idem-2",
    });

    const req1 = aTwilioInboundText({
      phone: "+33611111111",
      messageSid: "SM-idem-A",
    }).toRequest({ authToken: AUTH_TOKEN, url: PUBLIC_URL });

    const req2 = aTwilioInboundText({
      phone: "+33611111111",
      messageSid: "SM-idem-B",
    }).toRequest({ authToken: AUTH_TOKEN, url: PUBLIC_URL });

    await POST(req1);
    await POST(req2);

    expect(process).toHaveBeenCalledTimes(2);

    const events = await testPrisma.processedWebhookEvent.findMany({
      where: { source: "TWILIO" },
    });
    expect(events).toHaveLength(2);
  });
});
