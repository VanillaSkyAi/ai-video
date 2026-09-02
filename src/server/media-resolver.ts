import type {
  VideoInput,
  VideoPlanner,
  VideoPlanPart,
  VideoScene,
} from "../protocol/types.js";
import type { ServerTemplateRegistry } from "../visual-system/catalog/server-kit.js";
import {
  getStandardMediaResolverContract,
  type StandardMediaResolverContract,
} from "../visual-system/catalog/media-resolver-contract.js";
import { MAX_RETAINED_MEDIA_URL_LENGTH } from "../protocol/persistence.js";

const MAX_MEDIA_QUERY_CHARACTERS = 80;
const MAX_MEDIA_QUERY_WORDS = 8;

export interface ResolvedMedia {
  url: string;
  type: "image" | "video";
  posterUrl?: string;
}

export interface MediaResolverContext {
  input: VideoInput;
  requestId: string;
  scene: Readonly<VideoScene>;
  templateId: string;
  preferredType: "image" | "video" | "any";
  /**
   * The visual language generated media must match, when the application set
   * one. Append it to a provider prompt; a shot that ignores it is the
   * mismatch this exists to prevent.
   */
  generatedLook?: string;
  signal: AbortSignal;
}

export type MediaResolver = (
  query: string,
  context: MediaResolverContext,
) => ResolvedMedia | null | Promise<ResolvedMedia | null>;

function queryIsBounded(query: string): boolean {
  const length = [...query].length;
  const words = query.match(/\S+/gu)?.length ?? 0;
  return length >= 2 && length <= MAX_MEDIA_QUERY_CHARACTERS && words <= MAX_MEDIA_QUERY_WORDS;
}

function preferredType(value: unknown): MediaResolverContext["preferredType"] {
  if (value === "photo") return "image";
  if (value === "video") return "video";
  return "any";
}

function cleanUrl(value: unknown, field: string): string | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string" || !value.trim() || value.length > MAX_RETAINED_MEDIA_URL_LENGTH) {
    throw new Error(`Resolved media ${field} is invalid`);
  }
  return value.trim();
}

