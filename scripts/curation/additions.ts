/**
 * Net-new exercises (LG-047 curation) - not present in the free-exercise-db
 * seed. Includes the two acceptance-criteria staples the seed is missing
 * ("Wide Grip Cable Row", "Incline Close Grip Bench Press" - the third AC
 * name, "Machine Hamstring Curl", resolves via an alias on the seed's
 * "Seated Leg Curl" in keeps.ts) plus systematic grip/width variant
 * families for pull-ups, lat pulldowns, and rows that Ji explicitly expects
 * as first-class flat-model entries. Every addition ships with `images: []`
 * (no photography yet - renders the library placeholder) and a one-line
 * rationale surfaced in REVIEW.md.
 */
import type { Addition } from './curate.ts'

const additions: Addition[] = [
  {
    name: 'Decline Leg Raise',
    aliases: ['Decline Leg Raises'],
    primaryMuscles: ['abs'],
    secondaryMuscles: [],
    equipment: 'bodyweight',
    category: 'strength',
    mechanic: 'isolation',
    instructions: [
      'Lie back on a decline bench, gripping the pad or bench behind your head for support.',
      'Extend your legs straight out with a slight bend at the knees.',
      'Raise your legs up until your torso and legs form a V shape.',
      'Lower back down under control without letting your feet touch the floor, and repeat.',
    ],
    images: [],
    rationale: 'Ji-logged staple',
  },
  {
    name: 'Single Leg Seated Leg Press Calf Raise',
    aliases: ['Single-Leg Seated Leg Press Calf Raise'],
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    equipment: 'machine',
    category: 'strength',
    mechanic: 'isolation',
    instructions: [
      'Sit in a leg press machine with one foot placed on the lower part of the platform, toes pointed forward.',
      'Straighten that leg and hold the other leg out of the way.',
      'Press the platform away by extending your ankle, rising onto the ball of your foot.',
      'Lower under control until you feel a stretch in the calf, then repeat before switching legs.',
    ],
    images: [],
    rationale: 'Ji-logged staple',
  },
  {
    name: 'Wide Grip Cable Row',
    aliases: [],
    primaryMuscles: ['upper back', 'lats'],
    secondaryMuscles: ['biceps', 'rear delts'],
    equipment: 'cable',
    category: 'strength',
    mechanic: 'compound',
    instructions: [
      'Attach a wide/lat bar to a low cable pulley and sit with knees slightly bent, torso upright.',
      'Grip the bar wide, arms extended, and brace your core.',
      'Pull the bar to your upper abdomen, driving your elbows out and back and squeezing your upper back.',
      'Slowly return to the stretched starting position and repeat.',
    ],
    images: [],
    rationale: 'AC coverage: wide-grip cable row is a staple back-width row missing from the seed.',
  },
  {
    name: 'Incline Close Grip Bench Press',
    aliases: [],
    primaryMuscles: ['chest', 'triceps'],
    secondaryMuscles: ['front delts'],
    equipment: 'barbell',
    category: 'strength',
    mechanic: 'compound',
    instructions: [
      'Set an adjustable bench to a low incline (15-30 degrees) under a barbell rack.',
      'Grip the bar just inside shoulder width and unrack it over your upper chest.',
      'Lower the bar with elbows tucked to the upper chest, then press back up.',
      'Repeat for the desired reps.',
    ],
    images: [],
    rationale: 'AC coverage: incline + close-grip combination (upper chest/triceps emphasis) missing from the seed.',
  },
  {
    name: 'Neutral Grip Pull-Up',
    aliases: [],
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'upper back', 'rear delts'],
    equipment: 'bodyweight',
    category: 'strength',
    mechanic: 'compound',
    instructions: [
      'Grip parallel neutral handles (or a neutral-grip attachment) with palms facing each other.',
      'Hang with arms extended and shoulders engaged.',
      'Pull your chin above the handles, driving elbows down and back.',
      'Lower under control to full extension and repeat.',
    ],
    images: [],
    rationale: 'Systematic pull-up grip family Ji expects as a first-class variant; shoulder-friendlier grip missing from the seed.',
  },
  {
    name: 'Close-Grip Pull-Up',
    aliases: [],
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'upper back'],
    equipment: 'bodyweight',
    category: 'strength',
    mechanic: 'compound',
    instructions: [
      'Grip the pull-up bar with hands just a few inches apart, palms facing away.',
      'Hang with arms extended.',
      'Pull your chin above the bar, keeping elbows close to your torso.',
      'Lower under control and repeat.',
    ],
    images: [],
    rationale: 'Grip-width sibling to Wide Grip Pull-Up; only the behind-neck wide variant existed in the seed.',
  },
  {
    name: 'Wide Grip Pull-Up',
    aliases: [],
    primaryMuscles: ['lats', 'upper back'],
    secondaryMuscles: ['biceps', 'rear delts'],
    equipment: 'bodyweight',
    category: 'strength',
    mechanic: 'compound',
    instructions: [
      'Grip the pull-up bar wider than shoulder width, palms facing away.',
      'Hang with arms extended.',
      'Pull your chest toward the bar, driving elbows down and out.',
      'Lower under control and repeat.',
    ],
    images: [],
    rationale: 'Front-facing wide-grip pull-up (to the chest); the seed only had the behind-the-neck rear variant.',
  },
  {
    name: 'Neutral Grip Lat Pulldown',
    aliases: [],
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'upper back'],
    equipment: 'cable',
    category: 'strength',
    mechanic: 'compound',
    instructions: [
      'Attach a neutral-grip (parallel handle) bar to a high pulley and sit with thighs secured.',
      'Grip the handles with palms facing each other, arms extended overhead.',
      'Pull the handles down to your upper chest, driving elbows down and back.',
      'Slowly return to the stretched starting position and repeat.',
    ],
    images: [],
    rationale: 'Grip-family completion for lat pulldown alongside the seed\'s wide-grip and close-grip variants.',
  },
  {
    name: 'Underhand Bent Over Barbell Row',
    aliases: ['Reverse Grip Bent Over Row'],
    primaryMuscles: ['upper back', 'lats'],
    secondaryMuscles: ['biceps', 'rear delts'],
    equipment: 'barbell',
    category: 'strength',
    mechanic: 'compound',
    instructions: [
      'Grip a barbell shoulder-width with palms facing up (supinated).',
      'Hinge at the hips until your torso is roughly parallel to the floor, knees slightly bent.',
      'Row the bar to your lower ribs, driving elbows back and squeezing your back.',
      'Lower under control and repeat.',
    ],
    images: [],
    rationale: 'Grip variant of Bent Over Barbell Row (biceps-biased pull); only the overhand default existed in the seed.',
  },
  {
    name: 'Close Grip Seated Cable Row',
    aliases: [],
    primaryMuscles: ['upper back', 'lats'],
    secondaryMuscles: ['biceps'],
    equipment: 'cable',
    category: 'strength',
    mechanic: 'compound',
    instructions: [
      'Attach a close (V-bar or narrow neutral) handle to a low cable pulley and sit with knees slightly bent.',
      'Grip the handle, arms extended, torso upright.',
      'Pull the handle to your torso, driving elbows straight back and squeezing your back.',
      'Slowly return to the stretched starting position and repeat.',
    ],
    images: [],
    rationale: 'Grip-width sibling to Wide Grip Cable Row, pairing with the seed\'s existing wide-grip-only cable row coverage.',
  },
]

export default additions
