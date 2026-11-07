import type { ExerciseMedia, Stretch, StretchPhase, StretchStyle, WorkoutCategory } from '../types/gym';

/**
 * Warm-up and cooldown routines per training day. General mobility
 * suggestions, not medical prescriptions.
 *
 * Images: RepDB free-tier stretches where the record genuinely matches the
 * movement (ids verified against the dataset by unit tests), otherwise an
 * original GymTrack SVG (public/exercise-images/custom/).
 */

const repdb = (repdbId: string, poseCount: 1 | 2 = 1): ExerciseMedia => ({ repdbId, poseCount });
const custom = (customId: string, poseCount: 1 | 2 = 2): ExerciseMedia => ({ customId, poseCount });

interface StretchInput {
  id: string;
  name: string;
  phase: StretchPhase;
  style: StretchStyle;
  target: string;
  steps: string[];
  dose: string;
  media: ExerciseMedia;
  optional?: boolean;
}
const s = (input: StretchInput): Stretch => ({ ...input, instructions: input.steps });

/* ---------------- Warm-ups (dynamic) ---------------- */

const lightCardio = s({
  id: 'light-cardio-warmup', name: 'Light Treadmill or Cycle', phase: 'WARMUP', style: 'CARDIO', optional: true,
  target: 'Whole body · raises heart rate and body temperature',
  dose: '3–5 min, easy pace',
  media: { repdbId: 'incline-treadmill-walk', poseCount: 1, mainLabel: 'Treadmill', alternates: [{ repdbId: 'stationary-bike', label: 'Exercise cycle' }] },
  steps: ['Walk briskly on the treadmill or pedal the exercise cycle at an easy pace.', 'You should be able to talk comfortably.', 'Finish slightly warm, not tired.'],
});
const armCircles = s({
  id: 'arm-circles', name: 'Arm Circles', phase: 'WARMUP', style: 'DYNAMIC', target: 'Shoulders (deltoids, rotator cuff)',
  dose: '10 forward + 10 backward', media: custom('arm-circles'),
  steps: ['Stand tall with arms straight out to the sides.', 'Make small circles, gradually getting bigger.', 'Reverse direction halfway through.'],
});
const bandPullApart = s({
  id: 'band-pull-apart-warmup', name: 'Band Pull-Aparts', phase: 'WARMUP', style: 'DYNAMIC', target: 'Rear delts, mid back (rhomboids)',
  dose: '2 × 15 reps', media: repdb('band-pull-apart', 2),
  steps: ['Hold a light band at chest height with straight arms.', 'Pull the band apart until it touches your chest.', 'Return slowly; keep the ribs down.'],
});
const chestOpener = s({
  id: 'dynamic-chest-opener', name: 'Dynamic Chest Opener', phase: 'WARMUP', style: 'DYNAMIC', target: 'Chest (pectorals), front shoulders',
  dose: '12–15 reps', media: custom('dynamic-chest-opener'),
  steps: ['Stand tall and hug your arms across your chest.', 'Swing the arms open wide at shoulder height until you feel a light chest stretch.', 'Move smoothly back and forth without forcing the end range.'],
});
const wallSlides = s({
  id: 'shoulder-wall-slides', name: 'Shoulder Wall Slides', phase: 'WARMUP', style: 'DYNAMIC', target: 'Shoulders, lower trapezius, serratus anterior',
  dose: '10–12 reps', media: custom('shoulder-wall-slides'),
  steps: ['Stand with your back, head and arms against a wall in a “W” shape.', 'Slide the arms up into a “Y” while keeping contact with the wall.', 'Slide back down to the “W” under control.'],
});
const bandExternalRotation = s({
  id: 'band-external-rotation', name: 'Shoulder External Rotation with Band', phase: 'WARMUP', style: 'DYNAMIC', target: 'Rotator cuff (infraspinatus, teres minor)',
  dose: '2 × 12 each side', media: custom('band-external-rotation'),
  steps: ['Anchor a light band at elbow height beside you.', 'Keep your elbow tucked at your side, bent to 90°.', 'Rotate the forearm outward, then return slowly.'],
});
const armSwings = s({
  id: 'arm-swings', name: 'Arm Swings', phase: 'WARMUP', style: 'DYNAMIC', target: 'Shoulders, lats, chest',
  dose: '15–20 swings', media: custom('arm-swings'),
  steps: ['Stand tall with soft knees.', 'Swing both arms forward and overhead, then down and back behind you.', 'Keep the movement relaxed and gradually increase the range.'],
});
const scapularRetractions = s({
  id: 'scapular-retractions', name: 'Scapular Retractions', phase: 'WARMUP', style: 'DYNAMIC', target: 'Mid back (rhomboids, middle trapezius)',
  dose: '2 × 12 reps (2 s squeeze)', media: custom('scapular-retractions'),
  steps: ['Hold your arms straight out in front at shoulder height.', 'Without bending the elbows, squeeze the shoulder blades together.', 'Let them glide apart again; keep the neck relaxed.'],
});
const thoracicRotation = s({
  id: 'thoracic-rotation', name: 'Thoracic Rotation (Thread-the-Needle)', phase: 'WARMUP', style: 'DYNAMIC', target: 'Upper back (thoracic spine), obliques',
  dose: '8 reps each side', media: repdb('thread-the-needle-flow', 2),
  steps: ['Start on hands and knees.', 'Reach one arm up toward the ceiling, rotating through the upper back.', 'Thread the same arm under your body, then repeat.'],
});
const wristCircles = s({
  id: 'wrist-circles', name: 'Wrist Circles', phase: 'WARMUP', style: 'DYNAMIC', target: 'Forearms, wrists',
  dose: '10 each direction', media: custom('wrist-circles', 1),
  steps: ['Hold your arms out in front with loose fists.', 'Circle the wrists slowly in one direction.', 'Switch direction.'],
});
const frontLegSwings = s({
  id: 'leg-swings-front-back', name: 'Front-to-Back Leg Swings', phase: 'WARMUP', style: 'DYNAMIC', target: 'Hip flexors, hamstrings, glutes',
  dose: '12 each leg', media: repdb('leg-swing-front-to-back', 2),
  steps: ['Hold a support with one hand.', 'Swing the outside leg forward and back in a relaxed arc.', 'Keep the torso tall; increase the range gradually.'],
});
const sideLegSwings = s({
  id: 'leg-swings-side', name: 'Side-to-Side Leg Swings', phase: 'WARMUP', style: 'DYNAMIC', target: 'Adductors, hip abductors',
  dose: '12 each leg', media: repdb('lateral-leg-swing', 2),
  steps: ['Face a support and hold it with both hands.', 'Swing one leg across your body and out to the side.', 'Keep the hips square and the movement controlled.'],
});
const hipCircles = s({
  id: 'hip-circles', name: 'Hip Circles', phase: 'WARMUP', style: 'DYNAMIC', target: 'Hips, lower back',
  dose: '10 each direction', media: custom('hip-circles', 1),
  steps: ['Stand with hands on your hips and feet shoulder-width apart.', 'Draw big circles with your hips.', 'Switch direction halfway.'],
});
const bodyweightSquat = s({
  id: 'bodyweight-squat-warmup', name: 'Bodyweight Squats', phase: 'WARMUP', style: 'DYNAMIC', target: 'Quadriceps, glutes, adductors',
  dose: '2 × 10 reps', media: repdb('bodyweight-squat', 2),
  steps: ['Stand with feet shoulder-width apart.', 'Sit back and down to a comfortable depth, chest up.', 'Stand up and repeat smoothly.'],
});
const gluteBridge = s({
  id: 'glute-bridge-warmup', name: 'Glute Bridges', phase: 'WARMUP', style: 'DYNAMIC', target: 'Glutes, hamstrings',
  dose: '12–15 reps', media: repdb('glute-bridge', 2),
  steps: ['Lie on your back with knees bent and feet flat.', 'Drive through the heels to lift the hips.', 'Pause and squeeze the glutes, then lower.'],
});
const walkingLunges = s({
  id: 'walking-lunges-warmup', name: 'Walking Lunges', phase: 'WARMUP', style: 'DYNAMIC', target: 'Quadriceps, glutes, hip flexors',
  dose: '8–10 steps each leg', media: repdb('walking-lunge', 2),
  steps: ['Step forward into a lunge, lowering the back knee toward the floor.', 'Push through the front foot and step into the next lunge.', 'Keep the torso upright.'],
});

