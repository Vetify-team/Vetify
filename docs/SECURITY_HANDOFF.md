# Security handoff for agents and maintainers

Last updated: October 20, 2026. Original working branch: `feat/english-api-v1-security`.

The earlier refactor/security/test stack was merged into `codex/unification` through PR #2
(commit `473a654`). Current follow-up work is on `codex/write-idempotency`, based on that
unified branch. Idempotency is implemented locally; hosting and production rollout remain
unverified. See [IDEMPOTENCY.md](IDEMPOTENCY.md) for the contract and migration.

This describes the inspected working tree and work completed in this session. Recheck source
and hosting before making security claims. Implemented locally does not mean committed,
deployed, or verified in production. See [SECURITY_MITIGATION.md](SECURITY_MITIGATION.md) for
the focused audit findings, fixes, and rollout instructions.

## Status at a glance

| Area                      | Current status                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Authentication            | Email/password, Argon2 password hashing, signed JWTs.                                                       |
| MFA                       | **Not implemented:** no second-factor challenge, authenticator codes, recovery codes, or passkeys.          |
| General write idempotency | Implemented for keyed pet creation and all seven record POSTs; 24-hour replay window.                       |
| Browser session storage   | Access token in memory; refresh token in an HttpOnly cookie.                                                |
| Refresh replay defense    | Implemented with database locking and transactional rotation/revocation.                                    |
| Pet authorization         | Ownership and active clinic permissions checked in services.                                                |
| Clinic linking            | Admin verification and short-lived, single-use owner-entered codes.                                         |
| CSRF defenses             | Origin checks on session routes; JSON-only login/register.                                                  |
| Traffic interception      | Production HTTPS and database TLS configuration still need deployment verification.                         |
| History reads             | Paginated, with indexed latest-dose queries for status and alerts.                                          |
| Rollout                   | New indexes tested on a disposable database; persistent environments still need migration and verification. |

## Authentication, interception, and impersonation

Passwords are hashed with Argon2. JWTs use HS256 signatures with a fixed algorithm, issuer,
and separate access/refresh audiences and configurable secrets. Access tokens expire after
15 minutes by default; refresh tokens after 30 days. These lifetimes are configurable.

Every authenticated request verifies its access token and checks the corresponding database
session for user identity, expiration, and revocation. Editing the user ID or role in a JWT
invalidates its signature. Logout/replay revocation invalidates access tokens through the
session check. JWTs are **signed, not encrypted**.

The refresh cookie is HttpOnly, SameSite=Strict, scoped to `/api`, and Secure when
`NODE_ENV=production`. Access tokens stay in browser memory rather than localStorage.
HttpOnly prevents direct JavaScript reads of the cookie, not all effects of XSS: malicious
same-origin code may still act as the user.

Access tokens are bearer credentials. Someone possessing an active token can use it until
expiration or revocation. There is no sender-constrained token mechanism such as DPoP or
client-certificate binding. JWT signatures do not encrypt or independently sign API messages.

Correctly configured TLS protects traffic against network interception and modification.
Production HSTS and Secure cookies support that protection, but headers alone do not establish
TLS. Verify browser-to-web HTTPS, web-to-API HTTPS through `API_ORIGIN`, certificate validation,
HTTP redirects, and PostgreSQL TLS. The API process listens for HTTP; hosting is expected to
terminate HTTPS. Local HTTP is development configuration. This is not end-to-end encryption
that hides clinical data from the API/database operator.

Source: `apps/api/src/auth/`, `apps/api/src/config.ts`,
`apps/api/src/common/http/configure-http.ts`, `apps/api/src/prisma/prisma.service.ts`,
`apps/web/src/lib/api-client.ts`, and `apps/web/next.config.ts`.

## Session and CSRF invariants

- Session creation, refresh rotation, and logout coordinate through a PostgreSQL lock on the
  user's row. Rotation and replacement creation share a READ COMMITTED transaction.
