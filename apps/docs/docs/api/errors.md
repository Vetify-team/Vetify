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
`RATE_LIMITED`, `INTERNAL_ERROR`. A `500` never includes stack traces or database errors.
