# Security implementation roadmap

Date: October 20, 2026.

**Status: implementation approved by the user; phased work is underway.** The idempotency
phase is implemented locally on `codex/write-idempotency`. Production transport verification
and later phases remain pending. No production hostname has been selected for passkeys;
a stable hosting hostname can be used without buying a custom domain.

This roadmap extends the controls described in [SECURITY_HANDOFF.md](SECURITY_HANDOFF.md).
Pre-implementation adversarial API tests are recorded in
[SECURITY_E2E_REPORT.md](SECURITY_E2E_REPORT.md); idempotency and MFA gaps were reproduced.
Previously completed fixes and their verification are recorded in
[SECURITY_MITIGATION.md](SECURITY_MITIGATION.md). The phase-2 implementation is described in [IDEMPOTENCY.md](IDEMPOTENCY.md). Other work below
remains planned and is not verified merely because it appears in this document.

## Goal and sequence

Reduce interception, impersonation, stolen-session abuse, duplicate writes, and resource
exhaustion for Vetify's API and browser PWA. Complete and verify one phase before proceeding
to the next. Preserve existing work and distinguish local test evidence from production checks.

| Phase | Scope                                      | Deliverable                                                    |
| ----- | ------------------------------------------ | -------------------------------------------------------------- |
| 1     | Transport and deployment verification      | Evidence-backed checklist and configuration changes needed.    |
| 2     | Write idempotency                          | Safe retries for pet creation and record writes.               |
| 3     | MFA                                        | Passkey enrollment, authentication, recovery, and enforcement. |
| 4     | Session controls                           | Session management and recent-authentication requirements.     |
| 5     | Abuse protection and detection             | Shared rate limits, quotas, security events, and alerts.       |
| 6     | Final verification and rollout preparation | Tests, documentation, migrations, and rollback instructions.   |

## Phase 1: verify transport and deployment security

Inspect actual hosting settings and deployed behavior:

- Browser-to-web HTTPS, valid certificates, and HTTP-to-HTTPS redirects.
- Web-to-API HTTPS through the server-side API_ORIGIN setting, including certificate validation.
- PostgreSQL transport encryption and certificate verification.
- Production HSTS and Secure, HttpOnly, SameSite cookie behavior.
- Trusted proxy configuration and handling of forged forwarding headers on every ingress
  path, including direct API access and requests through the web proxy.
- Secret handling and production API documentation exposure.

**Deliverable:** record what was verified, what configuration must change, and what could not
be verified. Hosting access may be required. Do not infer deployed TLS security from source
headers or from a successful local HTTP test. Keep secret values out of the evidence.

## Phase 2: implement write idempotency

Start with pet creation and all clinical/day-to-day record writes. Audit permission-grant and
link-code retries separately so single-use semantics remain correct.

- Generate an Idempotency-Key in the web client for each intended operation and preserve it
  across retries of that operation.
- Scope keys to the authenticated user, operation, and resource.
- Fingerprint the validated request deterministically. Keep server-generated timestamps and
  other execution-time defaults from making identical retries appear different.
- Commit the business write and its idempotency result in one database transaction, with a
  uniqueness/concurrency mechanism that prevents competing requests from creating duplicates.
- Return the original successful result for the same key and payload. Reject reuse with a
  different payload with a documented conflict response.
- Recheck authentication and resource authorization before replaying a result.
- Bound key length, storage, response contents, and retention. Proposed initial retry window:
  **24 hours** (implemented). Document that expired keys no longer guarantee deduplication.
- Exclude authentication tokens and cookies from persisted retry results. Protect any stored
  clinical response data according to the application's data-access and retention rules.
- Define retry behavior for transient failures, rolled-back transactions, and in-flight requests.
  Do not enable unrestricted automatic offline POST replay as part of this change.

**Acceptance tests:** simultaneous duplicate requests, committed writes with lost responses,
changed payloads, user/resource isolation, revoked permissions, transaction failures, and
expired keys. Verify one business operation and one replayable result are committed together.

## Phase 3: add MFA

**Proposed approach:** passkeys with required user verification, mandatory for admins and
clinics, optional initially for owners. This factor/enforcement policy is a proposal, not an
existing feature or a finalized product decision.

- Implement secure passkey enrollment, authentication, listing, and removal using a maintained
  WebAuthn verification library.
