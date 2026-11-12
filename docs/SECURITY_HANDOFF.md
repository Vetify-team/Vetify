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
| Uploaded files            | Cloudinary, `authenticated` type; per-pet signed uploads, re-checked size/format, 5-minute exam links.      |
| Clinic linking            | Admin verification and short-lived, single-use owner-entered codes.                                         |
| Clinic suspension         | Admin-only, audited, reversible; cuts permissions, sessions and log-in at once.                             |
| Clinic sign-up            | Only through admin-issued links (hashed, single use, 7 days); public sign-up creates owners only.           |
| Clinic teams              | Admin-only emailed invitations (hashed, single use, 7 days); removal cuts access and sessions at once.      |
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
permission read records and write medical acts. Exams (`record_exam`) are the exception that
both may write: owners add outside results. Admins verify clinics; being an admin does not
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
  them. To cut existing access at once, an admin suspends the clinic (see "Emergency clinic
  suspension").
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

## Payments with ONVO (November 9, 2026; replaced Tilopay)

Billing module `apps/api/src/billing`, ONVO hosted Checkout only (Vetify never
sees card data). Tilopay was removed before any real transaction: there was no
merchant account, and ONVO issues test keys as soon as an account is created.

Flow: `POST /v1/billing/checkout {plan}` creates a `payments` row (pending,
unique `orderNumber`), creates an ONVO one-time Checkout session
(`POST https://api.onvopay.com/v1/checkout/sessions/one-time-link`, amount in
céntimos, `metadata.orderNumber`) and stores its id in `provider_session_id`.
The browser goes to ONVO and returns to `<origin>/pago?order=…` (or
`…&cancelado=1` from the cancel link, which shows a message without polling).
`POST /v1/billing/confirm {orderNumber}` and the webhook both end in the same
settle step, which reads the session back (`GET /v1/checkout/sessions/{id}`)
and, once it is paid, its payment intent (`GET /v1/payment-intents/{id}`). It
approves only if the session is `complete`/`paid` and the intent `succeeded`
for the same amount, currency, order (when ONVO echoes the metadata) and mode.
The mode is taken from the key prefix (`onvo_test_` / `onvo_live_`), so a test
key can never approve a live payment or the reverse. Approval is claimed with a
conditional update, so the browser and the webhook racing activate the plan
once. A payment buys 30 days; paying early extends from the current end.
Clinic plans belong to the clinic.

- The checkout's return URL is the request Origin, and only an entry of
  `ALLOWED_ORIGINS` is accepted.
- `ONVO_SECRET_KEY` lives only in the API environment and must look like an
  ONVO secret key; without it billing reports `enabled: false` and checkout
  returns 503 `BILLING_UNAVAILABLE`.
- Any non-2xx answer from ONVO (401, 403, 404, 5xx, timeout) is a 503, never
  "pending", so a wrong key shows up as an error. The payment stays pending
  and can be confirmed later. (This closes the Tilopay defect where a 4xx read
  as "no record yet".)
- If creating the session fails, the order is marked declined. ONVO has no
  idempotency key, but nobody received a URL for that order, so a session
  created anyway cannot be paid and expires.
- `confirm` has its own rate limit (30/min per IP) above what `/pago` polls
  (15/min). Checkout stays at 10/min.
- Webhook: `POST /api/v1/billing/webhooks/onvo`, public, excluded from the
  OpenAPI document. It verifies `X-Onvo-Signature` (HMAC-SHA256 of
  `<t>.<raw body>` with `ONVO_WEBHOOK_SECRET`, constant-time compare, 300 s
  tolerance) over the raw bytes (`rawBody: true` in `main.ts`), answers 400 to
  bad signatures and 503 when unconfigured or when reading ONVO fails, so ONVO
  retries. Only `checkout_session.succeeded` is acted on, and only as a prompt
  to read the session back; the event's content is never evidence.
- Migration `20261109000000_onvo_payments` adds the nullable unique
  `provider_session_id` and changes the `provider` default to `onvo`. It is
  additive. Pending rows without a session (Tilopay-era) are declined when
  confirmed.
- Tests: `src/billing/billing.logic.spec.ts` (verdicts, signature),
  `test/http-security.spec.ts` (webhook through the real body parser, rejects
  re-serialized and stale bodies), `test/billing.integration.spec.ts` (service
  against PostgreSQL with an ONVO double: request shape, approval, clinic plan,
  expiry, every mismatch, 401/403/500 as 503, webhook, browser/webhook race).
- Verified locally against ONVO in test mode (November 9, 2026, with a real
  `onvo_test_` key): a card checkout through the hosted page, the return to
  `/pago`, and approval by reading the session and payment intent back. The
  payment row ended `approved` with `environment = test`, the session id and
  the payment intent id, so the response field names the code reads
  (`paymentStatus`, `paymentIntentId`, `mode`, amounts in céntimos) match ONVO.
  ONVO answers 400 to unknown fields (`property locale should not exist`).
  Not verified yet: the webhook (needs a public tunnel or a deployed API), a
  live payment, and SINPE Móvil, which does not work in ONVO's test mode even
  though its docs list test numbers.
- Checkout language: the hosted Checkout defaults to Spanish and switches to
  English only when the buyer's browser prefers English (it redirects to
  `/en/pay/…` and remembers a manual choice in its own storage). The session
  API has no locale field and the page ignores `?lang=`/`?locale=`, so Vetify
  cannot force it; the buyer can switch with the Español/English toggle.
  (`locale: "es"` in ONVO's docs belongs to the embedded `onvo.pay` form, not to
  hosted Checkout.)
