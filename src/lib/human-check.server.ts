import { createHmac, timingSafeEqual } from "crypto";

/**
 * A small self-hosted human check. No third-party captcha, no tracking, no
 * cookie: the server issues a signed arithmetic challenge, the browser sends
 * the answer back with the form, and the signature proves we issued it.
 * Tokens are single-window (2 minutes) and carry their own issue time so a
 * form submitted in under a second is rejected as a bot.
 */

const TTL_MS = 2 * 60 * 1000;
const MIN_ELAPSED_MS = 1200;

function secret() {
  return (
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ??
    process.env["SUPABASE_PUBLISHABLE_KEY"] ??
    "tradesmanfinder-human-check"
  );
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export type HumanChallenge = { token: string; question: string };

export function issueChallenge(): HumanChallenge {
  const a = 2 + Math.floor(Math.random() * 8);
  const b = 1 + Math.floor(Math.random() * 8);
  const payload = `${a + b}.${Date.now()}`;
  return {
    token: `${payload}.${sign(payload)}`,
    question: `What is ${a} + ${b}?`,
  };
}

/** Throws a user-facing Error when the challenge doesn't check out. */
export function verifyChallenge(token: string, answer: string) {
  const parts = (token ?? "").split(".");
  if (parts.length !== 3) throw new Error("Please redo the quick human check.");

  const [expected, issuedAt, signature] = parts as [string, string, string];
  const good = Buffer.from(sign(`${expected}.${issuedAt}`));
  const given = Buffer.from(signature);
  if (good.length !== given.length || !timingSafeEqual(good, given)) {
    throw new Error("Please redo the quick human check.");
  }

  const age = Date.now() - Number(issuedAt);
  if (!Number.isFinite(age) || age > TTL_MS) {
    throw new Error("That took a while — please redo the human check.");
  }
  if (age < MIN_ELAPSED_MS) {
    throw new Error("That was a bit quick. Please try again.");
  }
  if ((answer ?? "").trim() !== expected) {
    throw new Error("That answer isn't right — have another go.");
  }
}
