import "server-only";
import { z } from "zod";

/**
 * Server-side environment contract.
 *
 * Validated once, eagerly, at module load: a missing or malformed variable
 * fails the boot with a readable message instead of surfacing as a confusing
 * runtime error deep inside a request. This module is `server-only`, so a
 * secret can never be pulled into a client bundle by accident.
 */

const booleanish = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.string().url().default("http://localhost:3000"),

    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    DIRECT_DATABASE_URL: z.string().min(1).optional(),
    TEST_DATABASE_URL: z.string().min(1).optional(),

    AUTH_SECRET: z
      .string()
      .min(32, "AUTH_SECRET must be at least 32 characters — generate with `openssl rand -base64 48`"),
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),

    PAYMENT_PROVIDER: z.enum(["sandbox", "mobile_money", "none"]).default("none"),
    ALLOW_SANDBOX_PAYMENTS: booleanish.default(false),
    MOBILE_MONEY_API_BASE_URL: z.string().url().optional(),
    MOBILE_MONEY_API_KEY: z.string().optional(),
    MOBILE_MONEY_WEBHOOK_SECRET: z.string().optional(),

    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    STORAGE_S3_BUCKET: z.string().optional(),
    STORAGE_S3_REGION: z.string().optional(),
    STORAGE_S3_ENDPOINT: z.string().url().optional(),
    STORAGE_S3_ACCESS_KEY_ID: z.string().optional(),
    STORAGE_S3_SECRET_ACCESS_KEY: z.string().optional(),
    STORAGE_S3_PUBLIC_BASE_URL: z.string().url().optional(),

    NOTIFICATION_EMAIL_DRIVER: z.enum(["log", "smtp"]).default("log"),
    NOTIFICATION_SMS_DRIVER: z.enum(["log", "http"]).default("log"),
    NOTIFICATION_WHATSAPP_DRIVER: z.enum(["log", "http"]).default("log"),

    ANALYTICS_DRIVER: z.enum(["db", "log", "none"]).default("db"),
    AI_PROVIDER: z.enum(["rules", "openai"]).default("rules"),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_MODEL: z.string().default("gpt-4o-mini"),

    RATE_LIMIT_DRIVER: z.enum(["memory", "db"]).default("db"),
    SEED_DEMO_PASSWORD: z.string().min(8).default("BuildLinkDemo123!"),
  })
  .superRefine((value, ctx) => {
    if (value.STORAGE_DRIVER === "s3") {
      const missing = (
        [
          "STORAGE_S3_BUCKET",
          "STORAGE_S3_REGION",
          "STORAGE_S3_ACCESS_KEY_ID",
          "STORAGE_S3_SECRET_ACCESS_KEY",
        ] as const
      ).filter((key) => !value[key]);
      if (missing.length > 0) {
        ctx.addIssue({
          code: "custom",
          message: `STORAGE_DRIVER="s3" requires: ${missing.join(", ")}`,
        });
      }
    }

    if (value.PAYMENT_PROVIDER === "mobile_money" && !value.MOBILE_MONEY_API_KEY) {
      ctx.addIssue({
        code: "custom",
        message:
          'PAYMENT_PROVIDER="mobile_money" requires MOBILE_MONEY_API_KEY and MOBILE_MONEY_API_BASE_URL. BuildLink will not fake a payment provider.',
      });
    }

    // The "no sandbox payments in production" rule is enforced in the payment
    // provider factory rather than here. `next build` runs with
    // NODE_ENV=production, so validating it at module load would make every
    // production build of a development configuration fail — while the check
    // that actually matters is the one at the moment a payment is created.

    if (value.AI_PROVIDER === "openai" && !value.OPENAI_API_KEY) {
      ctx.addIssue({
        code: "custom",
        message: 'AI_PROVIDER="openai" requires OPENAI_API_KEY.',
      });
    }
  });

function loadEnv() {
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration:\n${details}\n\nSee .env.example for the full contract.`,
    );
  }

  return parsed.data;
}

export const env = loadEnv();

export type Env = typeof env;

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
export const isDevelopment = env.NODE_ENV === "development";
