import { Lock, Pencil } from 'lucide-react';
import { getGenderLabel } from '../constants/profileOptions';
import type { CardBackgroundSettings, Profile } from '../types/gym';
import { formatStreak } from '../utils/streakDisplay';
import { profileTileThemeStyle } from '../services/documentTheme';
import { CardBackgroundLayers } from './cardBackground/CardBackgroundLayers';
import { ProfileAvatar } from './ProfileAvatar';

interface ProfileCardProps {
  profile: Profile;
  /** Current gym streak (shared consistency calculation). */
  streakDays: number;
  /** The profile has a PIN lock. */
  isLocked: boolean;
  onOpen: (profile: Profile) => void;
  onEdit: (profile: Profile) => void;
  /** Phase 7: the profile card's own background image (independent of the avatar). */
  background?: { imageUrl: string | null; settings: CardBackgroundSettings } | null;
  /** Renders a non-interactive copy (Customize Card Background preview). */
  isPreview?: boolean;
}

/**
 * Grid tile: streak (top-left), Edit icon (top-right), picture, name, gender and a lock
 * icon when PIN-protected. `data-theme` gives each tile a subtle accent in its own
 * profile colour without theming the whole Profiles page. An optional background image
 * sits behind everything (image → dim overlay → content).
 */
export function ProfileCard({ profile, streakDays, isLocked, onOpen, onEdit, background = null, isPreview = false }: ProfileCardProps) {
  const hasBackground = Boolean(background?.imageUrl);
  return (
    <article
      className={`profile-tile${hasBackground ? ' has-card-background' : ''}`}
      data-theme={profile.customThemeColor ? 'custom' : profile.themeKey}
      style={profileTileThemeStyle(profile.customThemeColor)}
      data-testid={isPreview ? 'profile-card-preview' : 'profile-card'}
    >
      {background?.imageUrl && <CardBackgroundLayers imageUrl={background.imageUrl} settings={background.settings} />}
      <span className="profile-tile__streak" aria-label={`Current streak: ${streakDays} days`} data-testid="profile-streak">
        {formatStreak(streakDays)}
      </span>
      {isPreview ? (
        <span className="icon-button profile-tile__edit" aria-hidden="true">
          <Pencil size={16} aria-hidden="true" />
        </span>
      ) : (
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
      )}
      <ProfileAvatar seed={profile.id} name={profile.name} photoUrl={profile.photoUrl} size={72} className="profile-tile__avatar" />
      <h3 className="profile-tile__name">
        {isPreview ? (
          <span className="profile-tile__open">
            {isLocked && <Lock size={13} className="profile-tile__lock" aria-hidden="true" />}
            <span className="profile-tile__name-text">{profile.name}</span>
          </span>
        ) : (
          <button
            type="button"
            className="profile-tile__open"
            onClick={() => onOpen(profile)}
            aria-label={`Open ${profile.name}'s weekly workout plan${isLocked ? ' (PIN locked)' : ''}`}
          >
            {isLocked && <Lock size={13} className="profile-tile__lock" aria-hidden="true" data-testid="profile-lock-icon" />}
            <span className="profile-tile__name-text">{profile.name}</span>
          </button>
        )}
      </h3>
      <span className="profile-tile__gender">{getGenderLabel(profile.gender)}</span>
    </article>
  );
}
