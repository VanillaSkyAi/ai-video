const DEFAULT_MODEL = "gpt-image-2";
const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations";

interface OpenAIImageResponse {
  data?: Array<{ b64_json?: string; url?: string }>;
}

export class ImageGenerationError extends Error {
  constructor(
    message: string,
    readonly code: "invalid_prompt" | "missing_configuration" | "provider_failure",
  ) {
    super(message);
    this.name = "ImageGenerationError";
  }
}

export interface GenerateSceneImageOptions {
  apiKey?: string;
  model?: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export async function generateSceneImage(
  prompt: string,
  options: GenerateSceneImageOptions,
): Promise<{ imageUrl: string; model: string }> {
  const normalizedPrompt = prompt.trim();
  if (normalizedPrompt.length < 3 || normalizedPrompt.length > 300) {
    throw new ImageGenerationError(
      "Describe the image in 3 to 300 characters.",
      "invalid_prompt",
    );
  }
  if (!options.apiKey) {
    throw new ImageGenerationError(
      "Set OPENAI_API_KEY on the server to generate a new image.",
      "missing_configuration",
    );
  }

  const model = options.model?.trim() || DEFAULT_MODEL;
  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(OPENAI_IMAGES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: [
          "Create a premium portrait video scene background.",
          normalizedPrompt,
          "No words, letters, logos, watermarks, borders, or UI chrome.",
          "Leave useful negative space for overlaid video copy.",
        ].join(" "),
        size: "1024x1536",
        quality: "low",
        output_format: "webp",
      }),
      signal: options.signal,
    });
  } catch (error) {
    if (
      error instanceof DOMException
      && (error.name === "AbortError" || error.name === "TimeoutError")
    ) throw error;
    throw new ImageGenerationError("Image generation failed. Try again.", "provider_failure");
  }

  if (!response.ok) {
    throw new ImageGenerationError("Image generation failed. Try again.", "provider_failure");
  }

  let result: OpenAIImageResponse;
  try {
    result = await response.json() as OpenAIImageResponse;
  } catch {
    throw new ImageGenerationError("Image generation failed. Try again.", "provider_failure");
  }

  const first = result.data?.[0];
  const imageUrl = first?.b64_json
    ? `data:image/webp;base64,${first.b64_json}`
    : first?.url;
  if (!imageUrl) {
    throw new ImageGenerationError("Image generation failed. Try again.", "provider_failure");
  }

  return { imageUrl, model };
}
