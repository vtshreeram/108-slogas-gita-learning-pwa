import { describe, it, expect, vi, beforeAll } from "vitest";

beforeAll(() => { vi.stubGlobal("window", new EventTarget()); });

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
});
