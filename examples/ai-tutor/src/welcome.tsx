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

/**
 * One frame of footage, playing only when it is being looked at.
 *
 * `playing` left undefined means always - the hero behind the invitation. A
 * card passes it, so only the question in hand moves: four clips looping at
 * once is four things competing for the eye on a screen whose whole argument is
 * that one video is worth more than a page of text. It is also four decoders
 * running for three pictures nobody is watching.
 */
function Frame({ media, poster, playing }: { media: WelcomeMedia | null; poster?: boolean; playing?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = video.current;
    if (!element || playing === undefined) return;
    if (playing) void element.play().catch(() => undefined);
    else element.pause();
  }, [playing]);

  if (!media) return null;
  if (media.type === "image") return <img className="welcome-media" src={media.url} alt="" />;
  return <video
    ref={video}
    className="welcome-media"
    src={media.url}
    poster={poster ? media.posterUrl : undefined}
    autoPlay={playing !== false}
    muted
    loop
    playsInline
    // The still is what a paused card shows, so it is worth having early.
    preload="metadata"
    // Decorative: it carries no information the words do not.
    aria-hidden="true"
  />;
}

export function Welcome({ data, onAsk }: { data?: WelcomeData; onAsk: (question: string) => void }) {
  const cards = data?.cards ?? [];
  const railRef = useRef<HTMLUListElement>(null);
  /**
   * Which question is in hand.
   *
   * The dots move it and the ring shows it, so the highlight always names what
   * pressing Enter would ask. Pointing at a card or tabbing to it moves it too:
   * a marker that disagrees with what you are about to press is worse than no
   * marker.
   */
  const [at, setAt] = useState(0);
  /**
   * Set the moment the person takes over, and never unset.
   *
   * A row that keeps moving under someone's hand is the reason carousels are
   * disliked: they point at a card and it walks away. Pointing, tabbing, or
   * pressing a dot ends the tour for good.
   */
  const [taken, setTaken] = useState(false);

  const take = useCallback((index: number) => {
    setTaken(true);
    setAt(index);
  }, []);

  /**
   * Left to right, one card every five seconds, until it is taken over.
   *
   * The cards are the only thing on this screen that shows what an answer looks
   * like, and three of the four sat still. Reduced motion turns it off
   * entirely - the ring still starts on the first card, so nothing is lost but
   * the movement.
   */
  useEffect(() => {
    if (taken || cards.length < 2) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const tour = window.setInterval(() => setAt((index) => (index + 1) % cards.length), 5000);
    return () => window.clearInterval(tour);
  }, [taken, cards.length]);

  const show = useCallback((index: number) => {
    setTaken(true);
    setAt(index);
  }, []);

  /**
   * Keep the card in hand in view.
   *
   * Wherever the row overflows - a phone - a ring on a card that is off the
   * edge tells nobody anything, and the tour walks off screen after the second
   * card. This follows every way the selection moves rather than only the dots.
   *
   * The rail is scrolled directly rather than through `scrollIntoView`, which
   * is also entitled to scroll the page to bring the row into view; there is
   * nothing to bring into view, and the page should not move.
   */
  useEffect(() => {
    const rail = railRef.current;
    const card = rail?.children[at] as HTMLElement | undefined;
    if (!rail || !card) return;
    if (rail.scrollWidth <= rail.clientWidth + 4) return;
    const centred = card.offsetLeft - (rail.clientWidth - card.offsetWidth) / 2;
    rail.scrollTo({ left: Math.max(0, centred), behavior: "smooth" });
  }, [at]);
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
        An AI chat that answers<br />
        <em>in video, not text.</em>
      </h1>


      {cards.length > 0 && <ul className="welcome-cards" ref={railRef}>
        {cards.map((card, index) => <li key={card.question}>
          <button
            type="button"
            data-active={index === at ? "" : undefined}
            onFocus={() => take(index)}
            onPointerEnter={() => take(index)}
            onClick={() => onAsk(card.question)}
          >
            <Frame media={card.media} playing={index === at} />
            <span className="welcome-card-wash" aria-hidden="true" />
            <span className="welcome-card-question">{card.question}</span>
          </button>
        </li>)}
      </ul>}

      {cards.length > 1 && <div className="welcome-dots" role="tablist" aria-label="Suggested questions">
        {cards.map((card, index) => <button
          key={card.question}
          type="button"
          role="tab"
          aria-selected={index === at}
          aria-label={card.question}
          className={index === at ? "on" : undefined}
          onClick={() => show(index)}
        />)}
      </div>}
    </div>
  </div>;
}
