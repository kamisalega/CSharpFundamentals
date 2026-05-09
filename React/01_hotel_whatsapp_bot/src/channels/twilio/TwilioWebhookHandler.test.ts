import { describe, expect, it, vi } from "vitest";
import {
  createTwilioWebhookHandlers,
  type TwilioWebhookDeps,
} from "./TwilioWebhookHandler";
import {
  aTwilioInboundText,
  aTwilioButtonReply,
} from "../../../tests/fixtures/twilio-webhook";
import { maskPhone } from "@/security/maskPII";
import { RateLimitDecision } from "@/security/rateLimit/types";
import { createTokenBucketLimiter } from "@/security/rateLimit";

const AUTH_TOKEN = "test-auth-token-1234567890abcdef";
const PUBLIC_URL = "https://example.test/api/twilio/whatsapp/webhook";

describe("createTwilioWebhookHandlers — POST (signature)", () => {
  it("returns 401 for invalid signature and does not proceed", async () => {
    const { deps, process, recordIfNew, rateLimiterTake } = buildDeps();
    const { POST } = createTwilioWebhookHandlers(deps);
    const fixture = aTwilioInboundText({ body: "Hi" });

    const request = new Request(PUBLIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": "bad-signature",
      },
      body: fixture.formBody,
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(rateLimiterTake).not.toHaveBeenCalled();
    expect(recordIfNew).not.toHaveBeenCalled();
    expect(process).not.toHaveBeenCalled();
  });

  it("returns 401 when x-twilio-signature header is absent", async () => {
    const { deps } = buildDeps();
    const { POST } = createTwilioWebhookHandlers(deps);
    const fixture = aTwilioInboundText();

    const request = new Request(PUBLIC_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: fixture.formBody,
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });
});

describe("createTwilioWebhookHandlers — POST (schema parsing)", () => {
  it("returns 200 and does not process for payload missing MessageSid", async () => {
    const { deps, process } = buildDeps();
    const { POST } = createTwilioWebhookHandlers(deps);

    const brokenParams =
      "From=whatsapp%3A%2B33611111111&Body=Hi&To=whatsapp%3A%2B14155238886";
    const signature = signParams(
      AUTH_TOKEN,
      PUBLIC_URL,
      Object.fromEntries(new URLSearchParams(brokenParams)),
    );

    const request = new Request(PUBLIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": signature,
      },
      body: brokenParams,
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(process).not.toHaveBeenCalled();
  });
});

describe("createTwilioWebhookHandlers — POST (rate limit + idempotency + happy path)", () => {
  it("returns 200 silently when rate limit is exceeded", async () => {
    const { deps, process, recordIfNew, logger } = buildDeps({
      rateLimiter: {
        take: vi.fn().mockResolvedValue({ allowed: false, remaining: 0 }),
      },
    });
    const { POST } = createTwilioWebhookHandlers(deps);
    const fixture = aTwilioInboundText({
      phone: "+33611111111",
      body: "hello",
    });

    const response = await POST(
      fixture.toRequest({ authToken: AUTH_TOKEN, url: PUBLIC_URL }),
    );

    expect(response.status).toBe(200);
    expect(recordIfNew).not.toHaveBeenCalled();
    expect(process).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "twilio.webhook.rate_limited",
        phone: maskPhone("+33611111111"),
      }),
    );
  });

  it("returns 200 and skips process for duplicate MessageSid", async () => {
    const { deps, process, logger } = buildDeps({
      idempotency: {
        recordIfNew: vi.fn().mockResolvedValue({ isNew: false }),
      },
    });
    const { POST } = createTwilioWebhookHandlers(deps);
    const fixture = aTwilioInboundText({ messageSid: "SM-dup-001" });

    const response = await POST(
      fixture.toRequest({ authToken: AUTH_TOKEN, url: PUBLIC_URL }),
    );

    expect(response.status).toBe(200);
    expect(process).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "twilio.webhook.duplicate",
        messageSid: "SM-dup-001",
      }),
    );
  });

  it("happy path — calls process with TwilioInboundMessage and correlationId", async () => {
    const { deps, process, schedule, recordIfNew } = buildDeps();
    const { POST } = createTwilioWebhookHandlers(deps);
    const fixture = aTwilioInboundText({
      phone: "+33611111111",
      messageSid: "SM-fresh-001",
      body: "Bonjour",
    });

    const response = await POST(
      fixture.toRequest({ authToken: AUTH_TOKEN, url: PUBLIC_URL }),
    );

    expect(response.status).toBe(200);
    expect(recordIfNew).toHaveBeenCalledWith("SM-fresh-001");
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(process).toHaveBeenCalledWith(
      expect.objectContaining({
        messageSid: "SM-fresh-001",
        from: "+33611111111",
        body: "Bonjour",
      }),
      { correlationId: "test-correlation-id" },
    );
  });

  it("button reply — happy path with correct selectionId", async () => {
    const { deps, process } = buildDeps();
    const { POST } = createTwilioWebhookHandlers(deps);
    const fixture = aTwilioButtonReply({
      phone: "+33611111111",
      messageSid: "SM-btn-001",
      buttonPayload: "book_room",
    });

    await POST(fixture.toRequest({ authToken: AUTH_TOKEN, url: PUBLIC_URL }));

    expect(process).toHaveBeenCalledWith(
      expect.objectContaining({
        buttonPayload: "book_room",
        messageType: "button",
      }),
      expect.any(Object),
    );
  });

  it("error thrown in process is logged and does not leak to response", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("engine boom"));
    const { deps, logger } = buildDeps({ process: failing });
    const { POST } = createTwilioWebhookHandlers(deps);
    const fixture = aTwilioInboundText({ messageSid: "SM-boom" });

    const response = await POST(
      fixture.toRequest({ authToken: AUTH_TOKEN, url: PUBLIC_URL }),
    );
    await new Promise((r) => setImmediate(r));

    expect(response.status).toBe(200);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "twilio.webhook.process.failed" }),
    );
  });
});

