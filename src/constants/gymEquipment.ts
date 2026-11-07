import type { Equipment } from '../types/gym';

/**
 * The equipment actually available in the gym. Combined machines are ONE
 * entry each. The exercise library may only reference these ids (enforced
 * by unit tests).
 */
export const GYM_EQUIPMENT: readonly Equipment[] = [
  /* --- Machines & cables (Machines section) --- */
  {
    id: 'lat-row-machine',
    name: 'Lat Pulldown / Seated Row Machine',
    kind: 'MACHINE',
    supports: ['Lat Pulldown', 'Seated Cable Row'],
    allowedInAlternatives: false,
    note: 'One combined machine.',
  },
  {
    id: 'chest-shoulder-machine',
    name: 'Chest & Shoulder Press Machine',
    kind: 'MACHINE',
    supports: ['Chest Press', 'Flat Bench Press', 'Slight Incline Press', 'Shoulder Press'],
    allowedInAlternatives: false,
    note: 'One adjustable combined machine. Flat, slight-incline and shoulder-press positions only — no true decline.',
  },
  {
    id: 'pec-deck',
    name: 'Pec Deck / Rear Delt Fly Machine',
    kind: 'MACHINE',
    supports: ['Pec Deck Fly', 'Reverse Pec Deck (Rear Delt Fly)'],
    allowedInAlternatives: false,
  },
  {
    id: 'cable-station',
    name: 'Cable Crossover / Pulley Station',
    kind: 'CABLE',
    supports: ['Cable flys', 'Pushdowns', 'Cable curls', 'Cable raises', 'Face pulls', 'Crunches', 'Other cable variations'],
    allowedInAlternatives: false,
    note: 'Adjustable high and low pulleys with rope, straight-bar and handle attachments.',
  },
  { id: 'leg-press', name: 'Leg Press', kind: 'MACHINE', supports: ['Leg Press', 'Leg Press Calf Raise'], allowedInAlternatives: false },
  { id: 'leg-extension', name: 'Leg Extension', kind: 'MACHINE', supports: ['Leg Extension'], allowedInAlternatives: false },
  { id: 'leg-curl', name: 'Leg Curl', kind: 'MACHINE', supports: ['Leg Curl'], allowedInAlternatives: false },
  { id: 'seated-calf-raise', name: 'Seated Calf Raise', kind: 'MACHINE', supports: ['Seated Calf Raise'], allowedInAlternatives: false },
  { id: 'hip-abductor', name: 'Hip Abductor', kind: 'MACHINE', supports: ['Hip Abduction'], allowedInAlternatives: false },
  { id: 'hip-adductor', name: 'Hip Adductor', kind: 'MACHINE', supports: ['Hip Adduction'], allowedInAlternatives: false },
  { id: 'ab-crunch-machine', name: 'Ab Crunch Machine', kind: 'MACHINE', supports: ['Machine Crunch'], allowedInAlternatives: false },
  { id: 'forearm-machine', name: 'Forearm Machine', kind: 'MACHINE', supports: ['Wrist flexion', 'Wrist extension'], allowedInAlternatives: false },

  /* --- Machines that the Alternatives section may also use --- */
  { id: 'smith-machine', name: 'Smith Machine', kind: 'MACHINE', supports: ['Guided squats, presses, rows, RDLs and calf raises'], allowedInAlternatives: true },
  {
    id: 'assisted-pullup-dip',
    name: 'Assisted Pull-up / Dip Machine',
    kind: 'MACHINE',
    supports: ['Assisted Pull-up', 'Assisted Dip'],
    allowedInAlternatives: true,
    note: 'One combined machine. The weight you select is assistance — less assistance is harder.',
  },

  /* --- Benches --- */
  { id: 'adjustable-bench', name: 'Adjustable Incline / Decline Bench', kind: 'BENCH', supports: ['Flat, incline and decline work'], allowedInAlternatives: true },
  {
    id: 'preacher-bench',
    name: 'Preacher Curl Bench',
    kind: 'BENCH',
    supports: ['EZ-bar, dumbbell and barbell preacher curls'],
    allowedInAlternatives: true,
    note: 'A bench, not a preacher curl machine.',
  },

  /* --- Free weights, bands, bodyweight --- */
  { id: 'dumbbells', name: 'Dumbbells', kind: 'FREE_WEIGHT', supports: ['Dumbbell exercises'], allowedInAlternatives: true },
  { id: 'barbell', name: 'Barbell', kind: 'FREE_WEIGHT', supports: ['Barbell exercises'], allowedInAlternatives: true },
  { id: 'ez-bar', name: 'EZ Curl Bar', kind: 'FREE_WEIGHT', supports: ['EZ-bar curls, extensions and rows'], allowedInAlternatives: true },
  { id: 'resistance-bands', name: 'Resistance Bands', kind: 'BAND', supports: ['Band raises, pulls and crunches'], allowedInAlternatives: true },
  { id: 'bodyweight', name: 'Bodyweight', kind: 'BODYWEIGHT', supports: ['Push-ups, planks, crunches and more'], allowedInAlternatives: true },

  /* --- Cardio (not used by the strength library) --- */
  { id: 'treadmill', name: 'Treadmill', kind: 'CARDIO', supports: ['Walking, running, warm-ups'], allowedInAlternatives: true },
  { id: 'exercise-cycle', name: 'Exercise Cycle', kind: 'CARDIO', supports: ['Cycling, warm-ups'], allowedInAlternatives: true },
];

export const EQUIPMENT_BY_ID: ReadonlyMap<string, Equipment> = new Map(GYM_EQUIPMENT.map((item) => [item.id, item]));

export function getEquipmentNames(ids: readonly string[]): string[] {
  return ids.map((id) => EQUIPMENT_BY_ID.get(id)?.name ?? id);
}
