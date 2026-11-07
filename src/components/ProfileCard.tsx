import { Pencil } from 'lucide-react';
import { getGenderLabel } from '../constants/profileOptions';
import type { Profile } from '../types/gym';
import { ProfileAvatar } from './ProfileAvatar';

interface ProfileCardProps {
  profile: Profile;
  onOpen: (profile: Profile) => void;
  onEdit: (profile: Profile) => void;
}

/**
 * Grid tile: picture, name and gender, with a small Edit icon in the top-right corner.
 * Deleting lives inside Edit Profile. The open button is stretched over the whole card
 * with CSS, so tapping anywhere opens the profile while Edit stays a separate button.
 */
export function ProfileCard({ profile, onOpen, onEdit }: ProfileCardProps) {
  return (
    <article className="profile-tile" data-testid="profile-card">
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
        <button type="button" className="profile-tile__open" onClick={() => onOpen(profile)} aria-label={`Open ${profile.name}'s weekly workout plan`}>
          {profile.name}
        </button>
      </h3>
      <span className="profile-tile__gender">{getGenderLabel(profile.gender)}</span>
    </article>
  );
}
