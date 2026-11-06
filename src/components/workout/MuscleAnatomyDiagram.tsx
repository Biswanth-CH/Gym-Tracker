import { memo } from 'react';
import { MUSCLE_GROUPS_BY_ID, getMuscleRegion } from '../../constants/muscleGroups';
import type { AnatomyView, MuscleGroupId } from '../../types/gym';

/**
 * Original, simplified front/back body diagrams (educational, not clinical).
 * Each region is drawn once for the left half (x < 100) and mirrored.
 * Coordinates live in a 200 × 400 viewBox per view.
 */

type RegionShapes = Partial<Record<AnatomyView, string[]>>;

export const REGION_SHAPES: Record<string, RegionShapes> = {
  // Chest (front)
  'upper-chest': { front: ['M78 76 L99 78 L99 92 L68 98 C70 88 73 81 78 76 Z'] },
  'middle-chest': { front: ['M68 98 L99 92 L99 108 L68 112 C67 106 67 102 68 98 Z'] },
  'lower-chest': { front: ['M68 112 L99 108 L99 120 C90 126 78 124 72 120 C70 118 68 115 68 112 Z'] },
  // Shoulders
  'front-delts': { front: ['M66 74 C60 78 56 86 54 96 L64 100 C66 90 70 82 78 76 C74 72 70 72 66 74 Z'] },
  'lateral-delts': {
    front: ['M64 68 C54 70 47 80 47 94 L54 96 C56 86 60 78 66 74 Z'],
    back: ['M64 68 C54 70 47 80 47 94 L54 96 C56 86 60 78 66 74 Z'],
  },
  'rear-delts': { back: ['M66 74 C60 78 56 86 54 96 L64 98 C66 90 70 84 80 78 C76 74 70 72 66 74 Z'] },
  // Triceps (back of upper arm)
  'triceps-lateral-head': { back: ['M49 98 L57 100 C55 114 54 128 55 138 L49 134 C47 122 47 110 49 98 Z'] },
  'triceps-long-head': { back: ['M57 100 L66 102 C66 116 64 130 61 142 L55 140 C54 128 55 114 57 100 Z'] },
  'triceps-medial-head': { back: ['M50 136 L61 144 L59 150 L51 148 C50 144 49 140 50 136 Z'] },
  // Biceps & brachialis (front of upper arm)
  'biceps-long-head': { front: ['M50 100 L57 102 C56 116 56 128 57 140 L51 138 C48 126 48 112 50 100 Z'] },
  'biceps-short-head': { front: ['M57 102 L65 104 C66 116 65 128 62 142 L57 140 C56 128 56 116 57 102 Z'] },
  brachialis: { front: ['M48 130 L51 138 L57 140 L56 148 L49 146 C47 141 47 135 48 130 Z'] },
  // Forearms
  brachioradialis: { front: ['M48 150 L55 150 C54 162 51 174 47 184 L45 182 C45 170 46 160 48 150 Z'] },
  'forearm-flexors': { front: ['M55 150 L63 151 C62 168 59 186 56 202 L48 202 C50 188 53 168 55 150 Z'] },
  'forearm-extensors': { back: ['M48 152 L62 152 C61 170 58 188 54 204 L46 202 C46 186 46 168 48 152 Z'] },
  // Back
  'upper-back': { back: ['M88 54 L99 52 L99 90 L86 82 L72 72 C78 66 84 60 88 54 Z'] },
  'mid-back': { back: ['M86 84 L99 92 L99 124 L90 118 C88 106 87 94 86 84 Z'] },
  lats: { back: ['M70 90 L85 86 C87 100 89 116 91 128 L96 148 C88 156 78 158 74 148 C70 130 68 110 70 90 Z'] },
  'lower-back': { back: ['M91 130 L99 130 L99 190 L90 190 C88 170 88 150 91 130 Z'] },
  // Abs (front)
  'upper-abs': { front: ['M88 126 L99 126 L99 154 L88 154 C87 144 87 134 88 126 Z'] },
  'lower-abs': { front: ['M88 157 L99 157 L99 194 C94 194 90 188 89 178 C88 170 88 163 88 157 Z'] },
  obliques: { front: ['M70 126 L85 128 L86 186 C80 180 75 166 72 150 C71 142 70 134 70 126 Z'] },
  // Legs
  quadriceps: { front: ['M72 222 L89 226 C88 246 90 266 94 282 L93 300 L80 300 C74 280 70 252 72 222 Z'] },
  // Inner thigh: visible from the front, and adductor magnus from behind (inside the hamstrings).
  adductors: {
    front: ['M89 226 L99 230 C99 248 98 266 94 282 C90 266 88 246 89 226 Z'],
    back: ['M92 238 L99 236 C99 254 98 270 96 282 C93 268 91 252 92 238 Z'],
  },
  glutes: { back: ['M72 196 C82 192 94 194 99 198 L99 228 C90 234 78 232 72 224 C70 214 70 204 72 196 Z'] },
  hamstrings: { back: ['M73 236 C82 238 88 238 92 238 C91 254 93 270 96 282 L93 302 L80 302 C74 282 72 258 73 236 Z'] },
  calves: { back: ['M78 312 C86 309 94 311 96 318 C96 336 92 352 88 362 L82 362 C78 350 76 334 78 312 Z'] },
};

