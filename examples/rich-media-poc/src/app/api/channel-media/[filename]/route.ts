import { createLocalGeneratedMediaResponse } from "../../../../lib/adaptive-channel/local-media-store";

export const runtime = "nodejs";

function isLocalRequest(request: Request): boolean {
  const hostname = new URL(request.url).hostname;
  return process.env.VANILLASKY_LOCAL_DEMO === "1"
    && (hostname === "localhost" || hostname === "127.0.0.1");
}

export async function GET(
  request: Request,
  context: { params: Promise<{ filename: string }> },
): Promise<Response> {
  if (!isLocalRequest(request)) return new Response("Forbidden", { status: 403 });
  const { filename } = await context.params;
  return createLocalGeneratedMediaResponse({ filename, request });
}
