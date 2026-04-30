import { RateLimiter } from "@/security/rateLimit";
import {
  extractFirstTextMessage,
  InboundTextMessage,
  metaWebhookSchema,
} from "./webhookSchema";
import { verifyMetaSignature } from "./signature";
import { maskPhone } from "@/security/maskPII";

export type IdempotencyStore = Readonly<{
  recordIfNew(externalId: string): Promise<{ isNew: boolean }>;
}>;

export type ProcessInboundMessage = (
  message: InboundTextMessage,
  ctx: Readonly<{ correlationId: string }>,
) => void | Promise<void>;

export type WebhookLogger = Readonly<{
  info: (obj: object) => void;
  warn: (obj: object) => void;
  error: (obj: object) => void;
}>;

export type WebhookDeps = Readonly<{
  appSecret: string;
  verifyToken: string;
  rateLimiter: RateLimiter;
  idempotency: IdempotencyStore;
  process: ProcessInboundMessage;
  schedule: (fn: () => void | Promise<void>) => void;
  logger: WebhookLogger;
  getCorrelationId: () => string;
}>;
export type WebhookHandlers = Readonly<{
  GET: (request: Request) => Promise<Response>;
  POST: (request: Request) => Promise<Response>;
}>;

export function createWebhookHandlers(deps: WebhookDeps): WebhookHandlers {
  async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (
      mode === "subscribe" &&
      token === deps.verifyToken &&
      challenge !== null
    ) {
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    deps.logger.warn({
      event: "whatsapp.webhook.verify.failed",
      correlationId: deps.getCorrelationId(),
    });
    return new Response(null, { status: 403 });
  }

  async function POST(request: Request): Promise<Response> {
    const correlationId = deps.getCorrelationId();
    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256");

    if (
      !verifyMetaSignature({
        rawBody,
        signatureHeader: signature,
        secret: deps.appSecret,
      })
    ) {
      deps.logger.warn({
        event: "whatsapp.webhook.signature.invalid",
        correlationId,
      });
      return new Response(null, { status: 401 });
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      deps.logger.warn({
        event: "whatsapp.webhook.body.not_json",
        correlationId,
      });
      return new Response(null, { status: 200 });
    }

    const schemaResult = metaWebhookSchema.safeParse(parsedJson);
    if (!schemaResult.success) {
      deps.logger.warn({
        event: "whatsapp.webhook.schema.invalid",
        correlationId,
      });
      return new Response(null, { status: 200 });
    }

    const message = extractFirstTextMessage(schemaResult.data);
    if (!message) {
      return new Response(null, { status: 200 });
    }

    const decision = await deps.rateLimiter.take(message.from);
    if (!decision.allowed) {
      deps.logger.warn({
        event: "whatsapp.webhook.rate_limited",
        phone: maskPhone(message.from),
        correlationId,
      });
      return new Response(null, { status: 200 });
    }

    const { isNew } = await deps.idempotency.recordIfNew(message.messageId);
    if (!isNew) {
      deps.logger.info({
        event: "whatsapp.webhook.duplicate",
        messageId: message.messageId,
        correlationId,
      });
      return new Response(null, { status: 200 });
    }

    deps.schedule(async () => {
      try {
        await deps.process(message, { correlationId });
      } catch (err) {
        deps.logger.error({
          event: "whatsapp.webhook.process.failed",
          err,
          correlationId,
        });
      }
    });

    return new Response(null, { status: 200 });
  }

  return { GET, POST };
}
