export type MetaWebhookFixture = {
  object: string;
  entry: unknown[];
};

type Builder = {
  withPhone: (phone: string) => Builder;
  withMessageId: (id: string) => Builder;
  withText: (text: string) => Builder;
  asStatusUpdate: () => Builder;
  withObject: (object: string) => Builder;
  build: () => MetaWebhookFixture;
};

export function aMetaWebhook(): Builder {
  let phone = "+33611111111";
  let messageId = "wamid.HBgLMTY1MDU1NTEyMzQVAgARGBI";
  let text = "Bonjour, je voudrais réserver";
  let isStatusUpdate = false;
  let object = "whatsapp_business_account";

  const builder: Builder = {
    withPhone(p) {
      phone = p;
      return builder;
    },
    withMessageId(id) {
      messageId = id;
      return builder;
    },
    withText(t) {
      text = t;
      return builder;
    },
    asStatusUpdate() {
      isStatusUpdate = true;
      return builder;
    },
    withObject(o) {
      object = o;
      return builder;
    },
    build() {
      const value = isStatusUpdate
        ? {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "15550555555",
              phone_number_id: "123456789",
            },
            statuses: [
              {
                id: messageId,
                status: "delivered",
                timestamp: "1609459200",
                recipient_id: phone,
              },
            ],
          }
        : {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "15550555555",
              phone_number_id: "123456789",
            },
            contacts: [
              {
                profile: { name: "Test User" },
                wa_id: phone.replace("+", ""),
              },
            ],
            messages: [
              {
                from: phone,
                id: messageId,
                timestamp: "1609459200",
                type: "text",
                text: { body: text },
              },
            ],
          };

      return {
        object,
        entry: [
          {
            id: "entry-business-id-1",
            changes: [{ field: "messages", value }],
          },
        ],
      };
    },
  };

  return builder;
}
