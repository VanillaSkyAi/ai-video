import { runChatAcceptance } from "./journey";

const results = await runChatAcceptance();
for (const { id, report } of results) console.log(JSON.stringify({ id, ...report }));
if (results.some(({ report }) => !report.passed)) process.exitCode = 1;
