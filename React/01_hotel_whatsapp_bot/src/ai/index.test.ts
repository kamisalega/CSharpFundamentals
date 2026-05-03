import { describe, expect, it } from "vitest";
import { server } from "../../tests/msw/server";
import { http, HttpResponse } from "msw";
import { getAiProvider } from ".";

function anthropicIntentFixture(intent: string) {
  return {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-4-6",
    stop_reason: "tool_use",
    content: [
      {
        type: "tool_use",
        id: "toolu_1",
        name: "set_intent",
        input: { intent, confidence: 0.9 },
      },
    ],
  };
}

function openAiIntentFixture(intent: string) {
  return {
    id: "chatcmpl-1",
    object: "chat.completion",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: {
                name: "set_intent",
                arguments: JSON.stringify({ intent, confidence: 0.9 }),
              },
            },
          ],
        },
        finish_reason: "tool_calls",
      },
    ],
  };
}

const classifyArgs = {
  userMessage: "Bonjour",
  conversationContext: [],
  correlationId: "test",
  now: new Date(),
  currentState: "GREETING",
} as const;

describe("getAiProvider", () => {
  it("routes to the Anthropic endpoint when AI_PROVIDER is claude", async () => {
    let anthropicHit = false;
    server.use(
      http.post("https://api.anthropic.com/v1/messages", () => {
        anthropicHit = true;
        return HttpResponse.json(anthropicIntentFixture("greet"));
      }),
    );
    const provider = getAiProvider({
      AI_PROVIDER: "claude",
      ANTHROPIC_API_KEY: "test-key",
      OPENAI_API_KEY: "unused",
    });

    await provider.classifyIntent(classifyArgs);

    expect(anthropicHit).toBe(true);
  });

  it("routes to the OpenAI endpoint when AI_PROVIDER is openai", async () => {
    let openAiHit = false;
    server.use(
      http.post("https://api.openai.com/v1/chat/completions", () => {
        openAiHit = true;
        return HttpResponse.json(openAiIntentFixture("greet"));
      }),
    );
    const provider = getAiProvider({
      AI_PROVIDER: "openai",
      ANTHROPIC_API_KEY: "unused",
      OPENAI_API_KEY: "test-key",
    });

    await provider.classifyIntent(classifyArgs);

    expect(openAiHit).toBe(true);
  });
});
