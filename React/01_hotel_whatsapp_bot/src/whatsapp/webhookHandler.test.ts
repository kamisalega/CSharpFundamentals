import { describe, expect, it, vi } from "vitest";
import { createWebhookHandlers, type WebhookDeps } from "./webhookHandler";
import {
  createTokenBucketLimiter,
  RateLimitDecision,
} from "@/security/rateLimit";
import { aMetaWebhook } from "../../tests/fixtures/meta-webhook";
import { createHmac } from "crypto";
import { maskPhone } from "@/security/maskPII";

const APP_SECRET = "test-app-secret";
const VERIFY_TOKEN = "test-verify-token";
const WATHSAPP_API_URL = "https://example.test/api/whatsapp/webhook";

describe("createWebhookHandlers — GET (Meta verification handshake)", () => {
  it("returns hub.challenge(200) when mode=subscribe and verify_token match", async () => {
    const { deps } = buildDeps();
    const { GET } = createWebhookHandlers(deps);

    const url = new URL(WATHSAPP_API_URL);
    url.searchParams.set("hub.mode", "subscribe");
    url.searchParams.set("hub.verify_token", VERIFY_TOKEN);
    url.searchParams.set("hub.challenge", "challenge-12345");

    const response = await GET(new Request(url, { method: "GET" }));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("challenge-12345");

    expect(deps);
  });

  it("returns 403 when verify_token does not match", async () => {
    const { deps } = buildDeps();
    const { GET } = createWebhookHandlers(deps);
    const url = new URL(WATHSAPP_API_URL);
    url.searchParams.set("hub.mode", "subscribe");
    url.searchParams.set("hub.verify_token", "wrong-token");
    url.searchParams.set("hub.challenge", "ch-1");

    const response = await GET(new Request(url, { method: "GET" }));

    expect(response.status).toBe(403);
  });

  it("returns 403 when mode is other than subscribe", async () => {
    const { deps } = buildDeps();
    const { GET } = createWebhookHandlers(deps);
    const url = new URL(WATHSAPP_API_URL);
    url.searchParams.set("hub.mode", "unsubscribe");
    url.searchParams.set("hub.verify_token", VERIFY_TOKEN);
    url.searchParams.set("hub.challenge", "ch-1");

    const response = await GET(new Request(url, { method: "GET" }));

    expect(response.status).toBe(403);
  });
});

describe("createWebhookHandlers — POST (signature)", () => {
  it("responds with 401 for invalid signature and does not perform any further step", async () => {
    const { deps, process, recordIfNew, rateLimiterTake } = buildDeps();
    const { POST } = createWebhookHandlers(deps);
    const rawBody = JSON.stringify(aMetaWebhook().withText("Hi").build());

    const response = await POST(
      buildPostRequest({ rawBody, signature: "sha256=deadbeef" }),
    );

    expect(response.status).toBe(401);
    expect(rateLimiterTake).not.toHaveBeenCalled();
    expect(recordIfNew).not.toHaveBeenCalled();
    expect(process).not.toHaveBeenCalled();
  });

  it("responds with 401 when header x-hub-signature-256 is omitted", async () => {
    const { deps } = buildDeps();
    const { POST } = createWebhookHandlers(deps);
    const rawBody = JSON.stringify(aMetaWebhook().build());

    const response = await POST(buildPostRequest({ rawBody, signature: null }));

    expect(response.status).toBe(401);
  });
});

describe("createWebhookHandlers — POST (parsing)", () => {
  it("returns 200 (not 4xx) when body is not JSON — log warn, no orchestrator", async () => {
    const { deps, process, logger } = buildDeps();
    const { POST } = createWebhookHandlers(deps);
    const rawBody = "this is not json";

    const response = await POST(
      buildPostRequest({ rawBody, signature: sign(rawBody) }),
    );

    expect(response.status).toBe(200);
    expect(process).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "whatsapp.webhook.body.not_json" }),
    );
  });

  it("returns 200 for payload not matching meta Webhook Schema (object other)", async () => {
    const { deps, process } = buildDeps();
    const { POST } = createWebhookHandlers(deps);
    const rawBody = JSON.stringify(
      aMetaWebhook().withObject("instagram").build(),
    );

    const response = await POST(
      buildPostRequest({ rawBody, signature: sign(rawBody) }),
    );

    expect(response.status).toBe(200);
    expect(process).not.toHaveBeenCalled();
  });

  it("returns 200 and does not process the payload for status-update (no messages field)", async () => {
    const { deps, process, rateLimiterTake } = buildDeps();
    const { POST } = createWebhookHandlers(deps);
    const rawBody = JSON.stringify(aMetaWebhook().asStatusUpdate().build());

    const response = await POST(
      buildPostRequest({ rawBody, signature: sign(rawBody) }),
    );

    expect(response.status).toBe(200);
    expect(rateLimiterTake).not.toHaveBeenCalled();
    expect(process).not.toHaveBeenCalled();
  });
});

