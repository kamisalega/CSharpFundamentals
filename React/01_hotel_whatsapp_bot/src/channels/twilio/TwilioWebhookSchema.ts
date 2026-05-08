import { z } from "zod";

export const twilioWebhookSchema = z.object({
  MessageSid: z.string().min(1),
  From: z.string().min(1),
  To: z.string().min(1),
  Body: z.string().default(""),
  NumMedia: z.string().default("0"),
  ProfileName: z.string().optional(),
  WaId: z.string().optional(),
  ButtonText: z.string().optional(),
  ButtonPayload: z.string().optional(),
  OriginalRepliedMessageSid: z.string().optional(),
  MessageType: z.string().optional(),
  MessagingServiceSid: z.string().optional(),
});

export type TwilioWebhook = z.infer<typeof twilioWebhookSchema>;

export type TwilioInboundMessage = Readonly<{
  messageSid: string;
  from: string;
  to: string;
  body: string;
  messageType: string;
  buttonPayload: string | undefined;
  profileName: string | undefined;
}>;

export function parseTwilioWebhook(raw: unknown): TwilioWebhook {
  return twilioWebhookSchema.parse(raw);
}

export function toTwilioInboundMessage(
  webhook: TwilioWebhook,
): TwilioInboundMessage {
  return {
    messageSid: webhook.MessageSid,
    from: webhook.From.replace("whatsapp:", ""),
    to: webhook.To.replace("whatsapp:", ""),
    body: webhook.Body,
    messageType: webhook.MessageType ?? "text",
    buttonPayload: webhook.ButtonPayload,
    profileName: webhook.ProfileName,
  };
}