/* ---------------- Cooldowns (static holds) ---------------- */

const doorwayChest = s({
  id: 'doorway-chest-stretch', name: 'Doorway Chest Stretch', phase: 'COOLDOWN', style: 'STATIC', target: 'Chest (pectoralis major), front shoulders',
  dose: 'Hold 20–30 s each side', media: repdb('doorway-chest-stretch'),
  steps: ['Place your forearm on a door frame, elbow at shoulder height.', 'Step forward gently until you feel a stretch across the chest.', 'Breathe slowly; don’t force the shoulder.'],
});
const overheadTriceps = s({
  id: 'overhead-triceps-stretch', name: 'Overhead Triceps Stretch', phase: 'COOLDOWN', style: 'STATIC', target: 'Triceps (long head)',
  dose: 'Hold 20–30 s each arm', media: repdb('overhead-triceps-stretch'),
  steps: ['Reach one arm overhead and bend the elbow so the hand drops behind your head.', 'Gently press the elbow with the other hand.', 'Keep the ribs down.'],
});
const crossBodyShoulder = s({
  id: 'cross-body-shoulder-stretch', name: 'Cross-Body Shoulder Stretch', phase: 'COOLDOWN', style: 'STATIC', target: 'Rear and side deltoids',
  dose: 'Hold 20–30 s each arm', media: repdb('cross-body-shoulder-stretch'),
  steps: ['Bring one straight arm across your chest.', 'Hold it above the elbow with the other hand and draw it closer.', 'Keep the shoulder down, away from the ear.'],
});
const frontShoulder = s({
  id: 'front-shoulder-stretch', name: 'Front Shoulder Stretch (Band)', phase: 'COOLDOWN', style: 'STATIC', target: 'Front deltoids, chest',
  dose: 'Hold 20–30 s', media: repdb('banded-shoulder-stretch'),
  steps: ['Hold a band (or towel) behind your back with both hands.', 'Gently lift the hands away from your back until you feel the front of the shoulders stretch.', 'Stand tall and breathe.'],
});
const latStretch = s({
  id: 'lat-stretch', name: 'Lat Stretch (Bench)', phase: 'COOLDOWN', style: 'STATIC', target: 'Latissimus dorsi',
  dose: 'Hold 30 s', media: repdb('bench-lat-stretch'),
  steps: ['Kneel facing a bench and rest your elbows on it.', 'Sink the hips back and let the chest drop toward the floor.', 'Feel the stretch along the sides of your back.'],
});
const bicepsWall = s({
  id: 'biceps-wall-stretch', name: 'Biceps Wall Stretch', phase: 'COOLDOWN', style: 'STATIC', target: 'Biceps, front shoulder',
  dose: 'Hold 20–30 s each arm', media: custom('biceps-wall-stretch', 1),
  steps: ['Place your palm on a wall behind you at shoulder height, arm straight.', 'Slowly turn your body away from the wall.', 'Stop at a gentle stretch along the front of the arm.'],
});
const rearDeltCrossBody = s({
  id: 'rear-delt-cross-body-stretch', name: 'Cross-Body Rear Delt Stretch', phase: 'COOLDOWN', style: 'STATIC', target: 'Rear deltoids, upper back',
  dose: 'Hold 20–30 s each arm', media: repdb('cross-body-shoulder-stretch'),
  steps: ['Bring one straight arm across your chest.', 'Pull it gently toward the opposite shoulder.', 'Let the shoulder blade glide forward slightly.'],
});
const forearmFlexor = s({
  id: 'forearm-flexor-stretch', name: 'Forearm Flexor Stretch', phase: 'COOLDOWN', style: 'STATIC', target: 'Wrist & finger flexors',
  dose: 'Hold 20–30 s', media: repdb('kneeling-wrist-stretch'),
  steps: ['Kneel and place your palms on the floor, fingers pointing back toward your knees.', 'Gently lean back until you feel the inner forearms stretch.', 'Keep the elbows straight but not locked.'],
});
const forearmExtensor = s({
  id: 'forearm-extensor-stretch', name: 'Forearm Extensor Stretch', phase: 'COOLDOWN', style: 'STATIC', target: 'Wrist & finger extensors, brachioradialis',
  dose: 'Hold 20–30 s each arm', media: custom('forearm-extensor-stretch', 1),
  steps: ['Hold one arm straight in front, palm down.', 'Let the wrist bend down and gently press the back of the hand with the other hand.', 'Feel the stretch on top of the forearm.'],
});
const standingQuad = s({
  id: 'standing-quad-stretch', name: 'Standing Quadriceps Stretch', phase: 'COOLDOWN', style: 'STATIC', target: 'Quadriceps, hip flexors',
  dose: 'Hold 30 s each leg', media: repdb('standing-quad-stretch'),
  steps: ['Hold a support for balance.', 'Bend one knee and hold the ankle behind you.', 'Keep the knees together and the hips tucked.'],
});
const hamstring = s({
  id: 'hamstring-stretch', name: 'Hamstring Stretch (Bench)', phase: 'COOLDOWN', style: 'STATIC', target: 'Hamstrings, calves',
  dose: 'Hold 30 s each leg', media: repdb('bench-hamstring-stretch'),
  steps: ['Rest one heel on a bench with the leg straight.', 'Hinge forward from the hips with a long back.', 'Stop at a comfortable stretch behind the thigh.'],
});
const figureFour = s({
  id: 'figure-four-glute-stretch', name: 'Figure-Four Glute Stretch', phase: 'COOLDOWN', style: 'STATIC', target: 'Glutes, piriformis',
  dose: 'Hold 30 s each side', media: repdb('bench-figure-4-glute-stretch'),
  steps: ['Sit tall and cross one ankle over the opposite knee.', 'Hinge forward slightly with a flat back.', 'Feel the stretch in the outer hip of the crossed leg.'],
});
const standingCalf = s({
  id: 'standing-calf-stretch', name: 'Standing Calf Stretch', phase: 'COOLDOWN', style: 'STATIC', target: 'Calves (gastrocnemius)',
  dose: 'Hold 30 s each leg', media: repdb('standing-calf-stretch'),
  steps: ['Step one foot back and press the heel into the floor.', 'Lean into a wall or support with the back knee straight.', 'Keep the toes pointing forward.'],
});
const butterfly = s({
  id: 'butterfly-adductor-stretch', name: 'Butterfly Adductor Stretch', phase: 'COOLDOWN', style: 'STATIC', target: 'Adductors (inner thigh)',
  dose: 'Hold 30 s', media: repdb('butterfly-stretch'),
  steps: ['Sit with the soles of your feet together, knees out.', 'Hold your feet and sit tall.', 'Let the knees relax toward the floor; don’t push them down.'],
});
const cobra = s({
  id: 'cobra-stretch', name: 'Cobra Stretch', phase: 'COOLDOWN', style: 'STATIC', target: 'Abdominals, hip flexors',
  dose: 'Hold 20–30 s', media: repdb('cobra-stretch'),
  steps: ['Lie face down with hands under your shoulders.', 'Press up gently, keeping the hips on the floor.', 'Only go as high as is comfortable for your lower back.'],
});
const childsPose = s({
  id: 'childs-pose', name: 'Child’s Pose', phase: 'COOLDOWN', style: 'STATIC', target: 'Lower back, lats',
  dose: 'Hold 30–60 s', media: repdb('childs-pose'),
  steps: ['Kneel and sit back toward your heels.', 'Reach the arms forward and rest your forehead down.', 'Breathe slowly into your back.'],
});
const sideStretch = s({
  id: 'standing-side-stretch', name: 'Standing Side Stretch', phase: 'COOLDOWN', style: 'STATIC', target: 'Obliques, lats',
  dose: 'Hold 20 s each side', media: repdb('standing-side-bend'),
  steps: ['Stand tall and reach one arm overhead.', 'Lean gently to the opposite side.', 'Keep both feet grounded and the hips still.'],
});
const catCow = s({
  id: 'cat-cow', name: 'Cat-Cow', phase: 'COOLDOWN', style: 'DYNAMIC', target: 'Spine, abdominals',
  dose: '8–10 slow cycles', media: repdb('cat-cow'),
  steps: ['Start on hands and knees.', 'Round your back up (cat), then let the belly drop and lift the chest (cow).', 'Move slowly with your breathing.'],
});

