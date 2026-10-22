# Snyk and SonarQube Cloud

CI keeps `pnpm audit --prod` as a credential-free dependency check and runs
separate Snyk dependency, code and API runtime-container jobs; findings at
medium severity or above fail Snyk. SonarQube Cloud uses **Automatic Analysis**
(the GitHub app): it reports the "SonarCloud Code Analysis" check and its
quality gate on every PR, configured by `.sonarcloud.properties` (exclusions
only). CI does not run a Sonar scanner, because Sonar rejects CI analysis while
Automatic Analysis is enabled; as a consequence Sonar shows no coverage.

## Activate in GitHub

1. Import this repository as a single project in SonarQube Cloud with
   Automatic Analysis on. Set the project's quality gate and new-code
   definition in Sonar. (`SONAR_TOKEN` and the `SONAR_*` variables are unused
   while CI does not scan.)
2. Create/select the Snyk organization and enable Snyk Code there. Add repository
   Actions secret `SNYK_TOKEN` for an account/service account in that organization,
   then set Actions variable `SNYK_ENABLED` to `true`. The token's default
   organization is used. Ensure its plan supports Code and Container scans.
3. Push to `main`/`dev` or open an internal PR and inspect the scanner results.
   Branch/PR analysis availability depends on the Sonar plan. Configure branch
   protection to require the scanner checks after a successful first run.

Tokens belong only in GitHub secrets. The enable variables deliberately skip
unconfigured scanners; enabling a scanner with missing/invalid credentials fails
its run. Fork PRs skip credentialed scanning and still run ordinary verification
and pnpm audit. Do not switch to `pull_request_target` to expose secrets.
Treat internal PR authors as trusted to execute CI with repository secrets.

The CLI and action revisions are pinned in `.github/workflows/ci.yml`; update them
periodically. Snyk scans all workspace dependencies (including development tools),
and builds the final Docker image locally without pushing it. No Snyk monitor
snapshot or SARIF upload is configured. Scanners transmit source/dependency
metadata to their respective services once enabled.

## Local coverage

After installing dependencies, generating Prisma, and building shared types:

```sh
pnpm --filter @vetify/api test:cov
pnpm --filter @vetify/web test:cov
```

Reports are `apps/api/coverage/lcov.info` and `apps/web/coverage/lcov.info`
(local only; switching Sonar to CI analysis would let it import them).
API database tests require a disposable `SECURITY_TEST_DATABASE_URL`; without it,
those tests skip. CI supplies that database. Coverage includes untested source,
so initial percentages may be low; shared types have no independent test suite.

Configuration alone does not prove any cloud scan passed. Activation, remote
quality gate results, and branch protection must be verified in GitHub/services.

References: [Snyk test CLI](https://docs.snyk.io/developer-tools/snyk-cli/commands/test),
[Snyk setup action](https://github.com/snyk/actions/tree/master/setup).

## Protected branch flow

Work branches open PRs into `dev`; promotion to `main` must use the repository's
`dev` branch. `.github/workflows/branch-policy.yml` validates this path without
checking out PR code or receiving secrets. Keep its required check name stable.
CI runs for PRs targeting either branch and pushes after merging into either.
Git pull/fetch remains allowed; the rules protect writes, not downloads.

On October 21, 2026, the GitHub ruleset `Protected main and dev - PR and CI required`
was activated for `Vetify-team/Vetify`: no bypass actors, no branch deletion or
force pushes, PRs with one approval (including approval of the most recent push),
resolved conversations, and up-to-date `Branch policy` and
`Lint, typecheck, test and build` checks from GitHub Actions. Admins are subject to
the rules while active; repository admins can still edit rulesets.

The bootstrap PR is https://github.com/Vetify-team/Vetify/pull/4, targeting dev.
Its workflow changes must merge into dev and then be promoted to main. Existing
PRs missing the new check need the workflow included before they can merge.
As with other repository-owned CI, reviewers must inspect workflow modifications:
a contributor able to change the policy workflow can alter its behavior if that
change is approved. These are not centrally immutable organization workflows.

The bootstrap PR contains branch policy, CI trigger/check-name changes, and the
deployment event/commit safeguard only. Snyk/Sonar and application changes remain
local pending their own reviewed rollout. Snyk checks are not yet required by
the ruleset because Snyk service setup is not complete.

## Snyk activation and live verification

The repository secret `SNYK_TOKEN` was confirmed present by name only, and
`SNYK_ENABLED=true` was configured in `Vetify-team/Vetify`. The existing protected
branch PR now includes the three Snyk jobs as well as the branch policy and
post-merge deployment safeguards. No secret value was read or copied locally.

The setup action requires a version including its `v` prefix:
`snyk-version: v1.1308.2`. The first live attempt without that prefix failed to
download the CLI (HTTP 403); the corrected release URL was verified and the
jobs rerun. The jobs each have a 20-minute timeout. Medium-or-higher findings
remain failures; do not change thresholds or suppress findings just to turn CI
green. The scan targets the published PR snapshot, not unrelated local changes.

### Completed live Snyk checks

Verified in [GitHub CI run](https://github.com/Vetify-team/Vetify/actions/runs/39723116009)
on PR commit `3d2b7df`:

- CLI installation and authentication succeeded using the default Snyk organization
  `aleleonmarin`. Snyk Code was enabled there and confirmed enabled after reload.
- Code: scan completed successfully, with zero reported issues at the configured
  medium-or-higher threshold (not a claim of no low-severity or ignored findings).
- Dependencies: scanned five projects; four contained vulnerable paths. The output
  contained 45 distinct Snyk advisory IDs: API 9 issues, web 39, config 4, types 1
  (counts overlap across projects). The root project had no reported vulnerable
  paths. A scanner finding is not by itself evidence of exploitability.
- Container: image build and scan completed. The OS package scan reported no
  findings at the threshold, but bundled npm and pnpm dependency graphs each
  reported 24 issues. Application-package discovery in the image is not complete
  pnpm-workspace coverage; the separate dependency job scans the workspace.
- Existing lint/typecheck/tests/build and Branch policy passed. No merge or deploy.

The image build required deleting only the root `prepare` script inside the
runtime image before production dependency installation: Husky is a devDependency
and is unavailable there. Native dependency installation scripts remain enabled.
The same fix is applied locally in `apps/api/Dockerfile`, preserving its existing
non-root runtime configuration.

Dependency and container jobs intentionally fail on these findings. No advisory
was ignored and the threshold remains medium. A proposal to make all three Snyk
checks mandatory in the branch ruleset was rejected by automatic approval review
because it could block all merges and was beyond the clearly authorized policy
change. The existing ruleset was not modified; making Snyk checks required awaits
explicit user approval. Snyk job failure alone is not currently a required-merge
check, although it fails the overall CI workflow and prevents its success-based
deployment trigger.
