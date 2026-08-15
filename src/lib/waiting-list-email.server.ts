/**
 * Waiting-list confirmation email (double opt-in). Server-only.
 *
 * Delivery, retries, rate limits, bounce/complaint suppression and the
 * unsubscribe footer are all handled by the managed email platform — this file
 * only decides what to send and to whom. Sends go live automatically once the
 * sender domain finishes verifying; until then the send throws and the caller
 * falls back to accepting the sign-up without the confirmation step, so nobody
 * is lost.
 */
import { EmailAPIError } from "@lovable.dev/email-js";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";

export async function sendWaitingListConfirmation(payload: {
  email: string;
  name: string | undefined;
  postcode: string;
  role: "homeowner" | "trader";
  confirmUrl: string;
  id?: string;
}): Promise<{ sent: boolean }> {
  try {
    const result = await sendTemplateEmail(
      "waiting-list-confirm",
      payload.email,
      {
        templateData: {
          ...(payload.name ? { name: payload.name } : {}),
          postcode: payload.postcode,
          role: payload.role,
          confirmUrl: payload.confirmUrl,
        },
        idempotencyKey: `waiting-list-confirm-${payload.id ?? payload.email}`,
      },
    );
    // A suppressed recipient (earlier bounce, complaint or unsubscribe) is a
    // normal outcome, never something to retry around.
    return { sent: result.sent };
  } catch (error) {
    if (error instanceof EmailAPIError) {
      console.info(
        `[waiting-list] confirmation email not sent (${error.code})`,
      );
      return { sent: false };
    }
    throw error;
  }
}