- Replay revocation must commit before returning 401. Throwing inside its transaction would
  roll back that revocation; retain the current commit-then-reject behavior.
- A rotated refresh token being reused revokes all current sessions for that user. Logout
  with a rotated cookie also revokes all sessions, preventing a racing successor from surviving.
  Logout with an active cookie targets that session.
- Login rejects password/role snapshots made stale by a concurrent admin promotion/password
  change. The admin script updates the account and revokes sessions atomically.
- All four session routes validate a supplied Origin against `ALLOWED_ORIGINS`. An explicit
  cross-site Fetch Metadata request without Origin is rejected. CLI clients without browser
  headers remain supported; an Origin header is not proof of caller identity.
- Login/register require `application/json`; forms receive 415. CORS alone is not CSRF defense.
- Do not blindly retry refresh with a possibly rotated token. The web shares concurrent
  refresh calls within an ApiClient instance, not necessarily across tabs/devices.

## Authorization and custom decorators

Global guards run rate limiting, JWT authentication, then role checks. `@Public()` bypasses
JWT authentication, not every security control. `@Roles()` checks roles, not individual pet
permissions. `PermissionsService.authorize()` and `visiblePets()` enforce resource access.

Owners administer their own pets and write day-to-day entries. Clinics with active full
permission read records and write medical acts. Admins verify clinics; being an admin does not
grant pet access. Requests from another owner return 404 to conceal the pet's existence.

Clinics start unverified. Admins cannot self-register and are provisioned through a server
script. Verified clinics issue eight-character codes that expire after ten minutes and can
be used once. Only HMACs are stored; consumption and granting permission share a transaction.
This supports human clinic verification/linking, not proof of professional credentials or MFA.

Our custom decorators are `@Public`, `@Roles`, `@CurrentUser`, `@LogAccess`, `@ZodBody`,
`@ZodResponse`, and `@ErrorResponses`. The last three document OpenAPI contracts. Runtime
input validation comes from ZodValidationPipe; response documentation does not validate output.

Source: `apps/api/src/app.module.ts`, `apps/api/src/common/decorators/`,
`apps/api/src/common/guards/`, `apps/api/src/common/openapi/`,
`apps/api/src/permissions/permissions.service.ts`, and `apps/api/src/clinics/`.

## Write idempotency

Pet creation and all seven record creation endpoints accept an optional `Idempotency-Key`.
The web supplies one per intended write and preserves it across authentication/network
retries and uncertain form resubmissions while the form remains mounted. Calls without a
key retain ordinary POST behavior; permission/code/authentication endpoints are outside this
phase and are not automatically retried.

A PostgreSQL user-row lock serializes keyed writes across instances. The business write,
reminders, and successful JSON response commit in the same transaction. Keys are hashed and
scoped to user/operation/pet; validated payloads have deterministic fingerprints. Reuse with
different data returns `409 IDEMPOTENCY_CONFLICT`. Replay rechecks the active session and
current pet authorization. No token/cookie is stored in a retry result.

The replay window is 24 hours, with at most 1,000 unexpired results per user and 64 KiB per
response. Expired keys permit new writes. Traffic performs bounded expiry cleanup; operators
must schedule `idempotency:prune` for physical deletion during idle periods. Saved responses
contain clinical data and need the same database protections as records. Browser keys are
not persisted across reloads. See [IDEMPOTENCY.md](IDEMPOTENCY.md).

## Missing MFA

Login currently has one factor: the password. There is no MFA enrollment/challenge, TOTP,
recovery-code flow, or WebAuthn/passkey support. Clinic verification/linking, password hashing,
rate limiting, and refresh replay defense are not login MFA.

Suggested priority: admins and clinic accounts, followed by an optional owner rollout. Factor
choice, enforcement, enrollment/recovery UX, and rollout remain design work. No MFA feature
was implemented merely by discussing it. A future MFA implementation must gate fully
authenticated session issuance on completion of the configured factors.

