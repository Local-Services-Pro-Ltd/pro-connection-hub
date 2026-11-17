import { Check } from "lucide-react";

export function PasswordMatchHint({
  password,
  confirmation,
}: {
  password: string;
  confirmation: string;
}) {
  if (!confirmation) return null;

  const matches = password === confirmation;
  return (
    <p
      role="status"
      className={`mt-2 flex items-center gap-1.5 text-xs ${matches ? "text-success" : "text-muted-foreground"}`}
    >
      {matches && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      {matches ? "Passwords match" : "Passwords don't match yet"}
    </p>
  );
}