- A session that disagrees with the payment (amount, currency, order, mode, or
  an intent that did not succeed) is logged, answered with 503, and left
  pending rather than declined, so a buyer who paid is not lost to a parsing
  difference. Only an expired unpaid session is declined. Such payments need a
  manual review (there is no admin view for them yet).
- Operations (current): Vetify is an academic project. `vetify-api-stg` and
  `vetify-api` both hold an `onvo_test_` key, so production shows payments that
  only accept ONVO test cards, and the free plan's pet limit is active in both.
  No webhook is registered and `ONVO_WEBHOOK_SECRET` is empty, so the webhook
  route rejects every call. Live keys, SINPE Móvil and real payments are out of
  scope.
- Not implemented (out of scope for the course): automatic renewal (ONVO
  subscriptions) and refunds.

- The free plan's pet limit (`FREE_PLAN_LIMIT`) applies only while payments are on
  (`ONVO_SECRET_KEY` set; `capsPets`). Without a key nobody is capped, since nobody could
  upgrade; the web hides the limit note too. The E2E sets a dummy test key to keep checking
  the limit.
- No webhook is registered in ONVO (decision of November 9, 2026). A payment settles when the
  browser returns to `/pago`, and `GET /v1/billing` also rechecks the account's three newest
  pending ONVO sessions of the last seven days, so a buyer who paid and closed the tab is
  activated the next time Ajustes or Plan loads. ONVO errors there are logged and skipped;
  the plan still loads. A payment the buyer never revisits stays pending.

## Observability with OpenTelemetry (November 7, 2026)

`apps/api/src/instrumentation.ts` is loaded before the app
(`node --import ./dist/instrumentation.js dist/main.js`, in the Dockerfile and
`start:prod`). It starts the OpenTelemetry Node SDK only when
`OTEL_EXPORTER_OTLP_ENDPOINT` is set and exports over OTLP/HTTP (protobuf):

- Traces: incoming HTTP (route template, status, duration), Express and Nest
  handlers, `pg` queries (statement with `$n` placeholders; parameter values
  are not recorded) and outgoing `fetch` (ONVO, web push).
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

## Email delivery and terms page (November 8, 2026)

- Resend sends from `noreply@vetify.live`: the domain is verified with `resend._domainkey`
  (DKIM) and the `send`/`rsend` CNAMEs (return path); a `_dmarc` record (`p=none`, monitoring
  only) was added. Zoho's root MX/SPF/DKIM are unchanged and Resend receiving is off.
  `RESEND_API_KEY` (sending-only, restricted to `vetify.live`) is set on `vetify-api-stg`
  and `vetify-api`. Verified on staging: a reset email was delivered to the Zoho inbox.
  Production uses it once the reset code reaches `main`.
- `/terminos` on the landing site holds the terms of use and the personal data notice
  (Ley 8968; providers and international transfer to the US listed). Sign-up requires an
  "I accept" checkbox: `signUpSchema.acceptTerms` must be `true` (400 otherwise) and the API
  stores `users.terms_version` (`TERMS_VERSION`, the date shown on the page) and
  `terms_accepted_at` (migration `20261108010000_terms_acceptance`; older accounts keep
  null). Changing the terms means bumping `TERMS_VERSION`; existing users are not asked to
  re-accept yet. The text is a draft that needs legal review and the operator's legal
  identity.

## Push in production and scheduled wake-up (November 10, 2026)

- `vetify-api-stg` and `vetify-api` each have their own VAPID key pair (generated locally,
  pasted into Render by the account owner, local copies deleted), `VAPID_SUBJECT =
mailto:contacto@vetify.live`, and `NOTIFICATIONS_WORKER_ENABLED=true`. Staging returns the
  public key from `GET /v1/notifications/push-config`.
- Render free stops the API after 15 idle minutes, and the worker only runs inside it (on boot
  and hourly). A Grafana Synthetic Monitoring HTTP check (`vetify-api-health`, probe Ohio,
  every hour, 60 s timeout) calls `https://api.vetify.live/api/v1/health`, which wakes the API
  so reminders are generated on their trigger day. The "Vetify: API caído" alert fires when the
  last result in 90 minutes is not a 200; notifications go to the owner's email.
- Not verified yet: a push delivered to a real device, and the first check result.

## Weight-change alerts (November 10, 2026)

- `suddenWeightChange` in `@vetify/types` is the one rule, used by the API and the web: a change
  of 10 % or more between consecutive entries at most 90 days apart. For pets under a year
  only losses count.
