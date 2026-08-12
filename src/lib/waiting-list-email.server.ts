/**
 * Waiting-list confirmation email. Server-only.
 *
 * The send goes live the moment the sender domain (tradesmanfinder.org) is
 * verified — at that point the app-email templates are added and the body
 * below swaps this log line for the real send. Until then sign-ups still
 * work; they simply don't get an email.
 */
export async function sendWaitingListConfirmation(payload: {
  email: string;
  name: string | undefined;
  postcode: string;
  role: "homeowner" | "trader";
  id: string;
}): Promise<{ sent: boolean }> {
  console.info(
    `[waiting-list] confirmation email pending sender-domain setup (${payload.role}, ${payload.postcode})`,
  );
  return { sent: false };
}
