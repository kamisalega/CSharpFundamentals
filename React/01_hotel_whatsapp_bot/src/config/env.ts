import { z } from "zod";

const aiProviders = ["claude", "openai"] as const;

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]),
    DATABASE_URL: z.string().min(1),
    AI_PROVIDER: z.enum(aiProviders),
    ANTHROPIC_API_KEY: z.string(),
    OPENAI_API_KEY: z.string(),
    META_WHATSAPP_PHONE_NUMBER_ID: z.string().min(1),
    META_WHATSAPP_PHONE_ID: z.string().min(1),
    META_WHATSAPP_ACCESS_TOKEN: z.string().min(1),
    META_WHATSAPP_APP_SECRET: z.string().min(1),
    META_WHATSAPP_VERIFY_TOKEN: z.string().min(1),
    STRIPE_SECRET_KEY: z.string().min(1),
    STRIPE_WEBHOOK_SECRET: z.string().min(1),
    AUTH_SECRET: z.string().min(32),
    APP_BASE_URL: z.url(),
    AUTH_URL: z.url().optional(),
    RATE_LIMIT_BACKEND: z.enum(["memory", "redis"]).default("memory"),
    REDIS_URL: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.AI_PROVIDER === "claude" && val.ANTHROPIC_API_KEY.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["ANTHROPIC_API_KEY"],
        message: "ANTHROPIC_API_KEY is required when AI_PROVIDER=claude",
      });
    }

    if (val.AI_PROVIDER === "openai" && val.OPENAI_API_KEY.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["OPENAI_API_KEY"],
        message: "OPENAI_API_KEY is required when AI_PROVIDER=openai",
      });
    }
    if (val.RATE_LIMIT_BACKEND === "redis" && !val.REDIS_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["REDIS_URL"],
        message: "REDIS_URL is required when RATE_LIMIT_BACKEND=redis",
      });
    }
  });

export type Env = z.infer<typeof schema>;

export function parseEnv(
  raw: NodeJS.ProcessEnv | Record<string, unknown>,
): Env {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join(";");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return result.data;
}

let cached: Env | undefined;
export function getEnv(): Env {
  if (!cached) cached = parseEnv(process.env);
  return cached;
}
