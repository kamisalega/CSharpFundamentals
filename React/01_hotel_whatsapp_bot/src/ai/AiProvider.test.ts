import { describe, expect, it } from "vitest";
import { AiError } from "./AiProvider";

describe("AiError", () => {
  it("exposes code, message, attempts and status", () => {
    const error = new AiError({
      code: "PROVIDER_ERROR",
      message: "Anthropic returned 500",
      attempts: 2,
      status: 500,
    });

    expect(error.code).toBe("PROVIDER_ERROR");
    expect(error.message).toBe("Anthropic returned 500");
    expect(error.attempts).toBe(2);
    expect(error.status).toBe(500);
    expect(error.name).toBe("AiError");
  });

  it("preserves the underlying cause", () => {
    const cause = new Error("ECONNRESET");

    const error = new AiError({
      code: "NETWORK_ERROR",
      message: "Connection reset",
      attempts: 1,
      cause,
    });

    expect(error.cause).toBe(cause);
  });

  it("is an instance of Error", () => {
    const error = new AiError({
      code: "TIMEOUT",
      message: "boom",
      attempts: 3,
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AiError);
  });
});
