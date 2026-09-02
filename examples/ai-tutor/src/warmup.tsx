import { useEffect, useState } from "react";

/**
 * What fills the stage while the lesson is being composed.
 *
 * Composing takes about eight seconds, and six of those are the planner
 * writing its first scene - generation, not anything the page controls. So the
 * wait is not shortened here, it is furnished: the question goes up in the
 * lesson's own brand within a tenth of a second, and a voice opens on it a
 * couple of seconds later.
 *
 * The question, and a line that keeps moving. No clock and no scene count: at
 * eight seconds a number counting up measures the wait rather than filling it,
 * and a scene tally is the composing machinery narrating itself to someone who
 * asked about the Moon. The shimmer is what says the page has not stopped, and
 * it is enough at this length.
 *
 * There is no progress bar because there is no progress to report - the planner
 * does not say how far through it is, and a bar that moves on a timer is a lie.
 */
/**
 * Short, and unmistakably about a camera.
 *
 * The wait is about seven seconds and these change every three, so line one
 * and half of line two are all anyone reads - and line one is the only one
 * seen before the voice starts. "Choosing the beats" was our own jargon, and
 * "writing the narration" reads like a text answer is coming. A rolling camera
 * does not.
 */
const STEPS = [
  "Rolling camera…",
  "Framing the shots…",
  "Filming your answer…",
  "Still filming…",
];

export function Warmup({ visible, question, background, foreground }: {
  visible: boolean;
  question?: string;
  /** The ground the lesson's own scenes are composed on. */
  background: string;
  foreground: string;
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!visible) {
      setStep(0);
      return;
    }
    const stepper = window.setInterval(() => setStep((current) => current + 1), 3000);
    return () => window.clearInterval(stepper);
  }, [visible]);

  return <div className={`warmup${visible ? "" : " done"}`} aria-hidden={!visible} style={{ background, color: foreground }}>
    <div className="warmup-drift" />
    {question && <p className="warmup-question">{question}</p>}
    <p key={step} className="warmup-step" aria-live="polite">
      {STEPS[Math.min(step, STEPS.length - 1)]}
    </p>
  </div>;
}
