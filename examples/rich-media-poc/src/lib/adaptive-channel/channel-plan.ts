import type {
  ChannelSegment,
  ChannelWorld,
  ManualMediaRoute,
  PlannedChannelScene,
  PlannedSegment,
} from "./types";

const MIN_SCENES = 2;
const MAX_SCENES = 5;

function clampSceneCount(sceneCount: number): number {
  return Math.max(MIN_SCENES, Math.min(MAX_SCENES, Math.round(sceneCount)));
}

function createWorld(premise: string): ChannelWorld {
  return {
    premise,
    visualStyle: "cinematic retro-futurist micro-drama, practical sets, rich color separation, subtle film grain",
    setting: "a remote late-night observatory above a stormy coast",
    characterBible: "Mara, 34, short black hair, mustard field jacket, silver over-ear headphones",
    continuityRules: [
      "Mara's face, hair, jacket, and headphones remain unchanged",
      "The observatory uses the same circular windows and amber analog instruments",
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
    beatId: "identity-pulse",
    headline: "One detail no longer matches.",
    description: "Mara notices the receiver pulsing in time with lightning beyond the window.",
    factuality: "fictional", motion: "optional", novelty: "high", continuityRole: "character",
    stockQuery: "radio operator night", framing: "medium close-up",
    camera: "locked composition with shallow depth of field",
    action: "Mara studies the receiver as a blue pulse reflects in her eyes.",
    lighting: "warm instrument light against cold lightning",
  },
  {
    beatId: "signal-answers",
    headline: "Then the signal answers.",
    description: "The receiver activates and Mara realizes the transmission is responding to her.",
    factuality: "fictional", motion: "essential", novelty: "high", continuityRole: "character",
    stockQuery: "vintage radio static", framing: "tight close-up moving to a medium shot",
    camera: "slow push in followed by a subtle orbit",
    action: "Static pulses, Mara freezes, then reaches for the tuning dial.",
    lighting: "amber dials, blue lightning, rhythmic cyan signal glow",
  },
  {
    beatId: "storm-exterior",
    headline: "The ordinary world keeps moving.",
    description: "Storm clouds gather around the isolated observatory while the night shift continues.",
    factuality: "fictional", motion: "optional", novelty: "low", continuityRole: "none",
    stockQuery: "storm observatory night", framing: "wide establishing shot", camera: "slow lateral drift",
    action: "Clouds move across the coast and one observatory window glows.",
    lighting: "deep blue storm light and a single amber window",
  },
  {
    beatId: "forecast-map",
    headline: "The forecast draws a path.",
    description: "A hand-drawn weather map reveals a perfect spiral centered on the observatory.",
    factuality: "fictional", motion: "optional", novelty: "high", continuityRole: "scene",
    stockQuery: "weather map desk", framing: "overhead insert", camera: "very slow push toward the map",
    action: "Condensation crawls across the paper in a precise spiral.", lighting: "amber desk lamp and cyan reflections",
  },
  {
    beatId: "locked-door",
    headline: "A door unlocks by itself.",
    description: "A sealed equipment room clicks open as the signal reaches its highest tone.",
    factuality: "fictional", motion: "essential", novelty: "high", continuityRole: "scene",
    stockQuery: "industrial door dark", framing: "low medium shot", camera: "controlled dolly toward the door",
    action: "Dust falls, the warning light flips from red to blue, and the heavy door opens a few centimeters.",
    lighting: "hard red practical light changing to cold cyan",
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
        { fromSec: 0, toSec: 2, action: "Static pulses in time with the lightning." },
        { fromSec: 2, toSec: 5, action: "Mara freezes, then slowly reaches for the tuning dial." },
      ] : undefined,
      sound: variant.motion === "essential"
        ? "distant thunder, analog static, one clear electronic tone"
        : "wind around the observatory and a quiet electrical hum",
    },
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
}): PlannedSegment {
  const sceneCount = clampSceneCount(input.sceneCount);
  const world = input.world || createWorld(input.premise.trim());
  const scenes: PlannedChannelScene[] = [];
  const storySceneCount = sceneCount - (input.sequence === 0 ? 1 : 0);
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
    if (input.sequence === 0 && index === 0) {
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
      input.overrides?.[index] || "auto",
      selectedBeats[storyIndex++]!,
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
