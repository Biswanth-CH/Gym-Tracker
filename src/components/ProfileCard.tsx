import { ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { getGenderLabel } from '../constants/profileOptions';
import type { Profile } from '../types/gym';
import { ProfileAvatar } from './ProfileAvatar';

interface ProfileCardProps {
  profile: Profile;
  onOpen: (profile: Profile) => void;
  onEdit: (profile: Profile) => void;
  onDelete: (profile: Profile) => void;
}

/**
 * The open button is "stretched" over the whole card with CSS, so tapping
 * anywhere opens the profile, while Edit/Delete stay separate buttons
 * (no nested interactive elements).
 */
export function ProfileCard({ profile, onOpen, onEdit, onDelete }: ProfileCardProps) {
  return (
    <article className="profile-card">
      <ProfileAvatar
        seed={profile.id}
        name={profile.name}
        photoDataUrl={profile.photoDataUrl}
        size={56}
        className="profile-card__avatar"
      />

      <div className="profile-card__body">
        <h3 className="profile-card__name">
          <button
            type="button"
            className="profile-card__open"
            onClick={() => onOpen(profile)}
            aria-label={`Open ${profile.name}'s weekly workout plan`}
          >
            {profile.name}
          </button>
        </h3>
        <p className="profile-card__description">Your personal workout space</p>
        <span className="profile-card__gender">{getGenderLabel(profile.gender)}</span>
      </div>

      <div className="profile-card__actions">
        <button
          type="button"
          className="icon-button"
          onClick={() => onEdit(profile)}
          aria-label={`Edit ${profile.name}`}
        >
          <Pencil size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-button icon-button--danger"
          onClick={() => onDelete(profile)}
          aria-label={`Delete ${profile.name}`}
        >
          <Trash2 size={18} aria-hidden="true" />
        </button>
        <span className="profile-card__chevron" aria-hidden="true">
          <ChevronRight size={20} />
        </span>
      </div>
    </article>
  );
}
