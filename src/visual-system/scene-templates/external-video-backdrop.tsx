import React from "react";

// Source-owned templates may live in a consumer's tree while VideoFrame comes
// from the package. Both copies must observe the same internal context or the
// consumer template would mount a second video over the player-owned plane,
// and would never inherit the player's native media audio state.
export type ExternalVideoBackdropMode = false | "pending" | "ready" | "fallback";

interface BackdropContextValue {
  mode: ExternalVideoBackdropMode;
  audioMuted: boolean;
  audioVolume: number;
}

const DEFAULT: BackdropContextValue = { mode: false, audioMuted: true, audioVolume: 1 };

const sharedContext = globalThis as typeof globalThis & {
  __vanillaskyVideoBackdropContext?: React.Context<BackdropContextValue>;
};
const BackdropContext = sharedContext.__vanillaskyVideoBackdropContext
  ??= React.createContext<BackdropContextValue>(DEFAULT);

export function ExternalVideoBackdropProvider({
  mode,
  audioMuted = true,
  audioVolume = 1,
  children,
}: {
  mode: ExternalVideoBackdropMode;
  audioMuted?: boolean;
  audioVolume?: number;
  children: React.ReactNode;
}) {
  const value = React.useMemo(
    () => ({ mode, audioMuted, audioVolume }),
    [mode, audioMuted, audioVolume],
  );
  return (
    <BackdropContext.Provider value={value}>
      {children}
    </BackdropContext.Provider>
  );
}

export function useExternalVideoBackdrop(): ExternalVideoBackdropMode {
  return React.useContext(BackdropContext).mode;
}

export function useMediaAudio(): { muted: boolean; volume: number } {
  const { audioMuted, audioVolume } = React.useContext(BackdropContext);
  return { muted: audioMuted, volume: audioVolume };
}
