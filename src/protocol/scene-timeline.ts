import { checksumVideo } from "./checksum.js";
import { createVideoEventFactory, type VideoEvent } from "./events.js";
import {
  VIDEO_SCHEMA_VERSION,
  type Video,
  type VideoAudio,
  type VideoOrientation,
  type VideoScene,
  type VideoStyle,
} from "./types.js";

/**
 * Compose a playable video from scenes the host builds itself.
 *
 * `VideoInput.opening` is a single line of copy, so an application that wants
 * several scenes of its own before the generated ones has nowhere to put them.
 * Handing the player a fresh `video` prop is not an answer either: that resets
 * playback to zero on every change, so a video that grows replays its opening
 * each time something is appended. The player's `stream` prop appends, and this
 * builds a stream.
 *
 * The reason it belongs here rather than in each application is that the
 * envelope rules are exact and their failure is silent. `response.start` must
 * be sequence zero, every event exactly one higher, `eventId` exactly
 * `${runId}:${sequence}`, `scene.add.position` the index the scene lands at,
 * and the completion snapshot must reproduce what the reducer built. Miss any
 * one and the whole stream is rejected: the player renders nothing, and the
 * console stays clean.
 */
export interface SceneTimeline {
  /**
   * Hand this to the player's `stream` prop once. Never swap it: a new stream
   * is a new video, and playback restarts.
   */
  stream: AsyncIterable<VideoEvent>;
  /** Append a scene. Ignored once the timeline has completed. */
  add(scene: VideoScene): void;
  /**
   * Say what the soundtrack is, or that there is none.
   *
   * Only meaningful with `awaitAudio`, where it releases the scenes held back
   * while the track was unknown. Calling it twice, or after the first scene has
   * been emitted, does nothing.
   */
  setAudio(audio: VideoAudio | undefined): void;
  /** Finish the video. Safe to call more than once. */
  complete(): void;
}

export interface SceneTimelineOptions {
  style: VideoStyle;
  orientation?: VideoOrientation;
  /**
   * The soundtrack, when it is already known.
   *
   * Use `awaitAudio` instead when it is resolved by a request that has not
   * answered yet.
   */
  audio?: VideoAudio;
  /**
   * Hold scenes until `setAudio` is called.
   *
   * `audio.set` is only valid before the first scene, so a timeline that opens
   * with host-built scenes cannot add a soundtrack afterwards - the event
   * arrives too late and the video plays silently, with nothing to show for it.
   * Holding the openings costs the wait for the track to resolve, not the wait
   * for the video to be planned.
   */
  awaitAudio?: boolean;
  requestId?: string;
  runId?: string;
}

function createQueue<T>() {
  const buffered: T[] = [];
  const waiting: Array<(result: IteratorResult<T>) => void> = [];
  let closed = false;
  return {
    push(value: T) {
      const next = waiting.shift();
      if (next) next({ value, done: false });
      else buffered.push(value);
    },
    close() {
      closed = true;
      let next = waiting.shift();
      while (next) {
        next({ value: undefined as never, done: true });
        next = waiting.shift();
      }
    },
    iterable: {
      [Symbol.asyncIterator]() {
        return {
          next(): Promise<IteratorResult<T>> {
            const buffer = buffered.shift();
            if (buffer !== undefined) return Promise.resolve({ value: buffer, done: false });
            if (closed) return Promise.resolve({ value: undefined as never, done: true });
            return new Promise((resolve) => waiting.push(resolve));
          },
        };
      },
    } as AsyncIterable<T>,
  };
}

let runCounter = 0;

export function createSceneTimeline(options: SceneTimelineOptions): SceneTimeline {
  const queue = createQueue<VideoEvent>();
  const runId = options.runId ?? `composed-${(runCounter += 1)}`;
  const events = createVideoEventFactory({ runId });
  const orientation = options.orientation ?? "landscape";

  // Mirrors what the reducer builds, so the completion snapshot matches it.
  const snapshot: Video = {
    schemaVersion: VIDEO_SCHEMA_VERSION,
    orientation,
    scenes: [],
    style: options.style,
  };

  let position = 0;
  let finished = false;
  const held: VideoScene[] = [];
  let openForScenes = !options.awaitAudio;

  const emit = (event: VideoEvent) => {
    if (finished) return;
    queue.push(event);
  };

  emit(events.create("response.start", {
    requestId: options.requestId ?? runId,
    format: { orientation },
    style: options.style,
  }));
  if (options.audio) {
    snapshot.audio = options.audio;
    emit(events.create("audio.set", { audio: options.audio }));
  }

  const release = () => {
    const pending = held.splice(0, held.length);
    for (const scene of pending) {
      snapshot.scenes.push(scene);
      emit(events.create("scene.add", { scene, position: position++ }));
    }
  };

  return {
    stream: queue.iterable,
    add(scene) {
      if (finished) return;
      if (!openForScenes) {
        held.push(scene);
        return;
      }
      snapshot.scenes.push(scene);
      emit(events.create("scene.add", { scene, position: position++ }));
    },
    setAudio(audio) {
      if (finished || openForScenes) return;
      if (audio) {
        snapshot.audio = audio;
        emit(events.create("audio.set", { audio }));
      }
      openForScenes = true;
      release();
    },
    complete() {
      if (finished) return;
      // A run that ends before its soundtrack resolves never says what the
      // track is; its held scenes still belong in the video rather than
      // nowhere.
      if (!openForScenes) {
        openForScenes = true;
        release();
      }
      emit(events.create("response.complete", {
        finishReason: "stop",
        snapshot,
        checksum: checksumVideo(snapshot),
      }));
      finished = true;
      queue.close();
    },
  };
}
