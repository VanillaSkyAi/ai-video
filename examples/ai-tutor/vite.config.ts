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
        if (!["/api/lesson", "/api/narration", "/api/followups", "/api/speech"].includes(path ?? "")) return next();
        if (!process.env.ANTHROPIC_API_KEY) {
          response.statusCode = 503;
          response.end("Set ANTHROPIC_API_KEY and restart. This example plans real lessons; there is nothing canned to fall back to.");
          return;
        }

        try {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(chunk as Buffer);
        const routes = await server.ssrLoadModule("/server.ts");
        const incoming = new Request(`http://localhost${request.url}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: Buffer.concat(chunks).toString("utf8"),
        });

        const handle = path === "/api/lesson" ? routes.planLesson
          : path === "/api/narration" ? routes.narrateLesson
          : path === "/api/speech" ? routes.speakLine
          : routes.suggestFollowups;
        const result: Response = await handle(incoming);
        response.statusCode = result.status;
        result.headers.forEach((value, key) => response.setHeader(key, value));
        if (!result.body) return void response.end();

        // A planned lesson streams: the page appends each scene as it arrives
        // and plays the first one within seconds. Node holds small writes back
        // unless the headers are flushed and Nagle is off, which turns a
        // streaming response into one silent minute and then everything at
        // once - which is exactly how it behaved.
        response.setHeader("cache-control", "no-cache, no-transform");
        response.flushHeaders();
        response.socket?.setNoDelay(true);
        for await (const chunk of result.body as unknown as AsyncIterable<Uint8Array>) {
          response.write(chunk);
        }
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
