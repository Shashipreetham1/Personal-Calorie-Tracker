import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnvFile } from 'dotenv';
import { z } from 'zod';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Loads .env from the server package first, then the repository root.
 *
 * `dotenv/config` alone reads only ./.env relative to the working directory, so
 * running `cd server && npm run dev` would silently miss the .env at the repo
 * root — the one the README tells you to create, and the one docker compose
 * reads. Both locations are checked, and neither overrides a variable already
 * in the environment, so the values Docker injects always win.
 */
loadEnvFile({ path: [path.join(serverDir, '.env'), path.join(serverDir, '..', '.env')], quiet: true });

/**
 * Environment schema.
 *
 * The process refuses to boot on invalid configuration: a server that starts
 * with a missing JWT secret and fails on the first login is far worse to debug
 * than one that never starts. Every variable here is documented in .env.example.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  JSON_BODY_LIMIT: z.string().default('1mb'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PG_POOL_MAX: z.coerce.number().int().positive().max(100).default(10),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  COOKIE_NAME: z.string().default('ct_token'),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Optional until Phase 7 — the app must run without AI configured.
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-3.8-flash'),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${details}`);
}

const env = parsed.data;

/** Application configuration, grouped by concern. Import this, never process.env. */
export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',

  server: {
    port: env.PORT,
    jsonBodyLimit: env.JSON_BODY_LIMIT,
  },

  db: {
    connectionString: env.DATABASE_URL,
    poolMax: env.PG_POOL_MAX,
  },

  auth: {
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN,
    cookieName: env.COOKIE_NAME,
  },

  cors: {
    // Comma-separated so multiple frontend origins can be allowed in deployment.
    origins: env.CORS_ORIGIN.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  },

  ai: {
    apiKey: env.GEMINI_API_KEY,
    model: env.GEMINI_MODEL,
    uploadMaxBytes: env.UPLOAD_MAX_BYTES,
  },
};
