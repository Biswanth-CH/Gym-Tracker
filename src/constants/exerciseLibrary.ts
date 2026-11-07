import type {
  Difficulty,
  ExerciseCategory,
  ExerciseMedia,
  ExerciseTarget,
  LibraryExercise,
  LoadType,
  MuscleGroupId,
  SetMeasure,
} from '../types/gym';

/**
 * Exercise library built ONLY from the gym's confirmed equipment
 * (see gymEquipment.ts). Unit tests enforce:
 *  - every equipment id exists in the inventory,
 *  - MACHINE exercises use a machine or the cable station,
 *  - ALTERNATIVE exercises never use machines reserved for the Machines section,
 *  - every RepDB image id exists in the RepDB free dataset with the stated pose count.
 *
 * Recommended sets / reps are general starting suggestions, not prescriptions.
 */

const t = (muscleGroupId: MuscleGroupId, regionId: string): ExerciseTarget => ({ muscleGroupId, regionId });
const img = (repdbId: string, poseCount: 1 | 2 = 2, imageNote?: string): ExerciseMedia =>
  imageNote ? { repdbId, poseCount, imageNote } : { repdbId, poseCount };
const NO_IMAGE: ExerciseMedia = {};

interface ExerciseInput {
  id: string;
  name: string;
  targets: ExerciseTarget[];
  category: ExerciseCategory;
  equipment: string[];
  primary: string[];
  secondary?: string[];
  steps: string[];
  mistakes: string[];
  difficulty?: Difficulty;
  sets?: number;
  reps?: [number, number];
  load?: LoadType;
  measure?: SetMeasure;
  setupNote?: string;
  media?: ExerciseMedia;
}

const ex = (input: ExerciseInput): LibraryExercise => ({
  id: input.id,
  name: input.name,
  targets: input.targets,
  category: input.category,
  equipment: input.equipment,
  primaryMuscles: input.primary,
  secondaryMuscles: input.secondary ?? [],
  instructions: input.steps,
  commonMistakes: input.mistakes,
  difficulty: input.difficulty ?? 'BEGINNER',
  recommendedSets: input.sets ?? 3,
  recommendedRepRange: { min: (input.reps ?? [8, 12])[0], max: (input.reps ?? [8, 12])[1] },
  loadType: input.load ?? 'WEIGHTED',
  measure: input.measure ?? 'REPS',
  setupNote: input.setupNote,
  media: input.media ?? NO_IMAGE,
});

const BENCH_SETUP_NOTE =
  'Needs bench uprights or a spotter to unrack the bar. If neither is available, use the Smith machine version.';

