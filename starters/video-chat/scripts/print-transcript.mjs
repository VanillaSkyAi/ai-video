/**
 * Print a whole response as text, without watching one.
 *
 *   npx tsx scripts/print-transcript.mjs "Why does the Moon show one face?"
 *
 * Runs the same three routes the page does, in the same order, against a dev
 * server on VIDEO_CHAT_BASE (default http://localhost:5199). Judging a prompt one
 * scene at a time is how the opening line and the first scene ended up
 * responding the same prompt twice - a transcript shows it at a glance.
 */
import { transcribe, render } from "./transcript.mjs";

const prompts = process.argv.slice(2);
for (const prompt of prompts) {
  try {
    console.log(render(await transcribe(prompt)));
  } catch (cause) {
    console.log(`\nQ: ${prompt}\n  FAILED: ${cause.message}`);
  }
}
