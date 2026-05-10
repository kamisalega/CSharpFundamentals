import {
  createCipheriv,
  generateKeyPairSync,
  publicEncrypt,
  randomBytes,
  constants,
  createDecipheriv,
} from "crypto";
import {
  decryptFlowPayload,
  EncryptedFlowPayload,
  encryptFlowResponse,
} from "./TwilioFlowCrypto";
import { describe, expect, it } from "vitest";

function makeKeyPair() {
  return generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "pkcs1", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

function makeEncryptedPayload(
  plaintext: object,
  publicKeyPem: string,
): { payload: EncryptedFlowPayload; aesKey: Buffer; iv: Buffer } {
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
      key: publicKeyPem,
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

describe("decryptFlowPayload", () => {
  const { publicKey, privateKey } = makeKeyPair();

  it("decrypts a valid INIT payload", () => {
    const plaintext = {
      version: "3.0",
      action: "INIT",
      screen: "DATE_PICKER",
      data: {},
      flow_token: "tok-abc",
    };
    const { payload } = makeEncryptedPayload(plaintext, publicKey);

    const { request } = decryptFlowPayload(payload, privateKey);

    expect(request.version).toBe("3.0");
    expect(request.action).toBe("INIT");
    expect(request.screen).toBe("DATE_PICKER");
    expect(request.flow_token).toBe("tok-abc");
  });

  it("returns aesKey and iv alongside the request", () => {
    const { payload, aesKey, iv } = makeEncryptedPayload(
      { action: "ping", screen: "", data: {}, flow_token: "", version: "3.0" },
      publicKey,
    );

    const result = decryptFlowPayload(payload, privateKey);

    expect(result.aesKey).toEqual(aesKey);
    expect(result.iv).toEqual(iv);
  });

  it("throws when private key does not match", () => {
    const { publicKey: otherPub } = makeKeyPair();
    const { payload } = makeEncryptedPayload({ action: "INIT" }, otherPub);

    expect(() => decryptFlowPayload(payload, privateKey)).toThrow();
  });

  it("throws when encrypted_flow_data is tampered", () => {
    const { payload } = makeEncryptedPayload({ action: "INIT" }, publicKey);
    const corrupted = Buffer.from(payload.encrypted_flow_data, "base64");
    corrupted[0] = 0xff;

    expect(() =>
      decryptFlowPayload(
        { ...payload, encrypted_flow_data: corrupted.toString("base64") },
        privateKey,
      ),
    ).toThrow();
  });

  it("throws when encrypted_aes_key is corrupted", () => {
    const { payload } = makeEncryptedPayload({ action: "INIT" }, publicKey);
    const corrupted = Buffer.from(payload.encrypted_aes_key, "base64");
    corrupted[0] = 0xff;

    expect(() =>
      decryptFlowPayload(
        { ...payload, encrypted_aes_key: corrupted.toString("base64") },
        privateKey,
      ),
    ).toThrow();
  });
});

describe("encryptFlowResponse", () => {
  const { publicKey, privateKey } = makeKeyPair();

  it("flips the last byte of the IV", () => {
    const { payload, aesKey, iv } = makeEncryptedPayload(
      {
        action: "INIT",
        screen: "DATE_PICKER",
        data: {},
        flow_token: "",
        version: "3.0",
      },
      publicKey,
    );
    decryptFlowPayload(payload, privateKey);

    const { initial_vector } = encryptFlowResponse(
      { screen: "DATE_PICKER", data: {} },
      aesKey,
      iv,
    );

    const responseIv = Buffer.from(initial_vector, "base64");
    const expectedIv = Buffer.from(iv);
    expectedIv[expectedIv.length - 1] = 0xff;
    expect(responseIv).toEqual(expectedIv);
  });

  it("produces non-empty encrypted_flow_data", () => {
    const { payload, aesKey, iv } = makeEncryptedPayload(
      {
        action: "INIT",
        screen: "DATE_PICKER",
        data: {},
        flow_token: "",
        version: "3.0",
      },
      publicKey,
    );
    decryptFlowPayload(payload, privateKey);

    const { encrypted_flow_data } = encryptFlowResponse(
      { screen: "DATE_PICKER", data: { min_date: "2026-05-09" } },
      aesKey,
      iv,
    );

    expect(Buffer.from(encrypted_flow_data, "base64").length).toBeGreaterThan(
      0,
    );
  });

  it("response encrypted with flipped IV cannot be decrypted with original IV", () => {
    const aesKey = randomBytes(16);
    const iv = randomBytes(12);
    const { encrypted_flow_data, initial_vector } = encryptFlowResponse(
      { screen: "SUCCESS" },
      aesKey,
      iv,
    );
    
    const ciphertext = Buffer.from(encrypted_flow_data, "base64");
    const tag = ciphertext.subarray(ciphertext.length - 16);
    const data = ciphertext.subarray(0, ciphertext.length - 16);
    const decipher = createDecipheriv("aes-128-gcm", aesKey, iv);
    decipher.setAuthTag(tag);

    expect(() =>
      Buffer.concat([decipher.update(data), decipher.final()]),
    ).toThrow();
  });
});
