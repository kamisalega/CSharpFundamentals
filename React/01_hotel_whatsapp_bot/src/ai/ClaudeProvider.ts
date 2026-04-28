import { err, ok, Result } from "neverthrow";
import { z } from "zod";
import {
  AiError,
  AiProvider,
  ClassifyIntentArgs,
  GenerateReplyArgs,
  GenerateReplyOutput,
} from "./AiProvider";
import { buildUserMessage, SYSTEM_PROMPT } from "./prompts/system";
import { sanitizeUserMessage } from "./sanitize";
import {
  IntentResponse,
  intentResponseSchema,
  ToolCall,
  toolCallSchema,
} from "./schemas";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_DELAYS_MS = [500, 2_000] as const;
const DEFAULT_MAX_TOKENS = 1024;

export type ClaudeProviderConfig = Readonly<{
  apiKey: string;
  model?: string;
  timeoutMs?: number;
  retryDelaysMs?: readonly number[];
  maxTokens?: number;
}>;

// --- Anthropic response parsing -------------------------------------------

const textBlockSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

const toolUseBlockSchema = z.object({
  type: z.literal("tool_use"),
  id: z.string(),
  name: z.string(),
  input: z.unknown(),
});

const contentBlockSchema = z.discriminatedUnion("type", [
  textBlockSchema,
  toolUseBlockSchema,
]);

const anthropicMessageSchema = z.object({
  content: z.array(contentBlockSchema),
});

// --- Tool definitions for the Anthropic API -------------------------------

const SET_INTENT_TOOL = {
  name: "set_intent",
  description:
    "Classify the user's intent in the hotel booking conversation. ALWAYS call this exactly once.",
  input_schema: {
    type: "object",
    properties: {
      intent: {
        type: "string",
        enum: [
          "greet",
          "collect_dates",
          "modify_slots",
          "select_room",
          "collect_guest_info",
          "offer_extras",
          "request_summary",
          "confirm_booking",
          "manage_existing",
          "faq",
          "handoff_request",
          "unknown",
        ],
      },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      slots: { type: "object", additionalProperties: true },
    },
    required: ["intent", "confidence"],
  },
  cache_control: { type: "ephemeral" },
} as const;

const HOTEL_TOOLS = [
  {
    name: "check_availability",
    description: "Check room availability for given dates and guest count.",
    input_schema: {
      type: "object",
      properties: {
        checkIn: { type: "string", format: "date" },
        checkOut: { type: "string", format: "date" },
        guests: { type: "integer", minimum: 1 },
      },
      required: ["checkIn", "checkOut", "guests"],
    },
  },
  {
    name: "get_pricing",
    description: "Get pricing for a specific room and dates.",
    input_schema: {
      type: "object",
      properties: {
        roomId: { type: "string", minLength: 1 },
        checkIn: { type: "string", format: "date" },
        checkOut: { type: "string", format: "date" },
        guests: { type: "integer", minimum: 1 },
        withBreakfast: { type: "boolean" },
      },
      required: ["roomId", "checkIn", "checkOut", "guests", "withBreakfast"],
    },
  },
  {
    name: "hold_reservation",
    description: "Place a 10-minute hold on a room.",
    input_schema: {
      type: "object",
      properties: {
        roomId: { type: "string", minLength: 1 },
        checkIn: { type: "string", format: "date" },
        checkOut: { type: "string", format: "date" },
        guests: { type: "integer", minimum: 1 },
      },
      required: ["roomId", "checkIn", "checkOut", "guests"],
    },
  },
  {
    name: "send_payment_link",
    description: "Send a Stripe payment link for the given reservation.",
    input_schema: {
      type: "object",
      properties: {
        reservationId: { type: "string", minLength: 1 },
      },
      required: ["reservationId"],
    },
  },
  {
    name: "escalate_to_human",
    description: "Escalate the conversation to a human agent.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string", minLength: 1 },
      },
      required: ["reason"],
    },
    cache_control: { type: "ephemeral" },
  },
] as const;

// --- Helpers --------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isServerError(status: number): boolean {
  return status >= 500;
}

// --- Factory --------------------------------------------------------------

