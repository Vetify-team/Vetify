---
sidebar_position: 4
title: Security
---

# Security

- Session: refresh token in an HttpOnly, SameSite=Strict cookie; access token in memory, tied to
  its session and revoked immediately on log-out or replay; Origin check on every session endpoint.
  Login/registration require JSON. Session mutation is serialized with a database row lock.
- Authorization in a single service; clinics need a verified account and an in-person link code.
- Headers: helmet + `no-store` before body parsing, including 400/413 errors; per-request nonce CSP, HSTS, `X-Frame-Options` and
  `Permissions-Policy` on the web. The browser only talks to its own origin.
- The service worker never caches API responses; caches are cleared on log-out.
- Input hardening: https-only links, bounded dates, no control characters, 100 KB bodies.
- Access log deduplicated against flooding, with authenticated 403/404 pet denials captured by
  the exception filter (including role-guard denials) without changing the public status.
- History pages are limited to 100 entries per section. Vaccination summaries query indexed
  latest doses rather than loading all historical rows.
- Docker runs as non-root; CI pins actions by SHA, uses least privilege and audits dependencies.

## Reverse proxies

`TRUST_PROXY_HOPS` accepts only 0 or 1. Before using 1, verify that the last ingress proxy
overwrites forwarding headers on every public path. Do not set a hop count of 2 merely because
the browser goes through Vercel and Render: the direct Render URL is a shorter ingress path.
For multiple trusted proxies use `TRUST_PROXY_CIDRS`, containing only their actual IP addresses
or networks. It takes precedence over the hop count; universal `/0` networks are rejected.
Where proxy ranges cannot be pinned, use one verified ingress boundary and conservative limits.

## Regression tests

CI creates a disposable PostgreSQL database, replays every migration, and runs HTTP security
tests and real database races. Local integration tests require `SECURITY_TEST_DATABASE_URL`
pointing to a migrated local database named `vetify_security_*`; they never fall back to the
app's `DATABASE_URL` and reject remote/non-test destinations. See the repository's
`docs/SECURITY_MITIGATION.md` for the rollout checklist and remaining operational risks.
