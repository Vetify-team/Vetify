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

## Dependency security update (October 30, 2026)

The owner-navigation branch updates Nest's HTTP platform and pins patched transitive
versions of body-parser, qs, and Serwist's glob dependencies. The local production
package audit reports no known vulnerabilities after these changes. API tests and PWA
builds should be rerun in CI; Snyk results and deployment remain unverified until the
corresponding checks and rollout complete. The Serwist glob override crosses a major
version and should be removed when Serwist itself adopts a patched release.

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

## CI scanning configuration update (October 21, 2026)

Snyk dependency, code, and API container jobs and a SonarQube Cloud quality-gate
step are configured locally in CI. API/web coverage now uses LCOV, including
untested source and excluding the generated Prisma client. The existing pnpm
production audit remains. Scanner actions and the Snyk CLI are pinned. Credentialed
scans skip fork PRs and remain disabled until repository enable variables and
secrets are configured. See [CI_SECURITY_SCANNING.md](CI_SECURITY_SCANNING.md).
Cloud scans, service activation, and required branch checks remain unverified;
this configuration is not evidence of a passing security scan or deployment.

Local checks for this update: API coverage passed 60 tests, with 12 PostgreSQL
tests skipped because no disposable database URL was supplied; web coverage
passed all 4 tests. Both LCOV files were produced. Formatting and whitespace
checks passed. These results reflect the current working tree, including ongoing
application changes, and do not replace CI's database-backed verification.

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

## Onboarding and guided tour update (October 21, 2026)

The sign-up wizard and first-run tour of [ONBOARDING_PLAN.md](ONBOARDING_PLAN.md) are
implemented on `refactor/refactor-plan`. No API, schema or authorization change:

- `/registro` creates the account with the existing `POST /auth/register` (same `signUpSchema`,
  origin check and throttling); the password lives only in the `access` step's state and is not
  kept in the wizard. The first pet uses the existing idempotent `POST /pets`.
- Someone who opens `/registro` already signed in is sent home; the wizard never steps back past
  account or pet creation.
- New browser storage: `vetify:tour-pending:<userId>` = `"1"` in localStorage, a flag only (no
  personal or health data), set at sign-up or from Ajustes and cleared when the tour starts or
  is dismissed. Storage errors skip the tour.
- New dependency: `driver.js` 1.9.0 (MIT, no runtime dependencies), pinned. Its CSS and our
  overrides load as bundled styles; the CSP needs no change.
- Plans are informational: no billing, no stored plan choice, and the free-plan pet limit is
  still display-only (not enforced by the API).

Local evidence: web typecheck, lint and 15 web tests passed; `next build` passed. Both flows
(owner with first pet, clinic) and both tours were driven in a browser against a production
build and the local API. Running that required applying the repository's two pending migrations
(`bounded_record_queries`, `write_idempotency`) to the local dev database, without which
`POST /pets` returned 500. No deployment.

## Branch protection update (October 21, 2026)

GitHub ruleset `Protected main and dev - PR and CI required` is active on
`Vetify-team/Vetify` for main/dev, with no bypass actors. It requires PRs, one
approval of the latest push, resolved review threads, and up-to-date GitHub
Actions checks `Branch policy` and `Lint, typecheck, test and build`; deletion
and force pushes are blocked. Rules were read back from GitHub after creation.

Bootstrap PR https://github.com/Vetify-team/Vetify/pull/4 adds promotion validation
(work branches -> dev -> main), limits CI PR targets to main/dev, and restricts
deployment to successful push CI on main with checkout at the tested commit.
The Branch policy check passed on GitHub; full CI was still running at the first
check. Six local promotion-path cases and workflow formatting passed. No merge
or deployment was performed. Workflow and scanner local changes are preserved;
scanner enablement is separate from this bootstrap PR. See CI_SECURITY_SCANNING.md.

Final bootstrap PR verification: GitHub reported Branch policy, CI (lint,
typecheck, tests and build), and SonarCloud Code Analysis all successful. The PR
remains unmerged and requires a review approval. This is evidence for that small
bootstrap commit, not for the unrelated working-tree scanner/refactor changes.

## Snyk live verification update (October 21, 2026)

`SNYK_TOKEN` exists in GitHub (name verified only), `SNYK_ENABLED=true` is set,
and PR #4 now includes three pinned Snyk jobs with a 20-minute job timeout.
The correct setup input is `snyk-version: v1.1308.2`; the missing prefix caused
an initial binary-download error and was corrected. Snyk Code was enabled in the
existing `aleleonmarin` organization and confirmed after reload.

