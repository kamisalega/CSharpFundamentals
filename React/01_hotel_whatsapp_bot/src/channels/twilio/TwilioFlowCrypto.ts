import {
  constants,
  createCipheriv,
  createDecipheriv,
  privateDecrypt,
} from "crypto";

export interface EncryptedFlowPayload {
  encrypted_aes_key: string;
  encrypted_flow_data: string;
  initial_vector: string;
}

export interface DecryptedFlowRequest {
  version: string;
  action: string;
  screen: string;
  data: Record<string, unknown>;
  flow_token: string;
}

export interface DecryptFlowResult {
  request: DecryptedFlowRequest;
  aesKey: Buffer;
  iv: Buffer;
}

const TAG_BYTES = 16;

function gcmAlgorithm(key: Buffer): "aes-128-gcm" | "aes-256-gcm" {
  return key.length === 16 ? "aes-128-gcm" : "aes-256-gcm";
}

export function decryptFlowPayload(
  payload: EncryptedFlowPayload,
  privateKeyPem: string,
): DecryptFlowResult {
  const encryptedAesKey = Buffer.from(payload.encrypted_aes_key, "base64");
  const encryptedFlowData = Buffer.from(payload.encrypted_flow_data, "base64");
  const iv = Buffer.from(payload.initial_vector, "base64");

  const aesKey = privateDecrypt(
    {
      key: privateKeyPem,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    encryptedAesKey,
  );

  const ciphertext = encryptedFlowData.subarray(
    0,
    encryptedFlowData.length - TAG_BYTES,
  );
  const authTag = encryptedFlowData.subarray(
    encryptedFlowData.length - TAG_BYTES,
  );

  const decipher = createDecipheriv(gcmAlgorithm(aesKey), aesKey, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  const request = JSON.parse(
    decrypted.toString("utf8"),
  ) as DecryptedFlowRequest;

  return { request, aesKey, iv };
}

export function encryptFlowResponse(
  response: object,
  aesKey: Buffer,
  iv: Buffer,
): { encrypted_flow_data: string; initial_vector: string } {
  const responseIv = Buffer.from(iv);
  responseIv[responseIv.length - 1] = 0xff;

  const cipher = createCipheriv(gcmAlgorithm(aesKey), aesKey, responseIv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(response), "utf8"),
    cipher.final(),
  ]);

  return {
    encrypted_flow_data: Buffer.concat([
      ciphertext,
      cipher.getAuthTag(),
    ]).toString("base64"),
    initial_vector: responseIv.toString("base64"),
  };
}
