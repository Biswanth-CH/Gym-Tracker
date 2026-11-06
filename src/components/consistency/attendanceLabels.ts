import type { DayState } from '../../utils/consistencyUtils';

/** Human-readable names for each calendar cell state (used in labels and the legend). */
export const DAY_STATE_LABELS: Record<DayState, string> = {
  attended: 'Went to gym',
  missed: 'Did not go',
  unmarked: 'Not marked',
  sunday: 'Sunday (rest day)',
  future: 'Future date',
  'before-start': 'Before profile was created',
};

export const LEGEND_ORDER: readonly DayState[] = ['attended', 'missed', 'unmarked', 'sunday', 'future'];
