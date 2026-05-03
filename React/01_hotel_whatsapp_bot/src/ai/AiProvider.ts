import { IntentResponse, ToolCall } from "./schemas";
import type { Result } from "neverthrow";

// --- Conversation history -------------------------------------------------

export type ConversationMessage = Readonly<{
  role: "user" | "assistant";
  content: string;
}>;

// --- classifyIntent -------------------------------------------------------

export type ClassifyIntentArgs = Readonly<{
  userMessage: string;
  conversationContext: ReadonlyArray<ConversationMessage>;
  correlationId: string;
  now: Date;
  currentState: string;
  availableRooms?: ReadonlyArray<Readonly<{ id: string; name: string }>>;
}>;

// --- generateReply --------------------------------------------------------

export type ToolResult = Readonly<{
  name: string;
  result: unknown;
}>;

export type GenerateReplyArgs = Readonly<{
  intent: IntentResponse;
  toolResults: ReadonlyArray<ToolResult>;
  conversationContext: ReadonlyArray<ConversationMessage>;
  correlationId: string;
  currentState: string;
  now: Date;
}>;

export type GenerateReplyOutput = Readonly<{
  text: string;
  toolCalls: ReadonlyArray<ToolCall>;
}>;

// --- Provider -------------------------------------------------------------

export type AiProvider = Readonly<{
  classifyIntent(
    args: ClassifyIntentArgs,
  ): Promise<Result<IntentResponse, AiError>>;
  generateReply(
    args: GenerateReplyArgs,
  ): Promise<Result<GenerateReplyOutput, AiError>>;
}>;

// --- Error ----------------------------------------------------------------

export type AiErrorCode =
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "PROVIDER_ERROR"
  | "INVALID_RESPONSE"
  | "NETWORK_ERROR"
  | "VALIDATION_ERROR";

export class AiError extends Error {
  public readonly code: AiErrorCode;
  public readonly attempts: number;
  public readonly status: number | undefined;

  constructor(args: {
    code: AiErrorCode;
    message: string;
    attempts: number;
    status?: number;
    cause?: unknown;
  }) {
    super(args.message, { cause: args.cause });
    this.name = "AiError";
    this.code = args.code;
    this.attempts = args.attempts;
    this.status = args.status;
  }
}
