"use client";

import { useState } from "react";
import { User, signOut } from "firebase/auth";
import { Download, Upload, LogOut } from "lucide-react";
import { auth } from "@/lib/firebase";
import { AppState } from "@/lib/constants";
import { TOTAL_SHLOKAS } from "@/lib/shlokas";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/hooks/use-profile";
import { useBackupRestore } from "@/hooks/use-backup-restore";

type ProfileSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  state: AppState;
  setState: (fn: (prev: AppState) => AppState) => void;
  completedCount: number;
  streak: number;
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
    .slice(0, 2) || "?";
}

function getAchievements(completedCount: number, streak: number) {
  const badges = [];

  if (completedCount >= 1) badges.push({ icon: "⭐", label: "First Step", desc: "1 shloka learned" });
  if (completedCount >= 10) badges.push({ icon: "🥉", label: "Bronze Scholar", desc: "10 shlokas" });
  if (completedCount >= 25) badges.push({ icon: "🥈", label: "Silver Scholar", desc: "25 shlokas" });
  if (completedCount >= 50) badges.push({ icon: "🥇", label: "Gold Scholar", desc: "50 shlokas" });
  if (completedCount >= 75) badges.push({ icon: "🔥", label: "Almost There", desc: "75 shlokas" });
  if (completedCount === TOTAL_SHLOKAS) badges.push({ icon: "🕉️", label: "Complete Master", desc: "All 108!" });

  if (streak >= 7) badges.push({ icon: "⚡", label: "Week Warrior", desc: "7-day streak" });
  if (streak >= 30) badges.push({ icon: "🌙", label: "Month Sage", desc: "30-day streak" });

  return badges;
}

