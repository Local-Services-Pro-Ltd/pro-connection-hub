export const PASSWORD_RESET_NEUTRAL_MESSAGE =
  "If an account exists for that email, we've sent a link to reset your password.";

export const EXPIRED_RESET_LINK_MESSAGE = "This reset link has expired or was already used";

export function validatePasswordReset(password: string, confirmation: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password !== confirmation) return "Passwords do not match.";
  return null;
}
