import { useState } from 'react';
import type { WeightUnit } from '../../types/gym';
import type { WeightPoint } from '../../utils/bodyWeightAnalytics';
import { formatShortDate } from '../../utils/dateUtils';
import { convertWeight, formatNumber, unitLabel } from '../../utils/workoutUtils';
import { buildWeightAxisTicks } from '../../utils/weightAxis';

interface BodyWeightChartProps {
  points: readonly WeightPoint[];
  unit: WeightUnit;
  start: string;
  end: string;
}

/** Lightweight SVG line chart. Positions points by date and never fills missing days. */
export function BodyWeightChart({ points, unit, start, end }: BodyWeightChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  if (points.length === 0) {
    return <p className="weight-chart__empty">No weight entries in this range.</p>;
  }

  const width = 320;
  const height = 184;
  const pad = { left: 36, right: 14, top: 16, bottom: 40 };
  const values = points.map((point) => convertWeight(point.weightKg, 'KG', unit));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const startTime = new Date(`${start}T00:00:00`).getTime();
  const endTime = new Date(`${end}T00:00:00`).getTime();
  const timeSpan = Math.max(1, endTime - startTime);

  const plotWidth = width - pad.left - pad.right;
  const xForTick = (date: string) => pad.left + ((new Date(`${date}T00:00:00`).getTime() - startTime) / timeSpan) * plotWidth;
  const ticks = buildWeightAxisTicks(start, end);
  // Every point sits at its real date, so it lines up with the date ticks below.
  const xFor = xForTick;
  const yFor = (value: number) => pad.top + (1 - (value - min) / span) * (height - pad.top - pad.bottom);
  const coords = points.map((point, index) => ({ x: xFor(point.date), y: yFor(values[index]), point, value: values[index] }));
  const line = coords.map((coord) => `${coord.x},${coord.y}`).join(' ');
  const active = activeIndex === null ? null : coords[activeIndex];

  return (
    <div className="weight-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Body weight chart">
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={height - pad.bottom} className="weight-chart__axis" />
        <line x1={pad.left} y1={height - pad.bottom} x2={width - pad.right} y2={height - pad.bottom} className="weight-chart__axis" />
        <text x={4} y={pad.top + 4} className="weight-chart__tick">
          {formatNumber(max)}
        </text>
        <text x={4} y={height - pad.bottom} className="weight-chart__tick">
          {formatNumber(min)}
        </text>
        {ticks.map((tick) => {
          const x = xForTick(tick.dateKey);
          // Keep edge labels inside the chart instead of clipping them.
          const anchor = x < pad.left + 14 ? 'start' : x > width - pad.right - 14 ? 'end' : 'middle';
          return (
            <g key={tick.dateKey} className="weight-chart__x-tick" data-testid="weight-axis-tick">
              <line x1={x} y1={height - pad.bottom} x2={x} y2={height - pad.bottom + 4} className="weight-chart__axis" />
              <text x={x} y={height - pad.bottom + 15} textAnchor={anchor} className="weight-chart__tick">
                {tick.label}
              </text>
              {tick.sublabel && (
                <text x={x} y={height - pad.bottom + 27} textAnchor={anchor} className="weight-chart__tick weight-chart__tick--sub">
                  {tick.sublabel}
                </text>
              )}
            </g>
          );
        })}
        {coords.length > 1 && <polyline points={line} className="weight-chart__line" />}
        {coords.map((coord, index) => (
          <g key={coord.point.date}>
            <circle
              cx={coord.x}
              cy={coord.y}
              r={activeIndex === index ? 5.5 : 4}
              className="weight-chart__dot"
              tabIndex={0}
              role="button"
              aria-label={`${formatShortDate(coord.point.date)}: ${formatNumber(coord.value)} ${unitLabel(unit)}`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(index)}
              onBlur={() => setActiveIndex(null)}
            >
              <title>
                {formatShortDate(coord.point.date)}: {formatNumber(coord.value)} {unitLabel(unit)}
              </title>
            </circle>
          </g>
        ))}
      </svg>
      {active && (
        <p className="weight-chart__tooltip" role="status">
          {formatShortDate(active.point.date)} · {formatNumber(active.value)} {unitLabel(unit)}
        </p>
      )}
    </div>
  );
}
