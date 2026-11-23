import { useEffect, useId, useRef, useState } from 'react';
import { Info, X } from 'lucide-react';
import { DAY_STATE_LABELS, LEGEND_ORDER, WORKOUT_DOT_LABEL } from './attendanceLabels';

/** The attendance colour legend (same states and labels as before Phase 7). */
export function AttendanceLegend() {
  return (
    <ul className="heatmap-legend" aria-label="Attendance colours">
      {LEGEND_ORDER.map((state) => (
        <li key={state}>
          <span className={`heatmap__cell heatmap__cell--${state}`} aria-hidden="true" />
          {state === 'future' ? 'Future / not tracked' : DAY_STATE_LABELS[state]}
        </li>
      ))}
      <li>
        <span className="heatmap__cell heatmap__cell--unmarked heatmap__cell--has-workout" aria-hidden="true" />
        {WORKOUT_DOT_LABEL}
      </li>
    </ul>
  );
}

/** Small "i" button that shows the legend in a popover (closes on ✕, Escape or a click outside). */
export function AttendanceColourInfo() {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [isOpen]);

  return (
    <div className="colour-info" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        className="icon-button colour-info__button"
        aria-label="Colour info"
        aria-expanded={isOpen}
        aria-controls={panelId}
        title="Colour info"
        onClick={() => setIsOpen((open) => !open)}
        data-testid="colour-info-button"
      >
        <Info size={18} aria-hidden="true" />
      </button>
      {isOpen && (
        <div id={panelId} className="colour-info__panel" role="dialog" aria-label="Attendance colours" data-testid="colour-info-panel">
          <div className="colour-info__header">
            <strong>What the colours mean</strong>
            <button type="button" className="icon-button colour-info__close" aria-label="Close colour info" onClick={() => setIsOpen(false)} data-testid="colour-info-close">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <AttendanceLegend />
        </div>
      )}
    </div>
  );
}