describe("createWebhookHandlers — POST (rate limit + idempotency + happy path)", () => {
  it("at rate limit excess it returns 200 silent and does not want the orchestrator", async () => {
    const { deps, process, recordIfNew, rateLimiterTake, logger } = buildDeps({
      rateLimiter: {
        take: vi.fn().mockResolvedValue({ allowed: false, remaining: 0 }),
      },
    });
    void rateLimiterTake;
    const { POST } = createWebhookHandlers(deps);
    const rawBody = JSON.stringify(
      aMetaWebhook().withPhone("+33611111111").withText("hello").build(),
    );

    const response = await POST(
      buildPostRequest({ rawBody, signature: sign(rawBody) }),
    );

    expect(response.status).toBe(200);
    expect(recordIfNew).not.toHaveBeenCalled();
    expect(process).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "whatsapp.webhook.rate_limited",
        phone: maskPhone("+33611111111"),
      }),
    );
  });

  it("in case of duplicate messageId returns 200 and does not call the orchestrator", async () => {
    const { deps, process, logger } = buildDeps({
      idempotency: {
        recordIfNew: vi.fn().mockResolvedValue({ isNew: false }),
      },
    });
    const { POST } = createWebhookHandlers(deps);
    const rawBody = JSON.stringify(
      aMetaWebhook().withMessageId("wamid.dup").withText("hi").build(),
    );

    const response = await POST(
      buildPostRequest({ rawBody, signature: sign(rawBody) }),
    );

    expect(response.status).toBe(200);
    expect(process).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "whatsapp.webhook.duplicate",
        messageId: "wamid.dup",
      }),
    );
  });

  it("happy path - will process with correct message and correlationId after scheduling", async () => {
    const { deps, process, schedule, recordIfNew } = buildDeps();
    const { POST } = createWebhookHandlers(deps);
    const rawBody = JSON.stringify(
      aMetaWebhook()
        .withPhone("+33611111111")
        .withMessageId("wamid.fresh")
        .withText("Bonjour")
        .build(),
    );

    const response = await POST(
      buildPostRequest({ rawBody, signature: sign(rawBody) }),
    );

    expect(response.status).toBe(200);
    expect(recordIfNew).toHaveBeenCalledWith("wamid.fresh");
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(process).toHaveBeenCalledWith(
      { from: "+33611111111", messageId: "wamid.fresh", text: "Bonjour" },
      { correlationId: "test-correlation-id" },
    );
  });

  it("the error thrown by the process goes to logger.error and does not leak to response (response has already been sent)", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("orchestrator boom"));
    const { deps, logger } = buildDeps({ process: failing });
    const { POST } = createWebhookHandlers(deps);
    const rawBody = JSON.stringify(
      aMetaWebhook().withMessageId("wamid.boom").build(),
    );

    const response = await POST(
      buildPostRequest({ rawBody, signature: sign(rawBody) }),
    );

    await new Promise((r) => setImmediate(r));

    expect(response.status).toBe(200);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "whatsapp.webhook.process.failed" }),
    );
  });
});

describe("createWebhookHandlers — POST (burst z prawdziwym limiterem)", () => {
  it("pierwsze 3 wiadomości od tego samego telefonu przechodzą, 4. jest blokowana", async () => {
    // Arrange
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
    const { POST } = createWebhookHandlers(deps);

    // Act
    for (let i = 0; i < 4; i++) {
      const rawBody = JSON.stringify(
        aMetaWebhook()
          .withPhone("+33611111111")
          .withMessageId(`wamid-burst-${i}`)
          .withText("hello")
          .build(),
      );
      await POST(buildPostRequest({ rawBody, signature: sign(rawBody) }));
    }

    // Assert
    expect(processFn).toHaveBeenCalledTimes(3);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "whatsapp.webhook.rate_limited",
        phone: maskPhone("+33611111111"),
      }),
    );
  });

  it("niezależne buckety — 3 wiadomości z A i 3 z B, wszystkie 6 przechodzą", async () => {
    // Arrange
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
    const { POST } = createWebhookHandlers(deps);

    // Act
    let idx = 0;
    for (const phone of ["+33611111111", "+33622222222"]) {
      for (let i = 0; i < 3; i++) {
        const rawBody = JSON.stringify(
          aMetaWebhook()
            .withPhone(phone)
            .withMessageId(`wamid-iso-${idx++}`)
            .withText("hello")
            .build(),
        );
        await POST(buildPostRequest({ rawBody, signature: sign(rawBody) }));
      }
    }

    // Assert — wszystkie 6 przeszły, brak rate_limited
    expect(processFn).toHaveBeenCalledTimes(6);
  });
});

function sign(rawBody: string): string {
  return (
    "sha256=" + createHmac("sha256", APP_SECRET).update(rawBody).digest("hex")
  );
}

function buildPostRequest(args: {
  rawBody: string;
  signature?: string | null;
}): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (args.signature !== null && args.signature !== undefined) {
    headers.set("x-hub-signature-256", args.signature);
  }
  return new Request(WATHSAPP_API_URL, {
    method: "POST",
    headers,
    body: args.rawBody,
  });
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

function buildDeps(overrides: Partial<WebhookDeps> = {}): {
  deps: WebhookDeps;
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

  const deps: WebhookDeps = {
    appSecret: APP_SECRET,
    verifyToken: VERIFY_TOKEN,
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
