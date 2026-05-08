import { describe, expect, it } from "vitest";
import { createMetaMessagingAdapter } from "./MetaMessagingAdapter";

const mockClient: WhatsAppClient = {
  sendText: vi.fn().mockResolvedValue({ messageId: "wamid.ABC123" }),
};

describe("MetaMessagingAdapter", () => {
  it("sendText delegates to WhatsAppClient", async () => {
    const adapter = createMetaMessagingAdapter(mockClient);
    const result = await adapter.sendText({
      to: "+33611111111",
      text: "Bonjour",
    });
    expect(result.messageId).toBe("wamid.ABC123");
    expect(mockClient.sendText).toHaveBeenCalledWith({
      to: "+33611111111",
      text: "Bonjour",
    });
  });

  it("sendTemplate throws unsupported error", async () => {
    const adapter = createMetaMessagingAdapter(mockClient);
    await expect(
      adapter.sendTemplate({
        to: "+33611111111",
        templateKey: "WELCOME_MENU",
        variables: {},
      }),
    ).rejects.toThrow("MetaMessagingAdapter: sendTemplate not supported");
  });

  it("sendFlow throws unsupported error", async () => {
    const adapter = createMetaMessagingAdapter(mockClient);
    await expect(
      adapter.sendFlow({
        to: "+33611111111",
        flowKey: "DATE_PICKER",
        flowToken: "tok_abc",
        cta: "Choisir les dates",
      }),
    ).rejects.toThrow("MetaMessagingAdapter: sendFlow not supported");
  });
});
