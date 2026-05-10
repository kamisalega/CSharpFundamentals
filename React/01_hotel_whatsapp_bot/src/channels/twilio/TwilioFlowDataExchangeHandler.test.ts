import {
  constants,
  createCipheriv,
  generateKeyPairSync,
  publicEncrypt,
  randomBytes,
} from "crypto";
import { describe, expect, it, vi } from "vitest";
import { FlowConversationEngine } from "@/flows/FlowConversationEngine";
import { FlowState } from "@/flows/FlowState";
import {
  createFlowDataExchangeHandlers,
  type FlowDataExchangeDeps,
} from "./TwilioFlowDataExchangeHandler";
import type { EncryptedFlowPayload } from "./TwilioFlowCrypto";
import { encryptFlowResponse } from "./TwilioFlowCrypto";
import { createHmac } from "crypto";

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "pkcs1", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const AUTH_TOKEN = "test-auth-token-1234567890abcdef";
const PUBLIC_URL = "https://example.test/api/twilio/whatsapp/flow-data";

function encryptPayload(plaintext: object): {
  payload: EncryptedFlowPayload;
  aesKey: Buffer;
  iv: Buffer;
} {
  const aesKey = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-128-gcm", aesKey, iv);
  const encryptedFlowData = Buffer.concat([
    cipher.update(JSON.stringify(plaintext), "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const encryptedAesKey = publicEncrypt(
    {
      key: publicKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    aesKey,
  );
  return {
    payload: {
      encrypted_aes_key: encryptedAesKey.toString("base64"),
      encrypted_flow_data: encryptedFlowData.toString("base64"),
      initial_vector: iv.toString("base64"),
    },
    aesKey,
    iv,
  };
}

function signJson(body: string): string {
  return createHmac("sha1", AUTH_TOKEN)
    .update(PUBLIC_URL + body, "utf8")
    .digest("base64");
}

function makeRequest(
  body: object,
  opts: { validSignature?: boolean } = {},
): Request {
  const rawBody = JSON.stringify(body);
  const signature =
    opts.validSignature === false ? "bad-sig" : signJson(rawBody);
  return new Request(PUBLIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-twilio-signature": signature,
    },
    body: rawBody,
  });
}

function buildDeps(
  overrides: Partial<FlowDataExchangeDeps> = {},
): FlowDataExchangeDeps {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const schedule = vi.fn((fn: () => void | Promise<void>) => {
    void fn();
  });

  const mockPrisma = {
    conversation: {
      findFirst: vi.fn().mockResolvedValue({
        id: "conv-1",
        phone: "+33611111111",
        locale: "fr",
        flowState: FlowState.AWAITING_DATES,
        flowToken: "tok-abc",
        flowSlots: JSON.stringify({}),
      }),
    },
  };

  const mockPorts = {
    messaging: {
      sendText: vi.fn(),
      sendTemplate: vi.fn(),
      sendFlow: vi.fn(),
    },
    pms: {
      searchAvailability: vi.fn(),
      holdReservation: vi.fn(),
    },
    payments: { createCheckoutLink: vi.fn() },
    email: { sendBookingConfirmation: vi.fn() },
    prisma: mockPrisma as unknown as FlowDataExchangeDeps["ports"]["prisma"],
    now: () => new Date("2026-05-09T12:00:00Z"),
  };

  return {
    privateKeyPem: privateKey,
    authToken: AUTH_TOKEN,
    publicUrl: PUBLIC_URL,
    engine: new FlowConversationEngine(),
    ports: mockPorts as unknown as FlowDataExchangeDeps["ports"],
    templateSids: {
      welcomeMenu: "HXwelcome",
      datePickerFlow: "HXdates",
      guestsPickerFlow: "HXguests",
      guestInfoFlow: "HXguestinfo",
      roomDetailCard: "HXroom",
      payCta: "HXpay",
      bookingConfirmed: "HXconfirmed",
    },
    flowIds: {
      datePicker: "FLdates",
      guestsPicker: "FLguests",
      guestInfo: "FLguestinfo",
    },
    schedule,
    logger,
    getCorrelationId: () => "test-cid",
    ...overrides,
  };
}

describe("createFlowDataExchangeHandlers — signature", () => {
  it("returns 401 for invalid signature", async () => {
    const deps = buildDeps();
    const { POST } = createFlowDataExchangeHandlers(deps);
    const { payload } = encryptPayload({
      version: "3.0",
      action: "ping",
      screen: "",
      data: {},
      flow_token: "",
    });
    const req = makeRequest(payload, { validSignature: false });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when x-twilio-signature header is absent", async () => {
    const deps = buildDeps();
    const { POST } = createFlowDataExchangeHandlers(deps);
    const { payload } = encryptPayload({
      version: "3.0",
      action: "ping",
      screen: "",
      data: {},
      flow_token: "",
    });
    const rawBody = JSON.stringify(payload);
    const req = new Request(PUBLIC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: rawBody,
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
  });
});

describe("createFlowDataExchangeHandlers — ping", () => {
  it("returns encrypted status:active for ping action", async () => {
    const deps = buildDeps();
    const { POST } = createFlowDataExchangeHandlers(deps);
    const { payload } = encryptPayload({
      version: "3.0",
      action: "ping",
      screen: "",
      data: {},
      flow_token: "",
    });

    const res = await POST(makeRequest(payload));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("encrypted_flow_data");
    expect(body).toHaveProperty("initial_vector");
  });
});

describe("createFlowDataExchangeHandlers — INIT", () => {
  it("returns 200 with encrypted initial screen data for INIT", async () => {
    const deps = buildDeps();
    const { POST } = createFlowDataExchangeHandlers(deps);
    const { payload } = encryptPayload({
      version: "3.0",
      action: "INIT",
      screen: "DATE_PICKER",
      data: {},
      flow_token: "tok-abc",
    });

    const res = await POST(makeRequest(payload));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("encrypted_flow_data");
  });
});

describe("createFlowDataExchangeHandlers — data_exchange", () => {
  it("returns encrypted SUCCESS response and schedules engine dispatch", async () => {
    const schedule = vi.fn((fn: () => void | Promise<void>) => {
      void fn();
    });
    const deps = buildDeps({ schedule });
    const { POST } = createFlowDataExchangeHandlers(deps);

    const { payload } = encryptPayload({
      version: "3.0",
      action: "data_exchange",
      screen: "DATE_PICKER",
      data: { check_in: "2026-06-10", check_out: "2026-06-13" },
      flow_token: "tok-abc",
    });

    const res = await POST(makeRequest(payload));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("encrypted_flow_data");
    expect(schedule).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when request body is not valid JSON", async () => {
    const deps = buildDeps();
    const { POST } = createFlowDataExchangeHandlers(deps);
    const rawBody = "not json{{";
    const signature = signJson(rawBody);
    const req = new Request(PUBLIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-twilio-signature": signature,
      },
      body: rawBody,
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when decryption fails (tampered payload)", async () => {
    const deps = buildDeps();
    const { POST } = createFlowDataExchangeHandlers(deps);
    const { payload } = encryptPayload({
      version: "3.0",
      action: "INIT",
      screen: "",
      data: {},
      flow_token: "",
    });
    const corrupted = Buffer.from(payload.encrypted_aes_key, "base64");
    corrupted[0] = 0xff;
    const tampered = {
      ...payload,
      encrypted_aes_key: corrupted.toString("base64"),
    };

    const res = await POST(makeRequest(tampered));

    expect(res.status).toBe(400);
  });
});
