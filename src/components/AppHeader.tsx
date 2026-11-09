import type { ReactNode } from 'react';
import { ChevronDown, Dumbbell } from 'lucide-react';
import type { Profile } from '../types/gym';

interface AppHeaderProps {
  /** The profile whose screens are open; null on the Profiles page. */
  activeProfile: Profile | null;
  isOverviewOpen: boolean;
  /** Sync status, signed-in email, import and Logout Account. */
  accountControls: ReactNode;
  onOpenProfileOverview: (profile: Profile) => void;
  onOpenProfiles: () => void;
}

/**
 * Global signed-in header. Left: GymTrack logo, name and "Built by Bisss!".
 * Right: account controls and — on profile screens — the active profile's name with ▼
 * (text only), which opens Profile Overview.
 */
export function AppHeader({ activeProfile, isOverviewOpen, accountControls, onOpenProfileOverview, onOpenProfiles }: AppHeaderProps) {
  return (
    <header className="app-header" data-testid="app-header">
      <div className="app-header__inner">
        <button type="button" className="app-header__brand" onClick={onOpenProfiles} aria-label="GymTrack — all profiles">
          <span className="app-header__mark" aria-hidden="true">
            <Dumbbell size={16} strokeWidth={2.6} />
          </span>
          <span className="app-header__wordmark">
            <span className="app-header__name">
              Gym<span>Track</span>
            </span>
            <span className="app-header__caption">Built by Bisss!</span>
          </span>
        </button>
        <div className="app-header__right">
          {accountControls}
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
      </div>
    </header>
  );
}
