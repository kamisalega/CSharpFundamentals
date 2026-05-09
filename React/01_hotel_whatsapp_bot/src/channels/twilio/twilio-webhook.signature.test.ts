import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTwilioWebhookHandlers,
  type TwilioIdempotencyStore,
} from "@/channels/twilio/TwilioWebhookHandler";
import { createTokenBucketLimiter } from "@/security/rateLimit";
import { Prisma } from "@prisma/client";
import { resetTestDb, testPrisma } from "../../../tests/helpers/testDb";
import { aTwilioInboundText } from "../../../tests/fixtures/twilio-webhook";

const AUTH_TOKEN = "integration-auth-token-1234567890";
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

describe("twilio-webhook signature (integration)", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("rejects request with invalid signature — no DB write", async () => {
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
      getCorrelationId: () => "corr-sig-test",
    });

    const fixture = aTwilioInboundText({
      phone: "+33611111111",
      messageSid: "SM-sig-test-001",
    });
    const request = new Request(PUBLIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": "sha1=tampered",
      },
      body: fixture.formBody,
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(process).not.toHaveBeenCalled();

    const events = await testPrisma.processedWebhookEvent.findMany();
    expect(events).toHaveLength(0);
  });

  it("accepts valid request and creates ProcessedWebhookEvent in DB", async () => {
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
      getCorrelationId: () => "corr-sig-test-2",
    });

    const fixture = aTwilioInboundText({
      phone: "+33611111111",
      messageSid: "SM-sig-test-002",
    });

    const response = await POST(
      fixture.toRequest({ authToken: AUTH_TOKEN, url: PUBLIC_URL }),
    );

    expect(response.status).toBe(200);
    expect(process).toHaveBeenCalledTimes(1);

    const events = await testPrisma.processedWebhookEvent.findMany();
    expect(events).toHaveLength(1);
    expect(events[0]?.externalId).toBe("SM-sig-test-002");
    expect(events[0]?.source).toBe("TWILIO");
  });
});
