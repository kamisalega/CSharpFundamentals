import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

describe("parsEnv", () => {
  it("returns the parsed configuration for the correct env", () => {
    const raw = {
      NODE_ENV: "development",
      DATABASE_URL: "file:./dev.db",
      AI_PROVIDER: "claude",
      ANTHROPIC_API_KEY: "sk-ant-test",
      OPENAI_API_KEY: "",
      META_WHATSAPP_PHONE_NUMBER_ID: "123",
      META_WHATSAPP_ACCESS_TOKEN: "token",
      META_WHATSAPP_APP_SECRET: "secret",
      META_WHATSAPP_VERIFY_TOKEN: "verify",
      STRIPE_SECRET_KEY: "sk_test_x",
      STRIPE_WEBHOOK_SECRET: "whsec_x",
      AUTH_SECRET: "test-secret-minimum-32-characters-xx",
      APP_BASE_URL: "http://localhost:3000",
    };

    const env = parseEnv(raw);

    expect(env.AI_PROVIDER).toBe("claude");
    expect(env.APP_BASE_URL).toBe("http://localhost:3000");
  });

  it("throws when ANTHROPIC_API_KEY is missing when AI_PROVIDER=claude", () => {
    const raw = {
      NODE_ENV: "development",
      DATABASE_URL: "file:./dev.db",
      AI_PROVIDER: "claude",
      ANTHROPIC_API_KEY: "",
      OPENAI_API_KEY: "",
      META_WHATSAPP_PHONE_NUMBER_ID: "123",
      META_WHATSAPP_PHONE_ID: "123",
      META_WHATSAPP_ACCESS_TOKEN: "token",
      META_WHATSAPP_APP_SECRET: "secret",
      META_WHATSAPP_VERIFY_TOKEN: "verify",
      STRIPE_SECRET_KEY: "sk_test_x",
      STRIPE_WEBHOOK_SECRET: "whsec_x",
      AUTH_SECRET: "test-secret-minimum-32-characters-xx",
      APP_BASE_URL: "http://localhost:3000",
    };

    expect(() => parseEnv(raw)).toThrow(/ANTHROPIC_API_KEY/);
  });

  it("throws when AI_PROVIDER is not in the allowlist", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "development",
        DATABASE_URL: "file:./dev.db",
        AI_PROVIDER: "gemini",
        ANTHROPIC_API_KEY: "x",
        OPENAI_API_KEY: "",
        META_WHATSAPP_PHONE_NUMBER_ID: "1",
        META_WHATSAPP_PHONE_ID: "1",
        META_WHATSAPP_ACCESS_TOKEN: "1",
        META_WHATSAPP_APP_SECRET: "1",
        META_WHATSAPP_VERIFY_TOKEN: "1",
        STRIPE_SECRET_KEY: "1",
        STRIPE_WEBHOOK_SECRET: "1",
        AUTH_SECRET: "test-secret-minimum-32-characters-xx",
        APP_BASE_URL: "http://localhost:3000",
      }),
    ).toThrow(/AI_PROVIDER/);
  });

  it("throws when APP_BASE_URL is not a URL", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "development",
        DATABASE_URL: "file:./dev.db",
        AI_PROVIDER: "claude",
        ANTHROPIC_API_KEY: "x",
        OPENAI_API_KEY: "",
        META_WHATSAPP_PHONE_NUMBER_ID: "1",
        META_WHATSAPP_ACCESS_TOKEN: "1",
        META_WHATSAPP_APP_SECRET: "1",
        META_WHATSAPP_VERIFY_TOKEN: "1",
        STRIPE_SECRET_KEY: "1",
        STRIPE_WEBHOOK_SECRET: "1",
        AUTH_SECRET: "test-secret-minimum-32-characters-xx",
        APP_BASE_URL: "not-url",
      }),
    ).toThrow(/APP_BASE_URL/);
  });
});
