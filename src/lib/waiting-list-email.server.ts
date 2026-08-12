/**
 * Waiting-list confirmation email. Server-only.
 *
 * Unsubscribe / manage-updates: Lovable hosts the preference page and appends
 * the link to the footer of every app email automatically, so the recipient
 * can stop or resume updates from the confirmation itself — we must not build
 * our own unsubscribe page or token table. The template below simply must not
 * strip that footer.
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
