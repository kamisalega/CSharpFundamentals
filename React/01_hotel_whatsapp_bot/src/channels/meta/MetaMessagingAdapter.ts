import {
  MessagingPort,
  SendTemplateArgs,
  SendTextArgs,
  SendFlowArgs,
} from "@/channels/MessagingPort";
import { WhatsAppClient } from "@/whatsapp/WhatsAppClient";

export function createMetaMessagingAdapter(
  client: WhatsAppClient,
): MessagingPort {
  return {
    async sendText(args: SendTextArgs) {
      return client.sendText(args);
    },
    async sendTemplate(_args: SendTemplateArgs) {
      throw new Error(
        "MetaMessagingAdapter: sendTemplate not supported — Meta channel uses the AI orchestrator path",
      );
    },
    async sendFlow(_args: SendFlowArgs) {
      throw new Error(
        "MetaMessagingAdapter: sendFlow not supported — WhatsApp Flows run on the Twilio channel",
      );
    },
  };
}
