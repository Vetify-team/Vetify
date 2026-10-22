# Security audit — adversarial code review

Date: October 20, 2026. Branch: `codex/unification`. Method: static, attacker's-eye
review of the API and web source. No live attacks were run against a deployed server;
exploit paths were reasoned about from the code. This is a point-in-time snapshot and
does not replace deployment verification (TLS, proxy trust) or the dedicated
`/security-review` of the pending diff.

Scope reviewed: authentication/session handling, authorization, SQL access, input
validation, secret handling, HTTP hardening, and the web/PWA layer (CSP, token storage,
XSS surface).

## Headline

The application is strongly hardened. No working access-control bypass, injection, or
session-theft path was found. The controls described in
[SECURITY_HANDOFF.md](SECURITY_HANDOFF.md) are implemented and behave as claimed.
Findings below are mostly low severity or already-documented residual risk, plus one
operational observation.

## Operational observation — concurrent edits during the audit

At session start, `git status` showed only `.claude/` dirty. Partway through the audit,
`apps/api/src/common/idempotency.ts` appeared (untracked) and
`apps/api/src/pets/pets.service.ts` / `apps/api/src/records/records.service.ts` became
modified, with modification times during the session. A transient mid-edit state briefly
showed an argument-type mismatch in the idempotency call sites (a `TokenPayload` passed
where a user-id `string` was expected); on re-check it had already been reconciled and the
API typechecks cleanly (`tsc --noEmit` exits 0).

Implication: another agent or session appears to be writing this branch. Coordinate before
editing the idempotency files to avoid clobbering concurrent work. All findings here are a
snapshot of the tree at the time of review.

## Attack attempts that failed (verified controls)

- **IDOR / cross-tenant access** — every pet/record path routes through
  `PermissionsService.authorize()`. Another owner's pet returns **404** so existence is not
  revealed. Pagination cursors are scoped to `petId`, so a foreign cursor cannot become an
  oracle for another pet's data. (`apps/api/src/permissions/permissions.service.ts`)
- **SQL injection** — the raw vaccination/deworming queries use `Prisma.sql` with
  parameterized `${id}::uuid` binds; no string concatenation of user input.
- **JWT tampering / algorithm confusion** — HS256 pinned, issuer and separate
  access/refresh audiences enforced, and every authenticated request re-checks the database
  session, so logout/rotation/replay invalidate an access token immediately.
  (`apps/api/src/auth/jwt.strategy.ts`)
- **Mass assignment** — Zod strips unknown keys; `clinicId`, `veterinarianId`, and
  `ownerId` come from the token/permission, never from the request body.
- **Stored XSS** — `httpsUrlSchema` rejects `javascript:`, `data:`, plain `http:`, and
  raw-IP hosts; free-text schemas reject control characters; React escapes output; the only
  `dangerouslySetInnerHTML` is a nonce'd constant theme script. CSP uses a per-request nonce
  with `strict-dynamic`, plus `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`.
- **CSRF** — SameSite=Strict HttpOnly refresh cookie, `Origin` / `Sec-Fetch-Site`
  validation on session routes, and JSON-only (415) credential endpoints.
- **Idempotency replay** — `authorize(tx)` is re-run even on replay, the request body is
  fingerprinted (409 on a key reused with different data), and results are scoped per user.
  Authorization is not skipped on replay.
- **Secrets** — none committed; `.env` is gitignored; docker-compose credentials are
  clearly labeled local-only.

## Findings

| #   | Severity       | Finding                                                                                                                                                                                                                                                        | Suggested fix                                                                                                      |
| --- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | Medium (known) | No MFA; single password factor, notable for health data. Documented as pending.                                                                                                                                                                                | Implement TOTP/WebAuthn and gate session issuance on it; start with admin/clinic accounts.                         |
| 2   | Medium (known) | Rate limits are in-memory and assume a single API instance. Brute-force / credential-spray protection weakens silently if scaled horizontally.                                                                                                                 | Move throttler and link-code/idempotency counters to shared storage (Redis) before running more than one instance. |
| 3   | Low            | `docker-compose.yml` sets `NODE_ENV=production` together with `API_DOCS_ENABLED="true"` over plain HTTP. Harmless locally, but if reused as a deploy template it exposes Scalar + the OpenAPI JSON publicly, and `Secure` cookies will not transmit over HTTP. | Comment the compose file as local-only; do not reuse it as a production template.                                  |
| 4   | Low            | Email enumeration: `register` returns `409 EMAIL_TAKEN`. Documented as intentional.                                                                                                                                                                            | Accept, or move to an email-verification flow if enumeration is a concern.                                         |
| 5   | Info           | Bearer access tokens are not sender-constrained (no DPoP/mTLS); a stolen token is usable until expiry or revocation. Documented.                                                                                                                               | Keep the 15-minute TTL; consider sender-constraining later.                                                        |
| 6   | Info           | A non-UUID `cursor` on `GET /pets/:petId/record` reaches Prisma and surfaces as a generic 500 instead of a 400.                                                                                                                                                | Validate `cursor` as a UUID in `recordQuerySchema`.                                                                |

## Not assessable from source

TLS termination, database TLS, and real proxy / `TRUST_PROXY` behavior at the ingress are
deployment-time concerns. IP-based rate limiting is only as trustworthy as the proxy
configuration. These remain unverified, consistent with the handoff.