## Other controls and retained risks

- API v1 uses `/api/v1/...` or `/api/...` plus `X-API-Version: 1`.
- Shared Zod schemas strip unknown fields and constrain text, dates, and URLs. Ownership and
  clinic/veterinarian identity come from authorization, not arbitrary request fields.
- JSON bodies are limited to 100 KB. Helmet and no-store run before parsing, including
  malformed/oversized-body errors.
- Histories default to 50 entries per section, maximum 100, with scoped UUID cursors and
  deterministic date/ID ordering. The web can load older pages. Summaries query indexed latest
  doses across history independently of the pages loaded by the browser.
- The exception filter logs authenticated pet 403/404 denials, including guard failures,
  without changing the public status. Successful-access logging is still separate from the
  clinical write transaction; an outbox/shared transaction remains a follow-up.
- Credential endpoints have per-IP and per-email limits. Counters remain in memory; keep one
  API instance until shared rate-limit storage is implemented.
- `TRUST_PROXY_HOPS` accepts 0/1. Explicit `TRUST_PROXY_CIDRS` takes precedence and rejects
  universal /0 networks. Real ingress/header behavior is unverified. Do not blindly trust two
  hops because requests can pass through both Vercel and Render.
- Pagination limits reads, not total storage. Storage budgets/abuse monitoring remain pending.
- Duplicate registration intentionally still returns `409 EMAIL_TAKEN`.
- Unverifying a clinic stops new links; existing permissions remain active until owners revoke
  them. Emergency clinic suspension is a separate product decision.
- The service worker excludes API responses from caching, and logout clears runtime caches.
  Registration is disabled in development. This does not prove the entire browser/PWA has no
  sensitive in-memory data or that PWA installation was verified.
- API docs default to disabled in production. Docker runs as non-root. CI pins actions, runs
  security regressions, and audits production dependencies at the moderate threshold.

## Verification evidence and limits

Last completed checks during mitigation:

- 64 API tests across nine files, including HTTP probes and the PostgreSQL security suite.
- Workspace lint and typechecks passed.
- All five migrations replayed on a fresh disposable PostgreSQL 16 database. Prisma reported
  no schema difference. That database was then removed; application data was not used.
- Fresh API and Docusaurus builds passed. Web production and service-worker builds passed
  using `next build --webpack` followed by `serwist build`.
- Default Turbopack builds failed because this execution environment blocked an internal
  worker port. The default full verification command did not pass in this environment.
- `pnpm audit --prod --audit-level=moderate` had no unsuppressed advisories after dependency
  overrides. The explicitly ignored braces build-time advisory remains. Rerun this dated scan.
- OpenAPI was regenerated with pagination and session endpoint error responses.

The PostgreSQL suite requires `SECURITY_TEST_DATABASE_URL`. Without it, 12 suite tests are
skipped. It rejects remote/non-test destinations and never falls back to the app's DATABASE_URL.
CI provisions a disposable database; Turbo forwards this variable and does not cache tests.

The earlier Claude handoff reported 53 live API checks, browser login/sharing checks, and an
18-finding audit. Those are prior reported results, not fresh checks reproduced in full here.
The original 18-finding report was not recovered; do not claim all 18 have been reconciled.
The focused review and its fixes are documented separately in SECURITY_MITIGATION.md.

## Next actions

An adversarial full-application HTTP E2E suite was subsequently added and run. Its default
result was 54 runner tests: 52 passed and 2 executed TODO assertions for missing idempotency
and MFA. No new access-control bypass was found in the tested scenarios. See
[SECURITY_E2E_REPORT.md](SECURITY_E2E_REPORT.md) and
[test instructions](../apps/api/test/README.md) for scope, evidence, and strict mode. This
extends the earlier 64-test regression evidence; it does not verify production or implement
the proposed roadmap.

