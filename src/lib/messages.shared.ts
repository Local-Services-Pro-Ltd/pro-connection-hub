/** Shared by the message server functions and screens. */

export type JobMessage = {
  id: string;
  /** True when the person reading wrote it. */
  mine: boolean;
  body: string;
  created_at: string;
};

/** One conversation: a job and one invited firm. */
export type JobThread = {
  pro_id: string;
  company: string;
  /** False once the firm's quote was declined, withdrawn or expired. */
  open: boolean;
  unread: number;
  messages: JobMessage[];
};

export const MESSAGE_MAX = 2000;