export function createClaudeProvider(config: ClaudeProviderConfig): AiProvider {
  const model = config.model ?? DEFAULT_MODEL;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryDelaysMs = config.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
  const maxAttempts = retryDelaysMs.length + 1;

  async function doRequest(
    body: object,
    correlationId: string,
    attempt: number,
  ): Promise<Result<unknown, AiError>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "x-api-key": config.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "content-type": "application/json",
          "x-request-id": correlationId,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const status = response.status;
        const text = await response.text().catch(() => "");

        if (status === 429) {
          return err(
            new AiError({
              code: "RATE_LIMITED",
              message: `Anthropic responded 429: ${text.slice(0, 200)}`,
              attempts: attempt,
              status,
            }),
          );
        }

        return err(
          new AiError({
            code: "PROVIDER_ERROR",
            message: `Anthropic responded ${status}: ${text.slice(0, 200)}`,
            attempts: attempt,
            status,
          }),
        );
      }

      let json: unknown;
      try {
        json = await response.json();
      } catch (cause) {
        return err(
          new AiError({
            code: "INVALID_RESPONSE",
            message: "Anthropic returned non-JSON body",
            attempts: attempt,
            cause,
          }),
        );
      }
      return ok(json);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return err(
          new AiError({
            code: "TIMEOUT",
            message: `Anthropic request timed out after ${timeoutMs}ms`,
            attempts: attempt,
            cause: error,
          }),
        );
      }
      return err(
        new AiError({
          code: "NETWORK_ERROR",
          message:
            error instanceof Error ? error.message : "Unknown network error",
          attempts: attempt,
          cause: error,
        }),
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async function callWithRetry(
    body: object,
    correlationId: string,
  ): Promise<Result<unknown, AiError>> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await doRequest(body, correlationId, attempt);
      if (result.isOk()) return result;

      const e = result.error;
      const retriable =
        (e.code === "PROVIDER_ERROR" && isServerError(e.status ?? 0)) ||
        e.code === "NETWORK_ERROR";
      const isLast = attempt >= maxAttempts;

      if (isLast || !retriable) return err(e);

      const delay = retryDelaysMs[attempt - 1] ?? 0;
      await sleep(delay);
    }

    return err(
      new AiError({
        code: "PROVIDER_ERROR",
        message: "exhausted retries (unreachable)",
        attempts: maxAttempts,
      }),
    );
  }

  function buildBaseBody(extra: object): object {
    return {
      model,
      max_tokens: maxTokens,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      ...extra,
    };
  }

  async function classifyIntent(
    args: ClassifyIntentArgs,
  ): Promise<Result<IntentResponse, AiError>> {
    const sanitized = sanitizeUserMessage(args.userMessage);
    const fenced = buildUserMessage(sanitized);

    const body = buildBaseBody({
      tools: [SET_INTENT_TOOL],
      tool_choice: { type: "tool", name: "set_intent" },
      messages: [
        ...args.conversationContext.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user", content: fenced },
      ],
    });

    const raw = await callWithRetry(body, args.correlationId);
    if (raw.isErr()) return err(raw.error);

    const parsed = anthropicMessageSchema.safeParse(raw.value);
    if (!parsed.success) {
      return err(
        new AiError({
          code: "INVALID_RESPONSE",
          message: `Anthropic response did not match schema: ${parsed.error.message}`,
          attempts: maxAttempts,
        }),
      );
    }

    const block = parsed.data.content.find(
      (b) => b.type === "tool_use" && b.name === "set_intent",
    );
    if (!block || block.type !== "tool_use") {
      return err(
        new AiError({
          code: "INVALID_RESPONSE",
          message: "Anthropic did not return a set_intent tool_use block",
          attempts: maxAttempts,
        }),
      );
    }

    const intent = intentResponseSchema.safeParse(block.input);
    if (!intent.success) {
      return err(
        new AiError({
          code: "INVALID_RESPONSE",
          message: `set_intent input failed validation: ${intent.error.message}`,
          attempts: maxAttempts,
        }),
      );
    }

    return ok(intent.data);
  }

  async function generateReply(
    args: GenerateReplyArgs,
  ): Promise<Result<GenerateReplyOutput, AiError>> {
    const messages: Array<{ role: "user" | "assistant"; content: string }> =
      args.conversationContext.map((m) => ({
        role: m.role,
        content: m.content,
      }));

    if (args.toolResults.length > 0) {
      const summary = args.toolResults
        .map((tr) => `[${tr.name}] => ${JSON.stringify(tr.result)}`)
        .join("\n");
      messages.push({
        role: "user",
        content: `<tool_results>\n${summary}\n</tool_results>`,
      });
    }

    const body = buildBaseBody({
      tools: HOTEL_TOOLS,
      tool_choice: { type: "auto" },
      messages,
    });

    const raw = await callWithRetry(body, args.correlationId);
    if (raw.isErr()) return err(raw.error);

    const parsed = anthropicMessageSchema.safeParse(raw.value);
    if (!parsed.success) {
      return err(
        new AiError({
          code: "INVALID_RESPONSE",
          message: `Anthropic response did not match schema: ${parsed.error.message}`,
          attempts: maxAttempts,
        }),
      );
    }

    const textParts: string[] = [];
    const toolCalls: ToolCall[] = [];

    for (const blk of parsed.data.content) {
      if (blk.type === "text") {
        textParts.push(blk.text);
        continue;
      }
      const tc = toolCallSchema.safeParse({ name: blk.name, args: blk.input });
      if (!tc.success) {
        return err(
          new AiError({
            code: "VALIDATION_ERROR",
            message: `Tool call ${blk.name} failed validation: ${tc.error.message}`,
            attempts: maxAttempts,
          }),
        );
      }
      toolCalls.push(tc.data);
    }

    return ok({ text: textParts.join("").trim(), toolCalls });
  }

  return { classifyIntent, generateReply };
}
