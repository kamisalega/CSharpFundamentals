import { Env } from "@/config/env";
import { AiProvider } from "./AiProvider";
import { createClaudeProvider } from "./ClaudeProvider";
import { createOpenAiProvider } from "./OpenAiProvider";

  export function getAiProvider(
    env: Pick<Env, "AI_PROVIDER" | "ANTHROPIC_API_KEY" | "OPENAI_API_KEY">,
  ): AiProvider {
    switch (env.AI_PROVIDER) {
      case "claude":
        return createClaudeProvider({ apiKey: env.ANTHROPIC_API_KEY });
      case "openai":
        return createOpenAiProvider({ apiKey: env.OPENAI_API_KEY });
    }
  }