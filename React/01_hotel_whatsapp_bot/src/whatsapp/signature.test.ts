import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { verifyMetaSignature } from "./signature";

describe("verifyMetaSignature", () => {
  const secret = "test-app-secret";
  function sign(body: string): string {
    return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  }

  it("returns true for a signature computed with the same secret and body", () => {
    const body = '{"object":"whatsapp_business_account","entry":[]}';
    const header = sign(body);

    const result = verifyMetaSignature({
      rawBody: body,
      signatureHeader: header,
      secret,
    });

    expect(result).toBe(true);
  });

  it("returns false when the body has been tampered with", () => {
    const original = '{"object":"whatsapp_business_account","entry":[]}';
    const tampered = '{"object":"whatsapp_business_account","entry":[1]}';
    const header = sign(original);

    const result = verifyMetaSignature({
      rawBody: tampered,
      signatureHeader: header,
      secret,
    });

    expect(result).toBe(false);
  });

  it("returns false when the header is missing the sha256=prefix", () => {
    const body = '{"a": 1}';
    const headerWithoutPrefix = createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    const result = verifyMetaSignature({
      rawBody: body,
      signatureHeader: headerWithoutPrefix,
      secret,
    });

    expect(result).toBe(false);
  });

  it("returns false when the signature header is null", () => {
    const result = verifyMetaSignature({
      rawBody: '{"a":1}',
      signatureHeader: null,
      secret,
    });

    expect(result).toBe(false);
  });

  it("returns false (and does not throw) when the signature length differs from expected", () => {
    const result = verifyMetaSignature({
      rawBody: '{"a":1}',
      signatureHeader: "sha256=deadbeef",
      secret,
    });

    expect(result).toBe(false);
  });
});