function fallbackVariables(
  variables: Record<string, unknown>,
): Record<string, unknown> {
  const fallback = { ...variables };
  delete fallback.mediaKeyword;
  delete fallback.mediaUrl;
  delete fallback.mediaPoster;
  fallback.mediaType = "gradient";
  return fallback;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function resolveVariables(options: {
  variables: Record<string, unknown>;
  requestId: string;
  scene: VideoScene;
  contract?: StandardMediaResolverContract;
  input: VideoInput;
  templateId: string;
  signal: AbortSignal;
  resolveMedia?: MediaResolver;
  approveUrl: (input: VideoInput, url: string) => void;
  openingReady: boolean;
}): Promise<Record<string, unknown>> {
  if (!Object.hasOwn(options.variables, "mediaKeyword")) return options.variables;

  const variables = { ...options.variables };
  const rawQuery = typeof variables.mediaKeyword === "string"
    ? variables.mediaKeyword.trim()
    : "";
  delete variables.mediaKeyword;
  if (!options.contract) return variables;
  if (!options.openingReady || !options.resolveMedia || !queryIsBounded(rawQuery)) {
    return fallbackVariables(variables);
  }

  let resolved: ResolvedMedia | null;
  try {
    resolved = await options.resolveMedia(rawQuery, {
      input: options.input,
      requestId: options.requestId,
      scene: { ...options.scene, variables },
      templateId: options.templateId,
      preferredType: preferredType(variables.mediaType),
      generatedLook: options.input.style?.generatedLook,
      signal: options.signal,
    });
  } catch (error) {
    if (options.signal.aborted) throw options.signal.reason ?? error;
    if (isAbortError(error)) throw error;
    return fallbackVariables(variables);
  }
  if (options.signal.aborted) {
    throw options.signal.reason ?? new DOMException("The media request was aborted", "AbortError");
  }
  if (!resolved) return fallbackVariables(variables);
  if (resolved.type !== "image" && resolved.type !== "video") {
    throw new Error("Resolved media type is invalid");
  }
  const url = cleanUrl(resolved.url, "URL");
  if (!url) throw new Error("Resolved media URL is required");
  const posterUrl = options.contract.acceptsPoster
    ? cleanUrl(resolved.posterUrl, "poster URL")
    : undefined;
  options.approveUrl(options.input, url);
  if (posterUrl) options.approveUrl(options.input, posterUrl);
  variables.mediaUrl = url;
  variables.mediaType = resolved.type === "image" ? "photo" : "video";
  if (posterUrl) variables.mediaPoster = posterUrl;
  else delete variables.mediaPoster;
  return variables;
}

function templateContract(
  templates: ServerTemplateRegistry,
  templateId: string,
): StandardMediaResolverContract | undefined {
  const metadata = templates.getTemplateMetadata(templateId);
  return metadata == null
    ? undefined
    : getStandardMediaResolverContract(metadata.schema);
}

function withoutKeyword(variables: Record<string, unknown>): Record<string, unknown> {
  if (!Object.hasOwn(variables, "mediaKeyword")) return variables;
  const clean = { ...variables };
  delete clean.mediaKeyword;
  return clean;
}

function sanitizeUnknownTemplatePart(part: VideoPlanPart): VideoPlanPart {
  if (part.type === "scene.add") {
    return { ...part, scene: { ...part.scene, variables: withoutKeyword(part.scene.variables) } };
  }
  return part;
}

async function resolvePartVariables(options: {
  part: VideoPlanPart;
  requestId: string;
  templateId?: string;
  input: VideoInput;
  signal: AbortSignal;
  templates: ServerTemplateRegistry;
  resolveMedia?: MediaResolver;
  approveUrl: (input: VideoInput, url: string) => void;
  openingReady: boolean;
}): Promise<VideoPlanPart> {
  if (!options.templateId) return sanitizeUnknownTemplatePart(options.part);
  const shared = {
    contract: templateContract(options.templates, options.templateId),
    input: options.input,
    templateId: options.templateId,
    signal: options.signal,
    resolveMedia: options.resolveMedia,
    approveUrl: options.approveUrl,
    openingReady: options.openingReady,
  };
  if (options.part.type === "scene.add") {
    const variables = await resolveVariables({
      ...shared,
      requestId: options.requestId,
      scene: options.part.scene,
      variables: options.part.scene.variables,
    });
    return { ...options.part, scene: { ...options.part.scene, variables } };
  }
  return options.part;
}

export function createMediaResolvingPlanner(options: {
  planner: VideoPlanner;
  templates: ServerTemplateRegistry;
  resolveMedia?: MediaResolver;
  approveUrl: (input: VideoInput, url: string) => void;
  isOpeningReady: (input: VideoInput) => boolean;
  /**
   * How many scenes may have media in flight at once.
   *
   * One - the default - resolves strictly in turn, which is invisible when
   * media is searched for and costly when it is generated: a stock photo takes
   * a couple of hundred milliseconds, a generated clip takes seconds, and five
   * of those in a row is half a minute of nothing. Raising this overlaps the
   * waiting without reordering anything.
   */
  mediaConcurrency?: number;
  /**
   * Whether this part is the one that makes the opening ready.
   *
   * The flag is normally set downstream, while a scene is validated, and read
   * on the next scene. That works when parts are resolved strictly in turn.
   * Once several are in flight the downstream write has not happened yet, so
   * the same rule has to be answered from the parts themselves.
   */
  marksOpeningReady?: (part: VideoPlanPart) => boolean;
}): VideoPlanner {
  const limit = Math.max(1, Math.floor(options.mediaConcurrency ?? 1));

  return async function* resolveMediaPlan(context) {
    const resolveOne = (part: VideoPlanPart, openingReady?: boolean) => resolvePartVariables({
      part,
      requestId: context.request.requestId,
      templateId: part.type === "scene.add" ? part.scene.templateId : undefined,
      input: context.request.input,
      signal: context.signal,
      templates: options.templates,
      resolveMedia: options.resolveMedia,
      approveUrl: options.approveUrl,
      openingReady: openingReady ?? options.isOpeningReady(context.request.input),
    });

    if (limit === 1) {
      for await (const part of options.planner(context)) yield await resolveOne(part);
      return;
    }

    // Tracked here rather than read from downstream, which has not seen these
    // parts yet. The opening still resolves no media: it has to appear without
    // waiting on a round trip.
    let openingReady = options.isOpeningReady(context.request.input);

    // Parts are resolved as they arrive but yielded in order, so a slow scene
    // delays only itself rather than everything planned after it. The queue is
    // bounded, so a planner that runs ahead cannot start unlimited work.
    const pending: Array<Promise<VideoPlanPart>> = [];
    for await (const part of options.planner(context)) {
      pending.push(resolveOne(part, openingReady));
      if (!openingReady && options.marksOpeningReady?.(part) === true) openingReady = true;
      while (pending.length >= limit) yield await pending.shift()!;
    }
    while (pending.length > 0) yield await pending.shift()!;
  };
}
