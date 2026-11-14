import { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { cleanFavorites, profileSchema } from "@/lib/schemas";

export type ProfileData = {
  customName: string | null;
  favorites: string[];
  lineCues: Record<string, number[]>;
};

export const PROFILE_STORAGE_KEY = "gita-profile-v1";
const PROFILE_CLAIM_KEY = `${PROFILE_STORAGE_KEY}-claimed-by`;

const defaultProfile = (): ProfileData => ({
  customName: null,
  favorites: [],
  lineCues: {},
});

export function useProfile(user: User | null) {
  const uid = user?.uid ?? null;
  const [profile, setProfile] = useState<ProfileData>(defaultProfile());
  // Which uid `profile` was loaded for; saves only happen when it matches the current uid.
  const [loadedUid, setLoadedUid] = useState<string | null>(null);
  const ready = uid !== null && loadedUid === uid;

  // Load this user's profile. The first account on a device adopts the legacy shared copy.
  useEffect(() => {
    if (!uid) {
      setProfile(defaultProfile());
      setLoadedUid(null);
      return;
    }
    let next = defaultProfile();
    try {
      const key = `${PROFILE_STORAGE_KEY}:${uid}`;
      let raw = localStorage.getItem(key);
      let adopted = false;
      if (raw === null && !localStorage.getItem(PROFILE_CLAIM_KEY)) {
        raw = localStorage.getItem(PROFILE_STORAGE_KEY);
        adopted = raw !== null;
      }
      if (raw) {
        const validated = profileSchema.safeParse(JSON.parse(raw));
        if (validated.success) {
          next = { ...validated.data, favorites: cleanFavorites(validated.data.favorites) };
          if (adopted) localStorage.setItem(PROFILE_CLAIM_KEY, uid);
        } else {
          console.warn("Failed to validate profile data:", validated.error);
        }
      }
    } catch (e) {
      console.warn("Failed to load profile:", e);
    }
    setProfile(next);
    setLoadedUid(uid);
  }, [uid]);

  // Save whenever the profile changes (only for the user it was loaded for)
  useEffect(() => {
    if (!uid || loadedUid !== uid) return;
    try {
      localStorage.setItem(`${PROFILE_STORAGE_KEY}:${uid}`, JSON.stringify(profile));
    } catch (e) {
      console.warn("Failed to save profile:", e);
    }
  }, [uid, loadedUid, profile]);

  const setCustomName = (name: string | null) => {
    setProfile((prev) => ({ ...prev, customName: name && name.trim() ? name.trim() : null }));
  };

  const toggleFavorite = (shlokaId: string) => {
    setProfile((prev) => ({
      ...prev,
      favorites: prev.favorites.includes(shlokaId)
        ? prev.favorites.filter((id) => id !== shlokaId)
        : [...prev.favorites, shlokaId],
    }));
  };

  const isFavorite = (shlokaId: string): boolean => profile.favorites.includes(shlokaId);
  const setLineCues = (id: string, cues: number[] | null) => setProfile((prev) => {
    const lineCues = { ...prev.lineCues };
    if (cues) lineCues[id] = cues; else delete lineCues[id];
    return { ...prev, lineCues };
  });

  // Resolve display name: custom > Firebase displayName > Firebase email > "Learner"
  const displayName = profile.customName || user?.displayName || user?.email?.split("@")[0] || "Learner";

  return {
    ready,
    profile,
    displayName,
    setCustomName,
    toggleFavorite,
    isFavorite,
    setLineCues,
  };
}
