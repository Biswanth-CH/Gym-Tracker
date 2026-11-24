import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useBodyWeight } from '../../hooks/useBodyWeight';
import { useWeightUnitPreference } from '../../hooks/useWeightUnitPreference';
import type { DateKey } from '../../types/gym';
import { formatTodayWeight, todayWeightEntry, weightHeading } from '../../utils/todayStatus';
import { WeightLogModal } from './BodyWeightSection';

interface TodayWeightProps {
  profileId: string;
  /** Local calendar date (useToday), the key weights are stored under. */
  todayKey: DateKey;
  onToast: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

/**
 * Today page: "Eeroju weight entha?" + Log today’s weight, or — once logged — a green
 * "Eeroju weight" with today's value. Tapping the value edits it or deletes it (with a
 * confirmation). Reuses the existing weight dialog, validation, kg/lb conversion and the
 * one-entry-per-profile-per-date upsert, so the body-weight graph updates at once.
 */
export function TodayWeight({ profileId, todayKey, onToast }: TodayWeightProps) {
  const { byDate, save, remove } = useBodyWeight(profileId);
  const [unit, setUnit] = useWeightUnitPreference();
  const [isOpen, setIsOpen] = useState(false);
  const today = todayWeightEntry(byDate, todayKey);
  const heading = weightHeading(today);

  return (
    <section className="today-weight" aria-label="Today's weight" data-testid="today-weight">
      <p className={`today-weight__title today-heading today-heading--${heading.tone}`} data-testid="weight-heading">
        {heading.text}
      </p>
      {today ? (
        <button
          type="button"
          className="today-weight__value"
          onClick={() => setIsOpen(true)}
          aria-label={`Today's weight ${formatTodayWeight(today.weightKg, unit)}. Edit or clear`}
          data-testid="today-weight-value"
        >
          {formatTodayWeight(today.weightKg, unit)}
        </button>
      ) : (
        <button type="button" className="button button--ghost button--compact today-weight__log" onClick={() => setIsOpen(true)} data-testid="log-today-weight">
          <Plus size={14} aria-hidden="true" /> Log today’s weight
        </button>
      )}
      <WeightLogModal
        isOpen={isOpen}
        todayKey={todayKey}
        initialDate={todayKey}
        unit={unit}
        onUnit={setUnit}
        existing={byDate}
        onClose={() => setIsOpen(false)}
        onSave={async (date, weight, nextUnit) => {
          await save(date, weight, nextUnit);
          onToast('Body weight saved');
          setIsOpen(false);
        }}
        onDelete={async (date) => {
          const entry = byDate.get(date);
          if (!entry) return;
          await remove(entry.id);
          onToast('Today’s weight cleared', 'info');
          setIsOpen(false);
        }}
        onToast={onToast}
      />
    </section>
  );
}
