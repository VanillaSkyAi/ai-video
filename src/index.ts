export type {
  Video,
  VideoAudio,
  VideoBackground,
  VideoBrand,
  VideoBrandInput,
  VideoInput,
  VideoKnowledgeMode,
  VideoOrientation,
  VideoScene,
  VideoStyle,
  VideoStyleOptions,
  VideoSuppliedMedia,
} from "./protocol/types.js";
export type {
  VideoStatus,
} from "./protocol/state.js";
export { VideoValidationError } from "./protocol/persistence.js";
export { getVideoDuration } from "./protocol/timeline.js";
export { resolveVideoBrand } from "./protocol/background.js";
export { parseVideo } from "./protocol/persistence.js";
export { createSceneTimeline } from "./protocol/scene-timeline.js";
export type { SceneTimeline, SceneTimelineOptions } from "./protocol/scene-timeline.js";
export type { VideoValidationErrorCode } from "./protocol/persistence.js";
