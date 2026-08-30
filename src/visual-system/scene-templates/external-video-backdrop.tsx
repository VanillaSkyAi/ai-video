import React from "react";

// Source-owned templates may live in a consumer's tree while VideoFrame comes
// from the package. Both copies must observe the same internal context or the
// consumer template would mount a second video over the player-owned plane.
export type ExternalVideoBackdropMode = false | "pending" | "ready" | "fallback";

const sharedContext = globalThis as typeof globalThis & {
  __vanillaskyExternalVideoBackdropContext?: React.Context<ExternalVideoBackdropMode>;
};
const ExternalVideoBackdropContext = sharedContext.__vanillaskyExternalVideoBackdropContext
  ??= React.createContext<ExternalVideoBackdropMode>(false);

export function ExternalVideoBackdropProvider({
  mode,
  children,
}: {
  mode: ExternalVideoBackdropMode;
  children: React.ReactNode;
}) {
  return (
    <ExternalVideoBackdropContext.Provider value={mode}>
      {children}
    </ExternalVideoBackdropContext.Provider>
  );
}

export function useExternalVideoBackdrop(): ExternalVideoBackdropMode {
  return React.useContext(ExternalVideoBackdropContext);
}
