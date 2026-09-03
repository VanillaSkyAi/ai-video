/**
 * Print a whole lesson as text, without watching one.
 *
 *   npx tsx scripts/print-transcript.mjs "Why does the Moon show one face?"
 *
 * Runs the same three routes the page does, in the same order, against a dev
 * server on TUTOR_BASE (default http://localhost:5199). Judging a prompt one
 * scene at a time is how the opening line and the first scene ended up
 * answering the same question twice - a transcript shows it at a glance.
 */
import { transcribe, render } from "./transcript.mjs";
import { definitions } from "../vanillasky/index.ts";

// The tutor's own brief, read from source so this tests what ships.
const src = await import("../src/plan-lesson.ts");
const questions = process.argv.slice(2);
const capabilities = { templates: definitions.map((t) => t.id) };
for (const question of questions) {
  try {
    console.log(render(await transcribe(question, { instructions: src.plannerInstructions(0), capabilities })));
  } catch (cause) {
    console.log(`\nQ: ${question}\n  FAILED: ${cause.message}`);
  }
}
