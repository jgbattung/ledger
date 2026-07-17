/**
 * Dropped seed entries (LG-047 curation), grouped by reason. Every
 * removal carries a reason code so Ji can review and veto at the Phase 4
 * checkpoint. Reason codes: stretch, cardio, plyometric, strongman-event,
 * novelty-junk, neck, scope-trim (legitimate exercise, cut to match Ji's
 * actual usage scope rather than a quality judgment), duplicate-of:<kept-id>.
 */
import type { DropReason } from './curate.ts'

const drops: Record<string, DropReason> = {
  // ---- cardio (14) ----
  "Bicycling": "cardio", // Bicycling
  "Bicycling_Stationary": "cardio", // Bicycling, Stationary
  "Elliptical_Trainer": "cardio", // Elliptical Trainer
  "Jogging_Treadmill": "cardio", // Jogging, Treadmill
  "Prowler_Sprint": "cardio", // Prowler Sprint
  "Recumbent_Bike": "cardio", // Recumbent Bike
  "Rope_Jumping": "cardio", // Rope Jumping
  "Rowing_Stationary": "cardio", // Rowing, Stationary
  "Running_Treadmill": "cardio", // Running, Treadmill
  "Skating": "cardio", // Skating
  "Stairmaster": "cardio", // Stairmaster
  "Step_Mill": "cardio", // Step Mill
  "Trail_Running_Walking": "cardio", // Trail Running/Walking
  "Walking_Treadmill": "cardio", // Walking, Treadmill
  // ---- duplicate-of (4) ----
  "Bench_Press_-_Powerlifting": "duplicate-of:barbell-bench-press", // Bench Press - Powerlifting
  "Crunch_-_Legs_On_Exercise_Ball": "duplicate-of:exercise-ball-crunch", // Crunch - Legs On Exercise Ball
  "Oblique_Crunches_-_On_The_Floor": "duplicate-of:oblique-crunches", // Oblique Crunches - On The Floor
  // Ji review round 3 (2026-07-17): the seed's combined entry is redundant
  // with two already-kept, already-separate flat-model entries - "Close-Grip
  // Push-Up" (from Push-Ups_-_Close_Triceps_Position, keeps its own seed
  // photography) and "Wide Grip Push-Up" (renamed from Push-Up_Wide, ditto).
  // No new additions needed; both destinations already have real images.
  "Pushups_Close_and_Wide_Hand_Positions": "duplicate-of:close-grip-push-up", // Pushups (Close and Wide Hand Positions) - also duplicates Wide Grip Push-Up
  // ---- neck (9) ----
  "Isometric_Neck_Exercise_-_Front_And_Back": "neck", // Isometric Neck Exercise - Front And Back
  "Isometric_Neck_Exercise_-_Sides": "neck", // Isometric Neck Exercise - Sides
  "Lying_Face_Down_Plate_Neck_Resistance": "neck", // Lying Face Down Plate Neck Resistance
  "Lying_Face_Up_Plate_Neck_Resistance": "neck", // Lying Face Up Plate Neck Resistance
  "Neck-SMR": "neck", // Neck-SMR
  "Push_Press_-_Behind_the_Neck": "neck", // Push Press - Behind the Neck
  "Seated_Head_Harness_Neck_Resistance": "neck", // Seated Head Harness Neck Resistance
  "Standing_Barbell_Press_Behind_Neck": "neck", // Standing Barbell Press Behind Neck
  "Wide-Grip_Pulldown_Behind_The_Neck": "neck", // Wide-Grip Pulldown Behind The Neck
  // ---- novelty-junk (22) ----
  "Balance_Board": "novelty-junk", // Balance Board (Ji review round 2: balance/stability drill, not a targeted calf raise)
  "Back_Flyes_-_With_Bands": "novelty-junk", // Back Flyes - With Bands
  "Bench_Press_-_With_Bands": "novelty-junk", // Bench Press - With Bands
  "Bradford_Rocky_Presses": "novelty-junk", // Bradford/Rocky Presses
  "Calf_Raises_-_With_Bands": "novelty-junk", // Calf Raises - With Bands
  "Car_Drivers": "novelty-junk", // Car Drivers (Ji review round 4: gimmicky plate-rotation drill, not a standard shoulder movement)
  "Chain_Press": "novelty-junk", // Chain Press (Ji review round 3: chain-accommodated resistance, same family as the "with Bands" entries)
  "Clock_Push-Up": "novelty-junk", // Clock Push-Up (Ji review round 3: circular hand-walk drill, not a standard chest movement)
  "Close-Grip_EZ-Bar_Curl_with_Band": "novelty-junk", // Close-Grip EZ-Bar Curl with Band (Ji review round 2: band-accommodated variant, same treatment as other "with Bands" entries)
  "Cross_Over_-_With_Bands": "novelty-junk", // Cross Over - With Bands
  "Incline_Dumbbell_Flyes_-_With_A_Twist": "novelty-junk", // Incline Dumbbell Flyes - With A Twist
  "Isometric_Wipers": "novelty-junk", // Isometric Wipers (Ji review round 3: isometric plank drill, not a loaded chest movement)
  "Kettlebell_Pirate_Ships": "novelty-junk", // Kettlebell Pirate Ships (Ji review round 4: novelty-named ballistic drill)
  "Lateral_Raise_-_With_Bands": "novelty-junk", // Lateral Raise - With Bands
  "Plyo_Kettlebell_Pushups": "novelty-junk", // Plyo Kettlebell Pushups (Ji review round 3: plyometric push-up variant)
  "Power_Partials": "novelty-junk", // Power Partials (Ji review round 4: vague partial-rep gimmick, not a standard movement)
  "Push_Up_to_Side_Plank": "novelty-junk", // Push Up to Side Plank (Ji review round 3: combo/gimmick movement)
  "Rocky_Pull-Ups_Pulldowns": "novelty-junk", // Rocky Pull-Ups/Pulldowns
  "Shoulder_Press_-_With_Bands": "novelty-junk", // Shoulder Press - With Bands
  "Squats_-_With_Bands": "novelty-junk", // Squats - With Bands
  "Upright_Row_-_With_Bands": "novelty-junk", // Upright Row - With Bands
  "Weighted_Sit-Ups_-_With_Bands": "novelty-junk", // Weighted Sit-Ups - With Bands
  // ---- plyometric (61) ----
  "Alternate_Leg_Diagonal_Bound": "plyometric", // Alternate Leg Diagonal Bound
  "Backward_Medicine_Ball_Throw": "plyometric", // Backward Medicine Ball Throw
  "Bench_Jump": "plyometric", // Bench Jump
  "Bench_Sprint": "plyometric", // Bench Sprint
  "Box_Jump_Multiple_Response": "plyometric", // Box Jump (Multiple Response)
  "Box_Skip": "plyometric", // Box Skip
  "Carioca_Quick_Step": "plyometric", // Carioca Quick Step
  "Catch_and_Overhead_Throw": "plyometric", // Catch and Overhead Throw
  "Chest_Push_multiple_response": "plyometric", // Chest Push (multiple response)
  "Chest_Push_single_response": "plyometric", // Chest Push (single response)
  "Chest_Push_from_3_point_stance": "plyometric", // Chest Push from 3 point stance
  "Chest_Push_with_Run_Release": "plyometric", // Chest Push with Run Release
  "Depth_Jump_Leap": "plyometric", // Depth Jump Leap
  "Double_Leg_Butt_Kick": "plyometric", // Double Leg Butt Kick
  "Drop_Push": "plyometric", // Drop Push
  "Dumbbell_Seated_Box_Jump": "plyometric", // Dumbbell Seated Box Jump
  "Fast_Skipping": "plyometric", // Fast Skipping
  "Front_Box_Jump": "plyometric", // Front Box Jump
  "Front_Cone_Hops_or_hurdle_hops": "plyometric", // Front Cone Hops (or hurdle hops)
  "Heavy_Bag_Thrust": "plyometric", // Heavy Bag Thrust
  "Hurdle_Hops": "plyometric", // Hurdle Hops
  "Incline_Push-Up_Depth_Jump": "plyometric", // Incline Push-Up Depth Jump
  "Isometric_Chest_Squeezes": "plyometric", // Isometric Chest Squeezes
  "Knee_Tuck_Jump": "plyometric", // Knee Tuck Jump
  "Kneeling_Arm_Drill": "plyometric", // Kneeling Arm Drill
  "Lateral_Bound": "plyometric", // Lateral Bound
  "Lateral_Box_Jump": "plyometric", // Lateral Box Jump
  "Lateral_Cone_Hops": "plyometric", // Lateral Cone Hops
  "Linear_3-Part_Start_Technique": "plyometric", // Linear 3-Part Start Technique
  "Linear_Acceleration_Wall_Drill": "plyometric", // Linear Acceleration Wall Drill
  "Linear_Depth_Jump": "plyometric", // Linear Depth Jump
  "Medicine_Ball_Chest_Pass": "plyometric", // Medicine Ball Chest Pass
  "Medicine_Ball_Full_Twist": "plyometric", // Medicine Ball Full Twist
  "Medicine_Ball_Scoop_Throw": "plyometric", // Medicine Ball Scoop Throw
  "Mountain_Climbers": "plyometric", // Mountain Climbers
  "Moving_Claw_Series": "plyometric", // Moving Claw Series
  "Overhead_Slam": "plyometric", // Overhead Slam
  "Plyo_Push-up": "plyometric", // Plyo Push-up
  "Quick_Leap": "plyometric", // Quick Leap
  "Return_Push_from_Stance": "plyometric", // Return Push from Stance
  "Rocket_Jump": "plyometric", // Rocket Jump
  "Scissors_Jump": "plyometric", // Scissors Jump
  "Side_Hop-Sprint": "plyometric", // Side Hop-Sprint
  "Side_Standing_Long_Jump": "plyometric", // Side Standing Long Jump
  "Side_to_Side_Box_Shuffle": "plyometric", // Side to Side Box Shuffle
  "Single_Leg_Butt_Kick": "plyometric", // Single Leg Butt Kick
  "Single_Leg_Push-off": "plyometric", // Single Leg Push-off
  "Single-Cone_Sprint_Drill": "plyometric", // Single-Cone Sprint Drill
  "Single-Leg_Hop_Progression": "plyometric", // Single-Leg Hop Progression
  "Single-Leg_Lateral_Hop": "plyometric", // Single-Leg Lateral Hop
  "Single-Leg_Stride_Jump": "plyometric", // Single-Leg Stride Jump
  "Sledgehammer_Swings": "plyometric", // Sledgehammer Swings
  "Split_Jump": "plyometric", // Split Jump
  "Standing_Long_Jump": "plyometric", // Standing Long Jump
  "Standing_Two-Arm_Overhead_Throw": "plyometric", // Standing Two-Arm Overhead Throw
  "Star_Jump": "plyometric", // Star Jump
  "Stride_Jump_Crossover": "plyometric", // Stride Jump Crossover
  "Supine_Chest_Throw": "plyometric", // Supine Chest Throw
  "Supine_One-Arm_Overhead_Throw": "plyometric", // Supine One-Arm Overhead Throw
  "Supine_Two-Arm_Overhead_Throw": "plyometric", // Supine Two-Arm Overhead Throw
  "Vertical_Swing": "plyometric", // Vertical Swing
  // ---- scope-trim (66) ----
  // Ji review round 1 (2026-07-17): legitimate exercises, not junk - cut to
  // shrink the abs/obliques grouping down to what Ji actually logs plus a
  // small staple handful (Plank/Sit-Up/Crunches/Russian Twist tier). See
  // keeps.ts abs/obliques sections and .gsd/exercise-model.md for the kept
  // list and reason-code note.
  "3_4_Sit-Up": "scope-trim", // 3/4 Sit-Up
  "Advanced_Kettlebell_Windmill": "scope-trim", // Advanced Kettlebell Windmill
  "Air_Bike": "scope-trim", // Air Bike
  "Alternate_Heel_Touchers": "scope-trim", // Alternate Heel Touchers
  "Barbell_Ab_Rollout": "scope-trim", // Barbell Ab Rollout
  "Barbell_Ab_Rollout_-_On_Knees": "scope-trim", // Kneeling Barbell Ab Rollout
  "Barbell_Rollout_from_Bench": "scope-trim", // Barbell Rollout from Bench
  "Barbell_Side_Bend": "scope-trim", // Barbell Side Bend
  "Bent-Knee_Hip_Raise": "scope-trim", // Bent-Knee Hip Raise
  "Bent_Press": "scope-trim", // Bent Press
  "Bosu_Ball_Cable_Crunch_With_Side_Bends": "scope-trim", // Bosu Ball Cable Crunch With Side Bends
  "Bottoms_Up": "scope-trim", // Bottoms Up
  "Butt-Ups": "scope-trim", // Butt-Ups
  "Cable_Judo_Flip": "scope-trim", // Cable Judo Flip
  "Cable_Reverse_Crunch": "scope-trim", // Cable Reverse Crunch
  "Cable_Russian_Twists": "scope-trim", // Cable Russian Twists
  "Cable_Seated_Crunch": "scope-trim", // Cable Seated Crunch
  "Cocoons": "scope-trim", // Cocoons
  "Cross-Body_Crunch": "scope-trim", // Cross-Body Crunch
  "Crunch_-_Hands_Overhead": "scope-trim", // Overhead Crunch
  "Dead_Bug": "scope-trim", // Dead Bug
  "Decline_Oblique_Crunch": "scope-trim", // Decline Oblique Crunch
  "Decline_Reverse_Crunch": "scope-trim", // Decline Reverse Crunch
  "Double_Kettlebell_Windmill": "scope-trim", // Double Kettlebell Windmill
  "Dumbbell_Side_Bend": "scope-trim", // Dumbbell Side Bend
  "Elbow_to_Knee": "scope-trim", // Elbow to Knee
  "Exercise_Ball_Crunch": "scope-trim", // Exercise Ball Crunch
  "Exercise_Ball_Pull-In": "scope-trim", // Exercise Ball Pull-In
  "Flat_Bench_Leg_Pull-In": "scope-trim", // Flat Bench Leg Pull-In
  "Flat_Bench_Lying_Leg_Raise": "scope-trim", // Flat Bench Lying Leg Raise
  "Frog_Sit-Ups": "scope-trim", // Frog Sit-Ups
  "Gorilla_Chin_Crunch": "scope-trim", // Gorilla Chin/Crunch
  "Hanging_Pike": "scope-trim", // Hanging Pike
  "Jackknife_Sit-Up": "scope-trim", // Jackknife Sit-Up
  "Janda_Sit-Up": "scope-trim", // Janda Sit-Up
  "Kettlebell_Figure_8": "scope-trim", // Kettlebell Figure 8
  "Kettlebell_Pass_Between_The_Legs": "scope-trim", // Kettlebell Pass Between The Legs
  "Kettlebell_Windmill": "scope-trim", // Kettlebell Windmill
  "Knee_Hip_Raise_On_Parallel_Bars": "scope-trim", // Knee/Hip Raise On Parallel Bars
  "Kneeling_Cable_Crunch_With_Alternating_Oblique_Twists": "scope-trim", // Kneeling Cable Crunch With Alternating Oblique Twists
  "Landmine_180s": "scope-trim", // Landmine 180's
  "Leg_Pull-In": "scope-trim", // Leg Pull-In
  "One-Arm_High-Pulley_Cable_Side_Bends": "scope-trim", // One-Arm High-Pulley Cable Side Bends
  "One-Arm_Medicine_Ball_Slam": "scope-trim", // One-Arm Medicine Ball Slam
  "Otis-Up": "scope-trim", // Otis-Up
  "Pallof_Press": "scope-trim", // Pallof Press
  "Pallof_Press_With_Rotation": "scope-trim", // Pallof Press With Rotation
  "Plate_Twist": "scope-trim", // Plate Twist
  "Press_Sit-Up": "scope-trim", // Press Sit-Up
  "Rope_Crunch": "scope-trim", // Rope Crunch
  "Seated_Barbell_Twist": "scope-trim", // Seated Barbell Twist
  "Seated_Flat_Bench_Leg_Pull-In": "scope-trim", // Seated Flat Bench Leg Pull-In
  "Seated_Leg_Tucks": "scope-trim", // Seated Leg Tucks
  "Side_Jackknife": "scope-trim", // Side Jackknife
  "Smith_Machine_Hip_Raise": "scope-trim", // Smith Machine Hip Raise
  "Spell_Caster": "scope-trim", // Spell Caster
  "Spider_Crawl": "scope-trim", // Spider Crawl
  "Standing_Cable_Lift": "scope-trim", // Standing Cable Lift
  "Standing_Cable_Wood_Chop": "scope-trim", // Standing Cable Wood Chop
  "Standing_Rope_Crunch": "scope-trim", // Standing Rope Crunch
  "Suspended_Fallout": "scope-trim", // Suspended Fallout
  "Suspended_Reverse_Crunch": "scope-trim", // Suspended Reverse Crunch
  "Tuck_Crunch": "scope-trim", // Tuck Crunch
  "Weighted_Ball_Side_Bend": "scope-trim", // Weighted Ball Side Bend
  "Weighted_Crunches": "scope-trim", // Weighted Crunches
  "Wind_Sprints": "scope-trim", // Wind Sprints
  // Ji review round 2 (2026-07-17): biceps + calves trim. Biceps kept only
  // what Ji actually logs; these are legitimate narrow-variant curls, not
  // junk. Calves: Rocking Standing Calf Raise is a legitimate but unused
  // variant (Balance Board is filed under novelty-junk above instead).
  "Flexor_Incline_Dumbbell_Curls": "scope-trim", // Flexor Incline Dumbbell Curls
  "Incline_Inner_Biceps_Curl": "scope-trim", // Incline Inner Biceps Curl
  "Lying_Close-Grip_Bar_Curl_On_High_Pulley": "scope-trim", // Lying Close-Grip Bar Curl On High Pulley
  "Lying_High_Bench_Barbell_Curl": "scope-trim", // Lying High Bench Barbell Curl
  "Standing_Inner-Biceps_Curl": "scope-trim", // Standing Inner-Biceps Curl
  "Two-Arm_Dumbbell_Preacher_Curl": "scope-trim", // Two-Arm Dumbbell Preacher Curl
  "Rocking_Standing_Calf_Raise": "scope-trim", // Rocking Standing Calf Raise
  // Ji review round 3 (2026-07-17): chest trim - legitimate narrow presses
  // and grip/equipment variants Ji doesn't use.
  "Around_The_Worlds": "scope-trim", // Around The Worlds
  "Cable_Iron_Cross": "scope-trim", // Cable Iron Cross
  "Extended_Range_One-Arm_Kettlebell_Floor_Press": "scope-trim", // Extended Range One-Arm Kettlebell Floor Press
  "Hammer_Grip_Incline_DB_Bench_Press": "scope-trim", // Hammer Grip Incline DB Bench Press
  "Leg-Over_Floor_Press": "scope-trim", // Leg-Over Floor Press
  "Leverage_Chest_Press": "scope-trim", // Leverage Chest Press
  "Leverage_Decline_Chest_Press": "scope-trim", // Leverage Decline Chest Press
  "Leverage_Incline_Chest_Press": "scope-trim", // Leverage Incline Chest Press
  "Neck_Press": "scope-trim", // Neck Press
  "One-Arm_Kettlebell_Floor_Press": "scope-trim", // One-Arm Kettlebell Floor Press
  "Push-Ups_With_Feet_On_An_Exercise_Ball": "scope-trim", // Push-Ups With Feet On An Exercise Ball
  "Standing_Cable_Chest_Press": "scope-trim", // Standing Cable Chest Press
  "Suspended_Push-Up": "scope-trim", // Suspended Push-Up
  "Svend_Press": "scope-trim", // Svend Press
  // Ji review round 4 (2026-07-17): forearms trim.
  "Bottoms-Up_Clean_From_The_Hang_Position": "scope-trim", // Bottoms-Up Clean From The Hang Position
  "Palms-Down_Wrist_Curl_Over_A_Bench": "scope-trim", // Palms-Down Wrist Curl Over A Bench
  // Ji review round 4 (2026-07-17): front delts trim - mostly kettlebell
  // ballistics/olympic-style movements Ji doesn't use. Bent_Over_Low-Pulley_
  // Side_Lateral, Cable_Rope_Rear-Delt_Rows, and Reverse_Machine_Flyes are
  // really rear-delt movements the muscle heuristic misfiled here; still
  // dropped per Ji's explicit call rather than reclassified.
  "Battling_Ropes": "scope-trim", // Battling Ropes
  "Bent_Over_Low-Pulley_Side_Lateral": "scope-trim", // Bent Over Low-Pulley Side Lateral
  "Cable_Rope_Rear-Delt_Rows": "scope-trim", // Cable Rope Rear-Delt Rows
  "Clean_and_Jerk": "scope-trim", // Clean and Jerk
  "Clean_and_Press": "scope-trim", // Clean and Press
  "Cuban_Press": "scope-trim", // Cuban Press
  "Double_Kettlebell_Jerk": "scope-trim", // Double Kettlebell Jerk
  "Double_Kettlebell_Push_Press": "scope-trim", // Double Kettlebell Push Press
  "Double_Kettlebell_Snatch": "scope-trim", // Double Kettlebell Snatch
  "Kettlebell_Arnold_Press": "scope-trim", // Kettlebell Arnold Press
  "Kettlebell_Seated_Press": "scope-trim", // Kettlebell Seated Press
  "Kettlebell_Seesaw_Press": "scope-trim", // Kettlebell Seesaw Press
  "Kettlebell_Thruster": "scope-trim", // Kettlebell Thruster
  "Kettlebell_Turkish_Get-Up_Lunge_style": "scope-trim", // Kettlebell Turkish Get-Up (Lunge style)
  "Kettlebell_Turkish_Get-Up_Squat_style": "scope-trim", // Kettlebell Turkish Get-Up (Squat style)
  "One-Arm_Kettlebell_Clean_and_Jerk": "scope-trim", // One-Arm Kettlebell Clean and Jerk
  "One-Arm_Kettlebell_Jerk": "scope-trim", // One-Arm Kettlebell Jerk
  "One-Arm_Kettlebell_Military_Press_To_The_Side": "scope-trim", // One-Arm Kettlebell Military Press To The Side
  "One-Arm_Kettlebell_Para_Press": "scope-trim", // One-Arm Kettlebell Para Press
  "One-Arm_Kettlebell_Push_Press": "scope-trim", // One-Arm Kettlebell Push Press
  "One-Arm_Kettlebell_Snatch": "scope-trim", // One-Arm Kettlebell Snatch
  "One-Arm_Kettlebell_Split_Jerk": "scope-trim", // One-Arm Kettlebell Split Jerk
  "One-Arm_Kettlebell_Split_Snatch": "scope-trim", // One-Arm Kettlebell Split Snatch
  "One-Arm_Side_Laterals": "scope-trim", // One-Arm Side Laterals
  "Rack_Delivery": "scope-trim", // Rack Delivery
  "Reverse_Machine_Flyes": "scope-trim", // Reverse Machine Flyes
  "See-Saw_Press_Alternating_Side_Press": "scope-trim", // See-Saw Press (Alternating Side Press)
  "Single-Arm_Linear_Jammer": "scope-trim", // Single-Arm Linear Jammer
  "Sled_Overhead_Backward_Walk": "scope-trim", // Sled Overhead Backward Walk
  "Two-Arm_Kettlebell_Clean": "scope-trim", // Two-Arm Kettlebell Clean
  "Two-Arm_Kettlebell_Jerk": "scope-trim", // Two-Arm Kettlebell Jerk
  "Two-Arm_Kettlebell_Military_Press": "scope-trim", // Two-Arm Kettlebell Military Press
  // Ji review round 5 (2026-07-17): glutes trim.
  "Downward_Facing_Balance": "scope-trim", // Downward Facing Balance
  "Flutter_Kicks": "scope-trim", // Flutter Kicks
  "Kneeling_Jump_Squat": "scope-trim", // Kneeling Jump Squat
  "Kneeling_Squat": "scope-trim", // Kneeling Squat
  "Physioball_Hip_Bridge": "scope-trim", // Physioball Hip Bridge
  "Pull_Through": "scope-trim", // Pull Through
  // Ji review round 5 (2026-07-17): hamstrings trim - mostly olympic-lift
  // derivatives and kettlebell ballistics.
  "Alternating_Hang_Clean": "scope-trim", // Alternating Hang Clean
  "Ball_Leg_Curl": "scope-trim", // Ball Leg Curl
  "Band_Good_Morning_Pull_Through": "scope-trim", // Band Good Morning (Pull Through)
  "Hang_Snatch_-_Below_Knees": "scope-trim", // Below-the-Knee Hang Snatch
  "Double_Kettlebell_Alternating_Hang_Clean": "scope-trim", // Double Kettlebell Alternating Hang Clean
  "Hang_Snatch": "scope-trim", // Hang Snatch
  "Hanging_Bar_Good_Morning": "scope-trim", // Hanging Bar Good Morning
  "Kettlebell_Dead_Clean": "scope-trim", // Kettlebell Dead Clean
  "Kettlebell_Hang_Clean": "scope-trim", // Kettlebell Hang Clean
  "Kettlebell_One-Legged_Deadlift": "scope-trim", // Kettlebell One-Legged Deadlift
  "Muscle_Snatch": "scope-trim", // Muscle Snatch
  "One-Arm_Kettlebell_Clean": "scope-trim", // One-Arm Kettlebell Clean
  "One-Arm_Kettlebell_Swings": "scope-trim", // One-Arm Kettlebell Swings
  "One-Arm_Open_Palm_Kettlebell_Clean": "scope-trim", // One-Arm Open Palm Kettlebell Clean
  "Open_Palm_Kettlebell_Clean": "scope-trim", // Open Palm Kettlebell Clean
  "Power_Clean": "scope-trim", // Power Clean
  "Power_Clean_from_Blocks": "scope-trim", // Power Clean from Blocks
  "Power_Snatch": "scope-trim", // Power Snatch
  "Snatch_Deadlift": "scope-trim", // Snatch Deadlift
  "Snatch_Pull": "scope-trim", // Snatch Pull
  "Split_Snatch": "scope-trim", // Split Snatch
  "Sumo_Deadlift_with_Bands": "scope-trim", // Sumo Deadlift with Bands
  "Sumo_Deadlift_with_Chains": "scope-trim", // Sumo Deadlift with Chains
  // Ji review round 5 (2026-07-17): lats trim.
  "Gironda_Sternum_Chins": "scope-trim", // Gironda Sternum Chins
  "London_Bridges": "scope-trim", // London Bridges
  // ---- stretch (122) ----
  "90_90_Hamstring": "stretch", // 90/90 Hamstring
  "Adductor": "stretch", // Adductor
  "Adductor_Groin": "stretch", // Adductor/Groin
  "All_Fours_Quad_Stretch": "stretch", // All Fours Quad Stretch
  "Ankle_Circles": "stretch", // Ankle Circles
  "Ankle_On_The_Knee": "stretch", // Ankle On The Knee
  "Anterior_Tibialis-SMR": "stretch", // Anterior Tibialis-SMR
  "Arm_Circles": "stretch", // Arm Circles
  "Behind_Head_Chest_Stretch": "stretch", // Behind Head Chest Stretch
  "Brachialis-SMR": "stretch", // Brachialis-SMR
  "Calf_Stretch_Elbows_Against_Wall": "stretch", // Calf Stretch Elbows Against Wall
  "Calf_Stretch_Hands_Against_Wall": "stretch", // Calf Stretch Hands Against Wall
  "Calves-SMR": "stretch", // Calves-SMR
  "Cat_Stretch": "stretch", // Cat Stretch
  "Chair_Leg_Extended_Stretch": "stretch", // Chair Leg Extended Stretch
  "Chair_Lower_Back_Stretch": "stretch", // Chair Lower Back Stretch
  "Chair_Upper_Body_Stretch": "stretch", // Chair Upper Body Stretch
  "Chest_And_Front_Of_Shoulder_Stretch": "stretch", // Chest And Front Of Shoulder Stretch
  "Chest_Stretch_on_Stability_Ball": "stretch", // Chest Stretch on Stability Ball
  "Childs_Pose": "stretch", // Child's Pose
  "Chin_To_Chest_Stretch": "stretch", // Chin To Chest Stretch
  "Crossover_Reverse_Lunge": "stretch", // Crossover Reverse Lunge
  "Dancers_Stretch": "stretch", // Dancer's Stretch
  "Dynamic_Back_Stretch": "stretch", // Dynamic Back Stretch
  "Dynamic_Chest_Stretch": "stretch", // Dynamic Chest Stretch
  "Elbow_Circles": "stretch", // Elbow Circles
  "Elbows_Back": "stretch", // Elbows Back
  "Foot-SMR": "stretch", // Foot-SMR
  "Frog_Hops": "stretch", // Frog Hops
  "Front_Leg_Raises": "stretch", // Front Leg Raises
  "Groin_and_Back_Stretch": "stretch", // Groin and Back Stretch
  "Groiners": "stretch", // Groiners
  "Hamstring_Stretch": "stretch", // Hamstring Stretch
  "Hamstring-SMR": "stretch", // Hamstring-SMR
  "Hip_Circles_prone": "stretch", // Hip Circles (prone)
  "Hug_A_Ball": "stretch", // Hug A Ball
  "Hug_Knees_To_Chest": "stretch", // Hug Knees To Chest
  "Iliotibial_Tract-SMR": "stretch", // Iliotibial Tract-SMR
  "Inchworm": "stretch", // Inchworm
  "Intermediate_Groin_Stretch": "stretch", // Intermediate Groin Stretch
  "Intermediate_Hip_Flexor_and_Quad_Stretch": "stretch", // Intermediate Hip Flexor and Quad Stretch
  "Iron_Crosses_stretch": "stretch", // Iron Crosses (stretch)
  "IT_Band_and_Glute_Stretch": "stretch", // IT Band and Glute Stretch
  "Knee_Across_The_Body": "stretch", // Knee Across The Body
  "Knee_Circles": "stretch", // Knee Circles
  "Kneeling_Forearm_Stretch": "stretch", // Kneeling Forearm Stretch
  "Kneeling_Hip_Flexor": "stretch", // Kneeling Hip Flexor
  "Latissimus_Dorsi-SMR": "stretch", // Latissimus Dorsi-SMR
  "Leg-Up_Hamstring_Stretch": "stretch", // Leg-Up Hamstring Stretch
  "Looking_At_Ceiling": "stretch", // Looking At Ceiling
  "Lower_Back_Curl": "stretch", // Lower Back Curl
  "Lower_Back-SMR": "stretch", // Lower Back-SMR
  "Lying_Bent_Leg_Groin": "stretch", // Lying Bent Leg Groin
  "Lying_Crossover": "stretch", // Lying Crossover
  "Lying_Glute": "stretch", // Lying Glute
  "Lying_Hamstring": "stretch", // Lying Hamstring
  "Lying_Prone_Quadriceps": "stretch", // Lying Prone Quadriceps
  "Middle_Back_Stretch": "stretch", // Middle Back Stretch
  "On_Your_Side_Quad_Stretch": "stretch", // On Your Side Quad Stretch
  "On-Your-Back_Quad_Stretch": "stretch", // On-Your-Back Quad Stretch
  "One_Arm_Against_Wall": "stretch", // One Arm Against Wall
  "One_Half_Locust": "stretch", // One Half Locust
  "One_Handed_Hang": "stretch", // One Handed Hang
  "One_Knee_To_Chest": "stretch", // One Knee To Chest
  "Overhead_Lat": "stretch", // Overhead Lat
  "Overhead_Stretch": "stretch", // Overhead Stretch
  "Overhead_Triceps": "stretch", // Overhead Triceps
  "Pelvic_Tilt_Into_Bridge": "stretch", // Pelvic Tilt Into Bridge
  "Peroneals_Stretch": "stretch", // Peroneals Stretch
  "Peroneals-SMR": "stretch", // Peroneals-SMR
  "Piriformis-SMR": "stretch", // Piriformis-SMR
  "Posterior_Tibialis_Stretch": "stretch", // Posterior Tibialis Stretch
  "Pyramid": "stretch", // Pyramid
  "Quad_Stretch": "stretch", // Quad Stretch
  "Quadriceps-SMR": "stretch", // Quadriceps-SMR
  "Rear_Leg_Raises": "stretch", // Rear Leg Raises
  "Rhomboids-SMR": "stretch", // Rhomboids-SMR
  "Round_The_World_Shoulder_Stretch": "stretch", // Round The World Shoulder Stretch
  "Runners_Stretch": "stretch", // Runner's Stretch
  "Scissor_Kick": "stretch", // Scissor Kick
  "Seated_Biceps": "stretch", // Seated Biceps
  "Seated_Calf_Stretch": "stretch", // Seated Calf Stretch
  "Seated_Floor_Hamstring_Stretch": "stretch", // Seated Floor Hamstring Stretch
  "Seated_Front_Deltoid": "stretch", // Seated Front Deltoid
  "Seated_Glute": "stretch", // Seated Glute
  "Seated_Hamstring": "stretch", // Seated Hamstring
  "Seated_Hamstring_and_Calf_Stretch": "stretch", // Seated Hamstring and Calf Stretch
  "Seated_Overhead_Stretch": "stretch", // Seated Overhead Stretch
  "Shoulder_Circles": "stretch", // Shoulder Circles
  "Shoulder_Raise": "stretch", // Shoulder Raise
  "Shoulder_Stretch": "stretch", // Shoulder Stretch
  "Side_Leg_Raises": "stretch", // Side Leg Raises
  "Side_Lying_Groin_Stretch": "stretch", // Side Lying Groin Stretch
  "Side_Neck_Stretch": "stretch", // Side Neck Stretch
  "Side_Wrist_Pull": "stretch", // Side Wrist Pull
  "Side-Lying_Floor_Stretch": "stretch", // Side-Lying Floor Stretch
  "Sit_Squats": "stretch", // Sit Squats
  "Spinal_Stretch": "stretch", // Spinal Stretch
  "Split_Squats": "stretch", // Split Squats
  "Standing_Biceps_Stretch": "stretch", // Standing Biceps Stretch
  "Standing_Elevated_Quad_Stretch": "stretch", // Standing Elevated Quad Stretch
  "Standing_Gastrocnemius_Calf_Stretch": "stretch", // Standing Gastrocnemius Calf Stretch
  "Standing_Hamstring_and_Calf_Stretch": "stretch", // Standing Hamstring and Calf Stretch
  "Standing_Hip_Circles": "stretch", // Standing Hip Circles
  "Standing_Hip_Flexors": "stretch", // Standing Hip Flexors
  "Standing_Lateral_Stretch": "stretch", // Standing Lateral Stretch
  "Standing_Pelvic_Tilt": "stretch", // Standing Pelvic Tilt
  "Standing_Soleus_And_Achilles_Stretch": "stretch", // Standing Soleus And Achilles Stretch
  "Standing_Toe_Touches": "stretch", // Standing Toe Touches
  "Stomach_Vacuum": "stretch", // Stomach Vacuum
  "Superman": "stretch", // Superman
  "The_Straddle": "stretch", // The Straddle
  "Toe_Touchers": "stretch", // Toe Touchers
  "Torso_Rotation": "stretch", // Torso Rotation
  "Tricep_Side_Stretch": "stretch", // Tricep Side Stretch
  "Triceps_Stretch": "stretch", // Triceps Stretch
  "Upper_Back_Stretch": "stretch", // Upper Back Stretch
  "Upper_Back-Leg_Grab": "stretch", // Upper Back-Leg Grab
  "Upward_Stretch": "stretch", // Upward Stretch
  "Windmills": "stretch", // Windmills
  "Worlds_Greatest_Stretch": "stretch", // World's Greatest Stretch
  "Wrist_Circles": "stretch", // Wrist Circles
  // ---- strongman-event (21) ----
  "Atlas_Stone_Trainer": "strongman-event", // Atlas Stone Trainer
  "Atlas_Stones": "strongman-event", // Atlas Stones
  "Axle_Deadlift": "strongman-event", // Axle Deadlift
  "Backward_Drag": "strongman-event", // Backward Drag
  "Bear_Crawl_Sled_Drags": "strongman-event", // Bear Crawl Sled Drags
  "Car_Deadlift": "strongman-event", // Car Deadlift
  "Circus_Bell": "strongman-event", // Circus Bell
  "Conans_Wheel": "strongman-event", // Conan's Wheel
  "Crucifix": "strongman-event", // Crucifix
  "Farmers_Walk": "strongman-event", // Farmer's Walk
  "Forward_Drag_with_Press": "strongman-event", // Forward Drag with Press
  "Keg_Load": "strongman-event", // Keg Load
  "Log_Lift": "strongman-event", // Log Lift
  "Power_Stairs": "strongman-event", // Power Stairs
  "Rickshaw_Carry": "strongman-event", // Rickshaw Carry
  "Rickshaw_Deadlift": "strongman-event", // Rickshaw Deadlift
  "Sandbag_Load": "strongman-event", // Sandbag Load
  "Sled_Drag_-_Harness": "strongman-event", // Sled Drag - Harness
  "Sled_Push": "strongman-event", // Sled Push
  "Tire_Flip": "strongman-event", // Tire Flip
  "Yoke_Walk": "strongman-event", // Yoke Walk
}

export default drops
