/** Never allow a post-login destination to escape this site's origin. */
export function safeAuthDestination(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/account";
  }
  const hasUnsafeCharacter = Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return character === "\\" || code <= 0x20;
  });
  return hasUnsafeCharacter ? "/account" : value;
}

/** Lovable's /~oauth proxy exists on its hosting, not on Cloudflare Pages. */
export function usesLovableAuth(hostname: string): boolean {
  return hostname.endsWith(".lovable.app") || hostname.endsWith(".lovableproject.com");
}

export function googleReturnUrl(origin: string, destination: unknown): string {
  const url = new URL("/signin", origin);
  url.searchParams.set("redirect", safeAuthDestination(destination));
  return url.toString();
}

/** Google sign-in needs the Lovable auth adapter (Lovable hosting) or an explicit opt-in. */
export function showGoogleSignIn(hostname: string, googleAuthEnabled: string | undefined): boolean {
  return usesLovableAuth(hostname) || hostname === "localhost" || googleAuthEnabled === "true";
}
