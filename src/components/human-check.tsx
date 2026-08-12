import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { getHumanCheck } from "@/lib/waiting-list.functions";

export type HumanCheckState = {
  token: string;
  answer: string;
  website: string;
};

/**
 * Lightweight spam gate: a signed arithmetic question issued by the server,
 * plus a hidden honeypot field. No third-party captcha, no tracking pixels,
 * nothing for the visitor to click through.
 */
export function useHumanCheck() {
  const load = useServerFn(getHumanCheck);
  const [question, setQuestion] = useState("");
  const [state, setState] = useState<HumanCheckState>({
    token: "",
    answer: "",
    website: "",
  });

  const refresh = () => {
    void load().then((challenge) => {
      setQuestion(challenge.question);
      setState((s) => ({ ...s, token: challenge.token, answer: "" }));
    });
  };

  useEffect(() => {
    refresh();
    // Issued once per mount; refresh() is re-run explicitly after a failure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { question, state, setState, refresh };
}

export function HumanCheck({
  question,
  state,
  setState,
  refresh,
  inputClassName,
}: {
  question: string;
  state: HumanCheckState;
  setState: React.Dispatch<React.SetStateAction<HumanCheckState>>;
  refresh: () => void;
  inputClassName: string;
}) {
  return (
    <div>
      {/* Honeypot: hidden from people, irresistible to bots. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0">
        <label>
          Website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={state.website}
            onChange={(e) =>
              setState((s) => ({ ...s, website: e.target.value }))
            }
          />
        </label>
      </div>

      <label className="block">
        <span className="eyebrow">Quick human check</span>
        <div className="mt-2 flex items-center gap-3">
          <span
            aria-live="polite"
            className="min-w-[7.5rem] font-display text-sm font-semibold"
          >
            {question || "Loading…"}
          </span>
          <input
            required
            inputMode="numeric"
            value={state.answer}
            onChange={(e) =>
              setState((s) => ({ ...s, answer: e.target.value }))
            }
            aria-label={question || "Human check answer"}
            className={`${inputClassName} max-w-[7rem]`}
          />
          <button
            type="button"
            onClick={refresh}
            className="rounded-sm border border-border-strong p-2 text-muted-foreground hover:border-primary hover:text-primary"
            aria-label="Get a different question"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </label>
    </div>
  );
}
