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
        if (path !== "/api/lesson" && path !== "/api/narration") return next();
        if (!process.env.ANTHROPIC_API_KEY) {
          response.statusCode = 503;
          response.end("Set ANTHROPIC_API_KEY and restart. This example plans real lessons; there is nothing canned to fall back to.");
          return;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(chunk as Buffer);
        const { planLesson, narrateLesson } = await server.ssrLoadModule("/server.ts");
        const incoming = new Request(`http://localhost${request.url}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: Buffer.concat(chunks).toString("utf8"),
        });

        const result: Response = path === "/api/lesson"
          ? await planLesson(incoming)
          : await narrateLesson(incoming);
        response.statusCode = result.status;
        result.headers.forEach((value, key) => response.setHeader(key, value));
        if (!result.body) return void response.end();
        for await (const chunk of result.body as unknown as AsyncIterable<Uint8Array>) response.write(chunk);
        response.end();
      });
    },
  };
}

export default defineConfig({ plugins: [react(), tutorRoutes()] });
