/**
 * The PR score: 100 points from SonarQube Cloud's ratings on new code and the
 * test coverage of the lines the PR changes. Pure functions only; index.mjs
 * collects the inputs and reports the result.
 */

export const THRESHOLD = 80;

/** SonarQube ratings are 1 (A) to 5 (E); each grade keeps this share of the points. */
const RATING_SHARE = { 1: 1, 2: 0.6, 3: 0.2, 4: 0, 5: 0 };
const GRADE = { 1: "A", 2: "B", 3: "C", 4: "D", 5: "E" };

/** Coverage of changed lines that earns all its points. */
export const COVERAGE_TARGET = 80;
/** Duplication on new code: full points up to the first value, none from the second. */
const DUPLICATION_RANGE = [3, 10];

/**
 * Added and modified line numbers per file, from `git diff --unified=0`.
 * Deleted files and removed lines carry no new code.
 */
export function changedLines(diff) {
  const files = new Map();
  let current = null;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) {
      const path = line.slice(4).trim();
      current = path === "/dev/null" ? null : path.replace(/^b\//, "");
      if (current && !files.has(current)) files.set(current, new Set());
      continue;
    }
    const hunk = /^@@ -\S+ \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk && current) {
      const start = Number(hunk[1]);
      const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
      for (let n = start; n < start + count; n++) files.get(current).add(n);
    }
  }
  return files;
}

/**
 * Executable lines and their hit counts per file, from an LCOV report.
 * `root` is the report's package directory relative to the repository, so
 * paths come out repository-relative like the diff's.
 */
export function parseLcov(text, root = "") {
  const files = new Map();
  let current = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("SF:")) {
      current = repoPath(line.slice(3).trim(), root);
      files.set(current, files.get(current) ?? new Map());
    } else if (line.startsWith("DA:") && current) {
      const [lineNo, hits] = line.slice(3).split(",");
      files.get(current).set(Number(lineNo), Number(hits));
    } else if (line === "end_of_record") {
      current = null;
    }
  }
  return files;
}

function repoPath(file, root) {
  const normalized = file.replaceAll("\\", "/");
  const prefix = root ? `${root.replace(/\/$/, "")}/` : "";
  // Reports may hold absolute paths: keep what follows the package directory.
  if (prefix && normalized.includes(`/${prefix}`)) {
    return (
      prefix + normalized.slice(normalized.lastIndexOf(`/${prefix}`) + prefix.length + 1)
    );
  }
  return normalized.startsWith("/") ? normalized : prefix + normalized;
}

/**
 * Coverage of the changed lines that tests can execute (lines the coverage
 * report knows). Changed files outside every report are not counted.
 */
export function changedLineCoverage(changed, coverage) {
  let total = 0;
  let covered = 0;
  for (const [file, lines] of changed) {
    const hits = coverage.get(file);
    if (!hits) continue;
    for (const n of lines) {
      if (!hits.has(n)) continue;
      total++;
      if (hits.get(n) > 0) covered++;
    }
  }
  return { total, covered, percent: total === 0 ? null : (covered / total) * 100 };
}

function ratingPoints(max, rating) {
  if (rating === undefined) return { points: max, detail: "sin datos de código nuevo" };
  const value = Math.round(Number(rating));
  return {
    points: max * (RATING_SHARE[value] ?? 0),
    detail: `nota ${GRADE[value] ?? value}`,
  };
}

/**
 * The score and its breakdown. `sonar` holds SonarQube's new-code measures
 * (ratings 1-5 and percentages); `coverage` is changedLineCoverage's result.
 */
