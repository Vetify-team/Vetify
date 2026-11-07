# API security mitigation plan

Scope: follow-up API review on October 20, 2026, on `feat/english-api-v1-security`.
This tracks this review's findings, not the unavailable original 18-finding audit.

## Implementation

| Priority    | Finding                             | Mitigation                                                                                                                                                                                                                                                                            | Verification                                                                                                                                                                                               |
| ----------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First       | Login/registration CSRF             | Validate allowed origins on all session routes; reject browser-declared cross-site requests without Origin; require JSON for credentials.                                                                                                                                             | HTTP tests reject cross-origin JSON, form posts and opaque/missing browser origins; allowed-origin and CLI JSON login still work.                                                                          |
| First       | Refresh/replay race                 | Lock the user's PostgreSQL row before session reads/writes; rotate and issue the replacement in one transaction; commit replay revocation before returning 401. Logout using a rotated token also cuts off its successors. Admin promotion/revocation is atomic with the user update. | Real PostgreSQL tests cover two competing refreshes, refresh versus logout, and rollback after a failed replacement issuance.                                                                              |
| Next        | Unbounded histories/aggregates      | Default 50 and maximum 100 rows per section; scoped UUID cursors and deterministic date/ID ordering; web controls load older entries. Latest-dose summaries use indexed, bounded SQL queries over complete history.                                                                   | Database tests page through all seven sections, including tied dates and nullable treatment dates; foreign owners/cursors cannot read private history; latest-dose results match full-history computation. |
| Next        | Guard denials missing from audit    | Log authenticated pet 403/404 denials in the global filter, which sees guard exceptions as well as service exceptions; preserve privacy-preserving 404 responses.                                                                                                                     | HTTP guard-level denial tests and filter tests, including log-storage failure.                                                                                                                             |
| Next        | Parser errors lack headers          | Apply Helmet and no-store before parsers.                                                                                                                                                                                                                                             | Malformed and oversized JSON tests verify 400/413, no-store, nosniff and no powered-by header.                                                                                                             |
| Deployment  | Unsafe proxy hop assumptions        | Restrict numeric trust to 0/1; support validated explicit proxy CIDRs; reject universal /0 ranges.                                                                                                                                                                                    | Configuration tests; real ingress/header behavior must be checked in hosting.                                                                                                                              |
| Maintenance | Documentation dependency advisories | Scoped overrides update sockjs's uuid and postcss-calc's selector parser.                                                                                                                                                                                                             | Lockfile install, Docusaurus build and dependency audit.                                                                                                                                                   |

## Test and rollout sequence

1. Run `pnpm turbo run lint typecheck test build --concurrency=1`.
2. Create a separate local PostgreSQL database named `vetify_security_<suffix>`; do not use the
   application database. Apply migrations with `DATABASE_URL` set explicitly to that database.
3. Run the API tests with `SECURITY_TEST_DATABASE_URL` set to that same disposable database.
   Without that variable the seven database tests are skipped; HTTP security tests still run.
   CI provisions PostgreSQL and runs all tests automatically.
4. Apply `20261021040000_bounded_record_queries` before deploying the updated API to each
   persistent environment. It adds indexes only; it does not delete or rewrite clinical data.
   On large production tables, schedule index creation to account for write locking during
   ordinary CREATE INDEX. Do not assume deployment automatically applies migrations.
5. Deploy API and web together: the record contract now includes `nextCursors` and bounded
   pages, and the web's history/weight screens expose older entries explicitly.
6. Configure exact `ALLOWED_ORIGINS` for the web. Keep the web's `API_ORIGIN` server-side.
7. Verify every ingress path (web proxy and direct API URL), then set `TRUST_PROXY_HOPS=1`
   only for one verified boundary, or use actual `TRUST_PROXY_CIDRS` for several proxies.
   Try forged X-Forwarded-For values on each path and confirm they cannot choose the limiter
   bucket. Check login/refresh through the deployed web after changing these settings.

## Operational follow-ups retained explicitly

- Rate-limit state is in memory. Keep one API instance until shared storage such as Redis is
  implemented; verify IP/account limit behavior after any ingress or scaling change.
- Read/page bounds control query/response growth, not total stored data. Add account storage
  budgets and abuse monitoring before opening large-scale public registration. No clinical
  history is deleted or hidden permanently by this change.
- Record writes and their successful-access log entry are separate transactions. A durable
  outbox or shared transaction is a separate reliability/security follow-up.
- Duplicate registration still returns a specific 409, as previously accepted.
- The existing braces advisory exception remains build-time-only and explicitly documented.
- Unverifying a clinic stops new links; existing permissions remain until an owner revokes
  them. An emergency suspension capability would require a separate product decision.

Application data was not used for regression tests. All migration/concurrency checks for this
change use a disposable database; hosting configuration and production rollout remain pending.

## Verification completed

- 64 API tests passed across nine files, including the PostgreSQL concurrency suite and HTTP
  security probes. The concurrent-promotion check rejects stale password/role snapshots.
- Workspace lint and typechecks passed. Turbo explicitly forwards the security-test database
  variable, does not cache tests, and forwards API_ORIGIN to production builds.
- All five migrations replayed successfully on a fresh PostgreSQL 16 database. Prisma's
  database-to-schema comparison reported no difference.
- Fresh API and Docusaurus builds passed. The web production build and service worker passed
  using `next build --webpack` followed by `serwist build`.
- The default full build command remains blocked locally: Turbopack cannot bind its internal
  worker port in this execution environment. CI should still run the normal command.
- `pnpm audit --prod --audit-level=moderate` passed with no unsuppressed advisories. Only the
  existing explicitly ignored braces advisory remains. CI now enforces the moderate threshold.
- OpenAPI was regenerated with the pagination contract and session endpoint error responses.

No application-database migration, hosting setting change, commit, push or deployment was
performed as part of this mitigation work.
