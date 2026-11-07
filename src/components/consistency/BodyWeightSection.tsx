import { useMemo, useState } from 'react';
import { Plus, Scale, Trash2 } from 'lucide-react';
import { useBodyWeight } from '../../hooks/useBodyWeight';
import { errorMessage } from '../../services/cloud/cloudErrors';
import { validateBodyWeight } from '../../services/cloud/bodyWeightService';
import type { DateKey, Profile, WeightUnit } from '../../types/gym';
import {
  compareWeightPeriods,
  customWindow,
  formatAverage,
  formatWeightComparison,
  pointsInWindow,
  rollingWindow,
  type ComparisonPeriodLabel,
} from '../../utils/bodyWeightAnalytics';
import { formatShortDate } from '../../utils/dateUtils';
import { convertWeight, formatNumber, parseNumberInput } from '../../utils/workoutUtils';
import { ConfirmDialog } from '../ConfirmDialog';
import { Modal } from '../Modal';
import { BodyWeightChart } from './BodyWeightChart';

interface BodyWeightSectionProps {
  profile: Profile;
  todayKey: DateKey;
  onToast: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

type RangeMode = 'week' | 'month' | 'custom';

const PERIOD_LABEL: Record<RangeMode, ComparisonPeriodLabel> = { week: 'week', month: 'month', custom: 'period' };

export function BodyWeightSection({ profile, todayKey, onToast }: BodyWeightSectionProps) {
  const { entries, byDate, save, remove } = useBodyWeight(profile.id);
  const [unit, setUnit] = useState<WeightUnit>('KG');
  const [mode, setMode] = useState<RangeMode>('week');
  const [customStart, setCustomStart] = useState(todayKey);
  const [customEnd, setCustomEnd] = useState(todayKey);
  const [appliedCustom, setAppliedCustom] = useState<{ start: DateKey; end: DateKey } | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const window = useMemo(() => {
    if (mode === 'week') return rollingWindow(todayKey, 7);
    if (mode === 'month') return rollingWindow(todayKey, 30);
    if (!appliedCustom) return null;
    const next = customWindow(appliedCustom.start, appliedCustom.end, todayKey);
    return typeof next === 'string' ? null : next;
  }, [mode, todayKey, appliedCustom]);

  const points = useMemo(() => entries.map((entry) => ({ date: entry.date, weightKg: entry.weightKg })), [entries]);
  const comparison = window ? compareWeightPeriods(points, window) : null;
  const visible = window ? pointsInWindow(points, window.start, window.end) : [];
  const summary = comparison
    ? formatWeightComparison(comparison, unit, PERIOD_LABEL[mode])
    : rangeError ?? 'Choose a start and end date, then tap Apply.';

  const applyCustom = () => {
    const next = customWindow(customStart, customEnd, todayKey);
    if (typeof next === 'string') {
      setRangeError(next);
      return;
    }
    setRangeError(null);
    setAppliedCustom({ start: customStart, end: customEnd });
    setMode('custom');
  };

  const resetRange = () => {
    setMode('week');
    setAppliedCustom(null);
    setCustomStart(todayKey);
    setCustomEnd(todayKey);
    setRangeError(null);
  };

  return (
    <section className="detail-card weight-card" aria-labelledby="weight-heading">
      <div className="weight-card__header">
        <h2 id="weight-heading" className="detail-card__title">
          <Scale size={16} aria-hidden="true" /> Body Weight
        </h2>
        <button type="button" className="button button--primary button--compact" onClick={() => setLogging(true)}>
          <Plus size={16} aria-hidden="true" /> Log Today’s Weight
        </button>
      </div>

      <div className="segmented weight-card__ranges" role="group" aria-label="Weight graph range">
        {(
          [
            ['week', 'Last Week'],
            ['month', 'Last Month'],
            ['custom', 'Custom Range'],
          ] as const
        ).map(([value, label]) => (
          <button key={value} type="button" className={`segmented__option${mode === value ? ' is-active' : ''}`} aria-pressed={mode === value} onClick={() => setMode(value)}>
            {label}
          </button>
        ))}
      </div>

      {mode === 'custom' && (
        <div className="weight-card__custom">
          <label className="field">
            <span className="field__label">Start</span>
            <input className="field__input" type="date" max={todayKey} value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">End</span>
            <input className="field__input" type="date" max={todayKey} value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
          </label>
          <div className="weight-card__custom-actions">
            <button type="button" className="button button--primary button--compact" onClick={applyCustom}>
              Apply
            </button>
            <button type="button" className="button button--ghost button--compact" onClick={resetRange}>
              Reset
            </button>
          </div>
        </div>
      )}

      <p className="weight-card__summary" data-testid="weight-summary">
        {summary}
      </p>
      {comparison && comparison.tone !== 'insufficient' && (
        <p className="weight-card__averages">
          Current average {formatAverage(comparison.currentAverageKg, unit)} · Previous average {formatAverage(comparison.previousAverageKg, unit)} · {unit === 'KG' ? 'kg' : 'lb'}
        </p>
      )}
      {window && <BodyWeightChart points={visible} unit={unit} start={window.start} end={window.end} />}

      {entries.length > 0 && (
        <ul className="weight-list" aria-label="Saved body weight">
          {[...entries].reverse().slice(0, 8).map((entry) => (
            <li key={entry.id} className="weight-list__row">
              <span>{formatShortDate(entry.date)}</span>
              <strong>
                {formatNumber(convertWeight(entry.weightKg, 'KG', unit))} {unit === 'KG' ? 'kg' : 'lb'}
              </strong>
              <button type="button" className="icon-button" aria-label={`Delete weight for ${formatShortDate(entry.date)}`} onClick={() => setPendingDeleteId(entry.id)}>
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <WeightLogModal
        isOpen={logging}
        todayKey={todayKey}
        unit={unit}
        onUnit={setUnit}
        existing={byDate}
        onClose={() => setLogging(false)}
        onSave={async (date, weight, nextUnit) => {
          await save(date, weight, nextUnit);
          onToast('Body weight saved');
          setLogging(false);
        }}
        onToast={onToast}
      />
      <ConfirmDialog
        isOpen={pendingDeleteId !== null}
        title="Delete this weight?"
        description="This removes the body-weight entry for that day. Workout sets and personal records stay as they are."
        confirmLabel="Delete"
        destructive
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          const id = pendingDeleteId;
          setPendingDeleteId(null);
          if (!id) return;
          void remove(id)
            .then(() => onToast('Body weight deleted', 'info'))
            .catch((error) => onToast(errorMessage(error, 'Could not delete the body weight.'), 'error'));
        }}
      />
    </section>
  );
}

function WeightLogModal({
  isOpen,
  todayKey,
  unit,
  onUnit,
  existing,
  onClose,
  onSave,
  onToast,
}: {
  isOpen: boolean;
  todayKey: DateKey;
  unit: WeightUnit;
  onUnit: (unit: WeightUnit) => void;
  existing: Map<DateKey, { weightKg: number }>;
  onClose: () => void;
  onSave: (date: DateKey, weight: number, unit: WeightUnit) => Promise<void>;
  onToast: (message: string, tone?: 'success' | 'error' | 'info') => void;
}) {
  const [date, setDate] = useState(todayKey);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openKey = isOpen ? 'open' : 'closed';
  const [seen, setSeen] = useState(openKey);
  if (openKey !== seen) {
    setSeen(openKey);
    if (isOpen) {
      const current = existing.get(todayKey);
      setDate(todayKey);
      setText(current ? formatNumber(convertWeight(current.weightKg, 'KG', unit)) : '');
      setError(null);
      setSaving(false);
    }
  }

  const changeDate = (next: DateKey) => {
    setDate(next);
    const found = existing.get(next);
    setText(found ? formatNumber(convertWeight(found.weightKg, 'KG', unit)) : '');
    setError(null);
  };

  const changeUnit = (next: WeightUnit) => {
    if (next === unit) return;
    const parsed = parseNumberInput(text);
    onUnit(next);
    if (parsed !== null) setText(formatNumber(convertWeight(parsed, unit, next)));
  };

  const submit = async () => {
    const parsed = parseNumberInput(text);
    const problem = validateBodyWeight(date, parsed, unit);
    if (problem || parsed === null) {
      setError(problem ?? 'Enter a weight greater than zero.');
      return;
    }
    setSaving(true);
    try {
      await onSave(date, parsed, unit);
    } catch (saveError) {
      setError(errorMessage(saveError, 'Could not save body weight.'));
      onToast(errorMessage(saveError, 'Could not save body weight.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={existing.has(date) ? 'Edit body weight' : 'Log body weight'} placement="top">
      <div className="form">
        <label className="field">
          <span className="field__label">Date</span>
          <input className="field__input" type="date" max={todayKey} value={date} onChange={(event) => changeDate(event.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">Weight</span>
          <input className="field__input" inputMode="decimal" value={text} onChange={(event) => setText(event.target.value)} />
        </label>
        <div className="segmented" role="group" aria-label="Weight unit">
          {(['KG', 'LB'] as const).map((option) => (
            <button key={option} type="button" className={`segmented__option${unit === option ? ' is-active' : ''}`} aria-pressed={unit === option} onClick={() => changeUnit(option)}>
              {option === 'KG' ? 'kg' : 'lb'}
            </button>
          ))}
        </div>
        {existing.has(date) && <p className="photo-picker__hint">A weight is already saved for this date. Saving updates that entry only.</p>}
        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}
        <div className="modal__actions">
          <button type="button" className="button button--ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="button button--primary" onClick={() => void submit()} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
