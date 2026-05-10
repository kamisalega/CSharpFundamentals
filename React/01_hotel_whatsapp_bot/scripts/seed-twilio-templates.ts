#!/usr/bin/env tsx
/**
 * Idempotently creates Twilio Content templates from src/channels/twilio/templates/*.json
 * and submits WhatsApp approval requests for newly created templates.
 *
 * Writes resulting SIDs to .env.twilio.local — copy the printed lines into .env.
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *
 * Usage: npm run twilio:sync-templates
 */

import fs from "node:fs";
import path from "node:path";

// ── env ────────────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

interface ScriptEnv {
  accountSid: string;
  authToken: string;
}

function getScriptEnv(): ScriptEnv {
  return {
    accountSid: requireEnv("TWILIO_ACCOUNT_SID"),
    authToken: requireEnv("TWILIO_AUTH_TOKEN"),
  };
}

// ── types ──────────────────────────────────────────────────────────────────────

interface TemplateDefinition {
  /** Maps to TWILIO_CONTENT_SID_* in .env, e.g. "TWILIO_CONTENT_SID_WELCOME_MENU" */
  env_key: string;
  friendly_name: string;
  language: string;
  variables?: Record<string, string>;
  types: Record<string, unknown>;
  approval: {
    /** Name submitted to Meta for approval — lowercase with underscores */
    name: string;
    category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  };
}

interface TwilioContentMeta {
  next_page_url?: string | null;
}

interface TwilioContentItem {
  sid: string;
  friendly_name: string;
}

interface TwilioListResponse {
  contents: TwilioContentItem[];
  meta: TwilioContentMeta;
}

interface TwilioCreateResponse {
  sid: string;
}

// ── Twilio Content API helpers ─────────────────────────────────────────────────

const CONTENT_BASE = "https://content.twilio.com";

function makeAuthHeaders(accountSid: string, authToken: string): HeadersInit {
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString(
    "base64",
  );
  return {
    Authorization: `Basic ${credentials}`,
    "Content-Type": "application/json",
  };
}

async function listContents(
  accountSid: string,
  authToken: string,
): Promise<TwilioContentItem[]> {
  const all: TwilioContentItem[] = [];
  let pageUrl: string | null = `${CONTENT_BASE}/v1/Content?PageSize=200`;

  while (pageUrl !== null) {
    const res = await fetch(pageUrl, {
      headers: makeAuthHeaders(accountSid, authToken),
    });
    if (!res.ok) {
      throw new Error(
        `List contents failed (${res.status}): ${await res.text()}`,
      );
    }
    const body = (await res.json()) as TwilioListResponse;
    all.push(...body.contents);
    pageUrl = body.meta.next_page_url ?? null;
  }

  return all;
}

async function createContent(
  accountSid: string,
  authToken: string,
  def: TemplateDefinition,
): Promise<string> {
  const payload: Record<string, unknown> = {
    friendly_name: def.friendly_name,
    language: def.language,
    types: def.types,
  };
  if (def.variables !== undefined) {
    payload["variables"] = def.variables;
  }

  const res = await fetch(`${CONTENT_BASE}/v1/Content`, {
    method: "POST",
    headers: makeAuthHeaders(accountSid, authToken),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(
      `Create "${def.friendly_name}" failed (${res.status}): ${await res.text()}`,
    );
  }
  const body = (await res.json()) as TwilioCreateResponse;
  return body.sid;
}

async function submitWhatsAppApproval(
  accountSid: string,
  authToken: string,
  sid: string,
  name: string,
  category: string,
): Promise<void> {
  const res = await fetch(
    `${CONTENT_BASE}/v1/Content/${sid}/ApprovalRequests/whatsapp`,
    {
      method: "POST",
      headers: makeAuthHeaders(accountSid, authToken),
      body: JSON.stringify({ name, category }),
    },
  );
  if (!res.ok) {
    throw new Error(
      `Approval request for "${sid}" failed (${res.status}): ${await res.text()}`,
    );
  }
}

// ── file helpers ───────────────────────────────────────────────────────────────

function readTemplateDefinitions(
  dir: string,
): Array<TemplateDefinition & { file: string }> {
  if (!fs.existsSync(dir)) {
    throw new Error(`Templates directory not found: ${dir}`);
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    throw new Error(`No *.json files found in ${dir}`);
  }
  return files.map((file) => {
    const raw = fs.readFileSync(path.join(dir, file), "utf-8");
    const parsed = JSON.parse(raw) as TemplateDefinition;
    if (
      !parsed.env_key ||
      !parsed.friendly_name ||
      !parsed.language ||
      !parsed.types ||
      !parsed.approval
    ) {
      throw new Error(
        `Invalid definition in "${file}": must have env_key, friendly_name, language, types, approval`,
      );
    }
    return { ...parsed, file };
  });
}

function writeEnvFile(outputPath: string, sids: Record<string, string>): void {
  const lines = Object.entries(sids).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(outputPath, lines.join("\n") + "\n", "utf-8");
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const env = getScriptEnv();
  const templatesDir = path.resolve(
    process.cwd(),
    "src/channels/twilio/templates",
  );
  const envOutputPath = path.resolve(process.cwd(), ".env.twilio.local");

  console.log("Reading template definitions from:", templatesDir);
  const definitions = readTemplateDefinitions(templatesDir);
  console.log(
    `Found ${definitions.length} template(s):`,
    definitions.map((d) => d.friendly_name).join(", "),
  );

  console.log("\nFetching existing Twilio Content templates...");
  const existing = await listContents(env.accountSid, env.authToken);
  const existingByName = new Map(existing.map((c) => [c.friendly_name, c]));
  console.log(`Remote templates: ${existing.length}`);

  const resultSids: Record<string, string> = {};

  for (const def of definitions) {
    const existingContent = existingByName.get(def.friendly_name);

    let sid: string;
    if (existingContent !== undefined) {
      console.log(
        `\n[${def.friendly_name}] already exists (sid=${existingContent.sid}) — skipping create`,
      );
      sid = existingContent.sid;
    } else {
      console.log(`\n[${def.friendly_name}] not found — creating...`);
      sid = await createContent(env.accountSid, env.authToken, def);
      console.log(`  Created: sid=${sid}`);

      console.log(
        `  Submitting approval (name="${def.approval.name}", category="${def.approval.category}")...`,
      );
      await submitWhatsAppApproval(
        env.accountSid,
        env.authToken,
        sid,
        def.approval.name,
        def.approval.category,
      );
      console.log(
        `  Approval request submitted — pending Meta review (24-48h)`,
      );
    }

    resultSids[def.env_key] = sid;
  }

  console.log("\nWriting:", envOutputPath);
  writeEnvFile(envOutputPath, resultSids);

  console.log("\nDone. Copy these lines into your .env:\n");
  for (const [key, sid] of Object.entries(resultSids)) {
    console.log(`${key}=${sid}`);
  }
  console.log(
    "\nNote: re-running this script is safe — it skips templates that already exist.",
  );
}

main().catch((err: unknown) => {
  console.error(
    "\nseed-twilio-templates failed:",
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
});
