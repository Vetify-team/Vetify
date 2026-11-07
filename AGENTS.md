# Agent context

Before changing authentication, authorization, API writes, deployment, or PWA data handling,
read [docs/SECURITY_HANDOFF.md](docs/SECURITY_HANDOFF.md). It records implemented controls,
missing features, verification evidence, and deployment work that remains unverified.

- Preserve existing staged and unstaged work. Inspect Git status before editing; apparent
  deletions may accompany renamed/untracked replacements from the English API migration.
- Treat handoff test/build results as historical evidence. Check the source and rerun relevant
  checks before claiming something is implemented, tested, or deployed.
- Update the handoff when its controls, gaps, or rollout status change. Keep credentials,
  tokens, database dumps, and personal records out of documentation.
