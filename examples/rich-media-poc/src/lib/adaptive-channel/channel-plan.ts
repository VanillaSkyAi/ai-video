import type {
  ChannelSegment,
  ChannelStoryOutline,
  ChannelWorld,
  ManualMediaRoute,
  PlannedChannelScene,
  PlannedSegment,
} from "./types";

const MIN_SCENES = 2;
const MAX_SCENES = 5;
const FIVE_SCENE_POC_ROUTES: readonly ManualMediaRoute[] = [
  "video",
  "video",
  "video",
  "video",
  "video",
];

function clampSceneCount(sceneCount: number): number {
  return Math.max(MIN_SCENES, Math.min(MAX_SCENES, Math.round(sceneCount)));
}

function createWorld(premise: string): ChannelWorld {
  return {
    premise,
    visualStyle: "cinematic retro-futurist micro-drama, practical sets, rich color separation, subtle film grain",
    setting: `the primary setting, period, and atmosphere implied by this story: ${premise}`,
    characterBible: "the same principal character established in the first generated image, with an unchanged face, age, hair, wardrobe, and silhouette",
    continuityRules: [
      "Preserve the principal character exactly whenever that character appears",
      "Preserve established production design, geography, palette, and lighting logic",
      "No logos or readable text",
    ],
  };
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 36) || "scene";
}

type StoryBeat = Omit<PlannedChannelScene, "id" | "manualRoute" | "durationSec" | "shot"> & {
  framing: string;
  camera: string;
  action: string;
  lighting: string;
};

const STORY_BEATS: StoryBeat[] = [
  {
    beatId: "protagonist-reveal",
    headline: "Enter the world.",
    description: "An iconic opening portrait establishes the principal character and the world described by the story prompt.",
    factuality: "fictional", motion: "optional", novelty: "high", continuityRole: "character",
    stockQuery: "cinematic character portrait", framing: "cinematic medium portrait",
    camera: "locked composition with shallow depth of field",
    action: "The principal character holds a clear, emotionally charged pose that establishes who they are.",
    lighting: "motivated cinematic key light with strong color separation",
  },
  {
    beatId: "inciting-action",
    headline: "Something changes.",
    description: "The inciting action from the story prompt happens and the principal character reacts.",
    factuality: "fictional", motion: "essential", novelty: "high", continuityRole: "character",
    stockQuery: "cinematic dramatic action", framing: "close-up moving to a medium shot",
    camera: "slow push in followed by a subtle orbit",
    action: "The principal character notices the story's impossible event, freezes, and takes one decisive physical action.",
    lighting: "the established scene lighting intensifies around the event",
  },
  {
    beatId: "consequence-reveal",
    headline: "The evidence appears.",
    description: "A striking object, location, or visual clue reveals the consequence of the story's central event, with no person in frame.",
    factuality: "fictional", motion: "optional", novelty: "high", continuityRole: "none",
    stockQuery: "cinematic mysterious object reveal", framing: "wide environmental or macro reveal", camera: "locked dramatic composition",
    action: "The visual clue sits at the center of the frame and makes the story's stakes immediately legible.",
    lighting: "high-contrast motivated light that matches the established palette",
  },
  {
    beatId: "cliffhanger-motion",
    headline: "Now it cannot be undone.",
    description: "The revealed clue activates or transforms, ending the story on a clear visual cliffhanger.",
    factuality: "fictional", motion: "essential", novelty: "high", continuityRole: "scene",
    stockQuery: "cinematic object transformation", framing: "the same composition as the reveal", camera: "slow controlled push toward the clue",
    action: "The central clue activates, changes state, and causes one final unexpected movement before cutting away.", lighting: "the established light shifts toward one intense accent color",
  },
  {
    beatId: "decisive-aftermath",
    headline: "The choice arrives.",
    description: "The final consequence of the story forces one decisive reaction and leaves a striking visual question behind.",
    factuality: "fictional", motion: "essential", novelty: "high", continuityRole: "none",
    stockQuery: "cinematic decisive aftermath", framing: "dynamic wide shot resolving into a close detail", camera: "controlled tracking move ending on the final clue",
    action: "The consequence reaches its peak, the world responds, and one last unexpected detail changes the meaning of what happened.",
    lighting: "the established palette reaches its strongest contrast before falling into shadow",
  },
  {
    beatId: "second-voice",
    headline: "A second voice enters the static.",
    description: "Mara hears her own voice answer from several seconds in the future.",
    factuality: "fictional", motion: "essential", novelty: "high", continuityRole: "character",
    stockQuery: "woman headphones radio", framing: "profile close-up", camera: "slow arc around Mara",
    action: "Mara removes one headphone as the delayed voice repeats her movement.",
    lighting: "cyan edge light and soft amber skin tone",
  },
  {
    beatId: "coast-lights",
    headline: "The coast answers in sequence.",
    description: "Lights along the dark shoreline blink in the same pattern as the radio signal.",
    factuality: "fictional", motion: "optional", novelty: "low", continuityRole: "none",
    stockQuery: "coast lights storm night", framing: "wide coastal vista", camera: "slow aerial drift",
    action: "Distant harbor lights blink one after another toward the observatory.", lighting: "moonless blue night",
  },
  {
    beatId: "hidden-reel",
    headline: "The machine has recorded this before.",
    description: "An old reel-to-reel starts playing a tape dated decades before Mara was born.",
    factuality: "fictional", motion: "essential", novelty: "high", continuityRole: "scene",
    stockQuery: "reel tape machine", framing: "macro insert to medium reveal", camera: "rack focus from tape to Mara",
    action: "The reels accelerate and a strip of tape pulls itself through the machine.", lighting: "dusty tungsten with cyan pulse",
  },
  {
    beatId: "power-cut",
    headline: "Everything goes dark—except the signal.",
    description: "The observatory loses power while the receiver continues glowing without a cable.",
    factuality: "fictional", motion: "essential", novelty: "high", continuityRole: "character",
    stockQuery: "power outage control room", framing: "wide interior moving to close-up", camera: "quick blackout then slow push",
    action: "Every lamp dies; Mara turns and the receiver floats in a pool of cyan light.", lighting: "blackout with a single cyan source",
  },
  {
    beatId: "first-light",
    headline: "Dawn arrives in the wrong direction.",
    description: "A thin sunrise appears over the western sea exactly as the impossible forecast predicted.",
    factuality: "fictional", motion: "optional", novelty: "high", continuityRole: "none",
    stockQuery: "sunrise storm coast", framing: "epic wide shot", camera: "slow crane above the observatory roof",
    action: "Clouds split and a narrow band of gold rises over the western horizon.", lighting: "cold storm blue pierced by warm gold",
  },
];

