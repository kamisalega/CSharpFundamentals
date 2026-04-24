import { describe, expect, it } from "vitest";
import { aMetaWebhook } from "../../tests/fixtures/meta-webhook";
import { extractFirstTextMessage, metaWebhookSchema } from "./webhookSchema";

describe("metaWebhookSchema", () => {
  it("parses a valid inbound text message payload", () => {
    const raw = aMetaWebhook()
      .withPhone("+33611111111")
      .withMessageId("wamid.abc123")
      .withText("Bonjour")
      .build();

    const result = metaWebhookSchema.safeParse(raw);
    expect(result.success).toBe(true);
  });

  it("parses a status-update payload that has no messages field", () => {
    const raw = aMetaWebhook().asStatusUpdate().build();
    const result = metaWebhookSchema.safeParse(raw);

    expect(result.success).toBe(true);
  });

  it("rejects a payload where object is not whatsapp_business_account", () => {
    const raw = aMetaWebhook().withObject("instagram").build();

    const result = metaWebhookSchema.safeParse(raw);

    expect(result.success).toBe(false);
  });
});

describe("extractFirstTextMessage", () => {
  it("returns phone, messageId and text body from the first message", () => {
    const raw = aMetaWebhook()
      .withPhone("+33611111111")
      .withMessageId("wamid.abc123")
      .withText("Bonjour, je voudrais réserver une chambre")
      .build();

    const webhook = metaWebhookSchema.parse(raw);

    const message = extractFirstTextMessage(webhook);

    expect(message).toEqual({
      from: "+33611111111",
      messageId: "wamid.abc123",
      text: "Bonjour, je voudrais réserver une chambre",
    });
  });

  it("returns null for a status-update payload with no messages", () => {
    const raw = aMetaWebhook().asStatusUpdate().build();

    const webhook = metaWebhookSchema.parse(raw);

    const message = extractFirstTextMessage(webhook);

    expect(message).toBeNull();
  });
});