- Use expiring, single-use challenges bound to the intended account and ceremony.
- Verify the expected origin, relying-party ID, challenge, credential, signature, and user
  verification on the server. Require user verification, not just user presence.
- Gate fully authenticated session issuance on completion of the required factors. Prevent
  alternate login, refresh, or recovery paths from bypassing enforcement.
- Implement single-use recovery codes, store only their hashes, and define secure recovery
  procedures and enrollment/removal notifications.
- Require recent authentication before changing authentication methods or recovery settings.
- Define a transition for existing admin/clinic accounts before making enforcement mandatory.

**Decisions needed before implementation:** production domains and relying-party ID, recovery
policy, existing-account enrollment transition, and whether a fallback factor will be supported.
Any fallback must be assessed as part of the account's effective security.

**Acceptance tests:** challenge replay/expiration, wrong origin or relying party, missing user
verification, credential/account mismatch, recovery-code reuse, concurrent recovery attempts,
and bypass attempts through other authentication endpoints.

## Phase 4: strengthen session controls

- Let users list active sessions with useful, privacy-conscious device/activity information.
- Support revoking an individual session and logging out everywhere.
- Track authentication assurance and the time of the most recent successful authentication.
  Refreshing a token must not reset the recent-authentication window.
- Require recent authentication for permission grants, clinic verification, MFA changes,
  recovery operations, and other explicitly designated sensitive actions.
- Coordinate refresh across browser tabs to reduce accidental replay detection. Preserve
  server-side replay defenses and avoid persistent browser storage of bearer tokens.

**Acceptance tests:** revoked sessions fail immediately, users cannot inspect/revoke another
user's sessions, stale authentication cannot authorize sensitive actions, refresh does not
manufacture fresh authentication, and simultaneous browser tabs behave correctly.

## Phase 5: improve abuse protection and detection

- Move rate-limit counters to shared storage before enabling multiple API instances. Define
  store-outage behavior and verify limits on every ingress path.
- Add account/resource quotas and bounded request execution. Define limits from expected
  clinical usage and provide clear handling when a limit is reached.
- Record relevant authentication, MFA, session, permission, and administrative security events
  without passwords, tokens, recovery codes, or clinical narrative text.
- Define actionable alerts for repeated denials, refresh replay, unusual authentication
  patterns, and suspicious administrative activity, with recipients and response procedures.

**Acceptance tests:** limits hold across instances, forwarded headers do not choose attacker-
controlled rate-limit buckets, storage failures behave as designed, quotas resist concurrent
writes, and logging/alerts do not expose secrets or medical content.

## Phase 6: verify and prepare rollout

- Expand the authorization matrix across owners, unrelated owners, authorized/unauthorized
  clinics, and admins for new endpoints and replay paths.
- Run unit, HTTP, PostgreSQL transaction/concurrency, browser, and iOS/PWA checks. Use a
  disposable database for integration tests, not the application database.
- Run lint, typechecks, dependency audits, and production builds. Record exact commands,
  outcomes, skipped tests, and environment-related failures rather than declaring a blanket pass.
- Test migrations from the existing schema and document their locking/storage impact.
- Prepare environment-variable instructions, rollout sequencing, MFA enrollment transition,
  monitoring, and rollback/recovery procedures. Do not allow rollback to bypass MFA or revive
  revoked credentials/sessions.
- Update SECURITY_HANDOFF.md, API/OpenAPI documentation, and the mitigation tracker with
  implemented controls, verification evidence, and residual risks.

**Deliverable:** a reviewable implementation with test evidence and a concrete rollout plan.
Deployment and live-environment changes remain separate from preparing the implementation.

## Outside the initial scope

- Custom application-layer payload encryption or a new cryptographic protocol.
- Shared request-signing secrets embedded in browser code.
- DPoP or other sender-constrained access-token mechanisms.
- A backend-for-frontend migration that moves API tokens entirely server-side.

DPoP and server-side token storage can be evaluated separately after the identified gaps are
closed. Neither replaces TLS, authorization, safe account recovery, or XSS prevention.

## Reference guidance

- [OWASP REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- [OWASP Passkey Security](https://cheatsheetseries.owasp.org/cheatsheets/Passkey_Security_Cheat_Sheet.html)
- [OWASP MFA](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)
- [RFC 9449: DPoP](https://www.rfc-editor.org/info/rfc9449/)