Run https://github.com/Vetify-team/Vetify/actions/runs/39723116009 completed the
scans: Code passed at medium-or-higher severity; dependencies failed on findings
(five projects scanned, four with vulnerable paths, 45 distinct advisory IDs);
container build succeeded, then its scan failed on bundled npm/pnpm findings.
The runtime Dockerfile now removes only root `scripts.prepare` inside the image
before production install so missing development-only Husky does not break the
build. Native package install scripts remain enabled. No findings were suppressed.

The build/test and branch-policy checks passed. This verifies the PR snapshot,
not unrelated local application/refactor changes. The PR remains unmerged.
Automatic approval review rejected making Snyk checks required in the existing
main/dev ruleset because failing checks would block merges; that ruleset remains
unchanged and explicit approval is needed for that additional policy change.
See CI_SECURITY_SCANNING.md for scope and findings.

## Public vaccination card (October 30, 2026)

Owners can create, retrieve, replace, and revoke one public card link per pet.
A link grants anyone holding it access to the pet's name and the current scheduled
vaccination statuses and dates; it does not grant access to the full record,
owner details, microchip, or deworming details. The QR puts its token in a URL
fragment; the public page submits it in a JSON body, avoiding token-bearing API
URLs. The API applies its general rate limit and no-store headers. QR images
and links are bearer credentials: recipients can copy and redistribute them.

The database stores a random nonce, not the complete link. The API derives the
link's MAC from LINK_CODE_SECRET with a card-specific domain separator. Replacing
or deleting the database row invalidates the previous link; rotating that secret
also invalidates all previously distributed card links. Card-link creation is
not idempotently retried: an uncertain response may require retrieving the
current link before repeating a replacement. Public card reads are not recorded
in the pet access log. API access remains network-only in the service worker.

Migration `20261030000000_card_links` was applied to the local development database.
Apply it to target environments before deploying the updated API and web together.
Production deployment, proxy/log settings, and QR scanning across devices remain
unverified. The public URL uses the web origin where it is generated; QR links
made on localhost are usable only from devices able to reach that origin.

Verification for this change: API lint and typecheck passed; API unit/HTTP tests
passed 63 tests with 12 database tests skipped. The real HTTP E2E suite ran on a
fresh migrated disposable local PostgreSQL database: 59 passed and the existing
MFA assertion remained a TODO. The new card test checks owner authorization,
public response fields, replacement, and revocation. Web typecheck and 15 tests
passed; web lint reported only image/coverage warnings. Browser QR scanning and
production rollout have not been verified.

## Owner notifications (October 30, 2026)

Local implementation adds an owner inbox and optional per-browser Web Push for
vaccination and deworming dates, generated at seven days before and on the due
date in Costa Rica time. The worker recomputes current status and checks again
before delivery; it does not rely on the older `reminders` rows. Inbox events
and per-subscription delivery records use unique constraints. Worker claims have
leases and bounded retries; push-service acceptance is not device delivery, and
an interruption after acceptance may still produce a duplicate. The inbox lists
the newest 100 entries. The hourly worker processes at most 100 delivery attempts
per run and schedules events only on their trigger day: a worker outage spanning
that day can miss a reminder. Monitoring and higher-volume scheduling need work.

Owner-authenticated endpoints manage inbox reads and push subscriptions. Push
endpoint destinations are restricted to supported Google, Mozilla, and Apple
hosts to reduce SSRF exposure. Subscription endpoints and keys are sensitive;
keep them out of logs and backups with weaker access controls. Logout attempts
server removal and always attempts browser unsubscribe; if network removal fails,
stale server entries are removed on a later 404/410 from the push provider.
The worker sends generic text and notification clicks open the authenticated
Avisos screen. The service worker still excludes API responses from caching.
Push configuration comes from API-only VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and
VAPID_SUBJECT; private keys must never be copied into web configuration. Rotate
keys carefully: browsers need to unsubscribe and re-enroll when the public key
changes. Permission, per-device enrollment, and network access are required.

Migration `20261030010000_notifications` was applied locally. At least one
long-running API instance must set NOTIFICATIONS_WORKER_ENABLED=true; the local
API was started that way. Production still needs migration, stable HTTPS origin,
secure VAPID configuration, worker deployment, monitoring, and real-device
verification. PWA registration is disabled in development, so local dev does not
prove iOS push. Changes are not deployed. Do not describe service-provider
acceptance as delivery to a device.

