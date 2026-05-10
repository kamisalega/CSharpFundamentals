#!/usr/bin/env tsx
/**
 * Derives the RSA public key from WHATSAPP_FLOWS_PRIVATE_KEY and uploads it
 * to Meta's whatsapp_business_encryption endpoint.
 *
 * Run once per environment (and again on key rotation).
 *
 * Required env vars:
 *   WHATSAPP_FLOWS_GRAPH_ACCESS_TOKEN
 *   WHATSAPP_FLOWS_PHONE_NUMBER_ID
 *   WHATSAPP_FLOWS_PRIVATE_KEY   (PEM with \n as literal backslash-n)
 *
 * Optional env vars:
 *   WHATSAPP_FLOWS_PRIVATE_KEY_PASSPHRASE
 *
 * Usage: npm run flows:upload-key
 */

import { createPrivateKey, createPublicKey } from "node:crypto";

// ── env ────────────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

interface ScriptEnv {
  graphAccessToken: string;
  phoneNumberId: string;
  privateKeyPem: string;
  passphrase: string | undefined;
}

function getScriptEnv(): ScriptEnv {
  return {
    graphAccessToken: requireEnv("WHATSAPP_FLOWS_GRAPH_ACCESS_TOKEN"),
    phoneNumberId: requireEnv("WHATSAPP_FLOWS_PHONE_NUMBER_ID"),
    // Env vars store \n as literal two-char sequence — restore real newlines
    privateKeyPem: requireEnv("WHATSAPP_FLOWS_PRIVATE_KEY").replace(
      /\\n/g,
      "\n",
    ),
    passphrase: process.env["WHATSAPP_FLOWS_PRIVATE_KEY_PASSPHRASE"],
  };
}

// ── key derivation ─────────────────────────────────────────────────────────────

function derivePublicKeyPem(
  privateKeyPem: string,
  passphrase: string | undefined,
): string {
  const privateKeyObj = createPrivateKey(
    passphrase !== undefined
      ? { key: privateKeyPem, passphrase, format: "pem" }
      : { key: privateKeyPem, format: "pem" },
  );
  return createPublicKey(privateKeyObj)
    .export({ type: "spki", format: "pem" })
    .toString();
}

// ── Graph API ──────────────────────────────────────────────────────────────────

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

interface MetaEncryptionResponse {
  success?: boolean;
  error?: { message: string; code: number };
}

async function uploadPublicKey(
  phoneNumberId: string,
  token: string,
  publicKeyPem: string,
): Promise<void> {
  const res = await fetch(
    `${GRAPH_BASE}/${phoneNumberId}/whatsapp_business_encryption`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        business_public_key: publicKeyPem,
        access_token: token,
      }),
    },
  );

  const body = (await res.json()) as MetaEncryptionResponse;

  if (!res.ok) {
    const msg = body.error?.message ?? JSON.stringify(body);
    throw new Error(`Upload public key failed (${res.status}): ${msg}`);
  }

  console.log("Meta response:", JSON.stringify(body, null, 2));
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const env = getScriptEnv();

  console.log("Deriving public key from private key...");
  const publicKeyPem = derivePublicKeyPem(env.privateKeyPem, env.passphrase);

  // Print just enough to confirm it's the right key without leaking sensitive data
  const firstLine = publicKeyPem.split("\n")[1] ?? "";
  console.log(
    `Public key fingerprint (first 16 chars of body): ${firstLine.slice(0, 16)}...`,
  );

  console.log(`\nUploading to phone number id: ${env.phoneNumberId}`);
  await uploadPublicKey(env.phoneNumberId, env.graphAccessToken, publicKeyPem);

  console.log("\nPublic key uploaded successfully.");
  console.log(
    "Verify with: curl -G https://graph.facebook.com/v21.0/" +
      env.phoneNumberId +
      "/whatsapp_business_encryption?access_token=<token>",
  );
}

main().catch((err: unknown) => {
  console.error(
    "\nupload-flows-public-key failed:",
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
});
