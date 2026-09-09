# Simulation model

All numerical models below are entertainment approximations, not certified aviation data. See the separate procedural source matrix.

## Space, time and determinism

The local plane spans 800 × 380 modeled nautical miles. A Türkiye outline extracted from Natural Earth 1:110m public-domain country data is rounded and projected with a Türkiye-centered equirectangular approximation. This makes geographic orientation recognizable; it is not a legal boundary or navigation product. Four approximate regional labels aid orientation. Aircraft still fly between explicitly fictional fixes and through modeled sectors. Motion uses Euclidean nautical miles and nautical headings (north 000°, east 090°).

The worker owns a 250 ms fixed step. Speed controls change the number of steps scheduled, never the integrator. The wall-time scheduler clamps single stalls to 0.5 seconds and does not skip domain steps. Heavy processing can therefore reduce effective real-time speed. Hidden tabs automatically pause. Rendering does not consume the traffic random generator or mutate simulation state.

Traffic uses a seeded integer pseudo-random generator. Initial flights, generated routes, types and events repeat for a given scenario/seed/settings combination. Accepted and rejected inputs, position changes and manual finish are event-sourced. Checkpoints and hashes make replay reconstruction testable. Determinism is verified in the shipped JavaScript engine environment; bit-identical floating point behavior across every browser engine is not certified.

## Aircraft motion

Five original performance categories cover regional jets, narrowbodies, widebodies, heavy widebodies and turboprops. Representative type codes choose these profiles; they do not imply manufacturer-supplied numbers.

Turns are rate-limited. Climb and descent depend on category and altitude, with explicit target capture. Acceleration is gradual. IAS is converted through a simplified atmosphere density relationship; Mach uses a temperature-based sound speed. Groundspeed and track include a fixed modeled 12-knot easterly-moving wind vector. Performance targets are bounded by the modeled Mach limit. Weather does not fetch or reproduce real winds.

A motion clearance is transmitted through the frequency queue, received, read back, evaluated, and then executed. Controller, pilot and system/coordination transmissions are separate records. Their duration derives from structured template length; safety and urgency traffic has priority. The rolling one-minute occupied time plus queued traffic produces frequency load. Correct, unable, clarification and corrected outcomes are deterministic. In challenging scenarios, every eleventh eligible command can trigger a modeled say-again exchange. This is a workload abstraction, not professional phraseology assessment.

## Control and coordination

The controller-facing sequence is approaching/advance notification → handoff offered → handoff accepted → awaiting initial contact → initial contact/correlation → identification → active control/monitoring. An adjacent-owned flight whose intent first enters the player's sector receives a timed advance-notification state before the actionable offer. ACCEPT confirms the modeled inbound handoff and reserves exclusive ownership, but the target does not become eligible for surveillance clearances until its queued initial call completes and IDENTIFY establishes the modeled radar-contact state.

Outbound TRANSFER creates a coordination request. The adjacent-sector state machine derives its load from traffic, conflicts and pending transfers, then schedules deterministic acceptance; high load delays rather than randomly rejects. CONTACT becomes available after acceptance and changes ownership only after the frequency-change transmission. A boundary crossing alone never grants ownership. Neighboring sectors do not solve traffic tactically, so this remains a modeled coordination agent rather than controller AI. Network controls can take, combine and split modeled positions.

Initial traffic is checked for a separated entry slot. A flight that cannot be placed within its category envelope is delayed/withheld, rather than spawned inside a separation loss. Authored conflict scenarios introduce converging traffic with intervention time.

## Separation and prediction

Horizontal infringement is strictly less than 5 NM. Vertical infringement is strictly below the applicable modeled minimum: 1,000 ft below FL290, 1,000 ft for eligible RVSM pairs wholly within FL290–410, otherwise 2,000 ft. Mixed band pairs receive the conservative larger requirement. Current trajectories are swept between physics ticks, preventing an endpoint-only missed crossing.

Prediction advances cloned aircraft with the same intent/performance equations using deterministic one-second coarse integration, sampling relative segments every five seconds over a five-minute horizon. Swept segment checks catch crossings between samples and estimate first infringement/closest approach. A conservative reach grid, distance pruning, per-aircraft trajectory caching within a pass and swept bounds limit fine pair checks; tests compare the filtered result with an unfiltered oracle. Prediction runs each simulated second while actual loss monitoring remains at every 250 ms physics step.

