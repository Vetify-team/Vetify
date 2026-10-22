# PR score

Every pull request into `dev` or `main` gets a score from 0 to 100. The
**PR score** check fails below **80**, and the branch rules require it, so a PR
needs both a passing score and a human approval to merge.

The workflow is `.github/workflows/pr-score.yml`; the calculation is
`scripts/pr-score/score.mjs` (tested by `score.test.mjs`). The result is posted
as one PR comment, updated on every push, and in the job summary.

## When the score is given

Only after every other required check passes on the same commit: Branch policy;
Lint, typecheck, test and build; the three Snyk jobs; SonarCloud Code Analysis;
and `security/snyk`. The job waits for them (up to 45 minutes). If one fails, or
does not finish in time, the score is withheld: the comment lists what failed
and **PR score** fails as well. Each push to the PR runs everything again on
the new commit. The list lives in `REQUIRED_CHECKS` in the workflow and must
match the ruleset's required checks.

## Formula

| Criterion                     | Points | Source                                                                                         |
| ----------------------------- | -----: | ---------------------------------------------------------------------------------------------- |
| Security of new code          |     25 | SonarQube Cloud rating: A all, B 60 %, C 20 %, D/E none                                        |
| Reliability (bugs)            |     20 | SonarQube Cloud rating, same scale                                                             |
| Maintainability               |     15 | SonarQube Cloud rating, same scale                                                             |
| Coverage of the changed lines |     20 | Vitest coverage of the lines the PR adds or modifies: all points from 80 %, proportional below |
| Duplication on new code       |     10 | SonarQube Cloud: all points up to 3 %, none from 10 %, linear between                          |
| Security hotspots reviewed    |     10 | SonarQube Cloud: proportional to the share reviewed                                            |

Building, tests and Snyk are separate required checks; they do not add points.

## Details

- **Coverage** counts only changed lines that are executable and inside a
  coverage report: packages with `vitest` and `@vitest/coverage-v8` (covering
  `src/**`). A PR that changes no such line (docs, configuration) gets the 20
  points. Changes in packages without tests are not measured.
- **SonarQube Cloud** uses Automatic Analysis. The job waits up to 20 minutes for
  the analysis of the PR's exact head commit, and fails if it does not arrive,
  rather than scoring without data. A measure Sonar does not report (no new
  code of that kind) keeps its points.
- The threshold and weights live in `score.mjs`; change them there and in this
  table together.
- The check runs from the PR's own branch: a branch created before this
  workflow existed must merge `dev` to get it.
