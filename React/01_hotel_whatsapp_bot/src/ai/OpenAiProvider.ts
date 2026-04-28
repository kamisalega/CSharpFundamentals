import { err, ok, Result } from "neverthrow";
import {
  AiError,
  AiProvider,
  ClassifyIntentArgs,
  GenerateReplyArgs,
  GenerateReplyOutput,
} from "./AiProvider";
import {
  IntentResponse,
  intentResponseSchema,
  ToolCall,
  toolCallSchema,
} from "./schemas";
import { buildUserMessage, SYSTEM_PROMPT } from "./prompts/system";
import { sanitizeUserMessage } from "./sanitize";
import { z } from "zod";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_DELAYS_MS = [500, 2_000] as const;
const DEFAULT_MAX_TOKENS = 1024;

export type OpenAiProviderConfig = Readonly<{
  apiKey: string;
  model?: string;
  timeoutMs?: number;
  retryDelaysMs?: readonly number[];
  maxTokens?: number;
}>;

// --- OpenAI response parsing ----------------------------------------------

const toolCallItemSchema = z.object({
  id: z.string(),
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

const openAiMessageSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          role: z.literal("assistant"),
          content: z.string().nullable().optional(),
          tool_calls: z.array(toolCallItemSchema).nullable().optional(),
        }),
      }),
    )
    .min(1),
});

// --- Tool definitions for the OpenAI API ----------------------------------