const OPEN_THREADS = [
  "Who sent the forecast?",
  "Why does the signal know Mara?",
  "What is hidden behind the sealed door?",
  "Why has the observatory recorded this before?",
  "What happens when the impossible dawn arrives?",
];

function hash(value: string): number {
  let result = 0;
  for (const character of value) result = (result * 31 + character.charCodeAt(0)) >>> 0;
  return result;
}

function sceneFor(sequence: number, index: number, manualRoute: ManualMediaRoute, variant: StoryBeat): PlannedChannelScene {
  return {
    id: `s${sequence}-${index}-${slug(variant.headline)}`,
    beatId: variant.beatId,
    headline: variant.headline,
    description: variant.description,
    factuality: variant.factuality,
    motion: variant.motion,
    novelty: variant.novelty,
    continuityRole: variant.continuityRole,
    manualRoute,
    stockQuery: variant.stockQuery,
    durationSec: 5,
    shot: {
      framing: variant.framing,
      camera: variant.camera,
      action: variant.action,
      lighting: variant.lighting,
      beats: variant.motion === "essential" ? [
        { fromSec: 0, toSec: 2, action: "Hold the supplied opening frame, then begin the first subtle movement." },
        { fromSec: 2, toSec: 5, action: variant.action },
      ] : undefined,
      sound: variant.motion === "essential"
        ? "a restrained cinematic rise ending on one clear impact"
        : "quiet environmental atmosphere",
    },
  };
}

function defaultMediaRoute(sequence: number, sceneCount: number, index: number): ManualMediaRoute {
  return sequence === 0 && sceneCount === FIVE_SCENE_POC_ROUTES.length
    ? FIVE_SCENE_POC_ROUTES[index]!
    : "auto";
}

function planFromOutline(input: {
  premise: string;
  sequence: number;
  sceneCount: number;
  outline: ChannelStoryOutline;
  overrides?: Partial<Record<number, ManualMediaRoute>>;
}): PlannedSegment {
  if (input.outline.scenes.length !== input.sceneCount) {
    throw new Error(`Story outline must contain exactly ${input.sceneCount} scenes.`);
  }
  const world: ChannelWorld = {
    premise: input.premise.trim(),
    visualStyle: input.outline.visualStyle,
    setting: input.outline.setting,
    characterBible: input.outline.characterBible,
    continuityRules: input.outline.continuityRules,
  };
  const factuality = input.outline.contentType === "fictional-narrative" ? "fictional" : "factual";
  const scenes = input.outline.scenes.map((scene, index): PlannedChannelScene => ({
    id: `s${input.sequence}-${index}-${slug(scene.headline)}`,
    beatId: `planned-${index + 1}-${slug(scene.headline)}`,
    headline: scene.headline,
    description: scene.description,
    factuality,
    motion: "essential",
    novelty: "high",
    continuityRole: "none",
    manualRoute: input.overrides?.[index] || defaultMediaRoute(input.sequence, input.sceneCount, index),
    stockQuery: scene.description,
    durationSec: 5,
    shot: {
      framing: scene.framing,
      camera: scene.camera,
      action: scene.action,
      lighting: scene.lighting,
      sound: scene.sound,
    },
  }));
  const recentBeatIds = scenes.flatMap((scene) => scene.beatId ? [scene.beatId] : []);

  return {
    sequence: input.sequence,
    world,
    scenes,
    summary: `Chapter ${input.sequence + 1}: ${scenes.map(({ headline }) => headline).join(" ")}`,
    recentBeatIds: recentBeatIds.slice(-8),
    openThreads: [],
  };
}

