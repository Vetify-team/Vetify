# API security tests

## Real adversarial end-to-end suite

`security.e2e.mjs` starts the compiled production AppModule on an ephemeral loopback port with
the real JWT, rate-limit and role guards, services, filter, and PostgreSQL adapter. There are
no authentication or database mocks. Fixtures include two owners, two clinics, and an admin;
all login and exercised business operations use HTTP. Privileged fixture provisioning and
expiry/history setup use the disposable database directly.

The suite requires a separate migrated local PostgreSQL database named `vetify_security_*`.
It refuses remote hosts, non-test names, URL query/hash overrides, and non-PostgreSQL URLs.
It never falls back to DATABASE_URL, never targets the existing development server, generates
temporary signing secrets, and removes only its own fixtures before closing its servers.
It does not create, migrate, or drop the database for you.

From the repository root, with the local PostgreSQL container running:

```sh
docker exec vetify-db psql -U vetify -d postgres -c 'CREATE DATABASE vetify_security_e2e;'

DATABASE_URL=postgresql://vetify:vetify@localhost:5432/vetify_security_e2e \
  pnpm --filter @vetify/api exec prisma migrate deploy

SECURITY_TEST_DATABASE_URL=postgresql://vetify:vetify@localhost:5432/vetify_security_e2e \
  pnpm --filter @vetify/api test:e2e
```

The package command builds the API, then uses Node's test runner. CI runs this command against
its dedicated migrated PostgreSQL service after normal verification. The old Vitest E2E
configuration is not used by this command. Build the shared types and generate Prisma first
when starting from a fresh checkout, as the normal repository setup/CI does.

### Known gaps are explicit, not security passes

Two desired-security assertions currently execute as TODOs:

- Identical write requests with the same idempotency key should return the original result.
- Admin password login should require a second factor before issuing a full session.

The request/database probes run in ordinary failing tests; only these two narrow desired
guarantees are marked TODO. Unexpected HTTP statuses, database errors, authorization failures,
and other regressions fail the normal suite. TODOs still execute and show the known failures;
they are not skipped probes and are not counted as passing protections.

To make those known gaps fail the command too:

```sh
SECURITY_E2E_STRICT=1 \
SECURITY_TEST_DATABASE_URL=postgresql://vetify:vetify@localhost:5432/vetify_security_e2e \
  pnpm --filter @vetify/api test:e2e
```

Strict mode is expected to exit nonzero until idempotency and MFA are implemented. Remove the
TODO designations and adjust their contract assertions as those roadmap phases are completed.
Do not treat the default runner's successful exit as proof these missing features exist.

### Coverage and limits

The suite tests token tampering, invalid algorithms/claims, CSRF, cross-owner access, role
escalation, mass assignment, clinic verification/consent/code races, permission revocation,
cross-pet references, bounded inputs/queries, denied-access logging, refresh replay/concurrency,
logout, and per-account rate limiting. It also characterizes active bearer-token reuse and
the current clinic-unverification policy.

These are API E2E tests. They do not prove browser/PWA installation, XSS resistance, network
interception resistance, deployed TLS, proxy behavior, distributed rate limits, or resilience
under sustained load. No public/production target or external attack service is contacted.

## Existing unit and database integration suite

`pnpm --filter @vetify/api test` runs Vitest unit/HTTP tests and the opt-in PostgreSQL security
suite. Set SECURITY_TEST_DATABASE_URL to a migrated local test database to include its seven
integration-suite tests. Without that variable those seven tests are skipped. This is separate
from the full application E2E command above.