- `recordWeight` checks the rule inside the same transaction as the write and only when the
  new entry is the latest one. A backdated entry notifies nothing. The notice goes to the pet's
  owner, whoever recorded the weight. Its event key is the entry id, so idempotent retries add
  nothing.
- Notices and push deliveries go through `notifications/enqueue.ts`, shared with the reminder
  worker. The worker pushes weight notices on its next run, and only within two days of their
  creation.
- The inbox links weight notices to the weight page, which shows the same warning. The text
  holds the change in kg and percent; no other record data is added to the push payload, which
  stays generic.
- Verified: unit tests for the rule (`records/weight-alert.spec.ts`); an e2e test that a sudden
  change notifies the owner once and a backdated entry does not; the inbox and weight page
  checked against a local API.

## Reminder emails (November 10, 2026)

- Every notice (`vaccination`, `deworming`, `weight`) gets an `email_deliveries` row next to its
  push deliveries, through `notifications/enqueue.ts`. The worker sends it with Resend after the
  push run. It uses the same 60-second lease, five attempts, and 15-minute retry as push.
- Before sending, the worker checks again that the notice still holds (`stillCurrent`, shared
  with push). Rows end as `sent`, `skipped` (the owner turned emails off), `cancelled` (the
  notice no longer holds) or `failed`.
- Without `RESEND_API_KEY` the worker claims nothing, so rows wait instead of being marked sent.
- Owner preference: `users.email_reminders`, on by default. Owners read and change it through
  `GET/POST /v1/notifications/email` (owner role only, own account only) and the Ajustes switch.
  The setting is read when the email is sent, so turning it off also stops queued emails.
- Content: the owner's name, the pet's name, and the reminder line (vaccine or deworming kind
  and date, or the weight change). Names are HTML-escaped. No clinical notes, no other record
  data.
- `OWNER_APP_URL` (optional) adds a button linking to the pet's page. Without it the email goes
  out with no link. It is still to be set in Render for staging and production.
- Verified: unit tests for the template and the send/skip paths (`email-reminders.spec.ts`); e2e
  for the queued email row and the preference endpoints (per owner; clinic 403; bad body 400);
  the Ajustes switch saves and survives a reload on a local API. A real email send in staging is
  not yet verified.

## Account closure (November 10, 2026)

`POST /v1/auth/account/delete {password}` (`apps/api/src/auth/account.service.ts`, Zod
`deleteAccountSchema` in `@vetify/types`). Web: Ajustes → "Cerrar cuenta", shown to owners only.

- Owners only: `@Roles('owner')` on the route, and the service refuses any other role again.
  A clinic or admin gets 403 `FORBIDDEN`; nobody can close another account (the target is
  always the token's own user).
- Identity: the current password is verified with Argon2 against a live session; a wrong one
  answers 403 `WRONG_PASSWORD` (not 401, so the web client does not refresh and retry it).
  5 attempts per minute per IP and 5 per account, allowed Origin required, body password
  redacted from logs. The `account` throttler now keys authenticated requests on the bearer
  token's `sub` (read before the JWT guard, unverified: a forged `sub` only changes the bucket
  and is then rejected), so a stolen session cannot guess from many IPs.
- The delete runs under the user-row lock shared with login, refresh and password reset, and
  re-checks the password hash there: a reset that committed meanwhile wins. Logins racing it
  fail because the row is gone.
- Erasure is the `users` row delete; every owner table reaches it by `ON DELETE CASCADE`,
  checked in the migrations: refresh sessions, password resets, idempotency results, payments,
  app notifications, push subscriptions; and through pets: all record sections, permissions,
  card links, reminders, anomalies, notifications with their `push_deliveries` and
  `email_deliveries`, and the pet's access log. The E2E seeds every one of those tables for two
  owners and checks all reach zero for the closer and stay intact for the other.
- Decisions on what is not kept: payments are deleted with the account. Vetify issues no
  invoices and ONVO keeps its own transaction record. A late ONVO webhook for a deleted
  pending payment finds no row, logs a warning and is ignored (existing behavior). If an
  accounting duty to keep payment rows appears, change `payments.user_id` to nullable with
  `ON DELETE SET NULL` instead of the cascade. Access-log rows of the owner's pets go with the pets, as they
  already did when a pet was deleted, so the "never deleted" audit-log rule now means "never
  edited, and erased only with the pet it describes". Clinic-written consultations and
  vaccinations on those pets are erased too: the record belongs to the owner; a clinic's own
  legal record-keeping lives outside Vetify. Rows of other users that only point at the owner
  keep `ON DELETE SET NULL` (consultation veterinarian, access-log user); owners do not create
  them today.
- After commit the API emails "Tu cuenta de Vetify se cerró" through `MailService` (failure is
  logged, never undoes the deletion) and clears the refresh cookie. The web unsubscribes this
  browser from push, leaves a one-shot flag in this tab's sessionStorage and does a full page
  load to `/iniciar-sesion`, which shows the notice once and drops everything the tab held in
  memory. The notice is not in the URL, so a crafted link cannot show it.
