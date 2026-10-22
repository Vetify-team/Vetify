/**
 * Computes the PR score in CI, publishes it (job summary and one PR comment
 * that is updated in place) and exits non-zero below the threshold, so the
 * required "PR score" check blocks the merge.
 *
 * Inputs (environment): BASE_SHA, HEAD_SHA, PR_NUMBER, SONAR_PROJECT_KEY,
 * GITHUB_REPOSITORY, GITHUB_TOKEN; optional SONAR_WAIT_MINUTES (default 20).
 * Coverage comes from the LCOV reports under apps/* and packages/*.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import {
  COMMENT_MARKER,
  changedLineCoverage,
  changedLines,
  computeScore,
  parseLcov,
  renderReport,
} from "./score.mjs";

const env = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const SONAR = "https://sonarcloud.io/api";
const METRICS = [
  "new_security_rating",
  "new_reliability_rating",
  "new_maintainability_rating",
  "new_duplicated_lines_density",
  "new_security_hotspots_reviewed",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json();
}

/** Waits until SonarQube Cloud has analysed this exact commit of the PR. */
async function waitForSonar(project, pr, sha, minutes) {
  const deadline = Date.now() + minutes * 60_000;
  for (;;) {
    const { pullRequests } = await getJson(
      `${SONAR}/project_pull_requests/list?project=${encodeURIComponent(project)}`,
    );
    const analysed = pullRequests.find((p) => p.key === pr);
    if (analysed?.commit?.sha === sha) return;
    if (Date.now() > deadline) {
      throw new Error(
        `SonarQube Cloud did not analyse ${sha.slice(0, 7)} within ${minutes} minutes`,
      );
    }
    await sleep(20_000);
  }
}

async function sonarMeasures(project, pr) {
  const { component } = await getJson(
    `${SONAR}/measures/component?component=${encodeURIComponent(project)}` +
      `&pullRequest=${pr}&metricKeys=${METRICS.join(",")}`,
  );
  const measures = {};
  for (const m of component.measures) {
    const value = m.periods?.[0]?.value ?? m.period?.value ?? m.value;
    if (value !== undefined) measures[m.metric] = value;
  }
  return measures;
}

function coverageReports() {
  const coverage = new Map();
  for (const group of ["apps", "packages"]) {
    if (!existsSync(group)) continue;
    for (const name of readdirSync(group)) {
      const root = `${group}/${name}`;
      const report = `${root}/coverage/lcov.info`;
      if (!existsSync(report)) continue;
      for (const [file, hits] of parseLcov(readFileSync(report, "utf8"), root)) {
        coverage.set(file, hits);
      }
    }
  }
  return coverage;
}

/** Creates the score comment, or updates the one this job left before. */
async function publishComment(body) {
  const repo = env("GITHUB_REPOSITORY");
  const pr = env("PR_NUMBER");
  const headers = {
    Authorization: `Bearer ${env("GITHUB_TOKEN")}`,
    Accept: "application/vnd.github+json",
  };
  const comments = await getJson(
    `https://api.github.com/repos/${repo}/issues/${pr}/comments?per_page=100`,
    { headers },
  );
  const previous = comments.find((c) => c.body?.startsWith(COMMENT_MARKER));
  const url = previous
    ? `https://api.github.com/repos/${repo}/issues/comments/${previous.id}`
    : `https://api.github.com/repos/${repo}/issues/${pr}/comments`;
  await getJson(url, {
    method: previous ? "PATCH" : "POST",
    headers,
    body: JSON.stringify({ body }),
  });
}

const project = env("SONAR_PROJECT_KEY");
const pr = env("PR_NUMBER");
const head = env("HEAD_SHA");

// git is resolved from fixed system directories, never from an inherited PATH.
const diff = execFileSync(
  "git",
  ["diff", "--unified=0", "--no-color", `${env("BASE_SHA")}...${head}`],
  {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, PATH: "/usr/bin:/bin" },
  },
);
const coverage = changedLineCoverage(changedLines(diff), coverageReports());

await waitForSonar(project, pr, head, Number(process.env.SONAR_WAIT_MINUTES ?? 20));
const result = computeScore(await sonarMeasures(project, pr), coverage);
const report = renderReport(result);

console.log(report);
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
try {
  await publishComment(report);
} catch (error) {
  // The check still decides the merge; a missing comment is only a warning.
  console.log(`::warning::Could not publish the PR score comment: ${error.message}`);
}

if (!result.passed) {
  console.log(`::error::PR score ${result.score} is below the minimum.`);
  process.exit(1);
}
