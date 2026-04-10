import { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { profileSchema } from "@/lib/schemas";

export type ProfileData = {
  customName: string | null;
  favorites: string[];
};

const PROFILE_STORAGE_KEY = "gita-profile-v1";

const defaultProfile = (): ProfileData => ({
  customName: null,
  favorites: [],
});

export function useProfile(user: User | null) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<ProfileData>(defaultProfile());

  // Load from localStorage on mount
  useEffect(() => {
    try {
      if (user) {
        const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const validated = profileSchema.safeParse(parsed);
          if (validated.success) {
            setProfile(validated.data);
          } else {
            console.warn("Failed to validate profile data:", validated.error);
          }
        }
      }
    } catch (e) {
      console.warn("Failed to load profile:", e);
    } finally {
      setReady(true);
    }
  }, [user]);

  // Save to localStorage whenever profile changes
  useEffect(() => {
    if (!ready || !user) return;
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  }, [ready, profile, user]);

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

  // Resolve display name: custom > Firebase displayName > Firebase email > "Learner"
  const displayName = profile.customName || user?.displayName || user?.email?.split("@")[0] || "Learner";

  return {
    ready,
    profile,
    displayName,
    setCustomName,
    toggleFavorite,
    isFavorite,
  };
}