describe("createTwilioWebhookHandlers — burst (real rate limiter)", () => {
  it("first 3 messages from same phone pass, 4th is blocked", async () => {
    const clock = makeClock();
    const {
      deps,
      process: processFn,
      logger,
    } = buildDeps({
      rateLimiter: createTokenBucketLimiter({
        capacity: 3,
        refillTokens: 3,
        refillIntervalMs: 60_000,
        now: clock.fn,
      }),
      idempotency: { recordIfNew: vi.fn().mockResolvedValue({ isNew: true }) },
    });
    const { POST } = createTwilioWebhookHandlers(deps);

    for (let i = 0; i < 4; i++) {
      const fixture = aTwilioInboundText({
        phone: "+33611111111",
        messageSid: `SM-burst-${i}`,
      });
      await POST(fixture.toRequest({ authToken: AUTH_TOKEN, url: PUBLIC_URL }));
    }

    expect(processFn).toHaveBeenCalledTimes(3);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "twilio.webhook.rate_limited" }),
    );
  });

  it("independent buckets — 3 messages from A and 3 from B, all 6 pass", async () => {
    const clock = makeClock();
    const { deps, process: processFn } = buildDeps({
      rateLimiter: createTokenBucketLimiter({
        capacity: 3,
        refillTokens: 3,
        refillIntervalMs: 60_000,
        now: clock.fn,
      }),
      idempotency: { recordIfNew: vi.fn().mockResolvedValue({ isNew: true }) },
    });
    const { POST } = createTwilioWebhookHandlers(deps);

    let idx = 0;
    for (const phone of ["+33611111111", "+33622222222"]) {
      for (let i = 0; i < 3; i++) {
        const fixture = aTwilioInboundText({
          phone,
          messageSid: `SM-iso-${idx++}`,
        });
        await POST(
          fixture.toRequest({ authToken: AUTH_TOKEN, url: PUBLIC_URL }),
        );
      }
    }

    expect(processFn).toHaveBeenCalledTimes(6);
  });
});

// helpers

function signParams(
  authToken: string,
  url: string,
  params: Record<string, string>,
): string {
  const { createHmac } = require("crypto");
  const sorted = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
  let message = url;
  for (const [key, value] of sorted) {
    message += key + value;
  }
  return createHmac("sha1", authToken).update(message, "utf8").digest("base64");
}

function makeClock() {
  let t = 0;
  return {
    fn: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

function buildDeps(overrides: Partial<TwilioWebhookDeps> = {}): {
  deps: TwilioWebhookDeps;
  process: ReturnType<typeof vi.fn>;
  schedule: ReturnType<typeof vi.fn>;
  rateLimiterTake: ReturnType<typeof vi.fn>;
  recordIfNew: ReturnType<typeof vi.fn>;
  logger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
} {
  const process = vi.fn();
  const rateLimiterTake = vi
    .fn<(key: string) => Promise<RateLimitDecision>>()
    .mockResolvedValue({ allowed: true, remaining: 9 });
  const recordIfNew = vi
    .fn<(id: string) => Promise<{ isNew: boolean }>>()
    .mockResolvedValue({ isNew: true });
  const schedule = vi.fn((fn: () => void | Promise<void>) => {
    void fn();
  });
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

  const deps: TwilioWebhookDeps = {
    authToken: AUTH_TOKEN,
    publicUrl: PUBLIC_URL,
    rateLimiter: { take: rateLimiterTake },
    idempotency: { recordIfNew },
    process,
    schedule,
    logger,
    getCorrelationId: () => "test-correlation-id",
    ...overrides,
  };
  return { deps, process, schedule, rateLimiterTake, recordIfNew, logger };
}
