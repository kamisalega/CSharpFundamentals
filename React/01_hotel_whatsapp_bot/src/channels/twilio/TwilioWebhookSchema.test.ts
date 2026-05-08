import { describe, expect, it } from "vitest";
import { parseTwilioWebhook, toTwilioInboundMessage, twilioWebhookSchema } from "./TwilioWebhookSchema";

const BASE = {
  MessageSid: "SMxxxxxx",
  From: "whatsapp:+33611111111",
  To: "whatsapp:+14155238886",
  Body: "Bonjour",
};

describe("twilioWebhookSchema", () => {
  it("parses a minimal inbound text webhook", () => {
    const result = twilioWebhookSchema.safeParse(BASE);
    expect(result.success).toBe(true);
  });

  it("defaults Body to empty string when missing", () => {
    const { Body: _, ...withoutBody } = BASE;
    const result = twilioWebhookSchema.safeParse(withoutBody);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.Body).toBe("");
  });

  it("parses a button reply with ButtonText and ButtonPayload", () => {
    const raw = {
      ...BASE,
      MessageType: "button",
      ButtonText: "Réserver une chambre",
      ButtonPayload: "BOOK_ROOM",
    };
    const result = twilioWebhookSchema.safeParse(raw);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ButtonPayload).toBe("BOOK_ROOM");
    }
  });

  it("rejects a payload missing MessageSid", () => {
    const { MessageSid: _, ...withoutSid } = BASE;
    const result = twilioWebhookSchema.safeParse(withoutSid);
    expect(result.success).toBe(false);
  });

  it("rejects a payload missing From", () => {
    const { From: _, ...withoutFrom } = BASE;
    const result = twilioWebhookSchema.safeParse(withoutFrom);
    expect(result.success).toBe(false);
  });
});

describe("toTwilioInboundMessage", () => {
  it("strips the whatsapp: prefix from From and To", () => {
    const webhook = parseTwilioWebhook(BASE);
    const msg = toTwilioInboundMessage(webhook);
    expect(msg.from).toBe("+33611111111");
    expect(msg.to).toBe("+14155238886");
  });

  it("defaults messageType to text when MessageType is absent", () => {
    const webhook = parseTwilioWebhook(BASE);
    const msg = toTwilioInboundMessage(webhook);
    expect(msg.messageType).toBe("text");
  });

  it("maps MessageSid, body, buttonPayload, profileName", () => {
    const raw = {
      ...BASE,
      MessageType: "button",
      ButtonPayload: "BOOK_ROOM",
      ProfileName: "Marie",
    };
    const webhook = parseTwilioWebhook(raw);
    const msg = toTwilioInboundMessage(webhook);
    expect(msg.messageSid).toBe("SMxxxxxx");
    expect(msg.buttonPayload).toBe("BOOK_ROOM");
    expect(msg.profileName).toBe("Marie");
  });
});
