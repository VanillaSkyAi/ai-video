export type VideoChatMode = "templates" | "some" | "full";

export interface VideoChatConversationTurn {
  prompt: string;
  response?: string;
}

export interface VideoChatCapabilities {
  templates: true;
  generatedSpeech: boolean;
  generatedVideo: boolean;
  stockMedia: boolean;
  transcription: boolean;
  modes: VideoChatMode[];
}

export interface VideoChatMedia {
  url: string;
  type: "image" | "video";
  posterUrl?: string;
}

export interface VideoChatSuggestion {
  prompt: string;
  media: VideoChatMedia | null;
}

export interface VideoChatAskOptions {
  /** Reuse already-loaded suggestion footage while the answer is prepared. */
  openingMedia?: VideoChatMedia | null;
}

export interface VideoChatWelcome {
  hero: VideoChatMedia | null;
  cards: VideoChatSuggestion[];
}

export interface VideoChatWelcomePrompt {
  prompt: string;
  mediaQuery?: string;
}

export interface VideoChatWelcomeOptions {
  heroQuery?: string;
  prompts?: readonly VideoChatWelcomePrompt[];
}
