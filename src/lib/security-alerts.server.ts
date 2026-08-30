/**
 * Security alerting fan-out.
 *
 * One place that decides where a security failure is announced: a Slack
 * incoming webhook (when `SECURITY_SLACK_WEBHOOK_URL` is configured) and the
 * branded owner email template. Both are best-effort — a failing notifier
 * must never take down the scan or the CI hook that triggered it.
 */
export type AlertFailure = {
  suite?: string;
  check_name?: string;
  detail?: string;
};

export type AlertInput = {
  failures: AlertFailure[];
  total: number;
  source: string;
  environment: string;
  /** Link back to the CI run or the admin page. */
  url?: string;
};

export type AlertResult = { slack: boolean; email: boolean };

async function postSlack(input: AlertInput): Promise<boolean> {
  const webhook = process.env["SECURITY_SLACK_WEBHOOK_URL"];
  if (!webhook) return false;

  const lines = input.failures
    .slice(0, 15)
    .map(
      (f) =>
        `• *${f.check_name ?? "check"}* (${f.suite ?? "suite"}) — ${f.detail ?? ""}`,
    )
    .join("\n");

  const text =
    `:rotating_light: *TradesmanFinder security: ${input.failures.length} of ${input.total} checks failing*\n` +
    `Source: ${input.source} · Environment: ${input.environment}\n` +
    (lines || "_No check detail supplied._") +
    (input.url ? `\n<${input.url}|View run>` : "");

  const res = await fetch(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    console.error(
      `[security-alert] Slack webhook failed [${res.status}]: ${await res.text()}`,
    );
    return false;
  }
  return true;
}

async function sendEmail(input: AlertInput): Promise<boolean> {
  const { sendTemplateEmail } = await import(
    "@/lib/email-templates/send-email"
  );
  await sendTemplateEmail("security-scan-alert", "", {
    templateData: {
      failures: input.failures,
      total: input.total,
      ranAt: new Date().toISOString(),
      environment: `${input.environment} (${input.source})`,
    },
  });
  return true;
}

export async function sendSecurityAlert(
  input: AlertInput,
): Promise<AlertResult> {
  const [slack, email] = await Promise.allSettled([
    postSlack(input),
    sendEmail(input),
  ]);
  if (slack.status === "rejected")
    console.error("[security-alert] slack failed", slack.reason);
  if (email.status === "rejected")
    console.error("[security-alert] email failed", email.reason);
  return {
    slack: slack.status === "fulfilled" && slack.value,
    email: email.status === "fulfilled" && email.value,
  };
}