- Not covered: deleting a clinic or admin account (no flow), a grace period or undo, other
  devices' local push subscriptions (their server rows are gone, so nothing is sent), and
  backups: Neon's point-in-time history keeps deleted rows until its retention window passes.
- Keyed writes racing the deletion end in 401: after the user lock they check the session,
  which the cascade removed.
- Verified locally: unit tests (service, email escaping, per-user throttle key, clinic 403 and
  missing/foreign Origin 403 at the HTTP boundary),
  the adversarial E2E against PostgreSQL (`closing an account erases all of that owner's data
and nothing else`: clinic 403, wrong/missing password changes nothing, success 204, old
  token/cookie/password rejected), and a browser run with a disposable local database (wrong
  password message, deletion, redirect with notice, crafted link shows none, dev email text). Not yet verified on
  staging or production.

## Pet photos and exam files (November 11, 2026)

Storage is Cloudinary (free plan, chosen by the user over Vercel Blob and Cloudflare R2). The
API holds `CLOUDINARY_URL` (`cloudinary://<key>:<secret>@<cloud>`); without it uploads and file
links answer 503 `UPLOADS_UNAVAILABLE`. The web never receives the secret. Code:
`apps/api/src/files/`, `@vetify/types` `file.ts`, web `lib/upload.ts`,
`components/file-upload.tsx`, `pets/pet-photo.tsx`, `record/exam-form.tsx`,
`record/exam-file-button.tsx`. Migration `20261112000000_uploaded_files` adds `pets.photo_id`,
`exams.file_id`, `exams.file_format` (both ids unique) and `exams.recorded_by_owner`.

- **Signing** (`POST /v1/pets/:petId/uploads {purpose, contentType, size}`): authorizes first
  (`pet_photo`: `administer`, owner only; `exam_file`: new `record_exam` operation, owner or
  clinic with an active full permission). Then it checks the declared type and size against
  `UPLOAD_LIMITS` (photo: JPEG/PNG/WEBP/HEIC up to 5 MB; exam: those plus PDF up to 10 MB). The
  signature covers a new public id `pets/<petId>/<photo|exams>/<uuid>`, `type=authenticated`,
  `allowed_formats` and `overwrite=false`. Cloudinary rejects any unsigned extra parameter.
  Upload and download-link signatures use SHA-256 (Cloudinary accepts it; verified live), tested
  against the official SDK's output. Photo thumbnail URLs keep Cloudinary's 8-character SHA-1
  form: the 32-character SHA-256 form needs a paid feature and answers 401. That line carries a
  `NOSONAR` comment.
- **Limits**: Cloudinary checks the format at upload but cannot cap a signed upload's size, and
  a signature stays valid for one hour (Cloudinary's window, not ours). So before a record keeps
  a file id, `FilesService.verify` checks the id's prefix (this pet and purpose, before any
  network call). It then reads the stored file through the Admin API and rejects and deletes a
  file over the size or of another format. `overwrite=false` stops a replayed signature from
  swapping the file after the check. The declared size in the signing request is only for
  early feedback.
- **Writes**: `PATCH /v1/pets/:petId {photo: fileId | null}` replaces or removes the photo and
  deletes the previous file after the update. It also clears the pre-upload `photoUrl` link.
  `photoUrl` and `fileUrl` are no longer accepted as input; existing links are still returned.
  `POST /v1/pets/:petId/exams {file}` is now open to owners too (`recordedByOwner: true`). The
  file check runs after authorizing and before the transaction, so no database connection waits
  on Cloudinary. A file id serves one exam.
- **Reading**: photos are signed thumbnails
  (`c_fill,g_auto,h_512,q_auto,w_512`, JPEG). The signature covers the transformation, so
  the original and other sizes cannot be requested. These URLs do not expire: anyone who
  copied one (for example a clinic whose permission was later revoked) can still see that
  photo until it is replaced. Accepted for a pet photo. Exam files are never in a URL that
  lasts: `GET /v1/pets/:petId/exams/:examId/file` authorizes `read`, checks the exam belongs to
  the pet, and returns a Cloudinary download link that expires in 5 minutes (logged as
  `view_exam_file`). The upload response the browser gets from Cloudinary contains a
  non-expiring signed URL of the original. The web discards it, but the uploader can keep it.
- **Deletion**: closing an account reads the owner's pet ids under the user lock, deletes the
  rows, and after commit deletes every file under `pets/<petId>/` (Admin API by prefix,
  repeated while `partial`). It is best effort: a Cloudinary failure is logged and leaves
  orphaned files no record points to. There is no pet or exam deletion endpoint yet. When one
  is added, call `FilesService.deletePetFiles` / `delete` after its commit. Uploads that are
  never saved to a record also stay orphaned. There is no cleanup job.
- **Web**: CSP adds `https://api.cloudinary.com` to `connect-src` (direct upload) and
  `https://res.cloudinary.com` to `img-src`. Uploads use XHR for progress. The client repeats
  the type/size check only to word errors in Spanish. The exam form will not submit while a
  chosen file is uploading or failed.
