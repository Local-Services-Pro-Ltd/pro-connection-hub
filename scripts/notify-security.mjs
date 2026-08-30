#!/usr/bin/env node
/**
 * CI alerting for the security job.
 *
 * Called from GitHub Actions when the security scan reports a new finding or
 * the job fails outright. It posts directly to a Slack incoming webhook when
 * SLACK_WEBHOOK_URL is configured, and asks the deployed app to fan the same
 * alert out to Slack + owner email through /api/public/security-alert.
 *
 * Env:
 *   SLACK_WEBHOOK_URL      optional — Slack incoming webhook
 *   APP_URL                optional — deployed app base URL
 *   SECURITY_SCAN_TOKEN    optional — shared secret for the alert endpoint
 *   SCAN_SUMMARY_FILE      optional — JSON written by scripts/security-ci.mjs
 *   ALERT_REASON           optional — short reason, e.g. "job failed"
 *   GITHUB_SERVER_URL / GITHUB_REPOSITORY / GITHUB_RUN_ID (set by Actions)
 */
import { readFileSync, existsSync } from "node:fs";

const summaryFile = process.env.SCAN_SUMMARY_FILE ?? "security-summary.json";
const summary = existsSync(summaryFile)
  ? JSON.parse(readFileSync(summaryFile, "utf8"))
  : { total: 0, failed: 0, failures: [] };

const runUrl =
  process.env.GITHUB_SERVER_URL &&
  process.env.GITHUB_REPOSITORY &&
  process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : undefined;

const reason = process.env.ALERT_REASON ?? "new security findings";
const failures = summary.failures ?? [];

const lines = failures
  .slice(0, 15)
  .map((f) => `• *${f.check_name}* (${f.suite}) — ${f.detail ?? ""}`)
  .join("\n");

const text =
  `:rotating_light: *TradesmanFinder security CI: ${reason}*\n` +
  `Repo: ${process.env.GITHUB_REPOSITORY ?? "local"} · Ref: ${process.env.GITHUB_REF_NAME ?? "?"}\n` +
  `${summary.failed ?? 0} failing of ${summary.total ?? 0} checks\n` +
  (lines || "_No individual check details — see the job log._") +
  (runUrl ? `\n<${runUrl}|View CI run>` : "");

let delivered = false;

if (process.env.SLACK_WEBHOOK_URL) {
  const res = await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (res.ok) {
    delivered = true;
    console.log("Slack alert sent.");
  } else {
    console.error(`Slack webhook failed [${res.status}]: ${await res.text()}`);
  }
}

if (process.env.APP_URL && process.env.SECURITY_SCAN_TOKEN) {
  const res = await fetch(
    `${process.env.APP_URL.replace(/\/$/, "")}/api/public/security-alert`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-security-scan-token": process.env.SECURITY_SCAN_TOKEN,
      },
      body: JSON.stringify({
        failures,
        total: summary.total ?? 0,
        source: `ci: ${reason}`,
        url: runUrl,
      }),
    },
  );
  if (res.ok) {
    delivered = true;
    console.log("Email/Slack alert relayed through the app.");
  } else {
    console.error(`Alert relay failed [${res.status}]: ${await res.text()}`);
  }
}

if (!delivered) {
  console.warn(
    "No alert channel configured (set SLACK_WEBHOOK_URL, or APP_URL + SECURITY_SCAN_TOKEN).",
  );
}