STCA is a separate modeled 120-second horizon. Alert episodes are counted at onset, not every tick. Prediction is conditional on current intent; unissued future controller actions, future abnormal events and future traffic spawns are not known to it. Five-second trajectory segments approximate continuously turning paths. No automatic conflict-resolution recommendation is offered.

Shift safety metrics concern aircraft in or owned by the player's selected/combined sectors. Network conflict counts still include surrounding traffic. Safety nets supplement prediction; they do not validate a clearance as safe.

## FRA

All scenarios use a dated 27 November 2025 calendar. The modeled FRA window crosses UTC midnight, includes 20:00, and excludes 02:00. Vertical eligibility includes FL305 and FL660, while individual aircraft ceilings still apply. New eligible traffic in Night FRA can file simplified direct segments once activation occurs. Existing aircraft retain their accepted route unless cleared otherwise.

Routes enforce synthetic entry/exit/intermediate point roles, activation effective date, and interior constraints against the rectangular synthetic network. Entry/exit connection handling is a documented approximation. Actual FRATURK points, route availability, equipment specifications, military eligibility, terminal connecting restrictions and full RAD constraints are not reproduced.

## Abnormalities and weather

Communication failure retains last accepted intent and blocks radio clearance delivery. Medical urgency changes destination/requested routing and enters the priority radio/request queues. Fuel state asks for priority and a lower level; degraded performance reduces the usable target; navigation degradation preserves heading instead of continuing route navigation. Moving weather cells cause requests only when route/aircraft proximity warrants it. Approving, denying or modifying a request changes its state and trajectory as applicable. Weather remains unresolved until clear of the modeled margin, and medical diversion requires compatible route and level. These model the controller-side consequences only; no aircraft checklist is provided.

## Traffic demand and causal events

Every shift has a deterministic demand profile: QUIET (0–15%), BUILDING (15–35%), BUSY (35–58%), PEAK (58–78%), then RECOVERY. The phase scales entry interval while seeded jitter prevents mechanical spacing. Scenario families increase pressure on matching synthetic flows without using schedules. Entry placement still withholds traffic when no separated level is available.

Scenario records establish initial weather or abnormal conditions. Consequences are condition-driven: moving weather near a controlled route creates a request; requests and clearances occupy the radio; radio backlog delays routine exchanges; adjacent load delays transfer acceptance; unresolved transfers and requests add workload. No module calls `Math.random`; state and the seeded generator reproduce the chain.

## Workload and report

SIMULATOR WORKLOAD is a clamped 0–100 sum, computed per sector:

- 3 per aircraft owned by the sector;
- 4 per approaching, offered, awaiting-contact or initial-calling flight;
- 6 per pending pilot request;
- 2 per queued or transmitting relevant radio item;
- 9 per predicted conflict;
- 5 per outbound coordination awaiting acceptance;
- 2 per boundary/next-sector pressure item;
- 9 per unresolved abnormal aircraft;
- 18% of current frequency-load percentage.

The sum is clamped to 100 and is not a DHMİ workload model. Adjacent sectors use a separate bounded load formula, preventing the player's workload from directly feeding itself. Any separation loss produces NOT PASSED regardless of efficiency. The report presents Safety, Flow and Efficiency indices plus traffic, request handling, radio peak, mean handoff delay, interventions and a replay-derived major-event timeline. Prediction disappearance is not proof of a player-caused resolution. Delay and extra miles remain approximate simulation metrics.

## Measured performance and limits

The benchmark in `tests/performance.test.ts` records 50/100/200/300-aircraft passes. On the final September 2026 verification run, isolated forecast measurements were 54/90/153/154 ms and one simulated second for 300 aircraft was 205 ms. Shared-host scheduling noise can make individual points non-monotonic. The previous 250 ms forecast integrator measured about 1.3 seconds at 300 aircraft on the same project host, so the coarse/swept design is measurably faster. Timings vary with load and are measurements, not guarantees. The worker keeps prediction off the UI thread; shipped scenarios use substantially lower counts.

Renderer geometry and label content are rebuilt on state/view changes rather than every display frame. PixiJS draws the retained scene independently. Screenshot verification uses software-rendered Chromium in this environment; native GPU performance will differ.

Scenario progression requires a safe full shift, or completion of all guided tutorial actions. The tutorial now covers inbound acceptance, initial call, identification, clearance/readback, pilot request, monitoring and delayed outbound transfer. Ending early still produces a report/replay but does not unlock progression. Practice mode makes all content available without changing the engine.
