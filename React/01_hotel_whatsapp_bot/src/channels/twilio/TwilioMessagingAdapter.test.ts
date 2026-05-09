import { describe, expect, it, vi } from "vitest";
import { TemplateKey } from "../MessagingPort";
import { createTwilioMessagingAdapter } from "./TwilioMessagingAdapter";
import { TwilioMessagingAdapterConfig } from "./TwilioMessagingConfig";
import { server } from "../../../tests/msw/server";
import { http, HttpResponse } from "msw";
import { TwilioSendError } from "./TwilioMessagingErrors";

const ACCOUNT_SID = "AC00000000000000000000000000000000";
const AUTH_TOKEN = "auth_token_test_1234567890abcdef";
const FROM = "whatsapp:+14155238886";

const CONTENT_SID_MAP: Record<TemplateKey, string> = {
  WELCOME_MENU: "HX_WELCOME",
  DATE_PICKER_FLOW: "HX_DATE_PICKER",
  GUESTS_PICKER_FLOW: "HX_GUESTS_PICKER",
  GUEST_INFO_FLOW: "HX_GUEST_INFO",
  ROOM_DETAIL_CARD: "HX_ROOM_DETAIL",
  PAY_CTA: "HX_PAY_CTA",
  BOOKING_CONFIRMED: "HX_CONFIRMED",
};