Notification verification: API lint and typecheck passed; the API Vitest run
passed 63 tests with 12 database tests skipped, and 15 web tests passed. The
real HTTP E2E suite used a fresh disposable local database and passed 60 checks
with the existing MFA TODO; the notification check exercised owner isolation,
endpoint validation, inbox read state, idempotent generation, and removal.
The production web and service-worker build passed. The inbox was opened in the
iPhone simulator. No real push-provider delivery, background device wakeup, or
physical-device notification click was tested.

## Development push test (October 30, 2026)

`DEV_PUSH_TEST_ENABLED=true` enables a test endpoint only when the API's
`NODE_ENV=development`. It requires an authenticated owner, targets only the
specified subscription owned by that user, and is limited to five requests per
minute per IP; the normal endpoint allowlist still applies. Its response means
the push service accepted the request, not that the phone displayed it. The
response, logs, and notification do not include subscription secrets or clinical
data. The endpoint is disabled in production even if the flag is set.

`NEXT_PUBLIC_DEV_PUSH_TEST_ENABLED=true` registers a separate development-only
service worker with push and click handlers but no caching; production uses the
normal Serwist worker. Local ignored `.env` files were configured with the dev
flags and a locally generated VAPID keypair, preserving any existing keys. This
is development configuration, not a production key or rollout. Turn both flags
off when finished and unsubscribe the test device; an already installed service
worker/subscription can otherwise remain in the browser. Existing development
and production installations should not share VAPID keys. iOS requires a Home
Screen install and permission initiated by a user tap; a real reachable HTTPS
origin is needed for testing on a separate phone. No actual push delivery to a
device has been verified yet.

Unit checks verified flag-off, production lockout, ownership, and a mocked push
provider; the disposable-database production HTTP suite also checked that the
endpoint remains unavailable when the flag is set in production.

Development push configuration fix: notification environment variables are now
retained by API environment validation, so values loaded from `apps/api/.env`
reach the running service. A local authenticated check confirmed that the API
reports a public key and enables the development test control. API typecheck,
lint, and 66 tests passed; 12 database tests were skipped. Device subscription
and delivery remain unverified.

The settings screen now offers opt-in before querying a push subscription when
notification permission has not yet been granted, and bounds subscription checks
to avoid an indefinitely blank screen. The simulator had registered its service
worker and fetched the configured public key, but device push delivery remains
unverified.

Further settings change: the client now fetches configuration and offers opt-in
before waiting for service-worker registration when permission is undecided.
Configuration and registration checks have timeouts. Physical delivery and this
updated flow in the installed simulator remain unverified.

Simulator retest: the installed iPhone app displayed the activation button and
notification permission was granted. Both `getSubscription()` and a direct
`subscribe()` attempt failed to resolve within their timeout on this simulator;
no subscription reached the API and no test push was sent. The cause is not yet
established. Subscription now starts directly from the user's tap as required
by WebKit. A physical-device test on a reachable HTTPS origin is still needed.

Temporary phone test: with explicit user approval, a public Cloudflare Quick
Tunnel is running to the local development web server. The ephemeral HTTPS origin
was added to the local API's allowed origins and Next's development-origin list;
these overrides are process-local. The local API remains in development mode with
the authenticated test-push endpoint enabled. The public tunnel exposes the local
app while it runs and is not a production deployment. The HTTPS page, health
endpoint, and unauthenticated origin-validation probe were checked; real-device
login and push delivery have not been verified. Stop the tunnel and restart the
local servers without the tunnel origin after testing.

Phone push test: the physical iPhone registered an Apple push subscription.
Apple initially returned HTTP 403 `BadJwtToken` for the local development
VAPID subject using a localhost email address. The local subject was changed to
the temporary HTTPS tunnel origin; a direct development test then received HTTP
201 from Apple's push service. Provider acceptance does not confirm on-device
display. The temporary origin and subject must be replaced with a valid stable
production contact for deployment; VAPID private keys remain local.

The user subsequently confirmed that the direct test appeared on the physical
iPhone, and confirmed that a second notification sent using the app's test
button also appeared. This is evidence for the temporary development tunnel,
not production hosting or scheduled reminder delivery.

## Cloud hosting setup (November 7, 2026)

