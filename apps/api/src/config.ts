import { z } from 'zod';
import { isIP } from 'node:net';

const proxyCidrs = z
  .string()
  .max(4096)
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  )
  .refine(
    (entries) =>
      entries.every((entry) => {
        const [ip, prefix, extra] = entry.split('/');
        const version = isIP(ip ?? '');
        return (
          !extra &&
          !!version &&
          (prefix === undefined ||
            (/^\d+$/.test(prefix) &&
              Number(prefix) > 0 &&
              Number(prefix) <= (version === 4 ? 32 : 128)))
        );
      }),
    'TRUST_PROXY_CIDRS must contain only IP addresses or CIDR ranges',
  );

const secret = (name: string) =>
  z.string().min(32, `${name} must be at least 32 characters`);

/**
 * Environment of the API. Validated at startup: if something is missing the
 * process does not start, instead of failing in the middle of a request.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().default(3001),
  // Keep notification settings in the validated configuration so Nest also
  // makes values loaded from .env available to the notification worker.
  DEV_PUSH_TEST_ENABLED: z.enum(['true', 'false']).default('false'),
  NOTIFICATIONS_WORKER_ENABLED: z.enum(['true', 'false']).default('false'),
  VAPID_PUBLIC_KEY: z.string().default(''),
  VAPID_PRIVATE_KEY: z.string().default(''),
  VAPID_SUBJECT: z.string().default(''),
  /**
   * ONVO (Dashboard · Developers). Billing is off without the secret key; its
   * prefix decides test or live mode. The webhook signing secret (whsec_…)
   * comes from the webhook endpoint registered in the ONVO Dashboard.
   */
  ONVO_SECRET_KEY: z
    .string()
    .regex(
      /^(onvo_(test|live)_secret_key_\S+)?$/,
      'ONVO_SECRET_KEY must be an ONVO secret key (onvo_test_… or onvo_live_…)',
    )
    .default(''),
  ONVO_WEBHOOK_SECRET: z.string().default(''),
  /**
   * Resend (resend.com) sends the account emails, such as password resets.
   * Without a key nothing is sent: development prints the email to the log,
   * other environments only log that it was skipped.
   */
  RESEND_API_KEY: z.string().default(''),
  MAIL_FROM: z.string().min(3).default('Vetify <noreply@vetify.live>'),
  /** Owner app origin for links in reminder emails; without it they carry none. */
  OWNER_APP_URL: z
    .union([z.literal(''), z.url({ protocol: /^https?$/ })])
    .default('')
    .transform((value) => value.replace(/\/+$/, '')),
  /**
   * Cloudinary (Settings · API Keys · "API environment variable"):
   * cloudinary://<api_key>:<api_secret>@<cloud_name>. Without it the API
   * answers uploads and file links with 503 UPLOADS_UNAVAILABLE.
   */
  CLOUDINARY_URL: z
    .string()
    .regex(
      /^(cloudinary:\/\/[^:@\s]+:[^@\s]+@[\w-]+)?$/,
      'CLOUDINARY_URL must look like cloudinary://<api_key>:<api_secret>@<cloud_name>',
    )
    .default(''),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: secret('JWT_ACCESS_SECRET'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_SECRET: secret('JWT_REFRESH_SECRET'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  /** Key of the HMAC that protects stored clinic link codes. */
  LINK_CODE_SECRET: secret('LINK_CODE_SECRET'),
  /**
   * Origins allowed to call the API from a browser, comma separated. Requests
   * that use the session cookie must come from one of them (CSRF defense).
   */
  ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  /**
   * Only use numeric trust for a single verified ingress proxy. Trusting
   * multiple hops lets a caller on a shorter path forge the apparent IP.
   */
  TRUST_PROXY_HOPS: z.coerce
    .number()
    .int()
    .min(0)
    .max(
      1,
      'Multiple trusted hops require TRUST_PROXY_CIDRS instead of a hop count',
    )
    .default(0),
  TRUST_PROXY_CIDRS: proxyCidrs,
  /** Serve Scalar and the OpenAPI document. Off in production by default. */
  API_DOCS_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
});

export type Env = z.infer<typeof envSchema>;

export const validateEnv = (env: Record<string, unknown>): Env => {
  const result = envSchema.safeParse(env);

  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid configuration:\n${detail}`);
  }

  return result.data;
};

/** Docs are on unless disabled, except in production where they are opt-in. */
export const docsEnabled = (
  env: Pick<Env, 'NODE_ENV' | 'API_DOCS_ENABLED'>,
): boolean => env.API_DOCS_ENABLED ?? env.NODE_ENV !== 'production';