export function computeScore(sonar, coverage) {
  const items = [
    {
      name: "Seguridad del código nuevo",
      max: 25,
      ...ratingPoints(25, sonar.new_security_rating),
    },
    {
      name: "Fiabilidad (bugs)",
      max: 20,
      ...ratingPoints(20, sonar.new_reliability_rating),
    },
    {
      name: "Mantenibilidad",
      max: 15,
      ...ratingPoints(15, sonar.new_maintainability_rating),
    },
  ];

  if (coverage.percent === null) {
    items.push({
      name: "Cobertura de las líneas cambiadas",
      max: 20,
      points: 20,
      detail: "el PR no cambia líneas ejecutables con pruebas",
    });
  } else {
    items.push({
      name: "Cobertura de las líneas cambiadas",
      max: 20,
      points: 20 * Math.min(1, coverage.percent / COVERAGE_TARGET),
      detail: `${coverage.percent.toFixed(1)} % (${coverage.covered}/${coverage.total} líneas)`,
    });
  }

  const duplication = sonar.new_duplicated_lines_density;
  if (duplication === undefined) {
    items.push({
      name: "Duplicación",
      max: 10,
      points: 10,
      detail: "sin datos de código nuevo",
    });
  } else {
    const [low, high] = DUPLICATION_RANGE;
    const value = Number(duplication);
    const share = value <= low ? 1 : value >= high ? 0 : (high - value) / (high - low);
    items.push({
      name: "Duplicación",
      max: 10,
      points: 10 * share,
      detail: `${value.toFixed(1)} %`,
    });
  }

  const reviewed = sonar.new_security_hotspots_reviewed;
  items.push(
    reviewed === undefined
      ? {
          name: "Security hotspots revisados",
          max: 10,
          points: 10,
          detail: "sin hotspots nuevos",
        }
      : {
          name: "Security hotspots revisados",
          max: 10,
          points: (10 * Number(reviewed)) / 100,
          detail: `${Number(reviewed).toFixed(0)} %`,
        },
  );

  const score = Math.round(items.reduce((sum, item) => sum + item.points, 0));
  return { score, passed: score >= THRESHOLD, items };
}

export const COMMENT_MARKER = "<!-- vetify-pr-score -->";

export function renderReport({ score, passed, items }) {
  const rows = items
    .map((i) => `| ${i.name} | ${round(i.points)} / ${i.max} | ${i.detail} |`)
    .join("\n");
  return `${COMMENT_MARKER}
## ${passed ? "✅" : "❌"} PR score: ${score} / 100 (mínimo ${THRESHOLD})

| Criterio | Puntos | Detalle |
| --- | --- | --- |
${rows}

${
  passed
    ? "Alcanza la nota mínima. El merge también requiere la aprobación de una persona."
    : "No alcanza la nota mínima: el merge queda bloqueado hasta subirla."
}
`;
}

const round = (n) => (Number.isInteger(n) ? n : n.toFixed(1));

/** Check conclusions that let the score go ahead. A skipped job (fork PRs skip Snyk) is not a failure. */
const PASSING = new Set(["success", "skipped", "neutral"]);

/**
 * Where the other required checks stand on one commit. `checkRuns` and
 * `statuses` are GitHub API objects; for a check that ran more than once, the
 * latest run counts.
 */
export function checksState(required, checkRuns, statuses) {
  const latestRun = new Map();
  for (const run of checkRuns) {
    const seen = latestRun.get(run.name);
    if (!seen || run.id > seen.id) latestRun.set(run.name, run);
  }
  const latestStatus = new Map();
  for (const status of statuses) {
    const seen = latestStatus.get(status.context);
    if (!seen || status.id > seen.id) latestStatus.set(status.context, status);
  }

  const pending = [];
  const failed = [];
  for (const name of required) {
    const run = latestRun.get(name);
    const status = latestStatus.get(name);
    if (run) {
      if (run.status !== "completed") pending.push(name);
      else if (!PASSING.has(run.conclusion)) failed.push(`${name} (${run.conclusion})`);
    } else if (status) {
      if (status.state === "pending") pending.push(name);
      else if (status.state !== "success") failed.push(`${name} (${status.state})`);
    } else {
      pending.push(name);
    }
  }
  return { pending, failed };
}

/** The report when the score is withheld because other checks did not pass. */
export function renderWithheld(failed) {
  return `${COMMENT_MARKER}
## ❌ PR score: sin nota

La nota se calcula solo cuando pasan todos los demás checks automáticos. No pasaron:

${failed.map((name) => `- ${name}`).join("\n")}

Corregí esos checks y hacé push: el PR score vuelve a correr con el nuevo commit.
`;
}
