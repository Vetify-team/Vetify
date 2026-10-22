# Write idempotency implementation

Implemented on `codex/write-idempotency`, based on unified commit `473a654`. This phase
covers pet creation and all seven record POSTs. It does not implement MFA, session management,
shared rate-limit storage, or verify production transport security.

The detailed API/client contract, retention limits, migration, pruning command and rollback
constraints are in [the API guide](../apps/docs/docs/api/idempotency.md).

## Verification

- 69 API tests passed, including all 12 disposable-PostgreSQL regressions. Added checks cover
  transaction rollback, failure to persist a retry result, session revocation, deterministic
  fingerprints, operation isolation, default response replay, and the retention budget.
- Four web-client tests passed: lost responses, proxy failures, explicit/manual keys,
  authentication refresh, and avoiding automatic retries on non-keyed operations.
- Expanded adversarial API E2E: 59 runner tests, 58 passed, one executed MFA TODO, no skipped
  tests or unexpected failures. All seven record routes deduplicate concurrent requests;
  vaccine/deworming reminders are created once. Pet retries, conflicts, key validation,
  current consent/role checks, user/resource isolation, and expiry are covered.
- Workspace lint, typechecks, API build, Docusaurus build, and the Webpack web build plus
  Serwist service-worker build passed.
- Migration replay succeeded against a fresh disposable PostgreSQL database; the final schema
  matched Prisma exactly. Application
  data was not used for testing or migrated by these checks.
- The default full verification command was attempted; Turbopack failed opening its internal
  worker port (`Operation not permitted`). This is not a full production-build pass.

## Deployment still required

Apply the additive migration before deploying API/web together. Schedule the pruning command
in each environment. Confirm the original allowed origins, API origin, proxy trust and TLS
settings. Keep a single API instance until the separate shared-rate-limit phase is complete;
the idempotency lock itself is shared through PostgreSQL and works across instances.

Physical expiry cleanup requires traffic or the scheduled pruning command. Raw response
snapshots may include clinical narrative and must have the same database protections as
records. Requests without a key can duplicate writes; keys are not retained across browser
reloads. The 1,000-result cap is a retry-storage budget, not a general clinical storage quota.
