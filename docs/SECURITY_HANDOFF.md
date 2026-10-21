# Security handoff for agents and maintainers

Last updated: October 20, 2026. Original working branch: `feat/english-api-v1-security`.

The local work is organized as a dependent branch stack: `codex/refactor` →
`codex/security` → `codex/test`. Refactor contains English naming, presentation, and
documentation changes; security contains runtime controls and the API/type changes coupled
to them; test contains unit, integration, and adversarial E2E coverage plus CI wiring.
Use the final branch for the combined application. Earlier branches are intermediate
integration points, not independently verified releases. Creating these commits does not
approve the security roadmap or deploy the application.

This describes the inspected working tree and work completed in this session. Recheck source
and hosting before making security claims. Implemented locally does not mean committed,
deployed, or verified in production. See [SECURITY_MITIGATION.md](SECURITY_MITIGATION.md) for
the focused audit findings, fixes, and rollout instructions.

## Status at a glance

| Area                      | Current status                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Authentication            | Email/password, Argon2 password hashing, signed JWTs.                                                       |
| MFA                       | **Not implemented:** no second-factor challenge, authenticator codes, recovery codes, or passkeys.          |
| General write idempotency | **Not implemented:** no Idempotency-Key handling or persisted retry results.                                |
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

## Missing idempotency

Retrying POSTs can create duplicate pets, consultations, vaccinations, dewormings, treatments,
exams, weight entries, or feeding entries. A transaction does not make a later retry of a
successful write idempotent. A phone can lose the response after the server committed a write.

Existing narrower protections do not provide general request idempotency:

- Emails, clinic memberships, and pet/clinic permission pairs have unique constraints.
- Permission grants use an upsert; repeated status changes leave the same final state.
- Codes are single-use: retrying a successful grant may fail instead of replaying success.
- Some audit events are deduplicated; clinical writes are not deduplicated this way.

Proposed next design, **not implemented or finalized**: client-generated keys scoped to the
authenticated user, operation, and resource; a body fingerprint; transactional association
with the write/result; deterministic response replay; conflict handling for different payloads
using the same key; bounded retention; and concurrency/retry tests. Authorization must still
be checked on replay. Do not assume automatic offline POST replay is currently safe.

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

The PostgreSQL suite requires `SECURITY_TEST_DATABASE_URL`. Without it, seven suite tests are
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

The proposed next implementation is described in [SECURITY_ROADMAP.md](SECURITY_ROADMAP.md).
It is awaiting user approval; saving the roadmap does not start or approve implementation.

1. Inspect Git status and preserve existing work. English API/schema migration and security
   changes remained uncommitted at handoff. Older Scalar/Docusaurus work was committed
   separately. Many apparent deletions accompany renamed/untracked replacements.
2. Verify deployed TLS/certificates, database TLS, and proxy trust on every public ingress,
   including direct API access. Do not expose connection secrets in logs or documentation.
3. Apply `20261021040000_bounded_record_queries` to persistent environments before rollout.
   It adds indexes only; ordinary CREATE INDEX may block writes on large tables.
4. Deploy API and web together because record responses now use bounded pages and nextCursors.
   Confirm `ALLOWED_ORIGINS`, server-side `API_ORIGIN`, and proxy settings. Keep JWT and
   LINK_CODE secrets private. Hosting settings and application databases were not changed here.
5. Plan write idempotency for mobile retries and MFA for admins/clinics. Both remain missing.
6. Use SECURITY_MITIGATION.md to run relevant checks and update this snapshot with new evidence.

No commit, push, or deployment was performed during the mitigation/documentation work.
