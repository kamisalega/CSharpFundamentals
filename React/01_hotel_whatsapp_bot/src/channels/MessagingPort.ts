export type TemplateKey =
  | "WELCOME_MENU"
  | "DATE_PICKER_FLOW"
  | "GUESTS_PICKER_FLOW"
  | "GUEST_INFO_FLOW"
  | "ROOM_DETAIL_CARD"
  | "PAY_CTA"
  | "BOOKING_CONFIRMED";

export type FlowKey = "DATE_PICKER" | "GUESTS_PICKER" | "GUEST_INFO";

export type SendTextArgs = Readonly<{
  to: string;
  text: string;
}>;

export type SendTemplateArgs = Readonly<{
  to: string;
  templateKey: TemplateKey;
  variables: Record<string, string>;
}>;

export type SendFlowArgs = Readonly<{
  to: string;
  flowKey: FlowKey;
  flowToken: string;
  cta: string;
  variables?: Record<string, string>;
}>;

export type SendMessageResult = Readonly<{
  messageId: string;
}>;

export type MessagingPort = Readonly<{
  sendText(args: SendTextArgs): Promise<SendMessageResult>;
  sendTemplate(args: SendTemplateArgs): Promise<SendMessageResult>;
  sendFlow(args: SendFlowArgs): Promise<SendMessageResult>;
}>;