export function planChannelSegment(input: {
  premise: string;
  sceneCount: number;
  sequence: number;
  world?: ChannelWorld;
  previousSummary?: string;
  recentBeatIds?: readonly string[];
  openThreads?: readonly string[];
  overrides?: Partial<Record<number, ManualMediaRoute>>;
  outline?: ChannelStoryOutline;
}): PlannedSegment {
  const sceneCount = clampSceneCount(input.sceneCount);
  if (input.outline) {
    return planFromOutline({
      premise: input.premise,
      sequence: input.sequence,
      sceneCount,
      outline: input.outline,
      overrides: input.overrides,
    });
  }
  const isFiveSceneTextToVideoPoc = input.sequence === 0
    && sceneCount === FIVE_SCENE_POC_ROUTES.length;
  const world = input.world || createWorld(input.premise.trim());
  const scenes: PlannedChannelScene[] = [];
  const storySceneCount = sceneCount - (input.sequence === 0 && !isFiveSceneTextToVideoPoc ? 1 : 0);
  const recent = new Set(input.recentBeatIds || []);
  let available = STORY_BEATS.filter(({ beatId }) => beatId && !recent.has(beatId));
  if (available.length < storySceneCount) {
    const lastTwo = new Set((input.recentBeatIds || []).slice(-2));
    available = STORY_BEATS.filter(({ beatId }) => beatId && !lastTwo.has(beatId));
  }
  const firstChapter = STORY_BEATS.slice(0, storySceneCount);
  const offset = available.length > 0
    ? (hash(input.previousSummary || world.premise) + input.sequence) % available.length
    : 0;
  const selectedBeats = input.sequence === 0
    ? firstChapter
    : Array.from({ length: storySceneCount }, (_, index) => available[(offset + index) % available.length]!);
  let storyIndex = 0;
  for (let index = 0; index < sceneCount; index += 1) {
    if (input.sequence === 0 && index === 0 && !isFiveSceneTextToVideoPoc) {
      scenes.push({
        id: "channel-trailer",
        headline: world.premise,
        description: "A deterministic title card introduces the world before remote media is needed.",
        factuality: "fictional",
        motion: "none",
        novelty: "low",
        continuityRole: "none",
        manualRoute: input.overrides?.[index] || "gradient",
        stockQuery: "",
        durationSec: 3,
        shot: {
          framing: "title card",
          camera: "static",
          action: "White editorial type appears over black.",
          lighting: "black background",
        },
      });
      continue;
    }
    scenes.push(sceneFor(
      input.sequence,
      index,
      input.overrides?.[index] || defaultMediaRoute(input.sequence, sceneCount, index),
      isFiveSceneTextToVideoPoc
        ? { ...selectedBeats[storyIndex++]!, continuityRole: "none" }
        : selectedBeats[storyIndex++]!,
    ));
  }

  const usedBeatIds = scenes.flatMap((scene) => scene.beatId ? [scene.beatId] : []);
  const recentBeatIds = [...(input.recentBeatIds || []), ...usedBeatIds].slice(-8);
  const currentThreads = input.openThreads?.length ? [...input.openThreads] : OPEN_THREADS.slice(0, 2);
  const nextThread = OPEN_THREADS[(hash(input.previousSummary || world.premise) + input.sequence) % OPEN_THREADS.length]!;
  const openThreads = [...currentThreads.slice(input.sequence > 0 ? 1 : 0), nextThread]
    .filter((thread, index, all) => all.indexOf(thread) === index)
    .slice(-3);

  return {
    sequence: input.sequence,
    world,
    scenes,
    summary: `Chapter ${input.sequence + 1}: ${scenes.map(({ headline }) => headline).join(" ")}`,
    recentBeatIds,
    openThreads,
  };
}

export function appendBoundedSegment(
  queue: readonly ChannelSegment[],
  segment: ChannelSegment,
  limit = 2,
): ChannelSegment[] {
  return [...queue, segment].slice(-Math.max(1, limit));
}
