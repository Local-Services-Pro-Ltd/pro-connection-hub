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
});
