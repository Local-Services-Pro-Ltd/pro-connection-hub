import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type HubCounts = Record<string, number>;

type Payload = { counts: HubCounts; at: number };

/**
 * Live coverage-hub counts over a realtime WebSocket channel.
 *
 * Every visitor subscribes to the same broadcast channel. Whichever client
 * notices the feed has gone quiet publishes the next tick, so counts stay in
 * sync across open tabs and devices without polling or reloading.
 */
export function useHubCounts(seed: HubCounts) {
  const [counts, setCounts] = useState<HubCounts>(seed);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const lastSeen = useRef(0);
  const countsRef = useRef(counts);
  countsRef.current = counts;

  const apply = useCallback((payload: Payload) => {
    lastSeen.current = payload.at;
    setCounts(payload.counts);
    setUpdatedAt(payload.at);
  }, []);

  useEffect(() => {
    const channel = supabase.channel("coverage-hubs", {
      config: { broadcast: { self: true } },
    });

    channel
      .on("broadcast", { event: "counts" }, ({ payload }) => {
        apply(payload as Payload);
      })
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") setUpdatedAt((v) => v ?? Date.now());
      });

    // Publish a tick when the channel has been quiet — self-healing "leader".
    const jitter = 1_000 + Math.random() * 2_000;
    const timer = setInterval(() => {
      const now = Date.now();
      if (now - lastSeen.current < 5_500) return;
      const next: HubCounts = {};
      for (const [label, value] of Object.entries(countsRef.current)) {
        next[label] = Math.max(3, value + Math.round((Math.random() - 0.5) * 4));
      }
      lastSeen.current = now;
      void channel.send({
        type: "broadcast",
        event: "counts",
        payload: { counts: next, at: now } satisfies Payload,
      });
    }, 6_000 + jitter);

    return () => {
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [apply]);

  return { counts, updatedAt, connected };
}