export function ProfileSheet({
  open,
  onOpenChange,
  user,
  state,
  setState,
  completedCount,
  streak,
}: ProfileSheetProps) {
  const { displayName, setCustomName } = useProfile(user);
  const { handleExportBackup, handleImportBackup } = useBackupRestore();
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(displayName);

  const achievements = getAchievements(completedCount, streak);
  const joinedDate = state.startedAt ? new Date(state.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Unknown";
  const winRate = state.recallAttempts > 0 ? Math.round((state.recallWins / state.recallAttempts) * 100) : 0;

  const handleSaveName = () => {
    setCustomName(tempName);
    setIsEditingName(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      onOpenChange(false);
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  if (!user) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:w-96 bg-[#fffaf0] dark:bg-[#1e1710] border-r border-[#f0d498] dark:border-[#423321] px-4 py-6 overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-[#4a3615] dark:text-[#f0e3ce]">Your Profile</SheetTitle>
        </SheetHeader>

        {/* Avatar & Name Section */}
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#ebd6ab] to-[#dbba84] border border-[#c4a062] dark:border-[#423321] text-2xl font-bold text-[#4a3615]">
            {user.photoURL ? (
              <img src={user.photoURL} alt={displayName} className="h-20 w-20 rounded-full object-cover" />
            ) : (
              getInitials(displayName)
            )}
          </div>
          {isEditingName ? (
            <div className="w-full space-y-2">
              <Input
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                placeholder="Enter your name"
                className="text-center text-[#4a3615] dark:text-[#f0e3ce] border-[#ccb385] dark:border-[#423321]"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveName}
                  className="flex-1 rounded-lg bg-[#8a6b3d] text-white text-xs font-semibold py-2 hover:bg-[#6b512c]"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setTempName(displayName);
                    setIsEditingName(false);
                  }}
                  className="flex-1 rounded-lg border border-[#ccb385] dark:border-[#423321] bg-white dark:bg-[#2d2218] text-[#5c482a] dark:text-[#bda27e] text-xs font-semibold py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={() => setIsEditingName(true)}
                className="text-base font-semibold text-[#4a3615] dark:text-[#f0e3ce] hover:text-[#8a6b3d] dark:hover:text-[#d4aa61] transition-colors"
              >
                {displayName}
              </button>
              <p className="text-xs text-[#a88d63] dark:text-[#bda27e]">{user.email}</p>
            </div>
          )}
        </div>

        <div className="h-px bg-[#f0d498] dark:bg-[#423321] mb-6" />

        {/* Stats Grid */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="flex flex-col items-center p-3 rounded-lg bg-[#fcebc4] dark:bg-[#2d2218] border border-[#f0d498] dark:border-[#423321]">
            <span className="text-xl font-bold text-[#8f6422] dark:text-[#d4aa61]">{completedCount}</span>
            <span className="text-[10px] uppercase font-bold text-[#a88d63] dark:text-[#bda27e]">Learned</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-[#fcebc4] dark:bg-[#2d2218] border border-[#f0d498] dark:border-[#423321]">
            <span className="text-xl font-bold text-[#8f6422] dark:text-[#d4aa61]">{streak}</span>
            <span className="text-[10px] uppercase font-bold text-[#a88d63] dark:text-[#bda27e]">Streak</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-[#fcebc4] dark:bg-[#2d2218] border border-[#f0d498] dark:border-[#423321]">
            <span className="text-xl font-bold text-[#8f6422] dark:text-[#d4aa61]">{winRate}%</span>
            <span className="text-[10px] uppercase font-bold text-[#a88d63] dark:text-[#bda27e]">Win Rate</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-[#fcebc4] dark:bg-[#2d2218] border border-[#f0d498] dark:border-[#423321]">
            <span className="text-xs font-bold text-[#8f6422] dark:text-[#d4aa61] text-center leading-tight">{joinedDate}</span>
            <span className="text-[10px] uppercase font-bold text-[#a88d63] dark:text-[#bda27e] mt-1">Joined</span>
          </div>
        </div>

        {/* Achievements */}
        {achievements.length > 0 && (
          <>
            <p className="text-xs uppercase font-bold text-[#a88d63] dark:text-[#bda27e] mb-2 tracking-wider">Achievements</p>
            <div className="mb-6 space-y-2 max-h-40 overflow-y-auto">
              {achievements.map((badge) => (
                <div key={badge.label} className="flex items-center gap-3 p-2 rounded-lg bg-[#fcebc4] dark:bg-[#2d2218] border border-[#f0d498] dark:border-[#423321]">
                  <span className="text-lg">{badge.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#4a3615] dark:text-[#f0e3ce]">{badge.label}</p>
                    <p className="text-[10px] text-[#a88d63] dark:text-[#bda27e]">{badge.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Mode Toggle */}
        <div className="mb-6">
          <p className="text-xs uppercase font-bold text-[#a88d63] dark:text-[#bda27e] mb-2 tracking-wider">Learning Mode</p>
          <div className="flex gap-2">
            {["normal", "lite"].map((mode) => (
              <button
                key={mode}
                onClick={() => setState((prev) => ({ ...prev, activeMode: mode as "normal" | "lite" }))}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  state.activeMode === mode
                    ? "bg-[#8a6b3d] text-white"
                    : "border border-[#ccb385] dark:border-[#423321] bg-white dark:bg-[#1e1710] text-[#5c482a] dark:text-[#bda27e] hover:bg-[#fcf5e3] dark:hover:bg-[#2d2218]"
                }`}
              >
                {mode === "normal" ? "Normal (3/day)" : "Lite (1/day)"}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-[#f0d498] dark:bg-[#423321] mb-6" />

        {/* Backup & Restore */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={handleImportBackup}
            className="flex-1 flex justify-center items-center gap-2 rounded-lg border border-[#ccb385] dark:border-[#423321] bg-white dark:bg-[#1e1710] px-3 py-2 text-xs font-semibold text-[#5c482a] dark:text-[#bda27e] hover:bg-[#fcf5e3] dark:hover:bg-[#2d2218] transition-colors"
          >
            <Upload className="h-4 w-4" /> Import
          </button>
          <button
            onClick={handleExportBackup}
            className="flex-1 flex justify-center items-center gap-2 rounded-lg border border-[#ccb385] dark:border-[#423321] bg-white dark:bg-[#1e1710] px-3 py-2 text-xs font-semibold text-[#5c482a] dark:text-[#bda27e] hover:bg-[#fcf5e3] dark:hover:bg-[#2d2218] transition-colors"
          >
            <Download className="h-4 w-4" /> Export
          </button>
        </div>

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 px-4 py-3 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
        >
          <LogOut className="h-4 w-4" /> Sign Out
        </button>
      </SheetContent>
    </Sheet>
  );
}
