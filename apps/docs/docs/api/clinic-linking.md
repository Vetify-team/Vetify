---
sidebar_position: 5
title: Clinic linking
---

# Clinic linking

Anyone can sign up as a clinic, with any name. Linking makes that harmless: an owner can only
share a record with a clinic that is **verified** and that shows them a **code in person**.

## 1. An admin verifies the clinic

New clinics start with `verified: false`. An admin reviews them outside the app (legal id,
professional registry) and records the result:

| Endpoint                                 | What it does                                                         |
| ---------------------------------------- | -------------------------------------------------------------------- |
| `GET /admin/clinics?verified=false`      | Clinics waiting for review.                                          |
| `POST /admin/clinics/:clinicId/verify`   | Allows the clinic to issue link codes.                               |
| `POST /admin/clinics/:clinicId/unverify` | Stops new codes; existing permissions stay until owners revoke them. |

## 2. The clinic issues a code

```bash
curl -X POST http://localhost:3001/api/v1/clinics/mine/link-codes -H "Authorization: Bearer <clinic token>"
```

```json
{ "code": "BY5N-NPXC", "expiresAt": "2026-10-20T19:32:10.000Z" }
```

- 8 characters from an alphabet without look-alikes (no `0/O`, `1/I/L`), shown as `XXXX-XXXX`.
- **Single use** and valid for **10 minutes**.
- Only an HMAC of the code is stored (keyed with `LINK_CODE_SECRET`): a database leak does not
  reveal live codes.
- An unverified clinic gets `403 CLINIC_NOT_VERIFIED`.

## 3. The owner checks and grants

The owner types the code (case, spaces and dashes do not matter) and first sees which clinic it
belongs to:

```bash
curl -X POST http://localhost:3001/api/v1/link-codes/preview \
  -H "Authorization: Bearer <owner token>" -H "Content-Type: application/json" \
  -d '{ "code": "by5n npxc" }'
```

Then confirms:

```bash
curl -X POST http://localhost:3001/api/v1/pets/<petId>/permissions \
  -H "Authorization: Bearer <owner token>" -H "Content-Type: application/json" \
  -d '{ "code": "BY5N-NPXC", "scope": "full" }'
```

The code is consumed in the same transaction that creates the permission: two owners racing
with the same code cannot both succeed. An invalid, expired or used code answers
`400 LINK_CODE_INVALID`.

Guessing a code is not practical: about 8.5 × 10¹¹ combinations, alive for 10 minutes, behind a
limit of 10 attempts per minute.
