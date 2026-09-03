import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * The tutor's routes, mounted on the dev server.
 *
 * An example that cannot plan a lesson is a screenshot, so the routes live here
 * rather than being left as an exercise. They load only when a key is set;
 * without one the page falls back to the lesson checked into `src/lesson.ts`,
 * so it still runs.
 */
function tutorRoutes(): Plugin {
  return {
    name: "ai-tutor-routes",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const path = request.url?.split("?")[0];
        if (!["/api/lesson", "/api/narration", "/api/followups", "/api/speech", "/api/hook", "/api/transcribe"].includes(path ?? "")) return next();
        if (!process.env.ANTHROPIC_API_KEY) {
          response.statusCode = 503;
          response.end("Set ANTHROPIC_API_KEY and restart. This example plans real lessons; there is nothing canned to fall back to.");
          return;
        }

        // Where the wait goes, written where it can be read without a browser
        // open. Every route is one of the four waits between a question and
        // the first frame, and the streaming one is timed to its first byte as
        // well as its last - that gap is the planner thinking.
        const startedAt = Date.now();
        const since = () => `${String(Date.now() - startedAt).padStart(6)}ms`;

        try {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(chunk as Buffer);
        const routes = await server.ssrLoadModule("/server.ts");
        // A recording arrives as bytes rather than as JSON, so its body is
        // passed through untouched and its own content type is kept.
        const raw = Buffer.concat(chunks);
        const incoming = path === "/api/transcribe"
          ? new Request(`http://localhost${request.url}`, {
              method: "POST",
              headers: { "content-type": request.headers["content-type"] ?? "audio/webm" },
              body: raw,
            })
          : new Request(`http://localhost${request.url}`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: raw.toString("utf8"),
            });

        const handle = path === "/api/lesson" ? routes.planLesson
          : path === "/api/narration" ? routes.narrateLesson
          : path === "/api/speech" ? routes.speakLine
          : path === "/api/hook" ? routes.hookLine
          : path === "/api/transcribe" ? routes.transcribeSpeech
          : routes.suggestFollowups;
        const result: Response = await handle(incoming);
        response.statusCode = result.status;
        result.headers.forEach((value, key) => response.setHeader(key, value));
        if (!result.body) {
          server.config.logger.info(`[ai-tutor] ${since()}  ${path}`);
          return void response.end();
        }

        // A planned lesson streams: the page appends each scene as it arrives
        // and plays the first one within seconds. Node holds small writes back
        // unless the headers are flushed and Nagle is off, which turns a
        // streaming response into one silent minute and then everything at
        // once - which is exactly how it behaved.
        response.setHeader("cache-control", "no-cache, no-transform");
        response.flushHeaders();
        response.socket?.setNoDelay(true);
        let firstChunk = true;
        for await (const chunk of result.body as unknown as AsyncIterable<Uint8Array>) {
          if (firstChunk) {
            firstChunk = false;
            server.config.logger.info(`[ai-tutor] ${since()}  ${path} first byte`);
          }
          response.write(chunk);
        }
        server.config.logger.info(`[ai-tutor] ${since()}  ${path} complete`);
        response.end();
        } catch (cause) {
          // A route that throws must not take the dev server with it: an
          // unhandled rejection here kills the process, and the page is left
          // talking to nothing with no clue why.
          const message = cause instanceof Error ? cause.message : String(cause);
          server.config.logger.error(`[ai-tutor] ${path} failed: ${message}`);
          if (!response.headersSent) response.statusCode = 500;
          response.end(message.slice(0, 300));
        }
      });
    },
  };
}

export default defineConfig({ plugins: [react(), tutorRoutes()] });
