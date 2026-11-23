import { useMemo } from 'react';
import { Crown } from 'lucide-react';
import type { ProfileStreaks } from '../hooks/useProfileStreaks';
import type { Profile } from '../types/gym';
import { formatDayCount, ordinal, rankByCurrentStreak } from '../utils/leaderboard';
import { formatStreak } from '../utils/streakDisplay';
import { ProfileAvatar } from './ProfileAvatar';

interface ProfileLeaderboardProps {
  /** Only the signed-in account's profiles (RLS + useProfiles). */
  profiles: readonly Profile[];
  streaks: ReadonlyMap<string, ProfileStreaks>;
}

/**
 * Compact one-row leaderboard by CURRENT (ongoing) streak. Equal streaks share a rank
 * (1st, 1st, 1st, 4th) and every profile in first place gets a crown.
 * Scrolls sideways on narrow screens instead of wrapping.
 */
export function ProfileLeaderboard({ profiles, streaks }: ProfileLeaderboardProps) {
  const ranked = useMemo(() => {
    const byId = new Map(profiles.map((profile) => [profile.id, profile]));
    return rankByCurrentStreak(profiles.map((profile) => ({ profileId: profile.id, currentStreak: streaks.get(profile.id)?.currentStreak ?? 0 })))
      .map((entry) => ({ ...entry, profile: byId.get(entry.profileId)! }))
      .filter((entry) => entry.profile);
  }, [profiles, streaks]);

  if (ranked.length === 0) return null;

  return (
    <section className="leaderboard" aria-labelledby="leaderboard-heading" data-testid="leaderboard">
      <h2 id="leaderboard-heading" className="leaderboard__title">
        Leaderboard <span className="leaderboard__subtitle">· current streak</span>
      </h2>
      <ol className="leaderboard__list">
        {ranked.map(({ profile, rank, currentStreak, isLeader }) => (
          <li
            key={profile.id}
            className={`leaderboard__item${isLeader ? ' is-leader' : ''}`}
            aria-label={`${ordinal(rank)}: ${profile.name}, current streak ${formatDayCount(currentStreak)}`}
            title={profile.name}
            data-testid="leaderboard-item"
            data-rank={rank}
          >
            <span className="leaderboard__avatar">
              {isLeader && <Crown size={14} className="leaderboard__crown" aria-hidden="true" data-testid="leaderboard-crown" />}
              <ProfileAvatar seed={profile.id} name={profile.name} photoUrl={profile.photoUrl} size={36} />
            </span>
            <span className="leaderboard__meta">
              <span className="leaderboard__rank">{ordinal(rank)}</span>
              <span className="leaderboard__streak">{formatStreak(currentStreak)}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