/** Muted body silhouette, left half (mirrored like the muscles). */
const SILHOUETTE_HALF = [
  'M100 64 L88 64 L90 50 L100 50 Z', // neck
  'M100 62 Q80 62 64 68 L66 120 Q70 160 74 196 L100 196 Z', // torso
  'M74 192 L100 192 L100 230 Q84 230 70 222 Z', // pelvis
  'M64 70 Q50 74 47 100 L45 148 L64 151 L68 104 Z', // upper arm
  'M45 148 L64 151 L58 206 L44 204 Z', // forearm
  'M70 214 L100 222 L98 306 L76 306 Q68 260 70 214 Z', // thigh
  'M76 306 L98 306 L94 372 L82 372 Z', // shin
];

type HighlightState = 'active' | 'group' | 'idle';

interface MuscleAnatomyDiagramProps {
  muscleGroupId?: MuscleGroupId;
  /** When set, this region is highlighted strongly and the rest of its group softly. */
  regionId?: string;
  size?: 'sm' | 'md';
  /** Hide the "Front / Back" captions (e.g. on small cards). */
  compact?: boolean;
}

function stateFor(regionId: string, groupRegionIds: ReadonlySet<string>, activeRegionId?: string): HighlightState {
  if (activeRegionId) {
    if (regionId === activeRegionId) return 'active';
    return groupRegionIds.has(regionId) ? 'group' : 'idle';
  }
  return groupRegionIds.has(regionId) ? 'active' : 'idle';
}

function BodyView({
  view,
  groupRegionIds,
  activeRegionId,
}: {
  view: AnatomyView;
  groupRegionIds: ReadonlySet<string>;
  activeRegionId?: string;
}) {
  const half = (
    <>
      {SILHOUETTE_HALF.map((d) => (
        <path key={d} d={d} className="anatomy__body" />
      ))}
      {Object.entries(REGION_SHAPES).flatMap(([regionId, shapes]) =>
        (shapes[view] ?? []).map((d, index) => {
          const state = stateFor(regionId, groupRegionIds, activeRegionId);
          return <path key={`${regionId}-${index}`} d={d} className={`anatomy__muscle anatomy__muscle--${state}`} data-region={regionId} data-state={state} />;
        }),
      )}
    </>
  );

  return (
    <svg className="anatomy__view" viewBox="0 0 200 400" aria-hidden="true" focusable="false" data-view={view}>
      <ellipse cx="100" cy="30" rx="17" ry="21" className="anatomy__body" />
      {half}
      <g transform="translate(200 0) scale(-1 1)">{half}</g>
      <ellipse cx="50" cy="216" rx="7" ry="11" className="anatomy__body" />
      <ellipse cx="150" cy="216" rx="7" ry="11" className="anatomy__body" />
      <ellipse cx="88" cy="380" rx="10" ry="6" className="anatomy__body" />
      <ellipse cx="112" cy="380" rx="10" ry="6" className="anatomy__body" />
    </svg>
  );
}

export const MuscleAnatomyDiagram = memo(function MuscleAnatomyDiagram({
  muscleGroupId,
  regionId,
  size = 'md',
  compact = false,
}: MuscleAnatomyDiagramProps) {
  const group = muscleGroupId ? MUSCLE_GROUPS_BY_ID[muscleGroupId] : undefined;
  const groupRegionIds = new Set(group?.regions.map((region) => region.id) ?? []);
  const region = regionId ? getMuscleRegion(regionId) : undefined;
  const label = region
    ? `Body diagram highlighting ${region.name} (${group?.name ?? ''})`
    : group
      ? `Body diagram highlighting the ${group.name.toLowerCase()}`
      : 'Body diagram';

  return (
    <div className={`anatomy anatomy--${size}`} role="img" aria-label={label}>
      {(['front', 'back'] as const).map((view) => (
        <div key={view} className="anatomy__panel">
          <BodyView view={view} groupRegionIds={groupRegionIds} activeRegionId={regionId} />
          {!compact && (
            <span className="anatomy__caption" aria-hidden="true">
              {view === 'front' ? 'Front' : 'Back'}
            </span>
          )}
        </div>
      ))}
    </div>
  );
});
