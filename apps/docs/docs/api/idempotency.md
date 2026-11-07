---
title: Write idempotency
---

# Write idempotency

Pet creation and the seven clinical/day-to-day POST endpoints accept `Idempotency-Key`.
Use 16–128 letters, digits, underscores or hyphens (for example, a random UUID). Generate
one key per intended write and reuse it after a lost response. The web does this automatically.

Within 24 hours, the same authenticated user, operation, resource, key, and validated data
receive the original successful JSON response with status 201. A changed payload returns
`409 IDEMPOTENCY_CONFLICT`. Object field order and stripped unknown fields do not change the
fingerprint. Omitted execution-time defaults remain part of the original saved result.

Keys are isolated across users, operations and pets. The API checks the current session and
pet permissions before replay. Revoked access cannot retrieve an earlier result. Writes,
reminders, and the retry result commit together; a failed transaction can be retried safely.
Requests without a key retain normal POST semantics and may create duplicates.

The key expires after 24 hours; a later retry can create another record. The server retains
at most 1,000 unexpired results per user and 64 KiB per result, returning 429 when the result
budget is exhausted. Replaying an existing result still works at the budget limit.

The browser retries a keyed request once after a network failure or HTTP 502/503/504, and
keeps its key through token refresh. A still-mounted form retains uncertain intent keys for
manual retries of unchanged data. Keys are not persisted across page reloads or form unmounts.
Authentication, permission grants, and link-code endpoints are outside this contract and are
not automatically retried. There is no offline POST queue.

## Rollout and retention

Apply `20261021060000_write_idempotency` before deploying the API and web. It creates one
new table and an expiry index. Successful response snapshots contain clinical information;
protect them with the same database controls as the primary records. Tokens and cookies
are never stored in this table, and raw keys are hashed.

Expired results are ignored and incrementally removed during traffic. For physical deletion
during idle periods, schedule this command hourly in the intended environment:

```sh
pnpm --filter @vetify/api idempotency:prune
```

The command uses `DATABASE_URL`, deletes only expired retry results in bounded batches, and
removes at most 100,000 per invocation. Repeat if a backlog reaches that cap. The 24-hour
replay window is not a guarantee that an idle database physically removes rows at that exact
instant. Never restore a pre-idempotency API while clients still automatically retry writes.
