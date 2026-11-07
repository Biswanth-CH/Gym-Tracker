import type { MuscleGroup, MuscleGroupId, MuscleRegion } from '../types/gym';

/**
 * The eight trained muscle groups and their regions / heads.
 * Region ids are globally unique so they can be used on their own.
 */
const group = (
  id: MuscleGroupId,
  name: string,
  description: string,
  emphasisNote: string,
  regions: Array<Omit<MuscleRegion, 'muscleGroupId'>>,
): MuscleGroup => ({
  id,
  name,
  description,
  emphasisNote,
  regions: regions.map((region) => ({ ...region, muscleGroupId: id })),
});

export const MUSCLE_GROUPS: readonly MuscleGroup[] = [
  group(
    'chest',
    'Chest',
    'The pectoralis major moves the upper arm across and in front of the body.',
    'The pectoralis major works as one muscle in every press and fly. Bench angle and arm path shift the emphasis toward the upper (clavicular) or lower (sternocostal) fibres — they never fully isolate one part.',
    [
      { id: 'upper-chest', name: 'Upper Chest', anatomicalName: 'Clavicular head of pectoralis major', description: 'Emphasised by incline pressing and low-to-high fly paths.' },
      { id: 'middle-chest', name: 'Middle Chest', anatomicalName: 'Sternocostal head (mid fibres)', description: 'Emphasised by flat pressing and horizontal fly paths.' },
      { id: 'lower-chest', name: 'Lower Chest', anatomicalName: 'Sternocostal head (lower / abdominal fibres)', description: 'Emphasised by decline pressing, dips and high-to-low fly paths.' },
    ],
  ),
  group(
    'shoulders',
    'Shoulders',
    'The deltoid caps the shoulder and has three parts that raise the arm in different directions.',
    'All three deltoid parts help stabilise most shoulder movements. Pressing favours the front delts, raises out to the side favour the lateral delts, and reverse flys and rows favour the rear delts.',
    [
      { id: 'front-delts', name: 'Front Deltoid', anatomicalName: 'Anterior deltoid', description: 'Raises the arm forward; heavily involved in pressing.' },
      { id: 'lateral-delts', name: 'Lateral Deltoid', anatomicalName: 'Lateral (middle) deltoid', description: 'Raises the arm out to the side; gives shoulder width.' },
      { id: 'rear-delts', name: 'Rear Deltoid', anatomicalName: 'Posterior deltoid', description: 'Pulls the arm backward and out; supports posture.' },
    ],
  ),
  group(
    'triceps',
    'Triceps',
    'The triceps brachii straightens the elbow. It has three heads that share one tendon.',
    'All three triceps heads contribute to every elbow-extension exercise. Arm position changes the emphasis: overhead work stretches the long head (it also crosses the shoulder), while pushdowns favour the lateral and medial heads.',
    [
      { id: 'triceps-long-head', name: 'Long Head', anatomicalName: 'Triceps brachii — long head', description: 'Crosses the shoulder joint, so it is emphasised with the arm overhead.' },
      { id: 'triceps-lateral-head', name: 'Lateral Head', anatomicalName: 'Triceps brachii — lateral head', description: 'Outer part of the back of the arm; strong in pushdowns and presses.' },
      { id: 'triceps-medial-head', name: 'Medial Head', anatomicalName: 'Triceps brachii — medial head', description: 'Deep head near the elbow; active in nearly all elbow extension.' },
    ],
  ),
  group(
    'biceps',
    'Biceps',
    'The biceps brachii (two heads) and the brachialis bend the elbow; the biceps also turns the palm up.',
    'The biceps brachii has two heads: long and short. The brachialis is a separate muscle underneath that flexes the elbow in any grip. Grip and arm position shift emphasis; no curl works only one head.',
    [
      { id: 'biceps-long-head', name: 'Long Head', anatomicalName: 'Biceps brachii — long head', description: 'Outer head; emphasised when the arm is behind the body (e.g. incline curls).' },
      { id: 'biceps-short-head', name: 'Short Head', anatomicalName: 'Biceps brachii — short head', description: 'Inner head; emphasised when the arm is in front of the body (e.g. preacher curls).' },
      { id: 'brachialis', name: 'Brachialis', anatomicalName: 'Brachialis (separate muscle)', description: 'Lies under the biceps; emphasised with neutral and palms-down grips.' },
    ],
  ),
  group(
    'back',
    'Back',
    'The back muscles pull the arms down and back and keep the spine upright.',
    'Rows and pulldowns train several back muscles together. Vertical pulls favour the lats, horizontal rows favour the mid back, shrugs and face pulls the upper back, and hip hinges the lower back.',
    [
      { id: 'lats', name: 'Latissimus Dorsi (Lats)', anatomicalName: 'Latissimus dorsi', description: 'Large wing-shaped muscle that pulls the arms down and back.' },
      { id: 'upper-back', name: 'Upper Back', anatomicalName: 'Upper trapezius, levator scapulae', description: 'Elevates and stabilises the shoulder blades.' },
      { id: 'mid-back', name: 'Mid Back', anatomicalName: 'Rhomboids, middle trapezius', description: 'Squeezes the shoulder blades together.' },
      { id: 'lower-back', name: 'Lower Back', anatomicalName: 'Erector spinae', description: 'Keeps the spine extended during hinges and lifts.' },
    ],
  ),
  group(
    'forearms',
    'Forearms',
    'Forearm muscles move the wrist and fingers and provide grip strength.',
    'Grip work trains many forearm muscles at once. Palms-up wrist curls favour the flexors, palms-down work favours the extensors, and neutral or reverse grips involve the brachioradialis.',
    [
      { id: 'forearm-flexors', name: 'Forearm Flexors', anatomicalName: 'Wrist & finger flexors', description: 'Palm side of the forearm; bend the wrist and close the hand.' },
      { id: 'forearm-extensors', name: 'Forearm Extensors', anatomicalName: 'Wrist & finger extensors', description: 'Back of the forearm; extend the wrist and open the hand.' },
      { id: 'brachioradialis', name: 'Brachioradialis', anatomicalName: 'Brachioradialis', description: 'Top of the forearm; flexes the elbow in a neutral grip.' },
    ],
  ),
  group(
    'legs',
    'Legs',
    'The legs and hips extend the knee and hip, and the calves point the foot.',
    'Squats, presses and lunges train quads, glutes and adductors together; hinges train hamstrings and glutes together. Machine choice and foot position shift the emphasis, they do not isolate.',
    [
      { id: 'quadriceps', name: 'Quadriceps', anatomicalName: 'Rectus femoris, vastus lateralis / medialis / intermedius', description: 'Front of the thigh; straighten the knee.' },
      { id: 'hamstrings', name: 'Hamstrings', anatomicalName: 'Biceps femoris, semitendinosus, semimembranosus', description: 'Back of the thigh; bend the knee and extend the hip.' },
      { id: 'glutes', name: 'Glutes', anatomicalName: 'Gluteus maximus, medius & minimus', description: 'Extend the hip (maximus) and move the leg out to the side (medius & minimus).' },
      { id: 'calves', name: 'Calves', anatomicalName: 'Gastrocnemius, soleus', description: 'Point the foot; bent-knee work favours the soleus.' },
      { id: 'adductors', name: 'Adductors', anatomicalName: 'Adductor longus, brevis & magnus, gracilis, pectineus', description: 'Inner thigh; bring the legs together and help stabilise the hips in squats and lunges.' },
    ],
  ),
  group(
    'abs',
    'Abs',
    'The abdominal wall flexes and rotates the trunk and stabilises the spine.',
    'The rectus abdominis is one long muscle, so "upper" and "lower" abs always work together. Curling the ribs down favours the upper portion, curling the pelvis up favours the lower portion, and rotation or side bending favours the obliques.',
    [
      { id: 'upper-abs', name: 'Upper Abs', anatomicalName: 'Rectus abdominis (upper portion)', description: 'Emphasised by crunching the ribcage toward the pelvis.' },
      { id: 'lower-abs', name: 'Lower Abs', anatomicalName: 'Rectus abdominis (lower portion)', description: 'Emphasised by curling the pelvis toward the ribcage.' },
      { id: 'obliques', name: 'Obliques', anatomicalName: 'External & internal obliques', description: 'Sides of the waist; rotate, side-bend and resist rotation.' },
    ],
  ),
];

export const MUSCLE_GROUPS_BY_ID = Object.fromEntries(MUSCLE_GROUPS.map((g) => [g.id, g])) as Record<
  MuscleGroupId,
  MuscleGroup
>;

const REGIONS_BY_ID = new Map<string, MuscleRegion>(MUSCLE_GROUPS.flatMap((g) => g.regions.map((r) => [r.id, r])));

export function isMuscleGroupId(value: string): value is MuscleGroupId {
  return value in MUSCLE_GROUPS_BY_ID;
}

export function getMuscleRegion(regionId: string): MuscleRegion | undefined {
  return REGIONS_BY_ID.get(regionId);
}
