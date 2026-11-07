import { CalendarDays, ChartNoAxesColumnIncreasing, Users } from 'lucide-react';
import type { Route } from '../types/gym';

interface BottomNavProps {
  route: Route;
  onProfiles: () => void;
  onWeekly: () => void;
  onConsistency: () => void;
}

function activeTab(route: Route): 'profiles' | 'weekly' | 'consistency' | null {
  if (route.name === 'profiles') return 'profiles';
  if (route.name === 'consistency') return 'consistency';
  if (route.name === 'overview') return null;
  return 'weekly';
}

/** Persistent three-tab bar. Hidden on signed-out screens by not rendering it there. */
export function BottomNav({ route, onProfiles, onWeekly, onConsistency }: BottomNavProps) {
  const active = activeTab(route);
  const items = [
    { id: 'profiles' as const, label: 'Profiles', icon: Users, onClick: onProfiles },
    { id: 'weekly' as const, label: 'Weekly Plan', icon: CalendarDays, onClick: onWeekly },
    { id: 'consistency' as const, label: 'Consistency', icon: ChartNoAxesColumnIncreasing, onClick: onConsistency },
  ];

  return (
    <nav className="bottom-nav" aria-label="Primary" data-testid="bottom-nav">
      <div className="bottom-nav__inner">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button key={item.id} type="button" className={`bottom-nav__item${isActive ? ' is-active' : ''}`} aria-current={isActive ? 'page' : undefined} onClick={item.onClick}>
              <Icon size={22} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