Hosting resources now exist; production traffic still runs the old `main` until
`dev` is promoted. Values below are names and public URLs only; no secret value
was read, copied, or stored in the repository.

- Database: Neon project `vetify` (AWS us-east-2, Postgres 16, database
  `vetify`). Empty until the first migration run.
- API: Render web service `vetify-api` (Docker, `apps/api/Dockerfile`, Ohio,
  free plan, health check `/api/v1/health`), public at
  `https://vetify-api.onrender.com`. Auto-deploy is "after CI checks pass" from
  `main`. `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `LINK_CODE_SECRET` were
  generated by Render; `DATABASE_URL` (pooled Neon URL) was entered by the owner;
  `ALLOWED_ORIGINS=https://vetify-liart.vercel.app`; `TRUST_PROXY_HOPS` is left at
  0 because the direct Render URL is reachable. VAPID keys are not configured, so
  push stays off; the inbox worker is enabled but the free instance sleeps.
  The first deploy (old `main`) failed in the Husky `prepare` script, which `dev`
  already removes from the runtime install.
- Web: Vercel project `vetify` (root `apps/web`, build through Turborepo,
  `API_ORIGIN=https://vetify-api.onrender.com`), production domain
  `https://vetify-liart.vercel.app` from `main`, previews for other branches.
  Previews use the production API, whose `ALLOWED_ORIGINS` rejects their origin,
  so cookie sign-in does not work on previews. A staging API and Neon branch are
  needed before previews can be exercised end to end.
- Migrations: `.github/workflows/deploy.yml` runs `prisma migrate deploy` on each
  push to `main` in the `production` GitHub environment (restricted to `main`)
  with the direct Neon URL in the `DATABASE_URL_DIRECT` secret. The secret must
  be added by the owner before the first promotion.
- GitHub apps for Render and Vercel are installed on `Vetify-team` with access to
  this repository only.

Not verified: a production deploy of the current code, migration run against
Neon, TLS to Neon from Render, proxy/IP behavior, and real-device push.

### Domains and staging (November 7, 2026)

Domain `vetify.live` (name.com, DNS at name.com). One Next.js deployment serves
three sites chosen by host in `apps/web/src/proxy.ts` (`src/lib/sites.ts`): the
landing page, the owner app, and the clinic app (which also hosts admin). Pages
of one site requested on another redirect (307) to the owning host. Session
cookies stay host-only, so an owner session never reaches the clinic host and
the reverse. With `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_OWNER_URL` and
`NEXT_PUBLIC_CLINIC_URL` unset (local, Vercel preview URLs), every page is
served on every host, as before.

|                | Production (`main`)                    | Staging (`dev`)                          |
| -------------- | -------------------------------------- | ---------------------------------------- |
| Landing        | `www.vetify.live` (apex redirects 308) | `stg.vetify.live`                        |
| Owner          | `app.vetify.live`                      | `app.stg.vetify.live`                    |
| Clinic + admin | `clinica.vetify.live`                  | `clinica.stg.vetify.live`                |
| API (Render)   | `api.vetify.live` → `vetify-api`       | `api.stg.vetify.live` → `vetify-api-stg` |
| Neon branch    | `production`                           | `dev`                                    |
| Migrations     | env `production`                       | env `staging` (restricted to `dev`)      |

- `vetify-api` `ALLOWED_ORIGINS`: the production owner and clinic origins plus
  `https://vetify-liart.vercel.app` during the transition.
- `vetify-api-stg` (free, Ohio, branch `dev`, after-CI auto-deploy, secrets
  generated by Render, `DATABASE_URL` pooled Neon `dev` entered by the owner):
  `ALLOWED_ORIGINS` is the staging owner and clinic origins.
- Vercel: `API_ORIGIN` is the production Render URL for production and the
  staging Render URL for every preview, so previews no longer reach production
  data. Site URLs are set for production and for the `dev` branch only.
- The `staging` GitHub environment still needs its `DATABASE_URL_DIRECT`
  secret (direct Neon `dev` URL) before the first push to `dev` migrates.
- Email will send as `noreply@vetify.live`; no provider or DNS records yet.

Not verified: certificates on every host, the staging API deploy, and sign-in
on the new hosts end to end.

### Review and scanning gates relaxed (November 7, 2026)

