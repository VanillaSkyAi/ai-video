import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import type { StoreGeneratedMedia } from "./provider-adapters";

const DEFAULT_DIRECTORY = join(tmpdir(), "vanillasky-rich-media-poc");
const EXTENSION_BY_MEDIA_TYPE = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["video/mp4", ".mp4"],
  ["video/quicktime", ".mov"],
  ["video/webm", ".webm"],
]);
const MEDIA_TYPE_BY_EXTENSION = new Map(
  [...EXTENSION_BY_MEDIA_TYPE].map(([mediaType, extension]) => [extension, mediaType]),
);
const SAFE_FILENAME = /^[a-f0-9]{24}\.(?:jpg|png|webp|mp4|mov|webm)$/;

export interface LocalGeneratedMediaStore {
  readonly directory: string;
  readonly write: StoreGeneratedMedia;
}

export function createLocalGeneratedMediaStore(options: {
  directory?: string;
} = {}): LocalGeneratedMediaStore {
  const directory = options.directory || DEFAULT_DIRECTORY;
  return {
    directory,
    async write(input) {
      const extension = EXTENSION_BY_MEDIA_TYPE.get(input.mediaType);
      if (!extension) throw new Error(`Unsupported generated media type: ${input.mediaType}`);
      const digest = createHash("sha256")
        .update(input.kind)
        .update("\0")
        .update(input.idempotencyKey)
        .update("\0")
        .update(input.data)
        .digest("hex")
        .slice(0, 24);
      const filename = `${digest}${extension}`;
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, filename), input.data);
      return { url: `/api/channel-media/${filename}` };
    },
  };
}

function rangeFromHeader(header: string | null, length: number): {
  start: number;
  end: number;
} | undefined {
  if (!header) return undefined;
  const match = /^bytes=(\d+)-(\d*)$/.exec(header.trim());
  if (!match) return undefined;
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : length - 1;
  if (!Number.isInteger(start) || !Number.isInteger(requestedEnd) || start < 0 || start >= length || requestedEnd < start) {
    return undefined;
  }
  return { start, end: Math.min(requestedEnd, length - 1) };
}

export async function createLocalGeneratedMediaResponse(options: {
  directory?: string;
  filename: string;
  request: Request;
}): Promise<Response> {
  if (!SAFE_FILENAME.test(options.filename)) return new Response("Not found", { status: 404 });
  const mediaType = MEDIA_TYPE_BY_EXTENSION.get(extname(options.filename));
  if (!mediaType) return new Response("Not found", { status: 404 });

  let bytes: Uint8Array;
  try {
    bytes = await readFile(join(options.directory || DEFAULT_DIRECTORY, options.filename));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Response("Not found", { status: 404 });
    throw error;
  }

  const range = rangeFromHeader(options.request.headers.get("range"), bytes.byteLength);
  const body = range ? bytes.slice(range.start, range.end + 1) : bytes;
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "Content-Length": String(body.byteLength),
    "Content-Type": mediaType,
  });
  if (range) headers.set("Content-Range", `bytes ${range.start}-${range.end}/${bytes.byteLength}`);
  const responseBody = new Uint8Array(body.byteLength);
  responseBody.set(body);
  return new Response(responseBody.buffer, { status: range ? 206 : 200, headers });
}

export const localGeneratedMediaStore = createLocalGeneratedMediaStore();
