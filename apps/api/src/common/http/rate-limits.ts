import type { ThrottlerOptions } from '@nestjs/throttler';
import type { Env } from '../../config.js';
import { accountTracker } from './account-tracker.js';

/**
 * Per-IP (`general` throttler) limits that can be raised by environment
 * variable, per minute. The defaults are the limits the API always had, so
 * nothing changes unless a variable is set. Per-account and per-email limits
 * are not configurable on purpose: they are what stops credential guessing
 * when many callers share an IP.
 */
export const IP_RATE_LIMITS = {
  /** Every route without its own limit (mostly reads). */
  general: { variable: 'RATE_LIMIT_GENERAL', default: 120 },
  register: { variable: 'RATE_LIMIT_REGISTER', default: 10 },
  login: { variable: 'RATE_LIMIT_LOGIN', default: 10 },
  refresh: { variable: 'RATE_LIMIT_REFRESH', default: 30 },
  /** A clinic issuing a link code. */
  linkCodeCreate: { variable: 'RATE_LIMIT_LINK_CODE_CREATE', default: 10 },
  /** An owner previewing a link code before granting access. */
  linkCodePreview: { variable: 'RATE_LIMIT_LINK_CODE_PREVIEW', default: 10 },
  /** An owner granting access with a link code (linking a clinic). */
  permissionGrant: { variable: 'RATE_LIMIT_PERMISSION_GRANT', default: 10 },
} as const;

export type IpRateLimit = keyof typeof IP_RATE_LIMITS;
export type IpRateLimitVariable =
  (typeof IP_RATE_LIMITS)[IpRateLimit]['variable'];

/** All the limits share one window. */
export const RATE_LIMIT_TTL_MS = 60_000;

const defaults = (): Record<IpRateLimit, number> =>
  Object.fromEntries(
    Object.entries(IP_RATE_LIMITS).map(([name, limit]) => [
      name,
      limit.default,
    ]),
  ) as Record<IpRateLimit, number>;

let current = defaults();

/**
 * Loads the validated values. Called once at startup, from the throttler
 * module factory; until then (and in unit tests) the defaults apply.
 */
export const configureIpRateLimits = (
  read: (variable: IpRateLimitVariable) => Env[IpRateLimitVariable],
): void => {
  current = Object.fromEntries(
    Object.entries(IP_RATE_LIMITS).map(([name, limit]) => [
      name,
      read(limit.variable),
    ]),
  ) as Record<IpRateLimit, number>;
};

/** Back to the defaults (tests). */
export const resetIpRateLimits = (): void => {
  current = defaults();
};

/**
 * The limit of a route, resolved on each request, for `@Throttle()`.
 * Decorators run when the module is loaded, before the configuration exists,
 * so they take this resolver instead of a number.
 */
export const ipLimit = (name: IpRateLimit) => () => current[name];

/** `@Throttle()` options of a route with a configurable per-IP limit. */
export const ipThrottle = (name: IpRateLimit) => ({
  limit: ipLimit(name),
  ttl: RATE_LIMIT_TTL_MS,
});

/**
 * The API's two throttlers. `general` is per client IP (needs
 * TRUST_PROXY_HOPS behind a proxy) and configurable. `account` is per email
 * (or per token user), so a credential endpoint cannot be brute forced from
 * many IPs; it is high by default, tightened with @Throttle() on those
 * endpoints, and not configurable. Both live in memory: a single instance is
 * assumed (move to Redis before scaling out).
 */
export const throttlers = (
  read: (variable: IpRateLimitVariable) => Env[IpRateLimitVariable],
): ThrottlerOptions[] => {
  configureIpRateLimits(read);
  return [
    { name: 'general', ttl: RATE_LIMIT_TTL_MS, limit: ipLimit('general') },
    {
      name: 'account',
      ttl: 60_000,
      limit: 1_000,
      getTracker: accountTracker,
    },
  ];
};
