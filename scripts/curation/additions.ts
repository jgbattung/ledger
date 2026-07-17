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
  // ---- Ji review round 6 (2026-07-17) ----
  {
    name: 'Smith Machine Hinge Deadlift',
    aliases: [],
    primaryMuscles: ['lower back'],
    secondaryMuscles: ['glutes', 'hamstrings'],
    equipment: 'smith machine',
    category: 'strength',
    mechanic: 'compound',
    instructions: [
      'Set the smith machine bar at roughly mid-shin height and stand with feet hip-width apart, gripping the bar just outside your legs.',
      'Unrack the bar, keeping a flat back and a slight bend in the knees.',
      'Hinge at the hips, pushing your hips back while lowering the bar along your legs.',
      'Drive your hips forward to stand back up, squeezing your glutes at the top, and repeat.',
    ],
    images: [],
    rationale: 'Ji-logged staple',
  },
  {
    name: 'Split Squat',
    aliases: ['Split Squats'],
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes', 'hamstrings'],
    equipment: 'bodyweight',
    category: 'strength',
    mechanic: 'compound',
    instructions: [
      'Step into a split stance with one foot forward and one foot back, both feet flat on the floor.',
      'Lower your back knee toward the floor by bending both knees, keeping your torso upright.',
      'Press through your front foot to return to the starting position.',
      'Complete all reps on one side before switching legs.',
    ],
    images: [],
    // The seed's stretch-category "Split Squats" is a dynamic jump-lunge
    // drill (see its instructions), not this static strength movement - not
    // resurrected; this is a genuine new entry.
    rationale: 'Ji-logged staple',
  },
  {
    name: 'Smith Machine Split Squat',
    aliases: [],
    primaryMuscles: ['quads'],
    secondaryMuscles: ['glutes', 'hamstrings'],
    equipment: 'smith machine',
    category: 'strength',
    mechanic: 'compound',
    instructions: [
      'Set the smith machine bar at upper-back height and position yourself in a split stance underneath it, one foot forward and one foot back.',
      'Unrack the bar and lower your back knee toward the floor by bending both knees, torso upright.',
      'Press through your front foot to return to the starting position.',
      'Complete all reps on one side before switching legs.',
    ],
    images: [],
    rationale: 'Ji-logged staple',
  },
  {
    name: 'Archer Pull',
    aliases: ['Archer Pulls'],
    primaryMuscles: ['rear delts'],
    secondaryMuscles: ['upper back'],
    equipment: 'band',
    category: 'strength',
    mechanic: 'compound',
    instructions: [
      'Anchor a band at chest height and stand side-on, holding the band with the far arm extended toward the anchor.',
      'Extend the near arm out to the side (archer stance) for a stable base.',
      'Pull the band toward your chest by driving the elbow back and squeezing your rear delt and upper back.',
      'Return under control and repeat, then switch sides.',
    ],
    images: [],
    rationale: 'Ji-logged staple',
  },
  {
    name: 'Single-Arm Cable Rear Delt Fly',
    aliases: ['One-Arm Cable Rear Delt Fly'],
    primaryMuscles: ['rear delts'],
    secondaryMuscles: [],
    equipment: 'cable',
    category: 'strength',
    mechanic: 'isolation',
    instructions: [
      'Set a cable pulley to roughly chest height and stand side-on, gripping the handle with the arm farther from the machine, across your body.',
      'Keep a slight bend in your elbow and brace your core.',
      'Pull the handle out and back, squeezing your rear delt, until your arm is in line with your torso.',
      'Return under control to the starting position, then repeat before switching sides.',
    ],
    images: [],
    rationale: 'Ji-logged staple',
  },
  {
    name: 'Cable Lateral Raise',
    aliases: [],
    primaryMuscles: ['side delts'],
    secondaryMuscles: [],
    equipment: 'cable',
    category: 'strength',
    mechanic: 'isolation',
    instructions: [
      'Stand side-on to a low cable pulley and grip the handle in the hand farther from the machine, arm across your body in front of you.',
      'Keep a slight bend in your elbow and brace your core.',
      'Raise the handle out to the side until your arm is roughly parallel to the floor.',
      'Lower under control back to the starting position, then repeat before switching sides.',
    ],
    images: [],
    // Inherently unilateral (one arm at a time), but a single flat-model
    // entry is enough - per-side logging is handled by the Set model's
    // `unilateral` field (PRD 3.9), not by separate L/R exercises.
    rationale: 'Ji-logged staple',
  },
  {
    name: 'Facing-Up Incline Dumbbell Lateral Raise',
    aliases: [],
    primaryMuscles: ['side delts'],
    secondaryMuscles: [],
    equipment: 'dumbbell',
    category: 'strength',
    mechanic: 'isolation',
    instructions: [
      'Lie face-up on an incline bench set to roughly 30-45 degrees, a dumbbell in each hand at your sides.',
      'With a slight bend in your elbows, raise both arms out to the sides until roughly parallel to the floor.',
      'Lower under control back to the starting position and repeat.',
    ],
    images: [],
    rationale: 'Ji-logged staple',
  },
  {
    name: 'Chest-Supported Incline Dumbbell Lateral Raise',
    aliases: [],
    primaryMuscles: ['side delts'],
    secondaryMuscles: [],
    equipment: 'dumbbell',
    category: 'strength',
    mechanic: 'isolation',
    instructions: [
      'Lie face-down (chest-supported) on an incline bench set to roughly 30-45 degrees, a dumbbell in each hand hanging below you.',
      'With a slight bend in your elbows, raise both arms out to the sides until roughly parallel to the floor.',
      'Lower under control back to the starting position and repeat.',
    ],
    images: [],
    rationale: 'Ji-logged staple',
  },
  // ---- Ji review round 7 (2026-07-17) ----
  {
    name: 'Kelso Shrug',
    aliases: [],
    primaryMuscles: ['traps'],
    secondaryMuscles: ['upper back'],
    equipment: 'machine',
    category: 'strength',
    mechanic: 'isolation',
    instructions: [
      'Lie face-down (chest-supported) on an incline bench or chest-supported row machine, arms hanging straight down holding handles or a bar.',
      'Without bending your elbows, shrug your shoulders up and back, squeezing your shoulder blades together.',
      'Pause briefly at the top, then lower under control and repeat.',
    ],
    images: [],
    rationale: 'Ji-logged staple',
  },
  {
    // Distinct from the seed's standing "Smith Machine Behind the Back
    // Shrug", which stays kept.
    name: 'Seated Smith Machine Behind the Back Shrug',
    aliases: [],
    primaryMuscles: ['traps'],
    secondaryMuscles: ['front delts'],
    equipment: 'smith machine',
    category: 'strength',
    mechanic: 'isolation',
    instructions: [
      'Sit on a bench positioned behind the smith machine bar, gripping the bar behind your hips with an overhand grip.',
      'Let your arms hang straight down, holding the bar behind your back.',
      'Shrug your shoulders straight up, squeezing at the top.',
      'Lower under control and repeat.',
    ],
    images: [],
    rationale: 'Ji-logged staple',
  },
  {
    name: 'Katana Extension',
    aliases: ['Katana Extensions'],
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    equipment: 'cable',
    category: 'strength',
    mechanic: 'isolation',
    instructions: [
      'Attach a single handle to a high cable pulley and stand with your side to the machine.',
      'Grip the handle with both hands overhead, elbow pointing up, like drawing a sword from over your shoulder.',
      'Extend your arm by straightening the elbow, pulling the handle diagonally across and down.',
      'Return under control to the starting position, then repeat before switching sides.',
    ],
    images: [],
    rationale: 'Ji-logged staple',
  },
  {
    name: 'Chest-Supported Machine Row',
    aliases: [],
    primaryMuscles: ['upper back'],
    secondaryMuscles: ['biceps', 'lats'],
    equipment: 'machine',
    category: 'strength',
    mechanic: 'compound',
    instructions: [
      'Sit or kneel facing into a chest-supported row machine, chest resting against the pad, and grip the handles.',
      'Row the handles toward your torso, driving your elbows back and squeezing your shoulder blades together.',
      'Slowly return to the stretched starting position and repeat.',
    ],
    images: [],
    rationale: 'Ji-logged staple',
  },
  {
    // Reconciled with Ji's "Chest-Supported Dumbbell Row With Elbows
    // Flared" request: a chest-supported dumbbell row is performed
    // face-down on an incline bench, which is the same setup and elbow
    // path as an elbows-flared incline dumbbell row - one entry, not two.
    name: 'Elbows Flared Incline Dumbbell Row',
    aliases: [
      'Chest-Supported Dumbbell Row With Elbows Flared',
      'Chest-Supported Dumbbell Row',
    ],
    primaryMuscles: ['upper back'],
    secondaryMuscles: ['biceps', 'lats', 'rear delts'],
    equipment: 'dumbbell',
    category: 'strength',
    mechanic: 'compound',
    instructions: [
      'Lie face-down (chest-supported) on an incline bench, a dumbbell in each hand hanging straight down.',
      'Row both dumbbells up and out to the sides, flaring your elbows away from your torso, driving them toward shoulder height.',
      'Squeeze your shoulder blades together at the top, then lower under control and repeat.',
    ],
    images: [],
    rationale: "Ji-logged staple; row policy - flared elbows bias upper back, distinct from the tucked-elbow default Dumbbell Incline Row (lats)",
  },
  {
    name: 'Elbows Flared One-Arm Dumbbell Row',
    aliases: [],
    primaryMuscles: ['upper back'],
    secondaryMuscles: ['biceps', 'lats', 'rear delts'],
    equipment: 'dumbbell',
    category: 'strength',
    mechanic: 'compound',
    instructions: [
      'Support yourself on a bench with one hand and knee, torso roughly parallel to the floor, holding a dumbbell in the free hand.',
      'Row the dumbbell up and out to the side, flaring your elbow away from your torso toward shoulder height.',
      'Squeeze your shoulder blade at the top, then lower under control and repeat, then switch sides.',
    ],
    images: [],
    rationale: "Ji-logged staple; row policy - flared elbows bias upper back, distinct from the tucked-elbow default One-Arm Dumbbell Row (lats)",
  },
  {
    // Naming note: distinct from round 5's "Neutral Grip Cable Row" (a lats
    // V-bar/close cable row). This is the seated cable row family (upper
    // back primary, elbows flared) - flagged for Ji in case he wants a
    // clearer naming split between the two "neutral grip ... row" entries.
    name: 'Neutral Grip Seated Cable Row',
    aliases: [],
    primaryMuscles: ['upper back'],
    secondaryMuscles: ['biceps', 'lats', 'rear delts'],
    equipment: 'cable',
    category: 'strength',
    mechanic: 'compound',
    instructions: [
      'Attach a neutral-grip (parallel handle) bar to a low cable pulley and sit with knees slightly bent.',
      'Grip the handles with palms facing each other, arms extended, torso upright.',
      'Pull the handles to your torso, flaring your elbows out to the sides and squeezing your shoulder blades together.',
      'Slowly return to the stretched starting position and repeat.',
    ],
    images: [],
    rationale: 'Ji-logged staple',
  },
  {
    name: 'Wide Neutral Grip Seated Cable Row',
    aliases: [],
    primaryMuscles: ['upper back'],
    secondaryMuscles: ['biceps', 'lats', 'rear delts'],
    equipment: 'cable',
    category: 'strength',
    mechanic: 'compound',
    instructions: [
      'Attach a wide neutral-grip bar to a low cable pulley and sit with knees slightly bent.',
      'Grip the handles wider than shoulder width, palms facing each other, arms extended, torso upright.',
      'Pull the handles to your torso, flaring your elbows out to the sides and squeezing your shoulder blades together.',
      'Slowly return to the stretched starting position and repeat.',
    ],
    images: [],
    rationale: 'Ji-logged staple',
  },
]

export default additions
