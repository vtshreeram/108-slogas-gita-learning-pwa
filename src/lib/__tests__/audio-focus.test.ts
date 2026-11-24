import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("window", new EventTarget());
});
afterEach(() => vi.unstubAllGlobals());

describe("audio focus", () => {
  it("hands focus between players and notifies only on change", async () => {
    const { audioOwner, claimAudioFocus, releaseAudioFocus, onAudioFocus } = await import("@/lib/audio-focus");
    const seen: (string | null)[] = [];
    const stop = onAudioFocus((o) => seen.push(o));
    claimAudioFocus("chapter");
    claimAudioFocus("chapter");
    expect(audioOwner()).toBe("chapter");
    claimAudioFocus("verse");
    releaseAudioFocus("chapter"); // not the owner: ignored
    expect(audioOwner()).toBe("verse");
    releaseAudioFocus("verse");
    expect(audioOwner()).toBeNull();
    stop();
    claimAudioFocus("chapter");
    expect(seen).toEqual(["chapter", "verse", null]);
  });

  it("keeps play and pause installed through a pause and routes them to the current owner", async () => {
    const actions = new Map<MediaSessionAction, MediaSessionActionHandler>();
    const session = {
      metadata: null as MediaMetadataInit | null,
      playbackState: "none",
      setPositionState: vi.fn(),
      setActionHandler: vi.fn((action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
        if (handler) actions.set(action, handler);
        else actions.delete(action);
      }),
    };
    vi.stubGlobal("navigator", { mediaSession: session });
    vi.stubGlobal("MediaMetadata", class { constructor(value: MediaMetadataInit) { Object.assign(this, value); } });
    const { claimAudioFocus, removeMediaPlayer, setMediaPlayback, setMediaPosition, updateMediaPlayer } = await import("@/lib/audio-focus");
    const chapterPlay = vi.fn();
    const chapterPause = vi.fn(() => setMediaPlayback("chapter", "paused"));
    const versePlay = vi.fn();
    const versePause = vi.fn();
    const seek = vi.fn();
    updateMediaPlayer("chapter", { metadata: { title: "Chapter 2" }, actions: { play: chapterPlay, pause: chapterPause, seekto: seek } });
    updateMediaPlayer("verse", { metadata: { title: "Verse 2.47" }, actions: { play: versePlay, pause: versePause } });
    expect(session.setActionHandler).not.toHaveBeenCalled();

    claimAudioFocus("chapter");
    setMediaPlayback("chapter", "playing");
    const play = actions.get("play");
    const pause = actions.get("pause");
    pause?.({ action: "pause" });
    expect(session.playbackState).toBe("paused");
    expect(session.metadata?.title).toBe("Chapter 2");
    expect(actions.get("play")).toBe(play);
    play?.({ action: "play" });
    expect(chapterPlay).toHaveBeenCalledOnce();

    claimAudioFocus("verse");
    setMediaPlayback("verse", "playing");
    setMediaPlayback("chapter", "paused");
    expect(session.playbackState).toBe("playing");
    expect(session.metadata?.title).toBe("Verse 2.47");
    expect(actions.get("play")).toBe(play);
    expect(actions.get("pause")).toBe(pause);
    expect(actions.has("seekto")).toBe(false);
    removeMediaPlayer("chapter");
    play?.({ action: "play" });
    expect(versePlay).toHaveBeenCalledOnce();
    expect(chapterPlay).toHaveBeenCalledOnce();

    const audio = { duration: 30, currentTime: 8, playbackRate: 1.25 } as HTMLAudioElement;
    setMediaPosition("verse", audio);
    expect(session.setPositionState).toHaveBeenLastCalledWith({ duration: 30, position: 8, playbackRate: 1.25 });
    removeMediaPlayer("verse");
    expect(session.playbackState).toBe("none");
    expect(session.metadata).toBeNull();
    expect(session.setPositionState).toHaveBeenLastCalledWith();
    expect(actions.size).toBe(0);
  });
});
