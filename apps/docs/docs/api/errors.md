---
sidebar_position: 8
title: Errors
---

# Errors

Every error is `{ "code": "...", "message": "...", "errors": [{ "field", "message" }] }`
(`apiErrorSchema` in `@vetify/types`). `code` is stable and is what clients translate; `message`
is an English description for developers; `errors` appears only on `VALIDATION_FAILED`.

Codes: `VALIDATION_FAILED`, `BAD_REQUEST`, `UNAUTHENTICATED`, `INVALID_CREDENTIALS`,
`SESSION_EXPIRED`, `FORBIDDEN`, `INVALID_ORIGIN`, `CLINIC_NOT_VERIFIED`, `NOT_FOUND`,
`EMAIL_TAKEN`, `LINK_CODE_INVALID`, `API_VERSION_UNSUPPORTED`, `PAYLOAD_TOO_LARGE`,
`RATE_LIMITED`, `BILLING_UNAVAILABLE`, `RESET_TOKEN_INVALID`, `UPLOADS_UNAVAILABLE`,
`ASSISTANT_UNAVAILABLE`, `INTERNAL_ERROR`. A `500` never includes stack traces or database errors.

Some errors add a stable `reason` that clients word on their own: business rules of a
`BAD_REQUEST` (for example `PLAN_LIMIT`), and the [assistant](./assistant.md)'s
`ASSISTANT_DISABLED`, `ASSISTANT_UNAVAILABLE` (both `503`) and `ASSISTANT_LIMIT` (`429`).
