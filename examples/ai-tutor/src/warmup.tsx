import { useEffect, useState } from "react";

/**
 * What fills the stage while the lesson is being composed.
 *
 * Nothing plays until the narration exists, so the wait is real and worth
 * naming. A line that keeps moving reads as work; a progress bar over an
 * unknown duration reads as a lie.
 */
const STEPS = ["Reading the question…", "Choosing the beats…", "Writing the words…", "Almost there…"];

export function Warmup({ visible }: { visible: boolean }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const timer = window.setInterval(() => setStep((current) => current + 1), 2400);
    return () => window.clearInterval(timer);
  }, [visible]);

  return <div className={`warmup${visible ? "" : " done"}`} aria-hidden={!visible}>
    <div className="warmup-drift" />
    <p key={step} className="warmup-step" aria-live="polite">{STEPS[step % STEPS.length]}</p>
  </div>;
}
