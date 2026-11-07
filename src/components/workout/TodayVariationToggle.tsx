import { CalendarCheck2, CalendarPlus, Loader2 } from 'lucide-react';

interface TodayVariationToggleProps {
  selected: boolean;
  busy: boolean;
  onToggle: () => void;
}

/** "Today I'm Doing This Variation" — adds/removes this exercise from today's workout (not attendance). */
export function TodayVariationToggle({ selected, busy, onToggle }: TodayVariationToggleProps) {
  return (
    <button
      type="button"
      className={`today-toggle${selected ? ' is-selected' : ''}`}
      onClick={onToggle}
      aria-pressed={selected}
      disabled={busy}
      data-testid="today-toggle"
    >
      <span className="today-toggle__icon" aria-hidden="true">
        {busy ? <Loader2 size={20} className="spin" /> : selected ? <CalendarCheck2 size={20} /> : <CalendarPlus size={20} />}
      </span>
      <span className="today-toggle__text">
        <span className="today-toggle__title">Today I’m Doing This Variation</span>
        <span className="today-toggle__hint">{selected ? 'Added to today’s workout · tap to remove' : 'Tap to add it to today’s workout'}</span>
      </span>
    </button>
  );
}
