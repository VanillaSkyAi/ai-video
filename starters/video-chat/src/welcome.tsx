import { useEffect, useState } from "react";
import { Frame, SuggestionCards, type CardMedia, type Suggestion } from "./suggestion-cards";

/**
 * The screen before anything has been asked.
 *
 * It is the one moment the video chat has to say what it does before it has done
 * it, and a gradient does not say it. Real footage behind the invitation, and
 * a real frame on each suggested prompt, shows the response instead of
 * describing it - and shows it in the shape the response will arrive in.
 *
 * Everything here is footage searched at run time rather than checked in, so
 * the example carries no media and the screen is never the same twice. It
 * degrades to the brand gradient when there is no key and no network, which is
 * the state the rest of the video chat already handles.
 */
export interface WelcomeData {
  hero: CardMedia | null;
  cards: Suggestion[];
}

export function useWelcome(active: boolean): WelcomeData | undefined {
  const [data, setData] = useState<WelcomeData>();
  useEffect(() => {
    if (!active || data) return;
    let live = true;
    void fetch("/api/welcome", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
      .then((response) => (response.ok ? response.json() : undefined))
      .then((payload) => { if (live && payload) setData(payload as WelcomeData); })
      // No footage is a plain gradient, not a broken screen.
      .catch(() => undefined);
    return () => { live = false; };
  }, [active, data]);
  return data;
}

export function Welcome({ data, onAsk }: { data?: WelcomeData; onAsk: (prompt: string) => void }) {
  return <div className="welcome">
    <Frame media={data?.hero ?? null} poster />
    {/* The footage is a ground for type, so it is dimmed towards the corner
        the words sit in rather than evenly - an even scrim flattens the
        picture into a texture. */}
    <div className="welcome-wash" aria-hidden="true" />

    <div className="welcome-body">
      {/* The category first, the difference last. Someone who has used
          ChatGPT or Perplexity knows what this is by the end of line one, and
          the accent line carries the only part that is new. */}
      <h1 className="welcome-title">
        An AI chat that responds<br />
        <em>in video, not text.</em>
      </h1>

      <SuggestionCards suggestions={data?.cards ?? []} label="Suggested prompts" onAsk={onAsk} />
    </div>
  </div>;
}
