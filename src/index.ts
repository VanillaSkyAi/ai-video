export type {
  Video,
  VideoAudio,
  VideoBackground,
  VideoBrand,
  VideoBrandInput,
  VideoOrientation,
  VideoScene,
  VideoStyle,
  VideoStyleOptions,
} from "./protocol/types.js";
export type {
  VideoStatus,
} from "./protocol/state.js";
export { VideoValidationError } from "./protocol/persistence.js";
export { getVideoDuration } from "./protocol/timeline.js";
export { resolveVideoBrand } from "./protocol/background.js";
export { parseVideo } from "./protocol/persistence.js";
export {
  getSceneDuration,
  getSceneDurationBounds,
  getSpokenDuration,
} from "./protocol/scene-duration.js";
export type { SceneDurationBounds } from "./protocol/scene-duration.js";
export type { VideoValidationErrorCode } from "./protocol/persistence.js";
