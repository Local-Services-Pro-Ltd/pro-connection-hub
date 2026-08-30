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
import { readFileSync, appendFileSync, existsSync } from "node:fs";

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
