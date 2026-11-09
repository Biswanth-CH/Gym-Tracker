import { Lock, Pencil } from 'lucide-react';
import { getGenderLabel } from '../constants/profileOptions';
import type { Profile } from '../types/gym';
import { formatStreak } from '../utils/streakDisplay';
import { ProfileAvatar } from './ProfileAvatar';

interface ProfileCardProps {
  profile: Profile;
  /** Current gym streak (shared consistency calculation). */
  streakDays: number;
  /** The profile has a PIN lock. */
  isLocked: boolean;
  onOpen: (profile: Profile) => void;
  onEdit: (profile: Profile) => void;
}

/**
 * Grid tile: streak (top-left), Edit icon (top-right), picture, name, gender and a lock
 * icon when PIN-protected. `data-theme` gives each tile a subtle accent in its own
 * profile colour without theming the whole Profiles page.
 */
export function ProfileCard({ profile, streakDays, isLocked, onOpen, onEdit }: ProfileCardProps) {
  return (
    <article className="profile-tile" data-theme={profile.themeKey} data-testid="profile-card">
      <span className="profile-tile__streak" aria-label={`Current streak: ${streakDays} days`} data-testid="profile-streak">
        {formatStreak(streakDays)}
      </span>
      <button
        type="button"
        className="icon-button profile-tile__edit"
        onClick={() => onEdit(profile)}
        aria-label={`Edit ${profile.name}`}
        title="Edit profile"
        data-testid="profile-edit"
      >
        <Pencil size={16} aria-hidden="true" />
      </button>
      <ProfileAvatar seed={profile.id} name={profile.name} photoUrl={profile.photoUrl} size={72} className="profile-tile__avatar" />
      <h3 className="profile-tile__name">
        <button
          type="button"
          className="profile-tile__open"
          onClick={() => onOpen(profile)}
          aria-label={`Open ${profile.name}'s weekly workout plan${isLocked ? ' (PIN locked)' : ''}`}
        >
          {isLocked && <Lock size={13} className="profile-tile__lock" aria-hidden="true" data-testid="profile-lock-icon" />}
          <span className="profile-tile__name-text">{profile.name}</span>
        </button>
      </h3>
      <span className="profile-tile__gender">{getGenderLabel(profile.gender)}</span>
    </article>
  );
}
