import { z } from "zod";

const metaMessageSchema = z.object({
  from: z.string(),
  id: z.string(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
});

const metaWebhookValueSchema = z.object({
  messaging_product: z.string(),
  metadata: z.object({
    display_phone_number: z.string(),
    phone_number_id: z.string(),
  }),
  messages: z.array(metaMessageSchema).optional(),
});

export const metaWebhookSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          field: z.string(),
          value: metaWebhookValueSchema,
        }),
      ),
    }),
  ),
});

export type MetaWebhook = z.infer<typeof metaWebhookSchema>;

export type InboundTextMessage = Readonly<{
  from: string;
  messageId: string;
  text: string;
}>;

export function extractFirstTextMessage(
  webhook: MetaWebhook,
): InboundTextMessage | null {
  const message = webhook.entry[0]?.changes[0]?.value.messages?.[0];
  if (!message || message.type !== "text" || !message.text) {
    return null;
  }

  return {
    from: message.from,
    messageId: message.id,
    text: message.text.body,
  };
}