The user approved proceeding with the roadmap. The idempotency phase is implemented locally.
MFA, session-management UI, shared rate limits, and production transport verification remain
pending; see [SECURITY_ROADMAP.md](SECURITY_ROADMAP.md).

1. The earlier changes are committed, pushed, and merged into `codex/unification`. Preserve
   the idempotency follow-up and local `.claude/` configuration. Apply the new idempotency
   migration to each target environment before deploying its API/web changes.
2. Verify deployed TLS/certificates, database TLS, and proxy trust on every public ingress,
   including direct API access. Do not expose connection secrets in logs or documentation.
3. Apply `20261021040000_bounded_record_queries` to persistent environments before rollout.
   It adds indexes only; ordinary CREATE INDEX may block writes on large tables.
4. Deploy API and web together because record responses now use bounded pages and nextCursors.
   Confirm `ALLOWED_ORIGINS`, server-side `API_ORIGIN`, and proxy settings. Keep JWT and
   LINK_CODE secrets private. Hosting settings and application databases were not changed here.
5. Choose a stable production web hostname before passkey enrollment; a custom domain is
   not required. MFA remains missing. Keep idempotency keys stable for retrying one intent.
6. Use SECURITY_MITIGATION.md to run relevant checks and update this snapshot with new evidence.

No commit, push, or deployment was performed during the mitigation/documentation work.

## Idempotency verification update

The follow-up passed 69 API tests (including 12 PostgreSQL tests), four browser-client retry
tests, and the expanded real HTTP E2E suite (58 passes, one MFA TODO). Migration replay used
only disposable local databases, and the final migrated schema exactly matched Prisma. The former idempotency TODO is now an enforced passing
assertion. The full default build was attempted again and failed at Turbopack's internal
worker-port permission boundary; do not report it as a full pass.

## Refactor update (October 21, 2026)

The six phases of [REFACTOR_PLAN.md](REFACTOR_PLAN.md) are implemented locally on
`refactor/refactor-plan` (uncommitted). Controls moved, not changed:

- The user-row lock and the session-active check live once in `apps/api/src/auth/sessions.ts`
  (`lockUser`, `isSessionActive`, `isExpired`), used by `AuthService`, `JwtStrategy` and
  `idempotentWrite`. **Intended change:** a session is now rejected at exactly `expiresAt`
  everywhere (the JWT strategy and refresh previously accepted that instant).
- `idempotentWrite(prisma, { user, scope, key, payload, authorize, write })` takes one options
  object; replay, quota and the 64 KiB cap are named steps in `common/idempotency.ts`. Stored
  scope strings (`recordConsultation:<petId>`, `createPet`) are unchanged.
- The `Idempotency-Key` header is declared by `@IdempotentWrite()` / `@IdempotencyKey()`
  (`common/decorators/idempotent-write.decorator.ts`).
- Vaccination status and alerts moved to `records/vaccination-status.service.ts`. The capped,
  logged clinic listing is `PetsService.listVisible`, used by pet listing (`list_patients`) and
  alerts (`view_alerts`). Alerts now write that log entry before computing statuses.
- `BAD_REQUEST` business errors carry an optional `reason`; the web keys its Spanish copy on
  it and on Zod issue `params.reason`, not on English messages.
- `AiModule`, `packages/types/src/ai.ts` and `supabase/schema.sql` were deleted. The Prisma
  `Anomaly` model and table remain.

Local evidence on a disposable `vetify_security_*` database: 73 API tests (including the 12
PostgreSQL tests), 8 web tests, the HTTP E2E suite (58 passes, one MFA TODO), workspace lint and
typecheck, and the full `pnpm build` (including the web build) passed. Regenerated OpenAPI differs
from the pre-refactor export only by the additive `reason` enum and by dropping a spurious
duplicate `idempotency-key` header that was wrongly documented as required. No deployment.
