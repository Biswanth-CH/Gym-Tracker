import { BicepsFlexed, Dumbbell, Footprints, Layers, Moon, type LucideIcon } from 'lucide-react';
import type { WorkoutCategory } from '../types/gym';

const CATEGORY_ICONS: Record<WorkoutCategory, LucideIcon> = {
  push: Dumbbell,
  pull: BicepsFlexed,
  legs: Footprints,
  rest: Moon,
  mixed: Layers,
};

interface WorkoutIconProps {
  category: WorkoutCategory;
  size?: number;
}

export function WorkoutIcon({ category, size = 20 }: WorkoutIconProps) {
  const Icon = CATEGORY_ICONS[category];
  return <Icon size={size} strokeWidth={2.2} aria-hidden="true" />;
}