/* ---------------- Recovery (Sunday) ---------------- */

const easyWalk = s({
  id: 'easy-walk', name: 'Easy Walk', phase: 'WARMUP', style: 'CARDIO', optional: true,
  target: 'Whole body · gentle circulation', dose: '10–20 min, relaxed pace', media: repdb('walking'),
  steps: ['Walk at a relaxed, conversational pace.', 'Outdoors or on the treadmill.', 'Keep it easy — this is recovery, not training.'],
});
const kneeToChest = s({
  id: 'knee-to-chest-stretch', name: 'Knee-to-Chest Stretch', phase: 'COOLDOWN', style: 'STATIC', target: 'Glutes, lower back',
  dose: 'Hold 30 s each side', media: repdb('knee-to-chest-stretch'),
  steps: ['Lie on your back.', 'Hug one knee toward your chest.', 'Keep the other leg relaxed on the floor.'],
});
const supineTwist = s({
  id: 'supine-spinal-twist', name: 'Supine Spinal Twist', phase: 'COOLDOWN', style: 'STATIC', target: 'Lower back, obliques, glutes',
  dose: 'Hold 30 s each side', media: repdb('supine-spinal-twist'),
  steps: ['Lie on your back with arms out to the sides.', 'Let both bent knees fall to one side.', 'Keep both shoulders relaxed on the floor.'],
});

