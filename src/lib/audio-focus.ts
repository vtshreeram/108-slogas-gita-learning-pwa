/** The active recording owns both the speaker and the document's Media Session. */
export type AudioOwner = "chapter" | "verse";
export const AUDIO_FOCUS_EVENT = "gita-audio-focus";

type MediaPlayer = {
  metadata: MediaMetadataInit;
  actions: Partial<Record<MediaSessionAction, MediaSessionActionHandler>>;
};

const players = new Map<AudioOwner, MediaPlayer>();
const installedActions = new Set<MediaSessionAction>();
const artwork = [
  { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
  { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
];
let owner: AudioOwner | null = null;
let displayedMetadata: MediaMetadataInit | undefined;

export const audioOwner = () => owner;
const mediaSession = () => typeof navigator === "undefined" ? undefined : navigator.mediaSession;

function syncMediaSession() {
  const session = mediaSession();
  if (!session) return;
  const player = owner ? players.get(owner) : undefined;
  const metadata = player?.metadata;
  if (metadata !== displayedMetadata && typeof MediaMetadata !== "undefined") {
    session.metadata = metadata ? new MediaMetadata({ artist: "Bhagavad Gita", artwork, ...metadata }) : null;
    displayedMetadata = metadata;
  }
  for (const action of installedActions) {
    if (player?.actions[action]) continue;
    try { session.setActionHandler(action, null); } catch { /* optional browser capability */ }
    installedActions.delete(action);
  }
  for (const action of Object.keys(player?.actions ?? {}) as MediaSessionAction[]) {
    if (installedActions.has(action) || !player?.actions[action]) continue;
    try {
      session.setActionHandler(action, (details) => {
        if (owner) players.get(owner)?.actions[action]?.(details);
      });
      installedActions.add(action);
    } catch { /* optional browser capability */ }
  }
}

export function updateMediaPlayer(playerOwner: AudioOwner, player: MediaPlayer) {
  players.set(playerOwner, player);
  if (owner === playerOwner) syncMediaSession();
}

export function removeMediaPlayer(playerOwner: AudioOwner) {
  players.delete(playerOwner);
  releaseAudioFocus(playerOwner);
}

export function setMediaPlayback(playerOwner: AudioOwner, state: MediaSessionPlaybackState) {
  const session = mediaSession();
  if (session && owner === playerOwner) session.playbackState = state;
}

export function setMediaPosition(playerOwner: AudioOwner, audio: HTMLAudioElement | null) {
  const session = mediaSession();
  if (owner !== playerOwner || !audio || !session?.setPositionState || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
  try {
    session.setPositionState({
      duration: audio.duration,
      playbackRate: audio.playbackRate || 1,
      position: Math.min(Math.max(0, audio.currentTime), audio.duration),
    });
  } catch { /* optional browser capability */ }
}

function clearMediaPosition() {
  try { mediaSession()?.setPositionState?.(); } catch { /* optional browser capability */ }
}

/** Called when a player starts: the other one pauses and the Lock Screen controls follow the new owner. */
export function claimAudioFocus(next: AudioOwner) {
  if (owner === next) return;
  owner = next;
  clearMediaPosition();
  syncMediaSession();
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<AudioOwner>(AUDIO_FOCUS_EVENT, { detail: next }));
}

/** Dismiss the current session when its recording or player goes away. A pause keeps ownership. */
export function releaseAudioFocus(from: AudioOwner) {
  if (owner !== from) return;
  setMediaPlayback(from, "none");
  owner = null;
  clearMediaPosition();
  syncMediaSession();
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<AudioOwner | null>(AUDIO_FOCUS_EVENT, { detail: null }));
}

export function onAudioFocus(handler: (owner: AudioOwner | null) => void) {
  const listener = (event: Event) => handler((event as CustomEvent<AudioOwner | null>).detail);
  window.addEventListener(AUDIO_FOCUS_EVENT, listener);
  return () => window.removeEventListener(AUDIO_FOCUS_EVENT, listener);
}
