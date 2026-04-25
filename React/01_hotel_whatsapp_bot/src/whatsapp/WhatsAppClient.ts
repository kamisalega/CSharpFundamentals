import { z } from "zod";

export type SendTextArgs = Readonly<{
  to: string;
  text: string;
}>;

export type SendTextResult = Readonly<{
  messageId: string;
}>;

export type WhatsAppClient = Readonly<{
  sendText(args: SendTextArgs): Promise<SendTextResult>;
}>;

// --- Bledy ----------------------------------------------------------------

export type WhatsAppSendErrorCode =
  | "TIMEOUT"
  | "CLIENT_ERROR"
  | "SERVER_ERROR"
  | "NETWORK_ERROR"
  | "INVALID_RESPONSE";

export class WhatsAppSendError extends Error {
  public readonly code: WhatsAppSendErrorCode;
  public readonly attempts: number;
  public readonly status: number | undefined;

  constructor(args: {
    code: WhatsAppSendErrorCode;
    message: string;
    attempts: number;
    status?: number;
    cause?: unknown;
  }) {
    super(args.message, { cause: args.cause });
    this.name = "WhatsAppSendError";
    this.code = args.code;
    this.attempts = args.attempts;
    this.status = args.status;
  }
}

// --- Helpers --------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_RETRY_DELAYS_MS = [500, 1_500, 4_500] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetriableStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

export type WhatsAppClientConfig = Readonly<{
  baseUrl: string;
  phoneNumberId: string;
  accessToken: string;
  timeoutMs?: number;
  retryDelaysMs?: readonly number[];
}>;

// --- Schema odpowiedzi Meta (Zod na granicy!) -----------------------------

const metaSendResponseSchema = z.object({
  messages: z.array(z.object({ id: z.string().min(1) })).min(1),
});

export function createWhatsAppClient(
  config: WhatsAppClientConfig,
): WhatsAppClient {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryDelaysMs = config.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const maxAttempts = retryDelaysMs.length + 1;

  async function doRequest(
    args: SendTextArgs,
    attempt: number,
  ): Promise<SendTextResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(
        `${config.baseUrl}/${config.phoneNumberId}/messages`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: args.to,
            type: "text",
            text: { body: args.text },
          }),
        },
      );

      if (!response.ok) {
        const status = response.status;
        const bodyText = await response.text().catch(() => "");

        if (isRetriableStatus(status)) {
          throw new WhatsAppSendError({
            code: "SERVER_ERROR",
            message: `Meta responded ${status}: ${bodyText.slice(0, 200)}`,
            attempts: attempt,
            status,
          });
        }
        throw new WhatsAppSendError({
          code: "CLIENT_ERROR",
          message: `Meta respoinded ${status}: ${bodyText.slice(0, 200)}`,
          attempts: attempt,
          status,
        });
      }

      const json: unknown = await response.json();
      const parsed = metaSendResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new WhatsAppSendError({
          code: "INVALID_RESPONSE",
          message: `Meta response did not match schema: ${parsed.error.message}`,
          attempts: attempt,
        });
      }

      return { messageId: parsed.data?.messages[0]!.id };
    } catch (error) {
      if (error instanceof WhatsAppSendError) throw error;

      if (error instanceof Error && error.name === "AbortError") {
        throw new WhatsAppSendError({
          code: "TIMEOUT",
          message: `Meta send timed out after ${timeoutMs}ms`,
          attempts: attempt,
          cause: error,
        });
      }

      throw new WhatsAppSendError({
        code: "NETWORK_ERROR",
        message:
          error instanceof Error ? error.message : "Unknown network error",
        attempts: attempt,
        cause: error,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async function sendText(args: SendTextArgs): Promise<SendTextResult> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await doRequest(args, attempt);
      } catch (error) {
        lastError = error;
        if (!(error instanceof WhatsAppSendError)) throw error;
        const retriable =
          error.code === "SERVER_ERROR" || error.code === "NETWORK_ERROR";
        const hasAttemptsLeft = attempt < maxAttempts;
        if (!retriable || !hasAttemptsLeft) throw error;

        await sleep(retryDelaysMs[attempt - 1]!);
      }
    }
    throw lastError;
  }

  return { sendText };
}
