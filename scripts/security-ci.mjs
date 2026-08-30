#!/usr/bin/env node
/**
 * CI security gate.
 *
 * Runs the database security regression suites (posture, RBAC, privilege,
 * featured-pro) and fails the job when any check fails, unless that exact
 * check is listed in tests/regression/security-baseline.json as a reviewed,
 * accepted finding. That way a pull request is blocked only when it introduces
 * a NEW finding.
 *
 * Env:
 *   SUPABASE_URL               required
 *   SUPABASE_SERVICE_ROLE_KEY  required (CI secret)
 *   GITHUB_STEP_SUMMARY        optional, written to when present
 */
import {
  readFileSync,
  writeFileSync,
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from "node:fs";

const args = process.argv.slice(2);
const HISTORY_DIR = "tests/regression/history";
const keepHistory = args.includes("--history");
const summaryOutIdx = args.indexOf("--json-out");
const summaryOut = summaryOutIdx >= 0 ? args[summaryOutIdx + 1] : null;

const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(2);
}

const BASELINE_PATH = "tests/regression/security-baseline.json";
const baseline = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, "utf8"))
  : { accepted: [] };
const accepted = new Set(
  (baseline.accepted ?? []).map((a) => `${a.suite}:${a.check_name}`),
);

const res = await fetch(`${url}/rest/v1/rpc/security_regression_run`, {
  method: "POST",
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "content-type": "application/json",
  },
  body: "{}",
});

if (!res.ok) {
  console.error(`Security suite call failed: ${res.status} ${await res.text()}`);
  process.exit(2);
}

const checks = await res.json();
const failures = checks.filter((c) => c.passed === false);
const newFindings = failures.filter(
  (c) => !accepted.has(`${c.suite}:${c.check_name}`),
);

const lines = [];
lines.push(`# Security scan — ${checks.length} checks`);
lines.push("");
lines.push("| Result | Suite | Check | Detail |");
lines.push("| --- | --- | --- | --- |");
for (const c of checks) {
  const state =
    c.passed === null
      ? "skipped"
      : c.passed === true
        ? "pass"
      : accepted.has(`${c.suite}:${c.check_name}`)
        ? "accepted"
        : "NEW FINDING";
  lines.push(
    `| ${state} | ${c.suite} | ${c.check_name} | ${String(c.detail ?? "").replace(/\|/g, "\\|").slice(0, 180)} |`,
  );
}
const summary = lines.join("\n");
console.log(summary);

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}

// Rolling history: one JSON snapshot per run, plus an index for trend
// comparison over time. Written before the exit so failing runs are recorded.
let previous = null;
if (keepHistory) {
  mkdirSync(HISTORY_DIR, { recursive: true });
  const existing = readdirSync(HISTORY_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}T.*\.json$/.test(f))
    .sort();
  const last = existing.at(-1);
  if (last) {
    try {
      previous = JSON.parse(readFileSync(`${HISTORY_DIR}/${last}`, "utf8"));
    } catch {
      previous = null;
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const snapshot = {
    ran_at: new Date().toISOString(),
    commit: process.env.GITHUB_SHA ?? null,
    source: process.env.SCAN_SOURCE ?? "ci",
    total: checks.length,
    failed: failures.length,
    new_findings: newFindings.map((f) => `${f.suite}/${f.check_name}`),
    checks: checks.map((c) => ({
      suite: c.suite,
      check_name: c.check_name,
      passed: c.passed,
      detail: c.detail,
    })),
  };
  writeFileSync(`${HISTORY_DIR}/${stamp}.json`, `${JSON.stringify(snapshot, null, 2)}\n`);

  // Prune to the most recent 90 snapshots so the repository stays small.
  const all = readdirSync(HISTORY_DIR)
    .filter((f) => f.endsWith(".json") && f !== "index.json")
    .sort();
  const { unlinkSync } = await import("node:fs");
  for (const f of all.slice(0, Math.max(0, all.length - 90))) {
    unlinkSync(`${HISTORY_DIR}/${f}`);
  }

  const index = readdirSync(HISTORY_DIR)
    .filter((f) => f.endsWith(".json") && f !== "index.json")
    .sort()
    .map((f) => {
      const snap = JSON.parse(readFileSync(`${HISTORY_DIR}/${f}`, "utf8"));
      return {
        file: f,
        ran_at: snap.ran_at,
        total: snap.total,
        failed: snap.failed,
        new_findings: snap.new_findings ?? [],
      };
    });
  writeFileSync(`${HISTORY_DIR}/index.json`, `${JSON.stringify(index, null, 2)}\n`);

  if (previous) {
    const before = new Set(
      previous.checks
        .filter((c) => c.passed === false)
        .map((c) => `${c.suite}/${c.check_name}`),
    );
    const regressions = failures
      .map((c) => `${c.suite}/${c.check_name}`)
      .filter((k) => !before.has(k));
    console.log(
      regressions.length
        ? `\nChanged since last snapshot: ${regressions.join(", ")}`
        : "\nNo change in failing checks since the last snapshot.",
    );
  }
}

if (summaryOut) {
  writeFileSync(
    summaryOut,
    JSON.stringify(
      {
        total: checks.length,
        failed: failures.length,
        failures: newFindings.map((f) => ({
          suite: f.suite,
          check_name: f.check_name,
          detail: f.detail,
        })),
      },
      null,
      2,
    ),
  );
}

if (newFindings.length > 0) {
  console.error(
    `\n${newFindings.length} new security finding(s). Merge blocked:\n` +
      newFindings.map((f) => ` - ${f.suite}/${f.check_name}: ${f.detail}`).join("\n"),
  );
  process.exit(1);
}

console.log(
  `\nNo new security findings (${failures.length} accepted baseline finding(s)).`,
);
