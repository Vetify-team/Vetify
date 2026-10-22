import assert from "node:assert/strict";
import { test } from "node:test";
import {
  changedLineCoverage,
  changedLines,
  checksState,
  computeScore,
  parseLcov,
  renderReport,
  renderWithheld,
} from "./score.mjs";

const DIFF = `diff --git a/apps/api/src/a.ts b/apps/api/src/a.ts
--- a/apps/api/src/a.ts
+++ b/apps/api/src/a.ts
@@ -3,0 +4,2 @@ export function a() {
+  const x = 1;
+  return x;
@@ -10 +12 @@
-  old();
+  next();
diff --git a/apps/api/src/gone.ts b/apps/api/src/gone.ts
--- a/apps/api/src/gone.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-gone
`;

test("changed lines come from the new side of each hunk", () => {
  const changed = changedLines(DIFF);
  assert.deepEqual([...changed.keys()], ["apps/api/src/a.ts"]);
  assert.deepEqual([...changed.get("apps/api/src/a.ts")], [4, 5, 12]);
});

test("LCOV paths become repository-relative, relative or absolute", () => {
  const lcov = `SF:src/a.ts\nDA:4,1\nDA:5,0\nend_of_record\nSF:/home/runner/work/V/V/apps/api/src/b.ts\nDA:1,2\nend_of_record\n`;
  const coverage = parseLcov(lcov, "apps/api");
  assert.deepEqual([...coverage.keys()], ["apps/api/src/a.ts", "apps/api/src/b.ts"]);
  assert.equal(coverage.get("apps/api/src/a.ts").get(5), 0);
});

test("only executable changed lines count toward coverage", () => {
  const coverage = parseLcov("SF:src/a.ts\nDA:4,3\nDA:5,0\nend_of_record\n", "apps/api");
  const result = changedLineCoverage(changedLines(DIFF), coverage);
  assert.deepEqual(result, { total: 2, covered: 1, percent: 50 });
  assert.equal(changedLineCoverage(new Map(), coverage).percent, null);
});

const PERFECT = {
  new_security_rating: "1.0",
  new_reliability_rating: "1.0",
  new_maintainability_rating: "1.0",
  new_duplicated_lines_density: "0.0",
  new_security_hotspots_reviewed: "100.0",
};

test("a clean PR with covered changes scores 100", () => {
  const { score, passed } = computeScore(PERFECT, { total: 10, covered: 9, percent: 90 });
  assert.equal(score, 100);
  assert.ok(passed);
});

test("the threshold is 80", () => {
  // Security B loses 10 points; 40 % coverage loses 10 more: 80 exactly.
  const at = computeScore(
    { ...PERFECT, new_security_rating: "2.0" },
    { total: 10, covered: 4, percent: 40 },
  );
  assert.equal(at.score, 80);
  assert.ok(at.passed);
  // Security C keeps 5 of its 25 points: 80, still enough.
  const securityC = computeScore(
    { ...PERFECT, new_security_rating: "3.0" },
    { total: 10, covered: 8, percent: 80 },
  );
  assert.equal(securityC.score, 80);
  // Reliability E and untested changes lose 40: blocked.
  const failing = computeScore(
    { ...PERFECT, new_reliability_rating: "5.0" },
    { total: 10, covered: 0, percent: 0 },
  );
  assert.equal(failing.score, 60);
  assert.ok(!failing.passed);
});

test("missing measures and no executable changes keep full points", () => {
  const { score, items } = computeScore({}, { total: 0, covered: 0, percent: null });
  assert.equal(score, 100);
  assert.match(items[3].detail, /no cambia líneas ejecutables/);
});

test("duplication scales between 3 % and 10 %", () => {
  const half = computeScore(
    { ...PERFECT, new_duplicated_lines_density: "6.5" },
    { total: 0, covered: 0, percent: null },
  );
  assert.equal(half.items[4].points, 5);
});

test("the report carries the marker used to update the comment", () => {
  const report = renderReport(
    computeScore(PERFECT, { total: 0, covered: 0, percent: null }),
  );
  assert.ok(report.startsWith("<!-- vetify-pr-score -->"));
  assert.match(report, /PR score: 100 \/ 100/);
});

test("the score waits for every other required check", () => {
  const required = ["CI", "Snyk (code)", "SonarCloud Code Analysis", "security/snyk"];
  const runs = [
    { id: 1, name: "CI", status: "completed", conclusion: "failure" },
    { id: 2, name: "CI", status: "completed", conclusion: "success" },
    { id: 3, name: "Snyk (code)", status: "completed", conclusion: "skipped" },
    { id: 4, name: "SonarCloud Code Analysis", status: "in_progress", conclusion: null },
  ];
  const statuses = [{ id: 9, context: "security/snyk", state: "success" }];
  assert.deepEqual(checksState(required, runs, statuses), {
    pending: ["SonarCloud Code Analysis"],
    failed: [],
  });
  assert.deepEqual(checksState(["Missing"], runs, statuses).pending, ["Missing"]);
});

test("a failed check withholds the score", () => {
  const runs = [{ id: 1, name: "CI", status: "completed", conclusion: "failure" }];
  const statuses = [
    { id: 1, context: "security/snyk", state: "success" },
    { id: 2, context: "security/snyk", state: "failure" },
  ];
  const state = checksState(["CI", "security/snyk"], runs, statuses);
  assert.deepEqual(state.failed, ["CI (failure)", "security/snyk (failure)"]);
  const report = renderWithheld(state.failed);
  assert.ok(report.startsWith("<!-- vetify-pr-score -->"));
  assert.match(report, /sin nota/);
});
