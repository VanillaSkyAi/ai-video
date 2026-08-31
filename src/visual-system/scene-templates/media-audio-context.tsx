import { createContext, useContext, type ReactNode } from "react";

interface MediaAudioState {
  muted: boolean;
  volume: number;
}

const MediaAudioContext = createContext<MediaAudioState>({ muted: true, volume: 1 });

export function MediaAudioProvider({
  muted,
  volume,
  children,
}: MediaAudioState & { children: ReactNode }) {
  return <MediaAudioContext.Provider value={{ muted, volume }}>
    {children}
  </MediaAudioContext.Provider>;
}

export function useMediaAudio(): MediaAudioState {
  return useContext(MediaAudioContext);
}
