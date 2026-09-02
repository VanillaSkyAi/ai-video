import { useEffect, useState } from "react";

/**
 * What fills the stage while the lesson is being composed.
 *
 * Nothing plays until the scenes and the words both exist, and that takes
 * anywhere from thirty seconds to a minute and a half. A cycling animation
 * alone is indistinguishable from a hang at that length, so the elapsed time is
 * shown: it is the difference between waiting and wondering.
 *
 * There is no progress bar because there is no progress to report - the planner
 * does not say how far through it is, and a bar that moves on a timer is a lie.
 */
const STEPS = [
  "Reading the question…",
  "Choosing the beats…",
  "Filling in the scenes…",
  "Writing what to say…",
  "Still going — a whole lesson is composed before any of it plays…",
];

export function Warmup({ visible, scenes }: { visible: boolean; scenes: number }) {
  const [step, setStep] = useState(0);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!visible) {
      setStep(0);
      setSeconds(0);
      return;
    }
    const stepper = window.setInterval(() => setStep((current) => current + 1), 6000);
    const clock = window.setInterval(() => setSeconds((current) => current + 1), 1000);
    return () => {
      window.clearInterval(stepper);
      window.clearInterval(clock);
    };
  }, [visible]);

  return <div className={`warmup${visible ? "" : " done"}`} aria-hidden={!visible}>
    <div className="warmup-drift" />
    <p key={step} className="warmup-step" aria-live="polite">
      {STEPS[Math.min(step, STEPS.length - 1)]}
    </p>
    <p className="warmup-clock">
      {scenes > 0 ? `${scenes} scene${scenes === 1 ? "" : "s"} so far · ${seconds}s` : `${seconds}s`}
    </p>
  </div>;
}
