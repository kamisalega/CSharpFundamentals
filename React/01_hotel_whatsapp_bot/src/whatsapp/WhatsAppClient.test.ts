import { describe, expect, it, vi } from "vitest";
import { server } from "../../tests/msw/server";
import { http, HttpResponse } from "msw";
import {
  createWhatsAppClient,
  WhatsAppClientConfig,
  WhatsAppSendError,
} from "./WhatsAppClient";

const BASE_URL = "https://graph.facebook.com/v25.0/";
const PHONE_NUMBER_ID = "212121212121"
const PHONE_NUMBER = "+33611111111"

const ENDPOINT = `${BASE_URL}/${PHONE_NUMBER_ID}/messages`;

function makeClient(overrides: Partial<WhatsAppClientConfig> = {}) {
  return createWhatsAppClient({
    baseUrl: BASE_URL,
    phoneNumberId: PHONE_NUMBER_ID,
    accessToken:
      "accessToken_Token_Test",
    timeoutMs: 50,
    retryDelaysMs: [1, 2, 3],
    ...overrides,
  });
}

describe("WhatsAppClient.sendText", () => {
  it("Posts the correct payload and Bearer token to the Meta messages endpoint", async () => {
    let capturedRequest: Request | undefined;
    server.use(
      http.post(ENDPOINT, async ({ request }) => {
        capturedRequest = request.clone();
        return HttpResponse.json({ messages: [{ id: "wamid.ok" }] });
      }),
    );

    const client = makeClient();

    await client.sendText({ to: PHONE_NUMBER, text: "Bonjour" });

    expect(capturedRequest).toBeDefined();
    expect(capturedRequest!.headers.get("authorization")).toBe(
      "Bearer accessToken_Token_Test",
    );

    expect(capturedRequest!.headers.get("content-type")).toContain(
      "application/json",
    );

    const body = await capturedRequest!.json();
    expect(body).toEqual({
      messaging_product: "whatsapp",
      to: PHONE_NUMBER,
      type: "text",
      text: { body: "Bonjour" },
    });
  });

  it("does not retry 4xx errors and throws WhatsAppSendError with code=CLIENT_ERROR", async () => {
    const requestCount = vi.fn();
    server.use(
      http.post(ENDPOINT, () => {
        requestCount();
        return HttpResponse.json({ error: "invalid token" }, { status: 401 });
      }),
    );
    const client = makeClient();

    const err = await client
      .sendText({ to: PHONE_NUMBER, text: "Hi" })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(WhatsAppSendError);
    expect((err as WhatsAppSendError).code).toBe("CLIENT_ERROR");
    expect((err as WhatsAppSendError).status).toBe(401);
    expect((err as WhatsAppSendError).attempts).toBe(1);
    expect(requestCount).toHaveBeenCalledTimes(1);
  });

  it("retries 5xx errors with backoff and returns success on the 3rd attempt", async () => {
    let call = 0;
    server.use(
      http.post(ENDPOINT, () => {
        call += 1;
        if (call < 3) {
          return HttpResponse.json({ error: "boom" }, { status: 503 });
        }
        return HttpResponse.json({ messages: [{ id: "wamid.eventual" }] });
      }),
    );
    const client = makeClient();

    const result = await client.sendText({
      to: PHONE_NUMBER,
      text: "Persisted",
    });

    expect(result.messageId).toBe("wamid.eventual");
    expect(call).toBe(3);
  });

  it("gives up after exhausting the retry (4 attempts for delaysMs.length=3) and throws SERVER_ERROR", async () => {
    const requestCount = vi.fn();
    server.use(
      http.post(ENDPOINT, () => {
        requestCount();
        return HttpResponse.json({ error: "boom" }, { status: 500 });
      }),
    );
    const client = makeClient(); // retryDelaysMs: [1, 2, 3] -> 4 proby

    const err = await client
      .sendText({ to: PHONE_NUMBER, text: "Hi" })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(WhatsAppSendError);
    expect((err as WhatsAppSendError).code).toBe("SERVER_ERROR");
    expect((err as WhatsAppSendError).attempts).toBe(4);
    expect(requestCount).toHaveBeenCalledTimes(4);
  });

  it("aborts request after timeoutMs and does not retry the timeout", async () => {
    const requestCount = vi.fn();
    server.use(
      http.post(ENDPOINT, async () => {
        requestCount();
        await new Promise((r) => setTimeout(r, 200));
        return HttpResponse.json({ messages: [{ id: "wamid.toolate" }] });
      }),
    );
    const client = makeClient({ timeoutMs: 20 });

    const err = await client
      .sendText({ to: PHONE_NUMBER, text: "Hi" })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(WhatsAppSendError);
    expect((err as WhatsAppSendError).code).toBe("TIMEOUT");
    expect((err as WhatsAppSendError).attempts).toBe(1);
    expect(requestCount).toHaveBeenCalledTimes(1);
  });
});