export const EXERCISE_LIBRARY: readonly LibraryExercise[] = [
  /* ================= CHEST — Upper ================= */
  ex({
    id: 'machine-incline-chest-press', media: { customId: 'machine-incline-chest-press', poseCount: 2 }, name: 'Incline Chest Press (Machine)', category: 'MACHINE',
    targets: [t('chest', 'upper-chest')], equipment: ['chest-shoulder-machine'],
    primary: ['Pectoralis major (clavicular head)'], secondary: ['Anterior deltoid', 'Triceps'],
    steps: [
      'Set the combined machine to its slight-incline position and adjust the seat so the handles line up with your upper chest.',
      'Sit with your back flat against the pad, feet planted, shoulder blades gently pulled back.',
      'Press the handles up and away until your arms are almost straight.',
      'Lower under control until you feel a stretch across the upper chest, then press again.',
    ],
    mistakes: ['Shrugging the shoulders toward the ears.', 'Locking the elbows hard at the top.', 'Letting the lower back arch off the pad.'],
  }),
  ex({
    id: 'incline-cable-fly', media: { customId: 'incline-cable-fly', poseCount: 2 }, name: 'Incline Cable Fly', category: 'MACHINE',
    targets: [t('chest', 'upper-chest')], equipment: ['cable-station', 'adjustable-bench'],
    primary: ['Pectoralis major (clavicular head)'], secondary: ['Anterior deltoid'], difficulty: 'INTERMEDIATE', reps: [10, 15],
    steps: [
      'Place an incline bench (about 30°) between the low pulleys and attach single handles.',
      'Lie back holding the handles above your chest with a slight bend in the elbows.',
      'Open your arms in a wide arc until you feel a stretch across the chest.',
      'Bring the handles back together over your upper chest, keeping the elbow bend fixed.',
    ],
    mistakes: ['Turning the fly into a press by bending the elbows more.', 'Using so much weight that the shoulders roll forward.'],
  }),
  ex({
    id: 'low-to-high-cable-fly', media: { customId: 'low-to-high-cable-fly', poseCount: 2 }, name: 'Low-to-High Cable Fly', category: 'MACHINE',
    targets: [t('chest', 'upper-chest')], equipment: ['cable-station'],
    primary: ['Pectoralis major (clavicular head)'], secondary: ['Anterior deltoid'], reps: [10, 15],
    steps: [
      'Set both pulleys at the lowest position and stand in the middle with a staggered stance.',
      'Hold the handles by your hips, palms forward, elbows slightly bent.',
      'Sweep your hands up and together to about chin height.',
      'Lower slowly along the same arc until you feel a stretch.',
    ],
    mistakes: ['Leaning back to lift the weight.', 'Raising the hands above head height, which shifts work to the shoulders.'],
  }),
  ex({
    id: 'incline-dumbbell-press', name: 'Incline Dumbbell Press', category: 'ALTERNATIVE',
    targets: [t('chest', 'upper-chest')], equipment: ['dumbbells', 'adjustable-bench'],
    primary: ['Pectoralis major (clavicular head)'], secondary: ['Anterior deltoid', 'Triceps'],
    media: img('incline-db-press'),
    steps: [
      'Set the bench to roughly 30° and sit with a dumbbell on each thigh.',
      'Lie back and bring the dumbbells to shoulder level, elbows about 45° from your body.',
      'Press up until your arms are nearly straight, bringing the dumbbells slightly together.',
      'Lower under control to a comfortable stretch and repeat.',
    ],
    mistakes: ['Setting the bench too steep, which turns it into a shoulder press.', 'Bouncing the dumbbells off the bottom.'],
  }),
  ex({
    id: 'incline-barbell-bench-press', name: 'Incline Barbell Bench Press', category: 'ALTERNATIVE',
    targets: [t('chest', 'upper-chest')], equipment: ['barbell', 'adjustable-bench'],
    primary: ['Pectoralis major (clavicular head)'], secondary: ['Anterior deltoid', 'Triceps'], difficulty: 'INTERMEDIATE', reps: [6, 10],
    setupNote: BENCH_SETUP_NOTE, media: img('incline-bench-press'),
    steps: [
      'Set the bench to about 30°, lie back and grip the bar slightly wider than shoulder width.',
      'Unrack the bar and hold it over your upper chest with straight arms.',
      'Lower the bar to the upper chest with elbows tucked slightly.',
      'Press back up over the shoulders.',
    ],
    mistakes: ['Flaring the elbows straight out to the sides.', 'Lifting the hips off the bench.'],
  }),
  ex({
    id: 'smith-incline-bench-press', name: 'Smith Machine Incline Press', category: 'ALTERNATIVE',
    targets: [t('chest', 'upper-chest')], equipment: ['smith-machine', 'adjustable-bench'],
    primary: ['Pectoralis major (clavicular head)'], secondary: ['Anterior deltoid', 'Triceps'],
    media: img('smith-machine-incline-bench-press'),
    steps: [
      'Place the incline bench under the Smith bar so the bar lines up with your upper chest.',
      'Grip slightly wider than shoulder width and rotate the hooks to unrack.',
      'Lower the bar under control to the upper chest.',
      'Press up, then re-rack by rotating the hooks at the top.',
    ],
    mistakes: ['Bench placed too far forward or back, so the bar path lands on the neck or mid-chest.', 'Forgetting to set the safety stops.'],
  }),
  ex({
    id: 'incline-dumbbell-fly', name: 'Incline Dumbbell Fly', category: 'ALTERNATIVE',
    targets: [t('chest', 'upper-chest')], equipment: ['dumbbells', 'adjustable-bench'],
    primary: ['Pectoralis major (clavicular head)'], secondary: ['Anterior deltoid'], difficulty: 'INTERMEDIATE', reps: [10, 15],
    media: img('incline-dumbbell-fly'),
    steps: [
      'Lie on a 30° incline bench with dumbbells above your chest, palms facing each other.',
      'With a soft bend in the elbows, open the arms in a wide arc.',
      'Stop when you feel a comfortable stretch, keeping the elbows slightly below the bench line at most.',
      'Squeeze the dumbbells back together over the chest.',
    ],
    mistakes: ['Going too heavy and lowering too deep.', 'Straightening the arms completely.'],
  }),
  ex({
    id: 'feet-elevated-push-up', name: 'Feet-Elevated Push-up', category: 'ALTERNATIVE',
    targets: [t('chest', 'upper-chest')], equipment: ['bodyweight', 'adjustable-bench'],
    primary: ['Pectoralis major (clavicular head)'], secondary: ['Anterior deltoid', 'Triceps', 'Core'],
    load: 'BODYWEIGHT', difficulty: 'INTERMEDIATE', reps: [8, 15], media: img('decline-push-up'),
    steps: [
      'Place your feet on a bench and your hands on the floor slightly wider than shoulder width.',
      'Brace your core so your body forms a straight line.',
      'Lower your chest toward the floor, elbows about 45° from the body.',
      'Push back up to straight arms.',
    ],
    mistakes: ['Letting the hips sag.', 'Cutting the range of motion short.'],
  }),

  /* ================= CHEST — Middle ================= */
  ex({
    id: 'machine-chest-press', name: 'Chest Press (Machine)', category: 'MACHINE',
    targets: [t('chest', 'middle-chest')], equipment: ['chest-shoulder-machine'],
    primary: ['Pectoralis major'], secondary: ['Anterior deltoid', 'Triceps'], media: img('chest-press-machine'),
    steps: [
      'Set the combined machine to the chest-press position; handles should be at mid-chest height.',
      'Sit tall with your back against the pad and grip the handles.',
      'Press forward until the arms are almost straight.',
      'Return slowly until you feel a stretch in the chest.',
    ],
    mistakes: ['Seat too high or low, so the handles are not at mid-chest.', 'Letting the weight stack slam between reps.'],
  }),
  ex({
    id: 'machine-flat-bench-press', media: { customId: 'machine-flat-bench-press', poseCount: 2 }, name: 'Flat Bench Press (Machine)', category: 'MACHINE',
    targets: [t('chest', 'middle-chest')], equipment: ['chest-shoulder-machine'],
    primary: ['Pectoralis major'], secondary: ['Anterior deltoid', 'Triceps'], reps: [6, 12],
    steps: [
      'Set the combined machine to its flat bench position and lie back with your eyes under the handles or bar.',
      'Plant your feet and pull your shoulder blades back and down.',
      'Press up until your arms are nearly straight.',
      'Lower under control to mid-chest level and repeat.',
    ],
    mistakes: ['Bouncing at the bottom.', 'Losing upper-back tightness as the set gets hard.'],
  }),
  ex({
    id: 'pec-deck-fly', name: 'Pec Deck Fly', category: 'MACHINE',
    targets: [t('chest', 'middle-chest')], equipment: ['pec-deck'],
    primary: ['Pectoralis major'], secondary: ['Anterior deltoid'], reps: [10, 15], media: img('pec-deck'),
    steps: [
      'Adjust the seat so the handles are at chest height and set the arms to the fly position.',
      'Sit with your back against the pad and hold the handles with a slight elbow bend.',
      'Bring the handles together in front of your chest.',
      'Open slowly until you feel a stretch, without letting the weight touch down.',
    ],
    mistakes: ['Letting the shoulders roll forward at the end.', 'Opening so far that the shoulders feel strained.'],
  }),
  ex({
    id: 'cable-chest-fly', name: 'Cable Chest Fly (Crossover)', category: 'MACHINE',
    targets: [t('chest', 'middle-chest')], equipment: ['cable-station'],
    primary: ['Pectoralis major'], secondary: ['Anterior deltoid'], reps: [10, 15], media: img('cable-fly'),
    steps: [
      'Set both pulleys around shoulder height and step forward into a staggered stance.',
      'Start with arms open and a soft bend in the elbows.',
      'Bring the handles together in front of your chest in a hugging motion.',
      'Return slowly to the stretched position.',
    ],
    mistakes: ['Bending and straightening the elbows during the rep.', 'Leaning far forward and using bodyweight.'],
  }),
  ex({
    id: 'barbell-bench-press', name: 'Flat Barbell Bench Press', category: 'ALTERNATIVE',
    targets: [t('chest', 'middle-chest')], equipment: ['barbell', 'adjustable-bench'],
    primary: ['Pectoralis major'], secondary: ['Anterior deltoid', 'Triceps'], difficulty: 'INTERMEDIATE', reps: [6, 10],
    setupNote: BENCH_SETUP_NOTE, media: img('bench-press'),
    steps: [
      'Lie on a flat bench with your eyes under the bar and feet flat on the floor.',
      'Grip slightly wider than shoulder width and pull your shoulder blades together.',
      'Lower the bar to mid-chest with elbows angled about 45–70° from the body.',
      'Press up and slightly back over the shoulders.',
    ],
    mistakes: ['Bouncing the bar off the chest.', 'Lifting the hips off the bench.', 'Flaring the elbows to 90°.'],
  }),
  ex({
    id: 'dumbbell-bench-press', name: 'Flat Dumbbell Bench Press', category: 'ALTERNATIVE',
    targets: [t('chest', 'middle-chest')], equipment: ['dumbbells', 'adjustable-bench'],
    primary: ['Pectoralis major'], secondary: ['Anterior deltoid', 'Triceps'], media: img('db-bench-press'),
    steps: [
      'Sit on a flat bench with dumbbells on your thighs, then lie back bringing them to chest level.',
      'Keep your shoulder blades pulled back and feet planted.',
      'Press the dumbbells up until the arms are nearly straight.',
      'Lower slowly to a comfortable depth beside the chest.',
    ],
    mistakes: ['Letting the dumbbells drift toward the face.', 'Dropping the weights quickly at the bottom.'],
  }),
  ex({
    id: 'smith-bench-press', name: 'Smith Machine Bench Press', category: 'ALTERNATIVE',
    targets: [t('chest', 'middle-chest')], equipment: ['smith-machine', 'adjustable-bench'],
    primary: ['Pectoralis major'], secondary: ['Anterior deltoid', 'Triceps'], media: img('smith-machine-bench-press'),
    steps: [
      'Place a flat bench under the Smith bar so the bar lines up with your mid-chest.',
      'Grip slightly wider than shoulder width and rotate the hooks to unrack.',
      'Lower the bar to mid-chest under control.',
      'Press up and re-rack by rotating the hooks.',
    ],
    mistakes: ['Not setting the safety stops.', 'Positioning the bench so the bar lands on the neck.'],
  }),
  ex({
    id: 'dumbbell-fly', name: 'Dumbbell Fly', category: 'ALTERNATIVE',
    targets: [t('chest', 'middle-chest')], equipment: ['dumbbells', 'adjustable-bench'],
    primary: ['Pectoralis major'], secondary: ['Anterior deltoid'], difficulty: 'INTERMEDIATE', reps: [10, 15], media: img('db-fly'),
    steps: [
      'Lie on a flat bench holding dumbbells above your chest, palms facing each other.',
      'Keep a soft bend in the elbows and open your arms in a wide arc.',
      'Stop at a comfortable stretch.',
      'Bring the dumbbells back together over the chest.',
    ],
    mistakes: ['Using a weight that forces you to press instead of fly.', 'Lowering past a comfortable stretch.'],
  }),
  ex({
    id: 'push-up', name: 'Push-up', category: 'ALTERNATIVE',
    targets: [t('chest', 'middle-chest')], equipment: ['bodyweight'],
    primary: ['Pectoralis major'], secondary: ['Triceps', 'Anterior deltoid', 'Core'], load: 'BODYWEIGHT', reps: [8, 20], media: img('push-up'),
    steps: [
      'Place your hands slightly wider than shoulder width with your body in a straight line.',
      'Brace your core and glutes.',
      'Lower your chest toward the floor with elbows about 45° from the body.',
      'Push back up to straight arms.',
    ],
    mistakes: ['Sagging hips or piking the hips up.', 'Partial reps that stop well above the floor.'],
  }),

  /* ================= CHEST — Lower ================= */
  ex({
    id: 'high-to-low-cable-fly', media: { customId: 'high-to-low-cable-fly', poseCount: 2 }, name: 'High-to-Low Cable Fly', category: 'MACHINE',
    targets: [t('chest', 'lower-chest')], equipment: ['cable-station'],
    primary: ['Pectoralis major (lower sternocostal fibres)'], secondary: ['Anterior deltoid'], reps: [10, 15],
    steps: [
      'Set both pulleys high and stand in the middle with a staggered stance.',
      'Hold the handles with arms open and slightly bent.',
      'Sweep the handles down and together toward your lower chest / belly button.',
      'Return slowly along the same arc.',
    ],
    mistakes: ['Hunching the upper back to finish the rep.', 'Turning it into a pushdown by bending the elbows.'],
  }),
  ex({
    id: 'machine-chest-press-raised-seat', name: 'Chest Press — Raised Seat (Machine)', category: 'MACHINE',
    targets: [t('chest', 'lower-chest')], equipment: ['chest-shoulder-machine'],
    primary: ['Pectoralis major (lower sternocostal fibres)'], secondary: ['Triceps', 'Anterior deltoid'],
    media: img('chest-press-machine', 2, 'Illustration shows the standard machine chest press.'),
    setupNote: 'The combined machine has no true decline setting. Raising the seat so the handles start at lower-chest height gives a slightly downward pressing path; the change in emphasis is modest.',
    steps: [
      'Set the combined machine to chest-press and raise the seat until the handles line up with your lower chest.',
      'Sit tall with your back on the pad.',
      'Press forward and slightly down until the arms are almost straight.',
      'Return slowly to the stretched position.',
    ],
    mistakes: ['Raising the seat so far that the shoulders feel pinched.', 'Rounding forward off the back pad.'],
  }),
  ex({
    id: 'decline-dumbbell-press', name: 'Decline Dumbbell Press', category: 'ALTERNATIVE',
    targets: [t('chest', 'lower-chest')], equipment: ['dumbbells', 'adjustable-bench'],
    primary: ['Pectoralis major (lower sternocostal fibres)'], secondary: ['Triceps', 'Anterior deltoid'], difficulty: 'INTERMEDIATE',
    media: img('decline-bench-press'),
    steps: [
      'Set the bench to a slight decline and secure your legs under the pads.',
      'Lie back with dumbbells at lower-chest level.',
      'Press up until the arms are nearly straight.',
      'Lower slowly beside the lower chest.',
    ],
    mistakes: ['Using a steep decline that makes getting into position awkward.', 'Sitting up suddenly with heavy weights at the end of the set.'],
  }),
  ex({
    id: 'decline-barbell-bench-press', name: 'Decline Barbell Bench Press', category: 'ALTERNATIVE',
    targets: [t('chest', 'lower-chest')], equipment: ['barbell', 'adjustable-bench'],
    primary: ['Pectoralis major (lower sternocostal fibres)'], secondary: ['Triceps', 'Anterior deltoid'], difficulty: 'INTERMEDIATE', reps: [6, 10],
    setupNote: BENCH_SETUP_NOTE, media: img('decline-bench-press-barbell'),
    steps: [
      'Secure your legs on a decline bench and grip the bar slightly wider than shoulder width.',
      'Unrack with straight arms over the lower chest.',
      'Lower the bar to the lower chest under control.',
      'Press back up over the shoulders.',
    ],
    mistakes: ['Lowering the bar toward the neck.', 'Unracking without a spotter or uprights.'],
  }),
  ex({
    id: 'smith-decline-bench-press', name: 'Smith Machine Decline Press', category: 'ALTERNATIVE',
    targets: [t('chest', 'lower-chest')], equipment: ['smith-machine', 'adjustable-bench'],
    primary: ['Pectoralis major (lower sternocostal fibres)'], secondary: ['Triceps', 'Anterior deltoid'],
    media: img('smith-machine-decline-bench-press'),
    steps: [
      'Place the decline bench under the Smith bar so the bar is over your lower chest.',
      'Unrack by rotating the hooks.',
      'Lower to the lower chest under control.',
      'Press back up and re-rack.',
    ],
    mistakes: ['Not setting safety stops.', 'Bench position that puts the bar over the neck.'],
  }),
  ex({
    id: 'assisted-dip-chest', name: 'Assisted Dip — Chest Lean', category: 'ALTERNATIVE',
    targets: [t('chest', 'lower-chest')], equipment: ['assisted-pullup-dip'],
    primary: ['Pectoralis major (lower sternocostal fibres)'], secondary: ['Triceps', 'Anterior deltoid'],
    load: 'ASSISTED', media: img('assisted-dips'),
    steps: [
      'Select an assistance weight (more assistance = easier) and kneel or stand on the platform.',
      'Grip the dip handles and lean your torso forward slightly.',
      'Lower until you feel a stretch in the chest, elbows flaring slightly.',
      'Press back up without locking out aggressively.',
    ],
    mistakes: ['Dropping too deep if the front of the shoulder feels uncomfortable.', 'Staying fully upright, which shifts work to the triceps.'],
  }),
  ex({
    id: 'incline-push-up', name: 'Incline Push-up (Hands Elevated)', category: 'ALTERNATIVE',
    targets: [t('chest', 'lower-chest')], equipment: ['bodyweight', 'adjustable-bench'],
    primary: ['Pectoralis major (lower sternocostal fibres)'], secondary: ['Triceps', 'Anterior deltoid'], load: 'BODYWEIGHT', reps: [10, 20],
    media: img('incline-push-ups'),
    setupNote: 'With hands raised and feet down, the pressing angle resembles a decline press, favouring the lower chest. (Feet-elevated "decline" push-ups favour the upper chest instead.)',
    steps: [
      'Place your hands on a bench or the Smith bar, slightly wider than shoulders.',
      'Step back so your body forms a straight line.',
      'Lower your chest to the edge of the bench.',
      'Push back to straight arms.',
    ],
    mistakes: ['Hips sagging.', 'Using an unstable surface for your hands.'],
  }),

  /* ================= SHOULDERS — Front ================= */
  ex({
    id: 'machine-shoulder-press', name: 'Shoulder Press (Machine)', category: 'MACHINE',
    targets: [t('shoulders', 'front-delts')], equipment: ['chest-shoulder-machine'],
    primary: ['Anterior deltoid'], secondary: ['Lateral deltoid', 'Triceps', 'Upper trapezius'], media: img('machine-shoulder-press'),
    steps: [
      'Set the combined machine to its shoulder-press position; handles should start at about shoulder height.',
      'Sit with your back against the pad and grip the handles.',
      'Press overhead until the arms are nearly straight.',
      'Lower slowly back to shoulder level.',
    ],
    mistakes: ['Arching the lower back off the pad.', 'Lowering the handles below a comfortable shoulder range.'],
  }),
  ex({
    id: 'cable-front-raise', name: 'Cable Front Raise', category: 'MACHINE',
    targets: [t('shoulders', 'front-delts')], equipment: ['cable-station'],
    primary: ['Anterior deltoid'], secondary: ['Upper chest', 'Serratus anterior'], reps: [10, 15], media: img('cable-front-raise'),
    steps: [
      'Attach a handle or straight bar to the low pulley and face away from the stack.',
      'Hold the attachment in front of your thighs with arms nearly straight.',
      'Raise to about shoulder height.',
      'Lower slowly without letting the stack rest.',
    ],
    mistakes: ['Swinging the torso.', 'Raising far above shoulder height.'],
  }),
  ex({
    id: 'seated-dumbbell-shoulder-press', name: 'Seated Dumbbell Shoulder Press', category: 'ALTERNATIVE',
    targets: [t('shoulders', 'front-delts')], equipment: ['dumbbells', 'adjustable-bench'],
    primary: ['Anterior deltoid'], secondary: ['Lateral deltoid', 'Triceps'], media: img('seated-db-press'),
    steps: [
      'Set the bench upright and sit with dumbbells at shoulder height, palms forward.',
      'Brace your core and keep your back against the pad.',
      'Press the dumbbells overhead until the arms are nearly straight.',
      'Lower back to shoulder height under control.',
    ],
    mistakes: ['Excessive back arch.', 'Banging the dumbbells together at the top.'],
  }),
  ex({
    id: 'arnold-press', name: 'Arnold Press', category: 'ALTERNATIVE',
    targets: [t('shoulders', 'front-delts')], equipment: ['dumbbells', 'adjustable-bench'],
    primary: ['Anterior deltoid'], secondary: ['Lateral deltoid', 'Triceps'], difficulty: 'INTERMEDIATE', media: img('arnold-press'),
    steps: [
      'Sit upright holding dumbbells in front of your shoulders, palms facing you.',
      'Press up while rotating your palms to face forward.',
      'Finish with arms nearly straight overhead.',
      'Reverse the rotation as you lower.',
    ],
    mistakes: ['Rushing the rotation.', 'Using too much weight to control the twist.'],
  }),
  ex({
    id: 'smith-seated-shoulder-press', name: 'Seated Smith Machine Shoulder Press', category: 'ALTERNATIVE',
    targets: [t('shoulders', 'front-delts')], equipment: ['smith-machine', 'adjustable-bench'],
    primary: ['Anterior deltoid'], secondary: ['Lateral deltoid', 'Triceps'], media: img('seated-smith-machine-shoulder-press'),
    steps: [
      'Place an upright bench under the Smith bar so the bar travels just in front of your face.',
      'Unrack with hands slightly wider than shoulders.',
      'Lower to about chin level.',
      'Press back up overhead.',
    ],
    mistakes: ['Bench too far back so the bar hits the face.', 'Lowering further than your shoulders comfortably allow.'],
  }),
  ex({
    id: 'dumbbell-front-raise', name: 'Dumbbell Front Raise', category: 'ALTERNATIVE',
    targets: [t('shoulders', 'front-delts')], equipment: ['dumbbells'],
    primary: ['Anterior deltoid'], secondary: ['Upper chest'], reps: [10, 15], media: img('dumbbell-front-raise'),
    steps: [
      'Stand tall with dumbbells in front of your thighs.',
      'Raise one or both arms forward to shoulder height with a soft elbow bend.',
      'Pause briefly.',
      'Lower slowly.',
    ],
    mistakes: ['Swinging with the hips.', 'Shrugging as the weight rises.'],
  }),
  ex({
    id: 'barbell-front-raise', name: 'Barbell Front Raise', category: 'ALTERNATIVE',
    targets: [t('shoulders', 'front-delts')], equipment: ['barbell'],
    primary: ['Anterior deltoid'], secondary: ['Upper chest'], reps: [10, 15], media: img('barbell-front-raise'),
    steps: [
      'Hold a light barbell in front of your thighs with an overhand grip.',
      'Raise it to shoulder height with arms nearly straight.',
      'Pause briefly.',
      'Lower under control.',
    ],
    mistakes: ['Leaning back to lift.', 'Going too heavy for a strict raise.'],
  }),

  /* ================= SHOULDERS — Lateral ================= */
  ex({
    id: 'cable-lateral-raise', name: 'Cable Lateral Raise', category: 'MACHINE',
    targets: [t('shoulders', 'lateral-delts')], equipment: ['cable-station'],
    primary: ['Lateral deltoid'], secondary: ['Supraspinatus', 'Upper trapezius'], reps: [12, 15], media: img('cable-lateral-raise'),
    steps: [
      'Set a single handle on the low pulley and stand side-on to the stack.',
      'Hold the handle with the far hand, arm slightly bent across your body.',
      'Raise the arm out to the side to about shoulder height.',
      'Lower slowly; switch sides after the set.',
    ],
    mistakes: ['Leading with the hand higher than the elbow.', 'Shrugging the shoulder up.'],
  }),
  ex({
    id: 'dumbbell-lateral-raise', name: 'Dumbbell Lateral Raise', category: 'ALTERNATIVE',
    targets: [t('shoulders', 'lateral-delts')], equipment: ['dumbbells'],
    primary: ['Lateral deltoid'], secondary: ['Supraspinatus', 'Upper trapezius'], reps: [12, 15], media: img('lateral-raise'),
    steps: [
      'Stand tall with dumbbells at your sides and a slight bend in the elbows.',
      'Raise the arms out to the sides to about shoulder height.',
      'Keep the elbows level with or slightly above the hands.',
      'Lower slowly.',
    ],
    mistakes: ['Swinging the weights up.', 'Raising far above shoulder height with a shrug.'],
  }),
  ex({
    id: 'seated-dumbbell-lateral-raise', name: 'Seated Dumbbell Lateral Raise', category: 'ALTERNATIVE',
    targets: [t('shoulders', 'lateral-delts')], equipment: ['dumbbells', 'adjustable-bench'],
    primary: ['Lateral deltoid'], secondary: ['Supraspinatus'], reps: [12, 15], media: img('seated-dumbbell-lateral-raise'),
    steps: [
      'Sit upright on a bench with dumbbells by your sides.',
      'Raise the arms out to the sides to shoulder height.',
      'Pause briefly.',
      'Lower slowly without resting the weights.',
    ],
    mistakes: ['Leaning back.', 'Letting the dumbbells crash down.'],
  }),
  ex({
    id: 'leaning-dumbbell-lateral-raise', name: 'Leaning Dumbbell Lateral Raise', category: 'ALTERNATIVE',
    targets: [t('shoulders', 'lateral-delts')], equipment: ['dumbbells'],
    primary: ['Lateral deltoid'], secondary: ['Supraspinatus'], difficulty: 'INTERMEDIATE', reps: [12, 15],
    media: img('lateral-raise', 2, 'Illustration shows the standard (non-leaning) lateral raise.'),
    steps: [
      'Hold a fixed upright (e.g. the Smith machine frame) with one hand and lean away from it.',
      'Hold a dumbbell in the free hand in front of your thigh.',
      'Raise the arm out to the side to shoulder height.',
      'Lower slowly; switch sides.',
    ],
    mistakes: ['Holding something that can move.', 'Turning the movement into a swing.'],
  }),
  ex({
    id: 'band-lateral-raise', media: { customId: 'band-lateral-raise', poseCount: 2 }, name: 'Resistance Band Lateral Raise', category: 'ALTERNATIVE',
    targets: [t('shoulders', 'lateral-delts')], equipment: ['resistance-bands'],
    primary: ['Lateral deltoid'], secondary: ['Supraspinatus'], load: 'BAND', reps: [15, 20],
    steps: [
      'Stand on the middle of a band and hold one end in each hand.',
      'Keep a slight bend in the elbows.',
      'Raise the arms out to the sides to shoulder height.',
      'Lower slowly against the band tension.',
    ],
    mistakes: ['Letting the band snap the arms down.', 'Using a band so heavy you have to shrug.'],
  }),

  /* ================= SHOULDERS — Rear ================= */
  ex({
    id: 'reverse-pec-deck', name: 'Reverse Pec Deck (Rear Delt Fly)', category: 'MACHINE',
    targets: [t('shoulders', 'rear-delts')], equipment: ['pec-deck'],
    primary: ['Posterior deltoid'], secondary: ['Rhomboids', 'Middle trapezius'], reps: [12, 15], media: img('machine-reverse-fly'),
    steps: [
      'Switch the pec deck arms to the rear-delt position and sit facing the pad.',
      'Grip the handles at shoulder height with a slight elbow bend.',
      'Sweep the arms back and out until they are in line with your body.',
      'Return slowly.',
    ],
    mistakes: ['Squeezing the shoulder blades hard so the back does the work.', 'Jerking the weight.'],
  }),
  ex({
    id: 'cable-rear-delt-fly', name: 'Cable Rear Delt Fly', category: 'MACHINE',
    targets: [t('shoulders', 'rear-delts')], equipment: ['cable-station'],
    primary: ['Posterior deltoid'], secondary: ['Rhomboids', 'Middle trapezius'], reps: [12, 15], media: img('cable-reverse-fly'),
    steps: [
      'Set both pulleys at shoulder height and grab the opposite cables (left hand holds right cable).',
      'Stand centred with arms crossed in front of you.',
      'Pull the arms back and out in a wide arc.',
      'Return slowly to the crossed position.',
    ],
    mistakes: ['Bending the elbows into a row.', 'Using too much weight.'],
  }),
  ex({
    id: 'cable-face-pull', name: 'Cable Face Pull', category: 'MACHINE',
    targets: [t('shoulders', 'rear-delts'), t('back', 'upper-back'), t('back', 'mid-back')], equipment: ['cable-station'],
    primary: ['Posterior deltoid', 'Middle trapezius', 'Rhomboids'], secondary: ['Rotator cuff', 'Upper trapezius'], reps: [12, 15],
    media: img('face-pull'),
    steps: [
      'Attach a rope to a pulley at upper-chest to face height.',
      'Hold the rope with palms facing in and step back.',
      'Pull the rope toward your face, separating the hands and keeping elbows high.',
      'Return slowly.',
    ],
    mistakes: ['Pulling to the chest with low elbows.', 'Leaning back to move more weight.'],
  }),
  ex({
    id: 'dumbbell-reverse-fly', name: 'Bent-Over Dumbbell Reverse Fly', category: 'ALTERNATIVE',
    targets: [t('shoulders', 'rear-delts')], equipment: ['dumbbells'],
    primary: ['Posterior deltoid'], secondary: ['Rhomboids', 'Middle trapezius'], reps: [12, 15], media: img('dumbbell-reverse-fly'),
    steps: [
      'Hinge forward at the hips with a flat back, dumbbells hanging below your chest.',
      'Keep a slight bend in the elbows.',
      'Raise the arms out to the sides until they are level with your torso.',
      'Lower slowly.',
    ],
    mistakes: ['Rounding the back.', 'Swinging the torso up.'],
  }),
  ex({
    id: 'rear-delt-row', name: 'Barbell Rear Delt Row', category: 'ALTERNATIVE',
    targets: [t('shoulders', 'rear-delts')], equipment: ['barbell'],
    primary: ['Posterior deltoid'], secondary: ['Rhomboids', 'Middle trapezius', 'Biceps'], difficulty: 'INTERMEDIATE', media: img('barbell-rear-delt-row'),
    steps: [
      'Hinge forward holding a barbell with a wide overhand grip.',
      'Keep your back flat and core braced.',
      'Row the bar toward your upper chest with elbows flared out wide.',
      'Lower under control.',
    ],
    mistakes: ['Rounding the lower back.', 'Tucking the elbows, which turns it into a lat row.'],
  }),
  ex({
    id: 'band-face-pull', media: { customId: 'band-face-pull', poseCount: 2 }, name: 'Resistance Band Face Pull', category: 'ALTERNATIVE',
    targets: [t('shoulders', 'rear-delts')], equipment: ['resistance-bands'],
    primary: ['Posterior deltoid'], secondary: ['Middle trapezius', 'Rotator cuff'], load: 'BAND', reps: [15, 20],
    setupNote: 'Anchor the band securely at about face height (e.g. around a machine upright).',
    steps: [
      'Anchor a band at face height and hold an end in each hand, palms facing in.',
      'Step back until the band is taut.',
      'Pull toward your face, elbows high, hands separating.',
      'Return slowly.',
    ],
    mistakes: ['Anchoring the band to something that can move.', 'Dropping the elbows.'],
  }),
  ex({
    id: 'band-pull-apart', name: 'Band Pull-Apart', category: 'ALTERNATIVE',
    targets: [t('shoulders', 'rear-delts')], equipment: ['resistance-bands'],
    primary: ['Posterior deltoid'], secondary: ['Rhomboids', 'Middle trapezius'], load: 'BAND', reps: [15, 20], media: img('band-pull-apart'),
    steps: [
      'Hold a band in front of your chest with straight arms, hands shoulder-width apart.',
      'Pull the band apart by moving your hands out to the sides.',
      'Stop when the band touches your chest.',
      'Return slowly.',
    ],
    mistakes: ['Bending the elbows.', 'Arching the lower back.'],
  }),

  /* ================= TRICEPS ================= */
  ex({
    id: 'cable-overhead-triceps-extension', name: 'Cable Overhead Triceps Extension', category: 'MACHINE',
    targets: [t('triceps', 'triceps-long-head')], equipment: ['cable-station'],
    primary: ['Triceps (long head emphasis)'], secondary: ['Lateral & medial heads'], reps: [10, 15],
    media: img('cable-overhead-tricep-extension', 2, 'Illustration shows the rope version.'),
    steps: [
      'Attach a straight bar to a low or mid pulley and face away from the stack.',
      'Hold the bar behind your head with elbows pointing forward.',
      'Extend the elbows until the arms are straight overhead.',
      'Return slowly to the stretched position.',
    ],
    mistakes: ['Elbows flaring wide.', 'Arching the lower back.'],
  }),
  ex({
    id: 'rope-overhead-triceps-extension', name: 'Rope Overhead Triceps Extension', category: 'MACHINE',
    targets: [t('triceps', 'triceps-long-head')], equipment: ['cable-station'],
    primary: ['Triceps (long head emphasis)'], secondary: ['Lateral & medial heads'], reps: [10, 15], media: img('cable-overhead-tricep-extension'),
    steps: [
      'Attach a rope to a low pulley and face away, holding the rope behind your head.',
      'Step forward into a staggered stance with elbows pointing forward.',
      'Extend the elbows, spreading the rope ends slightly at the top.',
      'Return slowly until you feel a stretch.',
    ],
    mistakes: ['Moving the upper arms instead of the elbows.', 'Rushing the stretch at the bottom.'],
  }),
  ex({
    id: 'dumbbell-overhead-triceps-extension', name: 'Dumbbell Overhead Extension', category: 'ALTERNATIVE',
    targets: [t('triceps', 'triceps-long-head')], equipment: ['dumbbells', 'adjustable-bench'],
    primary: ['Triceps (long head emphasis)'], secondary: ['Lateral & medial heads'], reps: [10, 15], media: img('overhead-tricep-extension'),
    steps: [
      'Sit upright holding one dumbbell with both hands overhead.',
      'Lower it behind your head by bending the elbows.',
      'Keep the upper arms close to your head.',
      'Extend back to straight arms.',
    ],
    mistakes: ['Elbows flaring out.', 'Arching the back to lift.'],
  }),
  ex({
    id: 'ez-bar-skull-crusher', name: 'EZ Bar Skull Crusher', category: 'ALTERNATIVE',
    targets: [t('triceps', 'triceps-long-head')], equipment: ['ez-bar', 'adjustable-bench'],
    primary: ['Triceps (long head emphasis)'], secondary: ['Lateral & medial heads'], difficulty: 'INTERMEDIATE', reps: [8, 12],
    media: img('ez-bar-lying-tricep-extension'),
    steps: [
      'Lie on a flat bench holding an EZ bar above your chest with a narrow grip.',
      'Let the upper arms tilt slightly back toward your head.',
      'Bend the elbows to lower the bar toward your forehead or just behind it.',
      'Extend the elbows to return.',
    ],
    mistakes: ['Letting the elbows drift wide.', 'Lowering too fast.'],
  }),
  ex({
    id: 'lying-dumbbell-triceps-extension', name: 'Lying Dumbbell Triceps Extension', category: 'ALTERNATIVE',
    targets: [t('triceps', 'triceps-long-head')], equipment: ['dumbbells', 'adjustable-bench'],
    primary: ['Triceps (long head emphasis)'], secondary: ['Lateral & medial heads'], reps: [10, 15], media: img('lying-tricep-extension'),
    steps: [
      'Lie on a flat bench with dumbbells above your chest, palms facing each other.',
      'Bend the elbows to lower the dumbbells beside your head.',
      'Keep the upper arms still.',
      'Extend back to the start.',
    ],
    mistakes: ['Upper arms swinging.', 'Dumbbells drifting toward the face.'],
  }),
  ex({
    id: 'cable-triceps-pushdown', name: 'Cable Triceps Pushdown', category: 'MACHINE',
    targets: [t('triceps', 'triceps-lateral-head'), t('triceps', 'triceps-medial-head')], equipment: ['cable-station'],
    primary: ['Triceps (lateral & medial heads)'], secondary: ['Long head'], reps: [10, 15], media: img('tricep-pushdown'),
    steps: [
      'Attach a straight or angled bar to the high pulley.',
      'Stand close with elbows tucked at your sides.',
      'Push the bar down until your arms are straight.',
      'Let the bar rise to about chest height under control.',
    ],
    mistakes: ['Elbows drifting forward.', 'Leaning over the bar to push with bodyweight.'],
  }),
  ex({
    id: 'rope-triceps-pushdown', name: 'Rope Triceps Pushdown', category: 'MACHINE',
    targets: [t('triceps', 'triceps-lateral-head'), t('triceps', 'triceps-medial-head')], equipment: ['cable-station'],
    primary: ['Triceps (lateral & medial heads)'], secondary: ['Long head'], reps: [10, 15],
    media: img('tricep-pushdown', 2, 'Illustration shows the bar attachment.'),
    steps: [
      'Attach a rope to the high pulley and hold the ends with palms facing in.',
      'Tuck the elbows at your sides.',
      'Push down and spread the rope ends apart at the bottom.',
      'Return slowly to chest height.',
    ],
    mistakes: ['Shoulders rolling forward.', 'Flaring the elbows.'],
  }),
  ex({
    id: 'reverse-grip-pushdown', media: { customId: 'reverse-grip-pushdown', poseCount: 2 }, name: 'Reverse-Grip Pushdown', category: 'MACHINE',
    targets: [t('triceps', 'triceps-medial-head'), t('triceps', 'triceps-lateral-head')], equipment: ['cable-station'],
    primary: ['Triceps (medial head emphasis)'], secondary: ['Lateral & long heads', 'Forearm extensors'], reps: [10, 15],
    steps: [
      'Attach a straight bar to the high pulley and grip it palms-up, shoulder-width.',
      'Tuck the elbows at your sides.',
      'Push down until the arms are straight.',
      'Return slowly.',
    ],
    mistakes: ['Using too much weight so the wrists bend back.', 'Elbows moving forward.'],
  }),
  ex({
    id: 'assisted-dip-triceps', name: 'Assisted Dip — Upright (Triceps)', category: 'MACHINE',
    targets: [t('triceps', 'triceps-lateral-head'), t('triceps', 'triceps-medial-head')], equipment: ['assisted-pullup-dip'],
    primary: ['Triceps'], secondary: ['Pectoralis major', 'Anterior deltoid'], load: 'ASSISTED', media: img('assisted-dips'),
    steps: [
      'Select an assistance weight (more assistance = easier) and step onto the platform.',
      'Grip the dip handles and keep your torso upright.',
      'Bend the elbows to lower until the upper arms are about parallel to the floor.',
      'Push back up to straight arms.',
    ],
    mistakes: ['Leaning far forward (that shifts work to the chest).', 'Going deeper than your shoulders tolerate.'],
  }),
  ex({
    id: 'close-grip-bench-press', name: 'Close-Grip Bench Press', category: 'ALTERNATIVE',
    targets: [t('triceps', 'triceps-medial-head'), t('triceps', 'triceps-lateral-head')], equipment: ['barbell', 'adjustable-bench'],
    primary: ['Triceps'], secondary: ['Pectoralis major', 'Anterior deltoid'], difficulty: 'INTERMEDIATE', reps: [6, 10],
    setupNote: BENCH_SETUP_NOTE, media: img('close-grip-bench-press'),
    steps: [
      'Lie on a flat bench and grip the bar about shoulder-width apart.',
      'Unrack and hold the bar over the chest.',
      'Lower to the lower chest with elbows close to the body.',
      'Press back up.',
    ],
    mistakes: ['Grip so narrow that the wrists bend.', 'Elbows flaring out.'],
  }),
  ex({
    id: 'dumbbell-triceps-kickback', name: 'Dumbbell Triceps Kickback', category: 'ALTERNATIVE',
    targets: [t('triceps', 'triceps-lateral-head'), t('triceps', 'triceps-medial-head')], equipment: ['dumbbells', 'adjustable-bench'],
    primary: ['Triceps'], secondary: [], reps: [12, 15], media: img('tricep-kickback'),
    steps: [
      'Support one knee and hand on a bench, holding a dumbbell in the other hand.',
      'Raise the upper arm in line with your torso.',
      'Straighten the elbow until the arm is fully extended.',
      'Bend back to 90° slowly.',
    ],
    mistakes: ['Dropping the upper arm during the set.', 'Swinging the weight.'],
  }),
  ex({
    id: 'diamond-push-up', name: 'Diamond Push-up', category: 'ALTERNATIVE',
    targets: [t('triceps', 'triceps-lateral-head'), t('triceps', 'triceps-medial-head')], equipment: ['bodyweight'],
    primary: ['Triceps'], secondary: ['Pectoralis major', 'Anterior deltoid'], load: 'BODYWEIGHT', difficulty: 'INTERMEDIATE', reps: [6, 15],
    media: img('diamond-push-ups'),
    steps: [
      'Place your hands close together under your chest, thumbs and index fingers forming a diamond.',
      'Hold a straight body line.',
      'Lower your chest toward your hands, elbows close to the body.',
      'Push back up.',
    ],
    mistakes: ['Hips sagging.', 'Elbows flaring wide.'],
  }),

  /* ================= BICEPS ================= */
  ex({
    id: 'cable-biceps-curl', name: 'Cable Biceps Curl', category: 'MACHINE',
    targets: [t('biceps', 'biceps-long-head'), t('biceps', 'biceps-short-head')], equipment: ['cable-station'],
    primary: ['Biceps brachii'], secondary: ['Brachialis', 'Brachioradialis'], reps: [10, 15], media: img('cable-curl'),
    steps: [
      'Attach a straight or EZ bar to the low pulley.',
      'Stand tall with elbows at your sides, palms up.',
      'Curl the bar toward your shoulders.',
      'Lower slowly to straight arms.',
    ],
    mistakes: ['Elbows drifting forward.', 'Leaning back to swing the weight.'],
  }),
  ex({
    id: 'behind-body-cable-curl', media: { customId: 'behind-body-cable-curl', poseCount: 2 }, name: 'Behind-the-Body Cable Curl', category: 'MACHINE',
    targets: [t('biceps', 'biceps-long-head')], equipment: ['cable-station'],
    primary: ['Biceps brachii (long head emphasis)'], secondary: ['Short head', 'Brachialis'], difficulty: 'INTERMEDIATE', reps: [10, 15],
    steps: [
      'Set a single handle on the low pulley and face away from the stack.',
      'Step forward so your working arm is pulled slightly behind your body.',
      'Curl the handle forward and up without moving the elbow forward much.',
      'Lower slowly into the stretch.',
    ],
    mistakes: ['Letting the shoulder roll forward.', 'Using momentum.'],
  }),
  ex({
    id: 'cable-preacher-curl', media: { customId: 'cable-preacher-curl', poseCount: 2 }, name: 'Cable Preacher Curl', category: 'MACHINE',
    targets: [t('biceps', 'biceps-short-head')], equipment: ['cable-station', 'preacher-bench'],
    primary: ['Biceps brachii (short head emphasis)'], secondary: ['Brachialis'], reps: [10, 15],
    setupNote: 'Only if the preacher bench can be placed safely in front of the low pulley. Otherwise use the EZ-bar or dumbbell preacher curl.',
    steps: [
      'Place the preacher bench facing the low pulley and attach a straight or EZ bar.',
      'Rest the backs of your upper arms on the pad.',
      'Curl the bar up toward your shoulders.',
      'Lower slowly until the arms are almost straight.',
    ],
    mistakes: ['Lifting the elbows off the pad.', 'Dropping into a fully locked bottom position under load.'],
  }),
  ex({
    id: 'ez-bar-curl', name: 'EZ Bar Curl', category: 'ALTERNATIVE',
    targets: [t('biceps', 'biceps-long-head'), t('biceps', 'biceps-short-head')], equipment: ['ez-bar'],
    primary: ['Biceps brachii'], secondary: ['Brachialis', 'Brachioradialis'], media: img('ez-bar-curl'),
    steps: [
      'Stand holding an EZ bar on the angled grips, palms up.',
      'Keep the elbows at your sides.',
      'Curl the bar up toward your shoulders.',
      'Lower slowly.',
    ],
    mistakes: ['Swinging the hips.', 'Cutting the lowering phase short.'],
  }),
  ex({
    id: 'barbell-curl', name: 'Barbell Curl', category: 'ALTERNATIVE',
    targets: [t('biceps', 'biceps-long-head'), t('biceps', 'biceps-short-head')], equipment: ['barbell'],
    primary: ['Biceps brachii'], secondary: ['Brachialis', 'Brachioradialis'], media: img('barbell-curl'),
    steps: [
      'Stand holding a barbell with a shoulder-width underhand grip.',
      'Keep elbows close to the body.',
      'Curl the bar to shoulder height.',
      'Lower under control.',
    ],
    mistakes: ['Leaning back.', 'Elbows moving forward to finish the rep.'],
  }),
  ex({
    id: 'incline-dumbbell-curl', name: 'Incline Dumbbell Curl', category: 'ALTERNATIVE',
    targets: [t('biceps', 'biceps-long-head')], equipment: ['dumbbells', 'adjustable-bench'],
    primary: ['Biceps brachii (long head emphasis)'], secondary: ['Short head', 'Brachialis'], difficulty: 'INTERMEDIATE', reps: [10, 12],
    media: img('incline-db-curl'),
    steps: [
      'Set the bench to about 45–60° and lie back with arms hanging straight down.',
      'Keep the upper arms still and palms forward.',
      'Curl the dumbbells up.',
      'Lower slowly into the stretch.',
    ],
    mistakes: ['Bringing the elbows forward.', 'Using a weight too heavy to start from the stretch.'],
  }),
  ex({
    id: 'concentration-curl', name: 'Concentration Curl', category: 'ALTERNATIVE',
    targets: [t('biceps', 'biceps-short-head'), t('biceps', 'biceps-long-head')], equipment: ['dumbbells', 'adjustable-bench'],
    primary: ['Biceps brachii'], secondary: ['Brachialis'], reps: [10, 12], media: img('concentration-curl'),
    steps: [
      'Sit on a bench and brace the back of your upper arm against your inner thigh.',
      'Let the dumbbell hang with the arm straight.',
      'Curl the dumbbell up toward the shoulder.',
      'Lower slowly.',
    ],
    mistakes: ['Lifting the elbow off the thigh.', 'Rotating the torso to help.'],
  }),
  ex({
    id: 'ez-bar-preacher-curl', name: 'EZ Bar Preacher Curl', category: 'ALTERNATIVE',
    targets: [t('biceps', 'biceps-short-head')], equipment: ['ez-bar', 'preacher-bench'],
    primary: ['Biceps brachii (short head emphasis)'], secondary: ['Brachialis'], media: img('preacher-curl'),
    steps: [
      'Sit at the preacher bench with your upper arms flat on the pad.',
      'Hold the EZ bar on the angled grips, palms up.',
      'Curl the bar up without lifting the elbows.',
      'Lower slowly to almost straight arms.',
    ],
    mistakes: ['Dropping quickly into a locked-out bottom.', 'Lifting the shoulders off the pad.'],
  }),
  ex({
    id: 'dumbbell-preacher-curl', name: 'Dumbbell Preacher Curl', category: 'ALTERNATIVE',
    targets: [t('biceps', 'biceps-short-head')], equipment: ['dumbbells', 'preacher-bench'],
    primary: ['Biceps brachii (short head emphasis)'], secondary: ['Brachialis'], reps: [10, 12], media: img('db-preacher-curl'),
    steps: [
      'Rest one upper arm on the preacher pad holding a dumbbell palm up.',
      'Keep the elbow fixed on the pad.',
      'Curl the dumbbell up.',
      'Lower slowly; switch arms.',
    ],
    mistakes: ['Letting the wrist curl inward excessively.', 'Bouncing at the bottom.'],
  }),
  ex({
    id: 'barbell-preacher-curl', name: 'Barbell Preacher Curl', category: 'ALTERNATIVE',
    targets: [t('biceps', 'biceps-short-head')], equipment: ['barbell', 'preacher-bench'],
    primary: ['Biceps brachii (short head emphasis)'], secondary: ['Brachialis'], difficulty: 'INTERMEDIATE', media: img('barbell-preacher-curl'),
    steps: [
      'Sit at the preacher bench with a straight barbell, palms up.',
      'Keep the upper arms flat on the pad.',
      'Curl the bar up.',
      'Lower slowly.',
    ],
    mistakes: ['Wrist strain from a grip that is too narrow.', 'Elbows lifting off the pad.'],
  }),
  ex({
    id: 'spider-curl', name: 'Dumbbell Spider Curl', category: 'ALTERNATIVE',
    targets: [t('biceps', 'biceps-short-head')], equipment: ['dumbbells', 'adjustable-bench'],
    primary: ['Biceps brachii (short head emphasis)'], secondary: ['Brachialis'], difficulty: 'INTERMEDIATE', reps: [10, 15], media: img('spider-curl'),
    steps: [
      'Lie chest-down on an incline bench with arms hanging straight down.',
      'Hold dumbbells with palms forward.',
      'Curl up without swinging the upper arms.',
      'Lower slowly.',
    ],
    mistakes: ['Upper arms swinging forward.', 'Rushing the reps.'],
  }),
  ex({
    id: 'rope-hammer-curl', name: 'Rope Hammer Curl', category: 'MACHINE',
    targets: [t('biceps', 'brachialis'), t('forearms', 'brachioradialis')], equipment: ['cable-station'],
    primary: ['Brachialis', 'Brachioradialis'], secondary: ['Biceps brachii'], reps: [10, 15], media: img('cable-hammer-curl'),
    steps: [
      'Attach a rope to the low pulley and hold the ends with palms facing each other.',
      'Keep the elbows at your sides.',
      'Curl the rope up toward your shoulders.',
      'Lower slowly.',
    ],
    mistakes: ['Elbows drifting forward.', 'Rotating the palms up during the curl.'],
  }),
  ex({
    id: 'dumbbell-hammer-curl', name: 'Dumbbell Hammer Curl', category: 'ALTERNATIVE',
    targets: [t('biceps', 'brachialis'), t('forearms', 'brachioradialis')], equipment: ['dumbbells'],
    primary: ['Brachialis', 'Brachioradialis'], secondary: ['Biceps brachii'], media: img('hammer-curl'),
    steps: [
      'Stand with dumbbells at your sides, palms facing in.',
      'Keep the elbows tucked.',
      'Curl the dumbbells up without rotating the wrists.',
      'Lower slowly.',
    ],
    mistakes: ['Swinging the weights.', 'Letting the elbows travel forward.'],
  }),
  ex({
    id: 'cross-body-hammer-curl', name: 'Cross-Body Hammer Curl', category: 'ALTERNATIVE',
    targets: [t('biceps', 'brachialis'), t('forearms', 'brachioradialis')], equipment: ['dumbbells'],
    primary: ['Brachialis', 'Brachioradialis'], secondary: ['Biceps brachii'], media: img('cross-body-hammer-curl'),
    steps: [
      'Stand with dumbbells at your sides, palms facing in.',
      'Curl one dumbbell up and across your body toward the opposite shoulder.',
      'Lower slowly.',
      'Alternate arms.',
    ],
    mistakes: ['Twisting the torso.', 'Rushing the lowering phase.'],
  }),
  ex({
    id: 'dumbbell-preacher-hammer-curl', name: 'Preacher Hammer Curl', category: 'ALTERNATIVE',
    targets: [t('biceps', 'brachialis')], equipment: ['dumbbells', 'preacher-bench'],
    primary: ['Brachialis', 'Brachioradialis'], secondary: ['Biceps brachii'], reps: [10, 12], media: img('preacher-hammer-curl'),
    steps: [
      'Rest your upper arm on the preacher pad holding a dumbbell with palm facing in.',
      'Keep the elbow on the pad.',
      'Curl the dumbbell up.',
      'Lower slowly.',
    ],
    mistakes: ['Lifting the elbow.', 'Turning the palm up.'],
  }),
  ex({
    id: 'reverse-ez-bar-curl', name: 'Reverse EZ Bar Curl', category: 'ALTERNATIVE',
    targets: [t('biceps', 'brachialis'), t('forearms', 'brachioradialis'), t('forearms', 'forearm-extensors')], equipment: ['ez-bar'],
    primary: ['Brachialis', 'Brachioradialis'], secondary: ['Forearm extensors', 'Biceps brachii'], reps: [10, 15], media: img('ez-bar-reverse-curl'),
    steps: [
      'Hold an EZ bar with an overhand (palms-down) grip, hands shoulder-width.',
      'Keep the elbows at your sides.',
      'Curl the bar up toward your shoulders.',
      'Lower slowly.',
    ],
    mistakes: ['Wrists bending back.', 'Using momentum.'],
  }),

  /* ================= BACK ================= */
  ex({
    id: 'lat-pulldown', name: 'Lat Pulldown', category: 'MACHINE',
    targets: [t('back', 'lats')], equipment: ['lat-row-machine'],
    primary: ['Latissimus dorsi'], secondary: ['Biceps', 'Teres major', 'Rear deltoid'], media: img('lat-pulldown'),
    steps: [
      'Sit at the combined machine with thighs secured under the pads.',
      'Grip the wide bar slightly wider than shoulder width.',
      'Pull the bar to your upper chest, driving the elbows down.',
      'Let the bar rise slowly until the arms are straight.',
    ],
    mistakes: ['Leaning far back to row the weight.', 'Pulling the bar behind the neck.'],
  }),
  ex({
    id: 'close-grip-lat-pulldown', name: 'Close-Grip (V-Bar) Lat Pulldown', category: 'MACHINE',
    targets: [t('back', 'lats')], equipment: ['lat-row-machine'],
    primary: ['Latissimus dorsi'], secondary: ['Biceps', 'Rhomboids'], media: img('v-bar-lat-pulldown'),
    steps: [
      'Attach a V-bar (close neutral grip) to the pulldown cable.',
      'Sit with thighs secured and lean back slightly.',
      'Pull the handle to your upper chest.',
      'Return slowly to straight arms.',
    ],
    mistakes: ['Shrugging at the top.', 'Using momentum from the torso.'],
  }),
  ex({
    id: 'straight-arm-pulldown', name: 'Straight-Arm Cable Pulldown', category: 'MACHINE',
    targets: [t('back', 'lats')], equipment: ['cable-station'],
    primary: ['Latissimus dorsi'], secondary: ['Teres major', 'Long head of triceps'], reps: [12, 15], media: img('straight-arm-pulldown'),
    steps: [
      'Attach a straight bar or rope to the high pulley and step back.',
      'Hinge slightly with arms straight in front at shoulder height.',
      'Sweep the bar down to your thighs keeping the arms straight.',
      'Return slowly.',
    ],
    mistakes: ['Bending the elbows into a pushdown.', 'Rounding the back.'],
  }),
  ex({
    id: 'assisted-pull-up', name: 'Assisted Pull-up', category: 'ALTERNATIVE',
    targets: [t('back', 'lats')], equipment: ['assisted-pullup-dip'],
    primary: ['Latissimus dorsi'], secondary: ['Biceps', 'Rhomboids', 'Lower trapezius'], load: 'ASSISTED', reps: [6, 12], media: img('assisted-pull-ups'),
    steps: [
      'Select an assistance weight (more assistance = easier) and kneel or stand on the platform.',
      'Grip the pull-up handles slightly wider than shoulder width.',
      'Pull your chest toward the handles.',
      'Lower slowly to straight arms.',
    ],
    mistakes: ['Kicking or swinging.', 'Stopping short of a full hang at the bottom.'],
  }),
  ex({
    id: 'single-arm-dumbbell-row', name: 'Single-Arm Dumbbell Row', category: 'ALTERNATIVE',
    targets: [t('back', 'lats'), t('back', 'mid-back')], equipment: ['dumbbells', 'adjustable-bench'],
    primary: ['Latissimus dorsi', 'Rhomboids'], secondary: ['Biceps', 'Rear deltoid'], media: img('single-arm-db-row'),
    steps: [
      'Place one knee and hand on a flat bench, back flat.',
      'Hold a dumbbell in the other hand, arm hanging straight.',
      'Row the dumbbell toward your hip, keeping the elbow close.',
      'Lower slowly.',
    ],
    mistakes: ['Twisting the torso to lift.', 'Shrugging the shoulder toward the ear.'],
  }),
  ex({
    id: 'barbell-bent-over-row', name: 'Barbell Bent-Over Row', category: 'ALTERNATIVE',
    targets: [t('back', 'lats'), t('back', 'mid-back')], equipment: ['barbell'],
    primary: ['Latissimus dorsi', 'Rhomboids', 'Middle trapezius'], secondary: ['Biceps', 'Rear deltoid', 'Erector spinae'],
    difficulty: 'INTERMEDIATE', reps: [6, 10], media: img('barbell-row'),
    steps: [
      'Hold a barbell with an overhand grip and hinge forward to about 45°, back flat.',
      'Let the bar hang below your shoulders.',
      'Row the bar to your lower ribs.',
      'Lower under control.',
    ],
    mistakes: ['Rounding the lower back.', 'Standing up more with every rep.'],
  }),
  ex({
    id: 'seated-cable-row', name: 'Seated Cable Row', category: 'MACHINE',
    targets: [t('back', 'mid-back')], equipment: ['lat-row-machine'],
    primary: ['Rhomboids', 'Middle trapezius', 'Latissimus dorsi'], secondary: ['Biceps', 'Rear deltoid'], media: img('seated-cable-row'),
    steps: [
      'Use the row station of the combined machine with a close-grip handle.',
      'Sit tall with feet on the platform and knees slightly bent.',
      'Row the handle to your lower ribs, squeezing the shoulder blades together.',
      'Return slowly until the arms are straight.',
    ],
    mistakes: ['Rocking the torso back and forth.', 'Rounding the back at the stretch.'],
  }),
  ex({
    id: 'wide-grip-seated-cable-row', name: 'Wide-Grip Seated Cable Row', category: 'MACHINE',
    targets: [t('back', 'upper-back'), t('back', 'mid-back')], equipment: ['lat-row-machine'],
    primary: ['Middle & upper trapezius', 'Rhomboids'], secondary: ['Rear deltoid', 'Biceps'], media: img('wide-grip-seated-cable-row'),
    steps: [
      'Attach a wide bar to the row station of the combined machine.',
      'Sit tall with an overhand grip.',
      'Row the bar to your upper abdomen with elbows flared out.',
      'Return slowly.',
    ],
    mistakes: ['Leaning back to finish reps.', 'Shrugging the shoulders up.'],
  }),
  ex({
    id: 'chest-supported-dumbbell-row', name: 'Chest-Supported Dumbbell Row', category: 'ALTERNATIVE',
    targets: [t('back', 'mid-back'), t('back', 'upper-back')], equipment: ['dumbbells', 'adjustable-bench'],
    primary: ['Rhomboids', 'Middle trapezius'], secondary: ['Latissimus dorsi', 'Rear deltoid', 'Biceps'], media: img('chest-supported-db-row'),
    steps: [
      'Lie chest-down on an incline bench with dumbbells hanging below.',
      'Keep your chest on the pad.',
      'Row the dumbbells up, squeezing the shoulder blades.',
      'Lower slowly.',
    ],
    mistakes: ['Lifting the chest off the pad.', 'Shrugging.'],
  }),
  ex({
    id: 'smith-bent-over-row', name: 'Smith Machine Bent-Over Row', category: 'ALTERNATIVE',
    targets: [t('back', 'mid-back')], equipment: ['smith-machine'],
    primary: ['Rhomboids', 'Latissimus dorsi'], secondary: ['Biceps', 'Rear deltoid', 'Erector spinae'], media: img('smith-machine-bent-over-row'),
    steps: [
      'Set the Smith bar at knee height and grip it overhand.',
      'Hinge forward with a flat back.',
      'Row the bar to your lower ribs.',
      'Lower under control.',
    ],
    mistakes: ['Rounding the back.', 'Jerking the bar up.'],
  }),
  ex({
    id: 'dumbbell-shrug', name: 'Dumbbell Shrug', category: 'ALTERNATIVE',
    targets: [t('back', 'upper-back')], equipment: ['dumbbells'],
    primary: ['Upper trapezius'], secondary: ['Levator scapulae', 'Forearms (grip)'], reps: [10, 15], media: img('db-shrug'),
    steps: [
      'Stand holding dumbbells at your sides.',
      'Lift your shoulders straight up toward your ears.',
      'Pause briefly at the top.',
      'Lower slowly.',
    ],
    mistakes: ['Rolling the shoulders in circles.', 'Bending the elbows to lift.'],
  }),
  ex({
    id: 'barbell-shrug', name: 'Barbell Shrug', category: 'ALTERNATIVE',
    targets: [t('back', 'upper-back')], equipment: ['barbell'],
    primary: ['Upper trapezius'], secondary: ['Levator scapulae', 'Forearms (grip)'], reps: [10, 15], media: img('shrug'),
    steps: [
      'Hold a barbell in front of your thighs, shoulder-width grip.',
      'Shrug the shoulders straight up.',
      'Pause at the top.',
      'Lower under control.',
    ],
    mistakes: ['Using a heavy weight with a tiny range.', 'Jutting the head forward.'],
  }),
  ex({
    id: 'smith-shrug', name: 'Smith Machine Shrug', category: 'ALTERNATIVE',
    targets: [t('back', 'upper-back')], equipment: ['smith-machine'],
    primary: ['Upper trapezius'], secondary: ['Levator scapulae'], reps: [10, 15], media: img('smith-machine-shrug'),
    steps: [
      'Set the Smith bar at mid-thigh height and grip it shoulder-width.',
      'Unrack and stand tall.',
      'Shrug the shoulders straight up.',
      'Lower slowly.',
    ],
    mistakes: ['Bending the elbows.', 'Bouncing the reps.'],
  }),
  ex({
    id: 'cable-pull-through', name: 'Cable Pull-Through', category: 'MACHINE',
    targets: [t('back', 'lower-back'), t('legs', 'glutes')], equipment: ['cable-station'],
    primary: ['Gluteus maximus', 'Hamstrings'], secondary: ['Erector spinae'], reps: [10, 15], media: img('cable-pull-through'),
    steps: [
      'Attach a rope to the low pulley and face away, holding the rope between your legs.',
      'Walk forward and hinge at the hips with a flat back.',
      'Drive the hips forward to stand tall.',
      'Hinge back slowly, keeping the spine neutral.',
    ],
    mistakes: ['Squatting instead of hinging.', 'Rounding the lower back.'],
  }),
  ex({
    id: 'dumbbell-romanian-deadlift', name: 'Dumbbell Romanian Deadlift', category: 'ALTERNATIVE',
    targets: [t('legs', 'hamstrings'), t('back', 'lower-back'), t('legs', 'glutes')], equipment: ['dumbbells'],
    primary: ['Hamstrings', 'Gluteus maximus'], secondary: ['Erector spinae', 'Forearms (grip)'], media: img('dumbbell-romanian-deadlift'),
    steps: [
      'Stand with dumbbells in front of your thighs, knees slightly bent.',
      'Push the hips back and lower the dumbbells along your legs.',
      'Stop when you feel a strong hamstring stretch with a flat back.',
      'Drive the hips forward to stand tall.',
    ],
    mistakes: ['Rounding the back to reach lower.', 'Turning it into a squat.'],
  }),
  ex({
    id: 'barbell-romanian-deadlift', name: 'Barbell Romanian Deadlift', category: 'ALTERNATIVE',
    targets: [t('legs', 'hamstrings'), t('back', 'lower-back'), t('legs', 'glutes')], equipment: ['barbell'],
    primary: ['Hamstrings', 'Gluteus maximus'], secondary: ['Erector spinae', 'Forearms (grip)'], difficulty: 'INTERMEDIATE', reps: [6, 10],
    media: img('romanian-deadlift'),
    steps: [
      'Hold a barbell at hip height with an overhand grip, knees slightly bent.',
      'Hinge at the hips, sliding the bar down your thighs.',
      'Stop at a strong hamstring stretch while the back stays flat.',
      'Drive the hips forward to return.',
    ],
    mistakes: ['Letting the bar drift away from the legs.', 'Rounding the lower back.'],
  }),
  ex({
    id: 'superman', name: 'Superman (Floor Back Extension)', category: 'ALTERNATIVE',
    targets: [t('back', 'lower-back')], equipment: ['bodyweight'],
    primary: ['Erector spinae'], secondary: ['Gluteus maximus', 'Hamstrings'], load: 'BODYWEIGHT', reps: [10, 15], media: img('superman'),
    setupNote: 'There is no back-extension bench in the inventory, so this floor version is used.',
    steps: [
      'Lie face down with arms extended overhead.',
      'Lift your arms, chest and legs a few centimetres off the floor.',
      'Hold briefly while breathing.',
      'Lower slowly.',
    ],
    mistakes: ['Cranking the neck back.', 'Lifting so high the lower back pinches.'],
  }),

  /* ================= FOREARMS ================= */
  ex({
    id: 'forearm-machine-wrist-flexion', media: { customId: 'forearm-machine-wrist-flexion', poseCount: 2 }, name: 'Forearm Machine — Wrist Flexion', category: 'MACHINE',
    targets: [t('forearms', 'forearm-flexors')], equipment: ['forearm-machine'],
    primary: ['Wrist & finger flexors'], secondary: [], reps: [12, 20],
    setupNote: 'Forearm machines differ between brands — follow the placard on your machine.',
    steps: [
      'Sit at the forearm machine with forearms supported and palms facing up.',
      'Grip the handle with the wrists just past the pad.',
      'Curl the wrists up through a full range.',
      'Lower slowly into the stretch.',
    ],
    mistakes: ['Lifting the forearms off the pad.', 'Using bouncy, partial reps.'],
  }),
  ex({
    id: 'forearm-machine-wrist-extension', media: { customId: 'forearm-machine-wrist-extension', poseCount: 2 }, name: 'Forearm Machine — Wrist Extension', category: 'MACHINE',
    targets: [t('forearms', 'forearm-extensors')], equipment: ['forearm-machine'],
    primary: ['Wrist & finger extensors'], secondary: [], reps: [12, 20],
    setupNote: 'Forearm machines differ between brands — follow the placard on your machine.',
    steps: [
      'Sit at the forearm machine with forearms supported and palms facing down.',
      'Grip the handle with the wrists just past the pad.',
      'Lift the backs of the hands up by extending the wrists.',
      'Lower slowly.',
    ],
    mistakes: ['Going too heavy — extensors are usually weaker than flexors.', 'Moving the elbows.'],
  }),
  ex({
    id: 'cable-wrist-curl', name: 'Cable Wrist Curl', category: 'MACHINE',
    targets: [t('forearms', 'forearm-flexors')], equipment: ['cable-station', 'adjustable-bench'],
    primary: ['Wrist & finger flexors'], secondary: [], reps: [12, 20], media: img('cable-wrist-curl'),
    steps: [
      'Attach a straight bar to the low pulley and sit on a bench facing it.',
      'Rest your forearms on your thighs, palms up, wrists past the knees.',
      'Curl the wrists up.',
      'Lower slowly.',
    ],
    mistakes: ['Lifting the forearms off the thighs.', 'Short, fast reps.'],
  }),
  ex({
    id: 'dumbbell-wrist-curl', name: 'Dumbbell Wrist Curl', category: 'ALTERNATIVE',
    targets: [t('forearms', 'forearm-flexors')], equipment: ['dumbbells', 'adjustable-bench'],
    primary: ['Wrist & finger flexors'], secondary: [], reps: [12, 20], media: img('dumbbell-wrist-curl'),
    steps: [
      'Sit with forearms on your thighs, palms up, holding dumbbells.',
      'Let the wrists extend down.',
      'Curl the wrists up as far as possible.',
      'Lower slowly.',
    ],
    mistakes: ['Moving the forearms.', 'Using a heavy weight with a tiny range.'],
  }),
  ex({
    id: 'barbell-wrist-curl', name: 'Barbell Wrist Curl', category: 'ALTERNATIVE',
    targets: [t('forearms', 'forearm-flexors')], equipment: ['barbell', 'adjustable-bench'],
    primary: ['Wrist & finger flexors'], secondary: [], reps: [12, 20], media: img('barbell-wrist-curl'),
    steps: [
      'Sit with forearms on your thighs holding a barbell palms up.',
      'Lower the bar by extending the wrists.',
      'Curl the bar up with the wrists only.',
      'Lower slowly.',
    ],
    mistakes: ['Lifting the forearms.', 'Bouncing.'],
  }),
  ex({
    id: 'dumbbell-farmers-carry', name: "Dumbbell Farmer's Carry", category: 'ALTERNATIVE',
    targets: [t('forearms', 'forearm-flexors')], equipment: ['dumbbells'],
    primary: ['Forearm flexors (grip)'], secondary: ['Upper trapezius', 'Core'], measure: 'SECONDS', reps: [20, 40], media: img('dumbbell-farmers-walk', 1),
    steps: [
      'Pick up heavy dumbbells, one in each hand, standing tall.',
      'Brace your core and keep the shoulders level.',
      'Walk with short, controlled steps for the target time.',
      'Set the weights down carefully.',
    ],
    mistakes: ['Leaning to one side.', 'Rounding the back when picking the weights up.'],
  }),
  ex({
    id: 'dumbbell-reverse-wrist-curl', name: 'Reverse Wrist Curl', category: 'ALTERNATIVE',
    targets: [t('forearms', 'forearm-extensors')], equipment: ['dumbbells', 'adjustable-bench'],
    primary: ['Wrist & finger extensors'], secondary: [], reps: [12, 20], media: img('db-reverse-wrist-curl'),
    steps: [
      'Sit with forearms on your thighs, palms down, holding light dumbbells.',
      'Let the hands drop slightly.',
      'Lift the backs of the hands up by extending the wrists.',
      'Lower slowly.',
    ],
    mistakes: ['Going too heavy.', 'Moving the forearms.'],
  }),

  /* ================= LEGS — Quads ================= */
  ex({
    id: 'leg-extension', name: 'Leg Extension', category: 'MACHINE',
    targets: [t('legs', 'quadriceps')], equipment: ['leg-extension'],
    primary: ['Quadriceps'], secondary: [], reps: [10, 15], media: img('leg-extension'),
    steps: [
      'Adjust the back pad so your knees line up with the machine pivot.',
      'Place the roller pad just above your ankles.',
      'Straighten the knees to lift the pad.',
      'Lower slowly.',
    ],
    mistakes: ['Kicking the weight up.', 'Lifting the hips off the seat.'],
  }),
  ex({
    id: 'leg-press', name: 'Leg Press', category: 'MACHINE',
    targets: [t('legs', 'quadriceps'), t('legs', 'glutes')], equipment: ['leg-press'],
    primary: ['Quadriceps', 'Gluteus maximus'], secondary: ['Hamstrings', 'Adductors'], reps: [8, 15], media: img('leg-press'),
    steps: [
      'Sit with your back flat and feet shoulder-width on the platform.',
      'Release the safety handles.',
      'Lower the platform until the knees are bent about 90° or as deep as you can keep your lower back on the pad.',
      'Press back up without locking the knees hard.',
    ],
    mistakes: ['Letting the lower back round off the pad at the bottom.', 'Knees caving inward.'],
  }),
  ex({
    id: 'smith-machine-squat', name: 'Smith Machine Squat', category: 'ALTERNATIVE',
    targets: [t('legs', 'quadriceps'), t('legs', 'glutes')], equipment: ['smith-machine'],
    primary: ['Quadriceps', 'Gluteus maximus'], secondary: ['Adductors', 'Erector spinae'], reps: [6, 12], media: img('smith-machine-squat'),
    steps: [
      'Set the bar at upper-chest height and step under it so it rests on your upper back.',
      'Place your feet slightly forward, about shoulder-width.',
      'Squat down until the thighs are about parallel or as deep as you can control.',
      'Drive up through the whole foot.',
    ],
    mistakes: ['Knees collapsing inward.', 'Not setting the safety stops.'],
  }),
  ex({
    id: 'dumbbell-goblet-squat', name: 'Dumbbell Goblet Squat', category: 'ALTERNATIVE',
    targets: [t('legs', 'quadriceps')], equipment: ['dumbbells'],
    primary: ['Quadriceps', 'Gluteus maximus'], secondary: ['Adductors', 'Core'], reps: [8, 15], media: img('db-goblet-squat'),
    steps: [
      'Hold one dumbbell vertically against your chest.',
      'Stand with feet shoulder-width, toes slightly out.',
      'Squat down between your knees, chest up.',
      'Stand back up.',
    ],
    mistakes: ['Heels lifting.', 'Rounding forward at the bottom.'],
  }),
  ex({
    id: 'barbell-back-squat', name: 'Barbell Back Squat', category: 'ALTERNATIVE',
    targets: [t('legs', 'quadriceps')], equipment: ['barbell'],
    primary: ['Quadriceps', 'Gluteus maximus'], secondary: ['Adductors', 'Erector spinae'], difficulty: 'ADVANCED', reps: [5, 8],
    setupNote: 'Needs a squat rack or stands to load the bar safely; no rack is listed in the inventory. If unavailable, use the Smith machine squat.',
    media: img('squat'),
    steps: [
      'Unrack the bar onto your upper back and step back.',
      'Brace your core with feet about shoulder-width.',
      'Squat down to a depth you can control with a neutral spine.',
      'Drive back up.',
    ],
    mistakes: ['Attempting it without a rack or safeties.', 'Losing a neutral spine at the bottom.'],
  }),
  ex({
    id: 'dumbbell-lunge', name: 'Dumbbell Lunge', category: 'ALTERNATIVE',
    targets: [t('legs', 'quadriceps'), t('legs', 'glutes')], equipment: ['dumbbells'],
    primary: ['Quadriceps', 'Gluteus maximus'], secondary: ['Adductors', 'Hamstrings'], reps: [8, 12], media: img('db-lunge'),
    steps: [
      'Stand holding dumbbells at your sides.',
      'Step forward and lower until both knees are bent about 90°.',
      'Push through the front foot to return.',
      'Alternate legs.',
    ],
    mistakes: ['Front knee collapsing inward.', 'Very short steps that overload the knee.'],
  }),
  ex({
    id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', category: 'ALTERNATIVE',
    targets: [t('legs', 'quadriceps'), t('legs', 'glutes')], equipment: ['dumbbells', 'adjustable-bench'],
    primary: ['Quadriceps', 'Gluteus maximus'], secondary: ['Adductors'], difficulty: 'INTERMEDIATE', reps: [8, 12], media: img('bulgarian-split-squat'),
    steps: [
      'Stand in front of a bench and rest the top of one foot on it behind you.',
      'Hold dumbbells at your sides.',
      'Lower until the front thigh is about parallel to the floor.',
      'Drive up through the front foot.',
    ],
    mistakes: ['Front foot too close to the bench.', 'Losing balance by rushing.'],
  }),

  /* ================= LEGS — Hamstrings ================= */
  ex({
    id: 'leg-curl', name: 'Leg Curl', category: 'MACHINE',
    targets: [t('legs', 'hamstrings')], equipment: ['leg-curl'],
    primary: ['Hamstrings'], secondary: ['Gastrocnemius'], reps: [10, 15], media: img('leg-curl'),
    steps: [
      'Adjust the machine so your knees line up with the pivot point.',
      'Position the pad just above your heels.',
      'Curl your heels toward your glutes.',
      'Lower slowly.',
    ],
    mistakes: ['Hips lifting off the pad.', 'Letting the weight drop.'],
  }),
  ex({
    id: 'smith-romanian-deadlift', name: 'Smith Machine Romanian Deadlift', category: 'ALTERNATIVE',
    targets: [t('legs', 'hamstrings')], equipment: ['smith-machine'],
    primary: ['Hamstrings', 'Gluteus maximus'], secondary: ['Erector spinae'], media: img('smith-machine-rdl'),
    steps: [
      'Set the bar at hip height and unrack it with an overhand grip.',
      'Hinge at the hips with a soft knee bend, keeping the back flat.',
      'Lower until you feel a strong hamstring stretch.',
      'Drive the hips forward to return.',
    ],
    mistakes: ['Rounding the back.', 'Standing too far from the bar path.'],
  }),

  /* ================= LEGS — Glutes ================= */
  ex({
    id: 'hip-abduction', name: 'Hip Abduction (Machine)', category: 'MACHINE',
    targets: [t('legs', 'glutes')], equipment: ['hip-abductor'],
    primary: ['Gluteus medius', 'Gluteus minimus'], secondary: ['Tensor fasciae latae', 'Upper gluteus maximus'], reps: [12, 20], media: img('hip-abduction'),
    setupNote: 'Hip abduction moves the legs apart — the outer-hip glutes (medius and minimus) do most of the work. For the inner thigh, see Adductors.',
    steps: [
      'Sit in the machine with the pads against the outside of your knees.',
      'Sit tall and hold the handles.',
      'Push the knees outward as far as comfortable.',
      'Return slowly.',
    ],
    mistakes: ['Letting the weight stack slam.', 'Using momentum.'],
  }),
  ex({
    id: 'high-foot-leg-press', name: 'High-Foot Leg Press', category: 'MACHINE',
    targets: [t('legs', 'glutes')], equipment: ['leg-press'],
    primary: ['Gluteus maximus', 'Hamstrings'], secondary: ['Quadriceps'], reps: [10, 15], media: img('high-foot-leg-press'),
    steps: [
      'Place your feet high and shoulder-width on the platform.',
      'Release the safety handles.',
      'Lower as deep as you can while the lower back stays on the pad.',
      'Press through the heels.',
    ],
    mistakes: ['Lower back rolling off the pad.', 'Heels lifting.'],
  }),
  ex({
    id: 'cable-glute-kickback', name: 'Cable Glute Kickback', category: 'MACHINE',
    targets: [t('legs', 'glutes')], equipment: ['cable-station'],
    primary: ['Gluteus maximus'], secondary: ['Hamstrings'], reps: [12, 15], media: img('cable-kickback'),
    steps: [
      'Attach an ankle strap to the low pulley and face the machine.',
      'Hold the frame and hinge slightly forward.',
      'Kick the strapped leg back, squeezing the glute.',
      'Return slowly; switch legs.',
    ],
    mistakes: ['Arching the lower back to lift the leg higher.', 'Swinging.'],
  }),
  ex({
    id: 'dumbbell-hip-thrust', name: 'Dumbbell Hip Thrust', category: 'ALTERNATIVE',
    targets: [t('legs', 'glutes')], equipment: ['dumbbells', 'adjustable-bench'],
    primary: ['Gluteus maximus'], secondary: ['Hamstrings'], reps: [10, 15], media: img('dumbbell-hip-thrust'),
    steps: [
      'Sit with your upper back against a bench and a dumbbell on your hips.',
      'Plant your feet about hip-width.',
      'Drive the hips up until your body is straight from knees to shoulders.',
      'Lower under control.',
    ],
    mistakes: ['Over-arching the lower back at the top.', 'Feet too far forward.'],
  }),
  ex({
    id: 'barbell-hip-thrust', name: 'Barbell Hip Thrust', category: 'ALTERNATIVE',
    targets: [t('legs', 'glutes')], equipment: ['barbell', 'adjustable-bench'],
    primary: ['Gluteus maximus'], secondary: ['Hamstrings', 'Gluteus medius'], difficulty: 'INTERMEDIATE', media: img('hip-thrust'),
    steps: [
      'Sit with your upper back on a bench and roll a padded barbell over your hips.',
      'Plant your feet hip-width apart.',
      'Drive the hips up to full extension.',
      'Lower under control.',
    ],
    mistakes: ['No padding on the bar.', 'Hyperextending the lower back at the top.'],
  }),
  ex({
    id: 'smith-hip-thrust', name: 'Smith Machine Hip Thrust', category: 'ALTERNATIVE',
    targets: [t('legs', 'glutes')], equipment: ['smith-machine', 'adjustable-bench'],
    primary: ['Gluteus maximus'], secondary: ['Hamstrings', 'Gluteus medius'], media: img('smith-machine-hip-thrust'),
    steps: [
      'Place a bench behind the Smith machine and sit with the bar over your hips (use a pad).',
      'Unrack by rotating the hooks.',
      'Drive the hips up to full extension.',
      'Lower under control and re-rack.',
    ],
    mistakes: ['Bar not centred over the hips.', 'Forgetting to set the safety stops.'],
  }),
  ex({
    id: 'glute-bridge', name: 'Glute Bridge', category: 'ALTERNATIVE',
    targets: [t('legs', 'glutes')], equipment: ['bodyweight'],
    primary: ['Gluteus maximus'], secondary: ['Hamstrings'], load: 'BODYWEIGHT', reps: [12, 20], media: img('glute-bridge'),
    steps: [
      'Lie on your back with knees bent and feet flat.',
      'Drive through your heels to lift the hips.',
      'Squeeze the glutes at the top.',
      'Lower slowly.',
    ],
    mistakes: ['Pushing through the toes.', 'Arching the lower back instead of extending the hips.'],
  }),

  /* ================= LEGS — Calves ================= */
  ex({
    id: 'seated-calf-raise', name: 'Seated Calf Raise', category: 'MACHINE',
    targets: [t('legs', 'calves')], equipment: ['seated-calf-raise'],
    primary: ['Soleus'], secondary: ['Gastrocnemius'], reps: [12, 20], media: img('seated-calf-raise'),
    steps: [
      'Sit with the balls of your feet on the platform and the pad on your lower thighs.',
      'Release the safety lever.',
      'Lower the heels into a full stretch.',
      'Rise onto your toes as high as possible.',
    ],
    mistakes: ['Bouncing at the bottom.', 'Using a tiny range of motion.'],
  }),
  ex({
    id: 'leg-press-calf-raise', media: { customId: 'leg-press-calf-raise', poseCount: 2 }, name: 'Leg Press Calf Raise', category: 'MACHINE',
    targets: [t('legs', 'calves')], equipment: ['leg-press'],
    primary: ['Gastrocnemius'], secondary: ['Soleus'], reps: [12, 20],
    steps: [
      'Sit in the leg press with legs straight and the balls of your feet on the bottom edge of the platform.',
      'Keep the safety handles locked if your machine allows it.',
      'Push the platform with your toes, pointing the feet.',
      'Lower the heels slowly into a stretch.',
    ],
    mistakes: ['Feet slipping off the platform — keep the balls of the feet secure.', 'Bending the knees.'],
  }),
  ex({
    id: 'standing-dumbbell-calf-raise', name: 'Standing Dumbbell Calf Raise', category: 'ALTERNATIVE',
    targets: [t('legs', 'calves')], equipment: ['dumbbells'],
    primary: ['Gastrocnemius'], secondary: ['Soleus'], reps: [12, 20], media: img('dumbbell-calf-raise'),
    steps: [
      'Stand holding dumbbells, optionally with the balls of your feet on a plate or step.',
      'Lower the heels for a stretch.',
      'Rise onto your toes as high as possible.',
      'Lower slowly.',
    ],
    mistakes: ['Bending the knees to bounce.', 'Rushing the reps.'],
  }),
  ex({
    id: 'smith-calf-raise', name: 'Smith Machine Calf Raise', category: 'ALTERNATIVE',
    targets: [t('legs', 'calves')], equipment: ['smith-machine'],
    primary: ['Gastrocnemius'], secondary: ['Soleus'], reps: [12, 20], media: img('smith-machine-calf-raise'),
    steps: [
      'Set the bar on your upper back and stand with the balls of your feet on a plate or step.',
      'Unrack by rotating the hooks.',
      'Lower the heels, then rise onto your toes.',
      'Pause at the top.',
    ],
    mistakes: ['Unstable step under the feet.', 'Bending the knees.'],
  }),
  ex({
    id: 'single-leg-calf-raise', name: 'Single-Leg Calf Raise', category: 'ALTERNATIVE',
    targets: [t('legs', 'calves')], equipment: ['bodyweight'],
    primary: ['Gastrocnemius'], secondary: ['Soleus'], load: 'BODYWEIGHT', reps: [10, 20], media: img('single-leg-calf-raise'),
    steps: [
      'Stand on one foot, holding something stable for balance.',
      'Lower the heel.',
      'Rise onto the toes as high as possible.',
      'Lower slowly; switch legs.',
    ],
    mistakes: ['Leaning on the support to help.', 'Partial reps.'],
  }),

  /* ================= LEGS — Adductors ================= */
  // `hip-adduction` keeps its id, so existing workout logs and PRs stay attached.
  ex({
    id: 'hip-adduction', name: 'Hip Adduction (Machine)', category: 'MACHINE',
    targets: [t('legs', 'adductors')], equipment: ['hip-adductor'],
    primary: ['Adductor longus, brevis & magnus'], secondary: ['Gracilis', 'Pectineus'], difficulty: 'INTERMEDIATE', reps: [12, 20],
    media: img('hip-adduction'),
    steps: [
      'Sit in the machine with the pads against the inside of your knees.',
      'Start with the legs open to a comfortable stretch.',
      'Squeeze the knees together under control.',
      'Open slowly back to the start position.',
    ],
    mistakes: ['Starting with the legs too far apart.', 'Letting the weight snap the legs open.'],
  }),
  ex({
    id: 'wide-stance-leg-press', name: 'Wide-Stance Leg Press', category: 'MACHINE',
    targets: [t('legs', 'adductors')], equipment: ['leg-press'],
    primary: ['Adductors', 'Gluteus maximus'], secondary: ['Quadriceps', 'Hamstrings'], reps: [10, 15], media: img('wide-stance-leg-press'),
    steps: [
      'Place your feet wider than shoulder-width on the platform, toes turned out slightly.',
      'Release the safety handles.',
      'Lower until you feel a stretch in the inner thighs, knees tracking over the toes.',
      'Press back up without locking the knees hard.',
    ],
    mistakes: ['Knees caving inward.', 'Lowering so deep that the lower back lifts off the pad.'],
  }),
  ex({
    id: 'cable-hip-adduction', media: { customId: 'cable-hip-adduction', poseCount: 2 }, name: 'Cable Hip Adduction', category: 'MACHINE',
    targets: [t('legs', 'adductors')], equipment: ['cable-station'],
    primary: ['Adductors'], secondary: ['Gracilis'], reps: [12, 15],
    setupNote: 'Needs an ankle strap for the low pulley.',
    steps: [
      'Attach an ankle strap to the low pulley and stand side-on with the strapped leg nearest the stack.',
      'Hold the frame for balance and let the leg drift out to a comfortable stretch.',
      'Sweep the leg across in front of the standing leg.',
      'Return slowly; switch legs.',
    ],
    mistakes: ['Leaning the torso to move the leg.', 'Swinging the leg with momentum.'],
  }),
  ex({
    id: 'dumbbell-sumo-squat', name: 'Dumbbell Sumo Squat', category: 'ALTERNATIVE',
    targets: [t('legs', 'adductors')], equipment: ['dumbbells'],
    primary: ['Adductors', 'Gluteus maximus', 'Quadriceps'], secondary: ['Hamstrings'], reps: [10, 15], media: img('db-sumo-squat'),
    steps: [
      'Stand with feet well beyond shoulder-width, toes turned out, holding a dumbbell between your legs.',
      'Keep your chest up and brace your core.',
      'Squat down, pushing the knees out over the toes.',
      'Drive back up through the whole foot.',
    ],
    mistakes: ['Knees collapsing inward.', 'Rounding the back at the bottom.'],
  }),
  ex({
    id: 'band-standing-hip-adduction', name: 'Band Standing Hip Adduction', category: 'ALTERNATIVE',
    targets: [t('legs', 'adductors')], equipment: ['resistance-bands'],
    primary: ['Adductors'], secondary: [], load: 'BAND', reps: [15, 20], media: img('banded-standing-hip-adduction'),
    setupNote: 'Anchor the band securely at ankle height.',
    steps: [
      'Loop a band around one ankle and anchor it to the side at ankle height.',
      'Stand tall with a slight stretch on the band.',
      'Pull the banded leg across in front of the standing leg.',
      'Return slowly; switch legs.',
    ],
    mistakes: ['Anchor point that can slip.', 'Leaning the torso instead of moving the leg.'],
  }),
  ex({
    id: 'bent-knee-copenhagen-raise', name: 'Bent-Knee Copenhagen Raise', category: 'ALTERNATIVE',
    targets: [t('legs', 'adductors')], equipment: ['bodyweight', 'adjustable-bench'],
    primary: ['Adductors', 'Obliques'], secondary: ['Gluteus medius', 'Transverse abdominis'], load: 'BODYWEIGHT', difficulty: 'INTERMEDIATE', reps: [6, 12],
    media: img('bent-knee-copenhagen-raises'),
    steps: [
      'Lie on your side and rest the inside of your top knee on a flat bench, propped on your forearm.',
      'Lift your hips until your body forms a straight line, pressing the knee into the bench.',
      'Lower the hips toward the floor under control.',
      'Repeat, then switch sides.',
    ],
    mistakes: ['Letting the hips sag at the top.', 'Starting with the straight-leg version before you can control this one.'],
  }),

  /* ================= ABS ================= */
  ex({
    id: 'ab-crunch-machine', name: 'Ab Crunch Machine', category: 'MACHINE',
    targets: [t('abs', 'upper-abs')], equipment: ['ab-crunch-machine'],
    primary: ['Rectus abdominis'], secondary: ['Obliques'], reps: [10, 15], media: img('machine-seated-crunch'),
    steps: [
      'Adjust the seat and grip the handles or chest pad.',
      'Brace and exhale as you curl the ribcage toward the pelvis.',
      'Pause at the bottom.',
      'Return slowly.',
    ],
    mistakes: ['Pulling with the arms.', 'Using the hip flexors to fold instead of curling the spine.'],
  }),
  ex({
    id: 'cable-crunch', name: 'Cable Crunch', category: 'MACHINE',
    targets: [t('abs', 'upper-abs')], equipment: ['cable-station'],
    primary: ['Rectus abdominis'], secondary: ['Obliques'], difficulty: 'INTERMEDIATE', reps: [10, 15], media: img('cable-crunch'),
    steps: [
      'Kneel facing the high pulley holding a rope beside your head.',
      'Keep the hips still.',
      'Crunch down, bringing your elbows toward your thighs.',
      'Return slowly.',
    ],
    mistakes: ['Sitting back on the heels to pull the weight.', 'Pulling with the arms.'],
  }),
  ex({
    id: 'crunch', name: 'Crunch', category: 'ALTERNATIVE',
    targets: [t('abs', 'upper-abs')], equipment: ['bodyweight'],
    primary: ['Rectus abdominis'], secondary: ['Obliques'], load: 'BODYWEIGHT', reps: [12, 20], media: img('crunches'),
    steps: [
      'Lie on your back with knees bent and hands lightly by your temples.',
      'Curl your shoulders off the floor.',
      'Pause briefly.',
      'Lower slowly.',
    ],
    mistakes: ['Pulling on the neck.', 'Moving fast with momentum.'],
  }),
  ex({
    id: 'band-crunch', media: { customId: 'band-crunch', poseCount: 2 }, name: 'Resistance Band Crunch', category: 'ALTERNATIVE',
    targets: [t('abs', 'upper-abs')], equipment: ['resistance-bands'],
    primary: ['Rectus abdominis'], secondary: ['Obliques'], load: 'BAND', reps: [12, 20],
    setupNote: 'Anchor the band securely above head height.',
    steps: [
      'Anchor a band high and kneel facing it, holding the band beside your head.',
      'Keep the hips still.',
      'Crunch down by curling the spine.',
      'Return slowly.',
    ],
    mistakes: ['Anchor point that can slip.', 'Pulling with the arms.'],
  }),
  ex({
    id: 'reverse-crunch', name: 'Reverse Crunch', category: 'ALTERNATIVE',
    targets: [t('abs', 'lower-abs')], equipment: ['bodyweight'],
    primary: ['Rectus abdominis (lower emphasis)'], secondary: ['Obliques', 'Hip flexors'], load: 'BODYWEIGHT', reps: [10, 15], media: img('reverse-crunches'),
    steps: [
      'Lie on your back with knees bent at 90° and feet off the floor.',
      'Curl the pelvis up, lifting the hips slightly off the floor.',
      'Pause briefly.',
      'Lower slowly.',
    ],
    mistakes: ['Swinging the legs.', 'Dropping the hips quickly.'],
  }),
  ex({
    id: 'lying-leg-raise', name: 'Lying Leg Raise', category: 'ALTERNATIVE',
    targets: [t('abs', 'lower-abs')], equipment: ['bodyweight'],
    primary: ['Rectus abdominis (lower emphasis)', 'Hip flexors'], secondary: ['Obliques'], load: 'BODYWEIGHT', difficulty: 'INTERMEDIATE', reps: [8, 15],
    media: img('lying-leg-raise'),
    steps: [
      'Lie flat with legs straight and hands by your sides or under the hips.',
      'Press the lower back gently into the floor.',
      'Raise the legs until they point upward.',
      'Lower slowly, stopping before the lower back arches.',
    ],
    mistakes: ['Lower back arching off the floor.', 'Dropping the legs.'],
  }),
  ex({
    id: 'plank', name: 'Plank', category: 'ALTERNATIVE',
    targets: [t('abs', 'lower-abs'), t('abs', 'upper-abs')], equipment: ['bodyweight'],
    primary: ['Rectus abdominis', 'Transverse abdominis'], secondary: ['Obliques', 'Glutes'], load: 'BODYWEIGHT', measure: 'SECONDS', reps: [20, 60],
    media: img('plank', 1),
    steps: [
      'Rest on your forearms and toes with elbows under the shoulders.',
      'Make a straight line from head to heels.',
      'Brace the abs and squeeze the glutes.',
      'Hold while breathing steadily.',
    ],
    mistakes: ['Hips sagging or piking up.', 'Holding the breath.'],
  }),
  ex({
    id: 'cable-pallof-press', name: 'Cable Pallof Press', category: 'MACHINE',
    targets: [t('abs', 'obliques')], equipment: ['cable-station'],
    primary: ['Obliques', 'Transverse abdominis'], secondary: ['Rectus abdominis'], reps: [10, 15], media: img('cable-pallof-press'),
    steps: [
      'Set a handle at chest height and stand side-on to the stack.',
      'Hold the handle at your chest with both hands.',
      'Press the handle straight out, resisting the pull to rotate.',
      'Bring it back to your chest; switch sides.',
    ],
    mistakes: ['Letting the torso twist.', 'Standing too close to feel tension.'],
  }),
  ex({
    id: 'cable-woodchop', media: { customId: 'cable-woodchop', poseCount: 2 }, name: 'Cable Woodchop (High-to-Low)', category: 'MACHINE',
    targets: [t('abs', 'obliques')], equipment: ['cable-station'],
    primary: ['Obliques'], secondary: ['Rectus abdominis', 'Shoulders'], difficulty: 'INTERMEDIATE', reps: [10, 15],
    steps: [
      'Set a handle on the high pulley and stand side-on with feet wide.',
      'Hold the handle with both hands above the near shoulder.',
      'Rotate and pull diagonally down across your body to the opposite hip.',
      'Return slowly; switch sides.',
    ],
    mistakes: ['Pulling with the arms only.', 'Twisting the knees instead of the trunk.'],
  }),
  ex({
    id: 'side-plank', name: 'Side Plank', category: 'ALTERNATIVE',
    targets: [t('abs', 'obliques')], equipment: ['bodyweight'],
    primary: ['Obliques'], secondary: ['Transverse abdominis', 'Gluteus medius'], load: 'BODYWEIGHT', measure: 'SECONDS', reps: [20, 45],
    media: img('side-plank', 1),
    steps: [
      'Lie on your side and prop up on one forearm, elbow under the shoulder.',
      'Lift the hips so your body forms a straight line.',
      'Hold while breathing steadily.',
      'Switch sides.',
    ],
    mistakes: ['Hips dropping.', 'Rolling the torso forward.'],
  }),
  ex({
    id: 'bicycle-crunch', name: 'Bicycle Crunch', category: 'ALTERNATIVE',
    targets: [t('abs', 'obliques')], equipment: ['bodyweight'],
    primary: ['Obliques', 'Rectus abdominis'], secondary: ['Hip flexors'], load: 'BODYWEIGHT', reps: [12, 20], media: img('bicycle-crunch'),
    steps: [
      'Lie on your back with hands lightly by your head and legs raised.',
      'Bring one elbow toward the opposite knee while extending the other leg.',
      'Switch sides in a controlled pedalling motion.',
      'Count each side as one rep.',
    ],
    mistakes: ['Yanking the neck.', 'Moving too fast to control the rotation.'],
  }),
  ex({
    id: 'dumbbell-side-bend', name: 'Dumbbell Side Bend', category: 'ALTERNATIVE',
    targets: [t('abs', 'obliques')], equipment: ['dumbbells'],
    primary: ['Obliques'], secondary: ['Quadratus lumborum'], reps: [12, 15], media: img('dumbbell-side-bend'),
    steps: [
      'Stand holding a dumbbell in one hand at your side.',
      'Bend sideways toward the dumbbell.',
      'Return to upright using the opposite side of the waist.',
      'Switch sides.',
    ],
    mistakes: ['Holding dumbbells in both hands (they cancel out).', 'Leaning forward or back.'],
  }),
];

export const EXERCISES_BY_ID: ReadonlyMap<string, LibraryExercise> = new Map(EXERCISE_LIBRARY.map((e) => [e.id, e]));

export function getExercisesForRegion(regionId: string, category?: LibraryExercise['category']): LibraryExercise[] {
  return EXERCISE_LIBRARY.filter(
    (exercise) =>
      exercise.targets.some((target) => target.regionId === regionId) && (!category || exercise.category === category),
  );
}

export function exerciseTargetsRegion(exercise: LibraryExercise, muscleGroupId: string, regionId: string): boolean {
  return exercise.targets.some((target) => target.muscleGroupId === muscleGroupId && target.regionId === regionId);
}