const OPENAI_SET_INTENT_TOOL = {
  type: "function",
  function: {
    name: "set_intent",
    description:
      "Classify the user's intent in the hotel booking conversation. ALWAYS call this exactly once.",
    parameters: {
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
  },
} as const;

const OPENAI_HOTEL_TOOLS = [
  {
    type: "function",
    function: {
      name: "check_availability",
      description: "Check room availability for given dates and guest count.",
      parameters: {
        type: "object",
        properties: {
          checkIn: { type: "string", format: "date" },
          checkOut: { type: "string", format: "date" },
          guests: { type: "integer", minimum: 1 },
        },
        required: ["checkIn", "checkOut", "guests"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pricing",
      description: "Get pricing for a specific room and dates.",
      parameters: {
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
  },
  {
    type: "function",
    function: {
      name: "hold_reservation",
      description: "Place a 10-minute hold on a room.",
      parameters: {
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
  },
  {
    type: "function",
    function: {
      name: "send_payment_link",
      description: "Send a Stripe payment link for the given reservation.",
      parameters: {
        type: "object",
        properties: {
          reservationId: { type: "string", minLength: 1 },
        },
        required: ["reservationId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "escalate_to_human",
      description: "Escalate the conversation to a human agent.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", minLength: 1 },
        },
        required: ["reason"],
      },
    },
  },
] as const;

// --- Helpers --------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseToolArguments(
  name: string,
  argumentsJson: string,
  attempts: number,
): Result<unknown, AiError> {
  try {
    return ok(JSON.parse(argumentsJson));
  } catch (cause) {
    return err(
      new AiError({
        code: "INVALID_RESPONSE",
        message: `Tool call ${name} returned invalid JSON arguments`,
        attempts,
        cause,
      }),
    );
  }
}

// --- Factory --------------------------------------------------------------

export function createOpenAiProvider(config: OpenAiProviderConfig): AiProvider {
  const model = config.model ?? DEFAULT_MODEL;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryDelaysMs = config.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
  const maxAttempts = retryDelaysMs.length + 1;

  async function doRequest(
    body: object,
    attempt: number,
  ): Promise<Result<unknown, AiError>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(OPENAI_API_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
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
              message: `OpenAI responded 429: ${text.slice(0, 200)}`,
              attempts: attempt,
              status,
            }),
          );
        }

        return err(
          new AiError({
            code: "PROVIDER_ERROR",
            message: `OpenAI responded ${status}: ${text.slice(0, 200)}`,
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
            message: "OpenAI returned non-JSON body",
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
            message: `OpenAI request timed out after ${timeoutMs}ms`,
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
  ): Promise<Result<unknown, AiError>> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await doRequest(body, attempt);
      if (result.isOk()) return result;

      const e = result.error;
      const retriable =
        (e.code === "PROVIDER_ERROR" && (e.status ?? 0) >= 500) ||
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

  function parseResponse(
    raw: unknown,
  ): Result<z.infer<typeof openAiMessageSchema>, AiError> {
    const parsed = openAiMessageSchema.safeParse(raw);
    if (!parsed.success) {
      return err(
        new AiError({
          code: "INVALID_RESPONSE",
          message: `OpenAI response did not match schema: ${parsed.error.message}`,
          attempts: maxAttempts,
        }),
      );
    }
    return ok(parsed.data);
  }

  async function classifyIntent(
    args: ClassifyIntentArgs,
  ): Promise<Result<IntentResponse, AiError>> {
    const sanitized = sanitizeUserMessage(args.userMessage);
    const fenced = buildUserMessage(sanitized);

    const body = {
      model,
      max_tokens: maxTokens,
      tools: [OPENAI_SET_INTENT_TOOL],
      tool_choice: "required",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...args.conversationContext.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user", content: fenced },
      ],
    };

    const raw = await callWithRetry(body);
    if (raw.isErr()) return err(raw.error);

    const parsed = parseResponse(raw.value);
    if (parsed.isErr()) return err(parsed.error);

    const toolCalls = parsed.value.choices[0]?.message.tool_calls;
    const toolCall = toolCalls?.find((tc) => tc.function.name === "set_intent");
    if (!toolCall) {
      return err(
        new AiError({
          code: "INVALID_RESPONSE",
          message: "OpenAI did not return a set_intent tool call",
          attempts: maxAttempts,
        }),
      );
    }

    const argsResult = parseToolArguments(
      "set_intent",
      toolCall.function.arguments,
      maxAttempts,
    );
    if (argsResult.isErr()) return err(argsResult.error);

    const intent = intentResponseSchema.safeParse(argsResult.value);
    if (!intent.success) {
      return err(
        new AiError({
          code: "INVALID_RESPONSE",
          message: `set_intent arguments failed validation: ${intent.error.message}`,
          attempts: maxAttempts,
        }),
      );
    }

    return ok(intent.data);
  }

  async function generateReply(
    args: GenerateReplyArgs,
  ): Promise<Result<GenerateReplyOutput, AiError>> {
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
      ...args.conversationContext.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    if (args.toolResults.length > 0) {
      const summary = args.toolResults
        .map((tr) => `[${tr.name}] => ${JSON.stringify(tr.result)}`)
        .join("\n");
      messages.push({
        role: "user",
        content: `<tool_results>\n${summary}\n</tool_results>`,
      });
    }

    const body = {
      model,
      max_tokens: maxTokens,
      tools: OPENAI_HOTEL_TOOLS,
      tool_choice: "auto",
      messages,
    };

    const raw = await callWithRetry(body);
    if (raw.isErr()) return err(raw.error);

    const parsed = parseResponse(raw.value);
    if (parsed.isErr()) return err(parsed.error);

    const message = parsed.value.choices[0]?.message;
    const text = message?.content?.trim() ?? "";
    const toolCalls: ToolCall[] = [];

    for (const tc of message?.tool_calls ?? []) {
      const argsResult = parseToolArguments(
        tc.function.name,
        tc.function.arguments,
        maxAttempts,
      );
      if (argsResult.isErr()) return err(argsResult.error);

      const validated = toolCallSchema.safeParse({
        name: tc.function.name,
        args: argsResult.value,
      });
      if (!validated.success) {
        return err(
          new AiError({
            code: "VALIDATION_ERROR",
            message: `Tool call ${tc.function.name} failed validation: ${validated.error.message}`,
            attempts: maxAttempts,
          }),
        );
      }
      toolCalls.push(validated.data);
    }

    return ok({ text, toolCalls });
  }

  return { classifyIntent, generateReply };
}
