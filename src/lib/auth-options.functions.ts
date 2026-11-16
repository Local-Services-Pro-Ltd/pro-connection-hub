import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { showGoogleSignIn } from "@/lib/auth-redirect";

export const getAuthOptions = createServerFn({ method: "GET" }).handler(async () => {
  const host =
    (getRequestHeader("x-forwarded-host") ?? getRequestHeader("host") ?? "").split(":")[0] ?? "";
  return { google: showGoogleSignIn(host, process.env["GOOGLE_AUTH_ENABLED"]) };
});
