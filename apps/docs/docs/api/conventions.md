---
sidebar_position: 1
title: Conventions
---

# API conventions

- **Base:** `http://localhost:3001/api/v1` in development; see [Versioning](./versioning.md).
- **Format:** JSON in requests and responses; bodies up to 100 KB.
- **Language:** routes, fields and error messages in English. Clients translate error `code`s.
- **Identifiers:** UUIDs.
- **Dates without time** (birth, application, expiry): `YYYY-MM-DD`. "Today" for the API is
  the day in Costa Rica, not in UTC.
- **Timestamps** (consultation, access): ISO 8601 with offset.
- **Authentication:** `Authorization: Bearer <accessToken>` everywhere except register, log-in,
  refresh and log-out. See [Authentication](./authentication.md).
- **Caching:** every response carries `Cache-Control: no-store`. Health data must not be stored
  by browsers, proxies or service workers.
- **Errors:** always `{ "code": "...", "message": "...", "errors": [...] }`. See [Errors](./errors.md).

## Rate limits

| Endpoints                       | Per IP (default) | Variable                       | Per account  |
| ------------------------------- | ---------------- | ------------------------------ | ------------ |
| `POST /auth/register`           | 10 per minute    | `RATE_LIMIT_REGISTER`          | 5 per minute |
| `POST /auth/login`              | 10 per minute    | `RATE_LIMIT_LOGIN`             | 5 per minute |
| `POST /auth/refresh`            | 30 per minute    | `RATE_LIMIT_REFRESH`           | —            |
| `POST /clinics/mine/link-codes` | 10 per minute    | `RATE_LIMIT_LINK_CODE_CREATE`  | —            |
| `POST /link-codes/preview`      | 10 per minute    | `RATE_LIMIT_LINK_CODE_PREVIEW` | —            |
| `POST /pets/:petId/permissions` | 10 per minute    | `RATE_LIMIT_PERMISSION_GRANT`  | —            |
| Everything else                 | 120 per minute   | `RATE_LIMIT_GENERAL`           | —            |

Each limit counts per route. The per-IP limits can be raised with the variables above (whole
numbers from 1 to 100,000); unset, they keep the defaults. The per-account limits are fixed.
Behind Vercel with `TRUST_PROXY_HOPS=0` every user reaches the API from the same address and
shares each per-IP counter; see "Shared per-IP counters behind Vercel" in
`docs/SECURITY_HANDOFF.md`.

Over the limit the API answers `429 RATE_LIMITED`. Use `TRUST_PROXY_HOPS=1` only after verifying
a single ingress boundary sanitizes forwarding headers. For several proxies, use their actual
`TRUST_PROXY_CIDRS`; do not blindly count Vercel and Render as two trusted hops. See
[Security](../security.md#reverse-proxies).

## Validation

Input is validated with the `@vetify/types` Zod schemas, the same ones the web uses:

- Unknown fields are dropped, so a client cannot set fields it does not own.
- Free text is trimmed and cannot contain control characters.
- Links must be `https` with a real domain (no `javascript:`, `data:` or IP addresses).
- Past dates (birth, application) cannot be in the future or before 1990; scheduled dates
  (expiry, next dose) cannot be more than 10 years ahead.
- A `PATCH` only changes the fields it sends.
