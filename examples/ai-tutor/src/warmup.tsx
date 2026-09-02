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
 * While that voice is talking there is nothing else to say, so nothing else is
 * shown. The fallback below is for a warm-up with no voice - the hook failed,
 * or speech is unavailable - where a still card and no sound is
 * indistinguishable from a hang. There it says the elapsed time and how many
 * scenes have arrived, which is the difference between waiting and wondering.
 *
 * There is no progress bar because there is no progress to report - the planner
 * does not say how far through it is, and a bar that moves on a timer is a lie.
 */
const STEPS = [
  "Reading the question…",
  "Choosing the beats…",
  "Filling in the scenes…",
  "Writing what to say…",
];

export function Warmup({ visible, question, speaking, scenes }: {
  visible: boolean;
  question?: string;
  /** A hook line is being spoken over the card, so the card says nothing more. */
  speaking: boolean;
  scenes: number;
}) {
  const [step, setStep] = useState(0);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!visible) {
      setStep(0);
      setSeconds(0);
      return;
    }
    const stepper = window.setInterval(() => setStep((current) => current + 1), 4000);
    const clock = window.setInterval(() => setSeconds((current) => current + 1), 1000);
    return () => {
      window.clearInterval(stepper);
      window.clearInterval(clock);
    };
  }, [visible]);

  return <div className={`warmup${visible ? "" : " done"}`} aria-hidden={!visible}>
    <div className="warmup-drift" />
    {question && <p className="warmup-question">{question}</p>}
    {!speaking && <>
      <p key={step} className="warmup-step" aria-live="polite">
        {STEPS[Math.min(step, STEPS.length - 1)]}
      </p>
      <p className="warmup-clock">
        {scenes > 0 ? `${scenes} scene${scenes === 1 ? "" : "s"} so far · ${seconds}s` : `${seconds}s`}
      </p>
    </>}
  </div>;
}
