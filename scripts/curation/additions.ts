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
    name: 'One-Arm Front Cable Raise',
    aliases: ['Single Arm Front Cable Raise'],
    primaryMuscles: ['front delts'],
    secondaryMuscles: [],
    equipment: 'cable',
    category: 'strength',
    mechanic: 'isolation',
    instructions: [
      'Stand side-on to a low cable pulley and grip the handle in the hand farther from the machine, arm across your body.',
      'Keep a slight bend in your elbow and brace your core.',
      'Raise the handle in front of you to shoulder height, keeping the arm straight.',
      'Lower under control back to the starting position, then repeat before switching sides.',
    ],
    images: [],
    rationale: 'Ji-logged staple',
  },
  {
    // Ji review round 4 (2026-07-17): the seed's "Machine Shoulder
    // (Military) Press" (renamed "Machine Shoulder Press" in keeps.ts) is
    // overhand grip by default; this is the neutral-grip sibling, its own
    // exercise per the flat variation model.
    name: 'Neutral Grip Machine Shoulder Press',
    aliases: [],
    primaryMuscles: ['front delts'],
    secondaryMuscles: ['triceps'],
    equipment: 'machine',
    category: 'strength',
    mechanic: 'compound',
    instructions: [
      'Sit in the shoulder press machine and grip the neutral (parallel) handles at shoulder height, palms facing each other.',
      'Brace your core and press the handles straight overhead until your arms are extended.',
      'Lower under control back to shoulder height and repeat.',
    ],
    images: [],
    rationale: 'Grip variant per flat model; default Machine Shoulder Press is overhand',
  },
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
    // Ji review round 3 (2026-07-17): corrects round 2, which wrongly
    // renamed the seed's "Calf Press On The Leg Press Machine" (vertical/
    // 45-degree leg press) to this name. Ji clarified they're different
    // machines/movements - this is the horizontal seated leg press version,
    // genuinely absent from the seed, so it's a proper net-new addition.
    name: 'Seated Leg Press Calf Raise',
    aliases: ['Seated Leg Press Calf Raises'],
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    equipment: 'machine',
    category: 'strength',
    mechanic: 'isolation',
    instructions: [
      'Sit in a horizontal (seated) leg press machine with the balls of both feet on the lower edge of the platform.',
      'Straighten your legs against the platform, keeping a slight bend in the knees.',
      'Press the platform away by extending your ankles, rising onto the balls of your feet.',
      'Lower under control until you feel a stretch in the calves, then repeat.',
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
    // Ji review round 5 (2026-07-17): renamed from "Close Grip Seated Cable
    // Row" - a close/V-bar cable row is a neutral grip, so this is the
    // "Neutral Grip Cable Row" slot Ji asked for rather than a duplicate.
    // primaryMuscles narrowed to lats per Ji's explicit spec for this row
    // family (upper back moved to secondary).
    name: 'Neutral Grip Cable Row',
    aliases: ['Close Grip Seated Cable Row'],
    primaryMuscles: ['lats'],
    secondaryMuscles: ['upper back', 'biceps'],
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
  {
    name: 'Overhand Grip Cable Row',
    aliases: ['Pronated Grip Cable Row'],
    primaryMuscles: ['lats'],
    secondaryMuscles: ['upper back', 'biceps'],
    equipment: 'cable',
    category: 'strength',
    mechanic: 'compound',
    instructions: [
      'Attach a straight or lat bar to a low cable pulley and sit with knees slightly bent.',
      'Grip the bar with palms facing down, arms extended, torso upright.',
      'Pull the bar to your torso, driving elbows back and squeezing your back.',
      'Slowly return to the stretched starting position and repeat.',
    ],
    images: [],
    rationale: 'Ji-logged staple',
  },
  {
    name: 'Single-Arm Cable Row',
    aliases: ['Single Arm Cable Row', 'One-Arm Cable Row'],
    primaryMuscles: ['lats'],
    secondaryMuscles: ['upper back', 'biceps'],
    equipment: 'cable',
    category: 'strength',
    mechanic: 'compound',
    instructions: [
      'Attach a single handle to a low cable pulley and sit (or stand in a split stance) facing the machine.',
      'Grip the handle with one hand, arm extended, torso upright.',
      'Pull the handle to your torso, driving your elbow back and squeezing your back.',
      'Slowly return to the stretched starting position, then repeat before switching sides.',
    ],
    images: [],
    rationale: 'Ji-logged staple',
  },
  {
    name: 'Single Leg Standing Leg Curl on Leg Press Machine',
    aliases: [
      'Single-Leg Standing Leg Curl on Leg Press Machine',
      'Single Leg Standing Leg Curls on Leg Press Machine',
    ],
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: [],
    equipment: 'machine',
    category: 'strength',
    mechanic: 'isolation',
    instructions: [
      'Stand facing away from a leg press machine (or a dedicated standing leg curl attachment) with one foot planted on the lower platform.',
      'Brace against the machine and curl the platform toward your glute by flexing the working knee.',
      'Pause briefly at full contraction, then lower under control.',
      'Complete all reps on one leg before switching sides.',
    ],
    images: [],
    rationale: 'Ji-logged staple',
  },
  // ---- Lat pulldown grip/width grid (Ji review round 5) ----
  // Completes the 3x3 grid (Wide/Medium/Close x Pronated/Supinated/Neutral).
  // Medium Pronated ("Lat Pulldown", no modifier) is the default; the other
  // 8 slots are covered by renamed seed keeps (see keeps.ts lats section)
  // plus the 4 genuinely-missing slots added here.
  {
    // Medium Pronated - the default/plain lat pulldown; missing from the
    // seed under any name (seed only had Wide-Grip and Close-Grip Front).
    name: 'Lat Pulldown',
    aliases: [],
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'upper back'],
    equipment: 'cable',
    category: 'strength',
    mechanic: 'compound',
    instructions: [
      'Attach a straight or lat bar to a high pulley and sit with thighs secured under the pad.',
      'Grip the bar shoulder-width, palms facing away, arms extended overhead.',
      'Pull the bar down to your upper chest, driving elbows down and back.',
      'Slowly return to the stretched starting position and repeat.',
    ],
    images: [],
    rationale: 'Lat pulldown grip/width grid: medium pronated default, missing from the seed under any name',
  },
  {
    // Wide Supinated - the seed only had underhand at an implied medium
    // width (renamed to "Supinated Lat Pulldown" in keeps.ts).
    name: 'Wide Supinated Lat Pulldown',
    aliases: [],
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'upper back'],
    equipment: 'cable',
    category: 'strength',
    mechanic: 'compound',
    instructions: [
      'Attach a wide bar to a high pulley and sit with thighs secured under the pad.',
      'Grip the bar wider than shoulder width, palms facing you, arms extended overhead.',
      'Pull the bar down to your upper chest, driving elbows down and back.',
      'Slowly return to the stretched starting position and repeat.',
    ],
    images: [],
    rationale: 'Lat pulldown grip/width grid: wide supinated slot, missing from the seed',
  },
  {
    // Close Supinated.
    name: 'Close Supinated Lat Pulldown',
    aliases: [],
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'upper back'],
    equipment: 'cable',
    category: 'strength',
    mechanic: 'compound',
    instructions: [
      'Attach a close/narrow bar to a high pulley and sit with thighs secured under the pad.',
      'Grip the bar just inside shoulder width, palms facing you, arms extended overhead.',
      'Pull the bar down to your upper chest, driving elbows down and back.',
      'Slowly return to the stretched starting position and repeat.',
    ],
    images: [],
    rationale: 'Lat pulldown grip/width grid: close supinated slot, missing from the seed',
  },
  {
    // Wide Neutral - the seed's V-Bar Pulldown is close/narrow neutral
    // (renamed "Close Neutral Grip Lat Pulldown" in keeps.ts).
    name: 'Wide Neutral Grip Lat Pulldown',
    aliases: [],
    primaryMuscles: ['lats'],
    secondaryMuscles: ['biceps', 'upper back'],
    equipment: 'cable',
    category: 'strength',
    mechanic: 'compound',
    instructions: [
      'Attach a wide parallel-grip (neutral) bar to a high pulley and sit with thighs secured under the pad.',
      'Grip the handles wider than shoulder width, palms facing each other, arms extended overhead.',
      'Pull the handles down to your upper chest, driving elbows down and back.',
      'Slowly return to the stretched starting position and repeat.',
    ],
    images: [],
    rationale: 'Lat pulldown grip/width grid: wide neutral slot, missing from the seed',
  },
]

export default additions
