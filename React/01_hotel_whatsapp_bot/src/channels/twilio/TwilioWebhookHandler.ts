import { maskPhone } from "@/security/maskPII";
import { validateTwilioSignature } from "./TwilioSignature";
import { toTwilioInboundMessage, TwilioInboundMessage, twilioWebhookSchema } from "./TwilioWebhookSchema";
import { RateLimiter } from "@/security/rateLimit/types";

  export type TwilioIdempotencyStore = Readonly<{
    recordIfNew(externalId: string): Promise<{ isNew: boolean }>;
  }>;

  export type ProcessTwilioInboundMessage = (
    message: TwilioInboundMessage,
    ctx: Readonly<{ correlationId: string }>,
  ) => void | Promise<void>;

  export type TwilioWebhookLogger = Readonly<{
    info: (obj: object) => void;
    warn: (obj: object) => void;
    error: (obj: object) => void;
  }>;

  export type TwilioWebhookDeps = Readonly<{
    authToken: string;
    publicUrl: string;
    rateLimiter: RateLimiter;
    idempotency: TwilioIdempotencyStore;
    process: ProcessTwilioInboundMessage;
    schedule: (fn: () => void | Promise<void>) => void;
    logger: TwilioWebhookLogger;
    getCorrelationId: () => string;
  }>;

  export type TwilioWebhookHandlers = Readonly<{
    POST: (request: Request) => Promise<Response>;
  }>;

  export function createTwilioWebhookHandlers(
    deps: TwilioWebhookDeps,
  ): TwilioWebhookHandlers {
    async function POST(request: Request): Promise<Response> {
      const correlationId = deps.getCorrelationId();
      const rawBody = await request.text();

      const params: Record<string, string> = {};
      for (const [key, value] of new URLSearchParams(rawBody)) {
        params[key] = value;
      }

      const signature = request.headers.get("x-twilio-signature");
      if (
        !validateTwilioSignature({
          authToken: deps.authToken,
          url: deps.publicUrl,
          params,
          signature,
        })
      ) {
        deps.logger.warn({
          event: "twilio.webhook.signature.invalid",
          correlationId,
        });
        return new Response(null, { status: 401 });
      }

      const schemaResult = twilioWebhookSchema.safeParse(params);
      if (!schemaResult.success) {
        deps.logger.warn({
          event: "twilio.webhook.schema.invalid",
          correlationId,
        });
        return new Response(null, { status: 200 });
      }

      const message = toTwilioInboundMessage(schemaResult.data);

      const decision = await deps.rateLimiter.take(message.from);
      if (!decision.allowed) {
        deps.logger.warn({
          event: "twilio.webhook.rate_limited",
          phone: maskPhone(message.from),
          correlationId,
        });
        return new Response(null, { status: 200 });
      }

      const { isNew } = await deps.idempotency.recordIfNew(message.messageSid);
      if (!isNew) {
        deps.logger.info({
          event: "twilio.webhook.duplicate",
          messageSid: message.messageSid,
          correlationId,
        });
        return new Response(null, { status: 200 });
      }

      deps.schedule(async () => {
        try {
          await deps.process(message, { correlationId });
        } catch (err) {
          deps.logger.error({
            event: "twilio.webhook.process.failed",
            err,
            correlationId,
          });
        }
      });

      return new Response(null, { status: 200 });
    }

    return { POST };
  }