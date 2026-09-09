# Living Airspace verification record

Final verification: 9 September 2026, Linux Codespaces, Node 24, Chromium through Playwright with software WebGL. This record covers engine/dataset 2.0 and the Active Controller + Living Airspace release.

## Automated checks

- `npm run typecheck`: passed with strict TypeScript.
- `npm run lint`: passed (Prettier formatting check).
- `npm test`: 103 tests passed across five files.
- `npm run test:e2e`: six Chromium workflows passed.
- `npm run build`: passed; Vite built 774 modules and generated the static worker/renderer bundles.
- `npm run test:offline`: passed with the browser disconnected after installation; no external runtime requests or console/page errors were observed.

The unit suite covers fixed-timestep independence, seeded scenario/event determinism, finite-state invariants, motion and performance response, geospatial/sector calculations, provider replacement, exclusive ownership, separation thresholds, RVSM, swept conflict prediction, FRA activation, replay reconstruction and import validation. Living Airspace tests additionally cover advance notification, inbound acceptance, initial contact, identification, queued transmissions, frequency load, single-readback execution gating, pilot request approval/denial, workload-dependent adjacent acceptance, transferred-aircraft rejection, weather causality, demand phases, challenge codes and V1 replay incompatibility.

Browser workflows exercise the complete tutorial cycle from inbound offer through delayed outbound transfer, typed and button clearances, readback execution, pause/speed, proactive conflict handling and STCA display, medical and weather requests, report/timeline, saved replay reload/seek, network view, settings persistence and corrupt-import recovery. The separate production test verifies the service-worker cache and a running simulation with network access disabled.

## Visual and interaction review

Real Chromium screenshots were inspected at 1440×900, 1366×768, 1920×1080 and 1024×768. Review covered briefing, recognizable Türkiye scope, modeled sector overlay, selected labels, command chooser, attention and frequency state, paused network view, and post-shift report. Automated checks found no document-width overflow. The 1024 layout remains usable by narrowing the flight rail; phone gameplay is outside the product target.

The scope keeps geographic source and modeled sector fidelity visible without turning into a street map. Label symbols and inspector text distinguish approaching, offered, initial-contact, request, transfer, abnormal and safety states. Semantic controls, keyboard activation, focus rings, reduced-motion support, modal focus handling and text/shape alert cues are present. This review is not a formal assistive-technology or cross-browser certification.

## Performance measurement

`tests/performance.test.ts` runs the deterministic predictor at 50, 100, 200 and 300 active aircraft. The final verification run recorded 54, 90, 153 and 154 ms respectively; four complete physics/prediction steps representing one simulated second at 300 aircraft took 205 ms. Run-to-run scheduling noise can make individual points non-monotonic. The earlier 250 ms forecast integrator measured about 1.3 seconds for a 300-aircraft pass on this project host. These are software-rendered shared-host measurements, not frame-rate guarantees; heavy processing slows simulation wall time rather than skipping fixed physics steps.

## Release boundaries

No implemented operational ATC rule is claimed `VERIFIED`. Natural Earth's source identity and public-domain reuse statement are `VERIFIED` metadata for the generalized geographic outline only. Separation, FRA, identification, coordination, radio timing, pilot behavior, workload, sector structure, navigation points, performance and abnormal handling remain `MODELED` or `SIMPLIFIED` as listed in [procedural fidelity](procedural-fidelity.md).

No AIP PDF, protected chart, extracted navigation table, live schedule, ADS-B feed or proprietary controller UI is distributed. Eight sectors, fixes, routes, traffic schedules and performance profiles are original modeled data. Browser screenshots, build output, test traces and installed dependencies are ignored development artifacts. Engine 2.0 rejects V1 recordings with an explicit incompatibility error; it never silently replays them under changed rules.