At the owner's request, to merge without a second team member: the "Protected
main and dev" ruleset requires 0 approvals (no last-push approval) and no
longer requires any Snyk check; the CI Snyk jobs were removed because the free
plan's test limit blocked PRs. Still required: Branch policy; Lint, typecheck,
test and build (includes `pnpm audit --prod`); SonarCloud Code Analysis; PR
score. Lost coverage: Snyk Code and the API container image scan. Restore an
approval requirement once the team can review again.

### First production deploy (November 7, 2026)

`dev` was promoted to `main` (PR #14). Verified after the merge:

- `Migrate database` applied all 8 migrations to the Neon `production` branch;
  the same 8 had been applied to `dev` (staging) by the push of #13.
- `vetify-api` built and passes `/api/v1/health` on `vetify-api.onrender.com`
  and `api.vetify.live`; `vetify-api-stg` passes it on `api.stg.vetify.live`.
- HTTPS works on `www`, `app`, `clinica` and `api.vetify.live`; the apex
  redirects to `www` (308). Cross-site pages redirect (307) to their own host.
- Origin check in production: a failed login through `app.vetify.live` with
  Origin `app.` or `clinica.` returns 401; with a foreign Origin, 403.
- Staging: sign-up through `api.stg` returned 201 with an allowed Origin and 403
  with a foreign one, and `/auth/me` accepted the issued token. One QA owner
  account exists in the staging database. No account was created in production.
- Staging web hosts are behind Vercel Deployment Protection (team sign-in).

Still not verified: a full sign-up through the web UI in production, push
delivery in production (no VAPID keys configured), TLS between Render and Neon,
and proxy/IP behavior (`TRUST_PROXY_HOPS` stays 0).

## Payments with Tilopay (November 7, 2026)

Billing module `apps/api/src/billing`, hosted payment page only (Vetify never
sees card data). Flow: `POST /v1/billing/checkout {plan}` creates a `payments`
row (pending, unique `orderNumber`) and calls Tilopay `processPayment`; the
browser goes to Tilopay's form and returns to `<origin>/pago?order=…`.
`POST /v1/billing/confirm {orderNumber}` calls Tilopay `consult` and approves
only if the record has `code` 1 and the same order, amount, currency and
environment (`TILOPAY_ENVIRONMENT=test` accepts only "Test"). The redirect's
query parameters, including `OrderHash`, are not trusted: Tilopay does not
publish the hash algorithm. Approval is claimed with a conditional update, so
concurrent confirmations activate the plan once. A payment buys 30 days; paying
early extends from the current end. Clinic plans belong to the clinic.

- The checkout's return URL is the request Origin, and only an entry of
  `ALLOWED_ORIGINS` is accepted.
- Tilopay credentials (`TILOPAY_API_USER`, `TILOPAY_PASSWORD`, `TILOPAY_KEY`)
  live only in the API environment; billing reports `enabled: false` and
  checkout returns 503 `BILLING_UNAVAILABLE` without them. The API token is
  cached in memory for its lifetime.
- The free plan's 2-pet limit is now enforced in `PetsService.create`
  (`PLAN_LIMIT`), inside the idempotent write so replays keep their response.
- Not implemented: automatic renewal (Tilopay recurring plans), refunds, the
  Tilopay webhook (its spec is only given through Tilopay support), and
  reconciliation of payments a user never returns from.
- Migration `20261107200000_payments` is additive.

## Observability with OpenTelemetry (November 7, 2026)

`apps/api/src/instrumentation.ts` is loaded before the app
(`node --import ./dist/instrumentation.js dist/main.js`, in the Dockerfile and
`start:prod`). It starts the OpenTelemetry Node SDK only when
`OTEL_EXPORTER_OTLP_ENDPOINT` is set and exports over OTLP/HTTP (protobuf):

- Traces: incoming HTTP (route template, status, duration), Express and Nest
  handlers, `pg` queries (statement with `$n` placeholders; parameter values
  are not recorded) and outgoing `fetch` (Tilopay, web push).
- Metrics: `http.server.request.duration` per route and status, plus Node
  runtime metrics (event loop delay, heap, GC). Exported every 60 s.
- Logs: the pino JSON lines, after pino's `redact` (authorization, cookie,
  set-cookie, password), with `trace_id`/`span_id` added.

The health check `/api/v1/health` is excluded from traces and access logs.
Every response carries `X-Request-Id` (a fresh UUID; a client-sent id is not
trusted), and the access log line carries it as `req.id` plus `userId`/`role`
once authenticated. No emails, bodies or tokens are added.

