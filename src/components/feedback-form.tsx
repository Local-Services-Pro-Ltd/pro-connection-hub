import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Action } from "@/components/site-chrome";

const field =
  "w-full rounded-sm border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-primary";

export function FeedbackForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || message.trim().length < 5) {
      toast.error("Add your name, email and a short message.");
      return;
    }
    setSending(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const { error } = await supabase.from("feedback").insert({
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
      user_id: sessionData.session?.user.id ?? null,
    });
    setSending(false);
    if (error) {
      toast.error("That didn't send. Please try again or email us.");
      return;
    }
    setSent(true);
    setName("");
    setEmail("");
    setMessage("");
    toast.success("Thanks — your feedback is with us.");
  }

  if (sent) {
    return (
      <p className="rounded-sm border border-border p-4 text-sm leading-relaxed text-muted-foreground">
        Thanks for the feedback. We read every message and reply to anything
        that needs an answer.{" "}
        <button
          type="button"
          onClick={() => setSent(false)}
          className="underline hover:text-foreground"
        >
          Send another
        </button>
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="sr-only">Your name</span>
          <input
            className={field}
            placeholder="Your name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="sr-only">Your email</span>
          <input
            className={field}
            type="email"
            placeholder="Your email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
      </div>
      <label className="block">
        <span className="sr-only">Your message</span>
        <textarea
          className={`${field} min-h-24`}
          placeholder="What's working, what isn't?"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </label>
      <Action type="submit" disabled={sending}>
        {sending ? "Sending…" : "Send feedback"}
      </Action>
    </form>
  );
}
