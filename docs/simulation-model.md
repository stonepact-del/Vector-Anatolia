# Simulation model

All numerical models below are entertainment approximations, not certified aviation data. See the separate procedural source matrix.

## Space, time and determinism

The original synthetic plane spans 800 × 380 nautical miles. Its schematic outline suggests Anatolia without representing official borders. Aircraft fly between explicitly fictional fixes. Geographic haversine utilities are tested separately; synthetic map motion uses Euclidean nautical miles and nautical headings (north 000°, east 090°).

The worker owns a 250 ms fixed step. Speed controls change the number of steps scheduled, never the integrator. The wall-time scheduler clamps single stalls to 0.5 seconds and does not skip domain steps. Heavy processing can therefore reduce effective real-time speed. Hidden tabs automatically pause. Rendering does not consume the traffic random generator or mutate simulation state.

Traffic uses a seeded integer pseudo-random generator. Initial flights, generated routes, types and events repeat for a given scenario/seed/settings combination. Accepted and rejected inputs, position changes and manual finish are event-sourced. Checkpoints and hashes make replay reconstruction testable. Determinism is verified in the shipped JavaScript engine environment; bit-identical floating point behavior across every browser engine is not certified.

## Aircraft motion

Five original performance categories cover regional jets, narrowbodies, widebodies, heavy widebodies and turboprops. Representative type codes choose these profiles; they do not imply manufacturer-supplied numbers.

Turns are rate-limited. Climb and descent depend on category and altitude, with explicit target capture. Acceleration is gradual. IAS is converted through a simplified atmosphere density relationship; Mach uses a temperature-based sound speed. Groundspeed and track include a fixed modeled 12-knot easterly-moving wind vector. Performance targets are bounded by the modeled Mach limit. Weather does not fetch or reproduce real winds.

A motion clearance normally takes three simulation seconds to execute. Correct/readback, unable, clarification and corrected response records are deterministic. In challenging scenarios, every eleventh eligible command can trigger a modeled say-again exchange and two additional seconds of delay; the simulator automatically repeats the original instruction. This is a workload approximation, not a professional phraseology assessment.

## Control and coordination

The first guided flight starts inbound. ACCEPT establishes exclusive ownership and communication; IDENTIFY confirms the correlated target; control clearances then become available. TRANSFER initiates coordination with an adjacent sector; CONTACT commits the new owner. A geographic boundary crossing alone never grants ownership to the player.

The receiving side of coordination is simplified and agrees automatically. Surrounding flights follow their filed intent with basic ownership bookkeeping; there is no full neighboring-controller tactical intelligence. Sector layers are represented as FL140–305 and FL305–460; V1 positions combine both layers, so there is no separately staffed vertical-layer handoff.

Initial traffic is checked for a separated entry slot. A flight that cannot be placed within its category envelope is delayed/withheld, rather than spawned inside a separation loss. Authored conflict scenarios introduce converging traffic with intervention time.

## Separation and prediction

Horizontal infringement is strictly less than 5 NM. Vertical infringement is strictly below the applicable modeled minimum: 1,000 ft below FL290, 1,000 ft for eligible RVSM pairs wholly within FL290–410, otherwise 2,000 ft. Mixed band pairs receive the conservative larger requirement. Current trajectories are swept between physics ticks, preventing an endpoint-only missed crossing.

Prediction advances cloned aircraft with the same 250 ms motion model and accepted queued intents, sampling relative segments every five seconds over a five-minute horizon. Swept segment checks estimate first infringement and closest approach. A conservative spatial grid sized from maximum modeled reach, followed by distance pruning and swept trajectory bounds reduce candidate pairs; tests compare optimized results against an unfiltered oracle.

STCA is a separate modeled 120-second horizon. Alert episodes are counted at onset, not every tick. Prediction is conditional on current intent; unissued future controller actions, future abnormal events and future traffic spawns are not known to it. Five-second trajectory segments approximate continuously turning paths. No automatic conflict-resolution recommendation is offered.

Shift safety metrics concern aircraft in or owned by the player's selected/combined sectors. Network conflict counts still include surrounding traffic. Safety nets supplement prediction; they do not validate a clearance as safe.

## FRA

All scenarios use a dated 27 November 2025 calendar. The modeled FRA window crosses UTC midnight, includes 20:00, and excludes 02:00. Vertical eligibility includes FL305 and FL660, while individual aircraft ceilings still apply. New eligible traffic in Night FRA can file simplified direct segments once activation occurs. Existing aircraft retain their accepted route unless cleared otherwise.

Routes enforce synthetic entry/exit/intermediate point roles, activation effective date, and interior constraints against the rectangular synthetic network. Entry/exit connection handling is a documented approximation. Actual FRATURK points, route availability, equipment specifications, military eligibility, terminal connecting restrictions and full RAD constraints are not reproduced.

## Abnormalities and weather

Communication failure retains last accepted intent and blocks radio clearance execution. Medical urgency changes the requested destination to LTAC and requests routing through synthetic SIMCB plus a lower level; player commands execute the diversion. Cells move procedurally and generate deviation requests when traffic approaches. A direct clearance acknowledges the route response, but a weather abnormal remains unresolved until the aircraft is outside the cell margin. A medical diversion requires routing toward the requested diversion fix and a compatible lower cleared level. No pilot emergency checklist is provided. Minimum fuel and fuel emergency are distinct domain states; the shipped abnormal missions are communication failure and medical diversion.

## Workload and report

SIMULATOR WORKLOAD is a clamped 0–100 sum, computed per sector:

- 3 per owned or geographically present aircraft;
- 4 per inbound flight;
- 9 per relevant predicted conflict;
- 2 per vertical change;
- 2 per flight with a next-sector transition;
- 8 per unresolved abnormal flight;
- 2 per aircraft with a transmission in the preceding 30 seconds.

This is not a DHMİ workload model. Any separation loss produces NOT PASSED regardless of efficiency. The report displays handled flights, alert episodes, prediction disappearance, handoffs, workload, clearances and excess track miles. Prediction disappearance is not proof of a player-caused resolution. Delay and extra miles are approximate endpoint metrics for exited flights, relative to initial straight-line transit; they are not operational schedule-delay estimates.

## Measured performance and limits

A 300-aircraft engine benchmark is included in `tests/performance.test.ts`. On this container, optimization reduced a five-minute forecast from approximately 1.8 seconds to approximately 0.5 seconds; a one-simulation-second advance with prediction took approximately 0.55 seconds in that run. Timings depend on host load. The worker keeps this work off the UI thread, but 300 aircraft at 4× is not a guaranteed real-time target. Shipped scenarios use substantially lower traffic counts.

Renderer geometry and label content are rebuilt on state/view changes rather than every display frame. PixiJS draws the retained scene independently. Screenshot verification uses software-rendered Chromium in this environment; native GPU performance will differ.

Scenario progression requires a safe full shift, or completion of all guided tutorial actions. Ending an unfinished shift still produces a report/replay but does not unlock the next scenario. Practice mode makes all content available without changing procedures.
