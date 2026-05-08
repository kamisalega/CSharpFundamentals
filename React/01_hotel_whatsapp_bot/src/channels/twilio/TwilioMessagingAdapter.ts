import twilio from "twilio";
import type {
  MessagingPort,
  SendFlowArgs,
  SendTemplateArgs,
  SendTextArgs,
} from "@/channels/MessagingPort";
import { TwilioMessagingAdapterConfig } from "./TwilioMessagingConfig";
import { TwilioSendError } from "./TwilioMessagingErrors";
import {
  DEFAULT_RETRY_DELAYS_MS,
  DEFAULT_TIMEOUT_MS,
  FLOW_TEMPLATE_KEY,
  isRetriableStatus,
  isTwilioRestError,
  sleep,
} from "./TwilioMessagingHelpers";

export function createTwilioMessagingAdapter(
  config: TwilioMessagingAdapterConfig,
): MessagingPort {
  const client = twilio(config.accountSid, config.authToken);
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryDelaysMs = config.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const maxAttempts = retryDelaysMs.length + 1;

  type CreateParams =
    | { to: string; body: string }
    | { to: string; contentSid: string; contentVariables?: string };

  async function doCreate(
    params: CreateParams,
    attempt: number,
  ): Promise<{ messageId: string }> {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(
          new TwilioSendError({
            code: "TIMEOUT",
            message: `Twilio send timed out after ${timeoutMs}ms`,
            attempts: attempt,
          }),
        );
      }, timeoutMs);
    });

    try {
      const message = await Promise.race([
        client.messages.create({ from: config.from, ...params }),
        timeoutPromise,
      ]);
      return { messageId: message.sid };
    } catch (error) {
      if (error instanceof TwilioSendError) throw error;

      if (isTwilioRestError(error)) {
        const status = error.status;
        if (isRetriableStatus(status)) {
          throw new TwilioSendError({
            code: "SERVER_ERROR",
            message: `Twilio responded ${status}: ${error.message}`,
            attempts: attempt,
            status,
            cause: error,
          });
        }
        throw new TwilioSendError({
          code: "CLIENT_ERROR",
          message: `Twilio responded ${status}: ${error.message}`,
          attempts: attempt,
          status,
          cause: error,
        });
      }

      throw new TwilioSendError({
        code: "NETWORK_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
        attempts: attempt,
        cause: error,
      });
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  async function withRetry(
    params: CreateParams,
  ): Promise<{ messageId: string }> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await doCreate(params, attempt);
      } catch (error) {
        lastError = error;
        if (!(error instanceof TwilioSendError)) throw error;
        const retriable =
          error.code === "SERVER_ERROR" || error.code === "NETWORK_ERROR";
        const hasAttemptsLeft = attempt < maxAttempts;
        if (!retriable || !hasAttemptsLeft) throw error;
        await sleep(retryDelaysMs[attempt - 1]!);
      }
    }

    throw lastError;
  }

  return {
    async sendText(args: SendTextArgs) {
      return withRetry({ to: `whatsapp:${args.to}`, body: args.text });
    },

    async sendTemplate(args: SendTemplateArgs) {
      const contentSid = config.contentSidMap[args.templateKey];
      return withRetry({
        to: `whatsapp:${args.to}`,
        contentSid,
        ...(Object.keys(args.variables).length > 0
          ? { contentVariables: JSON.stringify(args.variables) }
          : {}),
      });
    },

    async sendFlow(args: SendFlowArgs) {
      const templateKey = FLOW_TEMPLATE_KEY[args.flowKey];
      const contentSid = config.contentSidMap[templateKey];
      const contentVariables = JSON.stringify({
        cta: args.cta,
        flow_token: args.flowToken,
        ...args.variables,
      });
      return withRetry({
        to: `whatsapp:${args.to}`,
        contentSid,
        contentVariables,
      });
    },
  };
}
