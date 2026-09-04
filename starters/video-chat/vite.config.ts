import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * The video chat's routes, mounted on the dev server.
 *
 * A starter that cannot plan a response is a screenshot, so the routes live here
 * rather than being left as an exercise. The required text-model key stays in
 * this server process; optional provider keys only unlock capabilities.
 */
function videoChatRoutes(): Plugin {
  return {
    name: "video-chat-routes",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const path = request.url?.split("?")[0];
        if (!["/api/capabilities", "/api/response", "/api/narration", "/api/suggestions", "/api/speech", "/api/opening", "/api/transcribe", "/api/welcome"].includes(path ?? "")) return next();
        if (path === "/api/capabilities") {
          response.setHeader("content-type", "application/json");
          response.end(JSON.stringify({
            generatedSpeech: Boolean(process.env.XAI_API_KEY),
            generatedVideo: Boolean(process.env.FAL_KEY),
            stockMedia: Boolean(process.env.PEXELS_API_KEY),
            transcription: Boolean(process.env.FAL_KEY),
          }));
          return;
        }
        // The welcome route degrades to brand gradients when Pexels is absent,
        // so the app can open cleanly before setup is complete. Every route
        // that generates text still fails closed behind the required key.
        if (!process.env.ANTHROPIC_API_KEY && path !== "/api/welcome") {
          response.statusCode = 503;
          response.end("Set ANTHROPIC_API_KEY and restart. This example plans real responses; there is nothing canned to fall back to.");
          return;
        }

        // Where the wait goes, written where it can be read without a browser
        // open. Every route is one of the four waits between a prompt and
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

        const handle = path === "/api/response" ? routes.generateResponse
          : path === "/api/narration" ? routes.narrateResponse
          : path === "/api/speech" ? routes.speakLine
          : path === "/api/opening" ? routes.openingLine
          : path === "/api/transcribe" ? routes.transcribeSpeech
          : path === "/api/welcome" ? routes.welcomeScreen
          : routes.suggestNextPrompts;
        const result: Response = await handle(incoming);
        response.statusCode = result.status;
        result.headers.forEach((value, key) => response.setHeader(key, value));
        if (!result.body) {
          server.config.logger.info(`[video-chat] ${since()}  ${path}`);
          return void response.end();
        }

        // A planned response streams: the page appends each scene as it arrives
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
            server.config.logger.info(`[video-chat] ${since()}  ${path} first byte`);
          }
          response.write(chunk);
        }
        server.config.logger.info(`[video-chat] ${since()}  ${path} complete`);
        response.end();
        } catch (cause) {
          // A route that throws must not take the dev server with it: an
          // unhandled rejection here kills the process, and the page is left
          // talking to nothing with no clue why.
          const message = cause instanceof Error ? cause.message : String(cause);
          server.config.logger.error(`[video-chat] ${path} failed: ${message}`);
          if (!response.headersSent) response.statusCode = 500;
          response.end(message.slice(0, 300));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const localEnvironment = loadEnv(mode, process.cwd(), "");
  for (const [name, value] of Object.entries(localEnvironment)) {
    process.env[name] ??= value;
  }
  return { plugins: [react(), videoChatRoutes()] };
});