- **Verified locally**: unit tests (signing vs SDK, authorization per purpose, type/size,
  prefix, oversize/wrong format delete, 5-minute link, prefix deletion, account closure
  call). The adversarial E2E runs against PostgreSQL with a local stand-in for Cloudinary's API:
  another owner, an unpermitted clinic and admin cannot sign or read; invalid types and sizes
  fail at signing and on the stored file; a file signed for one pet or purpose cannot be saved
  elsewhere; owner and clinic exams; links expire within 300 s; account closure deletes the
  closer's prefix only. A browser run used local previews with fake credentials: photo preview
  and progress, Spanish errors, owner exam form, clinic view, link endpoint.
- **Verified against the real Cloudinary (local API, November 11, 2026)** using a dedicated
  `vetify-api` key with the Master Admin role. A narrower role is untested; the Admin API
  calls need read and delete access to resources.
  - Signed upload works, and the photo is served as a signed JPEG thumbnail under the CSP. The
    unsigned original answers 401.
  - Replacing or removing the photo deletes the old file (the CDN answers 404 within seconds).
  - A replayed signature does not overwrite (`existing: true`), and adding an unsigned field
    is rejected with 401 "Invalid Signature".
  - A PDF is rejected as a photo by `allowed_formats`. A 5.9 MB photo declared as 1 KB is
    stored by Cloudinary, then refused and deleted at save time (`FILE_TOO_LARGE`).
  - The owner's and the clinic's exam links return `application/pdf` inline, byte-identical
    to the uploaded file.
  - An exam link answers 200 when issued and 401 after 5 minutes 10 seconds.
  - Closing an account makes its exam file answer 404.
  - Not verified yet: staging and production.

## Welcome email (November 10, 2026)

- `AuthService.signUp` sends one welcome email (`welcomeEmail` in `mail/templates.ts`) to every
  new owner or clinic account, worded per role in Spanish. Owners get an "Abrir Vetify" button
  to `OWNER_APP_URL` (none when it is empty). Clinics get no button: there is no clinic app URL
  in `config.ts`. Their text says the team verifies the clinic before owners can share records.
  Names and the clinic name are HTML-escaped. The text holds no token, link credential or
  record data.
- Sent after the sign-up transaction commits and not awaited (`void … .catch(log)`), the same
  pattern as the password-changed and account-closed emails. A Resend failure or timeout is
  logged and does not fail or delay the sign-up.
- Not queued in `email_deliveries`: those rows hang off an `app_notifications` row with a
  pet and are shown in the owner's inbox, and the worker runs hourly and only where
  `NOTIFICATIONS_WORKER_ENABLED=true`. Queuing would need a schema change for an email
  the account does not depend on. Accepted trade-off: a failed welcome is not retried.
- Sent once: only the request whose `users` insert committed reaches the send. A repeated
  sign-up hits the unique email first (409 `EMAIL_TAKEN`). Registration takes no
  idempotency key.
- Without `RESEND_API_KEY` `MailService` sends nothing, as for the other emails.
- Verified locally: unit tests (`auth/welcome.spec.ts`) for both templates, escaping, no
  button without a URL, a single send after the insert, sign-up resolving when the send
  rejects or never settles, no send on 409, and no request without a key. The adversarial E2E
  now sets a fake `RESEND_API_KEY` and answers every Resend call with a local stand-in, so no
  test reaches Resend even when a local `.env` has a key. It checks that registration
  answers 201 while Resend returns 500 or never answers, and that a retried sign-up gets 409
  without a second welcome.
- Verified in staging (November 11, 2026): the owner and clinic welcome emails were delivered.

## Emergency clinic suspension (November 11, 2026)

- `POST /api/v1/admin/clinics/:id/suspend` (body `{ reason }`, Zod: trimmed, 3–500 chars) and
  `POST …/reinstate`, both `@Roles('admin')`. Suspending twice or reinstating a clinic that is
  not suspended answers 400; an unknown clinic, 404.