const ENDPOINT = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`;

function makeAdapter(overrides: Partial<TwilioMessagingAdapterConfig> = {}) {
  return createTwilioMessagingAdapter({
    accountSid: ACCOUNT_SID,
    authToken: AUTH_TOKEN,
    from: FROM,
    contentSidMap: CONTENT_SID_MAP,
    timeoutMs: 50,
    retryDelaysMs: [1, 2, 3],
    ...overrides,
  });
}

describe("TwilioMessagingAdapter.sendTemplate", () => {
  it("posts ContentSid and ContentVariables to the Twilio messages endpoint", async () => {
    let capturedBody: URLSearchParams | undefined;

    server.use(
      http.post(ENDPOINT, async ({ request }) => {
        capturedBody = new URLSearchParams(await request.text());
        return HttpResponse.json({ sid: "SM_test_template" });
      }),
    );

    const adapter = makeAdapter();
    const result = await adapter.sendTemplate({
      to: "+33611111111",
      templateSid: "WELCOME_MENU",
      variables: { "1": "Bonjour" },
    });

    expect(result.messageId).toBe("SM_test_template");
    expect(capturedBody?.get("To")).toBe("whatsapp:+33611111111");
    expect(capturedBody?.get("From")).toBe(FROM);
    expect(capturedBody?.get("ContentSid")).toBe("HX_WELCOME");
    expect(JSON.parse(capturedBody?.get("ContentVariables") ?? "{}")).toEqual({
      "1": "Bonjour",
    });
  });

  it("omits ContentVariables when variables object is empty", async () => {
    let capturedBody: URLSearchParams | undefined;

    server.use(
      http.post(ENDPOINT, async ({ request }) => {
        capturedBody = new URLSearchParams(await request.text());
        return HttpResponse.json({ sid: "SM_no_vars" });
      }),
    );

    const adapter = makeAdapter();
    await adapter.sendTemplate({
      to: "+33611111111",
      templateSid: "BOOKING_CONFIRMED",
      variables: {},
    });

    expect(capturedBody?.has("ContentVariables")).toBe(false);
  });
});

describe("TwilioMessagingAdapter.sendFlow", () => {
  it("maps flowKey to the correct template ContentSid and includes flowToken and cta", async () => {
    let capturedBody: URLSearchParams | undefined;

    server.use(
      http.post(ENDPOINT, async ({ request }) => {
        capturedBody = new URLSearchParams(await request.text());
        return HttpResponse.json({ sid: "SM_flow" });
      }),
    );

    const adapter = makeAdapter();
    const result = await adapter.sendFlow({
      to: "+33611111111",
      flowId: "DATE_PICKER",
      flowToken: "tok_abc123",
      cta: "Choisir les dates",
    });

    expect(result.messageId).toBe("SM_flow");
    expect(capturedBody?.get("ContentSid")).toBe("HX_DATE_PICKER");
    const vars = JSON.parse(capturedBody?.get("ContentVariables") ?? "{}");
    expect(vars.flow_token).toBe("tok_abc123");
    expect(vars.cta).toBe("Choisir les dates");
  });
});

describe("TwilioMessagingAdapter.sendText", () => {
  it("posts plain Body to the Twilio messages endpoint", async () => {
    let capturedBody: URLSearchParams | undefined;

    server.use(
      http.post(ENDPOINT, async ({ request }) => {
        capturedBody = new URLSearchParams(await request.text());
        return HttpResponse.json({ sid: "SM_text" });
      }),
    );

    const adapter = makeAdapter();
    const result = await adapter.sendText({
      to: "+33611111111",
      text: "Votre réservation est confirmée.",
    });

    expect(result.messageId).toBe("SM_text");
    expect(capturedBody?.get("Body")).toBe("Votre réservation est confirmée.");
    expect(capturedBody?.get("To")).toBe("whatsapp:+33611111111");
  });
});

describe("TwilioMessagingAdapter retry behaviour", () => {
  it("does not retry 4xx errors and throws TwilioSendError with code=CLIENT_ERROR", async () => {
    const requestCount = vi.fn();

    server.use(
      http.post(ENDPOINT, () => {
        requestCount();
        return HttpResponse.json({ message: "Unauthorized" }, { status: 401 });
      }),
    );

    const adapter = makeAdapter();
    const err = await adapter
      .sendTemplate({
        to: "+33611111111",
        templateSid: "WELCOME_MENU",
        variables: {},
      })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(TwilioSendError);
    expect((err as TwilioSendError).code).toBe("CLIENT_ERROR");
    expect((err as TwilioSendError).status).toBe(401);
    expect((err as TwilioSendError).attempts).toBe(1);
    expect(requestCount).toHaveBeenCalledTimes(1);
  });

  it("retries 5xx errors and succeeds on the third attempt", async () => {
    let call = 0;

    server.use(
      http.post(ENDPOINT, () => {
        call += 1;
        if (call < 3) {
          return HttpResponse.json(
            { message: "Internal Error" },
            { status: 503 },
          );
        }
        return HttpResponse.json({ sid: "SM_eventual" });
      }),
    );

    const adapter = makeAdapter();
    const result = await adapter.sendTemplate({
      to: "+33611111111",
      templateSid: "WELCOME_MENU",
      variables: {},
    });

    expect(result.messageId).toBe("SM_eventual");
    expect(call).toBe(3);
  });

  it("gives up after exhausting retries and throws SERVER_ERROR", async () => {
    const requestCount = vi.fn();

    server.use(
      http.post(ENDPOINT, () => {
        requestCount();
        return HttpResponse.json({ message: "boom" }, { status: 500 });
      }),
    );

    const adapter = makeAdapter();
    
    const err = await adapter
      .sendTemplate({
        to: "+33611111111",
        templateSid: "WELCOME_MENU",
        variables: {},
      })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(TwilioSendError);
    expect((err as TwilioSendError).code).toBe("SERVER_ERROR");
    expect((err as TwilioSendError).attempts).toBe(4);
    expect(requestCount).toHaveBeenCalledTimes(4);
  });

  it("times out and throws TIMEOUT without retrying", async () => {
    const requestCount = vi.fn();

    server.use(
      http.post(ENDPOINT, async () => {
        requestCount();
        await new Promise((r) => setTimeout(r, 200));
        return HttpResponse.json({ sid: "SM_toolate" });
      }),
    );

    const adapter = makeAdapter({ timeoutMs: 20 });

    const err = await adapter
      .sendTemplate({
        to: "+33611111111",
        templateSid: "WELCOME_MENU",
        variables: {},
      })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(TwilioSendError);
    expect((err as TwilioSendError).code).toBe("TIMEOUT");
    expect(requestCount).toHaveBeenCalledTimes(1);
  });

  it("times out and throws TIMEOUT without retrying", async () => {
    const requestCount = vi.fn();

    server.use(
      http.post(ENDPOINT, async () => {
        requestCount();
        await new Promise((r) => setTimeout(r, 200));
        return HttpResponse.json({ sid: "SM_toolate" });
      }),
    );

    const adapter = makeAdapter({ timeoutMs: 20 });

    const err = await adapter
      .sendTemplate({
        to: "+33611111111",
        templateSid: "WELCOME_MENU",
        variables: {},
      })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(TwilioSendError);
    expect((err as TwilioSendError).code).toBe("TIMEOUT");
    expect((err as TwilioSendError).attempts).toBe(1);
    expect(requestCount).toHaveBeenCalledTimes(1);
  });
});
