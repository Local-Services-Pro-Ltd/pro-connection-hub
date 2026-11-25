import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import {
  listJobThreads,
  listMyThread,
  sendJobMessage,
  sendMyMessage,
} from "@/lib/messages.functions";
import { MESSAGE_MAX, type JobMessage } from "@/lib/messages.shared";

const time = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** The messages and the reply box. Used by both the homeowner and the firm. */
function Thread({
  messages,
  open,
  otherName,
  closedReason,
  sending,
  onSend,
}: {
  messages: JobMessage[];
  open: boolean;
  otherName: string;
  closedReason: string;
  sending: boolean;
  onSend: (body: string, done: () => void) => void;
}) {
  const [body, setBody] = useState("");
  return (
    <div>
      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">No messages yet.</p>
      ) : (
        <ol className="grid gap-3" aria-label={`Messages with ${otherName}`}>
          {messages.map((message) => (
            <li
              key={message.id}
              className={`max-w-[85%] rounded-md border p-3 text-sm ${
                message.mine
                  ? "ml-auto border-primary/40 bg-primary/10"
                  : "border-border bg-background"
              }`}
            >
              <p className="text-xs text-muted-foreground">
                {message.mine ? "You" : otherName} · {time(message.created_at)}
              </p>
              <p className="mt-1 whitespace-pre-line">{message.body}</p>
            </li>
          ))}
        </ol>
      )}
      {open ? (
        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (body.trim()) onSend(body, () => setBody(""));
          }}
        >
          <label className="block text-sm">
            <span className="sr-only">Message to {otherName}</span>
            <textarea
              rows={3}
              maxLength={MESSAGE_MAX}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={`Write to ${otherName}`}
              className="w-full rounded-sm border border-border-strong bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
            />
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={sending || !body.trim()}
              className="rounded-sm bg-primary px-4 py-2 font-display text-sm font-semibold text-primary-foreground shadow-ember hover:brightness-110 disabled:opacity-60"
            >
              {sending ? "Sending…" : "Send message"}
            </button>
            <span className="text-xs text-muted-foreground">
              Keep price, dates and payments in writing. Don't share bank or card details here.
            </span>
          </div>
        </form>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">{closedReason}</p>
      )}
    </div>
  );
}

/** Homeowner side: one conversation per invited firm, on the private job page. */
export function HomeownerMessages({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const threads = useQuery({
    queryKey: ["job-threads", token],
    queryFn: () => listJobThreads({ data: { token } }),
    retry: false,
    refetchInterval: 60_000,
  });
  const send = useMutation({
    mutationFn: (input: { proId: string; body: string }) =>
      sendJobMessage({ data: { token, ...input } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["job-threads", token] }),
    onError: (e: Error) => toast.error(e.message),
  });
  if (!threads.data?.length) return null;

  return (
    <section className="mt-12" aria-labelledby="messages-heading">
      <h2 id="messages-heading" className="text-2xl">
        Messages
      </h2>
      <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
        Ask the firms you've invited anything you need before choosing. We email the other person
        when a message arrives.
      </p>
      <ul className="mt-5 grid gap-4">
        {threads.data.map((thread) => (
          <li key={thread.pro_id} className="rounded-md border border-border bg-card p-5">
            <details open={thread.messages.length > 0 || threads.data.length === 1}>
              <summary className="flex cursor-pointer items-center gap-2 font-display text-lg">
                <MessageSquare className="h-4 w-4 text-primary" aria-hidden="true" />
                {thread.company}
                {thread.unread > 0 ? (
                  <span className="rounded-sm bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                    {thread.unread} new
                  </span>
                ) : null}
              </summary>
              <div className="mt-4">
                <Thread
                  messages={thread.messages}
                  open={thread.open}
                  otherName={thread.company}
                  closedReason="This conversation is closed because that firm is no longer quoting for the job."
                  sending={send.isPending}
                  onSend={(body, done) =>
                    send.mutate({ proId: thread.pro_id, body }, { onSuccess: done })
                  }
                />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Firm side: the conversation for one job it was invited to quote for. */
export function FirmMessages({
  quoteId,
  homeowner,
  unread,
}: {
  quoteId: string;
  homeowner: string;
  unread: number;
}) {
  const queryClient = useQueryClient();
  const list = useServerFn(listMyThread);
  const post = useServerFn(sendMyMessage);
  const [opened, setOpened] = useState(false);
  const thread = useQuery({
    queryKey: ["my-thread", quoteId],
    queryFn: () => list({ data: { quoteId } }),
    enabled: opened,
    refetchInterval: opened ? 60_000 : false,
  });
  const send = useMutation({
    mutationFn: (body: string) => post({ data: { quoteId, body } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-thread", quoteId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <details
      className="mt-5 rounded-md border border-border bg-surface p-4"
      onToggle={(event) => {
        const isOpen = (event.currentTarget as HTMLDetailsElement).open;
        setOpened(isOpen);
        if (isOpen) void queryClient.invalidateQueries({ queryKey: ["my-unread-messages"] });
      }}
    >
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        <MessageSquare className="h-4 w-4 text-primary" aria-hidden="true" />
        Messages with {homeowner || "the homeowner"}
        {unread > 0 && !opened ? (
          <span className="rounded-sm bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
            {unread} new
          </span>
        ) : null}
      </summary>
      <div className="mt-4">
        {thread.isPending ? (
          <p className="text-sm text-muted-foreground">Loading messages…</p>
        ) : thread.isError ? (
          <p role="alert" className="text-sm text-muted-foreground">
            {thread.error.message}
          </p>
        ) : (
          <Thread
            messages={thread.data.messages}
            open={thread.data.open}
            otherName={homeowner || "the homeowner"}
            closedReason="This conversation is closed because the job went to another firm or your quote was withdrawn."
            sending={send.isPending}
            onSend={(body, done) => send.mutate(body, { onSuccess: done })}
          />
        )}
      </div>
    </details>
  );
}
