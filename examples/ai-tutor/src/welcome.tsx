import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The screen before anything has been asked.
 *
 * It is the one moment the tutor has to say what it does before it has done
 * it, and a gradient does not say it. Real footage behind the invitation, and
 * a real frame on each suggested question, shows the answer instead of
 * describing it - and shows it in the shape the answer will arrive in.
 *
 * Everything here is footage searched at run time rather than checked in, so
 * the example carries no media and the screen is never the same twice. It
 * degrades to the brand gradient when there is no key and no network, which is
 * the state the rest of the tutor already handles.
 */
export interface WelcomeMedia {
  url: string;
  type: "video" | "image";
  posterUrl?: string;
}

export interface WelcomeCard {
  question: string;
  media: WelcomeMedia | null;
}

export interface WelcomeData {
  hero: WelcomeMedia | null;
  cards: WelcomeCard[];
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

function Frame({ media, poster }: { media: WelcomeMedia | null; poster?: boolean }) {
  if (!media) return null;
  if (media.type === "image") return <img className="welcome-media" src={media.url} alt="" />;
  return <video
    className="welcome-media"
    src={media.url}
    poster={poster ? media.posterUrl : undefined}
    autoPlay
    muted
    loop
    playsInline
    // Decorative: it carries no information the words do not.
    aria-hidden="true"
  />;
}

export function Welcome({ data, onAsk }: { data?: WelcomeData; onAsk: (question: string) => void }) {
  const cards = data?.cards ?? [];
  const railRef = useRef<HTMLUListElement>(null);
  // Only meaningful when the row cannot show everything at once, which is a
  // phone. Dots that never move are decoration, and decoration that looks like
  // a control is worse than none.
  const [scrolls, setScrolls] = useState(false);
  const [at, setAt] = useState(0);

  const measure = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    setScrolls(rail.scrollWidth > rail.clientWidth + 4);
    const step = rail.scrollWidth / Math.max(1, cards.length);
    setAt(Math.round(rail.scrollLeft / Math.max(1, step)));
  }, [cards.length]);

  useEffect(() => {
    measure();
    const rail = railRef.current;
    if (!rail) return;
    const observer = new ResizeObserver(measure);
    observer.observe(rail);
    rail.addEventListener("scroll", measure, { passive: true });
    return () => { observer.disconnect(); rail.removeEventListener("scroll", measure); };
  }, [measure]);
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
        An AI chat that answers in<br />
        <em>video, not text.</em>
      </h1>


      {cards.length > 0 && <ul className="welcome-cards" ref={railRef}>
        {cards.map((card) => <li key={card.question}>
          <button type="button" onClick={() => onAsk(card.question)}>
            <Frame media={card.media} />
            <span className="welcome-card-wash" aria-hidden="true" />
            <span className="welcome-card-question">{card.question}</span>
          </button>
        </li>)}
      </ul>}

      {scrolls && <div className="welcome-dots" aria-hidden="true">
        {cards.map((card, index) => <span key={card.question} className={index === at ? "on" : undefined} />)}
      </div>}
    </div>
  </div>;
}
