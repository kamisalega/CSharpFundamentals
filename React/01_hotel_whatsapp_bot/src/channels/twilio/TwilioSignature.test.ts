import { describe, expect, it } from "vitest";
import { validateTwilioSignature } from "./TwilioSignature";
import { createHmac } from "crypto";

const AUTH_TOKEN = "test-auth-token-1234567890abcdef";
const URL = "https://myapp.com/api/twilio/whatsapp/webhook";

function sign(
  authToken: string,
  url: string,
  params: Record<string, string>,
): string {
  const sorted = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
  let message = url;
  for (const [key, value] of sorted) {
    message += key + value;
  }
  return createHmac("sha1", authToken).update(message, "utf8").digest("base64");
}

const SAMPLE_PARAMS = {
  MessageSid: "SMxxxxxx",
  From: "whatsapp:+33611111111",
  To: "whatsapp:+14155238886",
  Body: "Bonjour",
};

describe("validateTwilioSignature", () => {
  it("returns true for a valid signature", () => {
    const signature = sign(AUTH_TOKEN, URL, SAMPLE_PARAMS);
    expect(
      validateTwilioSignature({
        authToken: AUTH_TOKEN,
        url: URL,
        params: SAMPLE_PARAMS,
        signature,
      }),
    ).toBe(true);
  });

  it("returns false when params have been tampered with", () => {
    const signature = sign(AUTH_TOKEN, URL, SAMPLE_PARAMS);
    expect(
      validateTwilioSignature({
        authToken: AUTH_TOKEN,
        url: URL,
        params: { ...SAMPLE_PARAMS, Body: "Tampered" },
        signature,
      }),
    ).toBe(false);
  });

  it("returns false when the URL differs from the signed URL", () => {
    const signature = sign(AUTH_TOKEN, URL, SAMPLE_PARAMS);
    expect(
      validateTwilioSignature({
        authToken: AUTH_TOKEN,
        url: "https://evil.com/api/twilio/whatsapp/webhook",
        params: SAMPLE_PARAMS,
        signature,
      }),
    ).toBe(false);
  });

  it("returns false when signature is null", () => {
    expect(
      validateTwilioSignature({
        authToken: AUTH_TOKEN,
        url: URL,
        params: SAMPLE_PARAMS,
        signature: null,
      }),
    ).toBe(false);
  });

  it("returns false when signature is an empty string", () => {
    expect(
      validateTwilioSignature({
        authToken: AUTH_TOKEN,
        url: URL,
        params: SAMPLE_PARAMS,
        signature: "",
      }),
    ).toBe(false);
  });

  it("returns false when the auth token is wrong", () => {
    const signature = sign("wrong-token", URL, SAMPLE_PARAMS);
    expect(
      validateTwilioSignature({
        authToken: AUTH_TOKEN,
        url: URL,
        params: SAMPLE_PARAMS,
        signature,
      }),
    ).toBe(false);
  });
});
