# Adversarial API end-to-end test report

Date: October 20, 2026. Branch: `feat/english-api-v1-security`.

This is the historical pre-implementation report. The subsequent idempotency phase resolves
that gap: the expanded suite now has 58 passes and one MFA TODO. See
[IDEMPOTENCY.md](IDEMPOTENCY.md) for the current contract and verification. The findings and
counts below describe the earlier snapshot.

## Scope and result

The test runner started the compiled production Nest AppModule on ephemeral loopback ports
against a fresh, migrated PostgreSQL 16 database named `vetify_security_e2e_20261020`.
Authentication, authorization, validation, rate limiting, services, transactions, filters, and
access logging were real implementations, not mocks. Test-only users/clinics/admins were
provisioned in that isolated database, and login/business operations were exercised over HTTP.

**Default result: 54 runner tests, 52 passed, 2 TODO, no unexpected failures or skipped tests.**
The count includes one enclosing test; there are 53 child scenarios. TODO assertions executed
and failed on two known missing guarantees. They are not passing security controls.

The existing Vitest API suite also passed all 64 tests, including its PostgreSQL integration
cases. API lint, typecheck, and the API build passed. This work added test infrastructure and
documentation; the proposed security roadmap has not been implemented.

## Reproduced gaps and limitations

| Finding                      | Evidence                                                                                                                                                                  | Interpretation                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing write idempotency    | Two concurrent POSTs to a pet's weights endpoint with identical payload and Idempotency-Key both returned 201 and different record IDs. The database contained both rows. | A lost-response retry can duplicate a successful write. This confirms the roadmap's idempotency gap.                                            |
| Missing MFA                  | Admin email/password login returned a full administrative access token without a second-factor challenge.                                                                 | Password compromise is sufficient for privileged authentication. This is an absent defense, not a demonstrated bypass of password verification. |
| Bearer-token reuse           | A second HTTP client using the same still-active access token successfully called auth/me.                                                                                | Expected bearer-token behavior. No theft/interception was attempted or demonstrated. Sender-constrained credentials are not present.            |
| Clinic unverification policy | After admin unverification, the clinic could not issue new link codes but could still read a previously shared record.                                                    | Existing consent remains valid by current policy. This is not a newly discovered authorization bypass.                                          |

The ordinary request/database probes for the two missing guarantees are regular tests and
fail on unexpected responses or database errors. Only the narrow desired-security assertions
are marked TODO. `SECURITY_E2E_STRICT=1` removes that allowance so the command fails until the
missing guarantees are implemented. CI runs the default mode with visible TODO reporting.

Strict mode was also executed and exited 1 as expected: the two missing guarantees failed,
and their enclosing test consequently failed (51 other tests passed; no TODOs). The database
safety guard was separately checked with a non-test database name and rejected it before
application startup or a database connection.

## Attack scenarios blocked in this run

- Missing/malformed tokens, changed user/role claims with the old signature, alg=none,
  refresh tokens presented as access tokens, expired tokens, wrong issuer/audience, and a
  validly signed test token with a mismatched user/session. Test-only signing secrets were
  used to probe verifier boundaries; no real signing secret was obtained or attacked.
- Hostile-origin JSON login, form login, opaque Origin, cross-site Fetch Metadata without
  Origin, and CSRF against refresh/logout. Rejected requests did not replace the session.
- Admin self-registration, cross-owner profile/history/status/permission/access-log reads,
  foreign-owner edits/day-to-day writes, ownership mass assignment, and role escalation.
- Unverified clinic code issuance, unshared clinic record access, cross-clinic identity
  substitution, code reuse/expiration, concurrent code consumption, escalation of card-only
  consent to full access, forged medical authorship, and cross-pet consultation references.
- Continued reads/writes after permission revocation and attempts to use permission IDs
  against a different pet.
- Unsafe URL schemes/raw metadata IP URLs, control characters, extreme future dates,
  SQL-like route identifiers, malformed/oversized JSON, and excessive pagination limits.
- Refresh-token replay and concurrent refresh reuse. The surviving access token was revoked
  after replay detection; logout also invalidated its access token immediately.
- Repeated credential attempts: five wrong-password attempts were followed by 429 on the
  sixth account attempt, even with the correct password. This was a bounded local probe,
  not a distributed password attack or load test.

The suite also verified real registration/login, clinic verification and sharing, scoped
history pagination, denied-access log events, and production cookie/security-header flags.
No cross-owner or role-based access bypass was found among these requests.

## What this does not establish

This is a scoped API attack/regression exercise, not a comprehensive penetration-test
certification. It did not attack production, external services, real accounts, or clinical
records. It did not verify browser execution/XSS resistance, installed iOS PWA behavior,
traffic interception, deployed TLS/database encryption, actual Render/Vercel proxy behavior,
multi-instance shared limits, or sustained resource exhaustion. Production cookie flags were
inspected over a test HTTP connection; that is not a TLS or browser cookie-storage test.

## Reproduce and maintain

- Runner: `apps/api/test/security.e2e.mjs`.
- Command: `pnpm --filter @vetify/api test:e2e`, with SECURITY_TEST_DATABASE_URL set explicitly.
- Database setup, safety checks, TODO interpretation, and strict mode:
  [API test README](../apps/api/test/README.md).
- CI runs the E2E command against its migrated disposable PostgreSQL service.
- Remove the TODO designations and finalize their contract assertions when the corresponding
  roadmap features are implemented. Preserve authorization checks on idempotent replay.

The runner deleted its fixture rows and closed both app instances. A separate check found
zero users, pets, and clinics remaining in the disposable database; that database was then
removed. No application database, hosting setting, commit, push, or deployment was changed by
this exercise.
