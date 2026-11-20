/** Only one recording plays at a time: the chapter player and the verse player hand "audio focus" to each other (no DOM beyond window events). */
export type AudioOwner = "chapter" | "verse";
export const AUDIO_FOCUS_EVENT = "gita-audio-focus";

let owner: AudioOwner | null = null;
export const audioOwner = () => owner;

/** Called when a player starts: the other one pauses and the Lock Screen controls follow the new owner. */
export function claimAudioFocus(next: AudioOwner) {
  if (owner === next) return;
  owner = next;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<AudioOwner>(AUDIO_FOCUS_EVENT, { detail: next }));
}

/** Give the focus back (e.g. the chapter player was dismissed), so the verse player may claim the Lock Screen again. */
export function releaseAudioFocus(from: AudioOwner) {
  if (owner !== from) return;
  owner = null;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<AudioOwner | null>(AUDIO_FOCUS_EVENT, { detail: null }));
}

export function onAudioFocus(handler: (owner: AudioOwner | null) => void) {
  const listener = (event: Event) => handler((event as CustomEvent<AudioOwner | null>).detail);
  window.addEventListener(AUDIO_FOCUS_EVENT, listener);
  return () => window.removeEventListener(AUDIO_FOCUS_EVENT, listener);
}