- `clinics.suspended_at` marks the state; `clinic_suspensions` keeps the audit: reason,
  `suspended_by_id`, `suspended_at`, `lifted_by_id`, `lifted_at`. Rows are inserted and closed
  once, never deleted except with the clinic (an admin's deletion sets the ids to null).
- Effect, all in one transaction:
  - `PermissionsService.authorize` and `visiblePets` filter `clinic.suspendedAt: null`, so a
    suspended clinic's permissions grant nothing to any request, including one in flight.
    The permissions are kept, so reinstating restores them without the owners acting.
  - Every refresh session of the clinic's staff is revoked. `JwtStrategy` checks the session
    per request, so live access tokens die on the next call.
  - `AuthService.issueSessionIn` (sign-up, log-in, refresh) refuses staff of a suspended
    clinic with 403 `CLINIC_SUSPENDED`, after the password check, so a wrong password still
    answers 401 and does not reveal the suspension.
  - Link codes cannot be issued, previewed or consumed, and an owner cannot restore a
    revoked permission of a suspended clinic (`assertCanLink`).
- Race with log-in: suspension takes each staff member's row lock (`lockUser`, sorted by id)
  before revoking sessions, the same lock session issuance holds while checking. A log-in
  either sees the suspension or commits first and has its new session revoked.
- Owners see a "Suspendida" label next to the clinic in the pet's permissions; the clinic
  object now carries `suspendedAt`.
- Verified locally: unit tests (`admin/admin.service.spec.ts`, permission and link-code specs),
  and the adversarial E2E case "emergency suspension cuts reads, writes, sessions and linking
  at once": non-admins get 403; invalid reason 400; the clinic's token, cookie and log-in fail;
  other clinics are unaffected; the owner sees the label; reinstating closes the audit row and
  restores the same permission. The admin page, the suspended log-in message and the owner
  label were checked in the browser against a local API.
- Not verified: the migration on staging and production, and the flow in a deployed
  environment.

## Clinic teams and signed medical acts (November 11, 2026)

- `clinic_staff.role` (`admin` | `veterinarian`) replaces the free-text `position`; the
  migration turns `'admin'` rows into `admin`. Membership is still what `authorize` checks
  (`clinic.staff.some.userId`), read on every request.
- Team endpoints live under `/api/v1/clinics/mine/…` with `@Roles('clinic')`, and
  `ClinicsService.adminOf` requires the caller's membership role to be `admin`
  (veterinarians, owners and Vetify admins get 403):
  - `GET staff`;
  - `POST staff/:userId/remove`;
  - `GET invitations`;
  - `POST invitations` (Zod: email, role; 10/min);
  - `POST invitations/:id/revoke`.
    Every query is scoped to the caller's clinic, so another clinic's member or invitation
    answers 404.
- Invitations (`clinic_invitations`): 256-bit random token, only its SHA-256 stored; expires
  after 7 days; single use. The emailed link is `<request Origin>/invitacion#<token>` (Origin
  must be in `ALLOWED_ORIGINS`, as for password resets); the page reads the fragment and
  removes it from the address bar. Inviting the same email again revokes the earlier link.
  An email that already has an account is refused (409 `EMAIL_TAKEN`): an account is an
  owner or a clinic member, never both. If Resend fails, the invitation is revoked and the
  API answers 503 `MAIL_UNAVAILABLE`.
- `POST /api/v1/clinic-invitations/preview` (public, 10/min) shows clinic, email and role.
  `POST /api/v1/auth/clinic-invitations/accept` (public, Origin-checked, 10/min) claims the
  invitation with an atomic `updateMany` (not accepted, not revoked, not expired) and, in
  the same transaction, creates the `clinic` user with the invited email and role and its
  membership. Reused, revoked or expired links answer 400 `INVITATION_INVALID` and create
  nothing; a suspended clinic answers 403 `CLINIC_SUSPENDED`.
- Removal deletes the membership and revokes the member's sessions under their user lock, in
  a transaction that first locks the clinic row (two admins cannot remove each other and
  leave none; the last admin answers 400). `AuthService.issueSessionIn` refuses a `clinic`
  user without membership (403 `NOT_CLINIC_MEMBER`), so the former member cannot log in or
  refresh. Their account and what they signed remain.
- Authorship: consultations, vaccinations, dewormings, treatments and exams store `clinicId`
  and `veterinarianId` from the permission and the session (`authorOf` in
  `records.service.ts`); request fields with those names are stripped. Owner-recorded exams
  have neither. Existing rows were not backfilled (unknown author). The record response
  resolves names for every section; the history and the PDF show them.
- Not changed: any team member can still start a clinic plan checkout and issue link codes.
- Verified locally:
  - unit tests (`clinics/team.service.spec.ts`);
  - the adversarial E2E case "team invitations are single use and expire; signatures and
    removal follow the member": only clinic admins manage the team; foreign origin 403;
    taken email 409; token not stored; another clinic cannot revoke or list; accept then
    reuse 400; expired and revoked 400 with no account; signatures on all five acts ignore
    spoofed ids; removal gives 401 on the token and cookie, 403 on log-in; the last admin
    stays;
  - in the browser against a local API: invite, accept page, the signed history and
    removing a member.
- Not verified: Resend delivery of the invitation and the migration on staging and
  production.

## Clinic sign-up links (November 11, 2026)

- Public `POST /api/v1/auth/register` now creates owners only (`role` is `z.literal('owner')`;
  `role: 'clinic'` answers 400). Clinics register only with a link a Vetify admin issues.
- `clinic_signup_links` stores:
  - the email, a suggested clinic name, the plan (`pilot | office | clinic | chain`) and an
    optional payment reference;
  - the SHA-256 of a 256-bit token (`common/link-tokens.ts`, shared with team invitations);
  - who created it, `expiresAt` (7 days), and `usedAt`/`usedClinicId` or `revokedAt`.
- Admin endpoints use `@Roles('admin')` under `/api/v1/admin/clinic-signup-links`:
  - `GET` lists the pending links, without the token;
  - `POST` (Zod) refuses emails that already have an account (409) and requires an allowed
    Origin. It emails `<Origin>/registro#clinica=<token>` and returns the URL once so the
    admin can copy it;
  - `POST :id/revoke`.
    A failed email does not revoke the link, because the admin already holds it.
- `POST /api/v1/clinic-signup-links/preview` is public (10/min).
  `POST /api/v1/auth/clinic-signup` is public, Origin-checked and 10/min. It claims the
  link with an atomic `updateMany` (not used, not revoked, not expired) in the same
  transaction that creates the `clinic` user with the link's email, the clinic and the
  `admin` membership. A paid plan sets `plan` and `planUntil = now + PLAN_PERIOD_DAYS`; the
  admin confirmed the payment outside the app, because ONVO Checkout needs an account.
  The clinic starts unverified. A used, revoked or expired link answers 400
  `SIGNUP_LINK_INVALID` and creates nothing.
- The web wizard reads the token from the fragment, removes it from the address bar, fixes
  the email and plan, and skips the plan choice. Choosing "Soy una clínica" without a link
  leads to `/clinicas`.
- `AuthService` account creation (owner sign-up, clinic sign-up, team invitation) shares one
  path: `createAccount` (hash, transaction, P2002 → 409, first session).
- Verified locally:
  - unit tests (`clinics/signup-links.service.spec.ts`, `auth/welcome.spec.ts`);
  - the adversarial E2E case "clinics register only with an admin link":
    - self sign-up as a clinic → 400;
    - non-admins → 403; a bad plan → 400; a foreign origin → 403; a taken email → 409;
    - the token is not stored or listed;
    - registering creates an unverified clinic on the paid plan with the founder as admin;
    - a reused, expired or revoked link → 400 and no account;
  - in the browser: issuing and copying a link, the wizard with the link, the agreed plan
    step, the dead-link screen, and the clinic choice without a link.
- Not verified: Resend delivery and the migration on staging and production.

## Clinic verification audit and notices (November 11, 2026)

- `clinics.verified_by_id` (FK to `users`, `ON DELETE SET NULL`) records the admin who
  verified the clinic, next to `verified_at`. Migration `20261116000000_clinic_verified_by`;
  clinics verified before it keep a null.
- `POST /api/v1/admin/clinics/:id/verify` now changes only an unverified clinic
  (`updateMany … where verified = false`). The request that changes it stores the admin and
  emails every clinic administrator (`clinic_staff.role = admin`) with `clinicVerifiedEmail`.
  Verifying a verified clinic keeps the first verifier and sends nothing; an unknown clinic
  answers 404. `unverify` clears `verified_at` and `verified_by_id`.
- `POST /api/v1/auth/clinic-signup` emails every `users.role = admin` account
  (`clinicPendingReviewEmail`): clinic name and the registering email, so the admin knows
  whom to check. No token, password or record data.
- Links in both emails come from the request's Origin only when it is in `ALLOWED_ORIGINS`
  (`trustedOrigin` in `common/http/origin.ts`): `<Origin>/codigo` for the clinic and
  `<Origin>/admin/clinicas` for admins. Without a trusted Origin the email has no button.
  Names are HTML-escaped.
- Both are sent after the write and not awaited, with each failure logged, like the welcome
  email: a Resend error never fails the verification or the sign-up, and nothing is retried.
- The admin list and the verify/unverify responses use `AdminClinic`, which adds
  `verifiedAt` and `verifiedBy: { name }`. The clinic-facing `Clinic` shape is unchanged, so
  clinics never see admin names. The admin page shows the date and the admin's name.
- Verified locally: unit tests (`admin/admin.service.spec.ts`, `auth/welcome.spec.ts`) for
  the conditional update, the recipients, the idempotent repeat, 404, failing sends and the
  missing origin; the adversarial E2E (68 pass, 0 fail, 1 known MFA TODO) on a freshly
  migrated disposable database.
- Not verified: the migration on staging and production, Resend delivery, and the admin page
  in the browser.

## Card-only permission for clinics (November 12, 2026)

- Before this change a `card_only` permission granted nothing: `authorize` and `visiblePets`
  require `scope: 'full'`, so the clinic could not see the pet at all. That rule is unchanged
  for every record read and write.
- New `GET /api/v1/clinics/mine/cards` (`@Roles('clinic')`): every pet with an active permission
  of the user's clinic, `full` or `card_only`, through `visiblePets(user, { cards: true })`
  (same active-status, staff-membership and not-suspended filters). Each card carries only
  `petId`, `name`, `species`, `fullAccess` and the recorded vaccine doses (`vaccine`, `status`,
  `lastAppliedOn`, `expiresOn`): the public-card fields plus species. No owner, microchip,
  birth date, dewormings or record entries.
- Each pet listed is logged under `view_card` (deduplicated, like `list_patients`), so the owner
  sees card reads in the access log.
- `fullAccess` comes from a separate query of active full permissions of the same clinic; the
  web links only those pets to their record. The patient page answers a 403 with a pointer to
  Carnés instead of a bare error.
- Verified locally: unit tests (`records/card.spec.ts`, `permissions.service.spec.ts`) and the
  adversarial E2E case "card-only consent cannot be escalated…", now also checking that the
  card-only pet is absent from `/pets`, present in `/clinics/mine/cards` with only those keys and
  recorded doses, that the read is logged, and that an owner gets 403. 68 pass, 0 fail, 1 known
  MFA TODO, on a freshly migrated disposable database.
- Not verified: staging and production, and the Carnés page in the browser.

## Assistant (November 2026)

- `POST /v1/pets/:petId/assistant/messages` answers questions about one pet with its record
  through any OpenAI-compatible chat completions provider (`LLM_BASE_URL`, `LLM_MODEL`,
  `LLM_API_KEY`; Gemini's compatible endpoint in development). Without a key it answers 503
  `ASSISTANT_UNAVAILABLE` with reason `ASSISTANT_DISABLED`. Contract and behavior:
  `apps/docs/docs/api/assistant.md`.
- **Authorization.** `PermissionsService.authorize(user, petId, 'read')` runs first, before the
  enabled check: another owner gets 404, a clinic without an active full permission 403. Clinic
  mode applies to any member of the clinic team (`admin` or `veterinarian`), and the clinic
  must be verified and not suspended: otherwise 403 `CLINIC_NOT_VERIFIED` or
  `CLINIC_SUSPENDED`, the errors linking already uses, before the model is called. This is
  stricter than reading the record, which an un-verified clinic keeps until owners revoke. The
  mode (`owner` or `clinic`) comes from the token's role, never from the body. The tools call
  `PetsService`, `RecordsService` and `VaccinationStatusService` as the same user, so each
  call is authorized again and a revoked permission stops the next one. The assistant does
  not read record data from Prisma. Tools take no pet id, so the model cannot reach another
  pet.
- **Data minimization.** The provider gets compact DTOs built field by field: species, breed,
  sex, neutered, age, and each record's id, date and clinical fields (at most 20 entries per
  section). Never the pet's name or birth date, the owner's name, email or phone, the
  microchip, photo or exam file links, vaccine batches, or user, clinic and veterinarian ids
  or names. `assistant/tools.spec.ts` checks every tool's output for these, and the
  PostgreSQL integration case checks a real tool result. What the user types goes to the
  provider as written.
- **Nothing of the conversation is stored.** The client sends it each time (at most 20
  messages of 2,000 characters, the last one the user's). `assistant_usage` keeps user, pet,
  time and token counts for the monthly allowance; it cascades with the user and the pet.
- **Emergency signs.** `assistant/safety.ts` checks the last user message, accents and case
  ignored, for seizures, breathing trouble, poisoning (including chocolate, rat poison, human
  painkillers), heavy bleeding, being hit by a vehicle, swollen belly with retching, not
  urinating, loss of consciousness and heat stroke. For an owner, the API answers a fixed
  "go to an emergency clinic now" message with `urgent: true`, without calling the model,
  without counting it, and even over the monthly limit. For a clinic it only sets `urgent`.
  The rule leans to false alarms; a few everyday phrasings may trigger it.
- **Prompts.** Separate system prompts per mode (`assistant/prompts.ts`): pet topics only,
  record facts only from tools and with their dates, no invented entries, tool output treated
  as data, no doses or human medication for owners, the clinical decision left to the vet, and
  requests to drop the rules or reveal them declined. These are instructions to the model,
  not guarantees: the hard controls are authorization, minimization and the emergency check.
- **Access log.** `@LogAccess('use_assistant', { dedupe: true })`: the owner's log shows when a
  clinic used the assistant on the pet ("Consulta con el asistente" in the web).
- **Limits.** 10 questions per minute per account (`account` throttler). Owners on the free
  plan get `ASSISTANT_FREE_MONTHLY_MESSAGES` (default 30) per calendar month in Costa Rica time,
  only while payments are on, like the pet limit; Premium and clinics are unlimited. Over it:
  429 `RATE_LIMITED` with reason `ASSISTANT_LIMIT`, without calling the model. The count is
  read before answering, so two requests racing at the limit may both pass.
- **Provider errors.** No answer in 30 s, 401, 402 (no credit), 429, 5xx or an unreadable body
  all become 503 `ASSISTANT_UNAVAILABLE` with a fixed message. The provider's body is never
  forwarded or logged; the log line has only the status. The key stays on the API. No usage is
  recorded for a failed answer. Fields a provider adds to a tool call (Gemini 3's
  `extra_content` thought signature, required on the follow-up) are kept as opaque data and
  sent back only to that provider; they never reach the client. Requests use temperature 0.2, `max_tokens` 2,500 (room for the reasoning of thinking models),
  `reasoning_effort` from `LLM_REASONING_EFFORT` (default `low`; empty sends none) and at most 5
  model calls per question (the last without tools).
- Verified locally: unit tests for the emergency rule (with and without accents, positives and
  negatives), the DTOs, the provider client (status mapping, timeout, nothing secret in the
  logs), the tool loop and its round cap, the emergency path, the plan limit and the
  authorization denials; a PostgreSQL integration case for the denial, the stored usage row and
  the monthly cap. Not yet verified: answers from a live provider in staging, and the web
  screen (not built yet).
