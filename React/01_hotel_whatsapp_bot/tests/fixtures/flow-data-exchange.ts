import {
  constants,
  createCipheriv,
  createDecipheriv,
  createHmac,
  generateKeyPairSync,
  publicEncrypt,
  randomBytes,
} from "crypto";

const { publicKey: TEST_PUBLIC_KEY_PEM, privateKey: TEST_PRIVATE_KEY_PEM } =
  generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "pkcs1", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

export { TEST_PRIVATE_KEY_PEM, TEST_PUBLIC_KEY_PEM };

export type FlowDataEncryptedPayload = {
  encrypted_aes_key: string;
  encrypted_flow_data: string;
  initial_vector: string;
};

export type FlowDataRequestOpts = {
  authToken: string;
  url: string;
};

export type FlowDataRequestResult = {
  request: Request;
  aesKey: Buffer;
  iv: Buffer;
};

/**
 * Szyfruje plaintext kluczem publicznym (ten sam algorytm co w TwilioFlowCrypto.ts).
 * Zwraca payload gotowy do wysłania + aesKey i iv potrzebne do odszyfrowania odpowiedzi.
 */
export function encryptFlowRequest(plaintext: object): {
  payload: FlowDataEncryptedPayload;
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
      key: TEST_PUBLIC_KEY_PEM,
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

/**
 * Odszyfrowuje odpowiedź handlera.
 * Handler ustawia ostatni bajt IV na 0xFF w encryptFlowResponse — body już zawiera gotowy initial_vector.
 * Wymaga aesKey z oryginalnego requestu.
 */
export function decryptFlowResponse(
  body: { encrypted_flow_data: string; initial_vector: string },
  aesKey: Buffer,
): unknown {
  const encryptedData = Buffer.from(body.encrypted_flow_data, "base64");
  const responseIv = Buffer.from(body.initial_vector, "base64");
  const ciphertext = encryptedData.subarray(0, encryptedData.length - 16);
  const authTag = encryptedData.subarray(encryptedData.length - 16);

  const decipher = createDecipheriv("aes-128-gcm", aesKey, responseIv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8"));
}

function signBody(rawBody: string, authToken: string, url: string): string {
  return createHmac("sha1", authToken)
    .update(url + rawBody, "utf8")
    .digest("base64");
}

function buildSignedRequest(
  plaintext: object,
  opts: FlowDataRequestOpts,
): FlowDataRequestResult {
  const { payload, aesKey, iv } = encryptFlowRequest(plaintext);
  const rawBody = JSON.stringify(payload);
  const signature = signBody(rawBody, opts.authToken, opts.url);

  return {
    request: new Request(opts.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-twilio-signature": signature,
      },
      body: rawBody,
    }),
    aesKey,
    iv,
  };
}

export function pingRequest(opts: FlowDataRequestOpts): FlowDataRequestResult {
  return buildSignedRequest(
    { version: "3.0", action: "ping", screen: "", data: {}, flow_token: "" },
    opts,
  );
}

export function initRequest(
  screen: string,
  flowToken: string,
  opts: FlowDataRequestOpts,
): FlowDataRequestResult {
  return buildSignedRequest(
    { version: "3.0", action: "INIT", screen, data: {}, flow_token: flowToken },
    opts,
  );
}

export function dateExchangeRequest(
  data: { check_in: string; check_out: string },
  flowToken: string,
  opts: FlowDataRequestOpts,
): FlowDataRequestResult {
  return buildSignedRequest(
    {
      version: "3.0",
      action: "data_exchange",
      screen: "DATE_PICKER",
      data,
      flow_token: flowToken,
    },
    opts,
  );
}

export function guestsExchangeRequest(
  data: { adults: number; children: number },
  flowToken: string,
  opts: FlowDataRequestOpts,
): FlowDataRequestResult {
  return buildSignedRequest(
    {
      version: "3.0",
      action: "data_exchange",
      screen: "GUESTS_PICKER",
      data,
      flow_token: flowToken,
    },
    opts,
  );
}

export function guestInfoExchangeRequest(
  data: { name: string; email: string; phone: string },
  flowToken: string,
  opts: FlowDataRequestOpts,
): FlowDataRequestResult {
  return buildSignedRequest(
    {
      version: "3.0",
      action: "data_exchange",
      screen: "GUEST_INFO",
      data,
      flow_token: flowToken,
    },
    opts,
  );
}

export function extrasExchangeRequest(
  data: { breakfast: boolean | "true" | "false" },
  flowToken: string,
  opts: FlowDataRequestOpts,
): FlowDataRequestResult {
  return buildSignedRequest(
    {
      version: "3.0",
      action: "data_exchange",
      screen: "EXTRAS",
      data,
      flow_token: flowToken,
    },
    opts,
  );
}
