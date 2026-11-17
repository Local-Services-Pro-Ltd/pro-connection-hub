import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EXPIRED_RESET_LINK_MESSAGE,
  PASSWORD_RESET_NEUTRAL_MESSAGE,
  validatePasswordReset,
} from "@/lib/password-recovery";

describe("password recovery", () => {
  it("uses one neutral response that does not reveal account existence", () => {
    expect(PASSWORD_RESET_NEUTRAL_MESSAGE).toBe(
      "If an account exists for that email, we've sent a link to reset your password.",
    );
  });

  it("uses the requested expired-link response", () => {
    expect(EXPIRED_RESET_LINK_MESSAGE).toBe("This reset link has expired or was already used");
  });

  it("rejects passwords shorter than eight characters", () => {
    expect(validatePasswordReset("short7", "short7")).toBe(
      "Password must be at least 8 characters.",
    );
  });

  it("rejects passwords that do not match", () => {
    expect(validatePasswordReset("eightchars", "different")).toBe("Passwords do not match.");
  });

  it("accepts matching passwords of at least eight characters", () => {
    expect(validatePasswordReset("eightchars", "eightchars")).toBeNull();
  });

  it("uses the shared visibility control for every account password field", () => {
    const signIn = readFileSync("src/routes/signin.tsx", "utf8");
    const claim = readFileSync("src/routes/claim.$proId.tsx", "utf8");
    const reset = readFileSync("src/routes/reset-password.tsx", "utf8");

    expect(signIn).toContain("<PasswordInput");
    expect(claim).toContain("<PasswordInput");
    expect(reset.match(/<PasswordInput/g)).toHaveLength(2);
    expect(reset).toContain("<PasswordMatchHint");
    expect(`${signIn}\n${claim}\n${reset}`).not.toContain('type="password"');
  });
});