/* ---------------- Routines ---------------- */

export interface DayStretchRoutines {
  pre: Stretch[];
  post: Stretch[];
}

const PUSH: DayStretchRoutines = {
  pre: [lightCardio, armCircles, bandPullApart, chestOpener, wallSlides, bandExternalRotation],
  post: [doorwayChest, overheadTriceps, crossBodyShoulder, frontShoulder],
};
const PULL: DayStretchRoutines = {
  pre: [lightCardio, armSwings, bandPullApart, scapularRetractions, thoracicRotation, wristCircles],
  post: [latStretch, bicepsWall, rearDeltCrossBody, forearmFlexor, forearmExtensor],
};
const LEGS: DayStretchRoutines = {
  pre: [lightCardio, frontLegSwings, sideLegSwings, hipCircles, bodyweightSquat, gluteBridge, walkingLunges],
  // Leg days also train abs, so the cooldown covers both.
  post: [standingQuad, hamstring, figureFour, standingCalf, butterfly, cobra, childsPose, sideStretch, catCow],
};
export const REST_DAY_RECOVERY: readonly Stretch[] = [easyWalk, catCow, childsPose, supineTwist, kneeToChest];

export function getStretchRoutines(category: WorkoutCategory): DayStretchRoutines | null {
  switch (category) {
    case 'push':
      return PUSH;
    case 'pull':
      return PULL;
    case 'legs':
      return LEGS;
    case 'rest':
      return null;
  }
}

/** Every stretch (for tests and image validation). */
export const ALL_STRETCHES: readonly Stretch[] = [
  ...new Map([...PUSH.pre, ...PUSH.post, ...PULL.pre, ...PULL.post, ...LEGS.pre, ...LEGS.post, ...REST_DAY_RECOVERY].map((item) => [item.id, item])).values(),
];