Verified locally against a stub OTLP receiver: traces, metrics and logs were
received; an `Authorization` bearer and refresh cookie sent by the client did
not appear in the exported payloads (`[Redacted]` did); SIGTERM flushed the
pending batches; with no endpoint the API starts and exports nothing. The
Docker image was not rebuilt locally (Docker was not running); Render builds it.

Rollout: set in each Render service `OTEL_EXPORTER_OTLP_ENDPOINT`,
`OTEL_EXPORTER_OTLP_HEADERS` (secret, pasted by the account owner) and
`OTEL_RESOURCE_ATTRIBUTES=deployment.environment.name=production|staging`.
Backend chosen: Grafana Cloud free tier (any OTLP backend works unchanged).

## Landing install and clinic access pages; staging access (November 7, 2026)

- The landing site (www) gained `/instalar` (PWA install steps for iPhone and
  Android, a QR to the owner app, and a link to use it in the browser) and
  `/clinicas` (clinics ask an administrator by email, `contacto@vetify.live`,
  for a plan and the access link). Landing calls to action now go there instead
  of the owner sign-up/sign-in and the clinic sign-up. The owner and clinic
  sign-up routes themselves are unchanged: clinics are still verified by an
  administrator before they can see patients. `contacto@vetify.live` needs a
  mailbox or forwarding at the domain registrar to receive mail.
- OpenTelemetry is verified against Grafana Cloud on staging: logs, traces and
  metrics from `vetify-api-stg` arrived after the PR #20 deploy. Production has
  the variables set and starts sending once `dev` reaches `main`.
- `vetify-api-stg` sets `API_DOCS_ENABLED=true`, so the OpenAPI document and
  Scalar reference are public at `https://api.stg.vetify.live/api/docs`.
  Production keeps them off.
- Vercel Deployment Protection is off for the `vetify` project (staging hosts
  and preview URLs open without a Vercel login). They stay `noindex`, and the
  app's own authentication still protects every record. Re-enable it in Vercel
  → Settings → Deployment Protection if previews must be private.

## Password reset by email (November 8, 2026)

`POST /v1/auth/password/forgot {email}` and `POST /v1/auth/password/reset {token, password}`
(`apps/api/src/auth/password-reset*.ts`, mail in `apps/api/src/mail/`). Web screens
`/recuperar-contrasena` and `/restablecer-contrasena`, linked from sign-in.

- Forgot always answers 202 with no body; the lookup, link creation and email run after the
  response, so neither the answer nor its timing reveals whether an account exists.
- The link is built from the request Origin, which must be in `ALLOWED_ORIGINS`
  (missing/foreign Origin → 403). The token travels in the URL fragment
  (`/restablecer-contrasena#<token>`), so it is not sent to servers or in Referer headers,
  and the page removes it from the address bar after reading it.
- Tokens are 256 random bits; only their SHA-256 is stored (`password_resets`). A link expires
  after 30 minutes (`PASSWORD_RESET_MINUTES`), works once, and a newer link spends older ones.
- Reset claims the link with a conditional update under the user-row lock (concurrent uses
  change the password once), sets the Argon2 hash, spends every pending link and revokes
  every refresh session; logins racing it fail the existing password-hash check. The user
  logs in again. A "password changed" email follows.
- Limits: forgot 5/min per IP and 3/min per email (throttler) plus one email per minute and
  five per hour per account; reset 10/min per IP. Both require `application/json` and an
  allowed Origin, like the session routes.
- Email goes through Resend's HTTP API (`RESEND_API_KEY`, `MAIL_FROM`, default
  `Vetify <noreply@vetify.live>`). Without a key nothing is sent: development logs the email
  text (including the link) for local testing; other environments log only that it was
  skipped, never the link.
- Verified: unit tests (token format, hashing, link, rate rule, HTML escaping), HTTP tests
  (form posts 415, Origin rules), the adversarial E2E against PostgreSQL 16 (same 202 for
  unknown/known email, expired/short/reused tokens rejected, old access and refresh tokens
  revoked, old password 401, new 200), and a manual browser run of the whole flow.
- Not covered: MFA, notifying on repeated reset requests, and Resend delivery in staging and
  production until its domain and key are configured.
- Zoho Mail (free plan) hosts `admin@vetify.live` with the `contacto@` alias; the root MX, SPF
  (`include:zohomail.com`) and DKIM (`zmail._domainkey`) point to Zoho. Resend must be added
  with its own records without replacing Zoho's.
