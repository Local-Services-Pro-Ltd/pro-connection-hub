/**
 * Waiting-list confirmation email. Server-only.
 *
 * The send goes live the moment the sender domain (tradesmanfinder.org) is
 * verified — at that point the app-email template registry exists and the
 * body below swaps the console line for the real send. Until then sign-ups
 * still work; they simply don't get an email.
 */
export async function sendWaitingListConfirmation(payload: {
  email: string;
  name: string | undefined;
  postcode: string;
  role: "homeowner" | "trader";
  id: string;
}): Promise<{ sent: boolean }> {
  const registry = await import("./email-templates/send-email").catch(
    () => null,
  );

  if (!registry || typeof registry.sendTemplateEmail !== "function") {
    console.info(
      `[waiting-list] confirmation email pending sender-domain setup (${payload.postcode})`,
    );
    return { sent: false };
  }

  const result = await registry.sendTemplateEmail(
    "waiting-list-confirmation",
    payload.email,
    {
      templateData: {
        name: payload.name ?? null,
        postcode: payload.postcode,
        role: payload.role,
      },
      idempotencyKey: `waiting-list-confirmation-${payload.id}`,
    },
  );

  return { sent: Boolean(result?.sent) };
}
