import { createHmac } from "crypto";

export type TwilioWebhookFixture = {
  params: Record<string, string>;
  formBody: string;
  sign(authToken: string, url: string): string;
  toRequest(opts: { authToken: string; url: string }): Request;
};

function buildFixture(params: Record<string, string>): TwilioWebhookFixture {
  const formBody = new URLSearchParams(params).toString();

  function sign(authToken: string, url: string): string {
    const sorted = Object.entries(params).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    let message = url;
    for (const [key, value] of sorted) {
      message += key + value;
    }
    return createHmac("sha1", authToken)
      .update(message, "utf8")
      .digest("base64");
  }

  function toRequest(opts: { authToken: string; url: string }): Request {
    return new Request(opts.url, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": sign(opts.authToken, opts.url),
      },
      body: formBody,
    });
  }

  return { params, formBody, sign, toRequest };
}

export type TwilioTextOpts = {
  phone?: string;
  to?: string;
  body?: string;
  messageSid?: string;
};

export function aTwilioInboundText(
  opts: TwilioTextOpts = {},
): TwilioWebhookFixture {
  return buildFixture({
    MessageSid: opts.messageSid ?? "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    From: `whatsapp:${opts.phone ?? "+33611111111"}`,
    To: `whatsapp:${opts.to ?? "+14155238886"}`,
    Body: opts.body ?? "Bonjour",
    NumMedia: "0",
    MessageType: "text",
  });
}

export type TwilioButtonReplyOpts = {
  phone?: string;
  to?: string;
  buttonText?: string;
  buttonPayload?: string;
  messageSid?: string;
};

export function aTwilioButtonReply(
  opts: TwilioButtonReplyOpts = {},
): TwilioWebhookFixture {
  return buildFixture({
    MessageSid: opts.messageSid ?? "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    From: `whatsapp:${opts.phone ?? "+33611111111"}`,
    To: `whatsapp:${opts.to ?? "+14155238886"}`,
    Body: "",
    NumMedia: "0",
    MessageType: "button",
    ButtonText: opts.buttonText ?? "Réserver une chambre",
    ButtonPayload: opts.buttonPayload ?? "book_room",
  });
}

export type TwilioListReplyOpts = {
  phone?: string;
  to?: string;
  selectionId?: string;
  messageSid?: string;
};

export function aTwilioListReply(
  opts: TwilioListReplyOpts = {},
): TwilioWebhookFixture {
  return buildFixture({
    MessageSid: opts.messageSid ?? "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    From: `whatsapp:${opts.phone ?? "+33611111111"}`,
    To: `whatsapp:${opts.to ?? "+14155238886"}`,
    Body: "",
    NumMedia: "0",
    MessageType: "button",
    ButtonPayload: opts.selectionId ?? "book_room",
  });
}

export type TwilioFlowCompletionOpts = {
  phone?: string;
  to?: string;
  flowToken?: string;
  payload?: unknown;
  messageSid?: string;
};

export function aTwilioFlowCompletion(
  opts: TwilioFlowCompletionOpts = {},
): TwilioWebhookFixture {
  return buildFixture({
    MessageSid: opts.messageSid ?? "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    From: `whatsapp:${opts.phone ?? "+33611111111"}`,
    To: `whatsapp:${opts.to ?? "+14155238886"}`,
    Body: "",
    NumMedia: "0",
    MessageType: "button",
    ButtonPayload: opts.flowToken ?? "flow-token-123",
  });
}
