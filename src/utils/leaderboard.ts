/**
 * Profiles leaderboard (Phase 7): ranks the signed-in account's profiles by their CURRENT
 * ongoing streak (calculateCurrentStreak), so a broken streak drops a profile immediately.
 * Highest Streak (calculateLongestStreak) stays a historical stat on the Consistency page.
 * Competition ranking: equal streaks share a rank and the next rank skips the shared
 * places (12, 12, 8, 5 → 1st, 1st, 3rd, 4th).
 * Ties keep the input order (profiles are passed oldest first).
 */
export interface LeaderboardEntry {
  profileId: string;
  currentStreak: number;
}

export interface RankedLeaderboardEntry extends LeaderboardEntry {
  rank: number;
  /** Every profile sharing first place (and with a streak above zero) gets the crown. */
  isLeader: boolean;
}

export function rankByCurrentStreak(entries: readonly LeaderboardEntry[]): RankedLeaderboardEntry[] {
  const sorted = entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => b.entry.currentStreak - a.entry.currentStreak || a.index - b.index)
    .map(({ entry }) => entry);
  let previousStreak: number | null = null;
  let previousRank = 0;
  return sorted.map((entry, position) => {
    const rank = entry.currentStreak === previousStreak ? previousRank : position + 1;
    previousStreak = entry.currentStreak;
    previousRank = rank;
    return { ...entry, rank, isLeader: rank === 1 && entry.currentStreak > 0 };
  });
}

/** Spoken day count: 1 → "1 day", anything else (including 0) → "N days". */
export function formatDayCount(days: number): string {
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/** 1 → "1st", 2 → "2nd", 11 → "11th", 22 → "22nd". */
export function ordinal(position: number): string {
  const lastTwo = position % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${position}th`;
  switch (position % 10) {
    case 1:
      return `${position}st`;
    case 2:
      return `${position}nd`;
    case 3:
      return `${position}rd`;
    default:
      return `${position}th`;
  }
}
