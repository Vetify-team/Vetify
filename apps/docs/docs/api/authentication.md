---
sidebar_position: 3
title: Authentication
---

# Authentication

All session endpoints check browser `Origin` against `ALLOWED_ORIGINS`, including login and
registration. An explicit cross-site browser request without Origin is also rejected.
Login/register accept only `application/json`; form submissions return 415. CLI clients that
send JSON without browser headers remain supported.

Refresh rotation, replay revocation, logout and session creation are serialized using a
PostgreSQL lock on the user's row. Rotation and replacement creation commit atomically.
Replay revocation commits before returning 401. A logout using an already rotated cookie
revokes all sessions for that user so a concurrent successor cannot remain active.

Two tokens, kept in different places on purpose:

| Token         | Lives                              | Lasts      | For                                             |
| ------------- | ---------------------------------- | ---------- | ----------------------------------------------- |
| Access token  | Response body → client memory only | 15 minutes | `Authorization: Bearer` on every request        |
| Refresh token | `HttpOnly` cookie `vetify_refresh` | 30 days    | Getting a new access token from `/auth/refresh` |

The refresh cookie is `HttpOnly` (scripts cannot read it, so an XSS cannot steal the
session), `Secure` in production, `SameSite=Strict` and scoped to `/api`. The API stores
only a hash of it. Passwords are hashed with **argon2** and must have at least 12 characters.

## Register

```bash
curl -i -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{ "email": "ana@mail.cr", "name": "Ana Jiménez", "password": "a-long-passphrase" }'
```

A clinic creates its clinic and its first staff member in one step, with
`"role": "clinic"` and `"clinicName": "..."`. New clinics start **unverified** (see
[Clinic linking](./clinic-linking.md)). `admin` cannot be chosen.

The response is `201` with the session, plus the cookie:

```http
Set-Cookie: vetify_refresh=…; Path=/api; HttpOnly; SameSite=Strict
```

```json
{
  "accessToken": "eyJhbGciOi…",
  "accessTokenExpiresAt": "2026-10-20T19:15:00.000Z",
  "user": {
    "id": "…",
    "email": "ana@mail.cr",
    "name": "Ana Jiménez",
    "role": "owner",
    "phone": null,
    "createdAt": "…"
  }
}
```

## Log in

`POST /auth/login` with `{ "email", "password" }` returns the same session. Wrong credentials
answer `401 INVALID_CREDENTIALS` without saying whether the email exists, and an unknown email
takes as long as a wrong password.

## Keep the session

When a request answers `401`, the access token expired. Call `POST /auth/refresh`; the cookie
goes automatically and there is no body:

- It returns a **new** access token and **rotates** the cookie; the previous refresh token
  stops working.
- It must come from an allowed origin (`ALLOWED_ORIGINS`), or it answers `403 INVALID_ORIGIN`.

:::warning Replaying a refresh token closes every session
A refresh token that was already rotated means someone copied it. The API revokes **all** of the
user's sessions, and their access tokens stop working immediately.
:::

On page load the web app calls `refresh` to restore the session; that is why the access token
never needs to be stored.

## Log out

`POST /auth/logout` (cookie only) revokes the session and clears the cookie. Access tokens carry
their session id, and the API checks on every request that the session is still active: after
log-out they are rejected at once instead of when they expire.

## Current user

`GET /auth/me` returns the owner of the access token.

## Token hardening

Tokens are signed with HS256 only (any other algorithm, including `none`, is rejected), with an
issuer and separate audiences and secrets for access and refresh tokens.
