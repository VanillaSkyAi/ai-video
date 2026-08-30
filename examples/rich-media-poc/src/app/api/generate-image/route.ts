import { ImageGenerationError, generateSceneImage } from "../../../lib/image-generation";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const hostname = new URL(request.url).hostname;
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";
  if (process.env.VANILLASKY_LOCAL_DEMO !== "1" || !isLocalHost) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let prompt: unknown;
  try {
    ({ prompt } = await request.json() as { prompt?: unknown });
  } catch {
    return Response.json({ error: "Send a JSON body with an image prompt." }, { status: 400 });
  }

  try {
    const generated = await generateSceneImage(typeof prompt === "string" ? prompt : "", {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_IMAGE_MODEL,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]),
    });
    return Response.json(generated, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ImageGenerationError) {
      const status = error.code === "invalid_prompt"
        ? 400
        : error.code === "missing_configuration" ? 503 : 502;
      return Response.json({ error: error.message }, { status });
    }
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return Response.json({ error: "Image generation timed out. Try again." }, { status: 504 });
    }
    return Response.json({ error: "Image generation failed. Try again." }, { status: 502 });
  }
}
