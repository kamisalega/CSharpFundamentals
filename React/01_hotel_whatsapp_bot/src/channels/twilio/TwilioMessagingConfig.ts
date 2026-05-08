import { TemplateKey } from "../MessagingPort";

export type TwilioMessagingAdapterConfig = Readonly<{
  accountSid: string;
  authToken: string;
  from: string;
  contentSidMap: Record<TemplateKey, string>;
  timeoutMs?: number;
  retryDelaysMs?: readonly number[];
}>;
