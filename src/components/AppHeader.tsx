import { ChevronDown, Dumbbell } from 'lucide-react';
import type { Profile } from '../types/gym';

interface AppHeaderProps {
  /** The profile whose screens are open; null on the Profiles page. */
  activeProfile: Profile | null;
  isOverviewOpen: boolean;
  onOpenProfileOverview: (profile: Profile) => void;
  onOpenProfiles: () => void;
}

/**
 * Signed-in app header: brand on the left, the active profile's name (text only,
 * no picture) on the right. The name opens Profile Overview. There is no bottom bar.
 */
export function AppHeader({ activeProfile, isOverviewOpen, onOpenProfileOverview, onOpenProfiles }: AppHeaderProps) {
  return (
    <header className="app-header" data-testid="app-header">
      <div className="app-header__inner">
        <button type="button" className="app-header__brand" onClick={onOpenProfiles} aria-label="GymTrack — all profiles">
          <span className="app-header__mark" aria-hidden="true">
            <Dumbbell size={16} strokeWidth={2.6} />
          </span>
          <span className="app-header__name">
            Gym<span>Track</span>
          </span>
        </button>
        {activeProfile && (
          <button
            type="button"
            className={`app-header__profile${isOverviewOpen ? ' is-active' : ''}`}
            onClick={() => onOpenProfileOverview(activeProfile)}
            aria-label={`${activeProfile.name}: open profile overview`}
            aria-current={isOverviewOpen ? 'page' : undefined}
            data-testid="header-profile-button"
          >
            <span className="app-header__profile-name">{activeProfile.name}</span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </header>
  );
}
